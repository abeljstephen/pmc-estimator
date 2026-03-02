# Config System Documentation

## Overview

The `config/config-api/` folder contains the unified API client infrastructure that all agents use.

**Key principle**: One API configuration for all agents, supports multiple LLM providers with fallback logic.

## Structure

```
config/
├── config-api/
│   ├── agency-config.json           # Central configuration (API keys, providers, costs)
│   ├── api_client.py                # Unified client all agents import
│   ├── base_provider.py             # Abstract provider interface
│   ├── credentials.py               # Secure credential management
│   ├── usage_tracker.py             # Cost & usage tracking
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── provider_factory.py     # Routes to correct provider
│   │   ├── claude_provider.py      # ✓ Implemented & ready
│   │   ├── chatgpt_provider.py     # 📋 Scaffolded (waiting for API key)
│   │   └── grok_provider.py        # 📋 Scaffolded (waiting for API key)
│   └── __init__.py
├── .env.example                     # Template for credentials (never commit .env)
└── logs/                            # Usage and cost logs (git-ignored)
```

## How It Works

### 1. Agency Configuration (`agency-config.json`)

Central configuration for all agents:

```json
{
  "api": {
    "primary_provider": "claude",    // Default provider for all agents
    "interactive_mode": false,        // Allow --interactive flag
    "retry_backoff_base": 2           // Exponential backoff for retries
  },
  "providers": {
    "claude": {
      "enabled": true,                // Enable/disable providers
      "api_key_env_var": "ANTHROPIC_API_KEY",
      "billing": {
        "input_per_mtok": 0.003,       // Pricing control
        "output_per_mtok": 0.015
      }
    }
    // ... chatgpt, grok also defined here
  },
  "agents": {
    "math-agent": {
      "provider": "claude",            // Per-agent provider selection
      "fallback_providers": [],        // Try these if primary fails
      "rate_limit": {
        "requests_per_day": 100        // Per-agent quotas
      }
    }
    // ... future agents
  },
  "usage_control": {
    "hard_limit_dollars": 100,        // Stop if monthly cost exceeds this
    "warn_threshold_dollars": 50      // Warn when approaching limit
  }
}
```

### 2. Unified API Client

**All agents use the same client:**

```python
from config.config_api import APIClient

# Create client (picks up config centrally)
client = APIClient("math-agent")

# Make call (provider is transparent)
response = client.call(
    messages=[{"role": "user", "content": "..."}],
    system_prompt="You are a mathematician"
)

# Response includes provider info
print(f"Cost: ${response.cost_usd}")
print(f"Provider: {response.provider}")
```

### 3. Provider System

**Supports multiple providers with identical interface:**

- **Claude** - ✓ Fully implemented (you have the API key)
- **ChatGPT** - 📋 Scaffolded, ready when you have API key
- **Grok** - 📋 Scaffolded, ready when xAI releases API

Each provider:
- Inherits from `BaseProvider` abstract class
- Implements: `call()`, `calculate_cost()`, `validate_api_key()`
- Returns standardized `APIResponse` object

**Adding a new provider takes 5 minutes:**
1. Create `your_provider.py` inheriting from `BaseProvider`
2. Implement 3 methods
3. Add to `ProviderFactory.PROVIDERS`
4. Update `agency-config.json` with credentials

### 4. Credential Management

**API keys stored securely in environment variables (never in code):**

```bash
# Set once
export ANTHROPIC_API_KEY="sk-ant-..."

# When you get other keys
export OPENAI_API_KEY="sk-..."
export GROK_API_KEY="grok-..."
```

**Credentials manager retrieves them as needed:**

```python
credentials = CredentialsManager(config)
api_key = credentials.get("claude")  # Looks up ANTHROPIC_API_KEY from env
```

### 5. Usage Tracking

All API calls logged automatically:

```
config/logs/api-usage.json
[
  {
    "timestamp": "2026-02-15T20:45:30...",
    "agent": "math-agent",
    "provider": "claude",
    "tokens_in": 1024,
    "tokens_out": 2048,
    "total_tokens": 3072,
    "cost_usd": 0.0456,
    "status": "success"
  },
  ...
]
```

Get a summary:

```python
client = APIClient("math-agent")
client.print_summary()  # Shows costs by provider and agent
```

## Usage Examples

### Basic Usage (Uses Config Default)

```bash
# Uses Claude (default from agency-config.json)
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs
```

### Override Provider (Option C - Hybrid)

```bash
# Use ChatGPT instead (once you have the key)
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs --provider=chatgpt

# Ask user to choose
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs --interactive
```

### Check Status

```bash
python -c "
from config.config_api import CredentialsManager
import json
with open('config/config-api/agency-config.json') as f:
    config = json.load(f)
creds = CredentialsManager(config)
creds.print_status()
"
```

## Customization

### Adjust Costs Limits

Edit `agency-config.json`:

```json
{
  "usage_control": {
    "hard_limit_dollars": 200,      // Change from 100 to 200
    "warn_threshold_dollars": 100   // Warn at $100 instead of $50
  }
}
```

### Per-Agent Quotas

```json
{
  "agents": {
    "math-agent": {
      "rate_limit": {
        "requests_per_day": 50      // Only 50 audits per day
      }
    }
  }
}
```

### Change Default Provider

```json
{
  "api": {
    "primary_provider": "chatgpt"   // Use ChatGPT by default (when you have key)
  }
}
```

### Add Fallback Provider

```json
{
  "agents": {
    "math-agent": {
      "provider": "claude",
      "fallback_providers": ["chatgpt"]  // If Claude fails, try ChatGPT
    }
  }
}
```

## Adding a New Agent

Once you create a second agent:

1. **Register it in `agency-config.json`:**

```json
{
  "agents": {
    "refactor-agent": {
      "enabled": true,
      "provider": "claude",
      "fallback_providers": [],
      "rate_limit": {
        "requests_per_day": 100
      }
    }
  }
}
```

2. **In the agent code:**

```python
from config.config_api import APIClient

client = APIClient("refactor-agent")  # Uses config automatically
response = client.call(messages, system_prompt="...")
```

That's it. Cost tracking, retries, rate limits all work automatically.

## Adding a New Provider

When you get ChatGPT API key:

1. **Enable in `agency-config.json`:**

```json
{
  "providers": {
    "chatgpt": {
      "enabled": true,  // Was false, now true
      "api_key_env_var": "OPENAI_API_KEY"
    }
  }
}
```

2. **Set environment variable:**

```bash
export OPENAI_API_KEY="sk-..."
```

3. **Install optional dependency:**

```bash
pip install openai
```

4. **Use it:**

```bash
# Override to use ChatGPT
python agents/math-agent/math-auditor.py file.gs --provider=chatgpt

# Or set as default
# (Edit agency-config.json: "primary_provider": "chatgpt")
```

The `ChatGPTProvider` class already exists and is scaffolded - no code changes needed.

## Cost Control

Automatic safeguards:

1. **Hard limit**: If monthly cost exceeds `hard_limit_dollars`, API calls fail with error
2. **Warning**: Printed to console when approaching `warn_threshold_dollars`
3. **Per-agent caps**: Each agent has `requests_per_day` limit
4. **Pricing config**: Update rates in `agency-config.json` if providers change pricing

```python
# Check limits
client = APIClient("math-agent")
within_limit, cost, limit = client.usage_tracker.check_cost_limit()
print(f"${cost:.2f} / ${limit} monthly")
```

## Troubleshooting

### API Key Not Found

```
ERROR: API key for claude not found. Set environment variable: ANTHROPIC_API_KEY
```

**Fix:**

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
```

### Provider Not Enabled

```
ERROR: Provider 'chatgpt' is not enabled in agency-config.json
```

**Fix:** Edit `agency-config.json`, change `"enabled": false` to `true`

### Rate Limit Exceeded

```
ERROR: Daily request limit exceeded for math-agent (50/50 requests today)
```

**Fix:** Wait until tomorrow, or increase in config: `"requests_per_day": 100`

### Cost Limit Exceeded

```
ERROR: Monthly cost limit exceeded ($100.50/$100). Increase hard_limit_dollars
```

**Fix:** Edit `agency-config.json`:

```json
{
  "usage_control": {
    "hard_limit_dollars": 200
  }
}
```

## Security Best Practices

1. **Never commit `.env`** - It's in `.gitignore`
2. **Use `.env.example`** - Template for developers
3. **API keys in environment only** - Never in code or config files
4. **Rotate keys regularly** - Especially if exposed
5. **Monitor `config/logs/`** - Check for unusual patterns
6. **Set cost limits** - Prevent runaway usage

## File Locations

| File | Purpose |
|------|---------|
| `agency-config.json` | Central config (version control) |
| `.env` | Your API keys (git-ignored) |
| `logs/api-usage.json` | Usage history (git-ignored) |
| `base_provider.py` | Abstract interface for providers |
| `api_client.py` | Unified client all agents use |
| `providers/` | Provider implementations |
| `credentials.py` | Secure credential management |
| `usage_tracker.py` | Cost/usage logging |

## Next Steps

1. ✓ Set `ANTHROPIC_API_KEY` environment variable
2. ✓ Install: `pip install -r agents/math-agent/requirements.txt`
3. ✓ Test: `python agents/math-agent/math-auditor.py core/baseline/beta-points.gs`
4. 📋 When you get ChatGPT API key: Update `.env`, enable in config, test with `--provider=chatgpt`
5. 📋 When you create more agents: Register in `agency-config.json`, import `APIClient`

## Questions?

All agents use this system:
- Same provider selection logic
- Same cost tracking
- Same credential management
- Same fallback strategy

Future agents are trivial - just create them and register in config.

---

**Last Updated**: February 15, 2026
