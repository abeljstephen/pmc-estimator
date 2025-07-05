// core.js
// https://github.com/abeljstephen/pmc-estimator/blob/main/system-google-cloud-functions-api/core.js

'use strict';

const math = require('mathjs');
const jstat = require('jstat');
const functions = require('@google-cloud/functions-framework');

// --- Utility Functions ---
// These functions are used throughout the module for calculations and validations

/**
 * Validates the estimates to ensure optimistic <= mostLikely <= pessimistic.
 * Throws an error if the condition is not met.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 */
function validateEstimates(optimistic, mostLikely, pessimistic) {
  if (!Number.isFinite(optimistic) || !Number.isFinite(mostLikely) || !Number.isFinite(pessimistic)) {
    throw new Error('Estimates must be finite numbers');
  }
  if (optimistic > mostLikely || mostLikely > pessimistic) {
    throw new Error('Invalid estimates: optimistic <= mostLikely <= pessimistic required');
  }
}

/**
 * Generates a random number between 0 and 1 for Monte Carlo simulations.
 * Used in: Monte Carlo sampling functions.
 */
function random() {
  return Math.random();
}

// --- Active Functions ---
// These functions are currently in use and optimized for performance

/**
 * Calculates the PERT distribution points for plotting.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @returns {Object} An object with x and y arrays for plotting.
 */
function calculatePERTDistribution(optimistic, mostLikely, pessimistic) {
  validateEstimates(optimistic, mostLikely, pessimistic);
  const numPoints = 100; // Fixed to 100 points for performance and accuracy
  const points = [];
  const step = (pessimistic - optimistic) / (numPoints - 1);
  const scale = 6 / (pessimistic - optimistic);
  for (let i = 0; i < numPoints; i++) {
    const x = optimistic + i * step;
    let y = 0;
    if (x >= optimistic && x <= pessimistic) {
      const t = (x - optimistic) / (pessimistic - optimistic);
      y = scale * t * (1 - t) * Math.exp(4 * (t - 0.5) * (t - 0.5));
      if (x <= mostLikely) y *= (mostLikely - optimistic) / (pessimistic - optimistic);
      else y *= (pessimistic - mostLikely) / (pessimistic - optimistic);
    }
    points.push([x, y]);
  }
  return { x: points.map(p => p[0]), y: points.map(p => p[1]) };
}

/**
 * Generates Monte Carlo samples for estimation using a normal distribution approximation.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @param {number} [samples=1000] - The number of samples to generate.
 * @returns {number[]} An array of Monte Carlo samples.
 */
function generateMonteCarloSamples(optimistic, mostLikely, pessimistic, samples = 1000) {
  validateEstimates(optimistic, mostLikely, pessimistic);
  if (!Number.isInteger(samples) || samples <= 0) {
    throw new Error('Number of samples must be a positive integer');
  }
  const results = [];
  for (let i = 0; i < samples; i++) {
    const r1 = Math.random();
    const r2 = Math.random();
    const mean = (optimistic + 4 * mostLikely + pessimistic) / 6;
    const stdDev = (pessimistic - optimistic) / 6;
    // Box-Muller transform for normal distribution approximation
    results.push(mean + stdDev * Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2));
  }
  return results;
}

/**
 * Creates a smoothed histogram from Monte Carlo samples.
 * @param {number[]} samples - The Monte Carlo samples.
 * @returns {Object[]} An array of objects with x and y for plotting.
 */
function smoothHistogram(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Samples must be a non-empty array');
  }
  const bins = 100; // Fixed to 100 bins for performance and accuracy
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const binWidth = (max - min) / bins;
  const histogram = Array(bins).fill(0);
  samples.forEach(s => {
    const idx = Math.min(Math.floor((s - min) / binWidth), bins - 1);
    histogram[idx]++;
  });
  const norm = samples.length * binWidth;
  return histogram.map((count, i) => ({
    x: min + i * binWidth + binWidth / 2,
    y: count / norm
  }));
}

/**
 * Generates Monte Carlo samples for a Beta distribution without noise.
 * @param {number} alpha - Alpha parameter of Beta distribution.
 * @param {number} beta - Beta parameter of Beta distribution.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {Array} Array of simulated values.
 */
function monteCarloSamplesBetaNoNoise(alpha, beta, min, max) {
  const simulations = [];
  for (let suiv = 0; suiv < 1000; suiv++) {
    const x = random();
    const y = random();
    const z = Math.pow(x, 1 / alpha) / (Math.pow(x, 1 / alpha) + Math.pow(y, 1 / beta));
    simulations.push(min + z * (max - min));
  }
  return simulations;
}

// --- Additional Utility Functions ---
// These functions provide extra calculations that may be useful in the future

/**
 * Calculates the standard deviation for a triangular distribution.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @returns {number} The standard deviation.
 */
function calculateStandardDeviation(optimistic, mostLikely, pessimistic) {
  validateEstimates(optimistic, mostLikely, pessimistic);
  const a = optimistic, b = mostLikely, c = pessimistic;
  const variance = (a * a + b * b + c * c - a * b - a * c - b * c) / 18;
  return Math.sqrt(variance);
}

/**
 * Calculates the confidence interval for the estimates based on Monte Carlo samples.
 * @param {number[]} samples - The Monte Carlo samples.
 * @param {number} confidenceLevel - The confidence level (e.g., 0.95 for 95%).
 * @returns {Object} An object with lower and upper bounds of the interval.
 */
function calculateConfidenceInterval(samples, confidenceLevel) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Samples must be a non-empty array');
  }
  if (confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error('Confidence level must be between 0 and 1');
  }
  const sorted = samples.slice().sort((a, b) => a - b);
  const lowerIdx = Math.floor((1 - confidenceLevel) / 2 * sorted.length);
  const upperIdx = Math.ceil((1 + confidenceLevel) / 2 * sorted.length) - 1;
  return {
    lower: sorted[lowerIdx],
    upper: sorted[upperIdx]
  };
}

/**
 * Calculates the probability of completing a task by a target value (e.g., time or cost).
 * @param {number[]} samples - The Monte Carlo samples.
 * @param {number} target - The target value to compare against.
 * @returns {number} The probability (between 0 and 1) of being less than or equal to the target.
 */
function calculateProbability(samples, target) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Samples must be a non-empty array');
  }
  if (!Number.isFinite(target)) {
    throw new Error('Target must be a finite number');
  }
  const count = samples.filter(s => s <= target).length;
  return count / samples.length;
}

/**
 * Calculates Value at Risk (VaR) at a specified confidence level from points array.
 * @param {number} confidenceLevel - Confidence level (e.g., 90 for 90%).
 * @param {Array} points - Array of points with x (value) and confidence properties.
 * @returns {number} VaR value.
 */
function calculateValueAtRisk(confidenceLevel, points) {
  if (!points || points.length === 0) throw new Error('Points array is missing or empty.');
  const sortedPoints = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confidenceLevel / 100) * sortedPoints.length);
  return sortedPoints[index].x;
}

/**
 * Calculates Conditional Value at Risk (CVaR) at a confidence level from points array.
 * @param {number} confidenceLevel - Confidence level (e.g., 90 for 90%).
 * @param {Array} points - Array of points with x (value) properties.
 * @returns {number} CVaR value.
 */
function calculateConditionalValueAtRisk(confidenceLevel, points) {
  if (!points || points.length === 0) throw new Error('Points array is missing or empty.');
  const sortedPoints = points.slice().sort((a, b) => a.x - b.x);
  const varIndex = Math.floor((1 - confidenceLevel / 100) * sortedPoints.length);
  const tailPoints = sortedPoints.slice(0, varIndex + 1);
  return tailPoints.reduce((sum, point) => sum + point.x, 0) / tailPoints.length;
}

/**
 * Finds the confidence level closest to a given value in the points array.
 * @param {number} value - Target value to find confidence for.
 * @param {Array} points - Array of points with x (value) and confidence properties.
 * @returns {number} Closest confidence level.
 */
function findConfidenceForValue(value, points) {
  if (!points || points.length === 0) throw new Error('Points array is missing or empty.');
  let closestConfidence = null;
  let smallestDifference = Infinity;
  points.forEach(point => {
    const difference = Math.abs(point.x - value);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestConfidence = point.confidence;
    }
  });
  return closestConfidence;
}

/**
 * Creates confidence percentiles from Monte Carlo samples, extended to 1-100%.
 * @param {Array} samples - Monte Carlo simulation samples.
 * @returns {Object} Percentiles from 1 to 100.
 */
function createConfidencePercentiles(samples) {
  if (!samples || samples.length === 0) throw new Error('Samples array is missing or empty.');
  const sortedSamples = samples.slice().sort((a, b) => a - b);
  const percentiles = {};
  for (let i = 1; i <= 100; i++) {
    const index = Math.floor(((i - 1) / 100) * sortedSamples.length);
    percentiles[i] = sortedSamples[Math.min(index, sortedSamples.length - 1)];
  }
  return percentiles;
}

/**
 * Creates smoothed confidence percentiles from Monte Carlo samples, extended to 1-100%.
 * @param {Array} samples - Monte Carlo simulation samples.
 * @returns {Object} Smoothed percentiles from 1 to 100.
 */
function createSmoothedConfidencePercentiles(samples) {
  if (!samples || samples.length === 0) throw new Error('Samples array is missing or empty.');
  const smoothedHistogram = generateSmoothedHistogram(samples, 100);
  const smoothedPercentiles = {};
  for (let i = 1; i <= 100; i++) {
    const index = Math.floor(((i - 1) / 100) * smoothedHistogram.length);
    smoothedPercentiles[i] = smoothedHistogram[Math.min(index, smoothedHistogram.length - 1)].x;
  }
  return smoothedPercentiles;
}

/**
 * Calculates the alpha parameter for the Beta distribution.
 * @param {number} mean - Mean of the distribution.
 * @param {number} stdDev - Standard deviation of the distribution.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Alpha parameter.
 */
function calculateAlpha(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = (mean - min) * (max - mean) / variance - 1;
  return commonFactor * (mean - min) / (max - min);
}

/**
 * Calculates the beta parameter for the Beta distribution.
 * @param {number} mean - Mean of the distribution.
 * @param {number} stdDev - Standard deviation of the distribution.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Beta parameter.
 */
function calculateBeta(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = (mean - min) * (max - mean) / variance - 1;
  return commonFactor * (max - mean) / (max - min);
}

/**
 * Calculates the mode of the Beta distribution.
 * @param {number} alpha - Alpha parameter.
 * @param {number} beta - Beta parameter.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Mode of the Beta distribution.
 */
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) {
    return alpha < beta ? min : max;
  }
  const mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}

/**
 * Probability Density Function (PDF) for the Beta distribution.
 * @param {number} x - Scaled value between 0 and 1.
 * @param {number} alpha - Alpha parameter.
 * @param {number} beta - Beta parameter.
 * @returns {number} Density value.
 */
function betaPdf(x, alpha, beta) {
  if (x < 0 || x > 1) return 0;
  return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) / betaFunction(alpha, beta);
}

/**
 * Beta function for normalizing the Beta PDF.
 * @param {number} alpha - Alpha parameter.
 * @param {number} beta - Beta parameter.
 * @returns {number} Beta function value.
 */
function betaFunction(alpha, beta) {
  return gamma(alpha) * gamma(beta) / gamma(alpha + beta);
}

/**
 * Gamma function approximation for Beta function calculation.
 * @param {number} z - Input value.
 * @returns {number} Gamma function approximation.
 */
function gamma(z) {
  const g = 7;
  const coefficients = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = coefficients[0];
  for (let i = 1; i < g + 2; i++) {
    x += coefficients[i] / (z + i);
  }
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

/**
 * Probability Density Function (PDF) for the Triangular distribution.
 * @param {number} x - Value to evaluate.
 * @param {number} min - Minimum value (best case).
 * @param {number} mode - Mode (most likely).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Density value.
 */
function trianglePdf(x, min, mode, max) {
  if (x < min || x > max) return 0;
  if (x <= mode) {
    return 2 * (x - min) / ((max - min) * (mode - min));
  } else {
    return 2 * (max - x) / ((max - min) * (max - mode));
  }
}

/**
 * Cumulative Distribution Function (CDF) for the Triangular distribution.
 * @param {number} x - Value to evaluate.
 * @param {number} min - Minimum value (best case).
 * @param {number} mode - Mode (most likely).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Cumulative probability.
 */
function triangleCdf(x, min, mode, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  if (x <= mode) {
    return ((x - min) * (x - min)) / ((max - min) * (mode - min));
  } else {
    return 1 - ((max - x) * (max - x)) / ((max - min) * (max - mode));
  }
}

/**
 * Generates a smoothed histogram from samples using Gaussian kernel density estimation.
 * @param {Array} samples - Monte Carlo simulation samples.
 * @param {number} bins - Number of bins for histogram.
 * @returns {Array} Smoothed histogram points with x (value) and y (density).
 */
function generateSmoothedHistogram(samples, bins) {
  if (!samples || samples.length === 0) throw new Error("Samples array is empty or undefined.");
  const minVal = Math.min(...samples);
  const maxVal = Math.max(...samples);
  if (minVal === maxVal) {
    return Array.from({ length: bins }, (_, i) => ({
      x: minVal,
      y: i === Math.floor(bins / 2) ? 1 : 0
    }));
  }
  const binWidth = (maxVal - minVal) / bins;
  const histogram = Array.from({ length: bins }, (_, i) => ({
    x: minVal + i * binWidth,
    y: 0,
  }));
  const bandwidth = 0.05 * (maxVal - minVal);
  const gaussianKernel = (x) => Math.exp(-0.5 * Math.pow(x / bandwidth, 2));
  histogram.forEach((bin) => {
    let weightedSum = 0;
    samples.forEach((sample) => {
      const weight = gaussianKernel(bin.x - sample);
      weightedSum += weight;
    });
    bin.y = weightedSum / (samples.length * binWidth);
  });
  const densitySum = histogram.reduce((sum, bin) => sum + bin.y * binWidth, 0);
  if (densitySum > 0) {
    histogram.forEach((bin) => {
      bin.y /= densitySum;
    });
  }
  return histogram;
}

/**
 * Calculates the Median Absolute Deviation (MAD) from a given median.
 * @param {Array} samples - Monte Carlo simulation samples.
 * @param {number} median - Median value.
 * @returns {number} MAD value.
 */
function calculateMAD(samples, median) {
  const deviations = samples.map(sample => Math.abs(sample - median));
  deviations.sort((a, b) => a - b);
  const mid = Math.floor(deviations.length / 2);
  return deviations.length % 2 === 0 ? (deviations[mid - 1] + deviations[mid]) / 2 : deviations[mid];
}

/**
 * Generates 100-point arrays for each distribution type for plotting.
 * @param {string} type - Distribution type (TRIANGLE, PERT, BETA, MC_UNSMOOTHED, MC_SMOOTHED, CDF).
 * @param {number} min - Minimum value (best case).
 * @param {number} mode - Mode (most likely).
 * @param {number} max - Maximum value (worst case).
 * @param {number} [alpha] - Alpha parameter for PERT/Beta.
 * @param {number} [beta] - Beta parameter for PERT/Beta.
 * @param {Array} [samples] - Monte Carlo samples for MC distributions.
 * @returns {Array} Array of points with x (value), y (density/probability), and confidence.
 */
function generateDistributionPoints(type, min, mode, max, alpha, beta, samples) {
  const points = [];
  if (type === 'TRIANGLE') {
    for (let p = 1; p <= 100; p++) {
      const percentile = p / 100;
      let low = min, high = max, precision = 0.01;
      while (high - low > precision) {
        const mid = (low + high) / 2;
        if (triangleCdf(mid, min, mode, max) < percentile) {
          low = mid;
        } else {
          high = mid;
        }
      }
      const x = (low + high) / 2;
      const y = trianglePdf(x, min, mode, max);
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'PERT' || type === 'BETA') {
    const range = max - min;
    for (let p = 1; p <= 100; p++) {
      const scaled = (p - 1) / 99; // 0 to 1 over 100 points
      const x = min + scaled * range;
      const y = betaPdf((x - min) / range, alpha, beta) / range;
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'MC_UNSMOOTHED') {
    const percentiles = createConfidencePercentiles(samples);
    for (let p = 1; p <= 100; p++) {
      const x = percentiles[p];
      const y = betaPdf((x - min) / (max - min), alpha, beta) / (max - min);
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'MC_SMOOTHED') {
    const percentiles = createSmoothedConfidencePercentiles(samples);
    for (let p = 1; p <= 100; p++) {
      const x = percentiles[p];
      const y = betaPdf((x - min) / (max - min), alpha, beta) / (max - min);
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'CDF') {
    for (let p = 1; p <= 100; p++) {
      const percentile = p / 100;
      let low = min, high = max, precision = 0.01;
      while (high - low > precision) {
        const mid = (low + high) / 2;
        if (triangleCdf(mid, min, mode, max) < percentile) {
          low = mid;
        } else {
          high = mid;
        }
      }
      const x = (low + high) / 2;
      const y = p / 100;
      points.push({ x: x, y: y, confidence: p });
    }
  }
  return points;
}

// --- WARNING: Potentially Large Data Generation ---
// The following functions are not currently needed or may result in JSON being too large.
// Use with caution or modify sample sizes if necessary.

/**
 * Generates a high volume of Monte Carlo samples.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @returns {number[]} An array of 10,000 Monte Carlo samples.
 */
function generateHighVolumeSamples(optimistic, mostLikely, pessimistic) {
  // WARNING: This may result in JSON being too large when using 10,000 samples.
  const samples = 10000; // High sample count not currently needed
  return generateMonteCarloSamples(optimistic, mostLikely, pessimistic, samples);
}

// --- HTTP Endpoints ---
// These functions handle HTTP requests for the Cloud Function

functions.http('pmcEstimatorAPI', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (!req.body || !Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON array of tasks.' });
  }

  const tasks = req.body.map(task => ({
    task: task.task,
    optimistic: parseFloat(task.optimistic),
    mostLikely: parseFloat(task.mostLikely),
    pessimistic: parseFloat(task.pessimistic)
  }));

  try {
    const results = tasks.map(processTask);
    res.json({ results });
  } catch (err) {
    console.error('Error in pmcEstimatorAPI:', err.stack);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
});

/**
 * Processes a single task and returns its analysis.
 * @param {Object} task - The task object with task name and estimates.
 * @returns {Object} The analysis results for the task.
 */
function processTask(task) {
  const { optimistic, mostLikely, pessimistic } = task;
  const pertPoints = calculatePERTDistribution(optimistic, mostLikely, pessimistic);
  const mcSamples = generateMonteCarloSamples(optimistic, mostLikely, pessimistic);
  const histogram = smoothHistogram(mcSamples);
  const stdDev = calculateStandardDeviation(optimistic, mostLikely, pessimistic);
  const confidenceInterval = calculateConfidenceInterval(mcSamples, 0.95);
  const probabilityUnderMean = calculateProbability(mcSamples, (optimistic + 4 * mostLikely + pessimistic) / 6);

  return {
    task: task.task,
    pertPoints,
    histogram,
    stdDev,
    confidenceInterval,
    probabilityUnderMean
  };
}
