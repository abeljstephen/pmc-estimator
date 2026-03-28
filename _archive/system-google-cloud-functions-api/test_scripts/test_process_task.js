/*
 * File: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/test_scripts/test_distribution.js
 * Generic test script for computing PDF/CDF and probabilities for a given distribution type.
 * Usage: node test_distribution.js
 * - Interactive: Prompts for distribution type (via numbered menu), target value (with range and default), and sliders (individual values or default).
 * - Distribution types: triangle, pert, beta, monte-carlo-raw, monte-carlo-smoothed
 * - Outputs: PDF/CDF lengths, probabilities for baseline, optimized, and user sliders, plus a summary table.
 *
 * Architectural/Code Design Roadmap:
 * 1. Strict Range Compliance Without Fallbacks:
 *    - Purpose: Prevents 'PDF points outside estimate range' and 'Invalid PDF integral'.
 * 2. Seventh Slider (userConfidence):
 *    - Purpose: Test userConfidence as a slider (0-100, mapping confident=100, somewhat_confident=50, not_confident=0).
 * 3. Numerical Stability:
 *    - Purpose: Prevents NaN/Infinity in copula and reshaping.
 * 4. Robust Error Handling:
 *    - Purpose: Validate inputs/outputs, handle copula and CDF failures, ensure clear error reporting.
 * 5. Correct Distribution Shape:
 *    - Purpose: Ensure realistic probabilities (e.g., P(X ≤ 1800) > 0, P(X ≤ 2400) ~0.5, P(X ≤ 2700) < 1.0).
 * 6. Performance:
 *    - Objective: Achieve <50ms response time for slider updates using copula, LHS, RF, and B&B.
 *
 * Change Log (Grouped by Fix):
 * - Fix 1 (Optimization Failure):
 *   - [2025-09-02] Increased optimizeSliders timeout to 100ms, enhanced error logging.
 * - Fix 4 (Performance):
 *   - [2025-09-02] Added detailed timing logs for diagnostics.
 * - Fix 5 (Execution Time):
 *   - [2025-09-02] Verified performance.now() calculations with single timers.
 *
 * Mathematical Principles:
 * - LHS: Stratify k=7 sliders into N=10 intervals (McKay et al., 1979).
 * - RF: P(X ≤ target) = (1/M) Σ T_m(sliders), M=5 trees (Breiman, 2001).
 * - B&B: Prune branches where upper bound < best P(X ≤ target) (Land & Doig, 1960).
 * - Copula: C(u; R) = Φ_R(Φ⁻¹(u_1), ..., Φ⁻¹(u_7)) (Sklar, 1959).
 * - Beta Distribution: f(x) = x^(α-1) (1-x)^(β-1) / B(α,β) (Mood et al., 1974).
 *
 * References:
 * - Sklar, A. (1959). Fonctions de répartition à n dimensions et leurs marges.
 * - McKay et al. (1979). Latin Hypercube Sampling.
 * - Breiman, L. (2001). Random Forests.
 * - Land & Doig (1960). Branch and Bound.
 * - Mood et al. (1974). Introduction to the Theory of Statistics.
 * - Silverman, B. W. (1986). Density Estimation.
 * - ResearchGate (2009). Modeling Multivariate Distributions Using Copulas.
 * - MDPI (2023). Adaptive LHS for Surrogate-Based Optimization.
 */

'use strict';

const path = require('path');
const readline = require('readline');
const fs = require('fs');
const CORE_DIR = path.resolve(__dirname, '..', 'core');
const { generateTrianglePoints } = require(path.join(CORE_DIR, 'baseline', 'triangle-points'));
const { generatePertPoints } = require(path.join(CORE_DIR, 'baseline', 'pert-points'));
const { generateBetaPoints } = require(path.join(CORE_DIR, 'baseline', 'beta-points'));
const { generateMonteCarloRawPoints } = require(path.join(CORE_DIR, 'baseline', 'monte-carlo-raw'));
const { generateMonteCarloSmoothedPoints } = require(path.join(CORE_DIR, 'baseline', 'monte-carlo-smoothed'));
const { computeSliderProbability } = require(path.join(CORE_DIR, 'reshaping', 'slider-adjustments'));
const { optimizeSliders } = require(path.join(CORE_DIR, 'optimization', 'slider-optimizer'));
const { interpolateCdf } = require(path.join(CORE_DIR, 'helpers', 'metrics'));
const { createErrorResponse, isValidPdfArray, isValidCdfArray } = require(path.join(CORE_DIR, 'helpers', 'validation'));

// Validate file existence
const scriptPath = path.join(__dirname, 'test_distribution.js');
try {
  fs.accessSync(scriptPath, fs.constants.R_OK);
  console.log('test_distribution.js: File found at', scriptPath);
} catch (err) {
  console.error('test_distribution.js: File not found or inaccessible', { path: scriptPath, error: err.message });
  process.exit(1);
}

try {
  require('jstat');
  require('ml-random-forest');
} catch (err) {
  console.error('Missing required dependency:', err.message);
  console.error('Install with: npm install jstat ml-random-forest');
  process.exit(1);
}

const timeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms))
  ]);
};

const optimistic = 1800;
const mostLikely = 2400;
const pessimistic = 3000;
const defaultTargetValue = mostLikely; // Default target
const useCopulaForReshaping = true;
const defaultSliders = {
  budgetFlexibility: 20,
  scheduleFlexibility: 40,
  scopeCertainty: 60,
  scopeReductionAllowance: 80,
  reworkPercentage: 0,
  riskTolerance: 100,
  userConfidence: 100
};
const validDistributions = ['triangle', 'pert', 'beta', 'monte-carlo-raw', 'monte-carlo-smoothed'];
const sliderKeys = ['budgetFlexibility', 'scheduleFlexibility', 'scopeCertainty', 'scopeReductionAllowance', 'reworkPercentage', 'riskTolerance', 'userConfidence'];
const generators = {
  'triangle': generateTrianglePoints,
  'pert': generatePertPoints,
  'beta': generateBetaPoints,
  'monte-carlo-raw': generateMonteCarloRawPoints,
  'monte-carlo-smoothed': generateMonteCarloSmoothedPoints
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Validates slider inputs.
 * @param {Object} sliders - Slider object
 * @returns {boolean}
 */
function validateSliders(sliders) {
  return sliders && typeof sliders === 'object' && sliderKeys.every(key => Number.isFinite(sliders[key]) && sliders[key] >= 0 && sliders[key] <= 100);
}

/**
 * Prompts for a single slider value.
 * @param {string} key - Slider name
 * @returns {number} - Valid slider value
 */
async function promptSliderValue(key) {
  while (true) {
    const input = await new Promise(resolve => {
      rl.question(`Enter ${key} (0-100): `, answer => {
        resolve(answer.trim());
      });
    });
    const value = parseFloat(input);
    if (!isNaN(value) && value >= 0 && value <= 100) {
      return value;
    }
    console.log(`Invalid input for ${key}. Please enter a number between 0 and 100.`);
  }
}

/**
 * Prompts for a target value within range.
 * @returns {number} - Valid target value
 */
async function promptTargetValue() {
  while (true) {
    const input = await new Promise(resolve => {
      rl.question(`Enter target value (${optimistic} to ${pessimistic}, default ${defaultTargetValue}): `, answer => {
        resolve(answer.trim());
      });
    });
    const value = input === '' ? defaultTargetValue : parseFloat(input);
    if (!isNaN(value) && value >= optimistic && value <= pessimistic) {
      return value;
    }
    console.log(`Invalid target value. Please enter a number between ${optimistic} and ${pessimistic}.`);
  }
}

/**
 * Logs a consolidated table of probabilities and slider settings.
 * @param {Object} results - Results object with baseline, user, and optimized data
 * @param {number} targetValue - Target value for probability
 */
function logConsolidatedTable(results, targetValue) {
  console.log('logConsolidatedTable: Starting');
  console.time('logConsolidatedTable');
  const { baseline, user, optimized } = results;

  const table = {
    [`Probability P(X ≤ ${targetValue})`]: {
      Baseline: baseline.probability ? (baseline.probability * 100).toFixed(2) + '%' : 'N/A',
      'User-Specified': user.probability ? (user.probability * 100).toFixed(2) + '%' : 'N/A',
      'Optimized': optimized.probability ? (optimized.probability * 100).toFixed(2) + '%' : 'N/A'
    },
    'Budget Flexibility': {
      Baseline: '0',
      'User-Specified': user.sliders ? user.sliders.budgetFlexibility : 'N/A',
      'Optimized': optimized.sliders ? optimized.sliders.budgetFlexibility : 'N/A'
    },
    'Schedule Flexibility': {
      Baseline: '0',
      'User-Specified': user.sliders ? user.sliders.scheduleFlexibility : 'N/A',
      'Optimized': optimized.sliders ? optimized.sliders.scheduleFlexibility : 'N/A'
    },
    'Scope Certainty': {
      Baseline: '0',
      'User-Specified': user.sliders ? user.sliders.scopeCertainty : 'N/A',
      'Optimized': optimized.sliders ? optimized.sliders.scopeCertainty : 'N/A'
    },
    'Scope Reduction Allowance': {
      Baseline: '0',
      'User-Specified': user.sliders ? user.sliders.scopeReductionAllowance : 'N/A',
      'Optimized': optimized.sliders ? optimized.sliders.scopeReductionAllowance : 'N/A'
    },
    'Rework Percentage': {
      Baseline: '0',
      'User-Specified': user.sliders ? user.sliders.reworkPercentage : 'N/A',
      'Optimized': optimized.sliders ? optimized.sliders.reworkPercentage : 'N/A'
    },
    'Risk Tolerance': {
      Baseline: '0',
      'User-Specified': user.sliders ? user.sliders.riskTolerance : 'N/A',
      'Optimized': optimized.sliders ? optimized.sliders.riskTolerance : 'N/A'
    },
    'User Confidence': {
      Baseline: '0',
      'User-Specified': user.sliders ? user.sliders.userConfidence : 'N/A',
      'Optimized': optimized.sliders ? optimized.sliders.userConfidence : 'N/A'
    },
    'PDF Points': {
      Baseline: baseline.pdfPointsLength || 'N/A',
      'User-Specified': user.pdfPointsLength || 'N/A',
      'Optimized': optimized.pdfPointsLength || 'N/A'
    },
    'CDF Points': {
      Baseline: baseline.cdfPointsLength || 'N/A',
      'User-Specified': user.cdfPointsLength || 'N/A',
      'Optimized': optimized.cdfPointsLength || 'N/A'
    },
    'Execution Time (ms)': {
      Baseline: baseline.time ? baseline.time.toFixed(3) : 'N/A',
      'User-Specified': user.time ? user.time.toFixed(3) : 'N/A',
      'Optimized': optimized.time ? optimized.time.toFixed(3) : 'N/A'
    }
  };

  console.log('Consolidated Distribution Test Results');
  console.log('-----------------------------------------------------------------------------------');
  console.log(`| Metric                     | Baseline           | User-Specified (Target ${targetValue}) | Optimized (Target ${targetValue}) |`);
  console.log('-----------------------------------------------------------------------------------');
  Object.entries(table).forEach(([metric, values]) => {
    console.log(`| ${metric.padEnd(26)} | ${String(values.Baseline).padEnd(18)} | ${String(values['User-Specified']).padEnd(27)} | ${String(values.Optimized).padEnd(23)} |`);
  });
  console.log('-----------------------------------------------------------------------------------');
  console.timeEnd('logConsolidatedTable');
}

/**
 * Tests a distribution for baseline, user-specified, and optimized probabilities.
 * @param {string} type - Distribution type
 * @param {Object} userSliders - User-supplied sliders
 * @param {number} targetValue - Target value for probability
 */
async function testDistribution(type, userSliders, targetValue) {
  console.log(`testDistribution: Testing distribution: ${type}`);
  console.time(`testDistribution-${type}`);
  const results = {
    baseline: { probability: null, pdfPointsLength: null, cdfPointsLength: null, time: null },
    user: { probability: null, sliders: userSliders, pdfPointsLength: null, cdfPointsLength: null, time: null },
    optimized: { probability: null, sliders: null, pdfPointsLength: null, cdfPointsLength: null, time: null }
  };

  const generator = generators[type];
  if (!generator) {
    console.error('testDistribution: Invalid distribution type', { type });
    console.timeEnd(`testDistribution-${type}`);
    return;
  }

  // (1) Baseline
  console.log('testDistribution: Computing baseline');
  let baselineTime = performance.now();
  let baseline;
  try {
    baseline = await timeout(generator({ optimistic, mostLikely, pessimistic, numSamples: 1000 }), 3);
    if (!isValidPdfArray(baseline.pdfPoints) || !isValidCdfArray(baseline.cdfPoints)) {
      throw createErrorResponse('Invalid baseline points', { baseline });
    }
    results.baseline.pdfPointsLength = baseline.pdfPoints.length;
    results.baseline.cdfPointsLength = baseline.cdfPoints.length;
    results.baseline.probability = interpolateCdf(baseline.cdfPoints, targetValue).value;
    console.log('(1) Baseline Probability:', results.baseline.probability);
  } catch (error) {
    console.error('(1) Baseline failed', { message: error.message, stack: error.stack });
  }
  results.baseline.time = performance.now() - baselineTime;
  console.log('testDistribution: Baseline time', { time: results.baseline.time });

  // (2) Optimized Sliders
  console.log('testDistribution: Computing optimized sliders');
  let optimizedTime = performance.now();
  try {
    const optimumResult = await timeout(optimizeSliders({
      points: baseline && baseline.pdfPoints ? { pdfPoints: baseline.pdfPoints, cdfPoints: baseline.cdfPoints } : null,
      optimistic,
      mostLikely,
      pessimistic,
      targetValue,
      optimizeFor: 'target',
      useCopulaForReshaping
    }), 100); // Increased timeout
    if (!optimumResult || optimumResult.error || !optimumResult.reshapedPoints || !isValidPdfArray(optimumResult.reshapedPoints.pdfPoints) || !isValidCdfArray(optimumResult.reshapedPoints.cdfPoints)) {
      throw createErrorResponse(`optimizeSliders failed: ${optimumResult?.error || 'Invalid reshapedPoints'}`, { optimumResult });
    }
    results.optimized.sliders = optimumResult.sliders;
    results.optimized.pdfPointsLength = optimumResult.reshapedPoints.pdfPoints.length;
    results.optimized.cdfPointsLength = optimumResult.reshapedPoints.cdfPoints.length;
    results.optimized.probability = interpolateCdf(optimumResult.reshapedPoints.cdfPoints, targetValue).value;
    console.log('(2) Optimized Sliders Probability:', results.optimized.probability);
  } catch (error) {
    console.error('(2) Optimized Sliders failed', { message: error.message, stack: error.stack });
  }
  results.optimized.time = performance.now() - optimizedTime;
  console.log('testDistribution: Optimized time', { time: results.optimized.time });

  // (3) User Sliders
  console.log('testDistribution: Computing user sliders', { userSliders });
  let userTime = performance.now();
  try {
    const userResult = await timeout(computeSliderProbability({
      points: baseline && baseline.pdfPoints ? { pdfPoints: baseline.pdfPoints, cdfPoints: baseline.cdfPoints } : null,
      optimistic,
      mostLikely,
      pessimistic,
      targetValue,
      sliderValues: userSliders,
      shiftDirection: targetValue < mostLikely ? -1 : 1,
      useCopulaForReshaping
    }), 3);
    if (!userResult || userResult.error || !userResult.reshapedPoints || !isValidPdfArray(userResult.reshapedPoints.pdfPoints) || !isValidCdfArray(userResult.reshapedPoints.cdfPoints)) {
      throw createErrorResponse(`computeSliderProbability failed: ${userResult?.error || 'Invalid reshapedPoints'}`, { userResult });
    }
    results.user.pdfPointsLength = userResult.reshapedPoints.pdfPoints.length;
    results.user.cdfPointsLength = userResult.reshapedPoints.cdfPoints.length;
    results.user.probability = interpolateCdf(userResult.reshapedPoints.cdfPoints, targetValue).value;
    console.log('(3) User Sliders Probability:', results.user.probability);
  } catch (error) {
    console.error('(3) User Sliders failed', { message: error.message, stack: error.stack });
  }
  results.user.time = performance.now() - userTime;
  console.log('testDistribution: User time', { time: results.user.time });

  // Output table
  try {
    logConsolidatedTable(results, targetValue);
  } catch (error) {
    console.error('logConsolidatedTable: Error', { message: error.message, stack: error.stack });
  }

  console.timeEnd(`testDistribution-${type}`);
}

/**
 * Prompts user for input and runs the test.
 */
async function main() {
  console.log('test_distribution.js: Starting');

  // Display numbered menu for distribution type
  console.log('Select distribution type:');
  validDistributions.forEach((dist, index) => {
    console.log(`${index + 1}. ${dist}`);
  });
  let distChoice;
  while (true) {
    distChoice = await new Promise(resolve => {
      rl.question('Enter number (1-5): ', answer => {
        resolve(parseInt(answer.trim()));
      });
    });
    if (!isNaN(distChoice) && distChoice >= 1 && distChoice <= validDistributions.length) {
      break;
    }
    console.log('Invalid choice. Please enter a number between 1 and', validDistributions.length);
  }
  const distributionType = validDistributions[distChoice - 1];

  // Prompt for target value
  const targetValue = await promptTargetValue();

  // Prompt for sliders
  console.log('Default sliders:', JSON.stringify(defaultSliders));
  let userSliders;
  const slidersAnswer = await new Promise(resolve => {
    rl.question('Use default sliders? (y/n): ', answer => {
      resolve(answer.trim().toLowerCase());
    });
  });
  if (slidersAnswer === 'y') {
    userSliders = defaultSliders;
  } else {
    userSliders = {};
    for (const key of sliderKeys) {
      userSliders[key] = await promptSliderValue(key);
    }
  }

  await testDistribution(distributionType, userSliders, targetValue);
  rl.close();
}

main().catch(error => {
  console.error('test_distribution.js: Error', { message: error.message, stack: error.stack });
  rl.close();
  process.exit(1);
});
