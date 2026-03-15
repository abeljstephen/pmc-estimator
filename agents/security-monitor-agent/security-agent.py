#!/usr/bin/env python3
"""
PMC Estimator — Security Monitor Agent
=======================================
Runs all tasks defined in SECURITY_PLAN.md and produces a prioritised
security report. Delegates deep reviews to research-agent.

Usage:
  python3 agents/security-monitor-agent/security-agent.py
  python3 agents/security-monitor-agent/security-agent.py --scope static
  python3 agents/security-monitor-agent/security-agent.py --scope full
  python3 agents/security-monitor-agent/security-agent.py --no-confirm

Scopes:
  static    Pattern-based checks only — no API, runs in seconds (default)
  research  static + research-agent deep reviews
  full      static + research + Claude synthesis report
"""

import argparse
import json
import os
import re
import subprocess
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

AGENT_DIR    = Path(__file__).parent
PROJECT_ROOT = AGENT_DIR.parent.parent
REPORTS_DIR  = AGENT_DIR / "reports"
RESEARCH_AGENT_SCRIPT = PROJECT_ROOT / "agents" / "research-agent" / "research-agent.py"

# ── Pricing (claude-opus-4-6) ─────────────────────────────────────────────────
_PRICE_IN_PER_MTOK  = 15.00
_PRICE_OUT_PER_MTOK = 75.00
_CALL_OVERHEAD      = 2_500

# ── Colours ───────────────────────────────────────────────────────────────────

class C:
    CRIT  = "\033[91m"
    HIGH  = "\033[91m"
    WARN  = "\033[93m"
    PASS  = "\033[92m"
    INFO  = "\033[96m"
    BOLD  = "\033[1m"
    RESET = "\033[0m"

_SEV_COLOUR = {
    "CRITICAL": C.CRIT, "HIGH": C.HIGH, "MEDIUM": C.WARN,
    "LOW": C.INFO, "INFO": C.INFO, "PASS": C.PASS,
}

def _sev(s: str) -> str:
    col = _SEV_COLOUR.get(s, "")
    return col + s + C.RESET

# ── Secret patterns ───────────────────────────────────────────────────────────

# (label, compiled_regex, false_positive_filter)
def _generic_secret_fp(full_match: str) -> bool:
    """Return True if a generic_secret match looks like a placeholder / not a real credential."""
    # Extract the value inside quotes (last quoted segment)
    val_m = re.search(r'["\']([^"\']{8,})["\']$', full_match)
    val = val_m.group(1) if val_m else full_match
    val_lower = val.lower()
    # Placeholder patterns
    if any(p in val_lower for p in (
        "...", "your_", "change_me", "xxxx", "<", ">", "example",
        "placeholder", "insert", "replace", "env_var", "here",
        "sk-ant-api03-", "sk-ant-", "grok-", "os.environ",
    )):
        return True
    # Values that are clearly not credentials (variable references, short words)
    if val_lower in ("true", "false", "null", "none", "undefined"):
        return True
    return False


SECRET_PATTERNS = [
    ("anthropic_key",  re.compile(r'sk-ant-api[0-9A-Za-z\-]{20,}'),
     lambda m: "..." in m),                                # masked → skip
    ("openai_key",     re.compile(r'sk-[A-Za-z0-9]{48}'),
     lambda m: False),
    ("google_api_key", re.compile(r'AIza[0-9A-Za-z\-_]{35}'),
     lambda m: False),
    ("aws_access_key", re.compile(r'AKIA[0-9A-Z]{16}'),
     lambda m: False),
    ("generic_secret", re.compile(
        r'(?:password|passwd|secret|api[_\-]?key|auth[_\-]?token)\s*[=:]\s*["\']([^"\']{8,})["\']',
        re.IGNORECASE),
     _generic_secret_fp),
]

# File extensions to scan for secrets (.md files skipped for generic_secret — too many doc examples)
SECRET_SCAN_EXTS = {".gs", ".js", ".py", ".php", ".html", ".json", ".env"}
# .md/.txt/.sh scanned for specific key patterns only (not generic_secret)
SECRET_SCAN_EXTS_SPECIFIC = {".md", ".txt", ".sh"}

# Paths to skip entirely (archives, inactive systems, build artefacts)
SECRET_SKIP_DIRS = {
    "archive", "node_modules", ".git", "__pycache__", "reports",
    "system-original-web-app-api",       # inactive legacy
    "system-google-cloud-functions-api",  # archived
}
# Separate skip set for XSS/DOM checks (inactive code not worth flagging)
XSS_SKIP_DIRS = SECRET_SKIP_DIRS

# ── Utility ───────────────────────────────────────────────────────────────────

def _finding(severity, check, file_ref, message, evidence="", fix="", owasp=""):
    return {
        "severity": severity, "check": check, "file": file_ref,
        "message": message, "evidence": evidence[:200], "fix": fix, "owasp": owasp,
    }

def _git_tracked_files() -> list[Path]:
    try:
        out = subprocess.run(
            ["git", "ls-files"],
            capture_output=True, text=True, cwd=PROJECT_ROOT,
        )
        return [PROJECT_ROOT / p for p in out.stdout.splitlines() if p.strip()]
    except Exception:
        return list(PROJECT_ROOT.rglob("*"))


def _file_tokens(path: Path) -> int:
    try:
        return max(1, len(path.read_text(encoding="utf-8")) // 4)
    except Exception:
        return 0


def _usd(tokens_in: int, tokens_out: int) -> float:
    return (tokens_in / 1_000_000) * _PRICE_IN_PER_MTOK + \
           (tokens_out / 1_000_000) * _PRICE_OUT_PER_MTOK

# ── Phase 1 — Secrets & Credentials ──────────────────────────────────────────

def check_env_files_tracked() -> list:
    """SEC-001: .env files with credentials tracked in git."""
    findings = []
    tracked = _git_tracked_files()
    for path in tracked:
        name = path.name.lower()
        if name == ".env" or (name.startswith(".env.") and name != ".env.example"):
            text = ""
            try:
                text = path.read_text(encoding="utf-8", errors="replace")
            except Exception:
                pass
            # Check if it contains anything that looks like a real credential
            has_cred = any(
                pat.search(text) and not is_fp(pat.search(text).group(0))
                for _, pat, is_fp in SECRET_PATTERNS
            )
            if has_cred:
                findings.append(_finding(
                    "CRITICAL", "SEC-001",
                    str(path.relative_to(PROJECT_ROOT)),
                    ".env file with live credential is tracked in git.",
                    evidence=path.name,
                    fix="Run: git rm --cached <file>  then verify .gitignore covers it.",
                    owasp="A02 Cryptographic Failures",
                ))
            else:
                findings.append(_finding(
                    "WARN", "SEC-001",
                    str(path.relative_to(PROJECT_ROOT)),
                    ".env file is tracked in git (no credential pattern detected, but risky).",
                    fix="Remove from tracking unless intentional: git rm --cached <file>",
                    owasp="A02 Cryptographic Failures",
                ))
    return findings


def check_hardcoded_secrets() -> list:
    """SEC-002: Hardcoded API keys in tracked source files."""
    findings = []
    tracked = _git_tracked_files()
    for path in tracked:
        ext = path.suffix.lower()
        if ext not in SECRET_SCAN_EXTS and ext not in SECRET_SCAN_EXTS_SPECIFIC:
            continue
        if any(skip in path.parts for skip in SECRET_SKIP_DIRS):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        for label, pattern, is_fp in SECRET_PATTERNS:
            # Skip generic_secret for doc-only file types (too many false positives)
            if label == "generic_secret" and ext in SECRET_SCAN_EXTS_SPECIFIC:
                continue
            for m in pattern.finditer(text):
                matched = m.group(0)
                if is_fp(matched):
                    continue
                line_no = text[:m.start()].count("\n") + 1
                findings.append(_finding(
                    "CRITICAL", "SEC-002",
                    f"{path.relative_to(PROJECT_ROOT)}:{line_no}",
                    f"Hardcoded credential pattern '{label}' found.",
                    evidence=matched[:80] + ("..." if len(matched) > 80 else ""),
                    fix="Remove from file, rotate the credential, update .gitignore.",
                    owasp="A02 Cryptographic Failures",
                ))
    return findings


def check_private_key_files() -> list:
    """SEC-003: Private key / service account files in git."""
    findings = []
    dangerous_patterns = [
        "*.pem", "*.key", "*.p12", "*.pfx",
        "service-account*.json", "service_account*.json",
        "credentials*.json", "client_secret*.json",
    ]
    tracked = _git_tracked_files()
    dangerous_names = {
        ".pem", ".key", ".p12", ".pfx",
    }
    sensitive_stems = (
        "service-account", "service_account", "credentials",
        "client_secret", "private_key",
    )
    for path in tracked:
        rel = str(path.relative_to(PROJECT_ROOT))
        stem = path.stem.lower()
        ext  = path.suffix.lower()
        if ext in dangerous_names:
            findings.append(_finding(
                "CRITICAL", "SEC-003", rel,
                f"Private key file ({ext}) tracked in git.",
                fix="git rm --cached <file>, add to .gitignore, rotate key.",
                owasp="A02 Cryptographic Failures",
            ))
        elif ext == ".json" and any(stem.startswith(s) for s in sensitive_stems):
            findings.append(_finding(
                "HIGH", "SEC-003", rel,
                "Potential service account / credential JSON tracked in git.",
                fix="Confirm this file contains no private keys; if it does, remove and rotate.",
                owasp="A02 Cryptographic Failures",
            ))
    return findings


def check_git_history_secrets() -> list:
    """SEC-004: Secrets in recent git history (last 20 commits)."""
    findings = []
    try:
        diff_out = subprocess.run(
            ["git", "log", "-20", "-p", "--all", "--no-merges"],
            capture_output=True, text=True, cwd=PROJECT_ROOT, timeout=30,
        )
        diff_text = diff_out.stdout
    except Exception as e:
        return [_finding("INFO", "SEC-004", "git-history",
                         f"Could not scan git history: {e}")]

    for label, pattern, is_fp in SECRET_PATTERNS:
        for m in pattern.finditer(diff_text):
            matched = m.group(0)
            if is_fp(matched):
                continue
            # Only flag additions (lines starting with +)
            line_start = diff_text.rfind("\n", 0, m.start()) + 1
            line = diff_text[line_start:m.end() + 20]
            if not line.startswith("+"):
                continue
            findings.append(_finding(
                "HIGH", "SEC-004", "git-history",
                f"Secret pattern '{label}' found in git history (added line). "
                f"Key may still be valid even if removed from current HEAD.",
                evidence=matched[:60] + "...",
                fix="Rotate the credential immediately. Consider git-filter-repo to purge history.",
                owasp="A02 Cryptographic Failures",
            ))

    return findings

# ── Phase 2 — Injection & Execution ──────────────────────────────────────────

def check_eval_usage() -> list:
    """SEC-010: eval() / new Function() / exec() on dynamic input."""
    findings = []
    # JS-only patterns — exec() in JS is a regex method (.exec()), not code execution
    JS_PATTERNS = [
        (re.compile(r'\beval\s*\('),         "eval()"),
        (re.compile(r'new\s+Function\s*\('), "new Function()"),
        # document.write() handled by SEC-020
    ]
    # Python/GAS patterns
    PY_PATTERNS = [
        (re.compile(r'\beval\s*\('),         "eval()"),
        # exec() in Python is dangerous; but exclude spec.loader.exec_module (safe importlib use)
        (re.compile(r'(?<!\.)\bexec\s*\((?!_module)'), "exec()"),
        (re.compile(r'\bcompile\s*\('),      "compile()"),
    ]
    exts = {".js", ".html", ".py", ".gs"}
    tracked = _git_tracked_files()
    for path in tracked:
        ext = path.suffix.lower()
        if ext not in exts:
            continue
        if any(skip in path.parts for skip in SECRET_SKIP_DIRS):
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        patterns = JS_PATTERNS if ext in {".js", ".html"} else PY_PATTERNS
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("#"):
                continue
            for pattern, name in patterns:
                if pattern.search(stripped):
                    findings.append(_finding(
                        "HIGH", "SEC-010",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        f"Dynamic code execution: {name} detected.",
                        evidence=stripped[:120],
                        fix="Replace with safe alternatives. If unavoidable, validate input against strict allowlist.",
                        owasp="A03 Injection",
                    ))
    return findings


def check_subprocess_shell() -> list:
    """SEC-011: subprocess with shell=True or os.system usage."""
    findings = []
    shell_pat  = re.compile(r'shell\s*=\s*True')
    os_sys_pat = re.compile(r'\bos\.system\s*\(|\bos\.popen\s*\(')
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".py":
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if shell_pat.search(stripped):
                findings.append(_finding(
                    "HIGH", "SEC-011",
                    f"{path.relative_to(PROJECT_ROOT)}:{i}",
                    "subprocess call with shell=True — command injection risk.",
                    evidence=stripped[:120],
                    fix="Pass command as a list and remove shell=True.",
                    owasp="A03 Injection",
                ))
            if os_sys_pat.search(stripped):
                findings.append(_finding(
                    "HIGH", "SEC-011",
                    f"{path.relative_to(PROJECT_ROOT)}:{i}",
                    "os.system() / os.popen() — command injection risk.",
                    evidence=stripped[:120],
                    fix="Replace with subprocess.run(cmd_list, shell=False).",
                    owasp="A03 Injection",
                ))
    return findings


def check_path_traversal() -> list:
    """SEC-012: File path construction with potentially unsanitised variables."""
    findings = []
    # Heuristic: open() or Path() with f-string / concatenation using variables
    # that contain words suggesting external input
    risky_pat = re.compile(
        r'(?:open|Path)\s*\(\s*(?:f["\']|["\'][^"\']*["\'\s]*\+)',
        re.IGNORECASE,
    )
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".py":
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            if risky_pat.search(stripped):
                findings.append(_finding(
                    "MEDIUM", "SEC-012",
                    f"{path.relative_to(PROJECT_ROOT)}:{i}",
                    "File path constructed with variable — potential path traversal if input is external.",
                    evidence=stripped[:120],
                    fix="Use Path.resolve() and verify path is within an allowed base directory.",
                    owasp="A03 Injection",
                ))
    return findings


def check_urlfetchapp() -> list:
    """SEC-013: UrlFetchApp with dynamic URLs in GAS."""
    findings = []
    pat = re.compile(r'UrlFetchApp\s*\.\s*fetch\s*\(')
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".gs":
            continue
        if any(skip in path.parts for skip in SECRET_SKIP_DIRS):
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if pat.search(stripped):
                # Check if arg is a simple string literal (safe) or a variable (risky)
                arg_match = re.search(r'fetch\s*\(\s*([^\),]+)', stripped)
                arg = arg_match.group(1).strip() if arg_match else ""
                is_literal = (arg.startswith('"') or arg.startswith("'") or
                              arg.startswith("`") and "+" not in arg and "${" not in arg)
                sev = "INFO" if is_literal else "HIGH"
                findings.append(_finding(
                    sev, "SEC-013",
                    f"{path.relative_to(PROJECT_ROOT)}:{i}",
                    "UrlFetchApp.fetch() — " + ("URL appears static (OK)." if is_literal
                        else "URL constructed from variable — SSRF risk."),
                    evidence=stripped[:120],
                    fix="Validate URL against a whitelist before passing to UrlFetchApp.",
                    owasp="A10 SSRF",
                ))
    return findings


def check_unsafe_deserialization() -> list:
    """SEC-014: pickle.loads / unsafe yaml.load."""
    findings = []
    patterns = [
        (re.compile(r'\bpickle\s*\.\s*loads?\s*\('), "pickle.load(s)"),
        (re.compile(r'\byaml\s*\.\s*load\s*\((?!.*SafeLoader)'), "yaml.load() without SafeLoader"),
        (re.compile(r'\bmarshal\s*\.\s*loads?\s*\('), "marshal.load(s)"),
    ]
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".py":
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue
            for pat, name in patterns:
                if pat.search(stripped):
                    findings.append(_finding(
                        "HIGH", "SEC-014",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        f"Unsafe deserialization: {name} — RCE if input is attacker-controlled.",
                        evidence=stripped[:120],
                        fix="Replace pickle with json; use yaml.safe_load() instead of yaml.load().",
                        owasp="A08 Software Integrity Failures",
                    ))
    return findings

# ── Phase 3 — XSS & DOM Injection ────────────────────────────────────────────

def check_innerhtml() -> list:
    """SEC-020: innerHTML / document.write without escaping."""
    findings = []
    # Match innerHTML = <something that isn't a simple static string>
    # Heuristic: if RHS contains a variable name (word chars) but not escHtml/textContent
    inner_pat    = re.compile(r'\.innerHTML\s*[+]?=\s*(.+)')
    docwrite_pat = re.compile(r'document\.write\s*\(')
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() not in {".js", ".html"}:
            continue
        if any(skip in path.parts for skip in XSS_SKIP_DIRS):
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            m = inner_pat.search(stripped)
            if m:
                rhs = m.group(1)
                # Safe if: pure empty string, or escHtml wraps the whole value,
                # or only static string literals (no variables)
                has_variable = bool(re.search(r'\b[a-zA-Z_$][a-zA-Z0-9_$]*\b', rhs))
                uses_escape  = ("escHtml" in rhs or "textContent" in rhs or
                                "DOMPurify" in rhs or "innerText" in rhs or
                                ".toFixed(" in rhs or ".toString()" in rhs)
                is_clear     = rhs.strip() in ('""', "''", "'';", '"";', "'' ;")
                # If escHtml appears anywhere nearby in the line (multi-arg template)
                if "escHtml" in stripped:
                    uses_escape = True
                if has_variable and not uses_escape and not is_clear:
                    findings.append(_finding(
                        "HIGH", "SEC-020",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        "innerHTML assignment with variable — potential XSS if value contains user input.",
                        evidence=stripped[:120],
                        fix="Wrap dynamic values with escHtml() before assigning to innerHTML.",
                        owasp="A03 Injection",
                    ))
            if docwrite_pat.search(stripped):
                findings.append(_finding(
                    "HIGH", "SEC-020",
                    f"{path.relative_to(PROJECT_ROOT)}:{i}",
                    "document.write() — XSS risk and deprecated API.",
                    evidence=stripped[:120],
                    fix="Replace with DOM manipulation (createElement, textContent).",
                    owasp="A03 Injection",
                ))
    return findings


def check_open_redirect() -> list:
    """SEC-021: window.location redirect with potentially unvalidated input."""
    findings = []
    loc_pat = re.compile(
        r'(?:window\.location|location\.href|location\.replace)\s*[=\(]\s*(.+)'
    )
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() not in {".js", ".html"}:
            continue
        if any(skip in path.parts for skip in XSS_SKIP_DIRS):
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            m = loc_pat.search(stripped)
            if m:
                rhs = m.group(1)
                has_variable = bool(re.search(r'\b[a-zA-Z_$][a-zA-Z0-9_$]*\b', rhs))
                if has_variable:
                    findings.append(_finding(
                        "MEDIUM", "SEC-021",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        "window.location redirect with variable value — open redirect if input is external.",
                        evidence=stripped[:120],
                        fix="Validate redirect target against a whitelist of allowed URLs/paths.",
                        owasp="A01 Broken Access Control",
                    ))
    return findings


def check_sensitive_logging() -> list:
    """SEC-022: Logger.log / console.log printing credential-like field names."""
    findings = []
    sensitive_words = re.compile(
        r'(?:apiKey|api_key|password|passwd|secret|token|credential|auth)',
        re.IGNORECASE,
    )
    log_pat = re.compile(r'(?:Logger\.log|console\.log)\s*\((.+)')
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() not in {".gs", ".js"}:
            continue
        if any(skip in path.parts for skip in SECRET_SKIP_DIRS):
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            m = log_pat.search(stripped)
            if m and sensitive_words.search(m.group(1)):
                findings.append(_finding(
                    "MEDIUM", "SEC-022",
                    f"{path.relative_to(PROJECT_ROOT)}:{i}",
                    "Logger/console.log appears to log a sensitive field name.",
                    evidence=stripped[:120],
                    fix="Remove or redact sensitive fields before logging.",
                    owasp="A09 Logging / Monitoring Failures",
                ))
    return findings


def check_csp_missing() -> list:
    """SEC-023: Content Security Policy meta tag in standalone HTML pages."""
    findings = []
    html_targets = [
        PROJECT_ROOT / "system-google-sheets-addon" / "Plot.html",
        PROJECT_ROOT / "wordpress-plugin" / "pmc-estimator" / "templates" / "estimator.html",
    ]
    csp_pat = re.compile(r'Content-Security-Policy', re.IGNORECASE)
    doctype_pat = re.compile(r'^\s*<!DOCTYPE', re.IGNORECASE)
    for path in html_targets:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        # Skip template fragments (no DOCTYPE) — CSP must be set at HTTP header level instead
        if not doctype_pat.search(text[:200]):
            continue
        if not csp_pat.search(text):
            findings.append(_finding(
                "LOW", "SEC-023",
                str(path.relative_to(PROJECT_ROOT)),
                "No Content-Security-Policy meta tag found.",
                fix="Add <meta http-equiv=\"Content-Security-Policy\" content=\"...\"> to <head>.",
                owasp="A05 Security Misconfiguration",
            ))
    return findings

# ── Phase 4 — WordPress / PHP Security ───────────────────────────────────────

def check_php_abspath() -> list:
    """SEC-030: ABSPATH guard in every PHP file."""
    findings = []
    abspath_pat = re.compile(r'defined\s*\(\s*[\'"]ABSPATH[\'"]')
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".php":
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue
        if not abspath_pat.search(text):
            findings.append(_finding(
                "HIGH", "SEC-030",
                str(path.relative_to(PROJECT_ROOT)),
                "PHP file lacks ABSPATH guard — can be executed directly.",
                fix="Add: if ( ! defined( 'ABSPATH' ) ) exit; at the top of the file.",
                owasp="A05 Security Misconfiguration",
            ))
    return findings


def check_php_unescaped_output() -> list:
    """SEC-031: Unescaped dynamic output in PHP."""
    findings = []
    output_pat   = re.compile(r'(?:echo|print)\s+(.+)')
    escape_funcs = re.compile(r'esc_html|esc_attr|esc_url|wp_kses|htmlspecialchars|htmlentities')
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".php":
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("#") or stripped.startswith("*"):
                continue
            m = output_pat.search(stripped)
            if m:
                output_val = m.group(1)
                has_variable = "$" in output_val
                is_escaped   = bool(escape_funcs.search(output_val))
                if has_variable and not is_escaped:
                    findings.append(_finding(
                        "HIGH", "SEC-031",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        "PHP echo/print with variable not wrapped in escape function.",
                        evidence=stripped[:120],
                        fix="Wrap with esc_html(), esc_attr(), or esc_url() as appropriate.",
                        owasp="A03 Injection",
                    ))
    return findings


def check_php_nonce_and_input() -> list:
    """SEC-032/033: Missing nonce verification and unsanitised $_POST/$_GET."""
    findings = []
    input_pat  = re.compile(r'\$_(POST|GET|REQUEST)\s*\[')
    nonce_pat  = re.compile(r'wp_verify_nonce|check_admin_referer|check_ajax_referer')
    sanitize_pat = re.compile(
        r'sanitize_text_field|intval|absint|esc_|wp_kses|filter_input|filter_var'
    )
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".php":
            continue
        try:
            text  = path.read_text(encoding="utf-8", errors="replace")
            lines = text.splitlines()
        except Exception:
            continue

        has_input = bool(input_pat.search(text))
        has_nonce = bool(nonce_pat.search(text))
        if has_input and not has_nonce:
            findings.append(_finding(
                "HIGH", "SEC-032",
                str(path.relative_to(PROJECT_ROOT)),
                "PHP file reads $_POST/$_GET but no nonce verification found.",
                fix="Add wp_verify_nonce() or check_admin_referer() before processing input.",
                owasp="A01 Broken Access Control",
            ))

        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("#"):
                continue
            m = input_pat.search(stripped)
            if m:
                is_sanitised = bool(sanitize_pat.search(stripped))
                # Also look 1-2 lines ahead
                context = " ".join(lines[i:min(i+2, len(lines))])
                is_sanitised = is_sanitised or bool(sanitize_pat.search(context))
                if not is_sanitised:
                    findings.append(_finding(
                        "HIGH", "SEC-033",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        f"Unsanitised $_{m.group(1)} access.",
                        evidence=stripped[:120],
                        fix="Wrap with sanitize_text_field(), intval(), or esc_*() before use.",
                        owasp="A03 Injection",
                    ))
    return findings

# ── Phase 5 — GAS / OAuth Scope Analysis ─────────────────────────────────────

def check_oauth_scopes() -> list:
    """SEC-040: OAuth scopes wider than necessary."""
    findings = []
    manifest = PROJECT_ROOT / "system-google-sheets-addon" / "appsscript.json"
    if not manifest.exists():
        return findings

    try:
        data   = json.loads(manifest.read_text(encoding="utf-8"))
        scopes = data.get("oauthScopes", [])
    except Exception:
        return findings

    allowed = {
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/script.container.ui",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "https://www.googleapis.com/auth/script.scriptapp",
        "https://www.googleapis.com/auth/script.send_mail",
    }
    high_risk = {
        "https://www.googleapis.com/auth/drive",
        "https://www.googleapis.com/auth/drive.file",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/admin",
        "https://www.googleapis.com/auth/cloud-platform",
    }

    for scope in scopes:
        if scope in high_risk:
            findings.append(_finding(
                "HIGH", "SEC-040",
                "system-google-sheets-addon/appsscript.json",
                f"High-risk OAuth scope: {scope}",
                evidence=scope,
                fix="Remove scope if not required. Document reason if it is required.",
                owasp="A01 Broken Access Control",
            ))
        elif scope not in allowed:
            findings.append(_finding(
                "MEDIUM", "SEC-040",
                "system-google-sheets-addon/appsscript.json",
                f"Undocumented OAuth scope (review needed): {scope}",
                evidence=scope,
                fix="Confirm this scope is necessary and document why.",
                owasp="A01 Broken Access Control",
            ))
        else:
            findings.append(_finding(
                "PASS", "SEC-040",
                "system-google-sheets-addon/appsscript.json",
                f"OAuth scope is appropriate: {scope}",
                evidence=scope,
            ))
    return findings


def check_gas_script_properties() -> list:
    """SEC-041: GAS script properties set with hardcoded credential-like values."""
    findings = []
    set_prop_pat = re.compile(
        r'setProperty\s*\(\s*["\'][^"\']+["\']\s*,\s*["\']([^"\']{8,})["\']'
    )
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".gs":
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            for m in set_prop_pat.finditer(stripped):
                val = m.group(1)
                # Flag if value looks like a real credential (not a placeholder)
                looks_like_cred = (
                    len(val) > 20 and
                    not any(p in val.lower() for p in ("your_", "change_me", "xxx", "..."))
                )
                if looks_like_cred:
                    findings.append(_finding(
                        "MEDIUM", "SEC-041",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        "PropertiesService.setProperty() with hardcoded non-placeholder value.",
                        evidence=stripped[:120],
                        fix="Move credential to a deployment-time configuration step, not code.",
                        owasp="A07 Auth / Identity Failures",
                    ))
    return findings


def check_htmlservice_escaping() -> list:
    """SEC-042: HtmlService.createHtmlOutput with unescaped GAS variables."""
    findings = []
    pat = re.compile(r'HtmlService\s*\.\s*create(?:HtmlOutput|Template)\s*\(')
    tracked = _git_tracked_files()
    for path in tracked:
        if path.suffix.lower() != ".gs":
            continue
        if any(skip in path.parts for skip in SECRET_SKIP_DIRS):
            continue
        try:
            lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if pat.search(stripped):
                # Check surrounding context (~3 lines) for htmlEscape usage
                block = "\n".join(lines[max(0, i-1):i+3])
                has_escape = "htmlEscape" in block or "<?=" in block
                if not has_escape:
                    findings.append(_finding(
                        "MEDIUM", "SEC-042",
                        f"{path.relative_to(PROJECT_ROOT)}:{i}",
                        "HtmlService output created — verify GAS variables are escaped with "
                        "HtmlService.htmlEscape() or use <?= auto-escape syntax.",
                        evidence=stripped[:120],
                        fix="Use <?= scriptlet ?> in templates (auto-escapes) or htmlEscape() explicitly.",
                        owasp="A03 Injection",
                    ))
    return findings

# ── Run all static checks ─────────────────────────────────────────────────────

def run_all_static_checks() -> list:
    findings = []
    checks = [
        check_env_files_tracked,
        check_hardcoded_secrets,
        check_private_key_files,
        check_git_history_secrets,
        check_eval_usage,
        check_subprocess_shell,
        check_path_traversal,
        check_urlfetchapp,
        check_unsafe_deserialization,
        check_innerhtml,
        check_open_redirect,
        check_sensitive_logging,
        check_csp_missing,
        check_php_abspath,
        check_php_unescaped_output,
        check_php_nonce_and_input,
        check_oauth_scopes,
        check_gas_script_properties,
        check_htmlservice_escaping,
    ]
    for check_fn in checks:
        results = check_fn()
        findings.extend(results)
    return findings

# ── Research agent ────────────────────────────────────────────────────────────

_RESEARCH_QUESTIONS = [
    (
        "sec_python_agents",
        "Security review of PMC Estimator Python agents. For each of these files: "
        "(1) Identify any command injection risks in subprocess argument construction — "
        "are all arguments list-typed with no shell=True? "
        "(2) Are there any file path operations that could be manipulated to read outside "
        "the project directory? "
        "(3) Does any code accidentally log or return the ANTHROPIC_API_KEY value? "
        "(4) Is the api-usage.json log path constructed safely? "
        "Report each finding with file, line, severity (CRITICAL/HIGH/MEDIUM/LOW), and fix.",
        [
            "agents/qa-agent/qa-agent.py",
            "agents/research-agent/research-agent.py",
            "agents/api-monitor-agent/check-usage.py",
            "system-google-sheets-addon/config/config-api/credentials.py",
            "system-google-sheets-addon/config/config-api/api_client.py",
        ],
    ),
    (
        "sec_gas_data_leakage",
        "Security review of the GAS server-to-client data path in PMC Estimator. "
        "Trace the flow: pmcEstimatorAPI() → adaptResponse() → what Plot.html renders. "
        "(1) Does adaptResponse() include any server-side-only data (session info, user email, "
        "PropertiesService values, internal file paths) in the payload returned to the client? "
        "(2) Does Plot.html store any server-returned data in localStorage/sessionStorage/cookies? "
        "(3) Are there any fields in the API response that could be exploited if an attacker "
        "controls the input task object? Report severity and exact code locations.",
        [
            "system-google-sheets-addon/core/main/main.gs",
            "system-google-sheets-addon/core/variable_map/adapter.gs",
        ],
    ),
    (
        "sec_wordpress_xss",
        "Security review of the WordPress plugin JavaScript for XSS and data exposure. "
        "(1) List every innerHTML assignment in app.js and engine/*.js. For each, confirm "
        "whether the value is escaped with escHtml() or is a static literal. Flag any that "
        "assign unescaped dynamic content. "
        "(2) Does any code store user-supplied data in localStorage/sessionStorage? "
        "(3) Are there any fetch() or XMLHttpRequest calls? If so, are the URLs hardcoded "
        "or constructed from user input? "
        "(4) Is there any use of eval() or new Function()? "
        "Provide exact file and line references.",
        [
            "wordpress-plugin/pmc-estimator/assets/js/app.js",
            "wordpress-plugin/pmc-estimator/assets/js/engine/saco.js",
            "wordpress-plugin/pmc-estimator/assets/js/engine/baseline.js",
        ],
    ),
]


def call_research_agent(label: str, question: str, rel_files: list) -> str:
    if not RESEARCH_AGENT_SCRIPT.exists():
        return "[research-agent script not found]"

    abs_files = []
    for f in rel_files:
        p = PROJECT_ROOT / f
        if p.exists():
            abs_files.append(str(p.relative_to(PROJECT_ROOT)))

    if not abs_files:
        return "[no files found for research question]"

    cmd = [sys.executable, str(RESEARCH_AGENT_SCRIPT), "--question", question] + abs_files
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=240, cwd=str(PROJECT_ROOT),
        )
        output = result.stdout.strip() or result.stderr.strip()
        return output or "[research-agent returned empty output]"
    except subprocess.TimeoutExpired:
        return "[research-agent timed out after 240s]"
    except Exception as e:
        return f"[research-agent error: {e}]"

# ── Synthesis ─────────────────────────────────────────────────────────────────

def synthesize(static_findings: list, research_outputs: dict) -> str:
    api_key = _load_api_key()
    if not api_key:
        return "[synthesis skipped — ANTHROPIC_API_KEY not set]"

    try:
        import anthropic
    except ImportError:
        return "[synthesis skipped — anthropic package not installed]"

    rules_text = (AGENT_DIR / "RULES.md").read_text(encoding="utf-8") \
        if (AGENT_DIR / "RULES.md").exists() else ""

    research_sections = "\n\n".join(
        f"### {label}\n{output[:6000]}"
        for label, output in research_outputs.items()
    )

    # Summarise static findings (avoid huge JSON)
    crit = [f for f in static_findings if f["severity"] == "CRITICAL"]
    high = [f for f in static_findings if f["severity"] == "HIGH"]
    med  = [f for f in static_findings if f["severity"] == "MEDIUM"]
    low  = [f for f in static_findings if f["severity"] in ("LOW", "INFO")]

    static_summary = json.dumps({
        "CRITICAL": crit, "HIGH": high[:20],
        "MEDIUM_count": len(med), "LOW_count": len(low),
    }, indent=2)

    prompt = f"""You are the Security Lead for PMC Estimator — a Google Apps Script probability-based
project estimation tool. You have results from automated static security checks and deep
research-agent reviews. Synthesise them into a single, actionable security report.

## Security Rules & Standards
{rules_text}

## Static Analysis Results
{static_summary}

## Research Agent Deep Reviews
{research_sections}

---

## Your Security Report

Produce a structured markdown report with these exact sections:

### Executive Summary
- Overall security posture score 0–100 with brief justification
- Counts: CRITICAL / HIGH / MEDIUM / LOW findings
- Top 3 immediate actions required

### Critical Issues  (must fix before any public deployment)
**[FILE:LINE]** — short title
- **OWASP**: A0X — Category
- **Root cause**: …
- **Impact**: …
- **Exact fix**: specific code or config change

### High Priority Issues
Same format.

### Medium / Low Issues
Concise bullet list grouped by OWASP category.

### Architecture & Design Observations
Security patterns or structural risks not captured as individual bugs.

### Recommended Remediation Plan
Prioritised numbered list. Include effort estimate (small/medium/large) and
which OWASP category each item addresses.

Rules:
- Reference file and line number for every finding
- Distinguish confirmed vulnerabilities from theoretical risks
- Do not repeat the same finding under multiple headings
- Be direct — no filler"""

    client = anthropic.Anthropic(api_key=api_key)
    msg = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=6000,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text

# ── Cost gate ─────────────────────────────────────────────────────────────────

def _load_api_key() -> str | None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    env_file = AGENT_DIR.parent / "api-monitor-agent" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip()
    return None


def cost_gate(scope: str, no_confirm: bool) -> bool:
    if scope == "static":
        return True

    phases = []
    if scope in ("research", "full"):
        for label, _, rel_files in _RESEARCH_QUESTIONS:
            tok_in = sum(
                _file_tokens(PROJECT_ROOT / f)
                for f in rel_files if (PROJECT_ROOT / f).exists()
            ) + _CALL_OVERHEAD
            tok_out = 3_000
            heavy = any(_file_tokens(PROJECT_ROOT / f) > 50_000
                        for f in rel_files if (PROJECT_ROOT / f).exists())
            phases.append({
                "label": f"Research: {label}", "tokens_in": tok_in,
                "tokens_out": tok_out, "cost": _usd(tok_in, tok_out), "heavy": heavy,
            })
    if scope in ("full", "synth"):
        tok_in  = 8_000 + len(phases) * 6_000 + _CALL_OVERHEAD
        tok_out = 6_000
        phases.append({
            "label": "Synthesis (Claude)", "tokens_in": tok_in,
            "tokens_out": tok_out, "cost": _usd(tok_in, tok_out), "heavy": False,
        })

    total = sum(p["cost"] for p in phases)
    total_in  = sum(p["tokens_in"] for p in phases)
    total_out = sum(p["tokens_out"] for p in phases)

    print(f"\n{C.BOLD}{'─'*60}{C.RESET}")
    print(f"{C.BOLD}  Security Agent — API Cost Gate{C.RESET}")
    print(f"{'─'*60}")
    print(f"\n{C.BOLD}Estimated cost for this run  (claude-opus-4-6, $15/$75 per MTok):{C.RESET}")
    print(f"  {'Phase':<38} {'In tokens':>10} {'Out tokens':>10} {'Est. cost':>10}")
    print(f"  {'─'*38} {'─'*10} {'─'*10} {'─'*10}")
    for p in phases:
        heavy_tag = f"  {C.WARN}[HEAVY]{C.RESET}" if p["heavy"] else ""
        print(f"  {p['label']:<38} {p['tokens_in']:>10,} {p['tokens_out']:>10,}"
              f"  {C.WARN}${p['cost']:.3f}{C.RESET}{heavy_tag}")
    print(f"  {'─'*38} {'─'*10} {'─'*10} {'─'*10}")
    print(f"  {'ESTIMATED TOTAL':<38} {total_in:>10,} {total_out:>10,}"
          f"  {C.CRIT}${total:.3f}{C.RESET}")

    if no_confirm:
        print(f"\n{C.INFO}  --no-confirm — proceeding automatically{C.RESET}")
        print(f"{'─'*60}\n")
        return True

    print(f"\n{'─'*60}")
    try:
        ans = input(f"  Proceed with API calls? [{C.BOLD}y{C.RESET}/N]: ").strip().lower()
    except (EOFError, KeyboardInterrupt):
        ans = ""
    print(f"{'─'*60}\n")

    if ans in ("y", "yes"):
        return True
    print(f"{C.WARN}  API phases skipped.{C.RESET}\n")
    return False

# ── Reporting ─────────────────────────────────────────────────────────────────

def _severity_rank(s):
    return {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4, "PASS": 5}.get(s, 6)


def format_static_report(findings: list) -> str:
    lines = ["## Static Security Findings\n"]
    by_sev = defaultdict(list)
    for f in findings:
        by_sev[f["severity"]].append(f)

    for sev in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"):
        items = by_sev.get(sev, [])
        if not items:
            continue
        lines.append(f"### {sev} ({len(items)})\n")
        for f in items:
            owasp = f"  ·  OWASP: {f['owasp']}" if f.get("owasp") else ""
            lines.append(f"- `{f['file']}` [{f['check']}]{owasp}")
            lines.append(f"  — {f['message']}")
            if f.get("fix"):
                lines.append(f"  **Fix:** {f['fix']}")
            lines.append("")
    return "\n".join(lines)

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PMC Estimator Security Monitor Agent")
    parser.add_argument("--scope", default="static",
                        choices=["static", "research", "full"],
                        help="static=pattern checks only | research=+deep reviews | full=+synthesis")
    parser.add_argument("--output", default=None,
                        help="Directory for report output")
    parser.add_argument("--no-confirm", action="store_true",
                        help="Skip API cost-gate prompt (CI/automation)")
    args = parser.parse_args()

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_dir = Path(args.output) if args.output else REPORTS_DIR
    out_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y-%m-%d-%H-%M")
    print(f"\n{C.BOLD}{'='*60}{C.RESET}")
    print(f"{C.BOLD}  Security Monitor Agent  —  PMC Estimator{C.RESET}")
    print(f"  Scope: {args.scope}   |   {ts}")
    print(f"{C.BOLD}{'='*60}{C.RESET}\n")

    # ── Phase 1–5: Static checks ─────────────────────────────────────────────
    print(f"{C.BOLD}[1/3] Static security checks{C.RESET}  (no API)")
    findings = run_all_static_checks()
    crits = sum(1 for f in findings if f["severity"] == "CRITICAL")
    highs = sum(1 for f in findings if f["severity"] == "HIGH")
    meds  = sum(1 for f in findings if f["severity"] == "MEDIUM")
    lows  = sum(1 for f in findings if f["severity"] in ("LOW", "INFO"))

    for f in sorted(findings, key=lambda x: _severity_rank(x["severity"])):
        if f["severity"] == "PASS":
            continue
        col = _SEV_COLOUR.get(f["severity"], "")
        print(f"  {col}{f['severity']:<9}{C.RESET} [{f['check']}]  {f['file']}  —  {f['message'][:80]}")

    print(f"\n  → {C.CRIT}{crits} CRITICAL{C.RESET}  "
          f"{C.HIGH}{highs} HIGH{C.RESET}  "
          f"{C.WARN}{meds} MEDIUM{C.RESET}  "
          f"{C.INFO}{lows} LOW/INFO{C.RESET}\n")

    # ── API cost gate ────────────────────────────────────────────────────────
    api_approved = cost_gate(args.scope, no_confirm=args.no_confirm)

    # ── Phase 2: Research agent ──────────────────────────────────────────────
    research_outputs = {}
    if api_approved and args.scope in ("research", "full"):
        print(f"{C.BOLD}[2/3] Research-agent deep reviews{C.RESET}  "
              f"({len(_RESEARCH_QUESTIONS)} questions)")
        for label, question, rel_files in _RESEARCH_QUESTIONS:
            print(f"  • {label} …", end="", flush=True)
            out = call_research_agent(label, question, rel_files)
            research_outputs[label] = out
            print(f" {len(out)} chars")
        print()
    else:
        reason = "not approved" if api_approved is False else f"scope={args.scope}"
        print(f"{C.INFO}[2/3] Research skipped ({reason}){C.RESET}\n")

    # ── Phase 3: Synthesis ───────────────────────────────────────────────────
    if api_approved and args.scope == "full":
        print(f"{C.BOLD}[3/3] Synthesising report via Claude{C.RESET}")
        report_body = synthesize(findings, research_outputs)
    else:
        if args.scope in ("research",) and api_approved:
            # Format static + research without Claude synthesis
            report_body = format_static_report(findings)
            if research_outputs:
                report_body += "\n\n## Research Agent Reviews\n\n"
                for label, out in research_outputs.items():
                    report_body += f"### {label}\n\n{out}\n\n"
        else:
            report_body = format_static_report(findings)

    # ── Write report ─────────────────────────────────────────────────────────
    header = (
        f"# Security Report — PMC Estimator\n"
        f"**Generated**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n"
        f"**Scope**: {args.scope}  \n"
        f"**Static findings**: {crits} CRITICAL · {highs} HIGH · {meds} MEDIUM · {lows} LOW/INFO  \n\n---\n\n"
    )
    report_path = out_dir / f"{ts}-security.md"
    report_path.write_text(header + report_body, encoding="utf-8")

    print(f"\n{C.PASS}Report written → {report_path}{C.RESET}")
    print("=" * 60)
    preview = (header + report_body).splitlines()[:60]
    print("\n".join(preview))
    if len((header + report_body).splitlines()) > 60:
        print(f"\n{C.INFO}… full report at {report_path}{C.RESET}")


if __name__ == "__main__":
    main()
