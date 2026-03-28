# SACO Improvements Without Empirical Data

## Context: SACO Phase 1 Limitations

SACO in Phase 1 is:
- ✅ Theoretically grounded in copula theory, PMBOK guidance
- ✅ Computationally efficient and robust
- ✅ Safe (KL divergence penalty prevents unrealistic distortion)
- ⚠️ Research-based (weights derived from PMBOK, not empirical data)
- ⚠️ Fixed correlation matrix (BASE_R doesn't adapt by project type)
- ⚠️ Linear moment aggregation (doesn't capture non-linear slider interactions)
- ⚠️ Single copula family (Gaussian; doesn't test alternatives)

**Question:** "What improvements can be made WITHOUT historical data?"

**Answer:** Six major improvements that enhance SACO using only research, theory, and expert judgment.

---

## Improvement 1: Adaptive Correlation Matrix (BASE_R) by Project Domain

### Current Approach
```
BASE_R = fixed 7×7 matrix (same for all project types)

Used for all:
  - Software development
  - Construction
  - Pharmaceutical trials
  - Internal IT projects
  - Vendor engagements
```

### Problem
```
Software vs. Construction have very different characteristics:
  - Software: Schedule ↔ Budget (highly coupled, "pay more to accelerate")
  - Construction: Budget ↔ Materials (moderately coupled, materials don't accelerate)

Same BASE_R doesn't reflect these differences
```

### Improvement: Domain-Specific BASE_R Matrices

**Research step (no data needed):**

```
1. Interview domain experts in each area
   - "How do you expect sliders to correlate in software projects?"
   - "How about in construction?"
   - "How about in research projects?"

2. Build domain-specific correlation matrices
   - BASE_R_SOFTWARE with software-specific dependencies
   - BASE_R_CONSTRUCTION with construction-specific dependencies
   - BASE_R_RESEARCH with research-specific dependencies

3. Document reasoning in research papers (citable, defensible)

4. Let users select domain at estimation time
```

**Example domain-specific correlations:**

```
SOFTWARE (BASE_R_SW):
  Budget ↔ Schedule: +0.90  [Accelerating = expensive]
  Scope ↔ Schedule: +0.70   [Scope creep delays = high correlation]
  Rework ↔ Risk Tolerance: +0.75  [Quality risks high in agile]

CONSTRUCTION (BASE_R_CONST):
  Budget ↔ Schedule: +0.65  [Less coupled; materials don't accelerate costs linearly]
  Scope ↔ Schedule: +0.55   [Changes have lower schedule impact]
  Rework ↔ Risk Tolerance: +0.45  [Rework planned separately; less coupled to risk appetite]

RESEARCH (BASE_R_RESEARCH):
  Budget ↔ Schedule: +0.40  [Research can use idle budget; not directly linked]
  Scope ↔ Schedule: +0.85   [Scope changes = major schedule impact]
  Rework ↔ Risk Tolerance: +0.90  [R&D projects expect high rework; risk tolerance crucial]
```

### Implementation Effort
- Research: 20 hours (literature review + expert interviews)
- Implementation: 5 lines of code (select BASE_R based on domain)
- Validation: Documented in research paper

### Expected Impact
- ✅ More realistic dependencies by domain
- ✅ Domain-specific estimates
- ✅ Aligns with practitioner intuition
- ❌ Still expert-derived (not empirical)

---

## Improvement 2: Multi-Target Optimization

### Current Approach
```
Objective = ||moment_error||² + λ × exp(-KL)

Minimize: Single scalar objective
```

### Limitation
```
Single objective asks: "Match moments AND don't distort baseline"

But projects have multiple goals:
  - Minimize Brier score (forecast accuracy)
  - Maximize feasibility (stay in O,M,P bounds)
  - Minimize coverage interval (narrow confidence interval)
  - Maximize interpretability (distribution shape reasonable)
```

### Improvement: Pareto Multi-Objective Optimization

**Research approach:**

```
Step 1: Define multiple objectives
  f₁(α,β) = ||moment_error||²          [Match targets]
  f₂(α,β) = KL divergence              [Stay realistic]
  f₃(α,β) = CV (coefficient of variation)  [Distribution spread]
  f₄(α,β) = skewness                   [Shape reasonableness]

Step 2: Use Pareto front approach
  "Find parameter sets where you can't improve one objective
   without worsening another"

Step 3: Let user select trade-off
  - Conservative user: "Prefer small KL (stay close to baseline)"
  - Aggressive user: "Prefer small moment error (match target)"

Step 4: Return Pareto-optimal set, not single point
```

**Example Pareto Front:**

```
        KL Divergence (stay realistic)
        ↑
   0.5  |
        |     * (good feasibility, ok moments)
   0.3  |   *   *
        | *       * (close baseline, but miss moments)
   0.1  |
        |
        └──────────────────────────→
              Moment Error
```

### Implementation Effort
- Research: 15 hours (Pareto front methods, NSGA-II algorithm)
- Implementation: 20 lines (multi-objective loop + front extraction)
- Validation: Mathematical proof that set is Pareto-optimal

### Expected Impact
- ✅ Transparency: Users see trade-offs explicitly
- ✅ Flexibility: Choose conservative vs. aggressive
- ✅ Robustness: Multiple solutions available if one fails
- ⚠️ Complexity: Requires choosing from multiple options (vs. single answer)

---

## Improvement 3: Real-Time Slider Sensitivity Analysis

### Current Approach
```
Give sliders to system → Get distribution
No feedback on which sliders matter
```

### Improvement: Morris Screening Sensitivity Analysis

**Approach (no data needed):**

```
Step 1: Fix 6 sliders at baseline values
Step 2: Vary one slider across [0.0, 0.5, 1.0]
Step 3: Measure impact on distribution moments
Step 4: Repeat for each slider
Step 5: Rank sliders by impact magnitude

Result: "Which sliders actually move the estimate?"
```

**Example output:**

```
Slider                Impact on Mean      Impact on Variance
──────────────────────────────────────────────────────────────
1. Budget Flex         ✓✓✓✓✓ (0.35)       ✓✓✓✓  (0.28)
2. Schedule Flex       ✓✓✓✓✓ (0.32)       ✓✓✓✓  (0.26)
3. Scope Certainty     ✓✓✓✓  (0.28)       ✓✓✓✓✓ (0.31)
4. Scope Reduction     ✓✓✓   (0.18)       ✓✓✓   (0.15)
5. Rework %            ✓✓    (0.10)       ✓✓    (0.12)
6. Risk Tolerance      ✓✓    (0.09)       ✓✓    (0.11)
7. User Confidence     ✓     (0.08)       ✓     (0.06)
```

**Interpretation for practitioners:**
```
"Sliders 1-3 matter most. Sliders 6-7 barely move the estimate.
 Consider dropping 7 if you want simplified interface."
```

### Implementation Effort
- Research: 5 hours (Morris screening documentation)
- Implementation: 10 lines (sensitivity loop + ranking)
- Validation: Verify that sensitivity ranking matches W weights

### Expected Impact
- ✅ Transparency: Users understand which inputs matter
- ✅ User interface simplification: Drop unimportant sliders
- ✅ Validation: Check if PMBOK weights align with impact
- ✓ Educational: Teaches practitioners about problem structure

---

## Improvement 4: Non-Stationary Slider Weights

### Current Approach
```
W = [0.20, 0.20, 0.18, 0.15, 0.10, 0.09, 0.08]  [PMBOK-derived, fixed]

lin = Σ(W[i] × S[i])  [Same for all sliders]
```

### Limitation
```
PMBOK provides ranges (not exact values):
  Budget: 15-25% not specifically 20%
  Schedule: 15-25% not specifically 20%

Maybe weights should vary by:
  - Project type (software different from construction)
  - Project phase (early planning vs. detailed design)
  - Organization size (startup vs. enterprise)
```

### Improvement: Research-Based Weight Families

**Research approach (no data needed):**

```
Step 1: Literature scan
  "What do other PM frameworks weight?"
  - COCOMO: Complexity 45%, Effort 25%, Risk 10%, Other 20%
  - Construction: Labor 25%, Materials 20%, Equipment 20%, Risk 20%, OH 15%
  - Agile: Complexity 40%, Effort 35%, Risk 15?, Dependencies 10%

Step 2: Build weight families
  W_AGGRESSIVE = [0.25, 0.25, 0.15, 0.15, 0.10, 0.05, 0.05]
  W_CONSERVATIVE = [0.20, 0.20, 0.25, 0.15, 0.10, 0.05, 0.05]
  W_BALANCED = [0.20, 0.20, 0.18, 0.15, 0.10, 0.09, 0.08]  [Current]

Step 3: Documentation for each family
  "Choose based on:"
  - Risk profile of project
  - Organizational culture
  - Historical outcomes

Step 4: Let user select weight family when estimating
```

**Example weight families:**

```
AGGRESSIVE (Fast delivery, accept variance):
  W = [0.25, 0.25, 0.10, 0.10, 0.10, 0.10, 0.10]
  → Emphasizes budget & schedule flexibility
  → Deemphasizes scope certainty

BALANCED (PMBOK baseline):
  W = [0.20, 0.20, 0.18, 0.15, 0.10, 0.09, 0.08]
  → Equal emphasis across factors

CONSERVATIVE (Quality/Scope driven):
  W = [0.15, 0.15, 0.25, 0.20, 0.10, 0.10, 0.05]
  → Emphasizes scope certainty & scope reduction
  → Budget/schedule less important
```

### Implementation Effort
- Research: 10 hours (weight family documentation)
- Implementation: 5 lines (user selects W family)
- Validation: Cite sources for each family

### Expected Impact
- ✅ Flexibility: Users choose weight philosophy
- ✅ Documentation: Clear rationale for each W choice
- ✅ Alignment: Matches organization culture

---

## Improvement 5: Alternative Distributions for Testing

### Current Approach
```
Everything outputs Beta distribution
(chosen for PERT three-point estimates)
```

### Alternative Distributions to Research

**1. Kumaraswamy Distribution**
```
CDF: F(x) = 1 - (1-x^α)^β  on [0,1]

Advantages:
  - Closed-form CDF (easier than Beta)
  - Similar flexibility (two parameters like Beta)
  - Steeper tails than Beta (captures outlier risk better?)

Research question: "Does Kumaraswamy better capture project estimation outliers?"
```

**2. Johnson SU Distribution**
```
Unbounded, highly flexible, can match Beta characteristics
Can also model unbounded estimates (if projects can exceed P)

Research question: "When should we allow distribution tails beyond [O,P]?"
```

**3. Transformed Beta (Power Transformation)**
```
Y = X^λ where X ~ Beta
(Box-Cox style transformation)

Research question: "Do project estimates follow non-linear scales?"
```

### Research Approach

```
Step 1: Literature scan
  "What do estimation frameworks use?"
  - PMBOK: Beta (standard)
  - Software engineering: Beta (standard)
  - Insurance: Lognormal (for claims)
  - Construction: Gamma (for durations)

Step 2: Build case for each alternative
  "When is Kumaraswamy better than Beta?"
  "When is Johnson SU justified?"

Step 3: Compare via moment-matching
  "For same first 2 moments, how different are distributions?"

Step 4: Create documented comparison table
  Scenario                 β           Kumaraswamy    Johnson SU
  ─────────────────────────────────────────────────────────────
  Narrow estimate          Good        Similar        Overkill
  Wide estimate (outliers) Good        Better?        Maybe?
  Skewed estimates         Fair        Good?          Good

Step 5: Recommendation
  "Use Beta by default; consider Kumaraswamy for high-outlier projects"
```

### Implementation Effort
- Research: 15 hours (distribution comparison, moment matching theory)
- Implementation: 20 lines (alternative distribution PDFs/CDFs + selection logic)
- Validation: Mathematical proof that alternatives match moments when configured

### Expected Impact
- ✅ Research advancement: Documents when alternatives beat Beta
- ✅ Better estimates: Some project types might benefit from non-Beta
- ✓ Literature grounding: Cited papers for each alternative
- ⚠️ Complexity: More to validate and maintain

---

## Improvement 6: Uncertainty Quantification in SACO Outputs

### Current Approach
```
Input: Sliders S = [s₁, ..., s₇]
Output: Distribution Beta(α', β')
Confidence: Not specified
```

### Gap
```
How confident are we that the output distribution is "correct"?
  - Gaussian copula assumption: How sensitive to BASE_R changes?
  - Moment mapping formula: How sensitive to lin/por blend?
  - Optimization: How sensitive to initial grid point?
```

### Improvement: Local Sensitivity Analysis at Output

**Research approach:**

```
Step 1: After computing optimal β' = (α', β'), perform sensitivity
Step 2: Vary inputs slightly (±5-10%)
  - Vary BASE_R entries
  - Vary moment mapping weights
  - Vary KL divergence penalty λ
Step 3: Recompute distributions for perturbed inputs
Step 4: Quantify output distribution family (σ of new parameters)
Step 5: Report confidence as credible interval on (α', β')

Example output:
  "Best estimate: Beta(4.8, 3.2)
   95% credible range: Beta(4.2, 2.9) to Beta(5.4, 3.5)
   [Range reflects uncertainty in Copula and moment mapping assumptions]"
```

### Implementation Effort
- Research: 10 hours (Sobol sampling, local sensitivity documentation)
- Implementation: 15 lines (re-evaluate 20 perturbed parameter sets)
- Validation: Check that credible intervals contain true optimal for test cases

### Expected Impact
- ✅ Transparency: Users know actual confidence
- ✅ Risk management: Wide credible interval → hedge estimate
- ✅ Research grounding: Uncertainty propagation is standard in science

---

## Improvement 7: Documentation-Only - Clearer Guidance on Slider Interpretation

### Current Approach
```
Slider values [0.0, 1.0] with general guidance
```

### Improvement: Detailed Slider Interpretation Guide

**Research approach (pure documentation):**

```
Create interpretation guide:
  - Slider 1 (Budget Flexibility)
    * 0.0 = Hard budget constraint, project dies if over budget
    * 0.25 = Some flexibility, 5-10% overflow acceptable
    * 0.5 = Moderate flexibility, 20% overflow acceptable
    * 0.75 = High flexibility, can reallocate budget as needed
    * 1.0 = Unlimited budget, no financial constraint

  - Slider 2 (Schedule Flexibility)
    * 0.0 = Firm deadline, market/contract dependent, no slip
    * 0.25 = Slight slip possible (±5 days for 6-month project)
    * 0.5 = Moderate slip possible (±10% of duration)
    * ...

  - [Repeat for all 7 sliders]

Create scenarios:
  "Software project, well-defined scope, tight deadline"
  → Recommended sliders: [0.2, 0.2, 0.8, 0.5, 0.3, 0.3, 0.7]
  → Because: ...explanation...

Create domain guides:
  "For construction projects, typically..."
  → Budget flexibility is lower (contracts are fixed)
  → Schedule flexibility varies (weather delays change this)
  → ...
```

### Implementation Effort
- Research: 5 hours (domain guidance synthesis)
- Implementation: 0 lines (pure documentation)
- Validation: Expert review by practitioners

### Expected Impact
- ✅ User understanding: Practitioners know what sliders mean
- ✅ Consistency: Teams align on interpretation
- ✅ Adoption: Users confident adjusting sliders

---

## Summary: Improvement Effort and Impact

| Improvement | Effort (h) | Implementation | Data Needed? | Impact |
|------------|-----------|---|----------|---------|
| 1. Domain-specific BASE_R | 25 | Simple | ✗ No | High |
| 2. Pareto multi-objective | 35 | Medium | ✗ No | High |
| 3. Sensitivity analysis | 15 | Simple | ✗ No | Medium |
| 4. Weight families | 15 | Simple | ✗ No | Medium |
| 5. Alternative distributions | 35 | Medium | ✗ No | Medium |
| 6. Uncertainty quantification | 25 | Medium | ✗ No | Medium |
| 7. Slider interpretation guide | 5 | Documentation | ✗ No | High |
| **TOTAL** | **155 hours** | **~70-80 lines** | **No historical data** | **Significant** |

---

## Prioritized Roadmap for Improvements

### Phase 1 (Existing SACO)
- Current implementation with single BASE_R, fixed W, single objective

### Phase 1.5 (Quick Wins) - Effort: 40 hours
1. ✅ Add slider interpretation guide (#7)
2. ✅ Add Morris sensitivity analysis (#3)
3. ✅ Document weight families, let user select (#4)

**Why:** Low effort, high clarity impact

### Phase 2 (After validation) - Effort: 45 hours
1. ✅ Build domain-specific BASE_R matrices (#1)
2. ✅ Research alternative distributions (#5)
3. ✅ Add uncertainty quantification (#6)

**Why:** Benefit from empirical insights, build on Phase 1 results

### Phase 3 (Advanced) - Effort: 35 hours
1. ✅ Implement Pareto multi-objective optimization (#2)

**Why:** Highest effort; reward comes when users want flexibility

---

## Conclusion

**6 major research-backed improvements** can be implemented WITHOUT historical data:

1. Domain-specific correlation matrices
2. Multi-objective Pareto optimization
3. Real-time sensitivity analysis
4. Alternative weight families
5. Non-Beta distributions
6. Uncertainty quantification

**Expected total effort:** 155 hours research + 70-80 lines implementation

**Expected benefit:** Significantly enhanced SACO with better user control, transparency, and applicability across domains.

**No empirical data required** if grounded in research and expert judgment.

---

## Document Statistics

**Reading Time:** 30 minutes
**Word Count:** 2,400 words
**Code References:**
- `core/reshaping/copula-utils.gs` - Where domain-specific BASE_R selection would go
- `core/optimization/kl-divergence.gs` - Where multi-objective would extend
- New files needed: `core/sensitivity-analysis.gs`, `core/alternatives.gs`

---

**Last Updated:** February 15, 2026
**Key Insight:** SACO can be significantly enhanced through research-driven improvements without requiring historical project data. The improvements span from simple (documentation) to complex (multi-objective optimization), offering a prioritized roadmap for continued development.
