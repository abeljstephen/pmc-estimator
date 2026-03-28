# INVENTION DISCLOSURE
## Probabilistic Critical Path Engine with SACO-Integrated Stochastic Network Scheduling

**Inventor:** Abel J. Stephen
**Organization:** iCareNOW.io
**Date of Disclosure:** March 27, 2026
**Related Application:** SACO Provisional Patent Application (filed March 2, 2026)
**Disclosure Type:** New Subject Matter — Intended for Non-Provisional Filing and/or Continuation-in-Part

---

## PURPOSE OF THIS DOCUMENT

This invention disclosure captures four novel technical contributions developed
as extensions to the SACO system (Shape-Adaptive Copula Optimization, provisional
filed March 2, 2026). These contributions relate to the integration of SACO's
probabilistic output with Critical Path Method (CPM) network scheduling, and to
new analytical techniques for stochastic schedule intelligence. They are not
covered by the provisional application and are documented here to establish the
date of conception and reduction to practice.

These contributions are intended for inclusion as additional independent or
dependent claims in the non-provisional SACO patent filing (due by March 2, 2027),
or as a separate continuation-in-part application if the non-provisional scope
does not accommodate them.

---

## BACKGROUND

### Limitations of Standard CPM

Critical Path Method (CPM) is the dominant technique for project network scheduling.
Given a set of tasks with durations and precedence relationships, CPM computes the
longest path through the dependency network (the critical path), the earliest and
latest start/finish dates for each task, and the float (slack) available before
a task delays the project end.

**Critical limitation 1 — Point estimate input:** Standard CPM requires a single
deterministic duration per task. This discards the probabilistic information
embedded in PERT three-point estimates and ignores the context-adjusted probability
distributions produced by SACO. A project plan where every task uses its P50
duration and a plan where every task uses its P90 duration have the same critical
path structure under standard CPM — despite carrying radically different schedule
risk profiles.

**Critical limitation 2 — Independence assumption:** Standard Monte Carlo
simulation of project networks samples each task's duration independently.
This assumption ignores the systematic correlations between tasks performed by
the same team under the same organizational conditions. If a team is
underperforming systemically (resources stretched, scope unclear, morale low),
all tasks in the network tend to overrun together. Independent sampling
underestimates the probability of total project overrun and overestimates the
risk-reduction benefit of parallel paths.

**Critical limitation 3 — Merge point bias (Fenton-Birnbaum effect):** When
multiple dependency paths converge at a node, the task's earliest start is the
maximum of all incoming earliest finish values. Because
E[max(X₁, X₂, ..., Xₙ)] > max(E[X₁], E[X₂], ..., E[Xₙ])
for independent non-degenerate random variables, deterministic CPM
systematically underestimates project duration at every convergence node.
This bias compounds across the network: a project with four convergence nodes
may have its expected duration underestimated by 10–25% relative to stochastic
simulation. No standard CPM tool warns the practitioner of this effect.

**Critical limitation 4 — Static float reporting:** Standard CPM reports float
as a static value. It does not compute the float consumption threshold at which
a non-critical task becomes critical — the tipping point beyond which using
available float shifts the critical path and increases project duration. This
information is directly actionable but absent from all standard CPM outputs.

**Critical limitation 5 — No network-level correlation modeling:** Standard
Monte Carlo schedule simulation (e.g., @RISK for Primavera, Oracle Crystal Ball)
samples task durations from independent distributions. While some tools allow
manual correlation specification between individual task pairs, none apply a
systematic correlation structure derived from organizational and management
theory. The SACO framework's Gaussian copula, which models management stance
correlations for single-task estimation, has not previously been extended to
model inter-task duration correlations in a project network.

No prior system has addressed all five limitations in a unified, integrated
computational pipeline.

---

## NOVEL CONTRIBUTIONS

### Contribution 1: SACO-to-CPM Integrated Probabilistic Scheduling Pipeline

**What it is:**
A computer-implemented pipeline that uses the probability distributions produced
by SACO (Shape-Adaptive Copula Optimization) as the duration inputs to both
deterministic and stochastic Critical Path Method computation, replacing the
single point-estimate input of standard CPM with context-adjusted probability
distributions.

**How it works:**
1. SACO runs independently on each task in a project network, producing for
   each task three distinct probability distributions: the PERT baseline
   distribution, the management-stance-adjusted distribution, and the
   SACO-optimized distribution.

2. The practitioner selects a target percentile (default P80) to extract a
   single duration value per task from the SACO-optimized distribution. This
   value — informed by the full copula-adjusted probabilistic context of each
   task — serves as the duration input to deterministic CPM.

3. For stochastic CPM, the full SACO-optimized CDF per task is retained. The
   stochastic engine samples from each task's CDF by inverting the CDF at a
   uniform random variate U ~ Uniform(0,1), producing a duration sample that
   respects the full shape of the SACO-optimized distribution including its
   asymmetry, tail weight, and context-adjusted percentile structure.

4. The deterministic CPM produces the schedule baseline. The stochastic CPM
   produces the criticality index, schedule sensitivity index, and project
   duration distribution as described in Contributions 2, 3, and 4.

**Why it is novel:**
No prior system uses copula-based, management-stance-conditioned probability
distributions as the duration input to CPM. Prior systems either use point
estimates (deterministic CPM) or independent parametric distributions
(Monte Carlo CPM). The SACO-to-CPM pipeline is the first to condition each
task's duration distribution on the practitioner's management stance before
computing the network schedule, producing a schedule that is coherent with
the same theoretical framework used for single-task estimation.

**Specific novelty over prior art:**
- Over standard deterministic CPM: introduces probabilistic, context-aware
  durations in place of point estimates.
- Over @RISK/Crystal Ball Monte Carlo CPM: the duration distributions are not
  independently fitted parametric distributions but SACO-optimized distributions
  conditioned on management stance decision nodes.
- Over PERT network analysis: PERT network statistics (sum of critical path
  means, root-sum-of-squares of variances) assume task independence and normal
  marginals. The SACO-to-CPM pipeline uses non-normal, asymmetric, Beta-refitted
  distributions and the inter-task correlation structure of Contribution 2.

---

### Contribution 2: Inter-Task Gaussian Copula Correlation in Stochastic Network Scheduling

**What it is:**
A computer-implemented method for modeling systematic correlations between
task duration outcomes in a project network using a Gaussian copula, applied
during Monte Carlo stochastic CPM simulation, where the correlation structure
is derived from organizational and management theory rather than historical
project data.

**How it works:**
1. Tasks in the project network are optionally grouped into correlation clusters
   by shared organizational attribute: same team, same resource pool, same
   subcontractor, or same management condition (e.g., all tasks subject to the
   same scope certainty constraint).

2. Within each cluster, a Gaussian copula with correlation coefficient ρ_cluster
   models the joint distribution of task duration outcomes. The correlation
   coefficient is derived from the SACO BASE_R matrix entry most relevant to
   the shared organizational attribute (e.g., ρ_schedule for tasks sharing a
   schedule flexibility constraint; ρ_scope for tasks sharing a scope certainty
   constraint).

3. During each Monte Carlo iteration of stochastic CPM, task duration samples
   within a cluster are drawn from the multivariate Gaussian copula rather than
   independently. The copula transformation maps correlated Gaussian samples to
   the marginal CDF of each task's SACO-optimized distribution via the
   probability integral transform.

4. Tasks in different clusters are sampled independently across clusters.

**Why it is novel:**
Standard Monte Carlo schedule simulation assumes task duration independence.
Systems that allow manual correlation specification (e.g., @RISK for Primavera)
require the practitioner to specify individual pairwise correlations without
theoretical guidance. The present method derives the inter-task correlation
structure from the same Gaussian copula BASE_R matrix that governs SACO's
single-task management stance modeling, producing a theoretically consistent
correlation structure grounded in project management theory (PMBOK knowledge
area interdependencies) rather than historical data or practitioner judgment.

This is the first application of a project-management-theoretic Gaussian copula
to the inter-task correlation structure of a stochastic project network.

---

### Contribution 3: Critical Path Tipping Point Analysis

**What it is:**
A computer-implemented method for computing, for each non-critical task in a
project network, the precise float consumption threshold — the amount of float
usage that causes that task to become critical, shifting the critical path and
increasing the expected project end date — together with the resulting project
duration increase at each tipping point.

**How it works:**
1. After the deterministic CPM forward and backward passes are complete, each
   non-critical task T_i has total float F_i = LateFinish_i - EarlyFinish_i > 0.

2. For each non-critical task T_i, the tipping point Θ_i is computed as:

       Θ_i = F_i - (F_critical_path_successor - 0)

   where F_critical_path_successor is the minimum float on any path from T_i
   to the project sink node that does not currently pass through the critical
   path. Θ_i is the amount of float T_i can consume before a non-critical path
   through T_i achieves zero total float, making it a new critical path.

3. For each task T_i, the tipping point output includes:
   (a) Θ_i: float consumption threshold in project duration units;
   (b) ΔDuration_i: the expected increase in project end date if T_i uses
       exactly Θ_i units of float (the path now shares critical status);
   (c) The identities of the tasks whose float is affected when T_i
       reaches its tipping point;
   (d) A severity classification: HIGH (Θ_i < 10% of project duration),
       MEDIUM (10–25%), LOW (>25%).

4. Tipping point analysis is presented as a ranked table, sorted by Θ_i
   ascending, enabling the practitioner to identify the most fragile
   non-critical tasks first.

**Why it is novel:**
Standard CPM reports float as a static value without communicating the
dynamic threshold at which float consumption changes the project's critical
path structure. No prior CPM system, including MS Project, Primavera P6,
or Monte Carlo CPM tools, automatically computes or reports the float
consumption threshold at which each non-critical task transitions to
critical status. This computation is analytically tractable from the CPM
backward pass data and requires no additional input from the practitioner.

---

### Contribution 4: Integrated Probabilistic Schedule Intelligence System

**What it is:**
A computer-implemented system combining SACO single-task probabilistic estimation,
SACO-to-CPM pipeline integration (Contribution 1), inter-task Gaussian copula
correlation (Contribution 2), and critical path tipping point analysis
(Contribution 3) into a unified schedule intelligence platform, producing the
following composite outputs not available in any prior single system:

(a) **Criticality Index per task:** The fraction of Monte Carlo iterations in
    which each task lies on the critical path, quantifying each task's
    probability of determining the project end date. Computed over N iterations
    of stochastic CPM using SACO-optimized, copula-correlated duration samples.

(b) **Schedule Sensitivity Index (SSI) per task:**
        SSI_i = CriticalityIndex_i × (σ_task_i / σ_project)
    Ranking tasks by their combined probability of being critical and their
    contribution to project duration variance. The SSI tornado chart is the
    primary risk mitigation guidance output.

(c) **Merge Point Bias Quantification:** For each convergence node in the
    project network, the system computes the difference between the
    deterministic CPM earliest finish at that node and the expected earliest
    finish from stochastic simulation:
        MergePointBias_node = E_stochastic[EarlyFinish_node] - EarlyFinish_CPM_node
    Reporting this bias quantifies the systematic optimism of the deterministic
    schedule and motivates the use of stochastic analysis.

(d) **Schedule Health Score:** A composite 0–100 score computed as:
        SHS = 100 × (1 - w₁×NCP - w₂×CD - w₃×MPB_norm - w₄×CIS - w₅×GD)
    where:
        NCP  = fraction of tasks with total float < 10% of project duration
        CD   = number of convergence nodes / total nodes
        MPB_norm = normalized mean merge point bias across all convergence nodes
        CIS  = 1 - (std of criticality indices) / 0.5  [spread of criticality]
        GD   = graph density (actual edges / maximum possible edges)
        w₁,...,w₅ are calibrated weights summing to 1.0
    This composite score provides a single interpretable metric for overall
    schedule risk, analogous to a credit score for project schedules.

(e) **Project Duration S-Curve:** The cumulative distribution function of
    project end date, computed from stochastic CPM iterations, expressed as
    P(project completes by date D) for a range of dates D. This is the
    network-level analog of the single-task SACO probability output.

**Why it is novel:**
No prior system produces all five of these outputs from a single integrated
pipeline that begins with management-stance-conditioned single-task estimation
(SACO), propagates that estimation through a copula-correlated stochastic
network model, and produces schedule intelligence outputs at both the task level
(criticality index, SSI, tipping point) and the project level (S-curve, health
score, merge point bias). The five outputs together constitute a probabilistic
schedule intelligence system with no prior art equivalent in the project
management software literature or patent record.

---

## PRIOR ART DISTINGUISHED

| Prior System | What It Does | What This Disclosure Adds |
|---|---|---|
| Standard CPM (MPP, Primavera P6) | Deterministic forward/backward pass, float, critical path | Probabilistic duration inputs from SACO; tipping point analysis; health score |
| @RISK for Primavera / Oracle Crystal Ball | Monte Carlo CPM with independent parametric distributions | SACO-conditioned distributions; inter-task Gaussian copula from management theory |
| PERT network analysis | Sum critical path means; root-sum-of-squares variances; assumes normal, independent | Non-normal SACO distributions; copula correlations; criticality index; SSI |
| Schedule Risk Analysis (SRA) tools | Criticality index, SSI via independent Monte Carlo | Copula-correlated sampling from management-stance-conditioned distributions |
| SACO provisional (March 2, 2026) | Single-task probabilistic estimation; Claim 6 covers multi-task PDF convolution | Network scheduling, dependency graph, tipping point, inter-task copula, health score |

---

## REDUCTION TO PRACTICE

The following elements have been designed and specified as of the disclosure date:

- [x] SACO-to-CPM pipeline architecture and percentile extraction method
- [x] Inter-task copula correlation structure and BASE_R mapping to cluster types
- [x] Tipping point computation algorithm from CPM backward pass data
- [x] Schedule Health Score formula with five component factors
- [x] Criticality index and SSI computation from stochastic CPM iterations
- [x] Merge point bias quantification method
- [x] S-curve output from Monte Carlo project duration distribution

Implementation in Google Apps Script (.gs) is planned as the next phase.
The SACO engine (system-google-sheets-addon/core/) is the existing reduction
to practice for the upstream estimation component.

---

## CLAIMS INTENDED FOR NON-PROVISIONAL FILING

**Proposed Claim A (Independent — SACO-to-CPM Pipeline):**
A computer-implemented method for probabilistic project network scheduling
comprising:
(a) applying Shape-Adaptive Copula Optimization (SACO) independently to each
    task in a project network to produce, for each task, a management-stance-
    conditioned probability distribution over task duration;
(b) extracting a deterministic duration per task from said distribution at a
    practitioner-specified target percentile for use in deterministic Critical
    Path Method computation;
(c) retaining the full SACO-optimized cumulative distribution function per task
    for use in stochastic Critical Path Method computation;
(d) executing stochastic Critical Path Method by sampling each task's duration
    from its SACO-optimized distribution via probability integral transform
    inversion over N iterations; and
(e) producing a project duration cumulative distribution function from said
    N-iteration stochastic Critical Path Method computation.

**Proposed Claim B (Dependent on Claim A — Inter-Task Copula):**
The method of Claim A, wherein step (d) further comprises grouping tasks by
shared organizational attribute into correlation clusters, and within each
cluster sampling task durations from a multivariate Gaussian copula whose
correlation coefficient is derived from the project-management-theoretic
correlation matrix of the SACO system, such that task durations within a
cluster exhibit the systematic correlations implied by shared management
conditions rather than being sampled independently.

**Proposed Claim C (Independent — Tipping Point Analysis):**
A computer-implemented method for critical path tipping point analysis
comprising:
(a) executing Critical Path Method on a project task network to produce total
    float values for each non-critical task;
(b) for each non-critical task T_i with total float F_i, computing the tipping
    point Θ_i as the minimum float consumption by T_i that causes any path
    through T_i to achieve zero total float, making said path simultaneously
    critical with the existing critical path;
(c) computing the project duration increase resulting from said path achieving
    simultaneous critical status; and
(d) reporting tipping points ranked by Θ_i ascending, together with the
    resulting project duration impact and the identities of tasks on the
    newly critical path.

**Proposed Claim D (Independent — Schedule Intelligence System):**
A computer-implemented system for probabilistic schedule intelligence comprising:
(a) a SACO estimation engine producing management-stance-conditioned duration
    distributions per task;
(b) a stochastic CPM engine sampling from said distributions using an inter-task
    Gaussian copula correlation structure derived from project management theory;
(c) a criticality index processor computing, for each task, the fraction of
    stochastic iterations in which the task lies on the critical path;
(d) a schedule sensitivity index processor computing SSI_i = CriticalityIndex_i
    × (σ_task_i / σ_project) for each task;
(e) a merge point bias processor computing, for each network convergence node,
    the difference between deterministic and stochastic expected earliest finish;
(f) a tipping point processor as described in Claim C; and
(g) a schedule health score processor computing a composite 0–100 score from
    network topology metrics, float distribution, criticality index spread,
    and merge point bias magnitude.

---

## CONFIDENTIALITY NOTE

This document is a confidential internal invention disclosure. It does not
constitute a public disclosure. All novel methods described herein remain
patent-pending subject matter under the SACO provisional application and are
intended for non-provisional patent protection. Do not distribute externally.

---

*Inventor signature: Abel J. Stephen*
*Disclosure date: March 27, 2026*
*iCareNOW.io*
