# PROVISIONAL PATENT APPLICATION

**Title of Invention:**
SHAPE-ADAPTIVE COPULA OPTIMIZATION (SACO): A SYSTEM AND METHOD FOR
CONTEXT-AWARE PROBABILISTIC PROJECT DURATION ESTIMATION USING
GAUSSIAN COPULA MOMENT MAPPING WITH KL-DIVERGENCE CONSTRAINT

**Inventor:**
Abel J. Stephen
iCareNOW.io

**Date of First Reduction to Practice:** March 2, 2026

**Filing Type:** Provisional Patent Application
**Subject Matter:** Computer-Implemented Method and System

---

## CROSS-REFERENCE TO RELATED APPLICATIONS

Not applicable.

---

## FIELD OF THE INVENTION

This invention relates to probabilistic project estimation systems, and
more specifically to a computer-implemented system and method for
context-aware reshaping of project duration probability distributions
using a multi-dimensional slider framework, Gaussian copula dependency
modeling, hybrid moment mapping, two-stage constrained optimization, and
Kullback-Leibler divergence-bounded distribution adjustment.

---

## BACKGROUND OF THE INVENTION

### The Problem With Standard PERT and Monte Carlo

Program Evaluation and Review Technique (PERT) is the dominant
probabilistic project estimation method. Given three values — Optimistic
(O), Most Likely (M), and Pessimistic (P) — PERT approximates the
distribution of project duration as a Beta distribution with:

    Mean (μ) = (O + 4M + P) / 6
    Variance (σ²) = ((P - O) / 6)²

Monte Carlo simulation extends PERT by sampling from this distribution
thousands of times to produce a probability density function (PDF) and
cumulative distribution function (CDF), enabling statements like:
"There is a 90% probability of completing within 22 days."

**Critical limitation:** Standard PERT and Monte Carlo are completely
context-blind. Given the same three-point estimate (O, M, P), the method
produces identical probability outputs regardless of:

- Whether the project budget has flexibility to absorb overruns
- Whether the delivery schedule is rigid or negotiable
- Whether requirements are firmly defined or subject to change
- Whether the team expects significant rework
- The organization's historical risk tolerance
- The practitioner's own confidence in their estimate

Two projects with identical O, M, P values but radically different
risk profiles receive identical probability outputs under standard PERT.
This is widely recognized as a deficiency in the project management
literature (PMI PMBOK Guide, 7th Ed.) but no systematic computational
solution has been published.

### Existing Approaches and Their Limitations

**Parametric adjustment (ad hoc buffers):** Practitioners manually add
buffer to P. This is subjective, inconsistent, and does not produce
a principled probability redistribution.

**Bayesian updating:** Requires historical project data to form prior
distributions. Most organizations lack sufficient historical data, and
the data is rarely standardized enough to use directly.

**Neural network surrogates:** Require training data, are black boxes
with no theoretical justification, and suffer from overfitting. They
cannot be validated against first principles.

**Fuzzy logic systems:** Less principled than probabilistic approaches
and harder to validate or audit.

**Quantile-based adjustment:** Breaks the PERT foundation by abandoning
the three-point estimate structure.

**Wasserstein distance:** More computationally complex than KL divergence
with similar results; impractical in browser/cloud environments.

**Empirical copulas:** Require 30–100 historical projects with consistent
measurement. Not feasible for general-purpose project estimation.

No prior system has combined Gaussian copula dependency modeling,
hybrid probabilistic moment mapping, and KL divergence-bounded
two-stage optimization into a unified, data-free distribution
reshaping framework for project duration estimation.

---

## SUMMARY OF THE INVENTION

The present invention, termed **Shape-Adaptive Copula Optimization
(SACO)**, is a computer-implemented system and method that addresses the
context-blindness of standard PERT/Monte Carlo estimation by:

1. **Accepting a PERT three-point estimate** (O, M, P) as the baseline
   uncertainty model, preserving the practitioner's learned judgment.

2. **Accepting seven project characteristic parameters** (sliders)
   representing budget flexibility, schedule flexibility, scope certainty,
   scope reduction allowance, rework percentage, risk tolerance, and user
   confidence.

3. **Modeling realistic dependencies** between the seven parameters using
   a Gaussian copula with a project-management-theoretic correlation
   matrix, rather than assuming independence.

4. **Computing adjusted distribution moments** via a hybrid function
   combining linear weighted aggregation and probabilistic disjunction
   (Murphy's Law formulation), with the interpolation weight dynamically
   determined by the copula coupling coefficient.

5. **Applying a two-stage optimization** (Latin Hypercube Sampling global
   search followed by COBYLA local refinement) to find the slider
   configuration that maximizes the probability of completion at the
   target value subject to a Kullback-Leibler divergence constraint.

6. **Repositioning the target value's percentile** within the reshaped
   distribution without modifying the original O, M, P estimate values —
   producing higher confidence at the same estimate when project context
   supports it.

**Key insight:** SACO does not change the point estimate. It
recontextualizes confidence at that estimate based on project
characteristics. A practitioner who estimates 22 days receives not just
a single probability but a context-adjusted probability that reflects
whether their project has the flexibility, certainty, and risk profile
to support higher or lower confidence in that number.

---

## BRIEF DESCRIPTION OF DRAWINGS

**FIG. 1** — System architecture diagram showing the seven-layer SACO
pipeline from user input to reshaped probability distribution.

**FIG. 2** — The seven-dimensional project characteristic slider
interface showing normalized [0,1] parameter space.

**FIG. 3** — Gaussian copula correlation matrix (BASE_R) with
project-management-theoretic cross-dimensional dependencies.

**FIG. 4** — Hybrid moment mapping diagram showing the linear
aggregation path, probabilistic disjunction path, and copula-weighted
interpolation producing m0 (mean adjustment) and m1 (variance
adjustment).

**FIG. 5** — Two-stage optimization flow: Latin Hypercube Sampling
(global exploration) → COBYLA local refinement, with KL divergence
penalty in the objective function.

**FIG. 6** — Percentile repositioning illustration: same target value
(22 days) moves from 90th to 95th percentile as project context
improves, with baseline distribution preserved.

**FIG. 7** — KL divergence safety tether: graphical illustration of
maximum allowed reshaping (~5%) relative to baseline distribution.

**FIG. 8** — Full user interface of the PMC Estimator Google Sheets
Add-on implementing SACO, showing PDF/CDF charts, slider panel,
target query, and report system.

---

## DETAILED DESCRIPTION OF THE INVENTION

### I. SYSTEM OVERVIEW

The SACO system is implemented as a software pipeline executable in
cloud or browser environments. In the preferred embodiment, the system
operates as a Google Workspace Add-on within Google Sheets, but the
method is platform-independent and applicable to any computing
environment capable of floating-point arithmetic and basic linear
algebra operations.

The pipeline consists of seven sequential computational stages:

    Stage 1: Baseline Generation
    Stage 2: Latin Hypercube Sampling
    Stage 3: Warm Start (Grid Evaluation)
    Stage 4: Grid Search
    Stage 5: COBYLA Refinement
    Stage 6: Feasibility and Robustness
    Stage 7: Output and Probability Computation

Each stage is described in detail below.

---

### II. INPUT PARAMETERS

#### A. Three-Point Estimate (PERT Basis)

The system accepts three scalar inputs representing the practitioner's
duration estimate:

    O = Optimistic duration (units: days, hours, weeks, or any linear unit)
    M = Most Likely duration
    P = Pessimistic duration
    Constraint: O ≤ M ≤ P

These define the PERT baseline distribution:

    μ_base = (O + 4M + P) / 6         [PERT mean]
    σ²_base = ((P - O) / 6)²          [PERT variance]

#### B. Target Value (τ)

A scalar value τ within or near the range [O, P] at which the system
computes P(duration ≤ τ). The target may also be expressed as a
probability (inverse query mode), in which case the system returns
the value τ achieving that probability.

#### C. Seven Project Characteristic Parameters (The Slider Vector)

The system accepts a seven-dimensional vector **S** = (S₁, S₂, S₃, S₄,
S₅, S₆, S₇) where each component is normalized to [0, 1]:

    S₁ = Budget Flexibility
         [0 = fixed budget, no overrun tolerance]
         [1 = fully flexible budget]
         Weight w₁ = 0.20 (PMBOK cost management importance)

    S₂ = Schedule Flexibility
         [0 = hard deadline, no slip allowed]
         [1 = fully negotiable delivery date]
         Weight w₂ = 0.20 (PMBOK schedule management importance)

    S₃ = Scope Certainty
         [0 = requirements undefined, high change likelihood]
         [1 = requirements frozen, no scope creep expected]
         Weight w₃ = 0.18 (PMBOK scope management importance)

    S₄ = Scope Reduction Allowance
         [0 = all scope is mandatory]
         [1 = large fraction of scope is negotiable/deferrable]
         Weight w₄ = 0.15

    S₅ = Rework Percentage
         [0 = no rework expected]
         [0.5 = 50% of work expected to be redone]
         Weight w₅ = 0.10
         NOTE: Rework is a negative factor; higher S₅ degrades distribution

    S₆ = Risk Tolerance
         [0 = risk-averse organization]
         [1 = high risk tolerance]
         Weight w₆ = 0.09

    S₇ = User Confidence
         [0 = practitioner has low confidence in their estimate]
         [1 = practitioner has high confidence in their estimate]
         Weight w₇ = 0.08

    Constraint: Σwᵢ = 1.00

The weights are derived from the Project Management Body of Knowledge
(PMBOK Guide, 7th Edition) relative importance of project knowledge
areas.

---

### III. STAGE 1 — BASELINE DISTRIBUTION GENERATION

From the three-point estimate, the system generates a discrete
probability density function (PDF) and cumulative distribution function
(CDF) representing the PERT baseline using Monte Carlo simulation with
smoothing.

**Process:**
1. Sample N = 100,000 values from Beta(α, β) fitted to (O, M, P)
2. Build histogram with adaptive bin width
3. Apply Gaussian kernel smoothing (σ_kernel = 0.5 × bin_width)
4. Normalize so that ∫PDF dx = 1.0
5. Compute CDF by trapezoidal integration of smoothed PDF

This baseline PDF/CDF is stored and used as the reference distribution
for KL divergence computation in Stage 5.

---

### IV. STAGE 2 — LATIN HYPERCUBE SAMPLING (Global Exploration)

The system generates N quasi-random sample points in [0,1]⁷ using
Latin Hypercube Sampling (LHS), which ensures uniform coverage of the
7-dimensional parameter space without clustering.

    n = f(probeLevel, adaptiveMode, CV, skewness)

Where probeLevel ∈ {0,1,2,3,4,5,6,7} controls the exploration
depth (n ranging from 50 to 250 samples). In adaptive mode, the
sampling is biased toward regions of the parameter space likely to
produce higher probability gains, based on the coefficient of variation
(CV) and skewness of the baseline distribution.

**LHS Algorithm:**
For each dimension d ∈ {1,...,7}:
1. Divide [0,1] into n equal intervals
2. Randomly sample once from each interval
3. Randomly permute the n samples across dimensions
4. Result: n points each covering every stratum exactly once

This guarantees no two sample points share the same interval in any
dimension, providing better coverage than pure random sampling for
optimization warm starts.

---

### V. STAGE 3–4 — GRID SEARCH AND WARM START

For each of the n LHS sample points **s** = (s₁,...,s₇), the system
evaluates the SACO objective function (described in Section VIII) and
retains the highest-scoring point as the warm start for local refinement.

The grid search identifies the global basin of attraction without
committing computational resources to local gradient descent from
a potentially poor starting point.

---

### VI. STAGE 5 — COBYLA LOCAL REFINEMENT

Starting from the warm-start point identified in Stage 4, the system
applies the COBYLA (Constrained Optimization BY Linear Approximation)
algorithm to find the local optimum of the SACO objective function.

COBYLA is a gradient-free method suitable for:
- Non-smooth objective functions
- Black-box function evaluations
- Bound-constrained optimization without derivative computation

**COBYLA parameters:**
- Initial trust region radius: ρ_init = 0.5
- Final trust region radius: ρ_final = 1×10⁻⁵
- Maximum iterations: 20–100 (function of probeLevel)
- Bounds: sᵢ ∈ [0,1] for all i ∈ {1,...,7}

---

### VII. GAUSSIAN COPULA DEPENDENCY MODELING

#### A. Motivation

Standard aggregation of the seven slider parameters assumes
independence — that budget flexibility does not correlate with schedule
flexibility, that scope certainty does not correlate with rework
percentage, etc. This assumption is false in practice.

SACO models realistic dependencies between the seven project
characteristic parameters using a Gaussian copula with a theoretically
derived correlation matrix.

#### B. The Base Correlation Matrix (BASE_R)

The system uses the following 7×7 symmetric positive-definite correlation
matrix derived from project management theory (PMBOK guidance on
knowledge area interdependencies):

              BUD    SCH    SC     SRA    RWK    RISK   CONF
    BUD  [ 1.00,  0.40,  0.10,  0.05,  0.00, -0.05,  0.05 ]
    SCH  [ 0.40,  1.00,  0.10,  0.05,  0.00, -0.05,  0.05 ]
    SC   [ 0.10,  0.10,  1.00,  0.35, -0.10,  0.00,  0.00 ]
    SRA  [ 0.05,  0.05,  0.35,  1.00, -0.05,  0.00,  0.00 ]
    RWK  [ 0.00,  0.00, -0.10, -0.05,  1.00, -0.10, -0.10 ]
    RISK [-0.05, -0.05,  0.00,  0.00, -0.10,  1.00,  0.25 ]
    CONF [ 0.05,  0.05,  0.00,  0.00, -0.10,  0.25,  1.00 ]

**Key correlations and their theoretical basis:**

- BUD ↔ SCH = +0.40: Budget and schedule are positively correlated
  (cost-time trade-off; PMBOK Integration Management)

- SC ↔ SRA = +0.35: Clear scope implies more negotiable scope
  (well-defined work packages enable scope decomposition)

- SC ↔ RWK = -0.10: Certain scope implies less rework
  (ambiguous requirements drive iteration cycles)

- RISK ↔ CONF = +0.25: Higher risk tolerance correlates with
  practitioner confidence (experienced practitioners accept uncertainty)

- BUD ↔ RISK = -0.05: Budget-constrained projects have lower risk
  tolerance (financial pressure reduces risk appetite)

#### C. Copula Transformation Algorithm

Given the normalized slider vector **S₀₁** = (s₁,...,s₇) ∈ [0,1]⁷:

**Step 1: Invert negative-direction variables**
Rework is a negative factor (higher = worse). Before applying the
copula, rework is inverted to express all variables in "goodness" space:

    S₀₁[RWK] ← 1 - S₀₁[RWK]

**Step 2: Transform to z-scores**

    z̄ = mean(S₀₁)
    z_std = std(S₀₁)
    zᵢ = (S₀₁[i] - z̄) / max(z_std, ε)   for each i

**Step 3: Apply correlation matrix**

    z_corr[i] = Σⱼ BASE_R[i][j] × z[j]   for each i

**Step 4: Transform back to [0,1] via sigmoid**

    Uᵢ = clamp(0.5 + 0.2 × tanh(z_corr[i]), 0, 1)

**Step 5: Compute copula coupling coefficient**

    coupling = mean(U₁,...,U₇)

The coupling coefficient represents the joint "pressure" of all seven
project characteristics simultaneously. It ranges from 0 (all sliders
at their worst) to 1 (all sliders at their best) and is used to
determine the interpolation weight in the hybrid moment mapping.

---

### VIII. HYBRID MOMENT MAPPING

This is the core innovation of SACO: computing adjusted distribution
moments (m₀ for mean adjustment, m₁ for variance adjustment) from the
copula-transformed slider values.

#### A. Linear Aggregation (Conservative Estimate)

    W = [0.20, 0.20, 0.18, 0.15, 0.10, 0.09, 0.08]
    lin = Σᵢ Wᵢ × S₀₁[i]

This represents a conservative, weighted-sum aggregation of project
goodness. It treats the overall project favorability as proportional
to the weighted sum of individual characteristic quality.

#### B. Probabilistic Disjunction (Murphy's Law Formulation)

    por = 1 - ∏ᵢ (1 - 0.9 × S₀₁[i])

This represents the "probabilistic OR" interpretation: the probability
that at least one project uncertainty factor will manifest. As any single
slider increases toward 1 (high uncertainty), por approaches 1 (near
certainty that something will go wrong). This captures the well-known
project management phenomenon that projects rarely fail for a single
reason — multiple small risks combine.

#### C. Copula-Aware Hybrid Interpolation (Novel Combination)

The interpolation between the conservative linear estimate and the
pessimistic probabilistic-OR estimate is itself a function of the
copula coupling coefficient:

    t = clamp(0.3 + 0.4 × coupling, 0, 1)
    m₀ = (1 - t) × lin + t × por

**Properties of this formula:**
- When coupling is low (sliders uncorrelated, diverse risk profile):
  t → 0.3 (weighted 70% conservative, 30% pessimistic)
- When coupling is high (sliders highly correlated, systemic risk):
  t → 0.7 (weighted 30% conservative, 70% pessimistic)
- The copula coupling naturally amplifies systemic risk — when budget,
  schedule, and scope issues all appear together (high correlation),
  the system appropriately weights the pessimistic scenario more heavily.

This is fundamentally different from either pure linear regression or
pure probabilistic aggregation. The interpolation weight is not a
fixed hyperparameter but an emergent property of the dependency
structure of the input parameters.

#### D. Variance Adjustment (Inverse Relationship)

    variance_factor = 0.8 - 0.5 × lin
    m₁ = variance_factor × (1 + CV/2)

**Critical design choice — inverse relationship:**
As lin increases (higher uncertainty in sliders), the variance
multiplier *decreases*. This is counterintuitive but principled:
practitioners who provide wide P-O ranges (high variance estimates)
are already accounting for uncertainty. If SACO also amplifies variance
for high-uncertainty sliders, it creates an "uncertainty spiral" where
variance explodes unrealistically. The inverse relationship prevents
double-penalization of uncertain estimates.

---

### IX. BETA DISTRIBUTION REFIT (Moment Matching)

Given the adjusted moments (m₀, m₁), the system refits a Beta
distribution using method-of-moments estimation:

**Step 1: Compute adjusted PERT moments in absolute units**

    μ₀ = (O + 4M + P) / 6          [baseline PERT mean]
    σ²₀ = ((P - O) / 6)²           [baseline PERT variance]

    μ₁ = μ₀ × (1 - clamp(m₀, 0, 1) × 0.2)     [shift by m₀]
    σ²₁ = max(σ²₀ × (1 - clamp(m₁, 0, 1) × 0.5), ε)  [scale by m₁]

**Step 2: Normalize to [0,1] space for Beta parameterization**

    range = P - O
    μ₀₁ = clamp((μ₁ - O) / range, ε, 1-ε)
    σ²₀₁ = max(σ²₁ / range², ε)

**Step 3: Solve for Beta parameters via method of moments**

    κ = μ₀₁ × (1 - μ₀₁) / σ²₀₁ - 1
    α' = μ₀₁ × κ
    β' = (1 - μ₀₁) × κ

**Step 4: Generate reshaped distribution**

The system samples N points from Beta(α', β') scaled back to [O, P]
and applies the same smoothing procedure as Stage 1, producing the
reshaped PDF and CDF.

---

### X. THE SACO OBJECTIVE FUNCTION

The function maximized during optimization combines three terms:

    score = P(τ)^(1+bb) × exp(-KL) × exp(-leash_penalty)

Where:

**P(τ):** The probability of completion at or before the target value τ
under the reshaped distribution. This is the primary optimization target.

**(1+bb):** A bias exponent where bb ∈ [0, 0.5] amplifies the
probability term for distributions with high coefficient of variation,
giving larger credit to improvements in high-uncertainty scenarios.

**exp(-KL):** The KL divergence safety penalty. KL is the
Kullback-Leibler divergence between the reshaped distribution Q and
the baseline distribution P:

    KL(P || Q) = ∫ P(x) × log(P(x)/Q(x)) dx

Computed by trapezoidal numerical integration. The exponential penalty
exp(-KL) approaches 1 when Q ≈ P (minimal reshaping) and approaches 0
when Q is very different from P (extreme reshaping). This term prevents
the optimizer from finding slider combinations that produce unrealistic
distributions by constraining maximum divergence to approximately 5%.

**exp(-leash_penalty):** In adaptive mode, a penalty preventing the
optimizer from drifting far from the warm-start seed point. This
ensures reproducibility and consistency between optimization runs.

**Feasibility constraint:** Any slider configuration that violates
O' < M' < P' (monotonicity of the adjusted three-point estimate)
receives a score of -10¹², effectively eliminating it from
consideration.

---

### XI. SLIDER-ADJUSTED THREE-POINT ESTIMATE

During objective function evaluation, the system computes
adjusted O', M', P' values from the slider vector:

    O' = O × (1 - S₁ × 0.25) × (1 - S₄ × 0.12)
    M' = M × (1 - S₂ × 0.12) × (1 - S₇ × 0.08) × (1 + S₅ × 0.10)
    P' = P × (1 - S₃ × 0.20) × (1 - S₄ × 0.10) × (1 + S₅ × 0.08)

    Enforcing monotonicity:
    O'_safe = O'
    M'_safe = max(O'_safe × 1.001, M')
    P'_safe = max(M'_safe × 1.001, P')

**Interpretation of adjustment signs:**
- Budget/Schedule/Scope Certainty flexibility reduces O', M', P'
  (left-shifts distribution → higher confidence at target)
- Scope Reduction reduces P' (tightens worst-case bound)
- Rework increases M', P' (adds rightward uncertainty)

---

### XII. PERCENTILE REPOSITIONING (Core Output)

After optimization, the system reports:

1. **Baseline probability:** P_baseline(τ) = CDF_baseline(τ)
   The probability of completion by τ under standard PERT with no
   context adjustment.

2. **Optimized probability:** P_optimized(τ) = CDF_optimized(τ)
   The probability of completion by τ under the SACO-reshaped
   distribution.

3. **Probability lift:** ΔP = P_optimized - P_baseline
   The increase in confidence at τ attributable to project context.

4. **Optimal slider values:** S*₁,...,S*₇
   The configuration of project characteristics that maximizes P(τ)
   subject to the KL divergence constraint.

**Critical property — estimate preservation:**
The original O, M, P values are NEVER modified. The three-point
estimate represents the practitioner's learned judgment about the
task and is treated as a fixed parameter. SACO recontextualizes
the *percentile ranking* of τ within the distribution, not the
distribution's support.

---

### XIII. MULTI-TASK AGGREGATION (EXTENSION)

The system extends to aggregate distributions across multiple tasks
via Monte Carlo convolution:

Given k tasks with independent reshaped distributions D₁,...,Dₖ:

    D_aggregate = D₁ ⊕ D₂ ⊕ ... ⊕ Dₖ

Where ⊕ denotes numerical convolution of the PDFs.
The aggregate distribution represents the total project duration under
the assumption that tasks are sequential (or partially parallel with
a specified overlap factor).

---

### XIV. ALTERNATIVE OPTIMIZATION STRATEGY (CONSERVATIVE PATH)

When the optimizer cannot achieve improvement over baseline (a condition
called "no-improve"), the system employs a conservative optimization
path that:

1. Identifies the 10th, 50th, and 90th percentile probe points
   of the baseline distribution
2. Applies a monotone lift function based on slider values
3. Returns the highest achievable probability without reshaping

This ensures the system always provides a meaningful result even in
edge cases where standard optimization fails.

---

### XV. SENSITIVITY ANALYSIS EXTENSION

The system additionally computes individual slider sensitivity by
evaluating the objective function at incremental perturbations of
each slider while holding others fixed. This produces a sensitivity
vector:

    ∂P/∂Sᵢ  for each i ∈ {1,...,7}

Reported as a tornado chart showing which project characteristics
have the greatest influence on the probability of completion at τ.
This guides practitioners toward the highest-value risk mitigation
actions.

---

## CLAIMS

*(Note: These are informal claims suitable for a provisional patent
application. Claims will be formalized by a patent attorney for the
non-provisional filing.)*

**Claim 1 (Independent — Method):**
A computer-implemented method for probabilistic project duration
estimation comprising:
(a) receiving a three-point project duration estimate comprising an
optimistic value O, a most-likely value M, and a pessimistic value P;
(b) receiving a plurality of project characteristic parameters
comprising at least budget flexibility, schedule flexibility, scope
certainty, scope reduction allowance, rework percentage, risk tolerance,
and user confidence;
(c) applying a Gaussian copula transformation to said project
characteristic parameters using a correlation matrix derived from
project management theory to produce copula-transformed values
reflecting realistic statistical dependencies between said parameters;
(d) computing a hybrid moment adjustment function comprising:
    (i) a linear weighted aggregation of said copula-transformed
        parameters using PMBOK-derived weights;
    (ii) a probabilistic disjunction of said copula-transformed
         parameters; and
    (iii) an interpolation between (i) and (ii) using an interpolation
         weight determined by the copula coupling coefficient;
(e) refitting a Beta probability distribution using method-of-moments
estimation applied to the adjusted moments from step (d);
(f) executing a two-stage optimization comprising Latin Hypercube
Sampling global search followed by COBYLA local refinement to find
project characteristic values maximizing the probability of completion
at a target duration value;
(g) applying a Kullback-Leibler divergence penalty in the optimization
objective function to prevent unrealistic departure from the baseline
PERT distribution; and
(h) repositioning the target duration value's percentile within the
reshaped distribution without modifying the original O, M, P values.

**Claim 2 (Dependent on Claim 1):**
The method of Claim 1, wherein the interpolation weight t in step (d)(iii)
is computed as:
    t = clamp(0.3 + 0.4 × coupling, 0, 1)
where coupling is the mean of the copula-transformed values U₁,...,U₇.

**Claim 3 (Dependent on Claim 1):**
The method of Claim 1, wherein the variance adjustment m₁ exhibits an
inverse relationship with the linear aggregation lin:
    variance_factor = 0.8 - 0.5 × lin
preventing double-penalization of estimates that already incorporate
wide optimistic-pessimistic ranges.

**Claim 4 (Dependent on Claim 1):**
The method of Claim 1, wherein the KL divergence penalty in the
optimization objective is computed as:
    score = P(τ)^(1+bb) × exp(-KL(P_baseline || P_reshaped))
constraining maximum allowable distribution reshaping to approximately
5% divergence from the PERT baseline.

**Claim 5 (Dependent on Claim 1):**
The method of Claim 1, wherein the Gaussian copula correlation matrix
includes negative correlations between rework percentage and scope
certainty, and positive correlations between risk tolerance and user
confidence, derived from Project Management Body of Knowledge knowledge
area interdependency analysis.

**Claim 6 (Dependent on Claim 1):**
The method of Claim 1, further comprising aggregating reshaped
distributions across a plurality of project tasks by numerical
convolution of individual probability density functions to produce
an aggregate project duration distribution.

**Claim 7 (Dependent on Claim 1):**
The method of Claim 1, further comprising computing a sensitivity
vector by partial evaluation of the optimization objective with respect
to each project characteristic parameter, and displaying said
sensitivity as a tornado chart to guide practitioner risk mitigation.

**Claim 8 (Independent — System):**
A system for context-aware probabilistic project duration estimation
comprising:
(a) a user interface accepting a three-point project duration estimate
and a seven-dimensional project characteristic parameter vector via
interactive slider controls;
(b) a Gaussian copula processor modeling statistical dependencies
between said project characteristic parameters;
(c) a hybrid moment mapping engine computing adjusted Beta distribution
parameters via interpolation between linear weighted aggregation and
probabilistic disjunction, with copula-determined interpolation weight;
(d) a two-stage optimizer executing Latin Hypercube Sampling followed
by COBYLA refinement with Kullback-Leibler divergence constraint; and
(e) a distribution renderer displaying original and reshaped probability
density and cumulative distribution functions overlaid on a common axis.

**Claim 9 (Independent — Computer-Readable Medium):**
A non-transitory computer-readable medium storing instructions that,
when executed by a processor, perform Shape-Adaptive Copula Optimization
(SACO) comprising the steps of Claims 1 through 7.

---

## ABSTRACT

A computer-implemented system and method termed Shape-Adaptive Copula
Optimization (SACO) addresses the context-blindness of standard PERT
and Monte Carlo project estimation by repositioning a target duration
value's percentile within a probability distribution based on seven
project characteristic parameters without modifying the practitioner's
original three-point estimate. The method applies a Gaussian copula with
a project-management-theoretic correlation matrix to model realistic
dependencies between parameters including budget flexibility, schedule
flexibility, scope certainty, scope reduction allowance, rework
percentage, risk tolerance, and user confidence. A novel hybrid moment
mapping function interpolates between conservative linear weighted
aggregation and pessimistic probabilistic disjunction using an
interpolation weight dynamically determined by the copula coupling
coefficient. Adjusted moments are used to refit a Beta distribution via
method-of-moments estimation. A two-stage optimization combining Latin
Hypercube Sampling and COBYLA local refinement maximizes the probability
of completion at the target value subject to a Kullback-Leibler
divergence constraint that prevents unrealistic departure from the
baseline PERT distribution. The result is a higher (or lower) confidence
level at the same estimate when project context supports it — context-aware
estimation grounded in probabilistic theory.

---

## INVENTOR DECLARATION

I hereby declare that:
- I believe I am the original inventor of the subject matter claimed
  in this application.
- I have reviewed and understand the contents of this specification.
- I acknowledge the duty to disclose information material to
  patentability.

**Inventor:** Abel J. Stephen
**Date:** March 2, 2026
**Application:** PMC Estimator / SACO Framework
**Organization:** iCareNOW.io

---

*This provisional patent application was prepared to establish a priority
date. A non-provisional application with formally drafted claims should
be filed within 12 months of this provisional filing date to claim
priority benefit under 35 U.S.C. § 119(e).*
