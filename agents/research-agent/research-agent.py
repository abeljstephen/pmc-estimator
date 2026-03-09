#!/usr/bin/env python3
"""
Codebase Research Agent for PMC Estimator
Traces call chains, maps data flow, and explains architecture using Claude API.

Usage:
  python research-agent.py --question "How do general and conservative optimization differ?" \
    core/optimization/optimizer.gs

  python research-agent.py --question "Trace scaledSliders from creation to UI" \
    core/optimization/optimizer.gs core/main/main.gs Plot.html

  python research-agent.py --template pipeline_trace --entry-point optimizeSliders \
    core/optimization/optimizer.gs
"""

import argparse
import json
import os
import sys
from pathlib import Path

import anthropic


AGENT_DIR = Path(__file__).parent
PROJECT_ROOT = AGENT_DIR.parent.parent


def load_file(path: Path) -> str:
    """Read a source file and return its content with line numbers."""
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
        numbered = [f"{i+1:4d}: {line}" for i, line in enumerate(lines)]
        return "\n".join(numbered)
    except FileNotFoundError:
        return f"[ERROR: file not found at {path}]"
    except Exception as e:
        return f"[ERROR reading {path}: {e}]"


def load_rules() -> str:
    rules_path = AGENT_DIR / "RULES.md"
    if rules_path.exists():
        return rules_path.read_text(encoding="utf-8")
    return ""


def load_config() -> dict:
    config_path = AGENT_DIR / "config.json"
    if config_path.exists():
        return json.loads(config_path.read_text(encoding="utf-8"))
    return {}


def build_system_prompt(rules: str) -> str:
    return f"""You are an expert codebase research agent for the PMC Estimator — a Google Apps Script probability estimation tool.

Your job is to read source files (.gs JavaScript and Plot.html), trace call chains, map data flow, and produce clear, structured research reports that help developers understand the codebase.

## Output Format

Always structure your response as a markdown report with these sections:

1. **TL;DR** — Answer the question directly in 2–4 sentences before any detail.
2. **Call Chain** — Indented tree of function calls with `filename.gs:NNN` citations.
3. **Data Flow** — How key variables are created, transformed, and consumed.
4. **Key Differences** — Comparison table if the question involves comparing modes or paths.
5. **Guards & Edge Cases** — Safety conditions that silently change output (guards, reverts, clamps).
6. **Implications** — What the findings mean for debugging or correctness.

Cite file and line number for every function or variable reference. Format: `functionName (file.gs:NNN)`.

## Codebase Rules

{rules}
"""


def build_user_prompt(question: str, files: list[tuple[str, str]], template: str | None, entry_point: str | None) -> str:
    parts = []

    if template:
        config = load_config()
        templates = config.get("research_templates", {})
        if template in templates:
            parts.append(f"**Research Template**: {templates[template]}")
            if entry_point:
                parts.append(f"**Entry Point**: `{entry_point}`")
            parts.append("")

    if question:
        parts.append(f"**Research Question**: {question}")
        parts.append("")

    parts.append("## Source Files\n")
    for filename, content in files:
        parts.append(f"### {filename}\n```javascript\n{content}\n```\n")

    return "\n".join(parts)


def main():
    parser = argparse.ArgumentParser(
        description="PMC Estimator codebase research agent",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("files", nargs="+", help="Source files to read (relative to project root)")
    parser.add_argument("--question", "-q", default="", help="Research question to answer")
    parser.add_argument("--template", "-t", default=None,
                        choices=["pipeline_trace", "compare_modes", "data_flow", "bug_investigation", "architecture_overview"],
                        help="Use a named research template from config.json")
    parser.add_argument("--entry-point", default=None, help="Entry point function for pipeline_trace template")
    parser.add_argument("--model", default="claude-opus-4-6", help="Claude model to use")
    parser.add_argument("--api-key", default=None, help="Anthropic API key (or set ANTHROPIC_API_KEY env var)")
    parser.add_argument("--agent-dir", default=None, help="Path to agent directory (default: script directory)")
    args = parser.parse_args()

    # API key
    api_key = args.api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set. Use --api-key or export ANTHROPIC_API_KEY='sk-ant-...'", file=sys.stderr)
        sys.exit(1)

    if not args.question and not args.template:
        print("ERROR: Provide --question or --template.", file=sys.stderr)
        sys.exit(1)

    # Load source files
    loaded_files = []
    for rel_path in args.files:
        full_path = PROJECT_ROOT / rel_path
        content = load_file(full_path)
        loaded_files.append((rel_path, content))
        print(f"  Loaded: {rel_path} ({len(content.splitlines())} lines)", file=sys.stderr)

    rules = load_rules()
    system_prompt = build_system_prompt(rules)
    user_prompt = build_user_prompt(args.question, loaded_files, args.template, args.entry_point)

    print(f"\nResearching: {args.question or args.template}", file=sys.stderr)
    print(f"Using model: {args.model}", file=sys.stderr)
    print("-" * 60, file=sys.stderr)

    client = anthropic.Anthropic(api_key=api_key)

    message = client.messages.create(
        model=args.model,
        max_tokens=8192,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )

    print("\n" + message.content[0].text)


if __name__ == "__main__":
    main()
