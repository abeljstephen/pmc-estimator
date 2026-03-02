# Mathematical Improvements & Advances to Watch For

## Probability Distribution Advances

### 1. Alternative to Beta Distribution
**Current**: Beta distribution with moment fitting
**Possible Advances**:
- **Johnson's SU Distribution**: More flexible for skewed distributions, may fit PERT estimates better
- **Burr Distribution**: Can model heavy tails better than Beta
- **Generalized Gamma**: More flexible moment control
- **ML Estimation**: Instead of moment matching, use Maximum Likelihood for better fit

**When to Consider**: If stakeholders report "the probability curves don't match our empirical outcomes"

---

## Copula Enhancements

### 2. Non-Gaussian Copulas
**Current**: Gaussian copula with empirical PMBOK correlation matrix
**Possible Advances**:
- **Clayton Copula**: Better for lower tail dependence (pessimistic scenarios)
- **Gumbel Copula**: Better for upper tail dependence (optimistic scenarios)
- **Archimedean Copulas**: More flexible parameter tuning
- **Vine Copulas**: Model complex dependencies between 7 sliders more accurately

**Impact**: Might improve optimization accuracy by capturing realistic dependency structures
**Data Needed**: Historical project data to estimate which copula structure fits best

---

## Optimization Algorithms

### 3. Beyond Latin Hypercube Sampling
**Current**: Latin Hypercube + SACO geometry search
**Possible Advances**:
- **Bayesian Optimization**: Intelligently select next points to sample (more efficient)
- **Genetic Algorithms**: Self-adaptive for multi-dimensional search
- **Simulated Annealing**: Better escape from local optima
- **Surrogate Models**: Build a fast approximation of SACO geometry, then refine

**Impact**: Faster convergence, better optima, fewer function evaluations
**Trade-off**: More complexity, but probe level 5+ suggests we're already doing expensive search

---

## Divergence Measures

### 4. Alternatives to KL Divergence
**Current**: KL(Q || P) with threshold maxDiv = 0.08
**Possible Advances**:
- **Wasserstein Distance**: More stable numerically, better interpretability
- **Jensen-Shannon Divergence**: Symmetric version of KL
- **Hellinger Distance**: Bounded [0, 1], easier to reason about
- **Total Variation**: Probability mass move distance

**Why Consider**: Wasserstein has clear geometric interpretation (how far must probability mass move?)
**Trade-off**: KL is standard in literature, but Wasserstein may be more intuitive for users

---

## Moment Preservation

### 5. Advanced Moment Matching
**Current**: 2-moment matching (mean + variance)
**Possible Advances**:
- **3-Moment Matching**: Include skewness (captures asymmetry better)
- **4-Moment Matching**: Include kurtosis (captures tail behavior)
- **L-Moments**: More robust than classical moments for edge cases
- **Quantile Matching**: Match specific percentiles instead of moments

**Impact**: Better fit when distributions are highly skewed (common in project management)
**Complexity**: More parameters to optimize, but might improve realism

---

## Numerical Methods

### 6. Integration Accuracy
**Current**: Trapezoidal rule in `trapezoidIntegral()`
**Possible Advances**:
- **Adaptive Quadrature**: Automatic refinement where function is complex
- **Gaussian Quadrature**: Higher accuracy with fewer points
- **Simpson's Rule**: Better convergence for smooth functions
- **Adaptive Simpson**: Combines accuracy + efficiency

**Impact**: More accurate CDF, better probability calculations
**Trade-off**: Slightly more computation, negligible for typical problem sizes

---

## Sensitivity Analysis

### 7. Beyond Simple Slider Sensitivity
**Current**: Per-slider impact on probability
**Possible Advances**:
- **Sobol Indices**: Global sensitivity accounting for interactions
- **Morris Screening**: Efficient identification of important parameters
- **ANOVA Decomposition**: Decompose variance by slider contribution
- **Gradient-Based Sensitivity**: Use optimization gradients

**Impact**: Users get better understanding of which parameters truly matter
**Data Cost**: Might require more function evaluations

---

## Statistical Inference

### 8. Bootstrap Confidence Intervals
**Current**: CDF-based percentile CI [2.5%, 97.5%]
**Possible Advances**:
- **BCa Intervals**: Bias-corrected, accelerated (better for skewed dists)
- **Bootstrap Percentile**: Non-parametric CI without assuming normality
- **Bayesian Credible Intervals**: Bayesian approach with prior beliefs
- **Resampling Confidence Intervals**: If you have empirical data

**When to Consider**: If users want confidence intervals on the confidence intervals!

---

## SACO Geometry

### 9. SACO Architecture Review
**Current**: Copula → moment adjustment → Beta refit strategy
**Questions to Revisit**:
- Is the correlation matrix BASE_R still accurate? (Last validated when?)
- Should correlation matrix be adaptive based on problem domain?
- Can we use data to learn optimal correlation structure?
- Is moment mapping optimal, or should we use copula quantile mapping?

**Possible Advance**: Learn correlation matrix from historical project outcomes

---

## Computational Efficiency

### 10. Speeding Up Reversion Logic
**Current**: If KL > 0.08, revert to baseline
**Possible Advance**:
- **Graduated Response**: Don't fully revert, but scale back the adjustment
- **Constrained Optimization**: Build KL constraint into optimization directly
- **Iterative Fitting**: Gradually adjust Beta parameters toward target

**Impact**: Might find better optima without full reversion

---

## UX/Mathematical Communication

### 11. Better Explanations
**Current**: Per-slider narrative explanations
**Possible Advances**:
- **Counterfactual Explanations**: "If you increased budget flexibility by 20%, probability would increase by 8%"
- **Causal Graphs**: Show dependencies between sliders visually
- **Scenario Planning**: "Here's what happens if everything goes bad vs. best case"
- **Decision Trees**: Help users understand trade-offs

**Impact**: Users understand *why* sliders matter, not just *that* they do

---

## Known Limitations to Address

1. **Current Assumption**: Sliders are independent until copula application
   - **Reality**: Sliders have complex real-world dependencies
   - **Advance**: Learn slider dependencies from historical data

2. **Current Assumption**: PERT formula appropriate for all estimates
   - **Reality**: Some estimates follow different distributions
   - **Advance**: Distribution type selection based on estimate characteristics

3. **Current Assumption**: Optimization seeks single target probability
   - **Reality**: Users care about multiple objectives (cost AND schedule)
   - **Advance**: Multi-objective Pareto optimization

4. **Current Assumption**: Optimization is deterministic (same result each run)
   - **Reality**: Monte Carlo results vary by seed
   - **Advance**: Robust optimization across multiple random seeds

---

## How to Track Improvements

When considering an improvement:

1. **Motivation**: Why would this improve the system?
2. **Data**: What evidence supports adopting this?
3. **Cost**: How complex is implementation? How much slower?
4. **Validation**: How would you verify it's actually better?
5. **Literature**: What peer-reviewed papers support this?

---

## Review Cadence

- **Quarterly**: Review literature for new advances
- **Annually**: Evaluate which improvements to prioritize
- **Per-Release**: Specific improvements to current version

---

## Last Updated
February 15, 2026
