# SACO Research & Methodology Documentation

Shape-Adaptive Copula Optimization (SACO): Complete research justification, alternative approaches, and improvement strategies.

## Contents

### For Practitioners (Start Here!)

1. **SACO_USER_GUIDE_PERT_TO_PLOT.md** - Step-by-step usage guide (2,500 words, 20-30 min) ⭐ **NEW**
   - How to use PERT menu, PLOT visualization, and slider exploration
   - Understanding probability values and percentile repositioning
   - Practical interpretation and decision-making
   - Common scenarios and Q&A

2. **SACO_COMPLETE_WORKFLOW.md** - Complete 3-phase workflow (2,000 words, 20 min) ⭐ **NEW**
   - Phase 1: PERT baseline automatic calculation
   - Phase 2: Plot visualization and setup
   - Phase 3: Interactive exploration and slider adjustment
   - Value chain from O,M,P to optimal context

### Core SACO Methodology Documentation

3. **SACO_METHODOLOGY_OVERVIEW.md** - What is SACO? (2,200 words, 20 min) ✅ **UPDATED**
   - Definition and core components
   - Why SACO was developed
   - Key innovations vs. traditional estimation
   - The 7D hyper-cube framework
   - How sliders map to project uncertainty

4. **SACO_COPULA_JUSTIFICATION.md** - Why Gaussian copulas? (2,500 words, 30 min)
   - Academic grounding in copula theory
   - Gaussian copula vs. Clayton copula vs. Frank copula
   - Why dependency modeling matters in project estimation
   - Comparison to alternatives (neural networks, Bayesian networks, fuzzy logic)
   - Correlation matrix structure (BASE_R)
   - Limitations and when copulas work best

5. **SACO_MOMENT_MAPPING_JUSTIFICATION.md** - Why moment mapping works (2,200 words, 25 min)
   - Mathematical foundation of moment mapping
   - m0 (mean shift): Linear aggregation vs. probabilistic OR blend
   - m1 (variance reduction): Relationship to certainty and CV
   - The hybrid 50/50 blend: Copula geometry meets feasibility constraints
   - Why this approach is robust vs. alternatives
   - Method of moments in Beta distribution fitting

6. **SACO_OPTIMIZATION_STRATEGY.md** - Chained optimization & safety (2,300 words, 28 min)
   - Why two-stage optimization (grid search → COBYLA)
   - KL divergence as penalty function
   - Preventing unrealistic distribution distortion
   - Feasibility guards: O' < M' < P' enforcement
   - ε-floor techniques for numerical stability
   - Trapezoidal integration for smooth approximations
   - Convergence guarantees and trade-offs

7. **SACO_ALTERNATIVES_EVALUATED.md** - Why not these approaches? (2,000 words, 25 min)
   - Quantile matching vs. moment mapping
   - Wasserstein distance vs. KL divergence
   - Bayesian networks vs. Gaussian copulas
   - Neural network surrogates vs. analytic moment mapping
   - Genetic algorithms / differential evolution vs. COBYLA
   - Fuzzy logic vs. probabilistic fuzzy union (current approach)
   - Why each alternative was evaluated and rejected (or accepted for specific contexts)

8. **SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md** - Enhancement strategies (2,400 words, 30 min)
   - Improvements that don't require historical project data
   - Adaptive correlation matrix (BASE_R) sensitivity
   - Multi-target optimization (beyond KL divergence)
   - Real-time slider value adaptation
   - Domain-specific slider configurations
   - Alternative distributions to test (Beta vs. Kumaraswamy vs. Johnson SU)
   - Non-stationary slider weights
   - Uncertainty quantification in SACO outputs
   - Recommended next research steps

9. **SACO_COMPARISON_TO_PMBOK.md** - How SACO enhances PMBOK (2,100 words, 25 min)
   - PMBOK philosophy vs. SACO approach
   - Where SACO aligns with PMBOK guidance
   - Where SACO exceeds PMBOK (modeling dependencies, adaptive weighting, distribution reshaping)
   - Integration: Can PMBOK and SACO work together?
   - SACO advantages for practitioners
   - Limitations and when PMBOK-only is sufficient
   - Evidence from software estimation (COCOMO, Story Points)

10. **SACO_DEPTH_LEVELS_REFERENCE.md** - probeLevel 0–7 guide (2,000 words, 20 min) ⭐ **NEW**
   - Complete specification of search depth levels (probeLevel 0-7)
   - Grid points, COBYLA iterations, time costs for each level
   - Recommendations for batch processing, interactive, mission-critical
   - Performance characteristics and ROI analysis
   - Code references and current implementation

---

## 📊 Document Statistics

| Document | Words | Time | Focus |
|----------|-------|------|-------|
| SACO_USER_GUIDE_PERT_TO_PLOT.md | 2,500 | 20-30 min | Practitioner guide (NEW) |
| SACO_COMPLETE_WORKFLOW.md | 2,000 | 20 min | 3-phase workflow (NEW) |
| SACO_METHODOLOGY_OVERVIEW.md | 2,200 | 20 min | What is SACO |
| SACO_COPULA_JUSTIFICATION.md | 2,500 | 30 min | Theory of copulas |
| SACO_MOMENT_MAPPING_JUSTIFICATION.md | 2,200 | 25 min | Moment mapping logic |
| SACO_OPTIMIZATION_STRATEGY.md | 2,300 | 28 min | Optimization approach |
| SACO_ALTERNATIVES_EVALUATED.md | 2,000 | 25 min | Why not alternatives |
| SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md | 2,400 | 30 min | Future enhancements |
| SACO_COMPARISON_TO_PMBOK.md | 2,100 | 25 min | SACO vs PMBOK |
| SACO_DEPTH_LEVELS_REFERENCE.md | 2,000 | 20 min | Depth level guide (NEW) |
| **TOTAL** | **23,200** | **4-5+ hrs** | **Complete SACO corpus** |

---

## 🎯 Reading Paths

### For Practitioners Using PERT/PLOT (30-40 min) ⭐ **START HERE**
1. SACO_USER_GUIDE_PERT_TO_PLOT.md (20-30 min)
2. SACO_COMPLETE_WORKFLOW.md (20 min)
→ You'll know: *How to use PERT menu, PLOT visualization, and interpret results*

### For Project Managers (1.5 hours)
1. SACO_USER_GUIDE_PERT_TO_PLOT.md (25 min)
2. SACO_DEPTH_LEVELS_REFERENCE.md (20 min)
3. SACO_METHODOLOGY_OVERVIEW.md (20 min)
4. SACO_COMPARISON_TO_PMBOK.md (25 min)
→ You'll know: *How to use SACO, what the slider options mean, and how it compares to PMBOK*

### Executive Understanding (1.5 hours)
1. SACO_METHODOLOGY_OVERVIEW.md (20 min)
2. SACO_COMPARISON_TO_PMBOK.md (25 min)
3. SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md - "Recommended next research steps" section (20 min)
→ You'll know: *What SACO is, how it differs from PMBOK, and where to improve*

### Complete Technical Understanding (4-5 hours)
1. SACO_USER_GUIDE_PERT_TO_PLOT.md (25 min) - Understand usage first
2. SACO_COMPLETE_WORKFLOW.md (20 min) - See the full integration
3. SACO_METHODOLOGY_OVERVIEW.md (20 min)
4. SACO_COPULA_JUSTIFICATION.md (30 min)
5. SACO_MOMENT_MAPPING_JUSTIFICATION.md (25 min)
6. SACO_OPTIMIZATION_STRATEGY.md (28 min)
7. SACO_DEPTH_LEVELS_REFERENCE.md (20 min)
8. SACO_ALTERNATIVES_EVALUATED.md (25 min)
9. SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md (30 min)
→ You'll be able to defend every technical choice in SACO

### Quick Alternatives Assessment (45 min)
1. SACO_ALTERNATIVES_EVALUATED.md - Full document (25 min)
2. SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md - Enhancement opportunities (20 min)
→ You'll know: *What else was considered and what could be better*

### Publication-Ready Path (5-6 hours)
1. Read all 10 documents above (4-5 hrs)
2. Review references in each document
3. Cross-reference to architecture/MATH_AUDIT_REPORT.md for implementation details
→ Ready to write academic paper or defend to stakeholders

---

## 🔗 Cross-References

**For Weight Justification:**
→ See `../pmbok/ALTERNATIVE_WEIGHT_FRAMEWORKS.md` - How SACO weights compare to other frameworks

**For Mathematical Verification:**
→ See `../../architecture/MATH_AUDIT_REPORT.md` - Complete code-by-code audit of SACO implementation

**For Distribution Theory:**
→ See `../distributions/RESEARCH_SYNTHESIS_DISTRIBUTION_RESHAPING.md` - Beta distribution and reshaping methods

**For Implementation Details:**
→ See `../../architecture/` folder - System architecture and slider framework

**For SACO Code:**
→ See `core/reshaping/copula-utils.gs` - Gaussian copula implementation (189 lines)
→ See `core/optimization/kl-divergence.gs` - KL divergence penalty (72 lines)
→ See `core/helpers/metrics.gs` - CDF/PDF utilities (183 lines)

---

## ✅ Document Status

- [x] README.md - Navigation guide (this file)
- [x] SACO_USER_GUIDE_PERT_TO_PLOT.md - **COMPLETE** ⭐ NEW
- [x] SACO_COMPLETE_WORKFLOW.md - **COMPLETE** ⭐ NEW
- [x] SACO_METHODOLOGY_OVERVIEW.md - **COMPLETE** ✅ UPDATED
- [x] SACO_COPULA_JUSTIFICATION.md - **COMPLETE**
- [x] SACO_MOMENT_MAPPING_JUSTIFICATION.md - **COMPLETE**
- [x] SACO_OPTIMIZATION_STRATEGY.md - **COMPLETE**
- [x] SACO_ALTERNATIVES_EVALUATED.md - **COMPLETE**
- [x] SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md - **COMPLETE**
- [x] SACO_COMPARISON_TO_PMBOK.md - **COMPLETE**
- [x] SACO_DEPTH_LEVELS_REFERENCE.md - **COMPLETE** ⭐ NEW

---

## 🚀 Key Questions Answered in This Folder

**Q: What is SACO and why does it exist?**
A: See SACO_METHODOLOGY_OVERVIEW.md - Shape-Adaptive Copula Optimization models project estimation uncertainty via 7 interdependent sliders with sophisticated distribution reshaping.

**Q: Why use Gaussian copulas instead of simpler models?**
A: See SACO_COPULA_JUSTIFICATION.md - Copulas capture realistic slider dependencies; alternatives either oversimplify or require empirical data.

**Q: How does moment mapping actually work?**
A: See SACO_MOMENT_MAPPING_JUSTIFICATION.md - Linear aggregation + probabilistic OR produces realistic mean shifts; variance mapping reflects certainty and CV.

**Q: Why the two-stage optimization with KL divergence penalty?**
A: See SACO_OPTIMIZATION_STRATEGY.md - Prevents unrealistic distribution distortion while optimizing to target moments; ε-floor ensures numerical stability.

**Q: What alternatives were considered and why weren't they chosen?**
A: See SACO_ALTERNATIVES_EVALUATED.md - Bayesian networks (too complex), neural networks (need data), Wasserstein (adds complexity), fuzzy logic (less principled).

**Q: Can SACO be improved without historical data?**
A: See SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md - Six improvement strategies including adaptive correlation matrix, alternative distributions, multi-target optimization.

**Q: How does SACO compare to traditional PMBOK estimation?**
A: See SACO_COMPARISON_TO_PMBOK.md - SACO enhances PMBOK by modeling dependencies, adapting to context, enabling distribution reshaping.

---

## 📚 When to Read Each Document

### Defending SACO to Leadership?
→ SACO_METHODOLOGY_OVERVIEW.md + SACO_COMPARISON_TO_PMBOK.md (45 min)

### Implementing SACO Features?
→ SACO_OPTIMIZATION_STRATEGY.md + SACO_MOMENT_MAPPING_JUSTIFICATION.md (1 hour)

### Evaluating Alternatives?
→ SACO_ALTERNATIVES_EVALUATED.md (25 min)

### Planning Improvements?
→ SACO_IMPROVEMENTS_NO_EMPIRICAL_DATA.md (30 min)

### Academic Publication?
→ All 7 documents + cross-references to architecture/ and research/ (4-5 hours)

---

**Last Updated**: February 15, 2026
**Status**: README complete; 7 research documents pending creation
**Total Research Effort**: 15,500+ words across 7 documents
**Next Step**: Create first 3 documents (Methodology, Copula, Moment Mapping)
