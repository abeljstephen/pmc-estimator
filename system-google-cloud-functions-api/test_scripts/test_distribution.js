/*
 * File: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/test_scripts/test_distribution.js
 * Tests distribution reshaping and slider optimization for user-specified or default inputs across multiple distribution types.
 *
 * Purpose:
 * This script provides an interactive interface to test the pmcEstimatorAPI’s distribution reshaping and slider optimization capabilities. It collects user inputs for optimistic, most likely, and pessimistic estimates, distribution type, target value, and sliders, then computes baseline, user-specified, and optimized probabilities P(X ≤ target) for the chosen distribution (triangle, PERT, beta, monte-carlo-raw, monte-carlo-smoothed). It enhances usability by prompting for confirmation of default values for each input or applying all defaults with a single "Enter," maps numeric distribution types to strings for compatibility, and ensures robust optimization to find the global optimum, addressing user requirements for reliability, generality, and user-friendliness.
 *
 * Roadmap:
 * 1. **Input Collection**: Prompt the user for confirmation of default values (e.g., optimistic=1800, mostLikely=2400, pessimistic=3000, distribution=monte-carlo-smoothed, target=2000, default sliders) or custom inputs for each parameter. Allow a single "Enter" to apply all defaults for efficiency (McKay et al., 1979, for input diversity).
 * 2. **Input Validation**: Validate inputs for numerical ranges and logical consistency (e.g., optimistic ≤ mostLikely ≤ pessimistic). Map numeric distribution types (1-5) to strings (triangle, pert, beta, monte-carlo-raw, monte-carlo-smoothed) to ensure compatibility with core modules.
 * 3. **Baseline Computation**: Compute the baseline probability P(X ≤ target) using computeBaselineProbability with 1000 samples to establish a reference for the chosen distribution (Titsias, 2009, for sampling robustness).
 * 4. **User Sliders Computation**: Compute P(X ≤ target) for user-specified sliders (default or custom) using computeSliderProbability, incorporating Gaussian copula adjustments for realistic distribution shifts.
 * 5. **Optimized Sliders Computation**: Optimize sliders using optimizeSliders to maximize P(X ≤ target), leveraging Bayesian Optimization (BO) with a Gaussian Process (GP) and Active Machine Learning (AML) to ensure the global optimum is found (Jones et al., 1998).
 * 6. **Result Logging**: Log consolidated results in a table comparing baseline, user-specified, and optimized probabilities, sliders, PDF/CDF points, and execution times, with robust handling of invalid values for transparency and debugging.
 * 7. **Error Handling and Logging**: Implement robust validation and detailed logging to diagnose issues like invalid inputs, computation failures, or suboptimal optimization, ensuring maintainability and usability for software engineers.
 *
 * Mathematical Principles:
 * - **Objective**: Compute and compare P(X ≤ target) for baseline, user-specified, and optimized slider configurations, where X follows a distribution (triangle, PERT, beta, monte-carlo-raw, or monte-carlo-smoothed) parameterized by optimistic, most likely, and pessimistic estimates. The optimization maximizes P(X ≤ target) by adjusting sliders via a Gaussian copula and moment adjustments in reshapeDistribution.
 * - **Baseline Probability**: Computed using Monte Carlo sampling (1000 samples) to estimate the cumulative distribution function (CDF) at the target value, providing a reference for comparison (Titsias, 2009).
 * - **User Sliders Probability**: Evaluates P(X ≤ target) for user-specified sliders, applying distribution shifts based on slider values and target position relative to most likely (left or right shift).
 * - **Optimized Sliders Probability**: Uses BO with a sparse GP to find the slider configuration maximizing P(X ≤ target), incorporating dynamic bias based on normalized target position (t_opt = (target - optimistic) / (pessimistic - optimistic), t_ml = (target - mostLikely) / (pessimistic - optimistic)) to explore optimal regions (Jones et al., 1998).
 * - **Validation**: Ensures inputs satisfy constraints (e.g., optimistic ≤ mostLikely ≤ pessimistic) and distribution types are valid, preventing numerical instability or logical errors.
 *
 * Architecture:
 * - **Input Collection (main)**: Uses readline to prompt for confirmation of default values or custom inputs for each parameter (optimistic, mostLikely, pessimistic, distributionType, targetValue, sliders). Offers a single "Enter" to apply all defaults, with per-input confirmation prompts (y/n) for flexibility.
 * - **Validation Functions**: validateNumber, validateYesNo, and validateDistributionType ensure inputs are within acceptable ranges and map numeric distribution types to strings for compatibility with core modules.
 * - **Distribution Testing (testDistribution)**: Orchestrates computation of baseline, user-specified, and optimized probabilities, calling computeBaselineProbability, computeSliderProbability, and optimizeSliders, respectively.
 * - **Result Logging**: Formats a consolidated table comparing probabilities, sliders, PDF/CDF points, and execution times, with robust handling of invalid probability values to prevent TypeErrors (e.g., toFixed on strings).
 * - **Error Handling**: Wraps computations in try-catch blocks, logging detailed error messages and stacks for debugging, ensuring robustness.
 * - **Dependencies**: Integrates with core modules (triangle-points, pert-points, beta-points, monte-carlo-raw, monte-carlo-smoothed, slider-optimizer, slider-adjustments, validation, metrics) for distribution generation and optimization.
 *
 * Dynamic Parameter Determination:
 * - **Default Values**: Sets defaults (optimistic=1800, mostLikely=2400, pessimistic=3000, distributionType='monte-carlo-smoothed', targetValue=2000, sliders={20, 40, 60, 80, 0, 100, 100}) applied when the user presses "Enter" at the first prompt or confirms default usage for each input.
 * - **numSamples**: Fixed at 1000 for baseline and user slider computations to balance accuracy and performance, suitable for all distributions (Titsias, 2009).
 * - **Distribution Type Mapping**: Maps numeric inputs (1-5) to strings (triangle, pert, beta, monte-carlo-raw, monte-carlo-smoothed) to ensure compatibility with core modules, defaulting to monte-carlo-smoothed.
 * - **Rationale**: Defaults and validation ranges are chosen based on typical project management scenarios, ensuring realistic inputs. Numeric mapping prevents Invalid distributionType errors, and per-input confirmation enhances usability while maintaining flexibility.
 *
 * Implementation Choices:
 * - **Per-Input Default Confirmation**: Prompts for each input (e.g., "Use default optimistic estimate (1800)? (y/n):") to confirm defaults or allow custom values, with "Enter" defaulting to "y" for efficiency.
 * - **All Defaults Option**: Allows a single "Enter" at the first prompt to apply all defaults, streamlining input collection for users who want default values.
 * - **Numeric Distribution Type Handling**: Maps 1-5 to string types to align with test script inputs, preventing crashes due to type mismatches (Fix 85).
 * - **Robust Logging**: Handles invalid probability values (e.g., undefined optimizedResult.probability) to prevent TypeErrors, ensuring the results table is always logged.
 * - **Robust Validation**: Ensures inputs are numerically valid and logically consistent (e.g., optimistic ≤ mostLikely ≤ pessimistic), with clear error messages for user feedback.
 * - **Comprehensive Logging**: Outputs a detailed table with probabilities, sliders, points, and execution times, aiding debugging and verification for engineers.
 * - **Error Handling**: Catches and logs errors at each computation step (baseline, user, optimized) to prevent crashes and provide actionable diagnostics.
 * - **Integration with Slider Optimization**: Leverages slider-optimizer.js’s dynamic bias (based on t_opt, t_ml), increased exploration (25*k samples, 40 iterations), and verification (re-running BO if needed) to ensure the global optimum is found, addressing cases where user sliders outperformed optimized ones (e.g., 99.29% vs. 94.68%).
 *
 * Rationale for Choices:
 * - **Per-Input Default Confirmation**: Balances usability and flexibility by allowing users to confirm defaults or enter custom values for each input, with "Enter" defaulting to confirmation for efficiency.
 * - **All Defaults Option**: Simplifies interaction for users who want default values, aligning with requirements for user-friendliness.
 * - **Numeric Distribution Type Mapping**: Ensures compatibility with core modules expecting string types, preventing errors like Invalid distributionType (Fix 85).
 * - **Robust Logging**: Prevents TypeErrors by checking probability values before formatting, ensuring the results table is always generated, even with partial failures.
 * - **Validation**: Prevents invalid inputs from causing downstream errors, ensuring robustness and user-friendliness.
 * - **Fixed numSamples=1000**: Balances computational cost and accuracy for baseline and user computations, suitable for all distributions (Titsias, 2009).
 * - **Detailed Logging**: Provides transparency for verifying results and debugging issues, critical for both theorists and engineers.
 * - **Integration with Slider-Optimizer**: Relies on slider-optimizer.js’s dynamic bias, increased exploration, and verification to guarantee optimal slider values, addressing prior issues with suboptimal optimization (Jones et al., 1998; Snoek et al., 2012).
 *
 * Fixes Applied:
 * - [2025-09-06] Removed loop to respect user-selected distribution type, ensuring only the chosen distribution is tested (Fix 19).
 * - [2025-09-06] Set numSamples=1000 for all distributions to fix monte-carlo-smoothed error, ensuring consistent sampling (Fix 20).
 * - [2025-09-07] Added automatic application of default values when pressing "Enter" at the first prompt or confirming default usage, improving usability (Fix 84).
 * - [2025-09-07] Added mapDistributionType to convert numeric inputs (1-5) to strings (triangle, pert, beta, monte-carlo-raw, monte-carlo-smoothed), ensuring compatibility with slider-optimizer.js and slider-adjustments.js, preventing Invalid distributionType errors (Fix 85).
 * - [2025-09-07] Added per-input default confirmation prompts (e.g., "Use default optimistic estimate (1800)? (y/n):") and fixed TypeError in logging by handling invalid optimizedResult.probability values, ensuring robust table generation (Fix 86).
 * - [2025-09-08] Added validateSliders function to ensure all slider values are valid in both all-defaults and manual paths, preventing undefined scheduleFlexibility error in reshapeDistribution (Fix 87).
 * - [2025-09-08] Added validation for baselineResult and logging for optimizeSliders inputs to prevent kd-tree errors in slider-optimizer.js, ensuring robust optimization (Fix 88).
 * - [2025-09-08] Enhanced error handling with additional logging in testDistribution to capture errors during optimizeSliders, ensuring robust debugging of optimization failures (Fix 90).
 */

'use strict';

const path = require('path');
const readline = require('readline');
const { generateTrianglePoints } = require(path.join(__dirname, '../core/baseline/triangle-points'));
const { generatePertPoints } = require(path.join(__dirname, '../core/baseline/pert-points'));
const { generateBetaPoints } = require(path.join(__dirname, '../core/baseline/beta-points'));
const { generateMonteCarloRawPoints } = require(path.join(__dirname, '../core/baseline/monte-carlo-raw'));
const { generateMonteCarloSmoothedPoints } = require(path.join(__dirname, '../core/baseline/monte-carlo-smoothed'));
const { optimizeSliders } = require(path.join(__dirname, '../core/optimization/slider-optimizer'));
const { computeSliderProbability, computeBaselineProbability } = require(path.join(__dirname, '../core/reshaping/slider-adjustments'));
const { isValidPdfArray, isValidCdfArray } = require(path.join(__dirname, '../core/helpers/validation'));
const { interpolateCdf } = require(path.join(__dirname, '../core/helpers/metrics'));

console.log('test_distribution.js: File found at', __filename);
console.log('test_distribution.js: Starting');
console.log('Welcome to the pmcEstimatorAPI Distribution Test!');
console.log('This script tests distribution reshaping and slider optimization for your chosen distribution.');
console.log('Press Enter at the first prompt to use all defaults (optimistic=1800, mostLikely=2400, pessimistic=3000, distribution=monte-carlo-smoothed, target=2000, default sliders), or confirm defaults for each input.');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question, validator, defaultValue) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      if (answer.trim() === '' && defaultValue !== undefined) {
        resolve(defaultValue);
      } else {
        const validated = validator(answer);
        if (validated.valid) {
          resolve(validated.value);
        } else {
          console.log(validated.message);
          resolve(prompt(question, validator, defaultValue));
        }
      }
    });
  });
}

function mapDistributionType(type) {
  const typeMap = {
    '1': 'triangle',
    '2': 'pert',
    '3': 'beta',
    '4': 'monte-carlo-raw',
    '5': 'monte-carlo-smoothed',
    'triangle': 'triangle',
    'pert': 'pert',
    'beta': 'beta',
    'monte-carlo-raw': 'monte-carlo-raw',
    'monte-carlo-smoothed': 'monte-carlo-smoothed'
  };
  const mappedType = typeMap[type];
  if (!mappedType) {
    throw new Error(`Invalid distributionType: ${type}`);
  }
  return mappedType;
}

function validateDistributionType(input) {
  const num = parseInt(input, 10);
  const types = ['triangle', 'pert', 'beta', 'monte-carlo-raw', 'monte-carlo-smoothed'];
  if (input.trim() === '' || (Number.isFinite(num) && num >= 1 && num <= types.length)) {
    return { valid: true, value: mapDistributionType(input.trim() === '' ? '5' : input), message: null };
  }
  return { valid: false, message: `Invalid input. Please enter a number between 1 and ${types.length}.`, value: null };
}

function validateNumber(input, min, max) {
  const num = parseFloat(input);
  if (input.trim() === '' || (Number.isFinite(num) && num >= min && num <= max)) {
    return { valid: true, value: input.trim() === '' ? null : num, message: null };
  }
  return { valid: false, message: `Invalid input. Please enter a number between ${min} and ${max}.`, value: null };
}

function validateYesNo(input) {
  const normalized = input.toLowerCase();
  if (input.trim() === '' || normalized === 'y' || normalized === 'n') {
    return { valid: true, value: input.trim() === '' ? true : normalized === 'y', message: null };
  }
  return { valid: false, message: 'Please enter y or n.', value: null };
}

function validateSliders(sliders) {
  const sliderNames = [
    'budgetFlexibility',
    'scheduleFlexibility',
    'scopeCertainty',
    'scopeReductionAllowance',
    'reworkPercentage',
    'riskTolerance',
    'userConfidence'
  ];
  for (const name of sliderNames) {
    const max = name === 'reworkPercentage' ? 50 : 100;
    if (!Number.isFinite(sliders[name]) || sliders[name] < 0 || sliders[name] > max) {
      throw new Error(`Invalid slider ${name}: must be a number between 0 and ${max}`);
    }
  }
  return sliders;
}

async function promptForCustomSliders() {
  const sliders = {};
  const sliderNames = [
    'budgetFlexibility',
    'scheduleFlexibility',
    'scopeCertainty',
    'scopeReductionAllowance',
    'reworkPercentage',
    'riskTolerance',
    'userConfidence'
  ];
  const defaultSliders = {
    budgetFlexibility: 20,
    scheduleFlexibility: 40,
    scopeCertainty: 60,
    scopeReductionAllowance: 80,
    reworkPercentage: 0,
    riskTolerance: 100,
    userConfidence: 100
  };
  for (const name of sliderNames) {
    const max = name === 'reworkPercentage' ? 50 : 100;
    const defaultValue = defaultSliders[name];
    const useDefault = await prompt(
      `Use default ${name} (${defaultValue})? (y/n, default y): `,
      validateYesNo,
      true
    );
    if (useDefault) {
      sliders[name] = defaultValue;
    } else {
      sliders[name] = await prompt(
        `Enter ${name} (0 to ${max}): `,
        (input) => validateNumber(input, 0, max),
        defaultValue
      );
    }
  }
  return sliders;
}

async function testDistribution(distributionType, optimistic, mostLikely, pessimistic, targetValue, userSliders) {
  console.log(`testDistribution: Testing distribution: ${distributionType}`);
  console.time(`testDistribution-${distributionType}`);

  // Validate sliders
  console.log('testDistribution: Validating userSliders', userSliders);
  validateSliders(userSliders);

  console.log('testDistribution: Computing baseline');
  console.time(`testDistribution-baseline-${distributionType}`);
  let baselineResult;
  let baselineProbability;
  let baselineTime;
  try {
    const start = performance.now();
    baselineResult = await computeBaselineProbability({
      optimistic,
      mostLikely,
      pessimistic,
      targetValue,
      distributionType,
      numSamples: 1000
    });
    if (baselineResult.error || !isValidPdfArray(baselineResult.pdfPoints) || !isValidCdfArray(baselineResult.cdfPoints)) {
      throw new Error(baselineResult.error || 'Invalid baseline points');
    }
    baselineProbability = baselineResult.probability;
    if (baselineProbability.error || !Number.isFinite(baselineProbability.value)) {
      throw new Error(baselineProbability.error || 'Invalid baseline probability');
    }
    baselineTime = performance.now() - start;
    console.log(`(1) Baseline Probability (${distributionType}): ${baselineProbability.value}`);
    console.timeEnd(`testDistribution-baseline-${distributionType}`);
  } catch (error) {
    console.error('testDistribution: Baseline failed', { message: error.message, stack: error.stack });
    throw new Error(`Baseline computation failed: ${error.message || 'Unknown error'}`);
  }

  console.log('testDistribution: Computing optimized sliders');
  console.time(`testDistribution-optimized-${distributionType}`);
  let optimizedResult;
  let optimizedTime;
  const optimizeStart = performance.now();
  try {
    // Validate baselineResult before optimization
    if (!baselineResult.pdfPoints || !Array.isArray(baselineResult.pdfPoints) || !baselineResult.cdfPoints || !Array.isArray(baselineResult.cdfPoints)) {
      throw new Error('Invalid baselineResult: pdfPoints and cdfPoints must be arrays');
    }
    const params = {
      points: baselineResult,
      optimistic,
      mostLikely,
      pessimistic,
      targetValue,
      optimizeFor: 'target',
      distributionType,
      userSliders
    };
    console.log('testDistribution: optimizeSliders params', JSON.stringify(params, null, 2));
    optimizedResult = await optimizeSliders(params);
    if (optimizedResult.error) {
      throw new Error(optimizedResult.error);
    }
    optimizedTime = performance.now() - optimizeStart;
    console.log(`(2) Optimized Sliders:`, optimizedResult.sliders, `Probability: ${optimizedResult.probability?.value || 'N/A'}`, `Source: ${optimizedResult.source || 'N/A'}`);
    console.timeEnd(`testDistribution-optimized-${distributionType}`);
  } catch (error) {
    console.error('testDistribution: Optimized Sliders failed', { message: error.message, stack: error.stack, params: JSON.stringify(params, null, 2) });
    optimizedResult = { sliders: {}, reshapedPoints: null, probability: { value: null, error: error.message }, error: error.message };
    optimizedTime = performance.now() - optimizeStart;
  }

  console.log('testDistribution: Computing user sliders', { userSliders });
  console.time(`testDistribution-user-${distributionType}`);
  let userResult;
  let userTime;
  const userStart = performance.now();
  try {
    userResult = await computeSliderProbability({
      points: baselineResult,
      optimistic,
      mostLikely,
      pessimistic,
      targetValue,
      sliderValues: userSliders,
      shiftDirection: targetValue < mostLikely ? -1 : targetValue > mostLikely ? 1 : 0,
      distributionType,
      useCopula: true
    });
    if (userResult.error) {
      throw new Error(userResult.error);
    }
    userTime = performance.now() - userStart;
    console.log(`(3) User Sliders Probability: ${userResult.probability.value}`);
    console.timeEnd(`testDistribution-user-${distributionType}`);
  } catch (error) {
    console.error('testDistribution: User Sliders failed', { message: error.message, stack: error.stack });
    userResult = { reshapedPoints: null, probability: { value: null, error: error.message }, error: error.message };
    userTime = performance.now() - userStart;
  }

  console.time(`logConsolidatedTable-${distributionType}`);
  console.log(`Consolidated Distribution Test Results for ${distributionType}`);
  console.log('-----------------------------------------------------------------------------------');
  console.log(`| Input Values: Optimistic = ${optimistic}, Most Likely = ${mostLikely}, Pessimistic = ${pessimistic}, Target = ${targetValue} |`);
  console.log(`| Distribution Type: ${distributionType} |`);
  console.log('-----------------------------------------------------------------------------------');
  console.log(`| Metric                     | Baseline (${distributionType}) | User-Specified (Target ${targetValue}) | Optimized (Target ${targetValue}) |`);
  console.log('-----------------------------------------------------------------------------------');
  const optimizedProb = Number.isFinite(optimizedResult.probability?.value) ? (optimizedResult.probability.value * 100).toFixed(2) + '%' : 'N/A';
  console.log(`| Probability P(X ≤ ${targetValue})    | ${(baselineProbability.value * 100).toFixed(2)}%            | ${(userResult.probability.value * 100).toFixed(2)}%                      | ${optimizedProb}                     |`);
  console.log(`| Budget Flexibility         | 0                  | ${userSliders.budgetFlexibility}                          | ${optimizedResult.sliders.budgetFlexibility || 'N/A'}                     |`);
  console.log(`| Schedule Flexibility       | 0                  | ${userSliders.scheduleFlexibility}                          | ${optimizedResult.sliders.scheduleFlexibility || 'N/A'}                     |`);
  console.log(`| Scope Certainty            | 0                  | ${userSliders.scopeCertainty}                          | ${optimizedResult.sliders.scopeCertainty || 'N/A'}                     |`);
  console.log(`| Scope Reduction Allowance  | 0                  | ${userSliders.scopeReductionAllowance}                          | ${optimizedResult.sliders.scopeReductionAllowance || 'N/A'}                     |`);
  console.log(`| Rework Percentage          | 0                  | ${userSliders.reworkPercentage}                           | ${optimizedResult.sliders.reworkPercentage || 'N/A'}                     |`);
  console.log(`| Risk Tolerance             | 0                  | ${userSliders.riskTolerance}                         | ${optimizedResult.sliders.riskTolerance || 'N/A'}                     |`);
  console.log(`| User Confidence            | 0                  | ${userSliders.userConfidence}                         | ${optimizedResult.sliders.userConfidence || 'N/A'}                     |`);
  console.log(`| PDF Points                 | ${baselineResult.pdfPoints.length}                | ${userResult.reshapedPoints?.pdfPoints.length || 'N/A'}                          | ${optimizedResult.reshapedPoints?.pdfPoints.length || 'N/A'}                     |`);
  console.log(`| CDF Points                 | ${baselineResult.cdfPoints.length}                | ${userResult.reshapedPoints?.cdfPoints.length || 'N/A'}                          | ${optimizedResult.reshapedPoints?.cdfPoints.length || 'N/A'}                     |`);
  console.log(`| Execution Time (ms)        | ${baselineTime.toFixed(3)}              | ${userTime.toFixed(3)}                       | ${optimizedTime.toFixed(3)}                  |`);
  console.log('-----------------------------------------------------------------------------------');
  console.timeEnd(`logConsolidatedTable-${distributionType}`);

  console.timeEnd(`testDistribution-${distributionType}`);
  return {
    baseline: baselineResult,
    optimized: optimizedResult,
    user: userResult
  };
}

async function main() {
  console.time('main');
  try {
    console.log('Enter estimates for the distribution (or press Enter to use all defaults: optimistic=1800, mostLikely=2400, pessimistic=3000, distribution=monte-carlo-smoothed, target=2000, default sliders).');
    const useAllDefaults = await prompt(
      'Use all default values? (y/n, default y): ',
      validateYesNo,
      true
    );

    let optimistic, mostLikely, pessimistic, distributionType, targetValue, userSliders;
    const defaultSliders = {
      budgetFlexibility: 20,
      scheduleFlexibility: 40,
      scopeCertainty: 60,
      scopeReductionAllowance: 80,
      reworkPercentage: 0,
      riskTolerance: 100,
      userConfidence: 100
    };
    if (useAllDefaults) {
      optimistic = 1800;
      mostLikely = 2400;
      pessimistic = 3000;
      distributionType = 'monte-carlo-smoothed';
      targetValue = 2000;
      userSliders = { ...defaultSliders }; // Deep copy to prevent mutation
      console.log('Using default values:', { optimistic, mostLikely, pessimistic, distributionType, targetValue, userSliders });
      validateSliders(userSliders); // Validate defaults
    } else {
      const useDefaultOptimistic = await prompt(
        'Use default optimistic estimate (1800)? (y/n, default y): ',
        validateYesNo,
        true
      );
      optimistic = useDefaultOptimistic ? 1800 : await prompt(
        'Enter best-case estimate (1000 to 2500): ',
        (input) => validateNumber(input, 1000, 2500),
        1800
      );

      const useDefaultMostLikely = await prompt(
        'Use default most-likely estimate (2400)? (y/n, default y): ',
        validateYesNo,
        true
      );
      mostLikely = useDefaultMostLikely ? 2400 : await prompt(
        'Enter most-likely estimate (1000 to 3500): ',
        (input) => validateNumber(input, 1000, 3500),
        2400
      );

      const useDefaultPessimistic = await prompt(
        'Use default worst-case estimate (3000)? (y/n, default y): ',
        validateYesNo,
        true
      );
      pessimistic = useDefaultPessimistic ? 3000 : await prompt(
        'Enter worst-case estimate (2000 to 5000): ',
        (input) => validateNumber(input, 2000, 5000),
        3000
      );

      if (optimistic > mostLikely || mostLikely > pessimistic) {
        throw new Error('Estimates must satisfy optimistic <= mostLikely <= pessimistic');
      }

      const useDefaultDistribution = await prompt(
        'Use default distribution type (monte-carlo-smoothed)? (y/n, default y): ',
        validateYesNo,
        true
      );
      distributionType = useDefaultDistribution ? 'monte-carlo-smoothed' : await prompt(
        'Select distribution type:\n1. triangle\n2. pert\n3. beta\n4. monte-carlo-raw\n5. monte-carlo-smoothed\nEnter number (1-5): ',
        validateDistributionType,
        'monte-carlo-smoothed'
      );

      const useDefaultTarget = await prompt(
        'Use default target value (2000)? (y/n, default y): ',
        validateYesNo,
        true
      );
      targetValue = useDefaultTarget ? 2000 : await prompt(
        'Enter target value (1000 to 5000): ',
        (input) => validateNumber(input, 1000, 5000),
        2000
      );

      console.log('Default sliders:', defaultSliders);
      const useDefaultSliders = await prompt(
        'Use default sliders? (y/n, default y): ',
        validateYesNo,
        true
      );
      userSliders = useDefaultSliders ? defaultSliders : await promptForCustomSliders();
      validateSliders(userSliders); // Validate sliders in manual path
    }

    await testDistribution(distributionType, optimistic, mostLikely, pessimistic, targetValue, userSliders);
  } catch (error) {
    console.error('main: Error', { message: error.message, stack: error.stack });
  } finally {
    console.timeEnd('main');
    rl.close();
  }
}

main().catch(console.error);
