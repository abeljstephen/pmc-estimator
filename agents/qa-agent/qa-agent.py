#!/usr/bin/env python3
"""
QA Orchestrator Agent for PMC Estimator
========================================
Coordinates math-agent, research-agent, and built-in static checks to produce
a comprehensive, prioritized QA report.

Usage:
  python qa-agent.py                          # interactive target selector
  python qa-agent.py --target google-sheets-addon
  python qa-agent.py --target all             # run all targets in sequence
  python qa-agent.py --target google-sheets-addon --scope math
  python qa-agent.py --target google-sheets-addon --scope full --output reports/

Scopes:
  full      Run all checks: static + math-agent + research-agent + synthesis (default)
  static    Static checks only (no API, fast)
  math      Static + math-agent
  research  Static + research-agent
  synth     Static + synthesis only (skip sub-agents, use cached sub-agent output if present)

Targets:
  google-sheets-addon   GAS engine + Plot.html (original target)
  wordpress-plugin      Browser JS engine (WP pmc-estimator plugin)
  wordpress-crm         PHP/WP CRM plugin (pmc-crm — keys, billing, REST API)
  custom-gpt            Custom GPT instructions + OpenAPI contract consistency
  all                   Run all targets in sequence
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
        "type": "gas",
        "description": "GAS engine + Plot.html (SACO core, copula, optimizer)",
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
        "php_files": [],
        "gpt_files": [],
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
        "synth_context": (
            "PMC Estimator is a Google Apps Script probability-based project estimation tool using "
            "SACO (Shape-Adaptive Copula Optimisation). The target is the GAS engine and Plot.html sidebar."
        ),
    },
    "wordpress-plugin": {
        "type": "js",
        "description": "Browser JS engine (WP pmc-estimator plugin — SACO port to JavaScript)",
        "root": PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator",
        "gs_files": [],
        "html_files": ["templates/estimator.html"],
        "php_files": [],
        "gpt_files": [],
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
        "synth_context": (
            "PMC Estimator WordPress plugin — a browser-side JavaScript port of the GAS SACO engine. "
            "The target is the JS engine files and the estimator HTML template."
        ),
    },
    "wordpress-crm": {
        "type": "php",
        "description": "PHP/WP CRM plugin (pmc-crm — API keys, credits, billing, Stripe, REST API)",
        "root": PROJECT_ROOT / "wordpress-plugin" / "pmc-crm",
        "gs_files": [],
        "html_files": [],
        "php_files": [
            "pmc-crm.php",
            "includes/schema.php",
            "includes/helpers.php",
            "includes/users.php",
            "includes/activity.php",
            "includes/rest-api.php",
            "includes/stripe.php",
            "includes/emails.php",
            "includes/promo.php",
            "includes/plans.php",
            "includes/gas.php",
            "includes/rate-limiter.php",
            "includes/fluentcrm.php",
            "includes/admin/dashboard.php",
            "includes/admin/users-list.php",
            "includes/admin/user-detail.php",
            "includes/admin/activity-log.php",
            "includes/admin/plans-editor.php",
            "includes/admin/promo-codes.php",
            "includes/admin/email-templates.php",
            "includes/admin/stripe-log.php",
            "includes/admin/gas-status.php",
            "includes/admin/settings.php",
            "includes/admin/tools.php",
            "includes/admin/help.php",
            "includes/admin/menu.php",
        ],
        "gpt_files": [],
        "math_files": [],
        "research_questions": [
            (
                "cross_system_contract",
                "In webapp.gs (GAS), what fields does the script POST to the WordPress REST /deduct "
                "endpoint after a successful SACO run (look for duration_ms, gas_exec_count, and any "
                "other fields sent to the /deduct route)? In rest-api.php (WordPress), what fields does "
                "pmc_rest_deduct() actually read from the request body? Identify any fields present in "
                "one side but absent or ignored in the other.",
                [
                    "system-google-sheets-addon/webapp.gs",
                    "wordpress-plugin/pmc-crm/includes/rest-api.php",
                ],
            ),
            (
                "stripe_payment_extraction",
                "In stripe.php, trace what Stripe payload fields are extracted in _pmc_stripe_checkout(), "
                "_pmc_stripe_renewal(), and _pmc_stripe_cancel(). For each handler, verify that "
                "pmc_log_payment() receives non-empty values for the critical audit fields "
                "(stripe_payment_intent, stripe_invoice_id, stripe_customer_id, stripe_charge_id). "
                "Identify any fields that may silently arrive as empty string due to optional presence "
                "in the Stripe webhook payload for that event type.",
                ["wordpress-plugin/pmc-crm/includes/stripe.php"],
            ),
            (
                "upgrade_path_integrity",
                "In pmc-crm.php, pmc_maybe_upgrade() triggers pmc_create_tables() only when the stored "
                "DB version is less than PMC_CRM_VERSION (currently 2.0.0). In schema.php, "
                "pmc_create_tables() defines all tables including wp_pmc_payments. "
                "Verify: (1) was PMC_CRM_VERSION incremented when the wp_pmc_payments table was added? "
                "(2) will the pmc_payments table be created on sites already running version 2.0.0? "
                "(3) does dbDelta() alone (without a version bump) guarantee the new table is created "
                "on existing installs? Flag if the new table will silently be missing on upgrades.",
                [
                    "wordpress-plugin/pmc-crm/pmc-crm.php",
                    "wordpress-plugin/pmc-crm/includes/schema.php",
                ],
            ),
        ],
        "synth_context": (
            "PMC Estimator CRM WordPress plugin (pmc-crm) — PHP plugin managing API keys, credit quotas, "
            "Stripe billing, and GAS monitoring. Security context: admin-only plugin with REST API endpoints "
            "called by the GAS engine. WordPress coding standards apply."
        ),
    },
    "custom-gpt": {
        "type": "gpt",
        "description": "Custom GPT instructions + OpenAPI contract (behavioral spec + API schema consistency)",
        "root": PROJECT_ROOT / "custom-gpt",
        "gs_files": [],
        "html_files": [],
        "php_files": [],
        "gpt_files": [
            "instructions.md",
            "openapi.yaml",
        ],
        "math_files": [],
        "research_questions": [
            (
                "contract_alignment",
                "Compare the sliderValues property names in openapi.yaml against the slider column headers "
                "in the mapping table in instructions.md. Are all 7 slider names identical (exact camelCase)? "
                "Also verify: (1) every action value in the openapi.yaml action enum "
                "(request_trial, call_api, check_quota, save_session, load_sessions) has a corresponding "
                "behavioral description in instructions.md, (2) reworkPercentage maximum of 50 is stated "
                "consistently in both files and in the mapping table, (3) instructions.md mentions asking "
                "about promo codes before calling request_trial.",
                [
                    "custom-gpt/instructions.md",
                    "custom-gpt/openapi.yaml",
                ],
            ),
            (
                "response_field_coverage",
                "List every response field that instructions.md references when presenting results "
                "(e.g. results[i].feasibilityScore, results[i].targetProbability.value.original, "
                "_quota.bar, _portfolio, results[i]._reportUrl, decisionReports[*].winningSliders). "
                "For each field, verify it exists in the openapi.yaml response schema. "
                "Also list any response fields in openapi.yaml that instructions.md never surfaces "
                "to the user — these may represent features the GPT is not using.",
                [
                    "custom-gpt/instructions.md",
                    "custom-gpt/openapi.yaml",
                ],
            ),
        ],
        "synth_context": (
            "PMC Estimator Custom GPT — the behavioral specification (instructions.md) and the OpenAPI "
            "action schema (openapi.yaml) that define how the ChatGPT model interacts with the GAS API. "
            "The QA goal is contract consistency: field names, enum values, credit costs, and behavioral "
            "rules must be consistent across both files and with the GAS engine."
        ),
    },
}

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

# ── Interactive target selector ───────────────────────────────────────────────

def select_targets_interactive() -> list:
    """Show a numbered menu and return a list of selected target keys."""
    target_list = list(TARGETS.keys())
    print(f"\n{C.BOLD}  Select QA target(s):{C.RESET}\n")
    for i, key in enumerate(target_list, 1):
        desc = TARGETS[key].get("description", "")
        print(f"  {C.BOLD}{i}.{C.RESET} {key:<28} {C.INFO}{desc}{C.RESET}")
    print(f"  {C.BOLD}{len(target_list)+1}.{C.RESET} all                          "
          f"{C.INFO}Run all targets in sequence{C.RESET}")

    print(f"\n  Enter number(s) comma-separated, a name, or 'all'.")
    print(f"  Examples:  1   |   1,3   |   all   |   wordpress-crm")
    try:
        answer = input(f"\n  Your choice: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        print()
        answer = "1"

    if answer in ("all", str(len(target_list) + 1)):
        return target_list

    selected = []
    seen = set()
    for part in answer.split(","):
        part = part.strip()
        # Try numeric index
        try:
            idx = int(part) - 1
            if 0 <= idx < len(target_list):
                key = target_list[idx]
                if key not in seen:
                    selected.append(key)
                    seen.add(key)
                continue
        except ValueError:
            pass
        # Try by name
        if part in TARGETS and part not in seen:
            selected.append(part)
            seen.add(part)

    if not selected:
        print(f"  {C.WARN}No valid selection — defaulting to google-sheets-addon{C.RESET}")
        return ["google-sheets-addon"]
    return selected

# ── Cost gate helpers ─────────────────────────────────────────────────────────

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
            file_paths = [root / f if not Path(f).is_absolute() else Path(f)
                          for f in rel_files]
            # For cross-target questions, files are relative to PROJECT_ROOT
            file_paths_resolved = []
            for f, orig in zip(file_paths, rel_files):
                if f.exists():
                    file_paths_resolved.append(f)
                else:
                    alt = PROJECT_ROOT / orig
                    if alt.exists():
                        file_paths_resolved.append(alt)
            tok_in = sum(_file_tokens(p) for p in file_paths_resolved) + _CALL_OVERHEAD_TOKENS
            tok_out = _EST_OUT_TOKENS["research"]
            heavy = any(_file_tokens(p) > 50_000 for p in file_paths_resolved)
            phases.append({
                "phase": "research",
                "label": f"Research: {label}",
                "files": [p.name for p in file_paths_resolved if p.exists()],
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


# ── Static checks: GAS / JavaScript (original) ───────────────────────────────

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

    m = re.search(r'const sliderIdMap\s*=\s*\{([^}]+)\}', text, re.DOTALL)
    id_map_keys = set(re.findall(r'(\w+)\s*:', m.group(1))) if m else set()

    m2 = re.search(r'function sliderValues\s*\(\)\s*\{[^}]*return\s*\{([^}]+)\}', text, re.DOTALL)
    sv_keys = set(re.findall(r'(\w+)\s*:', m2.group(1))) if m2 else set()

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
    m = re.search(r'var key = JSON\.stringify\(\{([\s\S]{0,600}?)\}\)', text)
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
    all_files = (
        manifest.get("gs_files", []) +
        manifest.get("html_files", []) +
        manifest.get("php_files", []) +
        manifest.get("gpt_files", [])
    )
    for rel in all_files:
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
    defined = set(re.findall(r'function\s+(\w+)\s*\(', text))
    defined |= set(re.findall(r'window\.(\w+)\s*=\s*function', text))
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


# ── Static checks: PHP / WordPress ───────────────────────────────────────────

def check_php_abspath_guard(php_files: list) -> list:
    """Every PHP file must have defined('ABSPATH') || exit as its first executable line."""
    findings = []
    for path in php_files:
        if not path.exists():
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        # Check first 5 non-empty, non-comment lines after <?php
        found = False
        checked = 0
        for line in lines[:20]:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or stripped.startswith("//") \
               or stripped.startswith("*") or stripped.startswith("/*") or stripped == "<?php":
                continue
            if "defined('ABSPATH')" in stripped or 'defined("ABSPATH")' in stripped:
                found = True
                break
            checked += 1
            if checked >= 5:
                break
        if not found:
            findings.append({
                "severity": "WARN",
                "check": "php_abspath_guard",
                "file": path.name,
                "message": "Missing defined('ABSPATH') || exit guard — file can be accessed directly "
                           "outside WordPress, bypassing all security checks.",
            })
    return findings


def check_php_output_escaping(php_files: list) -> list:
    """Direct echo of variables without WordPress escaping functions."""
    findings = []
    # Escape functions that make output safe
    safe_wrappers = (
        "esc_html(", "esc_attr(", "esc_url(", "esc_textarea(",
        "esc_js(", "wp_kses(", "wp_kses_post(",
        "number_format(", "absint(", "intval(", "floatval(",
        "(int)", "(float)", "(bool)",
    )
    for path in php_files:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        lines = text.splitlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            # Skip comments
            if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
                continue
            # Look for echo $var or <?= $var patterns not wrapped in an escape function
            # Pattern: echo followed by $ without an escape wrapper
            m = re.search(r'(?:echo|print)\s+(\$\w+)\s*[;,]', stripped)
            if m:
                expr = m.group(1)
                # Allow if the line also contains a safe wrapper applied to the same var
                if not any(w in stripped for w in safe_wrappers):
                    findings.append({
                        "severity": "WARN",
                        "check": "php_unescaped_output",
                        "file": f"{path.name}:{i}",
                        "message": f"Unescaped output: `echo {expr}` — use esc_html(), esc_attr(), "
                                   f"or esc_url() to prevent XSS.",
                    })
    return findings


def check_php_prepared_statements(php_files: list) -> list:
    """$wpdb queries with variable interpolation must use $wpdb->prepare()."""
    findings = []
    # Query methods that accept raw SQL
    query_methods = ["->get_var(", "->get_results(", "->get_row(", "->query("]
    for path in php_files:
        if not path.exists():
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("#"):
                continue
            if "$wpdb" not in stripped:
                continue
            if not any(m in stripped for m in query_methods):
                continue
            # If prepare() is used, it's safe
            if "->prepare(" in stripped or "->prepare (" in stripped:
                continue
            # If the argument contains a variable ($) it may be unsafe
            # Heuristic: look for $wpdb->method("...{$...}...) with a variable in the query string
            qm = re.search(r'\$wpdb->(?:get_var|get_results|get_row|query)\s*\(\s*"([^"]*)"', stripped)
            if not qm:
                continue
            query_str = qm.group(1)
            if '$' not in query_str:
                continue
            # Extract interpolated variable names from the query string
            interp_vars = re.findall(r'\{?\$(\w+(?:->\w+)?)\}?', query_str)
            # $table, $wpdb->prefix, and loop counters ($t, $field) are trusted internal WP values,
            # not user input — skip queries that only contain these safe identifiers
            SAFE_INTERNAL = {'table', 'wpdb', 'wpdb->prefix', 't', 'field', 'col'}
            if all(v in SAFE_INTERNAL for v in interp_vars):
                continue
            findings.append({
                "severity": "FAIL",
                "check": "php_unprepared_query",
                "file": f"{path.name}:{i}",
                "message": "Potential SQL injection: $wpdb query uses string interpolation without "
                           "$wpdb->prepare(). Use $wpdb->prepare() for all queries with variable input.",
            })
    return findings


def check_php_nonce_coverage(php_files: list) -> list:
    """Admin form handlers that read $_POST must verify a nonce in the same function."""
    findings = []
    for path in php_files:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8")
        # Find function bodies
        for fn_match in re.finditer(r'function\s+(\w+)\s*\([^)]*\)\s*:\s*\w+\s*\{|function\s+(\w+)\s*\([^)]*\)\s*\{', text):
            fn_start = fn_match.end()
            fn_name = fn_match.group(1) or fn_match.group(2)
            # Extract function body (naive: find matching brace)
            depth = 1
            pos = fn_start
            while pos < len(text) and depth > 0:
                if text[pos] == '{':
                    depth += 1
                elif text[pos] == '}':
                    depth -= 1
                pos += 1
            body = text[fn_start:pos]
            # If function reads $_POST and doesn't verify a nonce
            has_post_read = bool(re.search(r'\$_POST\s*\[', body))
            has_nonce = "wp_verify_nonce" in body or "check_ajax_referer" in body or "check_admin_referer" in body
            if has_post_read and not has_nonce:
                findings.append({
                    "severity": "WARN",
                    "check": "php_missing_nonce",
                    "file": f"{path.name}",
                    "message": f"Function {fn_name}() reads $_POST but has no wp_verify_nonce() call — "
                               f"CSRF vulnerability if this function can be triggered by a form submission.",
                })
    return findings


def check_php_wpdb_return_values(php_files: list) -> list:
    """$wpdb->insert/update/delete return values should be checked — false means the write failed."""
    findings = []
    for path in php_files:
        if not path.exists():
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("#"):
                continue
            # Match lines that call insert/update/delete but don't assign the result
            # i.e., lines starting with $wpdb-> rather than $var = $wpdb->
            m = re.match(r'^\$wpdb\s*->\s*(insert|update|delete)\s*\(', stripped)
            if m:
                findings.append({
                    "severity": "WARN",
                    "check": "php_wpdb_unchecked_return",
                    "file": f"{path.name}:{i}",
                    "message": f"$wpdb->{m.group(1)}() "
                               f"return value not checked — false on failure means a silent write error. "
                               f"Assign to a variable and check for false.",
                })
    return findings


def check_php_version_bump(php_files: list, schema_files: list) -> list:
    """
    Warn if the wp_pmc_payments table exists in schema.php but PMC_CRM_VERSION
    has not been incremented beyond 2.0.0 (the version when payments was added).
    """
    findings = []
    main_php = next((p for p in php_files if p.name == "pmc-crm.php" and p.exists()), None)
    schema_php = next((p for p in schema_files if p.name == "schema.php" and p.exists()), None)

    if not main_php or not schema_php:
        return findings

    version_match = re.search(r"PMC_CRM_VERSION'\s*,\s*'([^']+)'", main_php.read_text())
    has_payments  = "pmc_payments" in schema_php.read_text()

    if has_payments and version_match:
        ver = version_match.group(1)
        # The payments table was added after 2.0.0 — if version is still 2.0.0,
        # pmc_maybe_upgrade() won't trigger on existing installs
        if ver == "2.0.0":
            findings.append({
                "severity": "FAIL",
                "check": "php_version_not_bumped",
                "file": "pmc-crm.php",
                "message": f"PMC_CRM_VERSION is still '{ver}' but wp_pmc_payments table was added to "
                           f"schema.php. pmc_maybe_upgrade() will not run on existing 2.0.0 installs — "
                           f"the payments table will never be created. Bump PMC_CRM_VERSION to 2.1.0.",
            })
    return findings


# ── Static checks: Custom GPT contract ───────────────────────────────────────

# Canonical slider names as defined in openapi.yaml and copula-utils.gs
_CANONICAL_SLIDERS = {
    "scheduleFlexibility", "budgetFlexibility", "scopeCertainty",
    "scopeReductionAllowance", "reworkPercentage", "riskTolerance", "userConfidence",
}

def check_gpt_slider_key_names(gpt_root: Path) -> list:
    """Slider names in instructions.md mapping table must match openapi.yaml property names."""
    findings = []
    instructions = gpt_root / "instructions.md"
    openapi      = gpt_root / "openapi.yaml"

    if not instructions.exists() or not openapi.exists():
        return findings

    inst_text = instructions.read_text(encoding="utf-8")
    yaml_text = openapi.read_text(encoding="utf-8")

    # Extract slider property names from openapi.yaml (under sliderValues: properties:)
    yaml_slider_section = re.search(
        r'sliderValues:\s*\n(?:[\s\S]*?)properties:\s*\n([\s\S]+?)(?:\n\s{8}\w|\Z)', yaml_text
    )
    yaml_sliders = set()
    if yaml_slider_section:
        yaml_sliders = set(re.findall(r'^\s{10,}(\w+):', yaml_slider_section.group(1), re.MULTILINE))

    # Fall back to scanning for known property names
    if not yaml_sliders:
        for s in _CANONICAL_SLIDERS:
            if s in yaml_text:
                yaml_sliders.add(s)

    # Check that each canonical slider name appears in instructions.md
    for slider in _CANONICAL_SLIDERS:
        if slider not in inst_text:
            findings.append({
                "severity": "WARN",
                "check": "gpt_slider_name_missing",
                "file": "instructions.md",
                "message": f"Canonical slider name '{slider}' not found in instructions.md — "
                           f"if the mapping table uses a different name, the API will receive "
                           f"an unrecognised key and silently ignore it.",
            })

    return findings


def check_gpt_action_coverage(gpt_root: Path) -> list:
    """Every action in the openapi.yaml enum must have behavioral description in instructions.md."""
    findings = []
    instructions = gpt_root / "instructions.md"
    openapi      = gpt_root / "openapi.yaml"
    if not instructions.exists() or not openapi.exists():
        return findings

    inst_text = instructions.read_text(encoding="utf-8")
    yaml_text = openapi.read_text(encoding="utf-8")

    # Extract action enum values from openapi.yaml
    m = re.search(r'enum:\s*\[([^\]]+)\]', yaml_text)
    if not m:
        return findings
    actions = [a.strip().strip('"').strip("'") for a in m.group(1).split(",")]

    for action in actions:
        if action not in inst_text:
            findings.append({
                "severity": "WARN",
                "check": "gpt_action_not_described",
                "file": "instructions.md",
                "message": f"API action '{action}' is in openapi.yaml enum but not mentioned in "
                           f"instructions.md — the GPT will never use this action.",
            })
    return findings


def check_gpt_rework_domain(gpt_root: Path) -> list:
    """reworkPercentage max domain (0–50) must be consistent across openapi.yaml and instructions.md."""
    findings = []
    instructions = gpt_root / "instructions.md"
    openapi      = gpt_root / "openapi.yaml"
    if not instructions.exists() or not openapi.exists():
        return findings

    yaml_text = openapi.read_text(encoding="utf-8")
    inst_text = instructions.read_text(encoding="utf-8")

    # Check openapi.yaml has maximum: 50 for reworkPercentage
    # Use a greedy match up to the next sibling property to capture the full block
    rework_section = re.search(
        r'reworkPercentage:([\s\S]{0,600})(?=\n\s{20,24}\w|\Z)', yaml_text
    )
    if rework_section and "maximum: 50" not in rework_section.group(1):
        findings.append({
            "severity": "FAIL",
            "check": "gpt_rework_max_yaml",
            "file": "openapi.yaml",
            "message": "reworkPercentage is missing 'maximum: 50' constraint — should be 0–50, not 0–100.",
        })

    # Check instructions.md mentions the 50 cap
    # Accept: "reworkPercentage max is 50", "`reworkPercentage` max is 50", "rework...max...50"
    if "rework" in inst_text.lower():
        if not re.search(r'rework\w*`?\s+max\w*\s+(?:is\s+)?50', inst_text, re.IGNORECASE):
            findings.append({
                "severity": "WARN",
                "check": "gpt_rework_max_instructions",
                "file": "instructions.md",
                "message": "instructions.md does not explicitly state reworkPercentage max is 50 — "
                           "GPT may submit out-of-range values (e.g. 85) if this slider is treated "
                           "like the others that use a 0–100 scale.",
            })
    return findings


def check_gpt_promo_mention(gpt_root: Path) -> list:
    """instructions.md must describe asking for a promo code before calling request_trial."""
    findings = []
    instructions = gpt_root / "instructions.md"
    if not instructions.exists():
        return findings

    text = instructions.read_text(encoding="utf-8")
    has_promo = bool(re.search(r'promo', text, re.IGNORECASE))
    if not has_promo:
        findings.append({
            "severity": "WARN",
            "check": "gpt_promo_not_mentioned",
            "file": "instructions.md",
            "message": "instructions.md does not mention promo codes. openapi.yaml specifies that the "
                       "GPT should ask the user if they have a promo code before calling request_trial. "
                       "Users with valid promo codes will never be prompted and will miss their discount.",
        })
    return findings


def check_gpt_credit_costs(gpt_root: Path) -> list:
    """Credit costs in instructions.md must match operationType descriptions in openapi.yaml."""
    findings = []
    instructions = gpt_root / "instructions.md"
    openapi      = gpt_root / "openapi.yaml"
    if not instructions.exists() or not openapi.exists():
        return findings

    inst_text = instructions.read_text(encoding="utf-8")

    # Expected costs — these are the canonical values from the GAS engine
    expected = {
        "baseline_only": 1,
        "full_saco":     2,
        "saco_explain":  4,
    }

    for op, cost in expected.items():
        # Look for "baseline_only = 1 credit" or "baseline_only (1 credit)" patterns
        pattern = rf'{re.escape(op)}[^\n]{{0,30}}{cost}\s*credit'
        if not re.search(pattern, inst_text, re.IGNORECASE):
            findings.append({
                "severity": "WARN",
                "check": "gpt_credit_cost_mismatch",
                "file": "instructions.md",
                "message": f"Credit cost for '{op}' ({cost} credit(s)) not clearly stated in "
                           f"instructions.md — GPT may not warn users accurately about credit consumption.",
            })
    return findings


# ── Run all static checks (dispatcher) ───────────────────────────────────────

def run_all_static_checks(manifest: dict) -> list:
    root        = manifest["root"]
    target_type = manifest.get("type", "gas")
    gs          = [root / f for f in manifest.get("gs_files", [])]
    html        = [root / f for f in manifest.get("html_files", [])]
    php         = [root / f for f in manifest.get("php_files", [])]
    gpt         = [root / f for f in manifest.get("gpt_files", [])]

    findings = []
    findings += check_gs_file_exists(manifest)

    if target_type in ("gas", "js"):
        # GAS / JavaScript checks
        for h in html:
            if h.exists():
                findings += check_duplicate_ids(h)
                findings += check_script_run_callbacks(h)
                findings += check_slider_id_consistency(h)
                findings += check_cache_key_slider_completeness(h)
                findings += check_html_event_bindings(h)
        if target_type == "gas":
            findings += check_console_log_in_gs(gs)
            findings += check_missing_error_boundaries(gs)

    elif target_type == "php":
        # WordPress / PHP checks
        findings += check_php_abspath_guard(php)
        findings += check_php_output_escaping(php)
        findings += check_php_prepared_statements(php)
        findings += check_php_nonce_coverage(php)
        findings += check_php_wpdb_return_values(php)
        # Pass both lists for version bump check
        findings += check_php_version_bump(php, php)

    elif target_type == "gpt":
        # Custom GPT contract checks
        findings += check_gpt_slider_key_names(root)
        findings += check_gpt_action_coverage(root)
        findings += check_gpt_rework_domain(root)
        findings += check_gpt_promo_mention(root)
        findings += check_gpt_credit_costs(root)

    return findings


# ── Sub-agent callers ─────────────────────────────────────────────────────────

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
        pass
    except Exception as e:
        return f"[math-agent runtime error: {e}]\n{buf.getvalue()}"

    return buf.getvalue() or "[math-agent produced no output]"


def call_research_agent(label: str, question: str, rel_files: list, root: Path) -> str:
    """Run research-agent.py as subprocess with --question and file list."""
    if not RESEARCH_AGENT_SCRIPT.exists():
        return "[research-agent script not found]"

    # Files may be relative to root or relative to PROJECT_ROOT (for cross-target questions)
    rel_to_root = []
    for f in rel_files:
        # Try relative to manifest root first
        full = root / f
        if full.exists():
            rel_to_root.append(str(full.relative_to(PROJECT_ROOT)))
            continue
        # Fall back to relative to PROJECT_ROOT (for cross-system questions)
        full2 = PROJECT_ROOT / f
        if full2.exists():
            rel_to_root.append(f)
            continue

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


# ── Report synthesis ──────────────────────────────────────────────────────────

def synthesize(static_findings: list, sub_agent_outputs: dict,
               target: str, synth_context: str) -> str:
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

    prompt = f"""You are the QA Director for PMC Estimator.

## Target Context
{synth_context}

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
What's missing relative to production standards for this target type.

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


# ── Single target run ─────────────────────────────────────────────────────────

def run_target(target_key: str, args, out_dir: Path) -> Path:
    """Run all QA phases for one target. Returns path to written report."""
    manifest    = TARGETS[target_key]
    root        = manifest["root"]
    gs_files    = [root / f for f in manifest.get("gs_files", [])]
    math_files_abs = [root / f for f in manifest.get("math_files", [])]
    synth_ctx   = manifest.get("synth_context", target_key)

    ts = datetime.now().strftime("%Y-%m-%d-%H-%M")

    print(f"\n{C.BOLD}{'='*60}{C.RESET}")
    print(f"{C.BOLD}  QA Agent  —  {target_key}{C.RESET}")
    print(f"  {C.INFO}{manifest.get('description', '')}{C.RESET}")
    print(f"  Scope: {args.scope}   |   {ts.replace('-', ':', 2).replace('-', ' ', 1)}")
    print(f"{C.BOLD}{'='*60}{C.RESET}\n")

    sub_agent_outputs = {}

    # ── Phase 1: Static checks ────────────────────────────────────────────────
    print(f"{C.BOLD}[1/4] Static checks{C.RESET}  (no API)")
    static_findings = run_all_static_checks(manifest)
    fails = sum(1 for f in static_findings if f["severity"] == "FAIL")
    warns = sum(1 for f in static_findings if f["severity"] == "WARN")
    for f in static_findings:
        print(f"  {_sev(f['severity'])}  {f['file']}  —  {f['message'][:100]}")
    print(f"  → {C.FAIL}{fails} FAIL{C.RESET}  {C.WARN}{warns} WARN{C.RESET}\n")

    # ── API cost gate ─────────────────────────────────────────────────────────
    api_approved = cost_gate(args, manifest, no_confirm=args.no_confirm)

    # ── Phase 2: Math agent ───────────────────────────────────────────────────
    if api_approved and args.scope in ("full", "math") and math_files_abs:
        print(f"{C.BOLD}[2/4] Math-agent audit{C.RESET}")
        math_out = call_math_agent(math_files_abs)
        sub_agent_outputs["Math Agent Audit"] = math_out
        print(f"  → {len(math_out)} chars returned\n")
    else:
        reason = "no math files" if not math_files_abs else \
                 "scope" if args.scope not in ("full", "math") else "not approved"
        print(f"{C.INFO}[2/4] Math-agent skipped ({reason}){C.RESET}\n")
        sub_agent_outputs["Math Agent Audit"] = "(skipped)"

    # ── Phase 3: Research agent ───────────────────────────────────────────────
    if api_approved and args.scope in ("full", "research"):
        questions = manifest.get("research_questions", [])
        if questions:
            print(f"{C.BOLD}[3/4] Research-agent analysis{C.RESET}  ({len(questions)} questions)")
            for label, question, files in questions:
                print(f"  • {label} …", end="", flush=True)
                out = call_research_agent(label, question, files, root)
                sub_agent_outputs[f"Research: {label}"] = out
                print(f" {len(out)} chars")
            print()
        else:
            print(f"{C.INFO}[3/4] Research-agent skipped (no questions for this target){C.RESET}\n")
            sub_agent_outputs["Research"] = "(skipped — no questions configured)"
    else:
        reason = "scope" if args.scope not in ("full", "research") else "not approved"
        print(f"{C.INFO}[3/4] Research-agent skipped ({reason}){C.RESET}\n")
        sub_agent_outputs["Research"] = "(skipped)"

    # ── Phase 4: Synthesis ────────────────────────────────────────────────────
    if api_approved and args.scope in ("full", "math", "research", "synth"):
        print(f"{C.BOLD}[4/4] Synthesising report via Claude{C.RESET}")
        report_body = synthesize(static_findings, sub_agent_outputs, target_key, synth_ctx)
    else:
        if not api_approved:
            print(f"{C.INFO}[4/4] Synthesis skipped (API not approved){C.RESET}\n")
        lines = ["## Static Findings\n"]
        for f in static_findings:
            lines.append(f"- **{f['severity']}** `{f['file']}` — {f['message']}")
        report_body = "\n".join(lines)

    # ── Write report ──────────────────────────────────────────────────────────
    all_files = (
        manifest.get("gs_files", []) + manifest.get("html_files", []) +
        manifest.get("php_files", []) + manifest.get("gpt_files", [])
    )
    header = (
        f"# QA Report — {target_key}\n"
        f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n"
        f"**Scope**: {args.scope}  \n"
        f"**Target**: {manifest.get('description', target_key)}  \n"
        f"**Files scanned**: {len(all_files)}  \n"
        f"**Static findings**: {fails} FAIL · {warns} WARN  \n\n---\n\n"
    )
    report_path = out_dir / f"{ts}-{target_key}.md"
    report_path.write_text(header + report_body, encoding="utf-8")

    print(f"\n{C.PASS}Report written → {report_path}{C.RESET}\n")
    print("=" * 60)
    preview_lines = (header + report_body).splitlines()[:80]
    print("\n".join(preview_lines))
    if len((header + report_body).splitlines()) > 80:
        print(f"\n{C.INFO}… full report at {report_path}{C.RESET}")

    return report_path


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="QA Orchestrator for PMC Estimator")
    parser.add_argument(
        "--target",
        default=None,
        help=(
            "Which target(s) to QA. One of: "
            + ", ".join(TARGETS.keys())
            + ", all. Omit to use the interactive selector."
        ),
    )
    parser.add_argument("--scope", default="full",
                        choices=["full", "static", "math", "research", "synth"],
                        help="Which checks to run")
    parser.add_argument("--output", default=None,
                        help="Directory to write report(s) (default: agents/qa-agent/reports/)")
    parser.add_argument("--no-confirm", action="store_true",
                        help="Skip the API cost-gate prompt (for CI / automation)")
    args = parser.parse_args()

    out_dir = Path(args.output) if args.output else REPORTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    # Resolve target list
    if args.target is None:
        selected_targets = select_targets_interactive()
    elif args.target.lower() == "all":
        selected_targets = list(TARGETS.keys())
    elif args.target in TARGETS:
        selected_targets = [args.target]
    else:
        print(f"{C.FAIL}Unknown target '{args.target}'. "
              f"Choose from: {', '.join(TARGETS.keys())}, all{C.RESET}")
        sys.exit(1)

    if len(selected_targets) > 1:
        print(f"\n{C.BOLD}Running {len(selected_targets)} targets: "
              f"{', '.join(selected_targets)}{C.RESET}")

    written_reports = []
    for target_key in selected_targets:
        report_path = run_target(target_key, args, out_dir)
        written_reports.append(report_path)

    if len(written_reports) > 1:
        print(f"\n{C.BOLD}{'='*60}{C.RESET}")
        print(f"{C.BOLD}  All reports written:{C.RESET}")
        for p in written_reports:
            print(f"  {C.PASS}→{C.RESET} {p}")
        print(f"{C.BOLD}{'='*60}{C.RESET}\n")


if __name__ == "__main__":
    main()
