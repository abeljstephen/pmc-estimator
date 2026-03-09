#!/usr/bin/env python3
"""
Math QA Auditor Agent
Uses unified APIClient to audit mathematical correctness with provider flexibility.

Supports multiple LLM providers (Claude, ChatGPT, Grok) with fallback logic.
All API keys, cost tracking, and usage monitoring configured centrally.
"""

import sys
import json
import argparse
from pathlib import Path

# Add config to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from config.config_api import APIClient


# Color codes for terminal output
class Colors:
    CRITICAL = "\033[91m"  # Red
    HIGH = "\033[93m"      # Yellow
    MEDIUM = "\033[94m"    # Blue
    LOW = "\033[92m"       # Green
    RESET = "\033[0m"
    BOLD = "\033[1m"
    CYAN = "\033[96m"


def load_rules(agent_dir):
    """Load RULES.md and IMPROVEMENTS.md"""
    rules_file = agent_dir / "RULES.md"
    improvements_file = agent_dir / "IMPROVEMENTS.md"

    rules_content = rules_file.read_text() if rules_file.exists() else ""
    improvements_content = improvements_file.read_text() if improvements_file.exists() else ""

    return rules_content, improvements_content


def load_math_agent_config(agent_dir):
    """Load math-agent specific config.json"""
    config_file = agent_dir / "config.json"
    if config_file.exists():
        return json.loads(config_file.read_text())
    return {}


def read_code_files(file_paths):
    """Read multiple code files"""
    code_content = {}
    for file_path in file_paths:
        path = Path(file_path)
        if path.exists():
            try:
                code_content[str(file_path)] = path.read_text()
            except Exception as e:
                code_content[str(file_path)] = f"[ERROR reading file: {e}]"
        else:
            code_content[str(file_path)] = f"[FILE NOT FOUND: {file_path}]"
    return code_content


def build_audit_prompt(rules, improvements, code_files, config):
    """Build the prompt for the mathematician auditor"""

    code_section = "\n".join(
        [f"## File: {name}\n```\n{content[:2000]}\n```\n" for name, content in code_files.items()]
    )

    prompt = f"""You are a Nobel Prize-winning mathematician specializing in probability theory and statistics, serving as a rigorous quality assurance auditor for a probabilistic estimation system.

Your mission: Audit the provided code for MATHEMATICAL SOUNDNESS, CORRECTNESS, and ACCURACY.

## Mathematical Rules & Constraints
{rules}

## Possible Improvements & Advances
{improvements}

## Configuration
{json.dumps(config, indent=2)}

## Code to Audit
{code_section}

## Your Audit Report

Please evaluate this code across the following dimensions:

1. **Mathematical Correctness**: Are formulas correctly implemented? Do parameters satisfy constraints?

2. **Integration Integrity**: Do the mathematical components work together correctly? Are there mismatches between modules?

3. **Numerical Stability**: Are there division-by-zero risks, log(0) issues, or accumulation errors?

4. **Edge Cases**: What happens at boundaries (O=M=P, zero variance, extreme slider values)?

5. **Possible Mathematical Advances**: Could this code benefit from advances mentioned in IMPROVEMENTS.md? Are there opportunities for better algorithms, distributions, or approaches?

6. **Severity Assessment**: Flag issues as CRITICAL (wrong probabilities), HIGH (integration broken), MEDIUM (numerical concerns), or LOW (improvements).

For each issue found:
- Describe the problem with mathematical rigor
- Cite which rule/constraint is violated
- Suggest specific fixes with mathematical justification
- Reference academic literature where relevant
- Explain impact on downstream calculations

Be thorough, skeptical, and rigorous. Ask hard questions. Don't assume correctness."""

    return prompt


def prompt_provider_selection(available_providers):
    """Interactively prompt user to select provider"""
    print(Colors.CYAN + "\nAvailable LLM Providers:" + Colors.RESET)
    for i, provider in enumerate(available_providers, 1):
        print(f"  {i}) {provider}")

    while True:
        try:
            choice = input(f"\nSelect provider (1-{len(available_providers)}): ").strip()
            index = int(choice) - 1
            if 0 <= index < len(available_providers):
                return available_providers[index]
            else:
                print("Invalid choice. Please try again.")
        except ValueError:
            print("Please enter a number.")


def audit_files(file_paths, agent_dir=None, preferred_provider=None, interactive=False):
    """Main audit function with provider selection"""

    if agent_dir is None:
        agent_dir = Path(__file__).parent
    else:
        agent_dir = Path(agent_dir)

    # Determine project root
    project_root = Path(__file__).parent.parent.parent

    print(Colors.BOLD + "Math QA Auditor - Loading Configuration" + Colors.RESET)

    # Load rules and math agent config
    rules, improvements = load_rules(agent_dir)
    math_agent_config = load_math_agent_config(agent_dir)

    if not rules:
        print(Colors.CRITICAL + "ERROR: RULES.md not found in agent directory" + Colors.RESET)
        sys.exit(1)

    print(f"✓ Loaded RULES.md ({len(rules)} chars)")
    if improvements:
        print(f"✓ Loaded IMPROVEMENTS.md ({len(improvements)} chars)")
    print(f"✓ Loaded math-agent config")

    # Read code files
    print(Colors.BOLD + "\nReading Code Files" + Colors.RESET)
    code_files = read_code_files(file_paths)
    for name, content in code_files.items():
        if "[ERROR" not in content and "[FILE NOT" not in content:
            print(f"✓ {name} ({len(content)} chars)")
        else:
            print(Colors.CRITICAL + f"✗ {name}" + Colors.RESET)

    # Build prompt
    prompt = build_audit_prompt(rules, improvements, code_files, math_agent_config)

    # Initialize unified API client
    print(Colors.BOLD + "\nInitializing API Client" + Colors.RESET)

    try:
        # Let user select provider if interactive mode
        if interactive:
            from config.config_api import ProviderFactory
            import json

            config_path = project_root / "config/config-api/agency-config.json"
            with open(config_path) as f:
                config = json.load(f)

            enabled_providers = ProviderFactory.list_enabled(config)

            if not enabled_providers:
                print(Colors.CRITICAL + "ERROR: No providers enabled in config" + Colors.RESET)
                sys.exit(1)

            preferred_provider = prompt_provider_selection(enabled_providers)
            print(f"Selected provider: {preferred_provider}")

        # Create API client with optional provider override
        client = APIClient("math-agent", preferred_provider=preferred_provider)

        print(f"✓ API Client initialized")
        print(f"✓ Primary Provider: {client.agent_config.get('provider', 'default')}")

    except Exception as e:
        print(Colors.CRITICAL + f"ERROR initializing API client: {e}" + Colors.RESET)
        sys.exit(1)

    # Make API call
    print(Colors.BOLD + "\nInvoking LLM for Mathematical Audit..." + Colors.RESET)

    try:
        response = client.call(
            messages=[{"role": "user", "content": prompt}],
            system_prompt="You are a Nobel Prize-winning mathematician specializing in probability theory.",
        )

        audit_result = response.content

        # Output results
        print(
            Colors.BOLD
            + "\n"
            + "=" * 80
            + "\n"
            + "MATHEMATICAL AUDIT REPORT"
            + "\n"
            + "=" * 80
            + Colors.RESET
        )
        print(audit_result)
        print(Colors.BOLD + "=" * 80 + Colors.RESET)

        # Display usage
        print(Colors.CYAN + f"\nProvided by: {response.provider}" + Colors.RESET)
        print(f"Tokens: {response.input_tokens} in + {response.output_tokens} out")
        print(f"Cost: ${response.cost_usd:.4f}")

        return audit_result

    except ValueError as e:
        print(Colors.CRITICAL + f"ERROR: {e}" + Colors.RESET)
        sys.exit(1)
    except Exception as e:
        print(Colors.CRITICAL + f"ERROR during API call: {e}" + Colors.RESET)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Math QA Auditor - Mathematical correctness checker with multi-provider support"
    )
    parser.add_argument("files", nargs="+", help="Files to audit (relative to project root)")

    parser.add_argument(
        "--agent-dir",
        default=None,
        help="Agent directory path (defaults to script directory)",
    )

    parser.add_argument(
        "--provider",
        default=None,
        choices=["claude", "chatgpt", "grok"],
        help="Override default provider (uses config default if not specified)",
    )

    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Prompt user to select provider interactively",
    )

    args = parser.parse_args()

    # Resolve file paths relative to project root
    project_root = Path(__file__).parent.parent.parent
    resolved_files = [str(project_root / f) for f in args.files]

    audit_files(resolved_files, args.agent_dir, args.provider, args.interactive)


if __name__ == "__main__":
    main()
