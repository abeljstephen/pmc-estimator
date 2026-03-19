# Step 4 Display Rules — PMC Estimator

Full field-by-field formatting reference for presenting estimation results.

## 4a. Feasibility Score
Lead with `results[i].feasibilityScore` (0–100):
- 80–100: High confidence — distribution strongly supports hitting the target
- 60–79: Moderate confidence — achievable with disciplined execution
- 40–59: Challenging — significant risk; consider scope or schedule adjustments
- <40: High risk — target is very ambitious given current estimates and context

## 4b. Confidence Interval
From `results[i].percentiles`: show P10 / P50 / P90 + PERT mean `(O+4M+P)/6`.
If `targetAtConfidence` present: "At [X]% confidence: [value] [unit]."

## 4c. Three-Way Probability Table
When target provided, from `results[i].targetProbability.value`:
```
Baseline:        [original]%
Your context:    [adjusted]%   (±delta vs baseline)
SACO optimized:  [adjustedOptimized]%   (±delta vs baseline)
```
If adjusted = original (no sliders sent), omit middle row and offer to collect context now (free, no extra credit).

## 4d. SACO Slider Recommendations
From `decisionReports[*].winningSliders`. Show as actionable bullets with plain-English meaning:
- scheduleFlexibility → timeline buffer
- budgetFlexibility → contingency reserves
- scopeCertainty → requirements lock-down
- scopeReductionAllowance → ability to defer scope items
- reworkPercentage → revision cycles expected
- riskTolerance → comfort with uncertainty
- userConfidence → confidence in O/M/P inputs

## 4e. Slider Delta
If `results[i].sliderDelta` present, show each changed lever:
"scheduleFlexibility: +28 (you: 25 → SACO: 53)" — positive = SACO raised it.
Frame as: "SACO is telling you that [lever] should move [direction] — meaning [plain-English implication]."

## 4f. Distribution Shift
If `results[i].optimizedPercentiles` present, show before/after P10/P50/P90 table with deltas to illustrate how SACO reshaped the distribution.

## 4g. Counter-Intuition Warnings
From `decisionReports[*].counterIntuition`. Show as ⚠️ warnings.
These flag cases where conventional PM instinct worsens outcomes on this distribution shape — e.g. "Reducing scope certainty beyond 60 actually increases P90 spread on right-skewed distributions."

## 4h. Recommendations
From `decisionReports[*].recommendations`. Present as a numbered action plan the PM can take to the team.

## 4i. Diagnostics
Warn if:
- `monotonicityAtTarget: "Warn"` — irregular distribution near target; interpret probabilities with caution
- `chainingDrift > 0.05` — optimizer drift detected between fixed and adaptive passes; results may be conservative

## 4j. Charts
Display `_charts.distribution` and `_charts.probabilities` inline if present. Distribution chart shows baseline vs SACO-optimized PDF. Probability bar chart shows three-way comparison.

## 4k. Report Links
Offer `results[i]._reportUrl` per task as a shareable one-page stakeholder summary. For multi-task, list all report links after the portfolio block.

## 4l. Credits
Show `_quota.bar`. Proactively warn if remaining ≤ 20% of total credits.

## 4m. Portfolio (2+ tasks)
From `_portfolio`: show P10/P50/P90 and method:
- `pert_sum` — sequential tasks, variance accumulates
- `pert_critical_path` — parallel tasks present; critical path drives the portfolio tail

Flag if P90 exceeds the sum of individual P50s by >15% — indicates compounding tail risk.

## 4n. Sensitivity Analysis
From `results[i].sensitivity`: show top 3 levers by absolute gain.
Format: "Most powerful lever: [slider] — each 1-point move changes P(hit target) by ~[gain×100]%."
If `sensitivitySkipped: true`: note the task exceeded the 5-task sensitivity limit; offer to re-run it individually.

## 4o. Scenarios
If `results[i].scenarios` present: show as a table — scenario name / P(≤target) / delta vs. baseline.
