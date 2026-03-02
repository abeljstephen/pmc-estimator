# Quick Start Guide - Math Agent

Get your math auditor running in 2 minutes.

## Step 1: Get Your API Key

1. Go to https://console.anthropic.com/api/keys
2. Create a new API key
3. Copy it

## Step 2: Set API Key

In your terminal, set the environment variable:

```bash
export ANTHROPIC_API_KEY="sk-ant-yourkey..."
```

Or add to your `.bash_profile` / `.zshrc` to make it permanent:

```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-yourkey..."' >> ~/.zshrc
source ~/.zshrc
```

## Step 3: Install Dependencies

```bash
cd agents/math-agent
pip install -r requirements.txt
```

## Step 4: Run Your First Audit

From the project root:

```bash
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs
```

You should see a detailed mathematical audit report!

## Next: Use In Your Workflow

### Option A: Quick Command

```bash
# Audit any file
python agents/math-agent/math-auditor.py core/reshaping/copula-utils.gs
```

### Option B: VS Code Task

Create `.vscode/tasks.json` with the content in `README.md` (section "VS Code Integration").

Then run: `Ctrl+Shift+B` → select "Math Audit - Current File"

### Option C: Git Hook (Pre-Commit)

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash
echo "Running Math Audit..."
python agents/math-agent/math-auditor.py core/baseline/coordinator.gs
if [ $? -ne 0 ]; then
  echo "Math audit failed. Commit aborted."
  exit 1
fi
```

Then make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

## Common Commands

```bash
# Audit a single file
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs

# Audit multiple critical files
python agents/math-agent/math-auditor.py \
  core/baseline/coordinator.gs \
  core/reshaping/copula-utils.gs \
  core/optimization/optimizer.gs

# Audit all baseline files
python agents/math-agent/math-auditor.py \
  core/baseline/*.gs
```

## Customization

- **Edit `RULES.md`** to add your mathematical requirements
- **Edit `IMPROVEMENTS.md`** to track advances you care about
- **Edit `config.json`** to adjust thresholds and focus areas

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
```bash
echo $ANTHROPIC_API_KEY  # Does it exist?
export ANTHROPIC_API_KEY="sk-ant-..."
```

### "FILE NOT FOUND"
Make sure file paths are relative to project root:
```bash
# ✓ Correct
python agents/math-agent/math-auditor.py core/baseline/beta-points.gs

# ✗ Wrong
python agents/math-agent/math-auditor.py /full/path/to/beta-points.gs
```

### "ModuleNotFoundError: No module named 'anthropic'"
```bash
pip install -r agents/math-agent/requirements.txt
```

## What Happens Next?

The auditor will:
1. Load your RULES.md and IMPROVEMENTS.md
2. Read the specified .gs files
3. Send everything to Claude API
4. Get back a detailed mathematical audit report
5. Print the report (30-60 seconds typically)

The agent acts as a Nobel Prize-winning mathematician who:
- Checks formula correctness
- Validates integration between components
- Flags numerical stability issues
- Suggests mathematical improvements
- References academic literature

## That's It!

You now have an AI-powered math auditor for your probabilistic estimation system. Run it whenever you change code. 🎓

---

**Need help?** See `README.md` for full documentation.
