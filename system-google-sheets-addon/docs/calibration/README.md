# Calibration Documentation

Weight tuning, sensitivity analysis, and empirical validation against real project data.

## Contents

- **CALIBRATION_LOG.md** - Evolution of weights over time with justification
- **SENSITIVITY_ANALYSIS.md** - Testing impact of weight variations
- **EMPIRICAL_VALIDATION.md** - Testing against historical projects

## Quick Navigation

**I want to understand weight tuning:**
→ Read `CALIBRATION_LOG.md` (30 min)

**I want to know which weights matter:**
→ Read `SENSITIVITY_ANALYSIS.md` (1 hour)

**I want to validate against real data:**
→ Read `EMPIRICAL_VALIDATION.md` (1-2 hours)

## What Goes Here

This folder tracks:

1. **Weight Evolution** - How weights change over time and why
2. **Sensitivity Results** - Testing what happens when weights vary
3. **Empirical Results** - How well the system predicts real outcomes

## Usage

### When Adding New Calibration Results
1. Update `CALIBRATION_LOG.md` with:
   - Version/date
   - New values
   - Motivation
   - Method used
   - Impact measured

2. Update `SENSITIVITY_ANALYSIS.md` with new testing findings

3. Update `EMPIRICAL_VALIDATION.md` with new against-real-data results

### When Making Weight Changes
Always update `CALIBRATION_LOG.md` to maintain provenance:
- What changed
- Why it changed
- What evidence supports it
- What was tested

## Data Requirements

To complete calibration, you need:
- Historical project list (30+ projects minimum)
- For each project:
  - Optimistic, Most Likely, Pessimistic estimates
  - Actual outcome (what actually happened)
  - Slider values used (or estimated retroactively)
  - Final probability predicted
  - Success/failure result

See `../validation/PHASE_1_FOUNDATION.md` for data collection methodology.

---

**Last Updated**: February 15, 2026
