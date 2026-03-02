# Quick Start Guide — Research Agent

Get a codebase research answer in 2 minutes.

## Step 1: Get Your API Key

1. Go to https://console.anthropic.com/api/keys
2. Create a new API key
3. Copy it

## Step 2: Set API Key

```bash
export ANTHROPIC_API_KEY="sk-ant-yourkey..."
```

Or add to `.zshrc` to make it permanent:
```bash
echo 'export ANTHROPIC_API_KEY="sk-ant-yourkey..."' >> ~/.zshrc
source ~/.zshrc
```

## Step 3: Install Dependencies

```bash
cd agents/research-agent
pip install -r requirements.txt
```

## Step 4: Run Your First Research Query

From the project root:

```bash
python agents/research-agent/research-agent.py \
  --question "How do general and conservative optimization differ?" \
  core/optimization/optimizer.gs
```

You should see a structured research report with call chains, data flow, and a comparison table.

---

## Most Useful Commands

### Trace the full optimizer pipeline
```bash
python agents/research-agent/research-agent.py \
  --question "Trace optimizeSliders from entry to final slider values in the UI" \
  core/optimization/optimizer.gs \
  core/main/main.gs \
  Plot.html
```

### Investigate why sliders show zero
```bash
python agents/research-agent/research-agent.py \
  --question "Why would conservative optimization return zero for all slider values?" \
  core/optimization/optimizer.gs
```

### Understand a specific variable
```bash
python agents/research-agent/research-agent.py \
  --question "Where is scaledSliders created, what range are its values, and where is it consumed?" \
  core/optimization/optimizer.gs \
  core/main/main.gs \
  Plot.html
```

### Compare two code paths
```bash
python agents/research-agent/research-agent.py \
  --question "Compare sacoObjective when adaptive=true vs adaptive=false" \
  core/optimization/optimizer.gs
```

### Understand a component
```bash
python agents/research-agent/research-agent.py \
  --question "What does the copula correlation matrix do and how is it applied?" \
  core/reshaping/copula-utils.gs \
  core/reshaping/slider-adjustments.gs
```

---

## What You Get Back

The agent produces a markdown report with:

- **TL;DR** — direct answer in 2–4 sentences
- **Call Chain** — indented tree of function calls with `file.gs:NNN` citations
- **Data Flow** — how key variables are created, transformed, and consumed
- **Comparison Table** — side-by-side diff when comparing modes
- **Guards & Edge Cases** — safety conditions that can silently change output

---

## Customization

- **Edit `RULES.md`** to add new codebase patterns you discover
- **Edit `config.json`** to add new files to component groups
- **`research-agent.py`** loads RULES.md automatically as system context

---

## Troubleshooting

### "ANTHROPIC_API_KEY not set"
```bash
echo $ANTHROPIC_API_KEY   # should print your key
export ANTHROPIC_API_KEY="sk-ant-..."
```

### "File not found"
Use paths relative to the project root:
```bash
# Correct
python agents/research-agent/research-agent.py --question "..." core/optimization/optimizer.gs

# Wrong (don't use absolute paths)
python agents/research-agent/research-agent.py --question "..." /Users/you/.../optimizer.gs
```

### "ModuleNotFoundError: No module named 'anthropic'"
```bash
pip install -r agents/research-agent/requirements.txt
```

---

**Need more?** See `README.md` for full documentation and examples.
