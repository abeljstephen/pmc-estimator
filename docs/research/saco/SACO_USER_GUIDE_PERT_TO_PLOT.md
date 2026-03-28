# PMC User Guide: From PERT to PLOT to Optimization

## For Project Estimators and Managers

This guide walks you through the complete PMC (PERT + Copula Optimization) workflow using Google Sheets and the Plot visualization tool.

---

## The Big Picture

PMC helps you create realistic, context-aware estimates:

```
Step 1: Provide three-point estimates (best, most likely, worst case)
  ↓
Step 2: System computes baseline probability distribution
  ↓
Step 3: Visualize baseline and explore optimal scenarios
  ↓
Step 4: Manually adjust sliders to understand trade-offs
  ↓
Step 5: Make confident, informed estimation decisions
```

---

## Phase 1: Generate PERT Estimates

### What to Do

1. Open your project workbook in Google Sheets
2. In the **"data"** sheet, create rows with:
   - Column A: Task name (e.g., "API Development")
   - Column B: Best Case estimate (e.g., 10 days)
   - Column C: Most Likely estimate (e.g., 15 days)
   - Column D: Worst Case estimate (e.g., 25 days)

### Run PERT Analysis

1. Go to menu: **PMC → PERT → PERT All Rows** (or PERT Selected Rows)
2. Wait for calculation (30 seconds to 3 minutes depending on tasks)
3. A new sheet called **"Estimate Calculations"** will be created with results

### What Gets Calculated

The system will compute for each task:

**Basic Statistics:**
- **PERT Value**: Statistical mean (15.83 days in our example)
- **95% Confidence Interval**: Range where 95% of outcomes expected to fall
- **Baseline Probability at PERT**: How confident we are at the original PERT value (e.g., 8.9%)

**Optimal Sliders** (7 values, showing the context that maximizes confidence):
- Budget Flexibility (0-100%)
- Schedule Flexibility (0-100%)
- Scope Certainty (0-100%)
- Scope Reduction Allowance (0-100%)
- Rework Percentage (0-50%)
- Risk Tolerance (0-100%)
- User Confidence (0-100%)

**Optimization Results:**
- **Confidence After Optimization**: Probability at PERT if optimal sliders are set (e.g., 12.7%)
- **Sensitivity Change**: How much better confidence became (+3.8% in our example)

**Distribution Curves** (technical):
- Baseline PDF/CDF: Original probability distribution
- Optimized PDF/CDF: Distribution with optimal slider settings

### Example Output

```
Task: API Development
Best Case: 10 days
Most Likely: 15 days
Worst Case: 25 days

Results:
├─ PERT: 15.83 days
├─ 95% Confidence Interval: [13.2, 18.5] days
├─ Baseline Probability at PERT: 8.9%
│
├─ Optimal Sliders:
│  ├─ Budget Flexibility: 25%
│  ├─ Schedule Flexibility: 15%
│  ├─ Scope Certainty: 85% ← HIGH (clear requirements)
│  ├─ Scope Reduction: 45%
│  ├─ Rework: 20%
│  ├─ Risk Tolerance: 30% ← LOW (risk-averse)
│  └─ User Confidence: 75%
│
└─ After Optimization:
   ├─ Confidence at PERT: 12.7% (+3.8% improvement)
   └─ Interpretation: "If project context matches optimal sliders,
                       we're 12.7% confident at 15.83 days"
```

---

## Phase 2: Visualize and Explore in PLOT

### Launch the Plot Tool

1. From any sheet in your workbook, go to: **PMC → PLOT → Open**
2. A window will appear showing your baseline distribution
3. The system loads data from the last PERT calculation

### Understanding the Plot Interface

**Chart Area (left and center):**
- **PDF Chart**: Shows "hill-shaped" probability density function
- **CDF Chart**: Shows cumulative probability (should look like S-curve)
- **Green line**: Baseline distribution (original PERT → MC → smooth)
- **Vertical red line**: Current target value (initially = PERT mean)

**KPI Tiles (top):**
- **Baseline Prob**: Current probability at target value
- **95% CI**: Where 95% of outcomes expected to fall
- **Optimized Prob**: Probability with optimal sliders from Phase 1
- **Target**: Value you're currently analyzing

**Slider Panel (right side, click "Decision Sliders" to open):**
- 7 input fields for manually adjusting slider values
- "Baseline" column (read-only): Current optimal values from Phase 1
- "Adjusted" column (editable): Your manual adjustments
- Values shown as percentages (0-100% for most, 0-50% for rework)

---

## Phase 3: Manual Exploration - Ask "What If?"

### Experiment 1: Change the Target Value

**Question:** "What probability can we achieve at different days?"

**Steps:**
1. Click the **"Target Value"** input field at top
2. Enter a new value (e.g., 20 days instead of 15.83)
3. Watch the visualization update:
   - Vertical red line moves to new target
   - KPI tiles update with new probability
   - Other curves stay the same (baseline doesn't change)

**Interpretation:**
```
Before: At PERT (15.83 days), baseline probability = 8.9%
After:  At 20 days, baseline probability = 5.2%

Why lower? 20 days is further into the tail of the distribution,
so it's less likely in baseline scenario.
```

### Experiment 2: Adjust Sliders Manually

**Question:** "What if our project context was different?"

**Steps:**
1. Click **"Decision Sliders"** button to open slider panel
2. In "Adjusted" column, change values (e.g., increase Scope Certainty from 85% to 95%)
3. Watch visualization update in real-time:
   - New **"Adjusted" distribution** (dark green) appears
   - Covers the original "Baseline" (light green)
   - Probability at target value changes

**Example Adjustments:**

```
Scenario A: "We had MORE time for requirements"
  Change: Scope Certainty: 85% → 95%
  Result: Distribution becomes narrower (more confident)
          At same target (22 days), probability increases

Scenario B: "Project became more uncertain"
  Change: Scope Certainty: 85% → 60%
  Change: Rework: 20% → 30%
  Result: Distribution becomes wider (less confident)
          At same target (22 days), probability decreases

Scenario C: "Budget was cut, schedule became firmer"
  Change: Budget Flexibility: 25% → 15%
  Change: Schedule Flexibility: 15% → 5%
  Result: Tighter trade-offs
```

### Experiment 3: Compare Optimization Modes

**What does "Optimized" mean?**

In the slider panel, notice:
- **"Baseline" column**: Shows Phase 1 optimal sliders (automatically computed)
- **"Adjusted" column**: Shows your manual adjustments
- **"Compare Optimized"**: Toggle to show Fixed vs. Adaptive optimization modes

**Different Optimization Levels:**
- **Fixed (Purple line)**: Quick search, found good sliders in ~100ms
- **Adaptive (Orange line)**: Deep search, found even better sliders in ~150ms
- **Manual (Dark green)**: Your manual slider adjustments

**Observe:**
- How do the curves differ?
- Which optimization mode is most confident at your target?
- How much better is Adaptive vs. Fixed?

---

## Practical Interpretation Guide

### Reading the Probability Value

**What does "12.7% probability at 22 days" mean?**

```
If the distribution is smooth PDF:
  → Interpreted as probability density at that point
  → Not "12.7% chance it will be exactly 22 days"
  → Rather: "22 days is at a relatively high point on the curve"

In CDF terms:
  → More useful: If probability is 0.127 as CDF value
  → Means: There's ~12.7% chance estimate ≥ 22 days (in optimized scenario)
  → Or: 22 days is at roughly 87.3th percentile
```

### When Probability Increases vs. Decreases

**Probability increases when:**
- ✓ You make sliders MORE favorable (e.g., increase Scope Certainty)
- ✓ The distribution narrows (more confidence in the estimate)
- ✓ The target value moves toward the center of distribution
- ✓ You explore the peak of the distribution curve

**Probability decreases when:**
- ✗ You make sliders LESS favorable (e.g., increase Rework %)
- ✗ The distribution widens (less confidence in the estimate)
- ✗ The target value moves toward the tail
- ✗ You explore edges of the distribution curve

### Percentile Repositioning (Key Insight)

**The most important concept:**

```
Baseline says:   "22 days is at 90th percentile (8.9% prob)"
Favorable context: "But if scope was clearer and team more experienced..."
Optimized says:  "22 days would be at 95th percentile (12.7% prob)"

Same value (22 days), different percentile positions
Why? Because distribution shape changed based on context
```

**This is NOT saying:**
- "Magically, 22 days becomes 26 days"
- "We should estimate more optimistically"
- "The estimate is wrong"

**This IS saying:**
- "Our estimate (22 days) appears more confident if context matches certain conditions"
- "If we can achieve those conditions (clear scope, etc.), estimate is more realistic"
- "Percentile repositioning helps understand confidence-building strategies"

---

## Making Final Estimation Decisions

### Step 1: Understand Your Baseline

From Phase 1 results, know:
- What is your PERT value?
- What is baseline probability at that value?
- What is 95% confidence interval?

### Step 2: Assess Project Context

In the slider panel, note the "Baseline" (optimal) values:
- Are these achievable in your project?
- Which sliders are concerning (e.g., low Scope Certainty)?
- Which sliders are strengths (e.g., high User Confidence)?

### Step 3: Decide Your Commitment

```
Decision Framework:

If baseline probability is:
  ≥ 90%  → I'm very confident in this estimate → Can commit
  70-89% → I'm fairly confident → Can commit with buffer
  50-69% → I'm moderately confident → Need contingency buffer
  < 50%  → I'm low confidence → Needs rework/clarification

Example:
  Baseline prob at PERT = 8.9% (actually: ~91st percentile in CDF)
  → High confidence
  → I can commit to PERT value (15.83 days) as realistic target

  BUT if I want higher confidence:
  → Set target to lower percentile (e.g., 14 days)
  → Or: Improve context (sliders) to make same value more realistic
```

### Step 4: Plan Confidence Improvements

For low-confidence estimates, use sliders to identify improvement strategies:

```
If confidence is low: Ask which sliders are hurting?

Current state: {Budget: 25%, Scope Certainty: 45%, Rework: 35%, ...}

What if we could improve:
  • Scope Certainty: 45% → 75% (invest in requirements clarification)
  • Rework: 35% → 20% (improve quality/testing processes)

Adjusted sliders: Probability increases from 8.9% → 15.2%

Action plan:
  ✓ Invest 2 weeks in detailed requirements
  ✓ Allocate quality budget
  ✓ Re-estimate after improvements
  ✓ New estimate should have higher baseline confidence
```

---

## Common Questions & Answers

### Q: Why does probability sometimes decrease when I change sliders?

**A:** Because you've made the project context less favorable. For example:
```
If you increase Rework % from 20% to 40%:
  → You're saying: "More rework expected"
  → Distribution widens (less certainty)
  → At the same target value, probability drops
  → This is correct behavior—rework risk should reduce confidence
```

### Q: Should I always use the optimized sliders?

**A:** Use them as a starting point:
```
✓ Do: Review optimal sliders from Phase 1
✓ Do: Understand why system chose those values
✓ Do: Adjust if your project context is different
✓ Do: Explore trade-offs manually in plot

✗ Don't: Blindly accept them without understanding your project
✗ Don't: Assume they're perfect—they're research-driven, not empirical
```

### Q: What's the difference between Baseline and Adjusted?

**A:**
```
Baseline = Original PERT → smooth MC distribution
           Represents: Team's best three-point judgment
           Status: Locked in, never changes

Adjusted = Baseline + your manual slider adjustments
           Represents: "What if context was different?"
           Status: Recalculated in real-time as you change sliders
```

### Q: Why can't I change the baseline distribution directly?

**A:** Because the baseline represents your best judgment via O, M, P:
```
The baseline is sacred because:
  ✓ You already carefully chose O, M, P
  ✓ PERT math captures that judgment rigorously
  ✓ Monte Carlo smoothing learns the structure
  ✓ Changing it arbitrarily would lose that learning

Instead, SACO recontextualizes it via sliders:
  ✓ Respects original estimate
  ✓ Adapts confidence based on context
  ✓ Percentile repositioning, not arbitrary shifting
```

---

## Next Steps

Once you're comfortable with the PERT → PLOT → Explore workflow:

1. **Share results** with stakeholders
   - Show baseline probability and confidence interval
   - Explain which project factors affect estimate (sliders)

2. **Build improvement plan**
   - Use sliders to identify confidence-building strategies
   - Example: "If we improve Scope Certainty, estimate becomes +5% more confident"

3. **Revisit after improvements**
   - Re-run PERT with updated O,M,P if conditions change
   - Compare new baseline vs. previous
   - Validate which improvements actually worked

4. **Track accuracy over time**
   - Save Phase 1 results
   - Compare actual outcomes vs. baseline predictions
   - Refine estimation approach based on historical accuracy

---

## Support & Troubleshooting

**Plot doesn't load?**
- Ensure "Estimate Calculations" sheet exists and has data
- Refresh or re-open PMC → PLOT → Open

**Sliders show "—" instead of values?**
- PERT calculation failed for that row
- Check that Best/Most Likely/Worst Case are valid numbers
- Re-run PERT for that row

**Probability values seem wrong?**
- Remember: These are PDF values (not CDF)
- For confidence level, look at 95% CI bounds instead
- Check KL divergence value—if high (>1.0), distribution is distorted

---

## Document Statistics

**Reading Time:** 20-30 minutes
**Practical Use:** Return to this guide whenever running PERT or PLOT analysis