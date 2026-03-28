// File: test_scripts/test_opt.js
/*
 * Tests optimization with copula-based reshaping for targets 1800, 2400, 3000.
 * Uses LHS/RF/B&B to optimize sliders, producing a table comparing P(X ≤ target) for baseline, user-specified, and optimized distributions.
 *
 * Mathematical Principles:
 * 1. Copula Reshaping:
 *    - Formula: C(u; R) = Φ_R(Φ⁻¹(u_1), ..., Φ⁻¹(u_6)), u_i = s_i/100.
 *    - Purpose: Realistic reshaping with slider dependencies (Sklar, 1959).
 * 2. LHS/RF/B&B:
 *    - LHS: Stratify sliders (McKay et al., 1979).
 *    - RF: P(X ≤ target) = (1/M) Σ T_m(sliders) (Breiman, 2001).
 *    - B&B: Prune branches (Land & Doig, 1960).
 *
 * Fixes Applied:
 * - Added permutations for useCopulaForReshaping, maxIterations, userSlider_Confidence.
 * - Fixed zero probability for target=1800 by validating CDF range.
 * - Ensured target=3000 handling with baseline return.
 */

'use strict';

const { optimizeSliders, computeSliderProbability } = require('../core/optimization/slider-optimizer');
const { generateBaseline } = require('../core/baseline/coordinator');
const { interpolateCdf } = require('../core/helpers/metrics');

console.log('test_opt.js: Starting optimization tests');

/**
 * Logs a consolidated table of probabilities and slider settings.
 * @param {Array} results - Array of { target, baselineProb, optimizedResult, userSpecifiedResult, error }
 */
function logConsolidatedTable(results) {
  const optimistic = 1800;
  const mostLikely = 2400;
  const pessimistic = 3000;

  const defaultResult = {
    sliders: { budgetFlexibility: 0, scheduleFlexibility: 0, scopeCertainty: 0, scopeReductionAllowance: 0, reworkPercentage: 0, riskTolerance: 0 },
    reshapedPoints: { cdfPoints: [] }
  };

  const baselineProbs = { 1800: 'N/A', 2400: 'N/A', 3000: 'N/A' };
  const userSpecifiedProbs = { 1800: 'N/A', 2400: 'N/A', 3000: 'N/A' };
  const optimizedProbs = { 1800: 'N/A', 2400: 'N/A', 3000: 'N/A' };
  const userSpecifiedSliders = {
    budgetFlexibility: 20,
    scheduleFlexibility: 40,
    scopeCertainty: 60,
    scopeReductionAllowance: 80,
    reworkPercentage: 0,
    riskTolerance: 100
  };
  const optimizedSliders = {
    1800: { ...defaultResult.sliders },
    2400: { ...defaultResult.sliders },
    3000: { ...defaultResult.sliders }
  };

  results.forEach(({ target, baselineProb, optimizedResult, userSpecifiedResult, error }) => {
    baselineProbs[target] = Number.isFinite(baselineProb) ? baselineProb.toFixed(6) : 'N/A';
    userSpecifiedProbs[target] = userSpecifiedResult && Array.isArray(userSpecifiedResult.reshapedPoints.cdfPoints) && userSpecifiedResult.reshapedPoints.cdfPoints.length > 0 
      ? (interpolateCdf(userSpecifiedResult.reshapedPoints.cdfPoints, target) || 0).toFixed(6) 
      : 'N/A';
    optimizedProbs[target] = optimizedResult && Array.isArray(optimizedResult.reshapedPoints.cdfPoints) && optimizedResult.reshapedPoints.cdfPoints.length > 0 
      ? (interpolateCdf(optimizedResult.reshapedPoints.cdfPoints, target) || 0).toFixed(6) 
      : 'N/A';
    optimizedSliders[target] = optimizedResult ? optimizedResult.sliders : { ...defaultResult.sliders };
    if (error) {
      console.warn(`logConsolidatedTable: Error for target ${target}`, { error });
    }
  });

  console.log('Consolidated Optimization Results Table');
  console.log('-----------------------------------------------------------------------------------');
  console.log('| Metric                     | Baseline (All Zero) | User-specified (Target 1800) | Optimized (Target 1800) | Optimized (Target 2400) | Optimized (Target 3000) |');
  console.log('-----------------------------------------------------------------------------------');
  console.log(`| Optimistic (${optimistic})       | ${baselineProbs[1800]}         | ${userSpecifiedProbs[1800]}         | ${optimizedProbs[1800]}         | ${optimizedProbs[2400]}         | ${optimizedProbs[3000]}         |`);
  console.log(`| Most Likely (${mostLikely})      | ${baselineProbs[2400]}         | ${userSpecifiedProbs[2400]}         | ${optimizedProbs[1800]}         | ${optimizedProbs[2400]}         | ${optimizedProbs[3000]}         |`);
  console.log(`| Pessimistic (${pessimistic})      | ${baselineProbs[3000]}         | ${userSpecifiedProbs[3000]}         | ${optimizedProbs[1800]}         | ${optimizedProbs[2400]}         | ${optimizedProbs[3000]}         |`);
  console.log('-----------------------------------------------------------------------------------');
  console.log(`| Budget Flexibility         | 0                  | ${userSpecifiedSliders.budgetFlexibility}         | ${optimizedSliders[1800].budgetFlexibility}         | ${optimizedSliders[2400].budgetFlexibility}         | ${optimizedSliders[3000].budgetFlexibility}         |`);
  console.log(`| Schedule Flexibility       | 0                  | ${userSpecifiedSliders.scheduleFlexibility}         | ${optimizedSliders[1800].scheduleFlexibility}         | ${optimizedSliders[2400].scheduleFlexibility}         | ${optimizedSliders[3000].scheduleFlexibility}         |`);
  console.log(`| Scope Certainty            | 0                  | ${userSpecifiedSliders.scopeCertainty}         | ${optimizedSliders[1800].scopeCertainty}         | ${optimizedSliders[2400].scopeCertainty}         | ${optimizedSliders[3000].scopeCertainty}         |`);
  console.log(`| Scope Reduction Allowance  | 0                  | ${userSpecifiedSliders.scopeReductionAllowance}         | ${optimizedSliders[1800].scopeReductionAllowance}         | ${optimizedSliders[2400].scopeReductionAllowance}         | ${optimizedSliders[3000].scopeReductionAllowance}         |`);
  console.log(`| Rework Percentage          | 0                  | ${userSpecifiedSliders.reworkPercentage}         | ${optimizedSliders[1800].reworkPercentage}         | ${optimizedSliders[2400].reworkPercentage}         | ${optimizedSliders[3000].reworkPercentage}         |`);
  console.log(`| Risk Tolerance             | 0                  | ${userSpecifiedSliders.riskTolerance}         | ${optimizedSliders[1800].riskTolerance}         | ${optimizedSliders[2400].riskTolerance}         | ${optimizedSliders[3000].riskTolerance}         |`);
  console.log('-----------------------------------------------------------------------------------');
}

/**
 * Tests optimization with permutations.
 */
async function testOptimization() {
  console.log('testOptimization: Starting');
  const results = [];
  try {
    // Generate baseline
    let baseline;
    try {
      console.log('testOptimization: Attempting to generate baseline');
      baseline = await generateBaseline({
        optimistic: 1800,
        mostLikely: 2400,
        pessimistic: 3000,
        numSamples: 1000
      });
      if (!Array.isArray(baseline.monteCarloSmoothedPoints.pdfPoints) || !Array.isArray(baseline.monteCarloSmoothedPoints.cdfPoints)) {
        throw new Error('Invalid baseline Monte Carlo points');
      }
      console.log('testOptimization: Baseline generated', { pdfPointsLength: baseline.monteCarloSmoothedPoints.pdfPoints.length });
    } catch (err) {
      console.error('testOptimization: Baseline generation failed', { message: err.message, stack: err.stack });
      throw err;
    }

    const pdfPoints = baseline.monteCarloSmoothedPoints.pdfPoints;
    const cdfPoints = baseline.monteCarloSmoothedPoints.cdfPoints;

    // Permutations: targets, copula usage, confidence levels
    const permutations = [
      { target: 1800, useCopulaForReshaping: true, userSlider_Confidence: 'confident' },
      { target: 1800, useCopulaForReshaping: false, userSlider_Confidence: 'confident' },
      { target: 2400, useCopulaForReshaping: true, userSlider_Confidence: 'confident' },
      { target: 2400, useCopulaForReshaping: false, userSlider_Confidence: 'somewhat_confident' },
      { target: 3000, useCopulaForReshaping: true, userSlider_Confidence: 'confident' }
    ];

    for (const { target, useCopulaForReshaping, userSlider_Confidence } of permutations) {
      console.log(`\n=== Testing optimization with target: ${target}, copula: ${useCopulaForReshaping}, confidence: ${userSlider_Confidence} ===`);
      let baselineProb = 0;
      let optimizedResult = null;
      let userSpecifiedResult = null;
      let error = null;
      try {
        // Compute baseline probability
        baselineProb = interpolateCdf(cdfPoints, target);
        if (!Number.isFinite(baselineProb)) {
          throw new Error('Invalid baseline probability');
        }
        console.log('testOptimization: Baseline probability computed', { target, baselineProb });

        // Compute user-specified probability for target 1800
        if (target === 1800) {
          userSpecifiedResult = await computeSliderProbability({
            points: pdfPoints,
            optimistic: 1800,
            mostLikely: 2400,
            pessimistic: 3000,
            targetValue: target,
            sliderValues: {
              budgetFlexibility: 20,
              scheduleFlexibility: 40,
              scopeCertainty: 60,
              scopeReductionAllowance: 80,
              reworkPercentage: 0,
              riskTolerance: 100
            },
            userSlider_Confidence,
            shiftDirection: target <= 2400 ? -1 : 1
          });
          console.log('testOptimization: User-specified probability computed', { target, userSpecifiedProb: userSpecifiedResult.probability });
        }

        // Optimize sliders
        optimizedResult = await optimizeSliders({
          points: pdfPoints,
          optimistic: 1800,
          mostLikely: 2400,
          pessimistic: 3000,
          targetValue: target,
          userSlider_Confidence,
          optimizeFor: 'target',
          useCopulaForReshaping
        });
        const optimizedProb = interpolateCdf(optimizedResult.reshapedPoints.cdfPoints, target);
        console.log('testOptimization: Optimized Sliders:', optimizedResult.sliders, 'Probability:', optimizedProb);
        results.push({ target, baselineProb, optimizedResult, userSpecifiedResult, error });
      } catch (err) {
        console.error(`testOptimization: Error for target ${target}`, { message: err.message, stack: err.stack });
        error = err.message || 'Unknown error';
        results.push({ target, baselineProb, optimizedResult, userSpecifiedResult, error });
      }
    }

    // Log consolidated table
    try {
      logConsolidatedTable(results);
    } catch (err) {
      console.error('testOptimization: Error logging table', { message: err.message, stack: err.stack });
    }

    console.log('testOptimization: Completed successfully');
  } catch (err) {
    console.error('testOptimization: Error', { message: err.message, stack: err.stack });
    throw err;
  }
}

testOptimization();
