# Complete SACO User Workflow: From PERT to Plot to Optimization

## Overview

The PMC (PERT + Copula Optimization) system implements a complete three-phase workflow:

```
Phase 1: PERT Baseline (via PERT menu)
  ↓
Phase 2: Baseline Distribution Visualization (via PLOT menu)
  ↓
Phase 3: Interactive Slider Adjustment → Percentile Repositioning (in Plot UI)
```

---

## Phase 1: PERT Menu - Automatic Baseline Calculation

### What Happens When User Clicks "PERT"

**Entry Points:**
- "PERT All Rows" → `pertRunAllRows()` (Code.gs:957)
- "PERT Selected Rows" → `pertRunSelectedRows()` (Code.gs:963)

### Processing Flow (for each task)

```
Step 1: Extract Three-Point Estimate
  From data sheet row: (O, M, P) = (Optimistic, Most Likely, Pessimistic)
  Example: (10, 15, 25) days

Step 2: Calculate PERT Mean
  PERT = (O + 4M + P) / 6 = (10 + 60 + 25) / 6 = 15.83 days
  → Stored in column 5: "PERT"

Step 3: Compute Beta Parameters via Method of Moments
  α = 1 + 4(M-O)/(P-O) = 1 + 4(5)/(15) = 2.33
  β = 1 + 4(P-M)/(P-O) = 1 + 4(10)/(15) = 3.67
  → Beta(2.33, 3.67) parameterization of baseline

Step 4: Sample Raw Monte Carlo Distribution
  Sample n=1000 times from Beta(α, β)
  Result: Array of sample values [10.2, 13.8, 15.1, 16.5, ..., 24.7]

Step 5: Smooth Monte Carlo Distribution into BASELINE
  Interpolate 1000 samples → smooth PDF/CDF curves
  → Creates "baseline distribution" (LOCKED IN)
  → This is what all optimizations are measured AGAINST
  → Stored in columns 19-20 as JSON arrays of {x, y} points

Step 6: Compute Baseline Metrics
  - Baseline probability at PERT value: P(X = 15.83) from CDF
    → Column 8: "% Confidence of Original PERT Value"

  - 95% Confidence Interval from smoothed MC
    → Columns 6-7: "MC Smoothed 95% CI Lower/Upper"

  - KL Divergence from triangle to MC-smoothed baseline
    → Column 18: "KL Divergence To Triangle"

Step 7: Find Optimal Sliders to Maximize PERT Probability
  Target: Maximize P(X = PERT value)

  Phase A (Fixed/Coarse):
    - Run optimization with probeLevel=1 (shallow search)
    - Find initial good slider settings quickly
    - Grid: ~50-75 points, 5-10 COBYLA iterations

  Phase B (Adaptive/Deep):
    - Seed search with Phase A results
    - Run full SACO optimization with probeLevel=3
    - Grid: ~225 points (15×15), 15-20 COBYLA iterations
    - Optimize sliders to maximize probability at PERT

  Example result:
    [budgetFlexibility=0.25, scheduleFlexibility=0.15,
     scopeCertainty=0.85, scopeReduction=0.45,
     reworkPercentage=0.20, riskTolerance=0.30,
     userConfidence=0.75]

  → Columns 9-15: "Optimal [Slider Name]"

Step 8: Generate Optimized Distribution from Optimal Sliders
  Using optimal sliders from Step 7:
  - Apply Gaussian copula to model slider dependencies
  - Compute moment mapping: m0 (mean shift), m1 (variance factor)
  - Method of moments: fit new Beta(α', β') to match adjusted moments
  - Sample from optimized Beta(α', β')
  - Smooth samples → optimized distribution
  - Result: Context-aware distribution reflecting optimal slider context

  → Columns 21-22: "Optimized MC Smoothed Points (PDF/CDF)" as JSON

Step 9: Calculate Optimization Metrics
  - Optimized probability at PERT: P_opt(X = PERT)
    → Column 16: "% Confidence of Original PERT Value After Slider Optimization"

  - Sensitivity change: ΔProb = P_opt - P_baseline
    → Column 17: "MC Smoothed Sensitivity Change"

  - Example: If P_baseline = 0.089 (8.9%) and P_opt = 0.127 (12.7%)
    → Shows 3.8% improvement by tweaking sliders optimally
```

### Output: Estimate Calculations Sheet

**Column Layout:**
```
1-4:   Name, Best Case, Most Likely, Worst Case
5-7:   PERT, 95% CI Lower, 95% CI Upper (from baseline MC)
8:     Baseline % Confidence at PERT value
9-15:  Optimal Sliders (7 values in UI units: 0-100% or 0-50%)
16:    % Confidence After Optimization
17:    Sensitivity Change (ΔProb)
18:    KL Divergence to Triangle
19:    Baseline MC Smoothed PDF Points (JSON)
20:    Baseline MC Smoothed CDF Points (JSON)
21:    Optimized MC Smoothed PDF Points (JSON)
22:    Optimized MC Smoothed CDF Points (JSON)
```

---

## Phase 2: PLOT Menu - Visualize Baseline Distribution

### What Happens When User Clicks "PLOT"

**Entry Point:**
- `openPlotUi()` (Code.gs:236) → Launches modeless dialog with Plot.html

### Plot Initialization (Plot.html)

```
Step 1: Load Data from Sheet
  Fetch last calculated row from "Estimate Calculations" sheet
  Extract: O, M, P, PERT, Baseline PDF/CDF points, Optimal sliders

Step 2: Render Baseline Distribution
  - Parse JSON arrays from sheet columns 19-20
  - Draw PDF on Chart.js canvas (left side)
  - Draw CDF on Chart.js canvas (right side)
  - Mark PERT value with vertical line
  - Display current probability at PERT from baseline CDF

Step 3: Initialize Slider Values
  - Populate 7 slider input fields with optimal values from Phase 1
  - Convert internal 0-1 format to UI format (0-100% or 0-50%)
  - Display reader-friendly labels for each slider

Step 4: Display KPIs (Key Performance Indicators)
  - Baseline probability at PERT
  - Baseline 95% confidence interval band
  - Current optimized probability (from Phase 1)
  - Current target value (initially = PERT)
```

---

## Phase 3: Interactive SACO Optimization in Plot UI

### User's Manual Exploration

**The Plot.html interface allows four types of exploration:**

### 1. Change Target Value

```
User enters new target: e.g., 18 days (instead of 15.83 PERT)

System response:
  - Lookup baseline probability at 18 days from baseline CDF
  - Display: "At baseline, 18 days is at 72nd percentile"
  - Question posed to user: "Can we improve confidence at 18 days
    by adjusting sliders?"

Example:
  - Baseline at 18d: P = 0.068 (6.8%, roughly 60th percentile)
  - Target updated in KPI: "Adjusting sliders for target = 18"
```

### 2. Adjust Sliders Manually

```
User changes slider values: e.g.,
  - Budget Flexibility: 25% → 35% (increase flexibility)
  - Scope Certainty: 85% → 75% (lower certainty)
  - Other sliders unchanged

System processes (in real-time, client-side call to Core API):
  Step 1: Convert UI values to 0-1 internal format
  Step 2: Apply Gaussian copula with new slider values
          → Models dependencies between sliders

  Step 3: Compute moment mapping
          - lin = Σ(W[i] × slider[i])  [Linear aggregation]
          - por = 1 - ∏(1-0.9×slider[i])  [Probabilistic OR]
          - m0 = hybrid blend of lin and por [Mean adjustment]
          - m1 = variance multiplier [Variance adjustment]

  Step 4: Method of moments
          - Compute target μ' and σ² from adjusted moments
          - Beta parameterization: α', β' from μ' and σ²

  Step 5: Resample and Smooth
          - Sample from Beta(α', β')
          - Smooth to get new PDF/CDF

  Step 6: Query CDF
          - New probability at target value from new distribution

Result in UI:
  - Blue line appears: "Adjusted (manual)" distribution
  - Green line: Still shows baseline
  - Vertical red line: Marks target value
  - In CDF view: Can see target moved to different percentile
```

### 3. Observe Real-Time Feedback

```
For example:
  - Baseline at 18 days: P = 0.068 (6.8%)
  - After moving sliders optimally: P = 0.092 (9.2%)
  - Sensitivity change: +2.4%

User sees in UI:
  - KPI tiles update live
  - "Adjusted" color (blue) shows new distribution
  - "Baseline" color (green) shows original
  - Percentile position shifts visually on CDF
  - Confidence % changes in real time
```

### 4. Compare Multiple Optimization Variants

```
UI displays up to 4 distribution curves simultaneously:

1. Baseline (Green, #10B981)
   = Original PERT → MC → smooth
   Source: Columns 19-20 from sheet

2. Manual Adjusted (Dark Green, #059669)
   = Baseline + user's manual slider adjustments
   Recomputed in real-time as user changes sliders

3. Optimized Fixed (Purple, #6D28D9)
   = Fixed mode optimization (coarse search, probeLevel=1)
   From Phase 1 with shallow grid search

4. Optimized Adaptive (Orange, #F59E0B)
   = Adaptive mode optimization (deep search, probeLevel=3+)
   From Phase 1 with full grid + refinement

Toggle buttons allow:
  - Show/hide each variant
  - Compare any two side-by-side
  - Understand improvement from each optimization approach
```

---

## Depth Levels: probeLevel (0–7)

### What probeLevel Controls

**probeLevel** = Search "depth" / aggressiveness in SACO optimization

```
Range: 0–7

Each level represents:
- How many grid points evaluated in parameter space
- How many iterations of COBYLA local refinement
- How aggressive/exhaustive the slider search
- Time cost (probeLevel 0 = fast, 7 = slow)
```

### Level Definitions

```
probeLevel 0:
  Purpose: Baseline-only analysis
  • No SACO auto-optimization run
  • Manual reshape still allowed (user can adjust sliders)
  • Grid points: None (no search)
  • COBYLA iterations: None
  • Time: <50ms (just baseline computation)
  • Use case: Quick baseline visualization

probeLevel 1:
  Purpose: Fixed/Coarse scaling
  • Shallow grid search for quick seed
  • Grid points: ~50-75 evaluated
  • COBYLA iterations: 5-10
  • Time: ~100ms
  • Use case: Phase 1 PERT, first optimization pass (Fixed mode)

probeLevel 2:
  Purpose: Medium search
  • Moderate grid search
  • Grid points: ~100-125
  • COBYLA iterations: 10-15
  • Time: ~130-150ms
  • Use case: Balance of speed and quality

probeLevel 3:
  Purpose: Adaptive/Full scaling (DEFAULT)
  • Complete grid search of parameter space
  • Grid points: ~225 (15×15 parameter grid)
  • COBYLA iterations: 15-20
  • Time: ~150-180ms
  • Root-based optimization for final precision
  • Use case: Phase 1 PERT Adaptive mode, standard optimization

probeLevel 4:
  Purpose: Deep search with refinement
  • Extended grid search + aggressive COBYLA
  • Grid points: ~225 base + adaptive densification
  • COBYLA iterations: 20-25
  • Time: ~250-350ms
  • Use case: High-stakes estimates needing precision

probeLevel 5:
  Purpose: Very deep search
  • Exhaustive grid + multi-phase COBYLA
  • Grid points: ~300-400
  • COBYLA iterations: 25-30
  • Time: ~400-600ms
  • Use case: Mission-critical estimates

probeLevel 6-7:
  Purpose: Exhaustive/Research-grade
  • Grid points: 400-500+
  • COBYLA iterations: 30+
  • Multi-seed, multi-refinement strategy
  • Time: 1-3 seconds
  • Use case: Complex projects, multiple local optima likely
```

### How Levels Are Used in Current Implementation

**In Phase 1 (Code.gs → Core API):**
```
payloadOptimize_() (Code.gs:321):
  Fixed mode:
    searchDepth: NOT explicitly set → uses system default (usually 1-2)

  Adaptive mode:
    searchDepth: 3 (if CFG.P2_STRONG_RETRY = true)
    → probeLevel=3: Full grid, 225 points, 15-20 COBYLA iterations
```

**In Phase 3 (Plot.html UI):**
```
Currently:
  - No explicit probeLevel selector visible
  - Uses default from Core API

Future potential:
  - User could select probeLevel slider (0–7)
  - "Quick optimization" (level 1) vs. "Deep optimization" (level 5+)
  - Trade-off: Speed vs. precision confidence
```

---

## Complete Value Chain: From Input to Output

```
╔═══════════════════════════════════════════════════════════════════╗
║ USER INPUT (Google Sheet)                                         ║
║ Columns: Name, Best Case, Most Likely, Worst Case                ║
║ Example: Task A, 10 days, 15 days, 25 days                       ║
╚═══════════════════════════════════════════════════════════════════╝
                           ↓
╔═══════════════════════════════════════════════════════════════════╗
║ PHASE 1: PERT BASELINE → OPTIMIZATION (Code.gs + Core API)       ║
║                                                                    ║
║ Step A1: PERT Formula                                             ║
║   PERT = (O + 4M + P) / 6                                         ║
║   → 15.83 days                                                     ║
║                                                                    ║
║ Step A2: Beta Parameterization                                    ║
║   Method of moments: α, β from PERT range [O, P]                 ║
║   → Beta(2.33, 3.67)                                              ║
║                                                                    ║
║ Step A3: Raw Monte Carlo Sample                                   ║
║   Sample 1000× from Beta(α, β)                                    ║
║   → [10.2, 13.8, 15.1, 16.5, ..., 24.7]                          ║
║                                                                    ║
║ Step A4: Smooth to Baseline Distribution                          ║
║   Interpolate samples → smooth PDF/CDF curves                     ║
║   → BASELINE (LOCKED IN)                                          ║
║   → P_baseline(15.83) = 0.089 (8.9%)                              ║
║                                                                    ║
║ Step A5: Optimize Sliders (probeLevel 1 then 3)                  ║
║   Mode 1 - Fixed (Coarse):                                        ║
║     - probeLevel 1: ~50-75 grid points                            ║
║     - Goal: Find good seed sliders quickly                        ║
║                                                                    ║
║   Mode 2 - Adaptive (Deep):                                       ║
║     - Seed from Fixed results                                     ║
║     - probeLevel 3: ~225 grid points                              ║
║     - Goal: Find sliders that maximize P(X = PERT)                ║
║     - Result: [0.25, 0.15, 0.85, 0.45, 0.20, 0.30, 0.75]       ║
║                                                                    ║
║ Step A6: Generate Optimized Distribution                          ║
║   Apply SACO with optimal sliders:                                ║
║     - Gaussian copula: Model slider dependencies                  ║
║     - Moment mapping: Compute m0, m1 adjustments                  ║
║     - Beta refit: New (α', β')                                    ║
║     - Resample + smooth → optimized distribution                  ║
║   → P_optimized(15.83) = 0.127 (12.7%)                            ║
║   → ΔProb = +3.8%                                                  ║
║                                                                    ║
║ Step A7: Write Results to Sheet                                   ║
║   Columns 5-22:                                                   ║
║     - PERT value (15.83)                                          ║
║     - Baseline metrics (CI, prob)                                 ║
║     - Optimal sliders (7 values)                                  ║
║     - Optimized metrics (prob, ΔProb)                             ║
║     - PDF/CDF curves (baseline + optimized, as JSON)              ║
╚═══════════════════════════════════════════════════════════════════╝
                           ↓
╔═══════════════════════════════════════════════════════════════════╗
║ PHASE 2: PLOT VISUALIZATION (Plot.html)                          ║
║                                                                    ║
║ Step B1: Load Data from Sheet                                     ║
║   Extract row: O, M, P, PERT, sliders, curve JSON                ║
║                                                                    ║
║ Step B2: Render Baseline                                          ║
║   Parse JSON from columns 19-20                                   ║
║   Draw PDF + CDF on Chart.js canvases                             ║
║   Mark PERT value on x-axis                                       ║
║   Display P_baseline in KPI tile                                  ║
║                                                                    ║
║ Step B3: Initialize Sliders                                       ║
║   Populate 7 input fields with optimal values                     ║
║   Convert 0-1 →  0-100% / 0-50% UI format                        ║
║                                                                    ║
║ Step B4: Setup UI for Phase 3                                     ║
║   Enable target value input                                       ║
║   Enable manual slider adjustment                                 ║
║   Enable series toggle buttons                                    ║
╚═══════════════════════════════════════════════════════════════════╝
                           ↓
╔═══════════════════════════════════════════════════════════════════╗
║ PHASE 3: INTERACTIVE EXPLORATION (Plot UI)                       ║
║                                                                    ║
║ User explores:                                                     ║
║  1. Change target value from 15.83 to (e.g.) 18                   ║
║  2. Adjust sliders manually (e.g., increase scope certainty)      ║
║  3. Observe real-time distribution recalculation                  ║
║  4. Compare baseline vs. adjusted vs. optimization modes          ║
║                                                                    ║
║ For each manual slider change:                                    ║
║   Step C1: Convert UI → 0-1 internal format                       ║
║   Step C2: Call Core API (pmcEstimatorAPI) with new sliders      ║
║   Step C3: Apply SACO reshape:                                    ║
║     - Gaussian copula on new slider values                        ║
║     - Moment mapping: m0, m1                                      ║
║     - Beta refit: α', β'                                          ║
║     - Resample + smooth                                           ║
║   Step C4: Query CDF at target value                              ║
║   Step C5: Update KPIs and draw new "Adjusted" curve              ║
║   Step C6: Display feedback:                                      ║
║     - New probability at target                                   ║
║     - ΔProb from baseline                                         ║
║     - Percentile position on CDF                                  ║
║                                                                    ║
║ User compares 4 variants:                                          ║
║   - Baseline (green): Original PERT                                ║
║   - Adjusted (dark green): Manual sliders                          ║
║   - Fixed (purple): Coarse optimization                            ║
║   - Adaptive (orange): Deep optimization                           ║
║                                                                    ║
║ User gains insight:                                                ║
║   "If I set sliders to context X, target value Y has              ║
║    confidence level Z"                                            ║
║                                                                    ║
║ User makes decision:                                               ║
║   "Given project context (sliders), I'll commit to                ║
║    estimate of Z with P% confidence"                              ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## Key Architectural Insights

### 1. **Three-Phase Workflow is Integral**
- **Phase 1** (PERT): Automatic baseline establishment + optimization
- **Phase 2** (PLOT): Visualization of baseline to enable exploration
- **Phase 3** (Interactive): User explores context-slider-confidence relationships

Together, they create a complete **estimation → visualization → optimization** loop.

### 2. **Baseline is Sacred**
The smoothed Monte Carlo distribution from PERT:
- Represents the "learned uncertainty structure" from O,M,P
- Is locked in and never changed
- Serves as the reference point for ALL optimizations
- KL divergence penalty ensures optimizations stay "realistic" vs. baseline

This is key value: **SACO doesn't replace baseline; it recontextualizes it.**

### 3. **Two-Mode Optimization Maximizes Robustness**
- **Fixed (coarse):** Finds global structure quickly
- **Adaptive (deep):** Refines from Fixed's seed

Together they avoid local minima while maintaining speed.

### 4. **Percentile Repositioning, Not Amount Shifting**
Critical insight:
```
Baseline says: "22 days has 8.9% probability (28th percentile)"
Context says: "Clear scope + experienced team → lower actual risk"
SACO optimizes: "22 days now has 12.7% probability (35th percentile)"

Same value (22 days), higher confidence (28% → 35% percentile)
Why? Because context (sliders) supports higher confidence at that point.
```

Not "shift estimate by X days," but "adjust distribution shape to reflect context."

### 5. **Depth Levels Enable Speed/Precision Trade-off**
- Phase 1 PERT uses probeLevel=3 (balanced: 150ms, high quality)
- Phase 3 interactive uses local computation (fast, limited precision)
- Future: Could allow user to choose level (level 1 for quick, level 5+ for deep)

### 6. **Real-Time Feedback in Phase 3**
- No waiting for backend optimization
- Core API called with new sliders
- Instant SACO reshape and CDF query
- User sees live distribution change
- Enables exploratory "what-if" analysis

---

## Documentation Implications

This complete workflow reveals what previous SACO documents need to clarify:

### Already Correct ✅
- Gaussian copula theory and justification
- Moment mapping mathematics
- KL divergence safety mechanism
- Grid + COBYLA optimization strategy
- Method of moments for Beta fitting

### Needs Amplification ⚠️
- **Baseline**: Not just Beta parameters. It's the learned smoothed MC distribution from PERT.
- **Value realization**: O,M,P → PERT → Beta → MC (raw samples) → Smooth is a VALUE CREATION step
  - Creates structure that SACO then optimizes against
  - Respects original estimate intent while enabling context adaptation
- **Percentile repositioning**: Central concept, not "shifting mean by X"
- **Depth levels**: Explicit system with 0-7 scale, quality/speed tradeoffs
- **Real workflow**: Three integrated phases, not just optimization

---

## Code References

**Phase 1 PERT:**
- Trigger: Code.gs:223-234 (onOpen menu)
- Entry: Code.gs:957-1000 (pertRunAllRows/pertRunSelectedRows)
- Processing: Code.gs:1003-1228 (runTasks_, doSingleTask_)

**Phase 2 PLOT:**
- Trigger: Code.gs:236-242 (openPlotUi)
- UI: Plot.html (2552 lines)

**Phase 3 Interactive:**
- Slider adjustment: Plot.html (multiple sliderChange handlers)
- SACO reshape: Core API call (pmcEstimatorAPI)

---

## Next Steps

This document establishes the complete workflow. Which documentation would be most valuable?

1. **User-facing workflow guide** for practitioners using PERT → PLOT → Interactive?
2. **Implementation guide** for developers understanding Code.gs + Core + Plot.html integration?
3. **Update existing SACO documents** to emphasize percentile repositioning + baseline sacred concept?
4. **Depth level documentation** with explicit probeLevel 0-7 intensity specification?
5. **Something else** you prioritize?