#!/usr/bin/env python3
"""
PMC Estimator — Anthropic API Usage Monitor
============================================
Reads the local api-usage.json log (written by APIClient / UsageTracker)
and prints a comprehensive cost report.

Usage:
  python3 agents/api-monitor-agent/check-usage.py
  python3 agents/api-monitor-agent/check-usage.py --days 7
  python3 agents/api-monitor-agent/check-usage.py --json

The ANTHROPIC_API_KEY is read from:
  1. Environment variable ANTHROPIC_API_KEY
  2. agents/api-monitor-agent/.env file
"""

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

AGENT_DIR    = Path(__file__).parent
PROJECT_ROOT = AGENT_DIR.parent.parent
USAGE_LOG    = PROJECT_ROOT / "system-google-sheets-addon" / "config" / "logs" / "api-usage.json"
TRACKER_FILE = AGENT_DIR / "api-tracker.md"
ENV_FILE     = AGENT_DIR / ".env"

# Pricing — claude-opus-4-6
PRICE_IN_PER_MTOK  = 15.00
PRICE_OUT_PER_MTOK = 75.00

# Monthly soft-limit warning threshold (USD)
MONTHLY_WARN_USD = 50.00

# ── Colour helpers ─────────────────────────────────────────────────────────────

class C:
    FAIL  = "\033[91m"
    WARN  = "\033[93m"
    PASS  = "\033[92m"
    INFO  = "\033[96m"
    BOLD  = "\033[1m"
    RESET = "\033[0m"


# ── Env / key loading ──────────────────────────────────────────────────────────

def load_api_key() -> str | None:
    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            line = line.strip()
            if line.startswith("ANTHROPIC_API_KEY="):
                return line.split("=", 1)[1].strip()
    return None


# ── Log reading ────────────────────────────────────────────────────────────────

def load_log() -> list:
    """Return list of request records from api-usage.json. Empty list if missing."""
    if not USAGE_LOG.exists():
        return []
    try:
        data = json.loads(USAGE_LOG.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
        # Aggregated dict — can't break down by request
        return []
    except Exception:
        return []


def cost_of(record: dict) -> float:
    if "cost_usd" in record:
        return record["cost_usd"]
    tok_in  = record.get("input_tokens", 0)
    tok_out = record.get("output_tokens", 0)
    return (tok_in / 1_000_000) * PRICE_IN_PER_MTOK + \
           (tok_out / 1_000_000) * PRICE_OUT_PER_MTOK


def parse_date(record: dict) -> datetime | None:
    for field in ("timestamp", "date", "created_at", "time"):
        val = record.get(field)
        if val:
            for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
                try:
                    return datetime.strptime(str(val)[:19], fmt)
                except ValueError:
                    continue
    return None


# ── Report generation ──────────────────────────────────────────────────────────

def build_report(records: list, days: int | None = None) -> dict:
    now = datetime.now()
    cutoff = now - timedelta(days=days) if days else None

    filtered = records
    if cutoff:
        dated = [r for r in records if parse_date(r) and parse_date(r) >= cutoff]
        filtered = dated if dated else records  # fall back to all if no timestamps

    total_cost    = sum(cost_of(r) for r in filtered)
    total_in      = sum(r.get("input_tokens", 0) for r in filtered)
    total_out     = sum(r.get("output_tokens", 0) for r in filtered)
    total_req     = len(filtered)

    # Per-agent breakdown
    by_agent = defaultdict(lambda: {"requests": 0, "input_tokens": 0, "output_tokens": 0, "cost": 0.0})
    for r in filtered:
        agent = r.get("agent", r.get("agent_name", r.get("source", "unknown")))
        by_agent[agent]["requests"]      += 1
        by_agent[agent]["input_tokens"]  += r.get("input_tokens", 0)
        by_agent[agent]["output_tokens"] += r.get("output_tokens", 0)
        by_agent[agent]["cost"]          += cost_of(r)

    # Per-day breakdown
    by_day = defaultdict(lambda: {"requests": 0, "cost": 0.0})
    for r in filtered:
        d = parse_date(r)
        day_key = d.strftime("%Y-%m-%d") if d else "unknown"
        by_day[day_key]["requests"] += 1
        by_day[day_key]["cost"]     += cost_of(r)

    # Monthly projection (based on daily average over available days)
    if by_day and "unknown" not in list(by_day.keys())[:1]:
        dates = sorted(by_day.keys())
        if len(dates) >= 2:
            span_days = (datetime.strptime(dates[-1], "%Y-%m-%d") -
                         datetime.strptime(dates[0], "%Y-%m-%d")).days + 1
            daily_avg = total_cost / span_days
            monthly_proj = daily_avg * 30
        else:
            monthly_proj = total_cost * 30
    else:
        monthly_proj = 0.0

    return {
        "total_cost":    total_cost,
        "total_in":      total_in,
        "total_out":     total_out,
        "total_req":     total_req,
        "by_agent":      dict(by_agent),
        "by_day":        dict(sorted(by_day.items())),
        "monthly_proj":  monthly_proj,
        "days_filter":   days,
        "record_count":  len(records),
        "filtered_count":len(filtered),
    }


def print_report(report: dict, api_key: str | None):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n{C.BOLD}{'═'*62}{C.RESET}")
    print(f"{C.BOLD}  PMC Estimator — Anthropic API Usage Report{C.RESET}")
    print(f"  {ts}")
    print(f"{'═'*62}")

    # Key status
    if api_key:
        masked = api_key[:14] + "..." + api_key[-6:]
        print(f"\n  API Key : {C.PASS}{masked}{C.RESET}  (loaded)")
    else:
        print(f"\n  API Key : {C.WARN}not found{C.RESET}  — set ANTHROPIC_API_KEY or add to .env")

    # Log source
    if USAGE_LOG.exists():
        print(f"  Log file: {USAGE_LOG.relative_to(PROJECT_ROOT)}")
        print(f"  Records : {report['record_count']} total", end="")
        if report["days_filter"]:
            print(f"  ({report['filtered_count']} in last {report['days_filter']} days)", end="")
        print()
    else:
        print(f"\n  {C.WARN}Log file not found: {USAGE_LOG}{C.RESET}")
        print(f"  API costs will be logged here once an agent makes its first call.")
        print(f"{'═'*62}\n")
        return

    if report["total_req"] == 0:
        print(f"\n  {C.INFO}No API requests recorded yet.{C.RESET}")
        print(f"  Costs accumulate here when math-agent, research-agent, or qa-agent runs.")
        print(f"{'═'*62}\n")
        return

    # ── Totals ────────────────────────────────────────────────────────────────
    print(f"\n{C.BOLD}  Summary{C.RESET}  (model: claude-opus-4-6 · $15/$75 per MTok)")
    print(f"  {'─'*58}")
    print(f"  Total requests  : {report['total_req']:,}")
    print(f"  Input tokens    : {report['total_in']:,}")
    print(f"  Output tokens   : {report['total_out']:,}")
    cost_colour = C.FAIL if report["total_cost"] > 10 else C.WARN if report["total_cost"] > 2 else C.PASS
    print(f"  Total cost      : {cost_colour}{C.BOLD}${report['total_cost']:.4f}{C.RESET}")

    if report["monthly_proj"] > 0:
        proj_colour = C.FAIL if report["monthly_proj"] > MONTHLY_WARN_USD else C.WARN
        print(f"  Monthly proj.   : {proj_colour}${report['monthly_proj']:.2f}{C.RESET}"
              f"  (warn threshold: ${MONTHLY_WARN_USD:.0f})")

    # ── Per-agent ─────────────────────────────────────────────────────────────
    if report["by_agent"]:
        print(f"\n{C.BOLD}  By Agent{C.RESET}")
        print(f"  {'─'*58}")
        print(f"  {'Agent':<22} {'Requests':>8} {'In tok':>10} {'Out tok':>10} {'Cost':>10}")
        print(f"  {'─'*22} {'─'*8} {'─'*10} {'─'*10} {'─'*10}")
        for agent, d in sorted(report["by_agent"].items(), key=lambda x: -x[1]["cost"]):
            print(f"  {agent:<22} {d['requests']:>8,} {d['input_tokens']:>10,} "
                  f"{d['output_tokens']:>10,}  {C.WARN}${d['cost']:.4f}{C.RESET}")

    # ── Per-day ───────────────────────────────────────────────────────────────
    by_day = report["by_day"]
    if by_day and list(by_day.keys()) != ["unknown"]:
        days_to_show = sorted(by_day.keys())[-14:]  # last 14 days
        print(f"\n{C.BOLD}  Daily Activity  (last {len(days_to_show)} days){C.RESET}")
        print(f"  {'─'*58}")
        print(f"  {'Date':<12} {'Requests':>8} {'Cost':>10}")
        print(f"  {'─'*12} {'─'*8} {'─'*10}")
        for day in days_to_show:
            d = by_day[day]
            print(f"  {day:<12} {d['requests']:>8,}  ${d['cost']:.4f}")

    # ── Warnings ──────────────────────────────────────────────────────────────
    if report["total_cost"] > MONTHLY_WARN_USD:
        print(f"\n  {C.FAIL}WARNING:{C.RESET} Total spend ${report['total_cost']:.2f} exceeds "
              f"monthly threshold ${MONTHLY_WARN_USD:.0f}.")

    print(f"\n  For detailed billing: https://platform.claude.com/usage#rate-limit-usage")
    print(f"{'═'*62}\n")


def update_tracker(report: dict):
    """Write summary to api-tracker.md."""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")

    by_agent_rows = ""
    for agent, d in sorted(report["by_agent"].items(), key=lambda x: -x[1]["cost"]):
        by_agent_rows += f"| {agent} | {d['requests']} | {d['input_tokens']:,} | {d['output_tokens']:,} | ${d['cost']:.4f} |\n"

    content = f"""# PMC Estimator — API Usage Tracker

> Last checked: {ts}

## Cost Summary

| Metric | Value |
|--------|-------|
| Total requests | {report['total_req']:,} |
| Input tokens | {report['total_in']:,} |
| Output tokens | {report['total_out']:,} |
| **Total cost** | **${report['total_cost']:.4f}** |
| Monthly projection | ${report['monthly_proj']:.2f} |
| Warning threshold | ${MONTHLY_WARN_USD:.0f} |

## By Agent

| Agent | Requests | In tokens | Out tokens | Cost |
|-------|----------|-----------|------------|------|
{by_agent_rows.rstrip()}

## Notes
- Model: claude-opus-4-6
- Pricing: $15.00/MTok input · $75.00/MTok output
- Log: `system-google-sheets-addon/config/logs/api-usage.json`
- Console: https://platform.claude.com/usage#rate-limit-usage

## History (last 10 checks)
<!-- Updated automatically by check-usage.py -->
- {ts} — Requests: {report['total_req']}  Cost: ${report['total_cost']:.4f}  Proj/month: ${report['monthly_proj']:.2f}
"""
    # Preserve existing history lines
    existing = TRACKER_FILE.read_text(encoding="utf-8") if TRACKER_FILE.exists() else ""
    history_lines = [l for l in existing.splitlines() if l.startswith("- 20") and "Requests:" in l]
    history_lines = history_lines[-9:]  # keep last 9, new one is already in content

    if history_lines:
        content = content.rstrip() + "\n" + "\n".join(history_lines) + "\n"

    TRACKER_FILE.write_text(content, encoding="utf-8")


# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="PMC Estimator API Usage Monitor")
    parser.add_argument("--days", type=int, default=None,
                        help="Show only the last N days (default: all time)")
    parser.add_argument("--json", action="store_true",
                        help="Output report as JSON instead of human-readable")
    args = parser.parse_args()

    api_key = load_api_key()
    records = load_log()
    report  = build_report(records, days=args.days)

    if args.json:
        print(json.dumps(report, indent=2, default=str))
        return

    print_report(report, api_key)

    if records:
        update_tracker(report)
        print(f"  Tracker updated: {TRACKER_FILE.relative_to(PROJECT_ROOT)}\n")


if __name__ == "__main__":
    main()
