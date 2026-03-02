# Quick Reference - Multi-Provider Architecture

## Single Command to Get Started

```bash
# 1. Verify API key is set
echo $ANTHROPIC_API_KEY

# 2. Run your first audit (uses Claude by default)
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs
```

---

## Your Current Setup

| Component | Status | Files |
|-----------|--------|-------|
| **Claude** | ✅ Ready | `config/config-api/providers/claude_provider.py` |
| **ChatGPT** | 📋 Scaffolded | `config/config-api/providers/chatgpt_provider.py` |
| **Grok** | 📋 Scaffolded | `config/config-api/providers/grok_provider.py` |
| **Math Agent** | ✅ Updated | `agents/math-agent/math-auditor.py` |
| **Central Config** | ✅ Created | `config/config-api/agency-config.json` |

---

## Three Ways to Run

```bash
# Default (no prompts, uses Claude)
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs

# Override provider (once you have ChatGPT key)
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs --provider=chatgpt

# Ask user to choose
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs --interactive
```

---

## Key Files to Know

| File | What | Customize? |
|------|------|-----------|
| `config/config-api/agency-config.json` | Central config (providers, costs, agents, limits) | ✏️ Yes |
| `config/config-api/api_client.py` | Unified client (all agents use this) | 🔒 No |
| `config/.env.example` | API key template | 📋 Reference only |
| `agents/math-agent/math-auditor.py` | Math auditor agent | ✏️ If needed |
| `config/CONFIG.md` | Full documentation | 📖 Reference |

---

## How Config Works

**One file controls everything:**

```json
{
  "providers": {
    "claude": { "enabled": true },      // Enable/disable
    "chatgpt": { "enabled": false }      // Ready to enable
  },
  "agents": {
    "math-agent": {
      "provider": "claude",               // Which to use
      "rate_limit": {
        "requests_per_day": 100          // How many per day
      }
    }
  },
  "usage_control": {
    "hard_limit_dollars": 100            // Max monthly spend
  }
}
```

**Edit `agency-config.json` to:**
- Change default provider: `"primary_provider": "chatgpt"`
- Add fallback: `"fallback_providers": ["chatgpt"]`
- Adjust budget: `"hard_limit_dollars": 200`
- Set per-agent limits: `"requests_per_day": 50`

---

## Adding a New Provider (Future)

When you get ChatGPT API key:

```bash
# 1. Set environment variable
export OPENAI_API_KEY="sk-..."

# 2. Install SDK (optional)
pip install openai

# 3. Enable in config
# Edit: config/config-api/agency-config.json
# Change: "chatgpt": { "enabled": false } → true

#  4. Test it
python agents/math-agent/math-auditor.py file.gs --provider=chatgpt
```

**That's it.** The `ChatGPTProvider` is already coded and ready.

---

## Adding a New Agent (Future)

When you create agent #2:

```python
# agents/your-agent/your-agent.py
from config.config_api import APIClient

# Create client (uses unified infrastructure)
client = APIClient("your-agent-name")

# Make call
response = client.call(
    messages=[{"role": "user", "content": "..."}],
    system_prompt="You are..."
)
```

Register in `agency-config.json`:

```json
{
  "agents": {
    "your-agent-name": {
      "enabled": true,
      "provider": "claude",
      "rate_limit": { "requests_per_day": 100 }
    }
  }
}
```

**Cost tracking, retries, fallbacks all automatic.**

---

## Check Costs & Usage

```bash
# View all usage
python -c "
from config.config_api import APIClient
client = APIClient('math-agent')
client.print_summary()
"

# Check provider status
python -c "
from config.config_api import APIClient
client = APIClient('math-agent')
client.print_status()
"

# View raw logs
cat config/logs/api-usage.json
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `API key not found` | Set: `export ANTHROPIC_API_KEY="sk-..."` |
| `Provider not enabled` | Edit `agency-config.json`: `"enabled": true` |
| `Rate limit exceeded` | Wait until tomorrow or increase in config |
| `Cost limit exceeded` | Increase `hard_limit_dollars` in config |

---

## Directory Tree

```
config/
├── config-api/                    ← All infrastructure here
│   ├── agency-config.json         ← Central config (edit this!)
│   ├── api_client.py              ← Unified client
│   ├── base_provider.py           ← Abstract interface
│   ├── credentials.py
│   ├── usage_tracker.py
│   └── providers/
│       ├── provider_factory.py    ← Routes to right provider
│       ├── claude_provider.py     ← ✓ Ready
│       ├── chatgpt_provider.py    ← 📋 Scaffolded
│       └── grok_provider.py       ← 📋 Scaffolded
└── .env.example                   ← Credentials template

agents/
├── math-agent/
│   ├── math-auditor.py            ← Uses APIClient
│   ├── RULES.md
│   ├── IMPROVEMENTS.md
│   ├── config.json
│   └── requirements.txt
```

---

## What You Have Now

✅ **Unified API client** - All agents use same infrastructure
✅ **Multi-provider ready** - Claude working, ChatGPT & Grok scaffolded
✅ **Hybrid mode** - Fast default + flexible overrides (`--provider`, `--interactive`)
✅ **Cost control** - Automatic tracking + hard limits
✅ **Secure credentials** - Environment variables only, never in code
✅ **Scalable design** - Easy to add agents and providers
✅ **Usage tracking** - Logs everything for auditing

---

## Next Steps

1. ✅ Run: `python agents/math-agent/math-auditor.py core/baseline/beta-points.gs`
2. 📋 When you get ChatGPT key: Enable in config, test with `--provider=chatgpt`
3. 📋 When you create agent #2: Register in config, import APIClient
4. 📋 When you want different provider: Edit `agency-config.json`

---

## Files Documentation

- **`INFRASTRUCTURE_SUMMARY.md`** - Complete architecture overview (you're reading related content)
- **`config/CONFIG.md`** - Detailed configuration guide
- **`agents/math-agent/README.md`** - Agent-specific documentation
- **`agents/math-agent/QUICKSTART.md`** - 2-minute setup

---

**Your infrastructure is production-ready.** All agents will benefit automatically.
