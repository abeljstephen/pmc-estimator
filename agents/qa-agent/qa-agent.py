#!/usr/bin/env python3
"""
QA Orchestrator Agent for PMC Estimator
========================================
Coordinates math-agent, research-agent, and built-in static checks to produce
a comprehensive, prioritized QA report.

Usage:
  python qa-agent.py
  python qa-agent.py --target google-sheets-addon
  python qa-agent.py --target google-sheets-addon --scope math
  python qa-agent.py --target google-sheets-addon --scope full --output reports/

Scopes:
  full      Run all checks: static + math-agent + research-agent + synthesis (default)
  static    Static checks only (no API, fast)
  math      Static + math-agent
  research  Static + research-agent
  synth     Static + synthesis only (skip sub-agents, use cached sub-agent output if present)
"""

import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import anthropic

# ── Pricing constants (claude-opus-4-6) ──────────────────────────────────────
_PRICE_IN_PER_MTOK  = 15.00   # USD per million input tokens
_PRICE_OUT_PER_MTOK = 75.00   # USD per million output tokens

# Approximate output tokens per phase
_EST_OUT_TOKENS = {
    "math":     4_000,
    "research": 3_000,   # per question
    "synth":    6_000,
}

# Overhead tokens added to each call (system prompt, framing, etc.)
_CALL_OVERHEAD_TOKENS = 2_500

# Path to the API usage log written by UsageTracker / APIClient
_USAGE_LOG = (
    Path(__file__).parent.parent.parent
    / "system-google-sheets-addon" / "config" / "logs" / "api-usage.json"
)

AGENT_DIR  = Path(__file__).parent
PROJECT_ROOT = AGENT_DIR.parent.parent
REPORTS_DIR  = AGENT_DIR / "reports"
MATH_AGENT_SCRIPT     = PROJECT_ROOT / "agents" / "math-agent" / "math-auditor.py"
RESEARCH_AGENT_SCRIPT = PROJECT_ROOT / "agents" / "research-agent" / "research-agent.py"

# ── File manifests per target ────────────────────────────────────────────────

TARGETS = {
    "google-sheets-addon": {
        "root": PROJECT_ROOT / "system-google-sheets-addon",
        "gs_files": [
            "core/main/main.gs",
            "core/baseline/coordinator.gs",
            "core/baseline/pert-points.gs",
            "core/baseline/monte-carlo-smoothed.gs",
            "core/reshaping/copula-utils.gs",
            "core/reshaping/slider-adjustments.gs",
            "core/optimization/optimizer.gs",
            "core/optimization/kl-divergence.gs",
            "core/optimization/matrix-utils.gs",
            "core/variable_map/adapter.gs",
            "core/helpers/metrics.gs",
            "core/helpers/validation.gs",
            "core/report/reshaping_report.gs",
            "core/report/sheet-writer.gs",
            "core/report/playbooks.gs",
            "Code.gs",
        ],
        "html_files": ["Plot.html"],
        # Subset passed to math-agent (math-heavy files only)
        "math_files": [
            "core/baseline/pert-points.gs",
            "core/baseline/monte-carlo-smoothed.gs",
            "core/reshaping/copula-utils.gs",
            "core/reshaping/slider-adjustments.gs",
            "core/optimization/optimizer.gs",
            "core/optimization/kl-divergence.gs",
            "core/helpers/metrics.gs",
        ],
        # Questions asked of research-agent during QA
        "research_questions": [
            (
                "pipeline_integrity",
                "Trace the complete data flow from pmcEstimatorAPI() through generateBaseline(), "
                "reshapeDistribution(), optimizeSliders(), and adaptResponse(). For each stage boundary, "
                "identify what data is passed in, what comes out, and whether any required field could be "
                "undefined, missing, or incorrectly typed at that boundary.",
                ["core/main/main.gs", "core/baseline/coordinator.gs",
                 "core/reshaping/slider-adjustments.gs", "core/optimization/optimizer.gs",
                 "core/variable_map/adapter.gs"],
            ),
            (
                "cache_key_completeness",
                "Analyse the variant cache key construction in requestVariant() in Plot.html for each of "
                "the three variants (manual, fixed, adaptive). For each variant, list every input that "
                "affects the computed result. Verify that all such inputs are included in the cache key. "
                "Flag any input that is missing and would cause stale cached results to be returned after "
                "the input changes.",
                ["Plot.html"],
            ),
            (
                "slider_data_flow",
                "Trace how slider values flow from the Card D interactive inputs (stp2d_* elements) "
                "through to the API call in requestVariant(). Specifically: (1) how does the card D "
                "input event handler propagate values to the hidden sidebar inputs, (2) does "
                "setSlidersDisabled() ever block this propagation, (3) what does sliderValues() "
                "actually read and is it always the current card D values.",
                ["Plot.html"],
            ),
            (
                "cross_file_dependencies",
                "Map every function that is called in one file but defined in a different file across "
                "the entire google-sheets-addon codebase. For each cross-file call, confirm the "
                "target function exists. Flag any call where the definition cannot be found.",
                [
                    "core/main/main.gs", "core/baseline/coordinator.gs",
                    "core/reshaping/copula-utils.gs", "core/reshaping/slider-adjustments.gs",
                    "core/optimization/optimizer.gs", "core/helpers/metrics.gs",
                    "core/variable_map/adapter.gs",
                ],
            ),
        ],
    },
    "wordpress-plugin": {
        "root": PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator",
        "gs_files": [],
        "html_files": ["templates/estimator.html"],
        "math_files": [
            "assets/js/engine/baseline.js",
            "assets/js/engine/copula.js",
            "assets/js/engine/optimizer.js",
            "assets/js/engine/saco.js",
        ],
        "research_questions": [
            (
                "engine_parity",
                "Compare the WordPress browser engine (baseline.js, copula.js, optimizer.js, saco.js) "
                "against the GAS implementation. Identify any divergence in algorithm, formula, or "
                "data handling that would cause the two implementations to produce different results "
                "for the same inputs.",
                [
                    "assets/js/engine/baseline.js", "assets/js/engine/copula.js",
                    "assets/js/engine/optimizer.js", "assets/js/engine/saco.js",
                ],
            ),
        ],
    },
}

# ── Cost gate helpers ────────────────────────────────────────────────────────

def _file_tokens(path: Path) -> int:
    """Estimate token count from file size (chars / 4)."""
    try:
        return max(1, len(path.read_text(encoding="utf-8")) // 4)
    except Exception:
        return 0


def _usd(tokens_in: int, tokens_out: int) -> float:
    return (tokens_in / 1_000_000) * _PRICE_IN_PER_MTOK + \
           (tokens_out / 1_000_000) * _PRICE_OUT_PER_MTOK


def read_current_usage() -> dict:
    """
    Return a dict with keys: total_cost, total_input_tokens, total_output_tokens,
    total_requests. Falls back to zeros if log is missing or empty.
    """
    blank = {"total_cost": 0.0, "total_input_tokens": 0, "total_output_tokens": 0,
             "total_requests": 0}
    if not _USAGE_LOG.exists():
        return blank
    try:
        data = json.loads(_USAGE_LOG.read_text(encoding="utf-8"))
        if not data:
            return blank
        # The log is a list of request records
        if isinstance(data, list):
            total_cost = sum(r.get("cost_usd", 0.0) for r in data)
            total_in   = sum(r.get("input_tokens", 0)  for r in data)
            total_out  = sum(r.get("output_tokens", 0) for r in data)
            return {
                "total_cost":          total_cost,
                "total_input_tokens":  total_in,
                "total_output_tokens": total_out,
                "total_requests":      len(data),
            }
        # Already aggregated dict
        if isinstance(data, dict):
            return {
                "total_cost":          data.get("total_cost_usd", data.get("total_cost", 0.0)),
                "total_input_tokens":  data.get("total_input_tokens", 0),
                "total_output_tokens": data.get("total_output_tokens", 0),
                "total_requests":      data.get("total_requests", 0),
            }
    except Exception:
        pass
    return blank


def estimate_phase_costs(args, manifest: dict) -> list:
    """
    Returns a list of dicts:
      { phase, label, files, tokens_in, tokens_out, cost_usd }
    Only includes phases that will actually run given args.scope.
    """
    root = manifest["root"]
    phases = []

    if args.scope in ("full", "math"):
        math_paths = [root / f for f in manifest.get("math_files", [])]
        tok_in = sum(_file_tokens(p) for p in math_paths) + _CALL_OVERHEAD_TOKENS
        tok_out = _EST_OUT_TOKENS["math"]
        phases.append({
            "phase": "math",
            "label": "Math-agent audit",
            "files": [p.name for p in math_paths if p.exists()],
            "tokens_in":  tok_in,
            "tokens_out": tok_out,
            "cost_usd":   _usd(tok_in, tok_out),
        })

    if args.scope in ("full", "research"):
        for label, question, rel_files in manifest.get("research_questions", []):
            file_paths = [root / f for f in rel_files]
            tok_in = sum(_file_tokens(p) for p in file_paths) + _CALL_OVERHEAD_TOKENS
            tok_out = _EST_OUT_TOKENS["research"]
            heavy = any(_file_tokens(p) > 50_000 for p in file_paths)
            phases.append({
                "phase": "research",
                "label": f"Research: {label}",
                "files": [p.name for p in file_paths if p.exists()],
                "tokens_in":  tok_in,
                "tokens_out": tok_out,
                "cost_usd":   _usd(tok_in, tok_out),
                "heavy": heavy,
            })

    if args.scope in ("full", "math", "research", "synth"):
        # Synthesis input: static JSON (~5K) + sub-agent outputs (~6K each) + rules + prompt
        n_sub = len(phases)
        tok_in  = 5_000 + n_sub * 6_000 + 3_000 + _CALL_OVERHEAD_TOKENS
        tok_out = _EST_OUT_TOKENS["synth"]
        phases.append({
            "phase": "synth",
            "label": "Synthesis (Claude)",
            "files": [],
            "tokens_in":  tok_in,
            "tokens_out": tok_out,
            "cost_usd":   _usd(tok_in, tok_out),
        })

    return phases


def cost_gate(args, manifest: dict, no_confirm: bool = False) -> bool:
    """
    Show current API usage, per-phase cost estimates, and prompt for approval.
    Returns True if the user approves (or --no-confirm was passed).
    Returns False if the user declines (caller should skip all API phases).
    If no API phases will run (scope=static), returns True immediately.
    """
    phases = estimate_phase_costs(args, manifest)
    if not phases:
        # Static only — no API needed
        return True

    usage = read_current_usage()
    total_est = sum(p["cost_usd"] for p in phases)
    total_est_in  = sum(p["tokens_in"]  for p in phases)
    total_est_out = sum(p["tokens_out"] for p in phases)

    # ── Display ──────────────────────────────────────────────────────────────
    print(f"\n{C.BOLD}{'─'*60}{C.RESET}")
    print(f"{C.BOLD}  API Cost Gate{C.RESET}")
    print(f"{'─'*60}")

    # Current usage
    if usage["total_requests"] > 0:
        print(f"\n{C.BOLD}Current API usage (from log):{C.RESET}")
        print(f"  Requests charged : {usage['total_requests']}")
        print(f"  Input tokens     : {usage['total_input_tokens']:,}")
        print(f"  Output tokens    : {usage['total_output_tokens']:,}")
        print(f"  Total cost so far: {C.WARN}${usage['total_cost']:.4f}{C.RESET}")
    else:
        print(f"\n{C.INFO}Current API usage: $0.00 (no log entries found){C.RESET}")

    # Per-phase estimates
    print(f"\n{C.BOLD}Estimated cost for this run  (claude-opus-4-6, $15/$75 per MTok):{C.RESET}")
    print(f"  {'Phase':<38} {'In tokens':>10} {'Out tokens':>10} {'Est. cost':>10}")
    print(f"  {'─'*38} {'─'*10} {'─'*10} {'─'*10}")
    for p in phases:
        warn = f"  {C.WARN}[HEAVY — large file]{C.RESET}" if p.get("heavy") else ""
        print(f"  {p['label']:<38} {p['tokens_in']:>10,} {p['tokens_out']:>10,}"
              f"  {C.WARN}${p['cost_usd']:.3f}{C.RESET}{warn}")

    print(f"  {'─'*38} {'─'*10} {'─'*10} {'─'*10}")
    print(f"  {'ESTIMATED TOTAL':<38} {total_est_in:>10,} {total_est_out:>10,}"
          f"  {C.FAIL}${total_est:.3f}{C.RESET}")

    projected = usage["total_cost"] + total_est
    print(f"\n  Projected total after this run: {C.BOLD}${projected:.4f}{C.RESET}")

    # Warn about heavy files
    heavy_phases = [p for p in phases if p.get("heavy")]
    if heavy_phases:
        print(f"\n  {C.WARN}WARNING:{C.RESET} {len(heavy_phases)} research question(s) include large files "
              f"(Plot.html ~172K tokens) — each costs ~$2.50+ in input tokens alone.")

    print(f"\n  Model  : claude-opus-4-6")
    print(f"  Pricing: $15.00/MTok input · $75.00/MTok output")
    print(f"  Note   : estimates are approximate (chars÷4 tokenisation)")

    if no_confirm:
        print(f"\n{C.INFO}  --no-confirm set — proceeding automatically{C.RESET}")
        print(f"{'─'*60}\n")
        return True

    print(f"\n{'─'*60}")
    try:
        answer = input(f"  Proceed with API calls? [{C.BOLD}y{C.RESET}/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        answer = ""
    print(f"{'─'*60}\n")

    if answer in ("y", "yes"):
        return True

    print(f"{C.WARN}  API phases skipped — only static results will be reported.{C.RESET}\n")
    return False


# ── Colours ──────────────────────────────────────────────────────────────────

class C:
    FAIL  = "\033[91m"
    WARN  = "\033[93m"
    PASS  = "\033[92m"
    INFO  = "\033[96m"
    BOLD  = "\033[1m"
    RESET = "\033[0m"

def _sev(s):
    return {
        "FAIL":  C.FAIL  + "FAIL"  + C.RESET,
        "WARN":  C.WARN  + "WARN"  + C.RESET,
        "PASS":  C.PASS  + "PASS"  + C.RESET,
        "INFO":  C.INFO  + "INFO"  + C.RESET,
    }.get(s, s)

# ── Static checks (no API required) ─────────────────────────────────────────

def check_duplicate_ids(html_path: Path) -> list:
    """Duplicate HTML element IDs — getElementById silently returns first only."""
    text = html_path.read_text(encoding="utf-8")
    ids = re.findall(r'\bid=["\']([^"\']+)["\']', text)
    counts = defaultdict(int)
    for id_ in ids:
        counts[id_] += 1
    return [
        {
            "severity": "FAIL",
            "check": "duplicate_id",
            "file": html_path.name,
            "message": f'id="{id_}" declared {count}× — getElementById() returns only the first; '
                       f'event bindings on the duplicate are silently ignored.',
        }
        for id_, count in counts.items() if count > 1
    ]


def check_script_run_callbacks(html_path: Path) -> list:
    """Every google.script.run call must chain both success and failure handlers."""
    findings = []
    text = html_path.read_text(encoding="utf-8")
    # Grab each .run.xxx(…) block (greedy enough to capture the chain)
    for m in re.finditer(r'google\.script\.run([\s\S]{0,600}?)(?=;)', text):
        chain = m.group(1)
        if "withSuccessHandler" not in chain:
            findings.append({
                "severity": "WARN",
                "check": "missing_success_handler",
                "file": html_path.name,
                "message": "google.script.run call has no withSuccessHandler — result is discarded silently.",
            })
        if "withSuccessHandler" in chain and "withFailureHandler" not in chain:
            findings.append({
                "severity": "WARN",
                "check": "missing_failure_handler",
                "file": html_path.name,
                "message": "google.script.run has withSuccessHandler but no withFailureHandler — "
                           "server-side errors will fail silently.",
            })
    return findings


def check_slider_id_consistency(html_path: Path) -> list:
    """sliderIdMap, STP2_STANCE_META, and sliderValues() must all reference the same 7 keys."""
    findings = []
    text = html_path.read_text(encoding="utf-8")

    # sliderIdMap keys
    m = re.search(r'const sliderIdMap\s*=\s*\{([^}]+)\}', text, re.DOTALL)
    id_map_keys = set(re.findall(r'(\w+)\s*:', m.group(1))) if m else set()

    # sliderValues() keys
    m2 = re.search(r'function sliderValues\s*\(\)\s*\{[^}]*return\s*\{([^}]+)\}', text, re.DOTALL)
    sv_keys = set(re.findall(r'(\w+)\s*:', m2.group(1))) if m2 else set()

    # STP2_STANCE_META keys
    stance_keys = set(re.findall(r"key:\s*'(\w+)'", text))

    all_keys = id_map_keys | sv_keys | stance_keys
    for k in all_keys:
        present_in = []
        if k in id_map_keys:   present_in.append("sliderIdMap")
        if k in sv_keys:       present_in.append("sliderValues()")
        if k in stance_keys:   present_in.append("STP2_STANCE_META")
        if len(present_in) < 3:
            missing_in = [x for x in ["sliderIdMap", "sliderValues()", "STP2_STANCE_META"]
                          if x not in present_in]
            findings.append({
                "severity": "WARN",
                "check": "slider_key_consistency",
                "file": html_path.name,
                "message": f"Slider key '{k}' present in {present_in} but missing from {missing_in}.",
            })
    return findings


def check_console_log_in_gs(gs_files: list) -> list:
    """GAS runtime doesn't surface console.log — use Logger.log()."""
    findings = []
    for path in gs_files:
        if not path.exists():
            continue
        for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            stripped = line.strip()
            if "console.log" in stripped and not stripped.startswith("//"):
                findings.append({
                    "severity": "WARN",
                    "check": "console_log_in_gs",
                    "file": f"{path.name}:{i}",
                    "message": "console.log() has no effect in Google Apps Script — use Logger.log().",
                })
    return findings


def check_missing_error_boundaries(gs_files: list) -> list:
    """Public API entry functions should have try/catch at top level."""
    findings = []
    public_fns = {"pmcEstimatorAPI", "pmcWriteReportTab", "pertRunAllRows",
                  "pertRunSelectedRows", "pertRunCheckedRows", "pertRerunLastSheet"}
    for path in gs_files:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        for fn in public_fns:
            if re.search(rf'function\s+{fn}\s*\(', text):
                # Check if try/catch appears within ~30 lines after function declaration
                m = re.search(rf'function\s+{fn}\s*\([^)]*\)\s*\{{([\s\S]{{0,600}})', text)
                if m and "try {" not in m.group(1) and "try{" not in m.group(1):
                    findings.append({
                        "severity": "WARN",
                        "check": "missing_error_boundary",
                        "file": path.name,
                        "message": f"Public function {fn}() has no top-level try/catch — "
                                   f"uncaught exceptions will surface as opaque GAS errors.",
                    })
    return findings


def check_cache_key_slider_completeness(html_path: Path) -> list:
    """Manual variant cache key must include slider values to avoid stale cache hits."""
    findings = []
    text = html_path.read_text(encoding="utf-8")
    m = re.search(r'var key = JSON\.stringify\(\{([\s\S]{0,400}?)\}\)', text)
    if m:
        key_body = m.group(1)
        if "sliders" not in key_body and "sliderValues" not in key_body:
            findings.append({
                "severity": "FAIL",
                "check": "cache_key_missing_sliders",
                "file": html_path.name,
                "message": "requestVariant() cache key does not include slider values — "
                           "moving a Card D slider returns the cached result from the previous "
                           "slider position instead of re-running the API. "
                           "Fix: add sliders: window.sliderValues() for variant==='manual'.",
            })
    return findings


def check_gs_file_exists(manifest: dict) -> list:
    """All files declared in the manifest must exist on disk."""
    findings = []
    root = manifest["root"]
    for rel in manifest.get("gs_files", []) + manifest.get("html_files", []):
        p = root / rel
        if not p.exists():
            findings.append({
                "severity": "FAIL",
                "check": "missing_file",
                "file": rel,
                "message": f"Declared file not found on disk: {p}",
            })
    return findings


def check_html_event_bindings(html_path: Path) -> list:
    """onclick/oninput attributes referencing functions that aren't defined in the same file."""
    findings = []
    text = html_path.read_text(encoding="utf-8")

    # Extract all defined JS function names
    defined = set(re.findall(r'function\s+(\w+)\s*\(', text))
    # Extract window.xxx = function assignments
    defined |= set(re.findall(r'window\.(\w+)\s*=\s*function', text))

    # Find onclick= references
    called = re.findall(r'onclick=["\'](\w+)\s*\(', text)
    called += re.findall(r'onchange=["\'](\w+)\s*\(', text)

    for fn in called:
        if fn not in defined:
            findings.append({
                "severity": "WARN",
                "check": "unbound_event_handler",
                "file": html_path.name,
                "message": f"HTML event attribute calls '{fn}()' but no matching function definition "
                           f"found in this file.",
            })
    return findings


def run_all_static_checks(manifest: dict) -> list:
    root  = manifest["root"]
    gs    = [root / f for f in manifest.get("gs_files", [])]
    html  = [root / f for f in manifest.get("html_files", [])]
    findings = []
    findings += check_gs_file_exists(manifest)
    for h in html:
        if h.exists():
            findings += check_duplicate_ids(h)
            findings += check_script_run_callbacks(h)
            findings += check_slider_id_consistency(h)
            findings += check_cache_key_slider_completeness(h)
            findings += check_html_event_bindings(h)
    findings += check_console_log_in_gs(gs)
    findings += check_missing_error_boundaries(gs)
    return findings


# ── Sub-agent callers ────────────────────────────────────────────────────────

def call_math_agent(math_file_paths: list) -> str:
    """Import math-auditor.py via importlib and call audit_files() directly."""
    if not MATH_AGENT_SCRIPT.exists():
        return "[math-agent script not found at expected path]"

    spec = importlib.util.spec_from_file_location("math_auditor", MATH_AGENT_SCRIPT)
    mod  = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(mod)
    except Exception as e:
        return f"[math-agent import error: {e}]"

    # Redirect stdout so we capture the printed audit output
    import io, contextlib
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            mod.audit_files(
                file_paths=math_file_paths,
                agent_dir=MATH_AGENT_SCRIPT.parent,
                preferred_provider=None,
                interactive=False,
            )
    except SystemExit:
        pass  # audit_files may call sys.exit on error
    except Exception as e:
        return f"[math-agent runtime error: {e}]\n{buf.getvalue()}"

    return buf.getvalue() or "[math-agent produced no output]"


def call_research_agent(label: str, question: str, rel_files: list, root: Path) -> str:
    """Run research-agent.py as subprocess with --question and file list."""
    if not RESEARCH_AGENT_SCRIPT.exists():
        return "[research-agent script not found]"

    # research-agent expects paths relative to PROJECT_ROOT
    rel_to_root = []
    for f in rel_files:
        full = root / f
        if full.exists():
            rel_to_root.append(str(full.relative_to(PROJECT_ROOT)))

    if not rel_to_root:
        return "[no files found for research question]"

    cmd = [sys.executable, str(RESEARCH_AGENT_SCRIPT),
           "--question", question] + rel_to_root

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=180,
            cwd=str(PROJECT_ROOT),
        )
        output = result.stdout.strip()
        if not output and result.stderr:
            output = result.stderr.strip()
        return output or "[research-agent returned empty output]"
    except subprocess.TimeoutExpired:
        return "[research-agent timed out after 180s]"
    except Exception as e:
        return f"[research-agent subprocess error: {e}]"


# ── Report synthesis ─────────────────────────────────────────────────────────

def synthesize(static_findings: list, sub_agent_outputs: dict, target: str) -> str:
    """Ask Claude to synthesize all findings into a single prioritized report."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "[synthesis skipped — ANTHROPIC_API_KEY not set]"

    static_json = json.dumps(static_findings, indent=2)
    sub_sections = "\n\n".join(
        f"### {label}\n{output[:6000]}"
        for label, output in sub_agent_outputs.items()
    )

    rules_path = AGENT_DIR / "RULES.md"
    rules = rules_path.read_text(encoding="utf-8") if rules_path.exists() else ""

    prompt = f"""You are the QA Director for PMC Estimator — a Google Apps Script probability-based
project estimation tool using SACO (Shape-Adaptive Copula Optimisation).

You have outputs from three QA sub-agents. Synthesise them into a single, actionable QA report.

## QA Rules & Standards
{rules}

## Static Analysis Findings (automated, no AI)
{static_json}

## Sub-Agent Outputs
{sub_sections}

---

## Your QA Report

Produce a structured markdown report with these exact sections:

### Executive Summary
- Overall health score 0–100 with brief justification
- Counts: CRITICAL / HIGH / MEDIUM / LOW issues
- Top 3 action items for immediate attention

### Critical Issues  (blocks release — must fix)
For each issue:
**[FILE:LINE or COMPONENT]** — short title
- **Root cause**: …
- **Impact**: …
- **Exact fix**: code or config change required

### High Priority Issues
Same format, less urgency than Critical.

### Medium / Low Issues
Concise bullet list with file references. Group by category.

### Architecture & Design Observations
Patterns, structural risks, or technical debt worth noting that aren't bugs.

### Best Practice Gaps
What's missing relative to production GAS / web-app standards.

### Recommended Action Plan
Prioritised numbered list. Include effort estimate (small/medium/large) per item.

Rules:
- Reference file names and line numbers wherever possible
- Be direct — no filler text
- Distinguish clearly between confirmed bugs (FAIL) and risks (WARN)
- Do not repeat the same finding under multiple headings"""

    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=6000,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="QA Orchestrator for PMC Estimator")
    parser.add_argument("--target", default="google-sheets-addon",
                        choices=list(TARGETS.keys()),
                        help="Which project component to QA")
    parser.add_argument("--scope", default="full",
                        choices=["full", "static", "math", "research", "synth"],
                        help="Which checks to run")
    parser.add_argument("--output", default=None,
                        help="Directory to write report (default: agents/qa-agent/reports/)")
    parser.add_argument("--no-confirm", action="store_true",
                        help="Skip the API cost-gate prompt (for CI / automation)")
    args = parser.parse_args()

    manifest = TARGETS[args.target]
    root     = manifest["root"]
    gs_files = [root / f for f in manifest.get("gs_files", [])]
    math_files_rel = manifest.get("math_files", [])
    math_files_abs = [root / f for f in math_files_rel]

    out_dir = Path(args.output) if args.output else REPORTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y-%m-%d-%H-%M")
    print(f"\n{C.BOLD}{'='*60}{C.RESET}")
    print(f"{C.BOLD}  QA Agent  —  {args.target}{C.RESET}")
    print(f"  Scope: {args.scope}   |   {ts.replace('-', ':', 2).replace('-', ' ', 1)}")
    print(f"{C.BOLD}{'='*60}{C.RESET}\n")

    sub_agent_outputs = {}

    # ── Phase 1: Static checks ───────────────────────────────────────────────
    print(f"{C.BOLD}[1/4] Static checks{C.RESET}  (no API)")
    static_findings = run_all_static_checks(manifest)
    fails = sum(1 for f in static_findings if f["severity"] == "FAIL")
    warns = sum(1 for f in static_findings if f["severity"] == "WARN")
    for f in static_findings:
        print(f"  {_sev(f['severity'])}  {f['file']}  —  {f['message'][:100]}")
    print(f"  → {C.FAIL}{fails} FAIL{C.RESET}  {C.WARN}{warns} WARN{C.RESET}\n")

    # ── API cost gate (shown before any API call is made) ────────────────────
    api_approved = cost_gate(args, manifest, no_confirm=args.no_confirm)

    # ── Phase 2: Math agent ──────────────────────────────────────────────────
    if api_approved and args.scope in ("full", "math"):
        print(f"{C.BOLD}[2/4] Math-agent audit{C.RESET}")
        math_out = call_math_agent(math_files_abs)
        sub_agent_outputs["Math Agent Audit"] = math_out
        print(f"  → {len(math_out)} chars returned\n")
    else:
        reason = "scope" if args.scope not in ("full", "math") else "not approved"
        print(f"{C.INFO}[2/4] Math-agent skipped ({reason}){C.RESET}\n")
        sub_agent_outputs["Math Agent Audit"] = "(skipped)"

    # ── Phase 3: Research agent ──────────────────────────────────────────────
    if api_approved and args.scope in ("full", "research"):
        questions = manifest.get("research_questions", [])
        print(f"{C.BOLD}[3/4] Research-agent analysis{C.RESET}  ({len(questions)} questions)")
        for label, question, files in questions:
            print(f"  • {label} …", end="", flush=True)
            out = call_research_agent(label, question, files, root)
            sub_agent_outputs[f"Research: {label}"] = out
            print(f" {len(out)} chars")
        print()
    else:
        reason = "scope" if args.scope not in ("full", "research") else "not approved"
        print(f"{C.INFO}[3/4] Research-agent skipped ({reason}){C.RESET}\n")
        sub_agent_outputs["Research"] = "(skipped)"

    # ── Phase 4: Synthesis ───────────────────────────────────────────────────
    if api_approved and args.scope in ("full", "math", "research", "synth"):
        print(f"{C.BOLD}[4/4] Synthesising report via Claude{C.RESET}")
        report_body = synthesize(static_findings, sub_agent_outputs, args.target)
    else:
        # static-only or API not approved: format findings as plain report
        if not api_approved:
            print(f"{C.INFO}[4/4] Synthesis skipped (API not approved){C.RESET}\n")
        lines = ["## Static Findings\n"]
        for f in static_findings:
            lines.append(f"- **{f['severity']}** `{f['file']}` — {f['message']}")
        report_body = "\n".join(lines)

    # ── Write report ─────────────────────────────────────────────────────────
    header = (
        f"# QA Report — {args.target}\n"
        f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n"
        f"**Scope**: {args.scope}  \n"
        f"**Files scanned**: {len(gs_files) + len(manifest.get('html_files', []))}  \n"
        f"**Static findings**: {fails} FAIL · {warns} WARN  \n\n---\n\n"
    )
    report_path = out_dir / f"{ts}-{args.target}.md"
    report_path.write_text(header + report_body, encoding="utf-8")

    print(f"\n{C.PASS}Report written → {report_path}{C.RESET}\n")
    print("=" * 60)
    # Print first 80 lines of report to terminal
    preview_lines = (header + report_body).splitlines()[:80]
    print("\n".join(preview_lines))
    if len((header + report_body).splitlines()) > 80:
        print(f"\n{C.INFO}… full report at {report_path}{C.RESET}")


if __name__ == "__main__":
    main()
