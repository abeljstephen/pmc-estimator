# PROVISIONAL PATENT APPLICATION

**Title of Invention:**
SHAPE-ADAPTIVE COPULA OPTIMIZATION (SACO): A SYSTEM AND METHOD FOR
CONTEXT-AWARE PROBABILISTIC PROJECT DURATION ESTIMATION USING
GAUSSIAN COPULA MOMENT MAPPING WITH KL-DIVERGENCE CONSTRAINT,
BAYESIAN MCMC BASELINE UPDATING, AND USER-CONTROLLED WEIGHT ARCHITECTURE

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

### The Decision-Uncertainty Boundary: Management Stance vs. Outcome Predictions

A second and equally fundamental limitation of standard PERT and Monte Carlo
is epistemic: the methods conflate two categorically distinct types of inputs
that practitioners routinely provide.

**Uncertain outcomes** are properties of the external world that the
practitioner cannot control — the inherent variability in task execution time,
subcontractor performance, material availability, and other aleatory sources.
These are properly represented as probability distributions and captured by
the O, M, P three-point estimate.

**Management stance** refers to the set of deliberate policy decisions and
organizational constraints that the project manager controls or commits to —
how much contingency reserve to hold, how tightly requirements are defined,
how much rework to plan for, the organization's risk appetite. These are
**decision variables** in the formal sense of Howard and Matheson's influence
diagram framework (Howard, 1968; Howard & Matheson, 1984): quantities whose
values are set by the decision maker, not sampled from a distribution.

The distinction between decision nodes (management stance) and chance nodes
(uncertain outcomes) is foundational in decision analysis and was formalized
in Howard's 1968 paper "The Foundations of Decision Analysis" and in the
influence diagram literature (Howard & Matheson, 1984). In this framework,
the probability distribution of project outcomes is properly understood as
a *conditional* distribution: P(duration | management stance). Standard PERT
ignores management stance entirely, computing P(duration) unconditionally.

Kahneman and Lovallo (2003) identified the practical consequence of this
conflation as the **planning fallacy**: practitioners systematically treat
their management commitments (scope will remain stable, rework will be
minimal) as though they were predictions about the world. The result is
systematic optimism bias — not because practitioners misestimate task
duration, but because they misstate their management stance as more favorable
than it proves to be in practice. Flyvbjerg (2008) documented this bias
empirically across thousands of infrastructure, IT, and engineering projects,
finding that the inside view — which treats management quality as given and
optimistic — systematically underestimates actual outcomes.

Chapman and Ward (2003) formalized "controllable conditions" as a distinct
category within project uncertainty management, arguing that sources of
uncertainty include not only variability and hazard (discrete risk events)
but also **ambiguity** — uncertainty that arises directly from management
decisions about scope definition, priority setting, and resource commitment.
The PMBOK Guide (6th Ed., §11.3.2.3) operationalizes this as the
**controllability** attribute of each identified risk: the degree to which
the project manager can influence the risk's probability and impact.

Spetzler and Staël von Holstein (1975) further established that the act of
eliciting probability distributions from practitioners is an elicitation of
**states of knowledge** — subjective beliefs about uncertain outcomes — which
are properly distinguished from **preference statements** and **policy
commitments** about what the decision maker intends to do. User confidence
(one of the seven SACO parameters) is precisely this: a calibration
correction on the practitioner's state of knowledge, not a prediction about
the world. Hubbard (2014) demonstrated that calibration — the degree to which
stated confidence intervals contain true values at their stated frequency —
is measurable and improvable, and that miscalibrated confidence is a primary
driver of project cost and schedule overrun.

The SACO framework operationalizes this theoretical distinction computationally
for the first time in a practical project estimation system. The seven
project characteristic parameters (the "slider vector") are explicitly
classified as **decision nodes** — management stance inputs — that condition
the outcome distribution, rather than additional uncertain quantities to be
sampled. The Gaussian copula models the joint dependency structure of these
management decisions, recognizing that budget flexibility, schedule
flexibility, and scope certainty are not organizationally independent choices.
The KL divergence constraint ensures that no management stance, however
favorable, can cause the system to produce a distribution that contradicts
the practitioner's own learned judgment embedded in O, M, P.

This theoretical grounding distinguishes SACO from all prior parametric
adjustment approaches, which either treat management conditions as ad hoc
buffer additions (no formal framework) or ignore management stance entirely
(standard PERT/MC). SACO is, to the inventors' knowledge, the first system
to formally separate the decision node space (management stance) from the
chance node space (outcome uncertainty) in a computational project estimation
framework.

### Existing Approaches and Their Limitations

**Parametric adjustment (ad hoc buffers):** Practitioners manually add
buffer to P. This is subjective, inconsistent, and does not produce
a principled probability redistribution.

**Bayesian updating:** Conventional Bayesian updating requires structured
historical project data and typically assumes a fixed parametric form for
the likelihood. When N is small (fewer than 10 projects), the posterior
is dominated by the prior and provides little discriminative power. No
existing system provides a lightweight conjugate Bayesian update path that
gracefully degrades to standard PERT estimation when no history is available.

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

**FIG. 8** — Full user interface of the PMC Estimator implementing SACO,
showing PDF/CDF charts, slider panel, target query, and report system.

**FIG. 9** — Metropolis-Hastings MCMC Bayesian baseline extension:
Student-t(ν=4) prior combined with Normal likelihood; MH chain trace
showing burn-in discard (first 500 iterations), thinning-by-5, and
convergence to posterior; chain-driven overrun injection diagram showing
how 1000 effective chain samples cycle through per PERT draw to produce
a right-shifted, wider, outlier-robust baseline distribution relative
to standard PERT.

**FIG. 10** — User-controlled weight architecture: four-tier progressive
disclosure UI showing Tier 1 (always visible: O/M/P, sliders, mode),
Tier 2 (run popover: optimize-for, KL weight, leash, probe level),
Tier 3 (advanced: PERT λ, KDE smoothing, copula preset), Tier 4
(methodology footnotes in report export).

**FIG. 11** — "Why This Result?" optimizer explainer panel showing the
three objective-function forces (target hit, baseline fidelity, leash)
as proportional bars, and per-slider movement table comparing user values
vs. SACO-recommended values with direction indicators.

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

**Theoretical basis:** The seven parameters below are classified as
**decision nodes** in the Howard-Matheson influence diagram formalism
(Howard & Matheson, 1984) — quantities set by the project manager as
policy commitments, not uncertain quantities to be sampled from a
distribution. Each parameter represents a **controllable condition**
(Chapman & Ward, 2003; PMBOK §11.3.2.3) that conditions the project
outcome distribution: P(duration | S₁,...,S₇). This is the formal
basis for treating these parameters separately from the three-point
estimate O, M, P, which represent the practitioner's probability
encoding of uncertain outcomes (Spetzler & Staël von Holstein, 1975).

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

### III-A. STAGE 1 EXTENSION — BAYESIAN MCMC BASELINE WITH HISTORICAL CONTEXT

#### A. Motivation

Standard PERT Monte Carlo sampling produces an identical baseline
distribution regardless of whether the estimating organization has a
documented history of systematic overruns. An organization that
consistently delivers 20% over PERT predicted values should not receive
the same baseline probability as one with no overrun history. The SACO
system provides an optional Bayesian baseline update path that activates
when historical project data is available and gracefully falls back to
standard Monte Carlo when no history is supplied.

#### B. Historical Context Input

The system accepts an optional historical context parameter:

    priorHistory = {
      n:                integer ≥ 1   (number of similar past projects)
      meanOverrunFrac:  real ∈ (-0.5, 2.0)  (mean overrun as fraction:
                        0.15 = actuals averaged 15% above PERT predicted)
      stdOverrunFrac:   real ≥ 0, optional  (std dev of overrun across
                        the N projects; defaults to 0.5 × |mean|)
    }

"Similar project" is defined as one using the same unit of measure
(days, dollars, story points, etc.) and delivered by the same team or
under the same methodology. The overrun is expressed relative to the
PERT mean: if PERT predicted 100 days and actuals averaged 115, the
practitioner enters meanOverrunFrac = 0.15.

#### C. Student-t Prior with Metropolis-Hastings MCMC

The system models the organizational overrun rate μ_overrun as a latent
variable and samples its posterior distribution using Metropolis-Hastings
(MH) Markov Chain Monte Carlo. A Student-t prior with ν=4 degrees of
freedom is used in place of a Normal prior to achieve robustness against
outlier projects.

**Why Student-t, not Normal:**
A Normal prior on μ_overrun produces a closed-form conjugate posterior
but assigns exponentially diminishing probability to outlier observations.
If a single historical project overran by 200%, a Normal prior pulls the
posterior strongly toward that value. The Student-t(ν=4) prior has
heavier tails under which extreme observations are considered plausible
but not disproportionately influential. Gelman et al. ("Bayesian Data
Analysis," 3rd ed., §2.9) recommend ν=4 as the weakly-informative
default for location parameters; the posterior is no longer analytically
tractable, requiring MCMC.

**Prior:**

    μ_overrun ~ t(ν=4, location=0, scale=σ_prior)
    σ_prior   = 0.30   (spans ±30% overrun — calibrated against
                        Flyvbjerg et al. 2002 (infrastructure avg 45%)
                        and Jones 2007 (software avg 27%))

    log p(μ) ∝ -(ν+1)/2 · log(1 + μ²/(ν · σ²_prior))

**Likelihood (Normal, sufficient statistic):**

    data: N projects, sample mean = meanOverrunFrac, std = σ_obs

    log p(data|μ) ∝ -N · (μ − meanOverrunFrac)² / (2 · σ²_obs)

**Log-posterior (unnormalized):**

    log p(μ|data) = log p(data|μ) + log p(μ)

Because the Student-t prior and Normal likelihood are not conjugate,
the posterior has no closed form and is sampled via MH.

#### D. Metropolis-Hastings Algorithm with Burn-in and Thinning

The system runs a random-walk Metropolis-Hastings chain to draw samples
from p(μ_overrun | data):

**Chain parameters:**

    Total iterations : 5500
    Burn-in          : 500   (warm-up; discarded before collection)
    Thinning factor  : 5     (keep every 5th post-burn-in sample)
    Effective samples: (5500 − 500) / 5 = 1000

**Burn-in justification:** Early chain states depend on the
initialization point (μ_0 = meanOverrunFrac, the MLE). The first 500
iterations allow the chain to reach the high-probability region of the
posterior before samples are recorded. For a unimodal 1-dimensional
target with a well-tuned step size, 500 iterations is empirically
sufficient (Gelman et al., BDA3 §11.4).

**Thinning justification:** Successive chain states are correlated
(each is a small perturbation of the previous). Keeping every 5th
sample reduces this autocorrelation, producing a more independent
effective sample set for downstream use.

**Proposal distribution:**

    μ* = μ_current + ε,    ε ~ N(0, (0.5 · σ_prior)²)

Step size 0.5·σ_prior = 0.15 targets a MH acceptance rate of ~30–40%,
consistent with the optimal rate for 1-dimensional targets
(Roberts, Gelman & Gilks, 1997).

**Acceptance step:**

    log α = log p(μ*|data) − log p(μ_current|data)
    Accept μ* with probability min(1, exp(log α))

**Pseudocode:**

    μ_current ← meanOverrunFrac          // MLE warm start
    chainSamples ← []
    for i = 0 to 5499:
      μ* ← μ_current + N(0, 0.15²)
      log α ← logPost(μ*) − logPost(μ_current)
      u ← Uniform(0, 1)
      if log(u) < log α:
        μ_current ← μ*
      if i ≥ 500 and (i − 500) mod 5 == 0:
        chainSamples.append(μ_current)
    // |chainSamples| = 1000

**Credibility indicator:**

    credibility = min(1, N/10)

Surfaced in the UI (0–1) to communicate posterior signal strength.
Acceptance rate is also returned as a diagnostic (healthy range: 0.20–0.50).

#### E. Chain-Driven Overrun Injection

Rather than drawing overruns from a parametric approximation of the
posterior, the system uses the chain samples directly. For each PERT
base draw, a μ value is selected by cycling through the 1000 chain
samples. This correctly propagates epistemic uncertainty (which μ is
the true overrun rate?) without relying on a Gaussian approximation.
A separate aleatoric noise draw captures project-level variability
around the systematic rate:

    K ← |chainSamples|   (= 1000)
    x_max ← P × (1 + max(0, chainMean + 3·chainStd))

    For i = 1 to numSamples:
      s_i       = O + betaSample(α, β) × range      [PERT base draw]
      μ_k       = chainSamples[i mod K]             [epistemic: cycle chain]
      ε_i       = μ_k + σ_obs · N(0, 1)            [epistemic + aleatoric]
      adjusted_i = s_i × (1 + ε_i)                 [history-adjusted sample]
      clamped_i  = clamp(adjusted_i, O, x_max)

Where x_max extends the grid to accommodate positive-overrun tails
beyond the pessimistic estimate.

This produces a baseline distribution that is:
- Shifted rightward in proportion to chainMean (systematic overrun)
- Wider than the standard PERT baseline by chainStd + σ_obs (combined uncertainty)
- Robust to outlier historical projects via the Student-t prior
- Convergent with standard PERT baseline when N → 0 (graceful degradation)

The same Gaussian KDE (bandwidth h = gridRange/63.3) and trapezoid
normalization from Stage 1 are applied to the adjusted samples.

#### F. Mode Switching

The system automatically selects between the two baseline generation
modes at runtime:

    if (priorHistory && N ≥ 1 && isFinite(meanOverrunFrac)):
      baseline = generateMCMCSmoothedPoints(params)   // MH-MCMC path
    else:
      baseline = generateMonteCarloSmoothedPoints(params)  // standard path

All downstream stages (Gaussian copula, betaRefit, optimizer, KL
divergence) operate identically on the resulting PDF/CDF regardless of
which mode generated it. The MH-MCMC extension is fully contained within
Stage 1; no changes to Stages 2–7 are required.

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

---

### XVI. USER-CONTROLLED WEIGHT ARCHITECTURE

The SACO system exposes its internal weights and constraints through a
four-tier progressive disclosure architecture, allowing practitioners to
understand and override the mathematical foundations without requiring
knowledge of the underlying theory.

#### A. The Five Controllable Weights

**1. PERT Mode Weight (λ)**

The canonical PERT formula weights the most-likely estimate M by λ:

    Mean(λ) = (O + λ×M + P) / (λ + 2)
    α(λ)    = 1 + λ×(M - O)/range
    β(λ)    = 1 + λ×(P - M)/range

The system exposes λ ∈ {2, 4, 6}:
- λ=2: Equal weight to all three points (uniform-like)
- λ=4: PMBOK standard (Malcolm et al. 1959, US Navy Polaris program)
- λ=6: High confidence in modal estimate (well-calibrated estimators)

Research basis: Golenko-Ginzburg (1988) tested λ ∈ [2,8] across
engineering domains and found λ=4–6 most robust. The choice of λ=4
as the PMBOK standard is a 65-year empirical consensus.

**2. KDE Bandwidth (smoothing)**

The Gaussian kernel density estimation bandwidth h = gridRange/63.3
is derived from Silverman's rule-of-thumb (1986) evaluated at n=2000
with σ ≈ range/6. The system allows users to deviate from Auto:
- Sharp: h ← h × 0.5 (spikier PDF, tracks samples closely)
- Auto: h = gridRange/63.3 (Silverman rule, default)
- Smooth: h ← h × 1.5 (wider PDF, robust to outliers)

**3. Copula Correlation Preset**

The 7×7 BASE_R matrix encodes organizational risk interdependencies.
The system offers three named presets:
- Independent: BASE_R = I₇ (no correlation between slider dimensions)
- PMBOK Standard: BASE_R as defined in Section VII (default)
- Tightly Coupled: all off-diagonal entries scaled by 1.5 (saturated
  correlation, more pessimistic joint risk estimation)

The PMBOK Standard preset is derived from PMI Risk Practice Standard
and Flyvbjerg et al. (2002) empirical overrun correlation analysis.

**4. Optimizer Fidelity Weight (KL)**

The exp(-KL) penalty term in the objective function is controlled by
a fidelity parameter κ ∈ [0, 1]:

    effective KL weight = κ × KL_raw

κ=1.0 (Strict): Result stays close to baseline — auditable, conservative
κ=0.3 (Loose): Allows larger divergence — higher probability potential

**5. Leash (Operational Change Bound)**

The exp(-leash_penalty) term is controlled by a leash parameter
λ_leash ∈ [0, 1] representing the maximum fractional displacement of
any slider from its user-set value:

    leash_penalty = max(0, displacement - λ_leash × range)²

λ_leash=0.15 (Small): SACO recommends minor operational adjustments
λ_leash=0.50 (Large): SACO may recommend substantial operational changes

#### B. Four-Tier Disclosure Architecture

The system surfaces these weights through a layered interface:

**Tier 1 — Always Visible (all users):**
- O, M, P, target τ inputs
- 7 slider controls with plain-language questions per dimension
- Mode selection: You Decide / Quick Find / Deep Find
- Per-slider probability delta: live readout of each slider's marginal
  contribution to P(X≤τ)

**Tier 2 — Run Options Popover (motivated users):**
- Optimize for: hit target / minimize mean / reduce P90
- Baseline fidelity (KL weight): Strict ↔ Loose slider
- Operational change allowed (leash): Small ↔ Large slider
- Search depth (probe level 1–7)
- PERT mode weight (λ): Conservative / Standard / Confident

**Tier 3 — Advanced Controls (technical users):**
- Baseline smoothing: Auto / Sharp / Smooth
- Copula preset: Independent / PMBOK / Tightly Coupled / Custom
- Historical Context: priorHistory input with Bayesian posterior display

**Tier 4 — Methodology Footnotes (auditors / executives):**
- Static citations to Malcolm et al. (1959), Silverman (1986),
  Kullback & Leibler (1951), McKay et al. (1979), PMI Risk Standard,
  Flyvbjerg et al. (2002), Kahneman & Tversky (1979)
- Decision analysis foundations: Howard (1968), Howard & Matheson (1984),
  Spetzler & Staël von Holstein (1975)
- Management stance and controllable conditions: Chapman & Ward (2003),
  PMBOK §11.3.2.3, Kahneman & Lovallo (2003), Flyvbjerg (2008)
- Calibration and user confidence: Hubbard (2014)
- Surfaced in report export, not in the main UI

---

### XVII. OPTIMIZER EXPLAINER — "WHY THIS RESULT?" PANEL

After each optimization run, the system generates a natural-language
explanation of the optimizer's decisions through the following process:

**Step 1: Force decomposition**

The three forces in the objective function are represented as
proportional bars:

    target_contribution  ∝ (1 - κ × 0.2 - λ_leash × 0.1)
    kl_contribution      ∝ κ × 0.6
    leash_contribution   ∝ λ_leash × 0.4

**Step 2: Slider delta table**

For each of the 7 slider dimensions, the system computes:

    Δᵢ = S*ᵢ - S_user_ᵢ

Where S*ᵢ is the optimizer-recommended value and S_user_ᵢ is the
user's current manual setting. Deltas are sorted by |Δᵢ| × wᵢ
(magnitude × PMBOK weight) to identify the highest-leverage changes.

**Step 3: Summary**

A natural-language summary reports the total probability lift
(ΔP = P_optimized - P_baseline) and identifies the primary driver
(the slider with the largest weighted delta).

This explainer transforms the optimizer from a black box into a
transparent advisor, enabling practitioners to evaluate whether
the recommended changes are operationally realistic before acting
on them.

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

**Claim 10 (Independent — Bayesian MCMC Baseline Extension):**
A computer-implemented method extending the method of Claim 1, wherein
Stage 1 baseline generation further comprises:
(a) accepting a historical context parameter comprising a count N of
    similar past projects, a mean overrun fraction relative to PERT
    predicted values, and an optional standard deviation of overrun;
(b) placing a Student-t prior with ν=4 degrees of freedom, location 0,
    and scale σ_prior=0.30 over the organizational overrun rate μ_overrun,
    yielding the log-prior:
        log p(μ) ∝ −(ν+1)/2 · log(1 + μ²/(ν · σ²_prior))
    said heavy-tailed prior conferring robustness against outlier
    historical projects relative to a Normal prior;
(c) sampling the intractable posterior p(μ_overrun | data) using a
    random-walk Metropolis-Hastings Markov Chain Monte Carlo algorithm
    comprising: a total chain length of 5500 iterations; a burn-in
    period of 500 iterations discarded before sample collection to
    allow the chain to reach stationarity; thinning by a factor of 5
    to reduce inter-sample autocorrelation, yielding 1000 effective
    posterior chain samples; and a Gaussian random-walk proposal with
    standard deviation 0.5·σ_prior targeting an acceptance rate of
    approximately 0.30–0.40;
(d) for each of the numSamples PERT base draws, selecting a posterior
    overrun value μ_k by cycling through the 1000 chain samples, then
    computing an adjusted sample as:
        adjusted_i = s_i × (1 + μ_k + σ_obs · N(0,1))
    thereby propagating both epistemic uncertainty (via the chain) and
    aleatoric per-project variability (via σ_obs) into the distribution;
(e) applying Gaussian KDE over an extended grid whose upper bound is
    P × (1 + max(0, chainMean + 3·chainStd)), accommodating the
    overrun-shifted tail beyond the pessimistic estimate;
(f) when no historical context is provided, reverting to standard i.i.d.
    Beta Monte Carlo sampling, with all downstream stages operating
    identically on either baseline.

**Claim 11 (Dependent on Claim 10):**
The method of Claim 10, wherein a credibility indicator
credibility = min(1, N/10) is computed and displayed to the
practitioner, communicating the statistical strength of the
historical signal on a 0–1 scale.

**Claim 12 (Independent — User-Controlled Weight Architecture):**
A computer-implemented system for context-aware probabilistic project
duration estimation comprising:
(a) a user interface implementing a four-tier progressive disclosure
    architecture exposing mathematical weights and constraints at
    levels of increasing technical sophistication;
(b) a Tier 1 interface comprising: three-point estimate inputs,
    seven project characteristic sliders, and per-slider real-time
    probability delta readouts showing each slider's marginal
    contribution to P(X≤τ);
(c) a Tier 2 run options control exposing: optimization objective
    selection (target / mean / P90), a baseline fidelity parameter
    controlling KL divergence penalty weight, a leash parameter
    controlling maximum slider displacement from user values, search
    depth (probe level 1–7), and PERT mode weight λ ∈ {2, 4, 6};
(d) a Tier 3 advanced controls interface exposing: KDE bandwidth
    smoothing, Gaussian copula correlation matrix preset selection,
    and historical context input for Bayesian baseline updating;
(e) each exposed parameter accompanied by a plain-language description
    of its trade-off and a citation to the research basis for its
    default value.

**Claim 13 (Independent — Optimizer Explainer):**
A computer-implemented method for generating natural-language
explanations of optimization results in the method of Claim 1,
comprising:
(a) decomposing the SACO objective function into its three component
    forces and representing their relative contributions as
    proportional visual indicators;
(b) computing per-slider delta values Δᵢ = S*ᵢ - S_user_ᵢ comparing
    optimizer-recommended slider values to practitioner-supplied
    values, sorted by |Δᵢ| × wᵢ where wᵢ are PMBOK-derived weights;
(c) generating a natural-language summary identifying the highest-
    leverage slider change, the total probability lift ΔP, and
    whether the recommended changes are within the user-specified
    operational leash bound;
(d) displaying said explanation in a dedicated panel adjacent to
    the reshaped distribution charts, enabling practitioners to
    evaluate the operational feasibility of optimizer recommendations
    before acting on them.

---

## ABSTRACT

A computer-implemented system and method termed Shape-Adaptive Copula
Optimization (SACO) addresses the context-blindness of standard PERT
and Monte Carlo project estimation by repositioning a target duration
value's percentile within a probability distribution based on seven
project characteristic parameters without modifying the practitioner's
original three-point estimate. The system incorporates four novel
contributions: (1) A Gaussian copula with a project-management-theoretic
correlation matrix models realistic dependencies between parameters
including budget flexibility, schedule flexibility, scope certainty,
scope reduction allowance, rework percentage, risk tolerance, and user
confidence. (2) A hybrid moment mapping function interpolates between
conservative linear weighted aggregation and pessimistic probabilistic
disjunction, with interpolation weight dynamically determined by the
copula coupling coefficient. (3) A two-stage optimization combining
Latin Hypercube Sampling and COBYLA local refinement maximizes the
probability of completion at the target value subject to a
Kullback-Leibler divergence constraint. (4) An optional Bayesian MCMC baseline extension employs a
Metropolis-Hastings Markov Chain Monte Carlo sampler with a
Student-t(ν=4) prior over the organizational overrun rate; the
heavy-tailed prior confers robustness against outlier historical
projects relative to conjugate Normal approaches; a 500-iteration
burn-in and thinning-by-5 yield 1000 effective posterior chain samples
which are cycled through per PERT draw to inject both epistemic and
aleatoric uncertainty into the baseline; the system reverts
automatically to standard i.i.d. PERT sampling when no history is
provided. The system further exposes all internal weights and constraints
through a four-tier progressive disclosure architecture with
plain-language descriptions and research citations, and generates
natural-language optimizer explanations comparing recommended slider
values to practitioner-supplied values, sorted by PMBOK-derived
importance weights. The result is context-aware estimation that adapts
to both organizational risk characteristics and documented project
history, grounded throughout in probabilistic and information-theoretic
foundations.

---

## REFERENCES

Chapman, C., & Ward, S. (2003). Transforming project risk management into
project uncertainty management. *International Journal of Project
Management*, 21(2), 97–105.

Chapman, C., & Ward, S. (2003). *Project Risk Management: Processes,
Techniques and Insights* (2nd ed.). Wiley.

Flyvbjerg, B. (2008). Curbing optimism bias and strategic
misrepresentation in planning: Reference class forecasting in practice.
*European Planning Studies*, 16(1), 3–21.

Flyvbjerg, B., Holm, M. S., & Buhl, S. (2002). Underestimating costs in
public works projects: Error or lie? *Journal of the American Planning
Association*, 68(3), 279–295.

Flyvbjerg, B., & Gardner, D. (2023). *How Big Things Get Done*. Crown.

Gelman, A., Carlin, J. B., Stern, H. S., Dunson, D. B., Vehtari, A., &
Rubin, D. B. (2013). *Bayesian Data Analysis* (3rd ed.). CRC Press.

Golenko-Ginzburg, D. (1988). On the distribution of activity time in
PERT. *Journal of the Operational Research Society*, 39(8), 767–771.

Howard, R. A. (1968). The foundations of decision analysis. *IEEE
Transactions on Systems Science and Cybernetics*, 4(3), 211–219.

Howard, R. A., & Matheson, J. E. (1984). Influence diagrams. In R. A.
Howard & J. E. Matheson (Eds.), *Readings on the Principles and
Applications of Decision Analysis* (Vol. 1, pp. 721–762). Strategic
Decisions Group.

Hubbard, D. W. (2014). *How to Measure Anything: Finding the Value of
Intangibles in Business* (3rd ed.). Wiley.

Hubbard, D. W., Budzier, A., & Bang Leed, S. (2024). *How to Measure
Anything in Project Management*. Wiley.

Kahneman, D., & Lovallo, D. (2003). Delusions of success: How optimism
undermines executives' decisions. *Harvard Business Review*, 81(7), 56–63.

Kahneman, D., & Tversky, A. (1979). Prospect theory: An analysis of
decision under risk. *Econometrica*, 47(2), 263–291.

Kullback, S., & Leibler, R. A. (1951). On information and sufficiency.
*Annals of Mathematical Statistics*, 22(1), 79–86.

Malcolm, D. G., Roseboom, J. H., Clark, C. E., & Fazar, W. (1959).
Application of a technique for research and development program
evaluation. *Operations Research*, 7(5), 646–669.

McKay, M. D., Beckman, R. J., & Conover, W. J. (1979). A comparison of
three methods for selecting values of input variables in the analysis of
output from a computer code. *Technometrics*, 21(2), 239–245.

Powell, M. J. D. (1994). A direct search optimization method that models
the objective and constraint functions by linear interpolation. In S.
Gomez & J.-P. Hennart (Eds.), *Advances in Optimization and Numerical
Analysis* (pp. 51–67). Kluwer Academic.

Project Management Institute. (2017). *A Guide to the Project Management
Body of Knowledge (PMBOK Guide)* (6th ed.). PMI.

Project Management Institute. (2021). *A Guide to the Project Management
Body of Knowledge (PMBOK Guide)* (7th ed.). PMI.

Project Management Institute. (2009). *Practice Standard for Project Risk
Management*. PMI.

Roberts, G. O., Gelman, A., & Gilks, W. R. (1997). Weak convergence and
optimal scaling of random walk Metropolis algorithms. *Annals of Applied
Probability*, 7(1), 110–120.

Silverman, B. W. (1986). *Density Estimation for Statistics and Data
Analysis*. Chapman and Hall.

Spetzler, C. S., & Staël von Holstein, C.-A. S. (1975). Probability
encoding in decision analysis. *Management Science*, 22(3), 340–358.

Washington State Department of Transportation. (2022). *Project Risk
Analysis Model (PRAM) User's Guide*. WSDOT.

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
