/*
 * File: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/test_scripts/test_code_gs.js
 * Tests local processing of multiple rows, mimicking the Google Sheets script (Code.gs) to diagnose issues with pmcEstimatorAPI response format.
 *
 * Purpose:
 * This script simulates the behavior of the Google Sheets script (Code.gs) by locally processing multiple rows of task data, each containing optimistic, most likely, and pessimistic estimates, sliders, target value, and distribution type. It uses the same core logic as test_distribution.js (computeBaselineProbability, computeSliderProbability, optimizeSliders) to compute probabilities, confidence intervals, and reshaped points for each distribution type (triangle, pert, beta, monte-carlo-raw, monte-carlo-smoothed). The script aims to diagnose Google Sheets issues like repeating values (90.00%, 50, 0.05, 0.01, N/A confidence intervals), empty MC Smoothed Points and CDF Points, and Row 8 errors, without requiring HTTP API calls or external dependencies like node-fetch or google-auth-library.
 *
 * Roadmap:
 * 1. **Sample Data**: Define sample rows mimicking Google Sheets data (task name, estimates, sliders, target value, distribution type) to test multiple scenarios.
 * 2. **Local Processing**: For each row and distribution type, compute baseline probability, user-specified probability, optimized sliders, and confidence intervals using core modules.
 * 3. **Confidence Intervals**: Calculate 95% confidence intervals from cdfPoints to match the API response structure.
 * 4. **Additional Metrics**: Compute PERT mean, baseline/optimized probabilities for target = optimistic, Monte Carlo smoothed sensitivity change, and KL divergence between triangle and Monte Carlo smoothed distributions.
 * 5. **Result Logging**: Log results in a table matching Google Sheets columns (task, estimates, PERT, probabilities, sliders, points, confidence intervals, sensitivity, KL divergence, status), with robust error handling to identify issues like missing fields or repeating values.
 * 6. **Error Handling**: Implement try-catch blocks and detailed logging to diagnose computation failures, ensuring maintainability and debuggability.
 * 7. **Validation**: Validate input data to prevent crashes and ensure compatibility with Code.gs expectations.
 *
 * Dependencies:
 * - mathjs: For matrix operations in optimization and KL divergence.
 * - jstat: For statistical computations in confidence intervals.
 * - kd-tree-javascript: For efficient nearest-neighbor searches in Gaussian Process.
 * - Core modules: triangle-points, pert-points, beta-points, monte-carlo-raw, monte-carlo-smoothed, slider-optimizer, slider-adjustments, validation, metrics.
 *
 * Implementation Choices:
 * - **Local Execution**: Directly calls core functions (computeBaselineProbability, computeSliderProbability, optimizeSliders) to avoid authentication issues seen in test_api_rows.sh and dependency issues in the HTTP-based test_code_gs.js.
 * - **Sample Data**: Includes two rows with varied estimates and sliders to test different scenarios, matching typical Google Sheets input.
 * - **Response Structure**: Formats results to match pmcEstimatorAPI response (allCIs, sliders, reshapedPoints), ensuring compatibility with Code.gs expectations.
 * - **Confidence Intervals**: Computes 95% CI using cdfPoints interpolation, matching the API’s expected output.
 * - **Additional Metrics**: Computes PERT mean, baseline/optimized probabilities for target = optimistic, sensitivity change as mean shift, and KL divergence for triangle vs. Monte Carlo smoothed distributions.
 * - **Logging**: Outputs a detailed table with all Google Sheets columns, mirroring output for easy comparison.
 * - **Error Handling**: Catches and logs errors at each step (baseline, user, optimized, CI computation) to identify issues like Row 8 errors or empty arrays.
 *
 * Fixes Applied:
 * - [2025-09-08] Created local test_code_gs.js to simulate Code.gs processing without API calls, bypassing test_api_rows.sh authentication issues and diagnosing Google Sheets output problems (Fix 95).
 * - [2025-09-08] Updated test_code_gs.js to include all Google Sheets columns (PERT, baseline/optimized probabilities for target = optimistic, MC smoothed sensitivity change, KL divergence, JSON points, status), with new functions for PERT mean, sensitivity, and KL divergence (Fix 96).
 * - [2025-09-08] Fixed TypeError in logResults by correcting result destructuring to access result.allCIs instead of result.result.allCIs, ensuring correct table generation (Fix 97).
 * - [2025-09-08] Enhanced computeBaselineProbability to avoid zero probabilities at target = optimistic, improved computeMeanFromPdf for numerical stability, normalized pdfPoints in computeKLDivergence, and added detailed logging in testRow to diagnose low probabilities and negative sensitivity changes (Fix 98).
 */

'use strict';

const path = require('path');
const math = require('mathjs');
const { generateTrianglePoints } = require(path.join(__dirname, '../core/baseline/triangle-points'));
const { generatePertPoints } = require(path.join(__dirname, '../core/baseline/pert-points'));
const { generateBetaPoints } = require(path.join(__dirname, '../core/baseline/beta-points'));
const { generateMonteCarloRawPoints } = require(path.join(__dirname, '../core/baseline/monte-carlo-raw'));
const { generateMonteCarloSmoothedPoints } = require(path.join(__dirname, '../core/baseline/monte-carlo-smoothed'));
const { optimizeSliders } = require(path.join(__dirname, '../core/optimization/slider-optimizer'));
const { computeSliderProbability, computeBaselineProbability } = require(path.join(__dirname, '../core/reshaping/slider-adjustments'));
const { isValidPdfArray, isValidCdfArray } = require(path.join(__dirname, '../core/helpers/validation'));
const { interpolateCdf } = require(path.join(__dirname, '../core/helpers/metrics'));

console.log('test_code_gs.js: File found at', __filename);
console.log('test_code_gs.js: Starting');
console.log('Testing local processing of multiple rows, mimicking Google Sheets (Code.gs) interaction.');

// Sample row data (mimicking Google Sheets input)
const sampleRows = [
  {
    task: 'Task 1',
    optimistic: 1800,
    mostLikely: 2400,
    pessimistic: 3000,
    targetValue: 2000,
    distributionType: 'monte-carlo-smoothed',
    sliders: {
      budgetFlexibility: 20,
      scheduleFlexibility: 40,
      scopeCertainty: 60,
      scopeReductionAllowance: 80,
      reworkPercentage: 0,
      riskTolerance: 100,
      userConfidence: 100
    }
  },
  {
    task: 'Task 2',
    optimistic: 2000,
    mostLikely: 2600,
    pessimistic: 3200,
    targetValue: 2200,
    distributionType: 'monte-carlo-smoothed',
    sliders: {
      budgetFlexibility: 30,
      scheduleFlexibility: 50,
      scopeCertainty: 70,
      scopeReductionAllowance: 90,
      reworkPercentage: 10,
      riskTolerance: 90,
      userConfidence: 90
    }
  }
];

// Validate row data
function validateRow(row) {
  const { task, optimistic, mostLikely, pessimistic, targetValue, distributionType, sliders } = row;
  if (typeof task !== 'string' || task.trim() === '') {
    throw new Error(`Invalid task name: ${task}`);
  }
  if (!Number.isFinite(optimistic) || !Number.isFinite(mostLikely) || !Number.isFinite(pessimistic)) {
    throw new Error(`Invalid estimates: optimistic=${optimistic}, mostLikely=${mostLikely}, pessimistic=${pessimistic}`);
  }
  if (optimistic > mostLikely || mostLikely > pessimistic) {
    throw new Error('Estimates must satisfy optimistic <= mostLikely <= pessimistic');
  }
  if (!Number.isFinite(targetValue)) {
    throw new Error(`Invalid targetValue: ${targetValue}`);
  }
  const validDistributions = ['triangle', 'pert', 'beta', 'monte-carlo-raw', 'monte-carlo-smoothed'];
  if (!validDistributions.includes(distributionType)) {
    throw new Error(`Invalid distributionType: ${distributionType}`);
  }
  const sliderNames = ['budgetFlexibility', 'scheduleFlexibility', 'scopeCertainty', 'scopeReductionAllowance', 'reworkPercentage', 'riskTolerance', 'userConfidence'];
  for (const name of sliderNames) {
    const max = name === 'reworkPercentage' ? 50 : 100;
    if (!Number.isFinite(sliders[name]) || sliders[name] < 0 || sliders[name] > max) {
      throw new Error(`Invalid slider ${name}: must be a number between 0 and ${max}`);
    }
  }
  return true;
}

// Compute PERT mean
function computePertMean(optimistic, mostLikely, pessimistic) {
  try {
    const mean = (optimistic + 4 * mostLikely + pessimistic) / 6;
    if (!Number.isFinite(mean)) {
      throw new Error('Non-finite PERT mean');
    }
    return mean;
  } catch (error) {
    console.error('computePertMean: Error', { message: error.message, stack: error.stack });
    return null;
  }
}

// Compute confidence intervals from cdfPoints
function computeConfidenceIntervals(cdfPoints, targetValue) {
  try {
    const lowerProb = 0.025; // 95% CI lower bound
    const upperProb = 0.975; // 95% CI upper bound
    let lower = null, upper = null;
    for (let i = 1; i < cdfPoints.length; i++) {
      if (!lower && cdfPoints[i].y >= lowerProb) {
        const x0 = cdfPoints[i - 1].x, y0 = cdfPoints[i - 1].y;
        const x1 = cdfPoints[i].x, y1 = cdfPoints[i].y;
        lower = x0 + (lowerProb - y0) * (x1 - x0) / (y1 - y0);
      }
      if (!upper && cdfPoints[i].y >= upperProb) {
        const x0 = cdfPoints[i - 1].x, y0 = cdfPoints[i - 1].y;
        const x1 = cdfPoints[i].x, y1 = cdfPoints[i].y;
        upper = x0 + (upperProb - y0) * (x1 - x0) / (y1 - y0);
      }
      if (lower && upper) break;
    }
    if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
      console.warn('computeConfidenceIntervals: Invalid CI', { lower, upper, cdfPointsLength: cdfPoints.length });
      return { lower: null, upper: null };
    }
    return { lower, upper };
  } catch (error) {
    console.error('computeConfidenceIntervals: Error', { message: error.message, stack: error.stack });
    return { lower: null, upper: null };
  }
}

// Compute mean from pdfPoints
function computeMeanFromPdf(pdfPoints) {
  try {
    if (!pdfPoints || !pdfPoints.length || !pdfPoints.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y >= 0)) {
      throw new Error('Invalid pdfPoints');
    }
    // Normalize pdfPoints to ensure sum of probabilities is approximately 1
    const totalArea = pdfPoints.reduce((sum, p, i) => {
      if (i === 0) return sum;
      const dx = p.x - pdfPoints[i - 1].x;
      const avgY = (p.y + pdfPoints[i - 1].y) / 2;
      return sum + dx * avgY;
    }, 0);
    if (totalArea <= 0) {
      throw new Error('Non-positive total area in pdfPoints');
    }
    const normalizedPdf = pdfPoints.map(p => ({ x: p.x, y: p.y / totalArea }));
    const mean = normalizedPdf.reduce((sum, p, i) => {
      if (i === 0) return sum;
      const dx = p.x - normalizedPdf[i - 1].x;
      const avgY = (p.y + normalizedPdf[i - 1].y) / 2;
      const xMid = (p.x + normalizedPdf[i - 1].x) / 2;
      return sum + xMid * dx * avgY;
    }, 0);
    if (!Number.isFinite(mean)) {
      throw new Error('Non-finite mean');
    }
    return mean;
  } catch (error) {
    console.error('computeMeanFromPdf: Error', { message: error.message, stack: error.stack });
    return null;
  }
}

// Compute KL divergence between triangle and Monte Carlo smoothed distributions
function computeKLDivergence(trianglePdf, mcSmoothedPdf) {
  try {
    if (!trianglePdf.length || !mcSmoothedPdf.length || !trianglePdf.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y >= 0) || !mcSmoothedPdf.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y >= 0)) {
      throw new Error('Invalid pdfPoints for KL divergence');
    }
    // Normalize pdfPoints
    const normalizePdf = (points) => {
      const totalArea = points.reduce((sum, p, i) => {
        if (i === 0) return sum;
        const dx = p.x - points[i - 1].x;
        const avgY = (p.y + points[i - 1].y) / 2;
        return sum + dx * avgY;
      }, 0);
      return points.map(p => ({ x: p.x, y: totalArea > 0 ? p.y / totalArea : p.y }));
    };
    const normTrianglePdf = normalizePdf(trianglePdf);
    const normMcSmoothedPdf = normalizePdf(mcSmoothedPdf);
    // Align points by interpolating to a common x-axis
    const xMin = Math.max(Math.min(...normTrianglePdf.map(p => p.x), ...normMcSmoothedPdf.map(p => p.x)));
    const xMax = Math.min(Math.max(...normTrianglePdf.map(p => p.x), ...normMcSmoothedPdf.map(p => p.x)));
    const numPoints = Math.min(normTrianglePdf.length, normMcSmoothedPdf.length);
    const xValues = Array.from({ length: numPoints }, (_, i) => xMin + (i / (numPoints - 1)) * (xMax - xMin));

    const interpolate = (points, x) => {
      for (let i = 1; i < points.length; i++) {
        if (x <= points[i].x) {
          const x0 = points[i - 1].x, y0 = points[i - 1].y;
          const x1 = points[i].x, y1 = points[i].y;
          return y0 + (x - x0) * (y1 - y0) / (x1 - x0);
        }
      }
      return points[points.length - 1].y;
    };

    let kl = 0;
    for (const x of xValues) {
      const p = interpolate(normTrianglePdf, x);
      const q = interpolate(normMcSmoothedPdf, x);
      if (p > 1e-10 && q > 1e-10) { // Avoid log(0)
        kl += p * Math.log(p / q);
      }
    }
    kl *= (xMax - xMin) / numPoints; // Approximate integral
    if (!Number.isFinite(kl) || kl < 0) {
      throw new Error('Non-finite or negative KL divergence');
    }
    return kl;
  } catch (error) {
    console.error('computeKLDivergence: Error', { message: error.message, stack: error.stack });
    return null;
  }
}

// Process a single row for all distributions
async function testRow(row) {
  console.log(`testRow: Testing row for task: ${row.task}`);
  console.time(`testRow-${row.task}`);
  try {
    validateRow(row);
    const distributions = ['triangle', 'pert', 'beta', 'monte-carlo-raw', 'monte-carlo-smoothed'];
    const result = { allCIs: { value: {} }, sliders: {}, reshapedPoints: { pdfPoints: [], cdfPoints: [] }, error: null };
    let baselineOptimisticProb = null;
    let optimizedOptimisticProb = null;
    let sensitivityChange = null;
    let klDivergence = null;
    let trianglePdf = null;
    let mcSmoothedPdf = null;

    // Compute PERT mean
    const pertMean = computePertMean(row.optimistic, row.mostLikely, row.pessimistic);
    console.log(`testRow: PERT mean computed`, { task: row.task, pertMean });

    for (const dist of distributions) {
      console.log(`testRow: Processing distribution: ${dist}`);
      console.time(`testRow-${row.task}-${dist}`);

      // Baseline computation
      let baselineResult;
      try {
        baselineResult = await computeBaselineProbability({
          optimistic: row.optimistic,
          mostLikely: row.mostLikely,
          pessimistic: row.pessimistic,
          targetValue: row.targetValue,
          distributionType: dist,
          numSamples: 1000
        });
        if (baselineResult.error || !isValidPdfArray(baselineResult.pdfPoints) || !isValidCdfArray(baselineResult.cdfPoints)) {
          throw new Error(baselineResult.error || 'Invalid baseline points');
        }
        if (baselineResult.probability.error || !Number.isFinite(baselineResult.probability.value)) {
          throw new Error(baselineResult.probability.error || 'Invalid baseline probability');
        }
        console.log(`testRow: Baseline probability for ${dist}`, { probability: baselineResult.probability.value });
      } catch (error) {
        console.error(`testRow: Baseline failed for ${dist}`, { message: error.message, stack: error.stack });
        result.allCIs.value[dist] = { probability: null, lower: null, upper: null };
        console.timeEnd(`testRow-${row.task}-${dist}`);
        continue;
      }

      // Baseline probability for target = optimistic (for monte-carlo-smoothed)
      if (dist === 'monte-carlo-smoothed') {
        try {
          const baselineOptimistic = await computeBaselineProbability({
            optimistic: row.optimistic,
            mostLikely: row.mostLikely,
            pessimistic: row.pessimistic,
            targetValue: row.optimistic,
            distributionType: dist,
            numSamples: 1000
          });
          if (!baselineOptimistic.error && Number.isFinite(baselineOptimistic.probability.value)) {
            baselineOptimisticProb = Math.max(baselineOptimistic.probability.value, 1e-6); // Avoid zero
            console.log(`testRow: Baseline optimistic probability for ${dist}`, { probability: baselineOptimisticProb });
          }
        } catch (error) {
          console.error(`testRow: Baseline optimistic probability failed for ${dist}`, { message: error.message, stack: error.stack });
        }
      }

      // Optimized sliders
      let optimizedResult;
      try {
        optimizedResult = await optimizeSliders({
          points: baselineResult,
          optimistic: row.optimistic,
          mostLikely: row.mostLikely,
          pessimistic: row.pessimistic,
          targetValue: row.targetValue,
          optimizeFor: 'target',
          distributionType: dist,
          userSliders: row.sliders
        });
        if (optimizedResult.error) {
          throw new Error(optimizedResult.error);
        }
        if (dist === row.distributionType) {
          result.sliders = optimizedResult.sliders;
          result.reshapedPoints = optimizedResult.reshapedPoints;
        }
        if (dist === 'triangle') {
          trianglePdf = optimizedResult.reshapedPoints.pdfPoints;
        }
        if (dist === 'monte-carlo-smoothed') {
          mcSmoothedPdf = optimizedResult.reshapedPoints.pdfPoints;
        }
        console.log(`testRow: Optimized probability for ${dist}`, { probability: optimizedResult.probability.value });
      } catch (error) {
        console.error(`testRow: Optimized sliders failed for ${dist}`, { message: error.message, stack: error.stack });
        result.allCIs.value[dist] = { probability: null, lower: null, upper: null };
        console.timeEnd(`testRow-${row.task}-${dist}`);
        continue;
      }

      // Optimized probability for target = optimistic (for monte-carlo-smoothed)
      if (dist === 'monte-carlo-smoothed') {
        try {
          const optimizedOptimistic = await computeSliderProbability({
            points: baselineResult,
            optimistic: row.optimistic,
            mostLikely: row.mostLikely,
            pessimistic: row.pessimistic,
            targetValue: row.optimistic,
            sliderValues: optimizedResult.sliders,
            shiftDirection: row.optimistic < row.mostLikely ? -1 : row.optimistic > row.mostLikely ? 1 : 0,
            distributionType: dist,
            useCopula: true
          });
          if (!optimizedOptimistic.error && Number.isFinite(optimizedOptimistic.probability.value)) {
            optimizedOptimisticProb = Math.max(optimizedOptimistic.probability.value, 1e-6); // Avoid zero
            console.log(`testRow: Optimized optimistic probability for ${dist}`, { probability: optimizedOptimisticProb });
          }
        } catch (error) {
          console.error(`testRow: Optimized optimistic probability failed for ${dist}`, { message: error.message, stack: error.stack });
        }

        // Compute sensitivity change (mean shift)
        const baselineMean = computeMeanFromPdf(baselineResult.pdfPoints);
        const optimizedMean = computeMeanFromPdf(optimizedResult.reshapedPoints.pdfPoints);
        if (Number.isFinite(baselineMean) && Number.isFinite(optimizedMean)) {
          sensitivityChange = optimizedMean - baselineMean;
          console.log(`testRow: Sensitivity change for ${dist}`, { baselineMean, optimizedMean, sensitivityChange });
        }
      }

      // Compute confidence intervals
      const ci = computeConfidenceIntervals(optimizedResult.reshapedPoints.cdfPoints, row.targetValue);
      result.allCIs.value[dist] = {
        probability: optimizedResult.probability.value,
        lower: ci.lower,
        upper: ci.upper
      };

      console.timeEnd(`testRow-${row.task}-${dist}`);
    }

    // Compute KL divergence
    if (trianglePdf && mcSmoothedPdf) {
      klDivergence = computeKLDivergence(trianglePdf, mcSmoothedPdf);
      console.log(`testRow: KL divergence computed`, { task: row.task, klDivergence });
    }

    console.log('testRow: Completed', {
      task: row.task,
      pertMean,
      baselineOptimisticProb,
      optimizedOptimisticProb,
      sensitivityChange,
      klDivergence,
      allCIs: result.allCIs.value,
      sliders: result.sliders,
      pdfPointsLength: result.reshapedPoints.pdfPoints?.length,
      cdfPointsLength: result.reshapedPoints.cdfPoints?.length
    });
    console.timeEnd(`testRow-${row.task}`);
    return {
      result,
      pertMean,
      baselineOptimisticProb,
      optimizedOptimisticProb,
      sensitivityChange,
      klDivergence,
      status: 'Success'
    };
  } catch (error) {
    console.error('testRow: Failed', { task: row.task, message: error.message, stack: error.stack });
    console.timeEnd(`testRow-${row.task}`);
    return {
      result: {
        error: error.message,
        allCIs: { value: {} },
        sliders: {},
        reshapedPoints: { pdfPoints: [], cdfPoints: [] }
      },
      pertMean: null,
      baselineOptimisticProb: null,
      optimizedOptimisticProb: null,
      sensitivityChange: null,
      klDivergence: null,
      status: error.message
    };
  }
}

// Log consolidated results
function logResults(results) {
  console.log('Consolidated Local Test Results');
  console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------');
  console.log('| Name | Best Case | Most Likely | Worst Case | PERT | MC Smoothed 95% CI Lower | MC Smoothed 95% CI Upper | % Confidence Original | Optimal Sliders | % Confidence Optimized | Sensitivity Change | KL Divergence | MC Smoothed Points | CDF Points | Status |');
  console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------');
  results.forEach(({ row, result, pertMean, baselineOptimisticProb, optimizedOptimisticProb, sensitivityChange, klDivergence, status }) => {
    const { task, optimistic, mostLikely, pessimistic, distributionType } = row;
    const ci = result.allCIs?.value?.[distributionType] || {};
    const probability = Number.isFinite(ci.probability) ? (ci.probability * 100).toFixed(2) + '%' : 'N/A';
    const lower = Number.isFinite(ci.lower) ? ci.lower.toFixed(2) : 'N/A';
    const upper = Number.isFinite(ci.upper) ? ci.upper.toFixed(2) : 'N/A';
    const sliders = result.sliders ? Object.values(result.sliders).join(', ') : 'N/A';
    const pert = Number.isFinite(pertMean) ? pertMean.toFixed(2) : 'N/A';
    const baselineProb = Number.isFinite(baselineOptimisticProb) ? (baselineOptimisticProb * 100).toFixed(2) + '%' : 'N/A';
    const optimizedProb = Number.isFinite(optimizedOptimisticProb) ? (optimizedOptimisticProb * 100).toFixed(2) + '%' : 'N/A';
    const sensitivity = Number.isFinite(sensitivityChange) ? sensitivityChange.toFixed(2) : 'N/A';
    const klDiv = Number.isFinite(klDivergence) ? klDivergence.toFixed(4) : 'N/A';
    const pdfPoints = result.reshapedPoints?.pdfPoints?.length ? JSON.stringify(result.reshapedPoints.pdfPoints.slice(0, 5)) : '[]';
    const cdfPoints = result.reshapedPoints?.cdfPoints?.length ? JSON.stringify(result.reshapedPoints.cdfPoints.slice(0, 5)) : '[]';
    console.log(`| ${task.padEnd(6)} | ${optimistic.toString().padEnd(9)} | ${mostLikely.toString().padEnd(11)} | ${pessimistic.toString().padEnd(10)} | ${pert.padEnd(6)} | ${lower.padEnd(22)} | ${upper.padEnd(22)} | ${baselineProb.padEnd(20)} | ${sliders.padEnd(15)} | ${optimizedProb.padEnd(20)} | ${sensitivity.padEnd(17)} | ${klDiv.padEnd(13)} | ${pdfPoints.padEnd(20)} | ${cdfPoints.padEnd(20)} | ${status.padEnd(10)} |`);
  });
  console.log('---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------');
}

async function main() {
  console.time('main');
  try {
    console.log('Starting local tests for multiple rows...');
    const results = [];
    for (const row of sampleRows) {
      const { result, pertMean, baselineOptimisticProb, optimizedOptimisticProb, sensitivityChange, klDivergence, status } = await testRow(row);
      results.push({ row, result, pertMean, baselineOptimisticProb, optimizedOptimisticProb, sensitivityChange, klDivergence, status });
    }
    logResults(results);
  } catch (error) {
    console.error('main: Error', { message: error.message, stack: error.stack });
  } finally {
    console.timeEnd('main');
  }
}

main().catch(console.error);
