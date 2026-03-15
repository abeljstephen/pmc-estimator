#!/usr/bin/env python3
"""
Patent Protection Agent — PMC Estimator
Scans code and user-facing content for disclosures that could jeopardize the
SACO provisional patent (Abel J. Stephen, iCareNOW.io, filed 2026-03-02).

Usage:
    python3 agents/patent-protect-agent/patent-agent.py
    python3 agents/patent-protect-agent/patent-agent.py --json
"""

import argparse
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REPORT_DIR   = Path(__file__).resolve().parent / "reports"
REPORT_DIR.mkdir(exist_ok=True)

# ── ANSI colours ──────────────────────────────────────────────────────────────
R  = "\033[91m";  O  = "\033[33m";  Y  = "\033[93m"
C  = "\033[96m";  G  = "\033[92m";  B  = "\033[94m"
W  = "\033[0m";   BD = "\033[1m"
SEV_COLOR  = {"CRITICAL": R, "HIGH": O, "MEDIUM": Y, "LOW": C, "INFO": C}
SEV_ORDER  = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}

# ── Directories to skip ───────────────────────────────────────────────────────
SKIP_DIRS = {
    "system-original-web-app-api",
    "system-google-cloud-functions-api",
    "archive", "node_modules", ".git", "reports", "patent",
}

# ── Helper ────────────────────────────────────────────────────────────────────
def _skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)

def _finding(severity, check_id, file_ref, message, evidence="", fix="", note=""):
    return {
        "severity": severity, "check": check_id, "file": file_ref,
        "message": message, "evidence": evidence, "fix": fix, "note": note,
    }

def _read(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return ""

def _glob_all(pattern: str, exts: set | None = None) -> list[Path]:
    paths = []
    for p in PROJECT_ROOT.rglob(pattern):
        if _skip(p):
            continue
        if exts and p.suffix.lower() not in exts:
            continue
        if p.is_file():
            paths.append(p)
    return sorted(paths)

def _rel(path: Path) -> str:
    try:
        return str(path.relative_to(PROJECT_ROOT))
    except ValueError:
        return str(path)


# ════════════════════════════════════════════════════════════════════════════
# PAT-001  Exact claimed formula literals in any file
# ════════════════════════════════════════════════════════════════════════════
# These exact constant combinations appear verbatim in Claims 2, 3, 4, 5.
# Presence in ANY file outside the patent document itself is a CRITICAL risk.
FORMULA_CHECKS = [
    (
        re.compile(r"0\.3\s*\+\s*0\.4\s*[×xX\*]\s*coupling", re.IGNORECASE),
        "Interpolation weight t = clamp(0.3 + 0.4 × coupling)",
        "Claim 2",
    ),
    (
        re.compile(r"0\.3\s*\+\s*0\.4\s*\*\s*coupl", re.IGNORECASE),
        "Interpolation weight (code form: 0.3 + 0.4 * coupl…)",
        "Claim 2",
    ),
    (
        re.compile(r"variance_factor\s*=\s*0\.8\s*-\s*0\.5", re.IGNORECASE),
        "Variance adjustment formula: variance_factor = 0.8 - 0.5 × lin",
        "Claim 3",
    ),
    (
        re.compile(r"0\.8\s*-\s*0\.5\s*[×xX\*]\s*lin", re.IGNORECASE),
        "Variance adjustment formula: 0.8 - 0.5 × lin",
        "Claim 3",
    ),
    (
        re.compile(r"exp\s*\(\s*-\s*KL\b", re.IGNORECASE),
        "KL divergence penalty expression: exp(-KL…)",
        "Claim 4",
    ),
    (
        re.compile(r"P\(τ\)\s*\^\s*\(1\s*\+\s*bb\)", re.IGNORECASE),
        "KL objective function: P(τ)^(1+bb) × exp(-KL…)",
        "Claim 4",
    ),
    (
        re.compile(r"\[\s*1\.0\s*,\s*0\.55\s*,\s*0\.4", re.IGNORECASE),
        "BASE_R correlation matrix row — first row values [1.0, 0.55, 0.4…]",
        "Claim 5",
    ),
    (
        re.compile(r"BASE_R\s*=\s*[\[\(]", re.IGNORECASE),
        "BASE_R matrix definition",
        "Claim 5",
    ),
]

def check_formula_literals() -> list:
    """PAT-001: Exact claimed formula constants in any public file."""
    findings = []
    for path in PROJECT_ROOT.rglob("*"):
        if _skip(path) or not path.is_file():
            continue
        if path.suffix.lower() not in {".gs", ".js", ".py", ".html", ".md", ".txt", ".json"}:
            continue
        text = _read(path)
        for pat, label, claim in FORMULA_CHECKS:
            for m in pat.finditer(text):
                line_no = text[:m.start()].count("\n") + 1
                findings.append(_finding(
                    "CRITICAL", "PAT-001",
                    f"{_rel(path)}:{line_no}",
                    f"Exact formula from {claim} in public file: {label}",
                    evidence=m.group(0)[:120],
                    fix=(
                        f"Remove this formula from {_rel(path)}. "
                        "Keep implementation constants unnamed or split across variables. "
                        "Document in patent/ only."
                    ),
                    note=claim,
                ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# PAT-002  Full SACO implementation in browser-executable WordPress JS
# ════════════════════════════════════════════════════════════════════════════
ENGINE_JS_PATHS = [
    PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator" / "assets" / "js" / "engine" / "copula.js",
    PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator" / "assets" / "js" / "engine" / "optimizer.js",
    PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator" / "assets" / "js" / "engine" / "saco.js",
    PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator" / "assets" / "js" / "engine" / "baseline.js",
]

# Signals that identify the file as containing the full SACO implementation
ENGINE_SIGNALS = [
    (re.compile(r"computeCouplingSignal|applyGaussianCopula|computeAdjustedMoments", re.IGNORECASE),
     "Correlation-weighted coupling signal / Gaussian copula transformation (Claim 1c, Claim 8b)"),
    (re.compile(r"computeKLDivergence|klDivergence", re.IGNORECASE),
     "KL divergence computation (Claim 4)"),
    (re.compile(r"latinHypercube|lhsSample|LHS", re.IGNORECASE),
     "Latin Hypercube Sampling (Claim 1f, Claim 8d)"),
    (re.compile(r"cobyla|COBYLA|localRefine", re.IGNORECASE),
     "COBYLA local refinement (Claim 1f, Claim 8d)"),
    (re.compile(r"betaRefit|momentMatch|betaParams", re.IGNORECASE),
     "Beta distribution refit (Claim 1e, Claim 8c)"),
    (re.compile(r"hybridMoment|computeAdjusted|disjunction", re.IGNORECASE),
     "Hybrid moment mapping (Claim 1d, Claim 8c)"),
]

def check_browser_js_exposure() -> list:
    """PAT-002: Full SACO implementation in browser-accessible JS files."""
    findings = []
    for path in ENGINE_JS_PATHS:
        if not path.exists():
            continue
        text = _read(path)
        signals_found = []
        for pat, label in ENGINE_SIGNALS:
            if pat.search(text):
                signals_found.append(label)
        if signals_found:
            findings.append(_finding(
                "HIGH", "PAT-002",
                _rel(path),
                f"Browser-executable JS contains full SACO implementation "
                f"({len(signals_found)} claimed element(s) identified). "
                "Any visitor can View Source and reconstruct the method.",
                evidence="; ".join(signals_found[:3]),
                fix=(
                    "Options (choose one): "
                    "(1) Move computation server-side (API endpoint) and remove engine JS; "
                    "(2) Add obfuscation build step before deploy; "
                    "(3) Add prominent 'Patent Pending' notice to each engine file header "
                    "and accept the exposure as a known business trade-off."
                ),
                note=f"Claimed elements found: {'; '.join(signals_found)}",
            ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# PAT-003  BASE_R correlation matrix values in deployed / public code
# ════════════════════════════════════════════════════════════════════════════
BASE_R_SIGNAL = re.compile(
    r"(?:BASE_R|baseR|base_r)\s*[=:]\s*[\[\(]|"
    r"\[\s*1\.0\s*,\s*0\.[0-9]+\s*,\s*0\.[0-9]+",
    re.IGNORECASE,
)

def check_base_r_matrix() -> list:
    """PAT-003: BASE_R correlation matrix values in any public code."""
    findings = []
    public_paths = (
        list(PROJECT_ROOT.rglob("*.js"))
        + list(PROJECT_ROOT.rglob("*.html"))
        + list(PROJECT_ROOT.rglob("*.py"))
    )
    for path in public_paths:
        if _skip(path):
            continue
        text = _read(path)
        for m in BASE_R_SIGNAL.finditer(text):
            line_no = text[:m.start()].count("\n") + 1
            findings.append(_finding(
                "HIGH", "PAT-003",
                f"{_rel(path)}:{line_no}",
                "BASE_R correlation matrix (Claim 5) values found in public-accessible code.",
                evidence=m.group(0)[:120],
                fix=(
                    "Store BASE_R server-side only (GAS copula-utils.gs). "
                    "In browser JS, fetch calibrated copula values from the server "
                    "rather than re-implementing the matrix."
                ),
                note="Claim 5: PMBOK-derived correlation matrix is a specifically claimed element.",
            ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# PAT-004  Algorithm-level detail in user-visible tooltip / help text
# ════════════════════════════════════════════════════════════════════════════
# These phrases in data-body / aria-label / title attributes describe HOW
# the method works at implementation level, not just WHAT it produces.
TOOLTIP_TECHNICAL_PATTERNS = [
    (re.compile(r"Kullback.Leibler|KL divergence", re.IGNORECASE),
     "KL divergence mechanism (Claim 4) described in user-visible tooltip"),
    (re.compile(r"Latin Hypercube|LHS\b", re.IGNORECASE),
     "Latin Hypercube Sampling (Claim 1f) described in user-visible tooltip"),
    (re.compile(r"COBYLA", re.IGNORECASE),
     "COBYLA optimizer (Claim 1f) named in user-visible tooltip"),
    (re.compile(r"Gaussian copula", re.IGNORECASE),
     "Gaussian copula (Claim 1c) described in user-visible tooltip"),
    (re.compile(r"hybrid moment|moment mapping|copula coupling", re.IGNORECASE),
     "Hybrid moment mapping (Claim 1d) described in user-visible tooltip"),
    (re.compile(r"Beta.*refit|moment.match|beta distribution refit", re.IGNORECASE),
     "Beta refit (Claim 1e) described in user-visible tooltip"),
    (re.compile(r"probabilistic disjunction", re.IGNORECASE),
     "Probabilistic disjunction (Claim 1d-ii) described in user-visible tooltip"),
]

# Only flag when inside a user-visible context (data-body, title attr, help text)
VISIBLE_CONTEXT_PAT = re.compile(
    r'(?:data-body|data-title|title|aria-label|placeholder)\s*=\s*["\']([^"\']{20,})',
    re.IGNORECASE,
)

def check_tooltip_disclosure() -> list:
    """PAT-004: Implementation-level technical detail in user-facing tooltips."""
    findings = []
    html_files = (
        list(PROJECT_ROOT.rglob("*.html"))
        + list(PROJECT_ROOT.rglob("*.gs"))
    )
    for path in html_files:
        if _skip(path):
            continue
        text = _read(path)
        for ctx_m in VISIBLE_CONTEXT_PAT.finditer(text):
            ctx_text = ctx_m.group(1)
            line_no = text[:ctx_m.start()].count("\n") + 1
            for pat, label in TOOLTIP_TECHNICAL_PATTERNS:
                if pat.search(ctx_text):
                    findings.append(_finding(
                        "HIGH", "PAT-004",
                        f"{_rel(path)}:{line_no}",
                        f"{label}",
                        evidence=ctx_text[:120],
                        fix=(
                            "Replace with functional description: what the user experiences, "
                            "not how the algorithm achieves it. Move technical citations to "
                            "Tier 4 (report export only, not live UI). "
                            "E.g. 'Keeps results realistic by preventing large swings from your baseline.' "
                            "instead of 'Kullback-Leibler divergence constraint.'"
                        ),
                        note="User-visible tooltip reveals claimed mechanism to any user of the product.",
                    ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# PAT-005  SACO / "Shape-Adaptive Copula Optimization" without patent notice
# ════════════════════════════════════════════════════════════════════════════
SACO_PAT    = re.compile(r"\bSACO\b|Shape.Adaptive Copula Optimization", re.IGNORECASE)
NOTICE_PAT  = re.compile(r"Patent Pending|patent.pending|patent pending", re.IGNORECASE)

def check_patent_notice() -> list:
    """PAT-005: SACO branding in user-visible files without 'Patent Pending' notice."""
    findings = []
    scan_paths = (
        list(PROJECT_ROOT.rglob("*.html"))
        + list(PROJECT_ROOT.rglob("*.md"))
        + list(PROJECT_ROOT.rglob("*.php"))
    )
    for path in scan_paths:
        if _skip(path):
            continue
        text = _read(path)
        if SACO_PAT.search(text) and not NOTICE_PAT.search(text):
            # Find first SACO occurrence for line reference
            m = SACO_PAT.search(text)
            line_no = text[:m.start()].count("\n") + 1
            findings.append(_finding(
                "MEDIUM", "PAT-005",
                f"{_rel(path)}:{line_no}",
                "File uses 'SACO' / 'Shape-Adaptive Copula Optimization' without any "
                "'Patent Pending' notice.",
                evidence=m.group(0),
                fix=(
                    "Add 'Patent Pending' adjacent to the SACO name or in the file header. "
                    "Minimum: add to Plot.html page footer, WordPress plugin readme.txt, "
                    "and primary README.md. "
                    "Example footer text: 'SACO™ (Patent Pending — iCareNOW.io)'"
                ),
                note="35 U.S.C. § 287: patent notice establishes constructive notice to infringers.",
            ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# PAT-006  Inline code comments disclosing novel algorithm internals
# ════════════════════════════════════════════════════════════════════════════
COMMENT_TECHNICAL_PATTERNS = [
    (re.compile(r"//.*(?:KL divergence|kullback.leibler)", re.IGNORECASE),
     "KL divergence mechanism in inline comment"),
    (re.compile(r"//.*(?:latin hypercube|LHS sample)", re.IGNORECASE),
     "Latin Hypercube Sampling in inline comment"),
    (re.compile(r"//.*(?:COBYLA|cobyla)", re.IGNORECASE),
     "COBYLA optimizer named in inline comment"),
    (re.compile(r"//.*(?:gaussian copula|copula transform)", re.IGNORECASE),
     "Gaussian copula in inline comment"),
    (re.compile(r"//.*(?:hybrid moment|copula coupling coefficient)", re.IGNORECASE),
     "Hybrid moment mapping in inline comment"),
    (re.compile(r"#.*(?:KL divergence|kullback.leibler)", re.IGNORECASE),
     "KL divergence mechanism in inline comment (Python)"),
    (re.compile(r"#.*(?:latin hypercube|LHS sample)", re.IGNORECASE),
     "Latin Hypercube Sampling in inline comment (Python)"),
    (re.compile(r"#.*(?:COBYLA|cobyla)", re.IGNORECASE),
     "COBYLA optimizer in inline comment (Python)"),
    (re.compile(r"#.*(?:gaussian copula|copula transform)", re.IGNORECASE),
     "Gaussian copula in inline comment (Python)"),
]

def check_code_comments() -> list:
    """PAT-006: Inline comments exposing novel algorithm internals in public-accessible files."""
    findings = []
    # Only flag in files that are public-accessible (deployed browser JS)
    public_js = [
        PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator" / "assets" / "js",
    ]
    for base in public_js:
        for path in base.rglob("*.js"):
            if _skip(path):
                continue
            text = _read(path)
            for pat, label in COMMENT_TECHNICAL_PATTERNS:
                for m in pat.finditer(text):
                    line_no = text[:m.start()].count("\n") + 1
                    findings.append(_finding(
                        "MEDIUM", "PAT-006",
                        f"{_rel(path)}:{line_no}",
                        f"Public browser JS contains comment disclosing claimed mechanism: {label}",
                        evidence=m.group(0)[:120],
                        fix=(
                            "Remove or genericise comments in browser-deployed JS. "
                            "E.g. change '// Gaussian copula transformation' to '// dependency adjustment'. "
                            "Detailed algorithm comments are appropriate in server-side GAS files only."
                        ),
                        note="Browser JS is readable by anyone via View Source.",
                    ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# PAT-007  README / documentation method disclosure
# ════════════════════════════════════════════════════════════════════════════
README_TECHNICAL_PATTERNS = [
    (re.compile(r"KL.divergence|Kullback.Leibler", re.IGNORECASE),
     "KL divergence described in documentation"),
    (re.compile(r"Latin Hypercube|LHS\b", re.IGNORECASE),
     "Latin Hypercube Sampling described in documentation"),
    (re.compile(r"COBYLA", re.IGNORECASE),
     "COBYLA optimizer named in documentation"),
    (re.compile(r"hybrid moment|copula coupling", re.IGNORECASE),
     "Hybrid moment mapping described in documentation"),
    (re.compile(r"Beta refit|moment.match(?:ing)?", re.IGNORECASE),
     "Beta refit / moment matching described in documentation"),
    (re.compile(r"probabilistic disjunction", re.IGNORECASE),
     "Probabilistic disjunction described in documentation"),
    (re.compile(r"variance_factor|0\.8\s*-\s*0\.5", re.IGNORECASE),
     "Variance adjustment constants in documentation"),
]

def check_readme_disclosure() -> list:
    """PAT-007: README/docs describing novel internals beyond product-level."""
    findings = []
    md_files = list(PROJECT_ROOT.rglob("*.md")) + list(PROJECT_ROOT.rglob("*.txt"))
    for path in md_files:
        if _skip(path):
            continue
        text = _read(path)
        for pat, label in README_TECHNICAL_PATTERNS:
            for m in pat.finditer(text):
                line_no = text[:m.start()].count("\n") + 1
                findings.append(_finding(
                    "LOW", "PAT-007",
                    f"{_rel(path)}:{line_no}",
                    f"{label}",
                    evidence=m.group(0)[:120],
                    fix=(
                        "Consider whether this documentation needs to name the mechanism. "
                        "User-facing docs should describe benefit ('stays anchored to your baseline'); "
                        "technical docs (in patent/ or internal) can describe mechanism. "
                        "If repo is public, all .md files are publicly readable."
                    ),
                    note="LOW unless repo is public, in which case elevate to MEDIUM.",
                ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# PAT-008  Git repository visibility
# ════════════════════════════════════════════════════════════════════════════
def check_repo_visibility() -> list:
    """PAT-008: Detect if git remote is public (GitHub) and flag accordingly."""
    findings = []
    try:
        result = subprocess.run(
            ["git", "-C", str(PROJECT_ROOT), "remote", "-v"],
            capture_output=True, text=True, timeout=10,
        )
        remotes = result.stdout.strip()
    except Exception:
        remotes = ""

    if not remotes:
        findings.append(_finding(
            "INFO", "PAT-008",
            ".git/config",
            "No git remote configured — repository appears to be local-only.",
            fix="No action needed. If you push to a public remote in future, re-run this check.",
        ))
        return findings

    github_pat = re.compile(r"github\.com[:/]([^/\s]+)/([^\s]+)", re.IGNORECASE)
    for line in remotes.splitlines():
        m = github_pat.search(line)
        if m:
            owner, repo = m.group(1), m.group(2).rstrip(".git")
            findings.append(_finding(
                "INFO", "PAT-008",
                ".git/config",
                f"Repository remote points to GitHub: {owner}/{repo}. "
                "If the repo is PUBLIC, all source code, comments, and README files "
                "are accessible to anyone worldwide — including competitors.",
                evidence=line.strip()[:120],
                fix=(
                    "Verify repo visibility at https://github.com/{}/{}/settings. "
                    "If public: (1) ensure Patent Pending notices are in place; "
                    "(2) remove or obfuscate claimed formula constants from browser JS; "
                    "(3) consider whether the WordPress plugin engine JS should be served "
                    "from a private API rather than bundled as open source."
                ).format(owner, repo),
                note="A public repo does not invalidate a patent, but gives competitors full implementation access.",
            ))
    return findings


# ════════════════════════════════════════════════════════════════════════════
# Runner
# ════════════════════════════════════════════════════════════════════════════
def run_all_checks() -> list:
    all_findings = []
    checks = [
        ("PAT-001  Formula literals",          check_formula_literals),
        ("PAT-002  Browser JS exposure",        check_browser_js_exposure),
        ("PAT-003  BASE_R matrix in public JS", check_base_r_matrix),
        ("PAT-004  Tooltip technical detail",   check_tooltip_disclosure),
        ("PAT-005  Patent notice missing",      check_patent_notice),
        ("PAT-006  Code comment disclosure",    check_code_comments),
        ("PAT-007  README disclosure",          check_readme_disclosure),
        ("PAT-008  Repo visibility",            check_repo_visibility),
    ]
    for label, fn in checks:
        print(f"  {B}→{W} {label} …", end=" ", flush=True)
        result = fn()
        all_findings.extend(result)
        c = sum(1 for f in result if f["severity"] == "CRITICAL")
        h = sum(1 for f in result if f["severity"] == "HIGH")
        m = sum(1 for f in result if f["severity"] == "MEDIUM")
        parts = []
        if c: parts.append(f"{R}{c} CRITICAL{W}")
        if h: parts.append(f"{O}{h} HIGH{W}")
        if m: parts.append(f"{Y}{m} MEDIUM{W}")
        if not parts:
            low_info = len(result)
            parts.append(f"{G}{'PASS' if low_info == 0 else str(low_info) + ' LOW/INFO'}{W}")
        print("  ".join(parts))
    return all_findings


def _sev_counts(findings):
    d = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0, "INFO": 0}
    for f in findings:
        d[f["severity"]] = d.get(f["severity"], 0) + 1
    return d


def print_report(findings: list) -> None:
    by_sev = sorted(findings, key=lambda f: SEV_ORDER.get(f["severity"], 9))
    counts = _sev_counts(findings)

    print(f"\n{BD}━━━ PATENT PROTECTION REPORT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{W}")
    print(f"  SACO Provisional Patent — iCareNOW.io — {datetime.now().strftime('%Y-%m-%d')}\n")

    for f in by_sev:
        col = SEV_COLOR.get(f["severity"], W)
        print(f"  {col}{f['severity']:<8}{W} [{f['check']}]  {f['file']}")
        print(f"  {BD}→{W} {f['message']}")
        if f.get("evidence"):
            print(f"  {C}Evidence :{W} {f['evidence'][:110]}")
        if f.get("note"):
            print(f"  {B}Patent   :{W} {f['note']}")
        if f.get("fix"):
            print(f"  {G}Fix      :{W} {f['fix'][:200]}")
        print()

    total = sum(counts.values())
    print(f"  → {R}{counts['CRITICAL']} CRITICAL{W}  "
          f"{O}{counts['HIGH']} HIGH{W}  "
          f"{Y}{counts['MEDIUM']} MEDIUM{W}  "
          f"{C}{counts['LOW']+counts['INFO']} LOW/INFO{W}  "
          f"({total} total findings)\n")

    # Risk summary
    if counts["CRITICAL"] > 0:
        print(f"  {R}{BD}CRITICAL risks must be resolved before any public release or{W}")
        print(f"  {R}{BD}commercial deployment. Exact claimed formula constants are present{W}")
        print(f"  {R}{BD}in public-accessible files.{W}\n")
    if counts["HIGH"] > 0:
        print(f"  {O}HIGH risks should be addressed before next product update.{W}")
        print(f"  {O}Browser JS exposure is the highest-priority architectural decision.{W}\n")
    if counts["MEDIUM"] > 0:
        print(f"  {Y}Add 'Patent Pending' notices to all SACO-branded surfaces.{W}\n")


def save_report(findings: list) -> Path:
    stamp = datetime.now().strftime("%Y-%m-%d-%H-%M")
    md_path = REPORT_DIR / f"{stamp}-patent.md"
    counts = _sev_counts(findings)
    by_sev = sorted(findings, key=lambda f: SEV_ORDER.get(f["severity"], 9))

    lines = [
        f"# Patent Protection Report — {stamp}",
        f"**Patent:** SACO Provisional Application · iCareNOW.io · Filed 2026-03-02",
        f"**Run date:** {datetime.now().strftime('%Y-%m-%d %H:%M')}",
        "",
        f"**Summary:** {counts['CRITICAL']} CRITICAL · {counts['HIGH']} HIGH · "
        f"{counts['MEDIUM']} MEDIUM · {counts['LOW']+counts['INFO']} LOW/INFO",
        "",
    ]
    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"):
        group = [f for f in by_sev if f["severity"] == sev]
        if not group:
            continue
        lines.append(f"## {sev} ({len(group)})\n")
        for f in group:
            lines.append(f"### [{f['check']}] {f['file']}")
            lines.append(f"**{f['message']}**\n")
            if f.get("evidence"):
                lines.append(f"- **Evidence:** `{f['evidence'][:110]}`")
            if f.get("note"):
                lines.append(f"- **Patent:** {f['note']}")
            if f.get("fix"):
                lines.append(f"- **Fix:** {f['fix'][:300]}")
            lines.append("")
    md_path.write_text("\n".join(lines), encoding="utf-8")
    return md_path


# ════════════════════════════════════════════════════════════════════════════
# Entry point
# ════════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="Patent Protection Agent — PMC Estimator")
    parser.add_argument("--json",       action="store_true", help="Output JSON instead of terminal report")
    parser.add_argument("--min-sev",    default="INFO",
                        choices=["CRITICAL","HIGH","MEDIUM","LOW","INFO"],
                        help="Minimum severity to include in output")
    args = parser.parse_args()

    print(f"\n{BD}PMC Estimator — Patent Protection Agent{W}")
    print(f"Patent: SACO Provisional · iCareNOW.io · Filed 2026-03-02")
    print(f"Project root: {PROJECT_ROOT}\n")
    print("Running checks …\n")

    findings = run_all_checks()

    min_ord = SEV_ORDER.get(args.min_sev, 4)
    findings = [f for f in findings if SEV_ORDER.get(f["severity"], 4) <= min_ord]

    if args.json:
        print(json.dumps(findings, indent=2))
        return

    print_report(findings)
    report_path = save_report(findings)
    print(f"  {C}→ full report at {report_path}{W}\n")


if __name__ == "__main__":
    main()
