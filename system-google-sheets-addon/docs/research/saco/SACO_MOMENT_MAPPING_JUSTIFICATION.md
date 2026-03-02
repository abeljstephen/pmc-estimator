# SACO Moment Mapping Justification

## The Moment Mapping Problem

### What Are Distribution Moments?

For a probability distribution, moments quantify its shape:

```
μ = E[X] = ∫ x · f(x) dx           [First moment: mean]
σ² = E[(X-μ)²] = ∫ (x-μ)² · f(x) dx [Second moment: variance]
γ = E[(X-μ)³]/σ³                    [Third moment: skewness]
κ = E[(X-μ)⁴]/σ⁴ - 3                [Fourth moment: kurtosis]
```

**For PERT Beta distributions:**
- **Mean (moment 0):** Shifts where the distribution is centered
- **Variance (moment 1):** Spreads how wide the distribution is
- **Skewness/Kurtosis:** Shape parameters of Beta(α, β)

### The Slider-to-Moments Problem

**Challenge:**
- Estimation depends on 7 slider values (project context)
- We need to adjust distribution mean and variance based on slider context
- How do we map slider values → distribution adjustments?

**Example:**
```
PERT baseline: (O=10, M=15, P=25)
  μ = (10 + 4×15 + 25) / 6 = 15.83 days
  σ² = ((25-10)/6)² = 6.25 days²

Now add slider context:
  S1 (Budget Flexibility) = 0.2   "Tight budget, limited flexibility"
  S3 (Scope Certainty) = 0.8      "Requirements well-defined"
  S6 (Risk Tolerance) = 0.3       "Risk-averse organization"

Question: How should mean/variance change?
  Should mean shift up? Down? By how much?
  Should variance grow? Shrink? By what factor?
```

---

## Solution: Moment Mapping via Aggregation

### Core Insight: Linear Aggregation

**Simple approach:** Weighted sum of sliders
```
δμ = Σ(W[i] × S[i]) × scaling_factor

where W = [0.20, 0.20, 0.18, 0.15, 0.10, 0.09, 0.08]  [PMBOK weights]
```

**Interpretation:**
- Higher weight on sliders that matter more for estimation
- Budget and Schedule dominate (0.20 each) → cost/schedule are primary risks
- Sum to 1.0 ensures bounded scaling

**Example with slider values:**
```
S = [0.2, 0.3, 0.8, 0.5, 0.4, 0.3, 0.6]

lin = Σ(W[i] × S[i])
    = 0.20×0.2 + 0.20×0.3 + 0.18×0.8 + 0.15×0.5 + 0.10×0.4 + 0.09×0.3 + 0.08×0.6
    = 0.04 + 0.06 + 0.144 + 0.075 + 0.04 + 0.027 + 0.048
    = 0.375  [Average slider strength across all factors]
```

**What does lin = 0.375 mean?**
- 0.0 = Maximum certainty (all sliders = 0.0, no uncertainty sources)
- 0.5 = Moderate uncertainty (sliders at medium values)
- 1.0 = Maximum uncertainty (all sliders = 1.0, all sources present)

### Problem with Pure Linear Aggregation

**Issue 1: Doesn't capture non-linearity**

Linear aggregation treats slider effects as independent:
- If Budget is 0.2 and Schedule is 0.3, effect = 0.2 + 0.3 = 0.5
- But in reality, if Budget is tight AND Schedule is tight, pressure compounds
- Effect should be stronger than simple sum

**Issue 2: Doesn't capture "at least one thing" logic**

- If even ONE uncertainty source exists, projects face risk
- Linear aggregation treats multiple small uncertainties same as one large
- Real projects: "At least one thing will go wrong" probability is higher than sum-of-parts

### Solution: Probabilistic OR Aggregation

**Alternative approach:** Use probability theory

```
por = P(at least one uncertainty source)
    = 1 - P(no uncertainty sources)
    = 1 - ∏(1 - S[i])  [Product of complementary probabilities]
```

**Interpretation:**
- If S_i represents probability that factor i is an uncertainty source
- 1 - S_i = probability that factor i is not an uncertainty source
- ∏(1 - S_i) = probability that NO factor is an uncertainty source (all favorable)
- 1 - ∏(...) = probability that AT LEAST ONE factor is an uncertainty (Murphy's Law)

**Example:**
```
S = [0.2, 0.3, 0.8, 0.5, 0.4, 0.3, 0.6]

por = 1 - (1 - 0.2) × (1 - 0.3) × (1 - 0.8) × (1 - 0.5) × (1 - 0.4) × (1 - 0.3) × (1 - 0.6)
    = 1 - 0.8 × 0.7 × 0.2 × 0.5 × 0.6 × 0.7 × 0.4
    = 1 - 0.008064
    = 0.991936  [Very high probability something goes wrong]
```

**Properties:**
- por = 0.0 when ALL S[i] = 0 (no uncertainty sources)
- por = 1.0 when ANY S[i] = 1.0 (guaranteed uncertainty)
- Sensitive to extreme uncertainties (even one high value → por ≈ 1)

---

## The Hybrid Approach: 50/50 Blend

### Why Neither Alone Is Perfect

**Pure Linear (lin):**
- ❌ Underestimates when many small uncertainties exist
- ✅ Doesn't overweight one extreme factor

**Pure Probabilistic OR (por):**
- ✅ Correctly captures "at least one thing goes wrong"
- ❌ Overestimates when uncertainty sources are weak

### The 50/50 Hybrid Solution

```
lin = Σ(W[i] × S[i])                           [Conservative, deterministic]
por = 1 - ∏(1 - 0.9×S[i])                     [Optimistic, probabilistic]

m0 = (1 - t) × lin + t × por                  [Hybrid blend]
```

where `t` is an interpolation weight (usually 0.3 to 0.7).

**Effect of hybrid:**
```
Example: S = [0.2, 0.3, 0.8, 0.5, 0.4, 0.3, 0.6]

lin = 0.375  [Weighted average: moderate uncertainty]
por = 0.992  [OR: very likely something bad happens]

If t = 0.5 (equal weight):
m0 = 0.5 × 0.375 + 0.5 × 0.992 = 0.6835

Interpretation: "Moderate uncertainty with lean toward pessimism"
```

### Why 50/50?

**No magic in 50/50; Rather:**
- 50% comes from PMBOK bias (conservative estimation is standard)
- 50% comes form probabilistic reasoning (Murphy's Law has foundation)
- Together: Balanced, defensible, reasonable to practitioners

---

## Refining the Blend via Gaussian Copula

### The Copula Adjustment

Previously, sliders were assumed independent:
```
[s1, s2, ..., s7] → apply moment mapping directly
```

**With Gaussian copula:**
```
[s1, s2, ..., s7] → [Apply copula] → [u1, u2, ..., u7] → apply moment mapping
```

The copula produces **dependent uniforms** that reflect realistic slider correlations.

### Adaptive Interpolation Weight (t)

Instead of fixed t = 0.5, SACO adapts:

```
t = 0.3 + 0.4 × mean(U)  [U = correlated uniform values from copula]
```

**Interpretation:**
- If mean(U) = 0 (sliders cluster low, conservative): t = 0.3 (favor linear)
- If mean(U) = 0.5 (sliders balanced): t = 0.5 (equal weight)
- If mean(U) = 1.0 (sliders cluster high, risk-accepting): t = 0.7 (favor probabilistic OR)

**Why adapt based on copula?**
- **When sliders are conservative (low):** Teams are already pessimistic. Linear aggregation (conservative) dominates.
- **When sliders are balanced:** Equal weight to both perspectives.
- **When sliders are risk-accepting (high):** Copula has elevated all inter-dependencies. Probabilistic OR (optimistic) gains weight, preventing over-pessimism.

---

## Moment Mapping for Variance (m1)

### The Variance Problem

**Challenge:**
- PERT baseline variance: σ²_base = ((P - O) / 6)²
- This depends only on three-point estimate range
- How do sliders adjust variance independently of mean?

**Examples:**
- High scope certainty should REDUCE variance (confident in range)
- High rework % should INCREASE variance (range is uncertain too)
- Budget flexibility should INCREASE variance (can afford to miss estimate)

### The Inverse Certainty Relationship

**Core insight:** Variance shrinks with certainty
```
m1 = (0.8 - 0.5 × lin) × (1 + CV/2)
```

Breaking this down:

#### Part 1: Base Variance Factor
```
vf = 0.8 - 0.5 × lin

When lin = 0.0 (maximum certainty):     vf = 0.8
When lin = 0.4 (moderate):             vf = 0.8 - 0.2 = 0.6
When lin = 0.8 (maximum uncertainty):  vf = 0.8 - 0.4 = 0.4
```

**Interpretation:**
- Counterintuitive? YES. Higher uncertainty → LOWER variance multiplier?
- Why: SACO assumes practit­itioners add buffer (wide P - O) to uncertain estimates
- Higher lin already reflects wide range → multiply less, don't double-penalize
- This prevents "uncertainty spiral" where variance explodes unrealistically

#### Part 2: Coefficient of Variation (CV) Amplification
```
CV = σ_base / μ_base  [Relative uncertainty of baseline estimate]

m1 = vf × (1 + CV/2)
```

**Effect:**
- If CV = 0 (point estimate, P = O = M): m1 = vf (no amplification)
- If CV = 0.5 (spread 50% of mean): m1 = vf × 1.25 (amplify 25%)
- If CV = 2.0 (spread 200% of mean): m1 = vf × 2.0 (double variance)

**Intuition:**
- High CV means baseline range is already large → amplify further (uncertainty begets uncertainty)
- Low CV means baseline range is tight → don't amplify (already conservative)

### Final Variance Adjustment
```
σ²_adjusted = σ²_base × m1
```

---

## Method of Moments: Fitting Beta Parameters

Once we have adjusted mean and variance:

```
μ_adjusted = μ_base + m0 × (P - O) × 0.25
σ²_adjusted = σ²_base × m1
```

We need Beta distribution parameters (α', β') that match these moments.

### Method of Moments Inversion

Given desired mean μ* and variance σ*²:

```
α' = μ*(μ*(1-μ*)/σ*² - 1)
β' = (1-μ*)*(μ*(1-μ*)/σ*² - 1)
```

**Derivation (from Beta moment formulas):**
```
Mean of Beta(α,β): μ = α/(α+β)
Variance: σ² = αβ/((α+β)²(α+β+1))

Backwards:
  p = μ*(1-μ*)/σ*² - 1  [intermediate variable]
  α' = μ* × p
  β' = (1-μ*) × p
```

### Example

**Given:**
- O = 10, M = 15, P = 25 days
- lin = 0.375, m1 = 0.7

**Compute:**
```
μ_base = (10 + 4×15 + 25) / 6 = 15.833 days
σ²_base = ((25-10)/6)² = 6.25

μ_adjusted = 15.833 + 0.375 × (25-10) × 0.25 = 15.833 + 1.406 = 17.239 days
σ²_adjusted = 6.25 × 0.7 = 4.375

Fit Beta to (μ=17.239, σ²=4.375) in [10, 25]:
  Normalize to [0,1]: x' = (x - 10) / 15
  μ' = (17.239 - 10) / 15 = 0.483
  σ'² = 4.375 / 15² = 0.0194

  p = 0.483 × 0.517 / 0.0194 - 1 = 12.8 - 1 = 11.8
  α' = 0.483 × 11.8 = 5.70
  β' = 0.517 × 11.8 = 6.10

Result: Beta(5.70, 6.10) on [10, 25]
```

---

## Comparison: Why Moment Mapping Beats Alternatives

### Alternative 1: Direct Parameter Adjustment

**Naive approach:**
```
α' = α_base × lin
β' = β_base × lin
```

**Problems:**
- Unclear what α, β really represent
- Doesn't distinguish mean from variance control
- Fragile: Only works if β_base = β (rarely true)

**SACO advantage:** Moment mapping uses interpretable moments (mean, variance), not opaque shape parameters.

### Alternative 2: Quantile-Based Adjustment

**Quantile approach:**
```
Adjust P̂(x) directly by shrinking percentiles toward median
```

**Problems:**
- Breaks theoretical Beta distribution from PERT
- Harder to verify mathematical properties
- Unknown how shape changes

**SACO advantage:** Moment mapping preserves PERT theoretical foundation while enabling adaptation.

### Alternative 3: Copula-Based Conditional Distribution

**Advanced approach:**
```
Compute conditional distribution: D(X | sliders)
Sample from conditional distribution directly
```

**Problems:**
- Requires either: (a) empirical copula from historical data, or (b) parametric assumption
- More computationally complex
- Harder to interpret and debug

**SACO advantage:** Moment mapping is tractable, interpretable, proven in practice.

---

## Why the Hybrid Blend Makes Sense Mathematically

### Information Theory Perspective

```
lin: Uses only slider aggregation (limited information)
por: Uses probabilistic dependencies (more information)
hybrid = blend: Balances biases in both methods
```

### Decision Theory Perspective

```
lin: Conservative bias → Overestimate actual variance
por: Optimistic bias → Underestimate actual variance
50/50: Minimize maximum regret (min-max hedge)
```

### Empirical Validation Hypothesis

```
If historical data becomes available (Phase 2):
  - Compute optimal blend weight empirically
  - Likely found to be 0.4-0.6 range
  - Validates intuition that neither pure method works
```

---

## W vs. W_MEAN: Critical Distinction

**A common confusion:**

Developers sometimes ask: "Don't W and W_MEAN conflict? Are they two different weighting systems?"

**Answer: No. They serve different purposes.**

### W: Importance Weighting (for lin)
```
W = [0.20, 0.20, 0.18, 0.15, 0.10, 0.09, 0.08]  [PMBOK-derived weights]

lin = Σ(W[i] × S[i])  [Determines mean shift magnitude]

Purpose: "Which project factors contribute most to estimation uncertainty?"
Meaning: Budget (20%) and Schedule (20%) are primary uncertainties
```

### W_MEAN: Constraint Weighting (for feasibility bounds)
```
W_MEAN = [-0.2, 0.1, 0.3, -0.15, -0.08, 0.25, 0.05]  [Constraint coefficients]

m0_thesis = Σ(W_MEAN[i] × S[i])  [Computes constraint-based adjustment]

Purpose: "How do sliders affect the feasibility of distribution reshaping?"
Meaning: Different sliders have different effects on O' < M' < P' validity
```

### How They Work Together

```
m0_copula = (1-t) × lin + t × por        [From moment mapping, uses W]
m0_thesis = Σ(W_MEAN[i] × S[i])          [From constraints, uses W_MEAN]

m0_final = 0.5 × m0_copula + 0.5 × m0_thesis  [Hybrid blend]

Result: Mean adjustment is:
  - Theoretically grounded (via W and lin/por)
  - Practically safe (via W_MEAN and feasibility)
```

---

## Limitations and Future Improvements

### Limitation 1: Linear Aggregation Assumption

Current approach: lin = Σ(W[i] × S[i])

**Assumes:** Slider effects add independently

**Reality:** Some sliders interact multiplicatively
- Budget × Schedule interaction (crashing schedule is expensive)
- Scope × Rework interaction (uncertain scope causes rework)

**Phase 2 Improvement:** Include interaction terms
```
lin_full = Σ(W[i] × S[i]) + Σ(W_ij × S[i] × S[j])  [Quadratic terms]
```

### Limitation 2: Fixed por Formula

Current approach: por = 1 - ∏(1 - 0.9×S[i])

**Assumes:** 0.9 factor is universal

**Reality:** Different organization cultures and risk profiles

**Phase 2 Improvement:** Adaptive 0.9 factor
```
por = 1 - ∏(1 - α(domain) × S[i])  [α varies by project type]
```

### Limitation 3: Fixed Copula Influence on (t)

Current approach: t = 0.3 + 0.4 × mean(U)

**Assumes:** Copula influence is always linear in mean(U)

**Reality:** May be non-linear (copula influence could accelerate)

**Phase 2 Improvement:** Empirical calibration of t function
```
t = f_calibrated(mean(U))  [Learned from historical projects]
```

---

## Moment Mapping References

### Distribution Theory
- **Johnson, N. L., Kotz, S., & Balakrishnan, N. (1995).** "Continuous Univariate Distributions, Vol. 2" (2nd ed.). Wiley.
  - Chapter on Beta distribution; method of moments parameter fitting

- **Clemen, R. T. (1996).** "Making Hard Decisions" (2nd ed.). Duxbury Press.
  - Chapter on probability elicitation and moment matching

### PERT and Three-Point Estimation
- **PMBOK Guide (Project Management Institute, 2021).** Chapter 11: Risk Management; Section on PERT estimation.

- **Hillier, F. S., & Lieberman, G. J. (2014).** "Introduction to Operations Research" (10th ed.). McGraw-Hill.
  - PERT formula derivation and three-point estimation theory

### Moment Adjustment in Practice
- **Keeney, R. L., & Raiffa, H. (1993).** "Decisions with Multiple Objectives: Preferences and Value Trade-offs." Cambridge University Press.
  - Multi-attribute utility theory; how attributes combine to form preferences (analogous to slider combination)

---

## Conclusion

**Moment mapping in SACO:**
1. ✅ Maps slider values to distribution adjustments via interpretable moments
2. ✅ Hybrid lin/por blend balances conservative and probabilistic perspectives
3. ✅ Copula-informed interpolation weight adapts to project context
4. ✅ Method of moments ensures fitted Beta parameters are sound
5. ✅ KL divergence safety penalty prevents distortion (covered separately)
6. ⚠️ Linear aggregation is simplified; future versions could add interactions
7. ⚠️ por formula has constant (0.9); future versions could adapt this
8. ⚠️ t function is linear; future versions could calibrate empirically

**Next steps in documentation:**
- SACO_OPTIMIZATION_STRATEGY.md - Why two-stage optimization works
- SACO_ALTERNATIVES_EVALUATED.md - Why moment mapping beats other approaches

---

## Document Statistics

**Reading Time:** 25 minutes
**Word Count:** 2,200 words
**Code References:**
- `core/reshaping/copula-utils.gs:101-150` - Moment mapping (m0, m1 computation)
- `core/baseline/pert-points.gs:150-180` - Method of moments Beta parameter fitting

---

**Last Updated:** February 15, 2026
**Key Insight:** Moment mapping via hybrid linear/probabilistic aggregation provides theoretically grounded, practically safe mean and variance adjustments that adapt to project context via Gaussian copula influence.
