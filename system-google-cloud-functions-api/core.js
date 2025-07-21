// core.js (Updated with CV, CI, CVaR95, and new metrics for all distributions)
'use strict';

const math = require('mathjs');
const jstat = require('jstat');
const functions = require('@google-cloud/functions-framework');

/* ============================================================================
   🟩 BASIC UTILITIES
   - General-purpose helper functions used across distributions
============================================================================ */

/**
 * Validates that estimates are finite numbers and in correct order (optimistic <= mostLikely <= pessimistic).
 * @param {number} optimistic - The optimistic estimate
 * @param {number} mostLikely - The most likely estimate
 * @param {number} pessimistic - The pessimistic estimate
 * @returns {boolean} True if degenerate (mostLikely equals optimistic or pessimistic), false otherwise
 */
function validateEstimates(optimistic, mostLikely, pessimistic) {
  if (!Number.isFinite(optimistic) || !Number.isFinite(mostLikely) || !Number.isFinite(pessimistic)) {
    throw new Error('Estimates must be finite numbers');
  }
  if (optimistic > mostLikely || mostLikely > pessimistic) {
    throw new Error('Invalid estimates: optimistic <= mostLikely <= pessimistic required');
  }
  if (mostLikely === optimistic || mostLikely === pessimistic) {
    console.warn('Edge case: mostLikely equals optimistic or pessimistic, using fallback values');
    return true; // Indicate degenerate case
  }
  return false;
}

/**
 * Computes the median of an array of numbers.
 * @param {Array<number>} numbers - Array of numbers
 * @returns {number} Median value
 */
function calculateMedian(numbers) {
  const sorted = numbers.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/* ============================================================================
   🟦 TRIANGLE DISTRIBUTION FUNCTIONS
   - Functions for computing metrics and points of the Triangular distribution
============================================================================ */

/**
 * Calculates the mean of a Triangular distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Mean value
 */
function calculateTriangleMean(o, m, p) {
  return (o + m + p) / 3;
}

/**
 * Calculates the variance of a Triangular distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Variance
 */
function calculateTriangleVariance(o, m, p) {
  return (o * o + m * m + p * p - o * m - o * p - m * p) / 18;
}

/**
 * Calculates the standard deviation of a Triangular distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Standard deviation
 */
function calculateTriangleStdDev(o, m, p) {
  return Math.sqrt(calculateTriangleVariance(o, m, p));
}

/**
 * Calculates the skewness of a Triangular distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Skewness
 */
function calculateTriangleSkewness(o, m, p) {
  const variance = calculateTriangleVariance(o, m, p);
  if (variance === 0) return 0;
  const numerator = Math.sqrt(2) * (o + p - 2 * m) * (2 * o - p - m) * (o - 2 * p + m);
  const denominator = 5 * Math.pow(variance, 1.5);
  return numerator / denominator;
}

/**
 * Calculates the kurtosis of a Triangular distribution (constant value).
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Kurtosis (-6/5)
 */
function calculateTriangleKurtosis(o, m, p) {
  return -6 / 5;
}

/**
 * Calculates the median of a Triangular distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Median value
 */
function calculateTriangleMedian(o, m, p) {
  if (m === o || m === p) return m;
  const c = (m - o) / (p - o);
  if (c <= 0.5) {
    return o + Math.sqrt((p - o) * (m - o) / 2);
  } else {
    return p - Math.sqrt((p - o) * (p - m) / 2);
  }
}

/**
 * Calculates the value at a specified confidence level for a Triangular distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @param {number} confidence - Confidence level (0 to 1)
 * @returns {number|null} Value at confidence level, or null if invalid
 */
function calculateTriangleValueAtConfidence(o, m, p, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  if (m === o || m === p) return m;
  const c = (m - o) / (p - o);
  const F = confidence;
  if (F <= c) {
    return o + Math.sqrt(F * (p - o) * (m - o));
  } else {
    return p - Math.sqrt((1 - F) * (p - o) * (p - m));
  }
}

/**
 * Generates PDF points for a Triangular distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {Array} Array of {x, y, confidence} objects representing PDF
 */
function calculateTrianglePdfPoints(o, m, p) {
  if (m === o || m === p) {
    return [{ x: m, y: 1, confidence: 50 }];
  }
  const points = [];
  const step = (p - o) / 100;
  for (let i = 0; i <= 100; i++) {
    const x = o + i * step;
    let y;
    if (x < o || x > p) {
      y = 0;
    } else if (x < m) {
      y = 2 * (x - o) / ((p - o) * (m - o));
    } else if (x === m) {
      y = 2 / (p - o);
    } else {
      y = 2 * (p - x) / ((p - o) * (p - m));
    }
    points.push({ x, y: isNaN(y) ? 0 : y, confidence: null });
  }
  return points;
}

/**
 * Calculates the 95% confidence interval for the mean of a Triangular distribution.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @param {number} [sampleSize=1000] - Sample size for standard error
 * @returns {Object} {lower, upper} bounds of the confidence interval
 */
function calculateTriangleConfidenceInterval(mean, stdDev, sampleSize = 1000) {
  const z = 1.96; // 95% confidence
  const se = stdDev / Math.sqrt(sampleSize);
  return { lower: mean - z * se, upper: mean + z * se };
}

/**
 * Calculates the coefficient of variation (stdDev/mean) for a Triangular distribution.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @returns {number} Coefficient of variation
 */
function calculateTriangleCoefficientOfVariation(mean, stdDev) {
  return mean !== 0 ? stdDev / mean : 0;
}

/**
 * Calculates the Conditional Value at Risk (CVaR) at 95% confidence for a Triangular distribution.
 * @param {Array} cdfPoints - CDF points
 * @param {number} min - Minimum value (fallback)
 * @returns {number} CVaR at 95% confidence
 */
function calculateTriangleCVaR95(cdfPoints, min) {
  const tailPoints = cdfPoints.filter(p => p.y <= 0.05); // Worst 5% of outcomes
  return tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : min;
}

/* ============================================================================
   🟧 PERT DISTRIBUTION FUNCTIONS
   - Functions for computing metrics and points of the PERT distribution
============================================================================ */

/**
 * Calculates the mean of a PERT distribution (weighted average).
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Mean value
 */
function calculatePERTMean(o, m, p) {
  return (o + 4 * m + p) / 6;
}

/**
 * Calculates the variance of a PERT distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Variance
 */
function calculatePERTVariance(o, m, p) {
  return Math.pow(p - o, 2) / 36;
}

/**
 * Calculates the standard deviation of a PERT distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Standard deviation
 */
function calculatePERTStdDev(o, m, p) {
  return Math.sqrt(calculatePERTVariance(o, m, p));
}

/**
 * Calculates the skewness of a PERT distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Skewness
 */
function calculatePERTSkewness(o, m, p) {
  const variance = calculatePERTVariance(o, m, p);
  if (variance === 0) return 0;
  return (2 * (p - o) * (p + o - 2 * m)) / (5 * Math.pow(p - o, 2));
}

/**
 * Calculates the kurtosis of a PERT distribution (constant value).
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Kurtosis (-6/5)
 */
function calculatePERTKurtosis(o, m, p) {
  return -6 / 5;
}

/**
 * Calculates a conservative weighted estimate using PERT weights.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Conservative estimate
 */
function calculateConservativeEstimate(o, m, p) {
  return (o + 2 * m + 3 * p) / 6;
}

/**
 * Calculates an optimistic weighted estimate using PERT weights.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {number} Optimistic estimate
 */
function calculateOptimisticEstimate(o, m, p) {
  return (3 * o + 2 * m + p) / 6;
}

/**
 * Calculates the median of a PERT distribution using Beta parameters.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @param {number} alpha - Beta distribution alpha parameter
 * @param {number} beta - Beta distribution beta parameter
 * @returns {number} Median value
 */
function calculatePERTMedian(o, m, p, alpha, beta) {
  const scaledMedian = jstat.beta.inv(0.5, alpha, beta);
  return o + scaledMedian * (p - o);
}

/**
 * Calculates the value at a specified confidence level for a PERT distribution.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @param {number} alpha - Beta distribution alpha parameter
 * @param {number} beta - Beta distribution beta parameter
 * @param {number} confidence - Confidence level (0 to 1)
 * @returns {number|null} Value at confidence level, or null if invalid
 */
function calculatePERTValueAtConfidence(o, m, p, alpha, beta, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  const scaledValue = jstat.beta.inv(confidence, alpha, beta);
  return o + scaledValue * (p - o);
}

/**
 * Generates PDF points for a PERT distribution using Beta parameters.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @param {number} alpha - Beta distribution alpha parameter
 * @param {number} beta - Beta distribution beta parameter
 * @returns {Array} Array of {x, y, confidence} objects representing PDF
 */
function calculatePERTPdfPoints(o, m, p, alpha, beta) {
  if (m === o || m === p) {
    return [{ x: m, y: 1, confidence: 50 }];
  }
  const points = [];
  const step = (p - o) / 100;
  for (let i = 0; i <= 100; i++) {
    const x = o + i * step;
    const scaledX = (x - o) / (p - o);
    const y = jstat.beta.pdf(scaledX, alpha, beta) / (p - o);
    points.push({ x, y: isNaN(y) ? 0 : y, confidence: null });
  }
  return points;
}

/**
 * Calculates the 95% confidence interval for the mean of a PERT distribution.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @param {number} [sampleSize=1000] - Sample size for standard error
 * @returns {Object} {lower, upper} bounds of the confidence interval
 */
function calculatePERTConfidenceInterval(mean, stdDev, sampleSize = 1000) {
  const z = 1.96;
  const se = stdDev / Math.sqrt(sampleSize);
  return { lower: mean - z * se, upper: mean + z * se };
}

/**
 * Calculates the coefficient of variation (stdDev/mean) for a PERT distribution.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @returns {number} Coefficient of variation
 */
function calculatePERTCoefficientOfVariation(mean, stdDev) {
  return mean !== 0 ? stdDev / mean : 0;
}

/**
 * Calculates the Conditional Value at Risk (CVaR) at 95% confidence for a PERT distribution.
 * @param {Array} cdfPoints - CDF points
 * @param {number} min - Minimum value (fallback)
 * @returns {number} CVaR at 95% confidence
 */
function calculatePERTCVaR95(cdfPoints, min) {
  const tailPoints = cdfPoints.filter(p => p.y <= 0.05); // Worst 5% of outcomes
  return tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : min;
}

/* ============================================================================
   🟨 BETA DISTRIBUTION FUNCTIONS
   - Functions for computing metrics and points of the Beta distribution
============================================================================ */

/**
 * Calculates the alpha parameter for a Beta distribution based on mean and standard deviation.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Alpha parameter
 */
function calculateAlpha(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
  if (variance < 1e-10) return 1;
  const factor = ((mean - min) * (max - mean)) / variance - 1;
  return Math.max(1, factor * ((mean - min) / (max - min)));
}

/**
 * Calculates the beta parameter for a Beta distribution based on mean and standard deviation.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Beta parameter
 */
function calculateBeta(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
  if (variance < 1e-10) return 1;
  const factor = ((mean - min) * (max - mean)) / variance - 1;
  return Math.max(1, factor * ((max - mean) / (max - min)));
}

/**
 * Calculates the mode of a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Mode value
 */
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) return min;
  const mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}

/**
 * Calculates the mean of a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Mean value
 */
function calculateBetaMean(alpha, beta, min, max) {
  return min + (alpha / (alpha + beta)) * (max - min);
}

/**
 * Calculates the variance of a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Variance
 */
function calculateBetaVariance(alpha, beta, min, max) {
  const range = max - min;
  return (alpha * beta * range * range) / ((Math.pow(alpha + beta, 2) * (alpha + beta + 1)));
}

/**
 * Calculates the standard deviation of a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Standard deviation
 */
function calculateBetaStdDev(alpha, beta, min, max) {
  return Math.sqrt(calculateBetaVariance(alpha, beta, min, max));
}

/**
 * Calculates the skewness of a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @returns {number} Skewness
 */
function calculateBetaSkewness(alpha, beta) {
  const num = 2 * (beta - alpha) * Math.sqrt(alpha + beta + 1);
  const den = (alpha + beta + 2) * Math.sqrt(alpha * beta);
  return num / den;
}

/**
 * Calculates the kurtosis of a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @returns {number} Kurtosis
 */
function calculateBetaKurtosis(alpha, beta) {
  const num = 6 * (Math.pow(alpha - beta, 2) * (alpha + beta + 1) - alpha * beta * (alpha + beta + 2));
  const den = alpha * beta * (alpha + beta + 2) * (alpha + beta + 3);
  return num / den;
}

/**
 * Calculates the probability of exceeding the PERT mean for a Beta distribution.
 * @param {number} pertMean - PERT mean value
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Probability of exceeding PERT mean
 */
function calculateProbExceedPertMeanBeta(pertMean, alpha, beta, min, max) {
  const scaledPertMean = (pertMean - min) / (max - min);
  return 1 - jstat.beta.cdf(scaledPertMean, alpha, beta);
}

/**
 * Calculates the median of a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Median value
 */
function calculateBetaMedian(alpha, beta, min, max) {
  const scaledMedian = jstat.beta.inv(0.5, alpha, beta);
  return min + scaledMedian * (max - min);
}

/**
 * Calculates the value at a specified confidence level for a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} confidence - Confidence level (0 to 1)
 * @returns {number|null} Value at confidence level, or null if invalid
 */
function calculateBetaValueAtConfidence(alpha, beta, min, max, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  const scaledValue = jstat.beta.inv(confidence, alpha, beta);
  return min + scaledValue * (max - min);
}

/**
 * Generates PDF points for a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array} Array of {x, y, confidence} objects representing PDF
 */
function calculateBetaPdfPoints(alpha, beta, min, max) {
  const points = [];
  const step = (max - min) / 100;
  for (let i = 0; i <= 100; i++) {
    const x = min + i * step;
    const scaledX = (x - min) / (max - min);
    const y = jstat.beta.pdf(scaledX, alpha, beta) / (max - min);
    points.push({ x, y: isNaN(y) ? 0 : y, confidence: null });
  }
  return points;
}

/**
 * Calculates the 95% confidence interval for the mean of a Beta distribution.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @param {number} [sampleSize=1000] - Sample size for standard error
 * @returns {Object} {lower, upper} bounds of the confidence interval
 */
function calculateBetaConfidenceInterval(mean, stdDev, sampleSize = 1000) {
  const z = 1.96;
  const se = stdDev / Math.sqrt(sampleSize);
  return { lower: mean - z * se, upper: mean + z * se };
}

/**
 * Calculates the coefficient of variation (stdDev/mean) for a Beta distribution.
 * @param {number} mean - Mean value
 * @param {number} stdDev - Standard deviation
 * @returns {number} Coefficient of variation
 */
function calculateBetaCoefficientOfVariation(mean, stdDev) {
  return mean !== 0 ? stdDev / mean : 0;
}

/**
 * Calculates the Conditional Value at Risk (CVaR) at 95% confidence for a Beta distribution.
 * @param {Array} cdfPoints - CDF points
 * @param {number} min - Minimum value (fallback)
 * @returns {number} CVaR at 95% confidence
 */
function calculateBetaCVaR95(cdfPoints, min) {
  const tailPoints = cdfPoints.filter(p => p.y <= 0.05); // Worst 5% of outcomes
  return tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : min;
}


/* ============================================================================
   🟩 MONTE CARLO RAW FUNCTIONS
   - Functions for raw Monte Carlo sampling and metrics from Beta distribution
============================================================================ */

/**
 * Generates Monte Carlo samples from a Beta distribution without noise.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array<number>} Array of 1000 samples
 */
function monteCarloSamplesBetaNoNoise(alpha, beta, min, max) {
  const samples = [];
  for (let i = 0; i < 1000; i++) {
    const u = Math.random();
    const v = Math.random();
    const z = Math.pow(u, 1 / alpha) / (Math.pow(u, 1 / alpha) + Math.pow(v, 1 / beta));
    samples.push(min + z * (max - min));
  }
  return samples;
}

/**
 * Calculates unsmoothed metrics from Monte Carlo samples.
 * @param {Array<number>} samples - Array of Monte Carlo samples
 * @returns {Object} Metrics including mean, variance, stdDev, etc.
 */
function calculateUnsmoothedMetrics(samples) {
  const mean = math.mean(samples);
  const variance = math.variance(samples);
  const stdDev = Math.sqrt(variance);
  const skewness = jstat.skewness(samples);
  const kurtosis = jstat.kurtosis(samples);
  const var90 = calculateValueAtRisk(0.9, samples.map(x => ({ x })));
  const var95 = calculateValueAtRisk(0.95, samples.map(x => ({ x })));
  const cvar90 = calculateConditionalValueAtRisk(0.9, samples.map(x => ({ x })));
  const cvar95 = calculateConditionalValueAtRisk(0.95, samples.map(x => ({ x })));
  const mad = calculateMAD(samples, mean);
  const sorted = samples.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const confidenceInterval = { lower: mean - 1.96 * stdDev / Math.sqrt(samples.length), upper: mean + 1.96 * stdDev / Math.sqrt(samples.length) };
  const coefficientOfVariation = mean !== 0 ? stdDev / mean : 0;

  return {
    mean,
    variance,
    stdDev,
    skewness,
    kurtosis,
    var90,
    var95,
    cvar90,
    cvar95,
    mad,
    median,
    confidenceInterval,
    coefficientOfVariation
  };
}

/**
 * Calculates raw histogram points from Monte Carlo samples.
 * @param {Array<number>} samples - Array of Monte Carlo samples
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array} Array of {x, y, confidence} objects representing histogram
 */
function calculateMonteCarloRawPoints(samples, min, max) {
  const bins = 50;
  const step = (max - min) / bins;
  const counts = Array(bins).fill(0);
  samples.forEach(s => {
    const bin = Math.min(Math.floor((s - min) / step), bins - 1);
    counts[bin]++;
  });
  const maxCount = Math.max(...counts);
  return counts.map((count, i) => ({
    x: min + i * step,
    y: count / maxCount,
    confidence: null
  }));
}

/* ============================================================================
   🟩 MONTE CARLO SMOOTHED FUNCTIONS
   - Functions for smoothed Monte Carlo metrics and points (used as "original" PDF)
============================================================================ */

/**
 * Performs Kernel Density Estimation (KDE) on Monte Carlo samples.
 * @param {Array<number>} samples - Array of samples
 * @param {number} bandwidth - Bandwidth for KDE
 * @returns {Function} Density function
 */
function performKDE(samples, bandwidth) {
  const n = samples.length;
  const kernel = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const density = (x) => {
    return (1 / (n * bandwidth)) * samples.reduce((sum, s) => sum + kernel((x - s) / bandwidth), 0);
  };
  return density;
}

/**
 * Calculates smoothed metrics from Monte Carlo samples using KDE.
 * @param {Array<number>} samples - Array of Monte Carlo samples
 * @returns {Object} Smoothed metrics including mean, variance, stdDev, points, cdfPoints, etc.
 */
function calculateSmoothedMetrics(samples) {
  if (samples.length === 0) {
    throw new Error('Cannot calculate smoothed metrics: samples array is empty');
  }
  const bandwidth = 1.06 * math.std(samples) * Math.pow(samples.length, -1 / 5);
  const density = performKDE(samples, bandwidth);
  const min = math.min(samples);
  const max = math.max(samples);
  const step = (max - min) / 100;
  const xValues = math.range(min, max, step).toArray();
  const smoothedPoints = xValues.map(x => ({ x, y: density(x) }));
  const totalArea = math.sum(smoothedPoints.map(p => p.y * step));
  const normalizedPoints = smoothedPoints.map(p => ({ x: p.x, y: p.y / totalArea || 0 }));

  const smoothedMean = math.sum(normalizedPoints.map(p => p.x * p.y * step));
  const smoothedVariance = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 2) * p.y * step));
  const smoothedStdDev = Math.sqrt(smoothedVariance || 0);
  const m3 = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 3) * p.y * step));
  const m4 = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 4) * p.y * step));
  const smoothedSkewness = smoothedVariance > 0 ? m3 / Math.pow(smoothedVariance, 1.5) : 0;
  const smoothedKurtosis = smoothedVariance > 0 ? m4 / Math.pow(smoothedVariance, 2) - 3 : 0;

  let cdf = 0;
  const cdfPoints = normalizedPoints.map(p => {
    cdf += p.y * step;
    return { x: p.x, y: Math.min(cdf, 1), confidence: Math.min(cdf, 1) * 100 };
  });

  const varIndex90 = cdfPoints.findIndex(p => p.y >= 0.9);
  const smoothedVaR90 = varIndex90 > 0 ? cdfPoints[varIndex90].x : min;
  const varIndex95 = cdfPoints.findIndex(p => p.y >= 0.95);
  const smoothedVaR95 = varIndex95 > 0 ? cdfPoints[varIndex95].x : min;

  const tailPoints = cdfPoints.filter(p => p.y <= 0.1);
  const smoothedCVaR = tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : smoothedVaR90;
  const smoothedCVaR95 = calculateCVaR95(cdfPoints, min);

  const smoothedMAD = calculateMAD(samples, smoothedMean);

  const smoothedMedianIndex = cdfPoints.findIndex(p => p.y >= 0.5);
  const smoothedMedian = smoothedMedianIndex > 0 ? cdfPoints[smoothedMedianIndex].x : smoothedMean;

  const smoothedCoefficientOfVariation = smoothedMean !== 0 ? smoothedStdDev / smoothedMean : 0;
  const smoothedConfidenceInterval = {
    lower: smoothedMean - 1.96 * (smoothedStdDev / Math.sqrt(1000)),
    upper: smoothedMean + 1.96 * (smoothedStdDev / Math.sqrt(1000))
  };

  return {
    mean: smoothedMean,
    variance: smoothedVariance,
    stdDev: smoothedStdDev,
    skewness: smoothedSkewness,
    kurtosis: smoothedKurtosis,
    var90: smoothedVaR90,
    var95: smoothedVaR95,
    cvar: smoothedCVaR,
    cvar95: smoothedCVaR95,
    mad: smoothedMAD,
    median: smoothedMedian,
    coefficientOfVariation: smoothedCoefficientOfVariation,
    confidenceInterval: smoothedConfidenceInterval,
    points: normalizedPoints,
    cdfPoints: cdfPoints
  };
}

/* ============================================================================
   🟩 GENERAL MONTE CARLO UTILITY FUNCTIONS
   - Shared utilities for both raw and smoothed Monte Carlo calculations
============================================================================ */

/**
 * Calculates the probability of exceeding the PERT mean from Monte Carlo samples.
 * @param {Array<number>} samples - Array of samples
 * @param {number} pertMean - PERT mean value
 * @returns {number} Probability of exceeding PERT mean
 */
function calculateProbExceedPertMeanMC(samples, pertMean) {
  return samples.filter(x => x > pertMean).length / samples.length;
}

/**
 * Calculates the Value at Risk (VaR) at a given confidence level.
 * @param {number} confLevel - Confidence level (0 to 1)
 * @param {Array} points - Array of {x} objects
 * @returns {number} VaR value
 */
function calculateValueAtRisk(confLevel, points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confLevel) * sorted.length);
  return sorted[index]?.x || sorted[0]?.x || 0;
}

/**
 * Calculates the Conditional Value at Risk (CVaR) at a given confidence level.
 * @param {number} confLevel - Confidence level (0 to 1)
 * @param {Array} points - Array of {x} objects
 * @returns {number} CVaR value
 */
function calculateConditionalValueAtRisk(confLevel, points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confLevel) * sorted.length);
  const tail = sorted.slice(0, index + 1);
  return tail.length > 0 ? tail.reduce((sum, p) => sum + p.x, 0) / tail.length : sorted[0]?.x || 0;
}

/**
 * Calculates the Conditional Value at Risk (CVaR) at 95% confidence for any distribution.
 * @param {Array} cdfPoints - CDF points
 * @param {number} min - Minimum value (fallback)
 * @returns {number} CVaR at 95% confidence
 */
function calculateCVaR95(cdfPoints, min) {
  const tailPoints = cdfPoints.filter(p => p.y <= 0.05); // Worst 5% of outcomes
  return tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : min;
}

/**
 * Calculates the Mean Absolute Deviation (MAD) from the median.
 * @param {Array<number>} samples - Array of samples
 * @param {number} median - Median value
 * @returns {number} MAD
 */
function calculateMAD(samples, median) {
  const deviations = samples.map(x => Math.abs(x - median)).sort((a, b) => a - b);
  const mid = Math.floor(deviations.length / 2);
  return deviations.length % 2 === 0 ? (deviations[mid - 1] + deviations[mid]) / 2 : deviations[mid];
}



/* ============================================================================
   🟩 GENERAL MONTE CARLO UTILITY FUNCTIONS (CONTINUED)
   - Shared utilities for both raw and smoothed Monte Carlo calculations
============================================================================ */

/**
 * Generates distribution points (CDF) for a specified distribution type.
 * @param {string} type - Distribution type ('TRIANGLE', 'PERT', 'BETA', 'MC_UNSMOOTHED')
 * @param {number} min - Minimum value
 * @param {number} mode - Most likely value
 * @param {number} max - Maximum value
 * @param {number|null} alpha - Alpha parameter (for Beta/PERT)
 * @param {number|null} beta - Beta parameter (for Beta/PERT)
 * @param {Array<number>|null} samples - Monte Carlo samples (for MC_UNSMOOTHED)
 * @returns {Array} Array of {x, y, confidence} objects representing CDF
 */
function generateDistributionPoints(type, min, mode, max, alpha, beta, samples) {
  if (mode === min || mode === max) {
    return [{ x: mode, y: 1, confidence: 50 }];
  }
  const points = [];
  const step = (max - min) / 100;
  for (let i = 0; i <= 100; i++) {
    const x = min + i * step;
    let y;
    if (type === 'TRIANGLE') {
      if (x < min) y = 0;
      else if (x < mode) {
        y = Math.pow(x - min, 2) / ((max - min) * (mode - min));
      } else if (x === mode) {
        y = (mode - min) / (max - min);
      } else if (x <= max) {
        y = 1 - Math.pow(max - x, 2) / ((max - min) * (max - mode));
      } else {
        y = 1;
      }
      points.push({ x, y, confidence: y * 100 });
    } else if (type === 'PERT' || type === 'BETA') {
      y = jstat.beta.cdf((x - min) / (max - min), alpha, beta);
      points.push({ x, y, confidence: y * 100 });
    } else if (type === 'MC_UNSMOOTHED') {
      y = samples.filter(s => s <= x).length / samples.length;
      points.push({ x, y, confidence: y * 100 });
    } else {
      y = 0;
      points.push({ x, y, confidence: 0 });
    }
  }
  return points;
}

/**
 * Generates confidence values for a specified distribution type.
 * @param {string} type - Distribution type
 * @param {number} min - Minimum value
 * @param {number} mode - Most likely value
 * @param {number} max - Maximum value
 * @param {number|null} alpha - Alpha parameter (for Beta/PERT)
 * @param {number|null} beta - Beta parameter (for Beta/PERT)
 * @param {Array<number>|null} samples - Monte Carlo samples
 * @param {Array<number>} [confidenceLevels] - Confidence levels to compute
 * @returns {Object} Values at specified confidence levels
 */
function generateConfidenceValues(type, min, mode, max, alpha, beta, samples, confidenceLevels = [0.05, 0.1, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99]) {
  const values = {};
  for (const conf of confidenceLevels) {
    let value;
    if (type === 'TRIANGLE') {
      value = calculateTriangleValueAtConfidence(min, mode, max, conf);
    } else if (type === 'PERT') {
      value = calculatePERTValueAtConfidence(min, mode, max, alpha, beta, conf);
    } else if (type === 'BETA') {
      value = calculateBetaValueAtConfidence(alpha, beta, min, max, conf);
    } else if (type === 'MC_UNSMOOTHED') {
      value = calculateValueAtRisk(1 - conf, samples.map(x => ({ x })));
    } else if (type === 'MC_SMOOTHED') {
      const cdfPoints = generateDistributionPoints('MC_UNSMOOTHED', min, mode, max, alpha, beta, samples);
      const idx = cdfPoints.findIndex(p => p.y >= conf);
      value = idx >= 0 ? cdfPoints[idx].x : max;
    }
    values[`valueAt${Math.round(conf * 100)}Percent`] = value !== null ? value : mode;
  }
  return values;
}

/* ============================================================================
   🟪 target probability functions
   - Functions supporting the Target Probability tab, including PDF and CDF adjustments
============================================================================ */

/**
 * Calculates aggregated decision optimizer points by averaging multiple distribution points.
 * @param {Array} trianglePoints - Triangle CDF points
 * @param {Array} pertPoints - PERT CDF points
 * @param {Array} betaPoints - Beta CDF points
 * @param {Array} mcPoints - Monte Carlo smoothed PDF points
 * @returns {Array} Averaged {x, y, confidence} points
 */
function calculateDecisionOptimizerPoints(trianglePoints, pertPoints, betaPoints, mcPoints) {
  const points = [];
  const min = Math.min(...trianglePoints.map(p => p.x));
  const max = Math.max(...trianglePoints.map(p => p.x));
  const step = (max - min) / 100;
  for (let i = 0; i <= 100; i++) {
    const x = min + i * step;
    const y = (
      (trianglePoints.find(p => Math.abs(p.x - x) < step / 2)?.y || 0) +
      (pertPoints.find(p => Math.abs(p.x - x) < step / 2)?.y || 0) +
      (betaPoints.find(p => Math.abs(p.x - x) < step / 2)?.y || 0) +
      (mcPoints.find(p => Math.abs(p.x - x) < step / 2)?.y || 0)
    ) / 4;
    points.push({ x, y, confidence: y * 100 });
  }
  return points;
}

/**
 * Calculates target probability points for specified target values (used for reference).
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} mean - Mean value
 * @param {Array<number>} [targets] - Target values to evaluate
 * @returns {Array} Array of {x, y, confidence} points
 */
function calculateTargetProbabilityPoints(min, max, mean, targets = [mean * 0.9, mean, mean * 1.1]) {
  const points = [];
  for (const target of targets) {
    const prob = jstat.beta.cdf((target - min) / (max - min), 4, 4);
    points.push({ x: target, y: prob, confidence: prob * 100 });
  }
  return points;
}

/**
 * Calculates probabilities of exceeding specified targets for a distribution type.
 * @param {string} type - Distribution type
 * @param {number} min - Minimum value
 * @param {number} mode - Most likely value
 * @param {number} max - Maximum value
 * @param {number|null} alpha - Alpha parameter (for Beta/PERT)
 * @param {number|null} beta - Beta parameter (for Beta/PERT)
 * @param {Array<number>|null} samples - Monte Carlo samples
 * @param {Array<number>} targets - Target values
 * @returns {Object} Probabilities of exceeding each target
 */
function calculateProbExceedTargets(type, min, mode, max, alpha, beta, samples, targets) {
  const probs = {};
  for (const target of targets) {
    let prob;
    if (type === 'TRIANGLE') {
      if (target < min) prob = 1;
      else if (target >= max) prob = 0;
      else if (target <= mode) prob = 1 - Math.pow(target - min, 2) / ((max - min) * (mode - min));
      else prob = Math.pow(max - target, 2) / ((max - min) * (max - mode));
    } else if (type === 'PERT' || type === 'BETA') {
      prob = 1 - jstat.beta.cdf((target - min) / (max - min), alpha, beta);
    } else if (type === 'MC_UNSMOOTHED' || type === 'MC_SMOOTHED') {
      prob = samples.filter(s => s > target).length / samples.length;
    } else {
      prob = 0;
    }
    probs[`probExceed${target.toFixed(2)}`] = prob;
  }
  return probs;
}

/**
 * Calculates the KL Divergence between two sets of points.
 * @param {Array} points1 - First set of points
 * @param {Array} points2 - Second set of points
 * @param {number} step - Step size between points
 * @returns {number} KL Divergence value
 */
function calculateKLDivergence(points1, points2, step) {
  let kl = 0;
  for (let i = 0; i < points1.length; i++) {
    const p1 = points1[i].y || 1e-10;
    const p2 = points2[i].y || 1e-10;
    kl += p1 * Math.log(p1 / p2) * step;
  }
  return kl;
}

/**
 * Calculates sensitivity of the mean to variations in min and max estimates.
 * @param {number} mean - Current mean
 * @param {number} stdDev - Standard deviation
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} [variation=0.1] - Variation factor
 * @returns {Object} {originalMean, variedMean, change}
 */
function calculateSensitivity(mean, stdDev, min, max, variation = 0.1) {
  const variedMin = min * (1 - variation);
  const variedMax = max * (1 + variation);
  const variedMean = calculateTriangleMean(variedMin, mean, variedMax);
  return { originalMean: mean, variedMean, change: variedMean - mean };
}

/**
 * Adjusts PDF points based on slider values using a location-scale transformation.
 * @param {Array} points - Original PDF points
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {Object} sliderValues - {budgetFlexibility, scheduleFlexibility, scopeCertainty, riskTolerance}
 * @returns {Array} Adjusted PDF points
 */
function adjustDistributionPoints(points, originalMean, originalStdDev, sliderValues) {
  const { budgetFlexibility, scheduleFlexibility, scopeCertainty, riskTolerance } = sliderValues;
  const bf = budgetFlexibility / 100;
  const sf = scheduleFlexibility / 100;
  const sc = scopeCertainty / 100;
  const rt = riskTolerance / 100;
  const meanShift = -0.5 * (bf + sf + sc + rt) * originalStdDev;
  const varianceScale = 1 + 2.0 * (1 - sc) + 1.0 * rt - 0.5 * (bf + sf);
  const stdDevScale = Math.sqrt(Math.max(0.1, varianceScale));
  const a = meanShift + originalMean * (1 - stdDevScale);
  const b = stdDevScale;
  return points.map(p => {
    const adjustedX = a + b * p.x;
    const adjustedY = p.y / b; // Adjust density
    return { x: adjustedX, y: adjustedY, confidence: p.confidence };
  });
}

/**
 * Adjusts CDF points based on slider values using a location-scale transformation.
 * @param {Array} originalCdfPoints - Original CDF points
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {Object} sliderValues - {budgetFlexibility, scheduleFlexibility, scopeCertainty, riskTolerance}
 * @returns {Array} Adjusted CDF points
 */
function adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, sliderValues) {
  if (!Array.isArray(originalCdfPoints) || originalCdfPoints.length < 2) {
    console.warn('adjustCdfPoints: Invalid originalCdfPoints, returning fallback points');
    return [{ x: originalMean || 0, y: 1, confidence: 50 }];
  }
  if (!Number.isFinite(originalMean) || !Number.isFinite(originalStdDev)) {
    console.warn('adjustCdfPoints: Invalid mean or stdDev, returning original points');
    return originalCdfPoints;
  }

  const { budgetFlexibility = 0, scheduleFlexibility = 0, scopeCertainty = 0, riskTolerance = 0 } = sliderValues;
  const bf = budgetFlexibility / 100;
  const sf = scheduleFlexibility / 100;
  const sc = scopeCertainty / 100;
  const rt = riskTolerance / 100;
  const meanShift = -0.5 * (bf + sf + sc + rt) * originalStdDev;
  const varianceScale = 1 + 2.0 * (1 - sc) + 1.0 * rt - 0.5 * (bf + sf);
  const stdDevScale = Math.sqrt(Math.max(0.1, varianceScale));
  const a = meanShift + originalMean * (1 - stdDevScale);
  const b = stdDevScale;

  return originalCdfPoints.map(p => {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      return { x: originalMean, y: p.y || 0, confidence: p.confidence || 0 };
    }
    const adjustedX = a + b * p.x;
    return { x: Number.isFinite(adjustedX) ? adjustedX : originalMean, y: p.y, confidence: p.confidence };
  });
}
/**
 * Calculates metrics for the adjusted distribution (e.g., medians and confidence).
 * @param {Array} originalPoints - Original PDF points
 * @param {Array} adjustedPoints - Adjusted PDF points
 * @returns {Object} {originalMedian, adjustedMedian, newConfidence}
 */
function calculateAdjustedMetrics(originalPoints, adjustedPoints) {
  const originalMedian = originalPoints.find(p => p.confidence >= 50)?.x || math.median(originalPoints.map(p => p.x));
  const adjustedMedian = adjustedPoints.find(p => p.confidence >= 50)?.x || math.median(adjustedPoints.map(p => p.x));
  const step = (originalPoints[1]?.x - originalPoints[0]?.x) || 1;
  const newConfidence = adjustedPoints.reduce((sum, p) => sum + p.y * step * (p.x >= adjustedMedian ? 1 : 0), 0) * 100;
  return { originalMedian, adjustedMedian, newConfidence };
}

/**
 * Calculates the Expected Shortfall for outcomes exceeding a threshold.
 * @param {Array} cdfPoints - CDF points
 * @param {number} threshold - Threshold value for shortfall (e.g., target value)
 * @returns {number} Expected Shortfall value
 */
function calculateExpectedShortfall(cdfPoints, threshold, fallbackValue = 0) {
  // Validate inputs
  if (!Array.isArray(cdfPoints) || cdfPoints.length === 0) {
    console.warn('calculateExpectedShortfall: Invalid or empty cdfPoints, returning fallback');
    return Number.isFinite(threshold) ? threshold : fallbackValue;
  }
  if (!Number.isFinite(threshold)) {
    console.warn('calculateExpectedShortfall: Invalid threshold, returning fallback');
    return fallbackValue;
  }

  const tailPoints = cdfPoints.filter(p => Number.isFinite(p.x) && p.x > threshold);
  if (tailPoints.length === 0) {
    console.warn('calculateExpectedShortfall: No tail points found, returning threshold');
    return threshold;
  }

  const mean = math.mean(tailPoints.map(p => p.x));
  return Number.isFinite(mean) ? mean : fallbackValue;
}

/**
 * Calculates the sensitivity of probability to changes in slider values.
 * @param {Array} originalCdfPoints - Original CDF points
 * @param {number} targetValue - Target value
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {Object} sliderValues - Current slider settings
 * @returns {Object} Sensitivity of each slider (change in probability per 1% change)
 */
function calculateSliderSensitivity(originalCdfPoints, targetValue, originalMean, originalStdDev, sliderValues) {
  const sensitivities = {};
  const sliders = ['budgetFlexibility', 'scheduleFlexibility', 'scopeCertainty', 'riskTolerance'];
  const baselineProb = interpolateCdf(originalCdfPoints, targetValue);
  for (const slider of sliders) {
    const plusValues = { ...sliderValues, [slider]: Math.min(sliderValues[slider] + 10, 100) };
    const minusValues = { ...sliderValues, [slider]: Math.max(sliderValues[slider] - 10, 0) };
    const plusProb = interpolateCdf(adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, plusValues), targetValue);
    const minusProb = interpolateCdf(adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, minusValues), targetValue);
    sensitivities[slider] = (plusProb - minusProb) * 100 / 20; // Sensitivity per 1% change
  }
  return sensitivities;
}

/**
 * Calculates the shift in mean and variance due to slider adjustments.
 * @param {Array} originalCdfPoints - Original CDF points
 * @param {Array} adjustedCdfPoints - Adjusted CDF points
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @returns {Object} {meanShift, varianceScale}
 */
function calculateDistributionShift(originalCdfPoints, adjustedCdfPoints, originalMean, originalStdDev) {
  const step = (originalCdfPoints[1]?.x - originalCdfPoints[0]?.x) || 1;
  const adjustedMean = math.sum(adjustedCdfPoints.map(p => p.x * p.y * step));
  const adjustedVariance = math.sum(adjustedCdfPoints.map(p => Math.pow(p.x - adjustedMean, 2) * p.y * step));
  return {
    meanShift: adjustedMean - originalMean,
    varianceScale: originalStdDev !== 0 ? adjustedVariance / (originalStdDev * originalStdDev) : 1
  };
}

/**
 * Calculates the risk-adjusted cost/benefit ratio.
 * @param {number} adjProb - Adjusted probability
 * @param {number} baselineProb - Baseline probability
 * @param {number} cvar95 - CVaR at 95% confidence
 * @param {number} targetValue - Target value
 * @returns {number} Risk-adjusted ratio (benefit per unit of risk)
 */
function calculateRiskAdjustedRatio(adjProb, baselineProb, cvar95, targetValue) {
  const benefit = (adjProb - baselineProb) * 100;
  const risk = Math.max(cvar95 - targetValue, 0);
  return risk > 0 ? benefit / risk : benefit;
}

/**
 * Calculates probabilities of specific risks tied to sliders.
 * @param {Array} cdfPoints - CDF points
 * @param {Object} sliderValues - Current slider settings
 * @param {Object} thresholds - Risk thresholds {cost, schedule, scope, quality}
 * @returns {Object} Probabilities of specific risks
 */
function calculateRiskProbabilities(cdfPoints, sliderValues, thresholds) {
  return {
    costOverrun: interpolateCdf(cdfPoints, thresholds.cost),
    scheduleDelay: interpolateCdf(cdfPoints, thresholds.schedule),
    scopeCreep: 1 - (sliderValues.scopeCertainty / 100), // Simplified model
    qualityDefect: sliderValues.riskTolerance / 100 // Simplified model
  };
}

/**
 * Generates a textual description of the dynamic outcome based on slider settings.
 * @param {number} bf - Budget Flexibility (0 to 1)
 * @param {number} sf - Schedule Flexibility (0 to 1)
 * @param {number} sc - Scope Certainty (0 to 1)
 * @param {number} rt - Risk Tolerance (0 to 1)
 * @param {number} origProb - Original probability
 * @param {number} adjProb - Adjusted probability
 * @param {number} targetValue - Target value
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {Object} sensitivities - Slider sensitivities
 * @param {Object} distShift - Distribution shift {meanShift, varianceScale}
 * @param {number} riskAdjustedRatio - Risk-adjusted cost/benefit ratio
 * @param {Object} riskProbabilities - Specific risk probabilities
 * @returns {string} Descriptive outcome string
 */
function generateDynamicOutcome(bf, sf, sc, rt, origProb, adjProb, targetValue, originalMean, originalStdDev, sensitivities, distShift, riskAdjustedRatio, riskProbabilities) {
  const probChange = adjProb - origProb;
  const { meanShift, varianceScale } = distShift;
  const skewAdjustment = -0.05 * rt + 0.2 * (1 - sc);
  const isBelowMean = targetValue < originalMean - 0.5 * originalStdDev;

  let outcome = `With Budget Flexibility=${(bf * 100).toFixed(0)}%, Schedule Flexibility=${(sf * 100).toFixed(0)}%, Scope Certainty=${(sc * 100).toFixed(0)}%, Risk Tolerance=${(rt * 100).toFixed(0)}%, `;
  if (probChange > 0) {
    outcome += `probability increases by ${(probChange * 100).toFixed(1)}% to ${(adjProb * 100).toFixed(1)}%. `;
  } else if (probChange < 0) {
    outcome += `probability decreases by ${(-probChange * 100).toFixed(1)}% to ${(adjProb * 100).toFixed(1)}%. `;
  } else {
    outcome += `probability remains at ${(adjProb * 100).toFixed(1)}%. `;
  }
  if (meanShift > 0) outcome += `Mean shifts right by ${meanShift.toFixed(2)} units, `;
  else if (meanShift < 0) outcome += `Mean shifts left by ${(-meanShift).toFixed(2)} units, `;
  else outcome += `Mean unchanged, `;
  if (varianceScale > 1) outcome += `variance increases by ${(varianceScale - 1).toFixed(2)}, `;
  else if (varianceScale < 1) outcome += `variance decreases by ${(1 - varianceScale).toFixed(2)}, `;
  else outcome += `variance unchanged, `;
  if (skewAdjustment > 0) outcome += `skew increases by ${skewAdjustment.toFixed(2)}. `;
  else if (skewAdjustment < 0) outcome += `skew decreases by ${(-skewAdjustment).toFixed(2)}. `;
  else outcome += `skew unchanged. `;
  outcome += `Key sensitivities: Budget=${sensitivities.budgetFlexibility.toFixed(2)}%/%, Scope=${sensitivities.scopeCertainty.toFixed(2)}%/%. `;
  outcome += `Risk-benefit ratio: ${riskAdjustedRatio.toFixed(2)}%/unit. `;
  outcome += `Risk probabilities: Cost Overrun=${(riskProbabilities.costOverrun * 100).toFixed(1)}%, Scope Creep=${(riskProbabilities.scopeCreep * 100).toFixed(1)}%. `;
  outcome += isBelowMean ? `Target is below mean, increasing likelihood.` : `Target is above mean, reducing likelihood.`;
  return outcome;
}

/**
 * Generates a scenario summary string by ordering slider values.
 * @param {number} bf - Budget Flexibility (0 to 100)
 * @param {number} sf - Schedule Flexibility (0 to 100)
 * @param {number} sc - Scope Certainty (0 to 100)
 * @param {number} rt - Risk Tolerance (0 to 100)
 * @returns {string} Summary string (e.g., "BF = SF < SC = RT")
 */
function getScenarioSummary(bf, sf, sc, rt) {
  const sliders = [
    { name: 'BF', value: bf },
    { name: 'SF', value: sf },
    { name: 'SC', value: sc },
    { name: 'RT', value: rt }
  ];
  sliders.sort((a, b) => a.value - b.value);
  let summary = '';
  let currentValue = sliders[0].value;
  let group = [sliders[0].name];
  for (let i = 1; i < sliders.length; i++) {
    if (sliders[i].value === currentValue) {
      group.push(sliders[i].name);
    } else {
      summary += group.join(' = ') + (i < sliders.length ? ' < ' : '');
      group = [sliders[i].name];
      currentValue = sliders[i].value;
    }
  }
  summary += group.join(' = ');
  return summary;
}

/**
 * Computes outcomes for all possible slider combinations (for reference).
 * @param {Array} originalCdfPoints - Original CDF points
 * @param {number} targetValue - Target value
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {Array} originalPoints - Original PDF points
 * @param {Array} sliderSteps - Slider values to iterate
 * @returns {Array} Array of combination objects
 */
function computeSliderCombinations(originalCdfPoints, targetValue, originalMean, originalStdDev, originalPoints, sliderSteps = [0, 25, 50, 75, 100]) {
  if (!Number.isFinite(targetValue)) {
    console.warn('computeSliderCombinations: Invalid targetValue, using originalMean as fallback');
    targetValue = originalMean || 0;
  }
  if (!Array.isArray(originalCdfPoints) || originalCdfPoints.length < 2) {
    console.warn('computeSliderCombinations: Invalid originalCdfPoints, returning empty combinations');
    return [];
  }

  const combinations = [];
  const origProb = originalCdfPoints.find(p => Number.isFinite(p.x) && p.x >= targetValue)?.y || 1;
  const baselineCdfPoints = adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, {
    budgetFlexibility: 0,
    scheduleFlexibility: 0,
    scopeCertainty: 0,
    riskTolerance: 0
  });
  const baselineCvar95 = calculateCVaR95(baselineCdfPoints, originalMean);

  for (const bf of sliderSteps) {
    for (const sf of sliderSteps) {
      for (const sc of sliderSteps) {
        for (const rt of sliderSteps) {
          const sliderValues = { budgetFlexibility: bf, scheduleFlexibility: sf, scopeCertainty: sc, riskTolerance: rt };
          const adjustedPoints = adjustDistributionPoints(originalPoints, originalMean, originalStdDev, sliderValues);
          let cdf = 0;
          const step = (adjustedPoints[1]?.x - adjustedPoints[0]?.x) || 1;
          const adjustedCdfPoints = adjustedPoints.map(p => {
            cdf += p.y * step;
            return { x: p.x, y: Math.min(cdf, 1) };
          });
          const adjProb = interpolateCdf(adjustedCdfPoints, targetValue) || 1;

          // Calculate individual slider impacts
          const bfOnly = adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, { budgetFlexibility: bf, scheduleFlexibility: 0, scopeCertainty: 0, riskTolerance: 0 });
          const sfOnly = adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, { budgetFlexibility: 0, scheduleFlexibility: sf, scopeCertainty: 0, riskTolerance: 0 });
          const scOnly = adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, { budgetFlexibility: 0, scheduleFlexibility: 0, scopeCertainty: sc, riskTolerance: 0 });
          const rtOnly = adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, { budgetFlexibility: 0, scheduleFlexibility: 0, scopeCertainty: 0, riskTolerance: rt });
          const bfImpact = (interpolateCdf(bfOnly, targetValue) - origProb) * 100;
          const sfImpact = (interpolateCdf(sfOnly, targetValue) - origProb) * 100;
          const scImpact = (interpolateCdf(scOnly, targetValue) - origProb) * 100;
          const rtImpact = (interpolateCdf(rtOnly, targetValue) - origProb) * 100;

          // Calculate new metrics
          const expectedShortfallRaw = calculateExpectedShortfall(adjustedCdfPoints, targetValue, originalMean);
          const expectedShortfall = Number.isFinite(expectedShortfallRaw) ? expectedShortfallRaw : originalMean;
          const sensitivities = calculateSliderSensitivity(originalCdfPoints, targetValue, originalMean, originalStdDev, sliderValues);
          const distShift = calculateDistributionShift(originalCdfPoints, adjustedCdfPoints, originalMean, originalStdDev);
          const cvar95 = calculateCVaR95(adjustedCdfPoints, originalMean);
          const riskAdjustedRatio = calculateRiskAdjustedRatio(adjProb, origProb, cvar95, targetValue);
          const riskThresholds = {
            cost: targetValue * 1.1, // 10% cost overrun
            schedule: targetValue * 1.1, // Placeholder
            scope: sc, // Use slider value directly
            quality: rt // Use slider value directly
          };
          const riskProbabilities = calculateRiskProbabilities(adjustedCdfPoints, sliderValues, riskThresholds);

          // Determine key impact
          const impacts = [
            { name: 'Budget Flexibility', impact: bfImpact, effect: 'Mitigates cost overruns' },
            { name: 'Schedule Flexibility', impact: sfImpact, effect: 'Reduces schedule delays' },
            { name: 'Scope Certainty', impact: scImpact, effect: 'Reduces scope creep' },
            { name: 'Tolerance for Poor Quality', impact: rtImpact, effect: 'Manages quality trade-offs' }
          ];
          const keyImpact = impacts.reduce((max, curr) => Math.abs(curr.impact) > Math.abs(max.impact) ? curr : max, impacts[0]).effect;

          const outcome = generateDynamicOutcome(
            bf / 100, sf / 100, sc / 100, rt / 100,
            origProb, adjProb, targetValue, originalMean, originalStdDev,
            sensitivities, distShift, riskAdjustedRatio, riskProbabilities
          );
          const scenarioSummary = getScenarioSummary(bf, sf, sc, rt);

          combinations.push({
            budgetFlexibility: bf,
            scheduleFlexibility: sf,
            scopeCertainty: sc,
            riskTolerance: rt,
            probability: adjProb,
            scenarioSummary,
            expectedOutcome: outcome,
            budgetFlexImpact: Number.isFinite(bfImpact) ? bfImpact.toFixed(1) : '0.0',
            scheduleFlexImpact: Number.isFinite(sfImpact) ? sfImpact.toFixed(1) : '0.0',
            scopeCertImpact: Number.isFinite(scImpact) ? scImpact.toFixed(1) : '0.0',
            tolPoorQualImpact: Number.isFinite(rtImpact) ? rtImpact.toFixed(1) : '0.0',
            expectedShortfall: Number.isFinite(expectedShortfall) ? expectedShortfall.toFixed(2) : '0.00',
            sensitivities,
            meanShift: Number.isFinite(distShift.meanShift) ? distShift.meanShift.toFixed(2) : '0.00',
            varianceScale: Number.isFinite(distShift.varianceScale) ? distShift.varianceScale.toFixed(2) : '1.00',
            riskAdjustedRatio: Number.isFinite(riskAdjustedRatio) ? riskAdjustedRatio.toFixed(2) : '0.00',
            riskProbabilities,
            keyImpact
          });
        }
      }
    }
  }
  return combinations;
}
/**
 * Finds the slider combination that maximizes the probability of meeting the target value.
 * @param {Array} combinations - Array of combination objects
 * @returns {Object|null} Optimal combination or null if empty
 */
function getOptimalCombination(combinations) {
  if (!combinations || combinations.length === 0) return null;
  return combinations.reduce((max, curr) => curr.adjProb > max.adjProb ? curr : max, combinations[0]);
}

/* ============================================================================
   🟪 OPTIMIZATION FUNCTIONS
   - Functions to find optimal slider settings for target or confidence levels
============================================================================ */

/**
 * Interpolates the CDF value at a given target value.
 * @param {Array} cdfPoints - CDF points
 * @param {number} targetValue - Target value
 * @returns {number} Interpolated CDF value (0 to 1)
 */
function interpolateCdf(cdfPoints, targetValue) {
  for (let i = 0; i < cdfPoints.length - 1; i++) {
    if (cdfPoints[i].x <= targetValue && targetValue < cdfPoints[i + 1].x) {
      const x1 = cdfPoints[i].x;
      const y1 = cdfPoints[i].y;
      const x2 = cdfPoints[i + 1].x;
      const y2 = cdfPoints[i + 1].y;
      return y1 + (y2 - y1) * (targetValue - x1) / (x2 - x1);
    }
  }
  if (targetValue < cdfPoints[0].x) return 0;
  if (targetValue >= cdfPoints[cdfPoints.length - 1].x) return 1;
  return 0;
}

/**
 * Finds the value at a given confidence level from CDF points.
 * @param {Array} cdfPoints - CDF points
 * @param {number} confidenceLevel - Confidence level (0 to 1)
 * @returns {number} Value where CDF reaches or exceeds confidence level
 */
function findValueAtConfidence(cdfPoints, confidenceLevel) {
  for (let i = 0; i < cdfPoints.length; i++) {
    if (cdfPoints[i].y >= confidenceLevel) {
      return cdfPoints[i].x;
    }
  }
  return cdfPoints[cdfPoints.length - 1].x;
}

/**
 * Finds optimal slider settings to maximize probability for a target or minimize value for a confidence level.
 * @param {Array} originalCdfPoints - Original CDF points (from smoothed MC)
 * @param {number} originalMean - Original mean (from smoothed MC)
 * @param {number} originalStdDev - Original standard deviation (from smoothed MC)
 * @param {number|null} targetValue - Target value to maximize P(X <= targetValue)
 * @param {number|null} confidenceLevel - Confidence level to minimize value at
 * @param {Array} originalPdfPoints - Original PDF points (from smoothed MC)
 * @returns {Object|null} {optimalSliderSettings, optimalAdjustedPdfPoints, optimalAdjustedCdfPoints, optimalObjective, probability}
 */
function findOptimalSliderSettings(originalCdfPoints, originalMean, originalStdDev, targetValue, confidenceLevel, originalPdfPoints) {
  const sliderSteps = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  let bestSettings = null;
  let bestObjective = targetValue ? -Infinity : Infinity;
  let bestAdjustedCdfPoints = null;
  let bestProbability = 0;

  for (const bf of sliderSteps) {
    for (const sf of sliderSteps) {
      for (const sc of sliderSteps) {
        for (const rt of sliderSteps) {
          const sliderValues = { budgetFlexibility: bf, scheduleFlexibility: sf, scopeCertainty: sc, riskTolerance: rt };
          const adjustedCdfPoints = adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, sliderValues);
          if (targetValue) {
            const prob = interpolateCdf(adjustedCdfPoints, targetValue);
            if (prob > bestObjective) {
              bestObjective = prob;
              bestSettings = sliderValues;
              bestAdjustedCdfPoints = adjustedCdfPoints;
              bestProbability = prob;
            }
          } else if (confidenceLevel) {
            const x = findValueAtConfidence(adjustedCdfPoints, confidenceLevel);
            if (x < bestObjective) {
              bestObjective = x;
              bestSettings = sliderValues;
              bestAdjustedCdfPoints = adjustedCdfPoints;
              bestProbability = interpolateCdf(adjustedCdfPoints, x);
            }
          }
        }
      }
    }
  }

  if (bestSettings) {
    const optimalAdjustedPdfPoints = adjustDistributionPoints(originalPdfPoints, originalMean, originalStdDev, bestSettings);
    return {
      optimalSliderSettings: bestSettings,
      optimalAdjustedPdfPoints,
      optimalAdjustedCdfPoints: bestAdjustedCdfPoints,
      optimalObjective: bestObjective,
      probability: bestProbability
    };
  }
  return null;
}


/* ============================================================================
   🟪 MAIN PROCESS FUNCTION
   - Orchestrates all calculations and returns comprehensive results
============================================================================ */

/**
 * Processes a task to compute statistical metrics, distributions, and target probability data.
 * @param {Object} params - Input parameters
 * @param {string} params.task - Task name
 * @param {number} params.optimistic - Optimistic estimate
 * @param {number} params.mostLikely - Most likely estimate
 * @param {number} params.pessimistic - Pessimistic estimate
 * @param {Object} params.sliderValues - Current slider settings
 * @param {number} [params.targetValue] - Target value for probability calculations
 * @param {string} [params.optimizeFor] - 'target' or 'confidence' for optimization
 * @param {number} [params.confidenceLevel] - Confidence level for optimization
 * @returns {Object} Comprehensive results with all metrics and points
 */
function processTask({ task, optimistic, mostLikely, pessimistic, sliderValues, targetValue, optimizeFor, confidenceLevel }) {
  try {
    if (!task || !Number.isFinite(optimistic) || !Number.isFinite(mostLikely) || !Number.isFinite(pessimistic)) {
      throw new Error('Invalid task or estimates: task name and finite numbers required');
    }
    const effectiveSliders = {
      budgetFlexibility: Number.isFinite(sliderValues?.budgetFlexibility) ? sliderValues.budgetFlexibility : 0,
      scheduleFlexibility: Number.isFinite(sliderValues?.scheduleFlexibility) ? sliderValues.scheduleFlexibility : 0,
      scopeCertainty: Number.isFinite(sliderValues?.scopeCertainty) ? sliderValues.scopeCertainty : 0,
      riskTolerance: Number.isFinite(sliderValues?.riskTolerance) ? sliderValues.riskTolerance : 0
    };
    const effectiveTargetValue = Number.isFinite(targetValue) ? targetValue : mostLikely;
    const isDegenerate = validateEstimates(optimistic, mostLikely, pessimistic);

    // PERT Calculations
    const pertMean = isDegenerate ? mostLikely : calculatePERTMean(optimistic, mostLikely, pessimistic);
    const pertVariance = isDegenerate ? 0 : calculatePERTVariance(optimistic, mostLikely, pessimistic);
    const pertStdDev = isDegenerate ? 0 : calculatePERTStdDev(optimistic, mostLikely, pessimistic);
    const betaAlpha = isDegenerate ? 1 : Math.max(1, calculateAlpha(pertMean, pertStdDev, optimistic, pessimistic));
    const betaBeta = isDegenerate ? 1 : Math.max(1, calculateBeta(pertMean, pertStdDev, optimistic, pessimistic));
    const pertSkewness = isDegenerate ? 0 : calculatePERTSkewness(optimistic, mostLikely, pessimistic);
    const pertKurtosis = calculatePERTKurtosis(optimistic, mostLikely, pessimistic);
    const pertMedian = isDegenerate ? mostLikely : calculatePERTMedian(optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
    const pertPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null);
    const pertPdfPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculatePERTPdfPoints(optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
    const weightedConservative = isDegenerate ? mostLikely : calculateConservativeEstimate(optimistic, mostLikely, pessimistic);
    const weightedOptimistic = isDegenerate ? mostLikely : calculateOptimisticEstimate(optimistic, mostLikely, pessimistic);
    const weightedNeutral = pertMean;
    const pertConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null);
    const pertConfidenceInterval = isDegenerate ? { lower: mostLikely, upper: mostLikely } : calculatePERTConfidenceInterval(pertMean, pertStdDev);
    const pertCoefficientOfVariation = isDegenerate ? 0 : calculatePERTCoefficientOfVariation(pertMean, pertStdDev);
    const pertCVaR95 = isDegenerate ? mostLikely : calculatePERTCVaR95(pertPoints, optimistic);

    // Triangle Distribution
    const triangleMean = isDegenerate ? mostLikely : calculateTriangleMean(optimistic, mostLikely, pessimistic);
    const triangleVariance = isDegenerate ? 0 : calculateTriangleVariance(optimistic, mostLikely, pessimistic);
    const triangleStdDev = isDegenerate ? 0 : calculateTriangleStdDev(optimistic, mostLikely, pessimistic);
    const triangleSkewness = isDegenerate ? 0 : calculateTriangleSkewness(optimistic, mostLikely, pessimistic);
    const triangleKurtosis = calculateTriangleKurtosis(optimistic, mostLikely, pessimistic);
    const triangleMedian = isDegenerate ? mostLikely : calculateTriangleMedian(optimistic, mostLikely, pessimistic);
    const trianglePoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null);
    const trianglePdfPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateTrianglePdfPoints(optimistic, mostLikely, pessimistic);
    const triangleConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null);
    const triangleConfidenceInterval = isDegenerate ? { lower: mostLikely, upper: mostLikely } : calculateTriangleConfidenceInterval(triangleMean, triangleStdDev);
    const triangleCoefficientOfVariation = isDegenerate ? 0 : calculateTriangleCoefficientOfVariation(triangleMean, triangleStdDev);
    const triangleCVaR95 = isDegenerate ? mostLikely : calculateTriangleCVaR95(trianglePoints, optimistic);
    const triangleSensitivity = isDegenerate ? { originalMean: mostLikely, variedMean: mostLikely, change: 0 } : calculateSensitivity(triangleMean, triangleStdDev, optimistic, pessimistic);

    // Beta Distribution
    const betaMean = isDegenerate ? mostLikely : calculateBetaMean(betaAlpha, betaBeta, optimistic, pessimistic);
    const betaVariance = isDegenerate ? 0 : calculateBetaVariance(betaAlpha, betaBeta, optimistic, pessimistic);
    const betaStdDev = isDegenerate ? 0 : calculateBetaStdDev(betaAlpha, betaBeta, optimistic, pessimistic);
    const betaSkewness = isDegenerate ? 0 : calculateBetaSkewness(betaAlpha, betaBeta);
    const betaKurtosis = calculateBetaKurtosis(betaAlpha, betaBeta);
    const betaMode = isDegenerate ? mostLikely : calculateBetaMode(betaAlpha, betaBeta, optimistic, pessimistic);
    const betaMedian = isDegenerate ? mostLikely : calculateBetaMedian(betaAlpha, betaBeta, optimistic, pessimistic);
    const betaPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null);
    const betaPdfPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateBetaPdfPoints(betaAlpha, betaBeta, optimistic, pessimistic);
    const probExceedPertMeanBeta = isDegenerate ? 0 : calculateProbExceedPertMeanBeta(pertMean, betaAlpha, betaBeta, optimistic, pessimistic);
    const betaConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null);
    const betaConfidenceInterval = isDegenerate ? { lower: mostLikely, upper: mostLikely } : calculateBetaConfidenceInterval(betaMean, betaStdDev);
    const betaCoefficientOfVariation = isDegenerate ? 0 : calculateBetaCoefficientOfVariation(betaMean, betaStdDev);
    const betaCVaR95 = isDegenerate ? mostLikely : calculateBetaCVaR95(betaPoints, optimistic);

    // Monte Carlo Simulation
    let mcUnsmoothed;
    try {
      mcUnsmoothed = isDegenerate ? Array(1000).fill(mostLikely) : monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, optimistic, pessimistic);
    } catch (err) {
      console.warn('Monte Carlo simulation failed, using fallback:', err.message);
      mcUnsmoothed = Array(1000).fill(mostLikely);
    }
    const mcMetrics = calculateUnsmoothedMetrics(mcUnsmoothed);
    const mcPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);
    const mcRawPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateMonteCarloRawPoints(mcUnsmoothed, optimistic, pessimistic);
    const probExceedPertMeanMCUnsmoothed = isDegenerate ? 0 : calculateProbExceedPertMeanMC(mcUnsmoothed, pertMean);
    const mcConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

    let smoothedMC;
    try {
      smoothedMC = calculateSmoothedMetrics(mcUnsmoothed);
    } catch (err) {
      console.warn('Smoothed Monte Carlo calculation failed, using fallback:', err.message);
      smoothedMC = {
        mean: mostLikely,
        variance: 0,
        stdDev: 0,
        skewness: 0,
        kurtosis: 0,
        var90: mostLikely,
        var95: mostLikely,
        cvar: mostLikely,
        cvar95: mostLikely,
        mad: 0,
        median: mostLikely,
        coefficientOfVariation: 0,
        confidenceInterval: { lower: mostLikely, upper: mostLikely },
        points: [{ x: mostLikely, y: 1, confidence: 50 }],
        cdfPoints: [{ x: mostLikely, y: 1, confidence: 50 }]
      };
    }
    const probExceedPertMeanMCSmoothed = isDegenerate ? 0 : calculateProbExceedPertMeanMC(smoothedMC.points.map(p => p.x), pertMean);
    const mcSmoothedConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('MC_SMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

    // Additional Calculations
    const probExceedTargetsTriangle = isDegenerate ? {} : calculateProbExceedTargets('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null, [triangleMean, mostLikely, pertMean]);
    const probExceedTargetsPERT = isDegenerate ? {} : calculateProbExceedTargets('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null, [triangleMean, mostLikely, pertMean]);
    const probExceedTargetsBeta = isDegenerate ? {} : calculateProbExceedTargets('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null, [triangleMean, mostLikely, pertMean]);
    const probExceedTargetsMC = isDegenerate ? {} : calculateProbExceedTargets('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, null, null, mcUnsmoothed, [triangleMean, mostLikely, pertMean]);
    const klDivergenceTrianglePERT = isDegenerate ? 0 : calculateKLDivergence(trianglePoints, pertPoints, (pessimistic - optimistic) / 100);

    // Decision Optimizer and Target Probability
    const decisionOptimizerPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateDecisionOptimizerPoints(trianglePoints, pertPoints, betaPoints, smoothedMC.points);
    const decisionOptimizerOriginalPoints = smoothedMC.points || [{ x: mostLikely, y: 1, confidence: 50 }];
    const decisionOptimizerAdjustedPoints = adjustDistributionPoints(decisionOptimizerOriginalPoints, smoothedMC.mean || mostLikely, smoothedMC.stdDev || 0, effectiveSliders);
    const decisionOptimizerMetrics = calculateAdjustedMetrics(decisionOptimizerOriginalPoints, decisionOptimizerAdjustedPoints);
    const targetProbabilityPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateTargetProbabilityPoints(optimistic, pessimistic, triangleMean, [effectiveTargetValue, triangleMean, pertMean]);
    const targetProbabilityOriginalCdf = smoothedMC.cdfPoints || [{ x: mostLikely, y: 1, confidence: 50 }];
    const targetProbabilityAdjustedCdf = adjustCdfPoints(targetProbabilityOriginalCdf, smoothedMC.mean || mostLikely, smoothedMC.stdDev || 0, effectiveSliders);
    const targetProbabilityOriginalPdf = smoothedMC.points || [{ x: mostLikely, y: 1, confidence: 50 }];
    const targetProbabilityAdjustedPdf = adjustDistributionPoints(targetProbabilityOriginalPdf, smoothedMC.mean || mostLikely, smoothedMC.stdDev || 0, effectiveSliders);

    // Optimization
    let optimalData = null;
    if (optimizeFor) {
      try {
        optimalData = findOptimalSliderSettings(
          targetProbabilityOriginalCdf,
          smoothedMC.mean || mostLikely,
          smoothedMC.stdDev || 0,
          effectiveTargetValue,
          confidenceLevel,
          targetProbabilityOriginalPdf
        );
      } catch (err) {
        console.warn('Optimization failed, using fallback:', err.message);
        optimalData = null;
      }
    }

    // Slider Combinations
    let sliderCombinations = null;
    try {
      if (Number.isFinite(effectiveTargetValue)) {
        const sliderSteps = [0, 25, 50, 75, 100];
        sliderCombinations = computeSliderCombinations(targetProbabilityOriginalCdf, effectiveTargetValue, smoothedMC.mean || mostLikely, smoothedMC.stdDev || 0, targetProbabilityOriginalPdf, sliderSteps);
      }
    } catch (err) {
      console.warn('Slider combinations calculation failed, using fallback:', err.message);
      sliderCombinations = { value: [], description: "Slider combinations (fallback)" };
    }
    const optimalCombination = sliderCombinations && sliderCombinations.value.length > 0 ? getOptimalCombination(sliderCombinations.value) : null;

    // Validate CDF arrays
    const isValidCdfArray = (cdf) => Array.isArray(cdf) && cdf.length >= 2 && cdf.every(point => Number.isFinite(point.x) && Number.isFinite(point.y));

    return {
      task: { value: task, description: "Task name" },
      bestCase: { value: optimistic, description: "Optimistic estimate" },
      mostLikely: { value: mostLikely, description: "Most likely estimate" },
      worstCase: { value: pessimistic, description: "Pessimistic estimate" },
      triangleMean: { value: triangleMean, description: "Triangle mean" },
      triangleVariance: { value: triangleVariance, description: "Triangle variance" },
      triangleStdDev: { value: triangleStdDev, description: "Triangle standard deviation" },
      TRIANGLE_STD: { value: triangleStdDev, description: "Triangle standard deviation (alias)" },
      triangleSkewness: { value: triangleSkewness, description: "Triangle skewness" },
      triangleKurtosis: { value: triangleKurtosis, description: "Triangle kurtosis" },
      triangleMedian: { value: triangleMedian, description: "Triangle median" },
      trianglePoints: { value: trianglePoints, description: "Triangle distribution points (CDF)" },
      trianglePdfPoints: { value: trianglePdfPoints, description: "Triangle distribution points (PDF)" },
      triangleConfidenceValues: { value: triangleConfidenceValues, description: "Triangle values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" },
      triangle90thPercentile: { value: triangleConfidenceValues.valueAt90Percent, description: "Triangle 90th percentile" },
      triangle95thPercentile: { value: triangleConfidenceValues.valueAt95Percent, description: "Triangle 95th percentile" },
      triangleConfidenceInterval: { value: triangleConfidenceInterval, description: "Triangle 95% confidence interval for mean" },
      triangleCoefficientOfVariation: { value: triangleCoefficientOfVariation, description: "Triangle coefficient of variation" },
      triangleCVaR95: { value: triangleCVaR95, description: "Triangle CVaR at 95% confidence" },
      triangleSensitivity: { value: triangleSensitivity, description: "Triangle sensitivity to input variations" },
      probExceedTargetsTriangle: { value: probExceedTargetsTriangle, description: "Triangle probabilities of exceeding key targets" },
      pertMean: { value: pertMean, description: "PERT mean" },
      pertVariance: { value: pertVariance, description: "PERT variance" },
      pertStdDev: { value: pertStdDev, description: "PERT standard deviation" },
      pertSkewness: { value: pertSkewness, description: "PERT skewness" },
      pertKurtosis: { value: pertKurtosis, description: "PERT kurtosis" },
      pertMedian: { value: pertMedian, description: "PERT median" },
      pertPoints: { value: pertPoints, description: "PERT distribution points (CDF)" },
      pertPdfPoints: { value: pertPdfPoints, description: "PERT distribution points (PDF)" },
      weightedConservative: { value: weightedConservative, description: "Conservative weighted estimate" },
      weightedOptimistic: { value: weightedOptimistic, description: "Optimistic weighted estimate" },
      weightedNeutral: { value: weightedNeutral, description: "Neutral weighted estimate (PERT mean)" },
      pertConfidenceValues: { value: pertConfidenceValues, description: "PERT values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" },
      pert90thPercentile: { value: pertConfidenceValues.valueAt90Percent, description: "PERT 90th percentile" },
      pert95thPercentile: { value: pertConfidenceValues.valueAt95Percent, description: "PERT 95th percentile" },
      pertConfidenceInterval: { value: pertConfidenceInterval, description: "PERT 95% confidence interval for mean" },
      pertCoefficientOfVariation: { value: pertCoefficientOfVariation, description: "PERT coefficient of variation" },
      pertCVaR95: { value: pertCVaR95, description: "PERT CVaR at 95% confidence" },
      probExceedTargetsPERT: { value: probExceedTargetsPERT, description: "PERT probabilities of exceeding key targets" },
      betaMean: { value: betaMean, description: "Beta mean" },
      betaVariance: { value: betaVariance, description: "Beta variance" },
      betaStdDev: { value: betaStdDev, description: "Beta standard deviation" },
      betaSkewness: { value: betaSkewness, description: "Beta skewness" },
      betaKurtosis: { value: betaKurtosis, description: "Beta kurtosis" },
      betaMode: { value: betaMode, description: "Beta mode" },
      betaMedian: { value: betaMedian, description: "Beta median" },
      betaPoints: { value: betaPoints, description: "Beta distribution points (CDF)" },
      betaPdfPoints: { value: betaPdfPoints, description: "Beta distribution points (PDF)" },
      probExceedPertMeanBeta: { value: probExceedPertMeanBeta, description: "Probability exceeding PERT mean (Beta)" },
      betaConfidenceValues: { value: betaConfidenceValues, description: "Beta values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" },
      beta90thPercentile: { value: betaConfidenceValues.valueAt90Percent, description: "Beta 90th percentile" },
      beta95thPercentile: { value: betaConfidenceValues.valueAt95Percent, description: "Beta 95th percentile" },
      betaConfidenceInterval: { value: betaConfidenceInterval, description: "Beta 95% confidence interval for mean" },
      betaCoefficientOfVariation: { value: betaCoefficientOfVariation, description: "Beta coefficient of variation" },
      betaCVaR95: { value: betaCVaR95, description: "Beta CVaR at 95% confidence" },
      probExceedTargetsBeta: { value: probExceedTargetsBeta, description: "Beta probabilities of exceeding key targets" },
      mcMean: { value: mcMetrics.mean, description: "Monte Carlo mean" },
      mcVariance: { value: mcMetrics.variance, description: "Monte Carlo variance" },
      mcStdDev: { value: mcMetrics.stdDev, description: "Monte Carlo standard deviation" },
      mcSkewness: { value: mcMetrics.skewness, description: "Monte Carlo skewness" },
      mcKurtosis: { value: mcMetrics.kurtosis, description: "Monte Carlo kurtosis" },
      mcVaR: { value: mcMetrics.var90, description: "Monte Carlo VaR 90%" },
      mcCVaR: { value: mcMetrics.cvar90, description: "Monte Carlo CVaR 90%" },
      mcVaR95: { value: mcMetrics.var95, description: "Monte Carlo VaR 95%" },
      mcCVaR95: { value: mcMetrics.cvar95, description: "Monte Carlo CVaR 95%" },
      mcMAD: { value: mcMetrics.mad, description: "Monte Carlo MAD" },
      mcMedian: { value: mcMetrics.median, description: "Monte Carlo median" },
      mcPoints: { value: mcPoints, description: "Monte Carlo distribution points (CDF)" },
      mcRawPoints: { value: mcRawPoints, description: "Monte Carlo raw histogram points" },
      mcConfidenceValues: { value: mcConfidenceValues, description: "Monte Carlo unsmoothed values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" },
      mcConfidenceInterval: { value: mcMetrics.confidenceInterval, description: "Monte Carlo 95% confidence interval for mean" },
      mcCoefficientOfVariation: { value: mcMetrics.coefficientOfVariation, description: "Monte Carlo coefficient of variation" },
      mcSmoothedMean: { value: smoothedMC.mean, description: "Smoothed Monte Carlo mean" },
      mcSmoothedVariance: { value: smoothedMC.variance, description: "Smoothed Monte Carlo variance" },
      mcSmoothedStdDev: { value: smoothedMC.stdDev, description: "Smoothed Monte Carlo standard deviation" },
      mcSmoothedSkewness: { value: smoothedMC.skewness, description: "Smoothed Monte Carlo skewness" },
      mcSmoothedKurtosis: { value: smoothedMC.kurtosis, description: "Smoothed Monte Carlo kurtosis" },
      mcSmoothedVaR: { value: smoothedMC.var90, description: "Smoothed Monte Carlo VaR 90%" },
      mcSmoothedCVaR: { value: smoothedMC.cvar, description: "Smoothed Monte Carlo CVaR 90%" },
      mcSmoothedVaR95: { value: smoothedMC.var95, description: "Smoothed Monte Carlo VaR 95%" },
      mcSmoothedCVaR95: { value: smoothedMC.cvar95, description: "Smoothed Monte Carlo CVaR 95%" },
      mcSmoothedMAD: { value: smoothedMC.mad, description: "Smoothed Monte Carlo MAD" },
      mcSmoothedMedian: { value: smoothedMC.median, description: "Smoothed Monte Carlo median" },
      mcSmoothedPoints: { value: smoothedMC.points, description: "Smoothed Monte Carlo distribution points (density)" },
      mcSmoothedCdfPoints: { value: smoothedMC.cdfPoints, description: "Smoothed Monte Carlo distribution points (CDF)" },
      mcSmoothedConfidenceValues: { value: mcSmoothedConfidenceValues, description: "Smoothed Monte Carlo values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" },
      mcSmoothedConfidenceInterval: { value: smoothedMC.confidenceInterval, description: "Smoothed Monte Carlo 95% confidence interval for mean" },
      mcSmoothedCoefficientOfVariation: { value: smoothedMC.coefficientOfVariation, description: "Smoothed Monte Carlo coefficient of variation" },
      probExceedPertMeanMCUnsmoothed: { value: probExceedPertMeanMCUnsmoothed, description: "Probability exceeding PERT mean (MC Unsmoothed)" },
      probExceedPertMeanMCSmoothed: { value: probExceedPertMeanMCSmoothed, description: "Probability exceeding PERT mean (MC Smoothed)" },
      probExceedTargetsMC: { value: probExceedTargetsMC, description: "Monte Carlo probabilities of exceeding key targets" },
      klDivergenceTrianglePERT: { value: klDivergenceTrianglePERT, description: "KL Divergence between Triangle and PERT distributions" },
      decisionOptimizerPoints: { value: decisionOptimizerPoints, description: "Decision Optimizer aggregated points" },
      decisionOptimizerOriginalPoints: { value: decisionOptimizerOriginalPoints, description: "Decision Optimizer original distribution points" },
      decisionOptimizerAdjustedPoints: { value: decisionOptimizerAdjustedPoints, description: "Decision Optimizer adjusted distribution points based on sliders" },
      decisionOptimizerMetrics: { value: decisionOptimizerMetrics, description: "Decision Optimizer metrics (originalMedian, adjustedMedian, newConfidence)" },
      targetProbabilityPoints: { value: targetProbabilityPoints, description: "Target Probability points for specified values" },
      targetProbabilityOriginalCdf: { value: targetProbabilityOriginalCdf, description: "Target Probability original CDF points (smoothed MC)" },
      targetProbabilityAdjustedCdf: { value: targetProbabilityAdjustedCdf, description: "Target Probability adjusted CDF points based on sliders" },
      targetProbabilityOriginalPdf: { value: targetProbabilityOriginalPdf, description: "Target Probability original PDF points (smoothed MC)" },
      targetProbabilityAdjustedPdf: { value: targetProbabilityAdjustedPdf, description: "Target Probability adjusted PDF points based on sliders" },
      targetProbability: {
        value: {
          original: effectiveTargetValue && isValidCdfArray(targetProbabilityOriginalCdf) ? interpolateCdf(targetProbabilityOriginalCdf, effectiveTargetValue) : null,
          adjusted: effectiveTargetValue && isValidCdfArray(targetProbabilityAdjustedCdf) ? interpolateCdf(targetProbabilityAdjustedCdf, effectiveTargetValue) : null
        },
        description: "Interpolated CDF probabilities for the target value"
      },
      valueAtConfidence: {
        value: {
          original: confidenceLevel && isValidCdfArray(targetProbabilityOriginalCdf) ? findValueAtConfidence(targetProbabilityOriginalCdf, confidenceLevel) : null,
          adjusted: confidenceLevel && isValidCdfArray(targetProbabilityAdjustedCdf) ? findValueAtConfidence(targetProbabilityAdjustedCdf, confidenceLevel) : null
        },
        description: "Value at the specified confidence level for original and adjusted CDFs"
      },
      sliderCombinations: sliderCombinations || { value: [], description: "Slider combinations (fallback)" },
      optimalCombination: optimalCombination ? {
        value: {
          budgetFlexibility: optimalCombination.bf,
          scheduleFlexibility: optimalCombination.sf,
          scopeCertainty: optimalCombination.sc,
          riskTolerance: optimalCombination.rt,
          probability: optimalCombination.adjProb,
          scenarioSummary: optimalCombination.scenarioSummary,
          expectedOutcome: optimalCombination.expectedOutcome,
          budgetFlexImpact: optimalCombination.budgetFlexImpact,
          scheduleFlexImpact: optimalCombination.scheduleFlexImpact,
          scopeCertImpact: optimalCombination.scopeCertImpact,
          tolPoorQualImpact: optimalCombination.tolPoorQualImpact,
          expectedShortfall: optimalCombination.expectedShortfall,
          sensitivities: optimalCombination.sensitivities,
          meanShift: optimalCombination.meanShift,
          varianceScale: optimalCombination.varianceScale,
          riskAdjustedRatio: optimalCombination.riskAdjustedRatio,
          riskProbabilities: optimalCombination.riskProbabilities,
          keyImpact: optimalCombination.keyImpact
        },
        description: "Optimal slider combination for highest probability of meeting target value"
      } : { value: null, description: "Optimal combination (fallback)" },
      optimalData: optimalData ? {
        value: {
          optimalSliderSettings: optimalData.optimalSliderSettings,
          optimalAdjustedPdfPoints: optimalData.optimalAdjustedPdfPoints,
          optimalAdjustedCdfPoints: optimalData.optimalAdjustedCdfPoints,
          optimalObjective: optimalData.optimalObjective,
          probability: optimalData.probability
        },
        description: optimizeFor === 'target' ? "Optimal slider settings and points maximizing probability for target value" : "Optimal slider settings and points minimizing value at confidence level"
      } : { value: null, description: "Optimal data (fallback)" }
    };
  } catch (err) {
    console.error(`Error processing task ${task}:`, err);
    return {
      task: { value: task || 'Unknown', description: "Task name" },
      bestCase: { value: optimistic || 0, description: "Optimistic estimate" },
      mostLikely: { value: mostLikely || 0, description: "Most likely estimate" },
      worstCase: { value: pessimistic || 0, description: "Pessimistic estimate" },
      triangleMean: { value: mostLikely || 0, description: "Triangle mean (fallback)" },
      pertMean: { value: mostLikely || 0, description: "PERT mean (fallback)" },
      sliderCombinations: { value: [], description: "Slider combinations (fallback)" },
      optimalCombination: { value: null, description: "Optimal combination (fallback)" },
      error: `Failed to process task: ${err.message}`
    };
  }
}
/* ============================================================================
   🟪 EXPORT HTTP HANDLER
   - HTTP endpoint for processing requests
============================================================================ */
module.exports = {
  pmcEstimatorAPI: functions.http('pmcEstimatorAPI', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!req.body) {
      console.error('No request body provided');
      return res.status(400).json({ error: 'Request body is required.' });
    }

    try {
      console.log('Input request:', JSON.stringify(req.body));
      if (req.body.task && req.body.sliderValues) {
        // Single task input
        const { task, sliderValues, targetValue, optimizeFor, confidenceLevel, targetProbabilityOnly = false } = req.body;
        if (!task.task || !Number.isFinite(task.optimistic) || !Number.isFinite(task.mostLikely) || !Number.isFinite(task.pessimistic)) {
          console.error('Invalid task input:', task);
          return res.status(400).json({ error: 'Task must include valid task name and finite optimistic, mostLikely, and pessimistic values.' });
        }
        const effectiveSliders = {
          budgetFlexibility: Number.isFinite(sliderValues?.budgetFlexibility) ? sliderValues.budgetFlexibility : 0,
          scheduleFlexibility: Number.isFinite(sliderValues?.scheduleFlexibility) ? sliderValues.scheduleFlexibility : 0,
          scopeCertainty: Number.isFinite(sliderValues?.scopeCertainty) ? sliderValues.scopeCertainty : 0,
          riskTolerance: Number.isFinite(sliderValues?.riskTolerance) ? sliderValues.riskTolerance : 0
        };

        let baseData;
        try {
          baseData = processTask({
            task: task.task,
            optimistic: task.optimistic,
            mostLikely: task.mostLikely,
            pessimistic: task.pessimistic,
            sliderValues: effectiveSliders,
            targetValue: Number.isFinite(targetValue) ? targetValue : task.mostLikely,
            optimizeFor: optimizeFor || 'target',
            confidenceLevel: Number.isFinite(confidenceLevel) ? confidenceLevel : 0.9
          });
        } catch (err) {
          console.error('Error in processTask:', err.message);
          return res.status(500).json({ error: `Failed to process task: ${err.message}` });
        }

        const response = {
          ...baseData,
          targetProbabilityPoints: {
            value: calculateTargetProbabilityPoints(
              task.optimistic,
              task.pessimistic,
              baseData.triangleMean?.value || task.mostLikely,
              [targetValue || baseData.triangleMean?.value || task.mostLikely, baseData.triangleMean?.value || task.mostLikely, baseData.pertMean?.value || task.mostLikely]
            ),
            description: "Target Probability points for specified values"
          }
        };

        if (targetProbabilityOnly) {
          response = {
            task: baseData.task,
            targetProbabilityPoints: response.targetProbabilityPoints,
            targetProbabilityOriginalCdf: baseData.targetProbabilityOriginalCdf,
            targetProbabilityAdjustedCdf: baseData.targetProbabilityAdjustedCdf,
            targetProbabilityOriginalPdf: baseData.targetProbabilityOriginalPdf,
            targetProbabilityAdjustedPdf: baseData.targetProbabilityAdjustedPdf,
            decisionOptimizerPoints: baseData.decisionOptimizerPoints,
            decisionOptimizerOriginalPoints: baseData.decisionOptimizerOriginalPoints,
            decisionOptimizerAdjustedPoints: baseData.decisionOptimizerAdjustedPoints,
            decisionOptimizerMetrics: baseData.decisionOptimizerMetrics,
            sliderCombinations: baseData.sliderCombinations,
            optimalCombination: baseData.optimalCombination,
            optimalData: baseData.optimalData
          };
        }

        console.log('Output response (single task):', JSON.stringify(response));
        res.json(response);
      } else if (Array.isArray(req.body)) {
        // Array of tasks
        if (!req.body.every(t => t.task && Number.isFinite(t.optimistic) && Number.isFinite(t.mostLikely) && Number.isFinite(t.pessimistic))) {
          console.error('Invalid task array input:', req.body);
          return res.status(400).json({ error: 'All tasks must include valid task name and finite optimistic, mostLikely, and pessimistic values.' });
        }

        const results = req.body.map(task => {
          try {
            const effectiveSliders = task.sliderValues || {
              budgetFlexibility: 0,
              scheduleFlexibility: 0,
              scopeCertainty: 0,
              riskTolerance: 0
            };
            const effectiveTargetValue = Number.isFinite(task.targetValue) ? task.targetValue : task.mostLikely;
            const baseData = processTask({
              task: task.task,
              optimistic: task.optimistic,
              mostLikely: task.mostLikely,
              pessimistic: task.pessimistic,
              sliderValues: {
                budgetFlexibility: Number.isFinite(effectiveSliders.budgetFlexibility) ? effectiveSliders.budgetFlexibility : 0,
                scheduleFlexibility: Number.isFinite(effectiveSliders.scheduleFlexibility) ? effectiveSliders.scheduleFlexibility : 0,
                scopeCertainty: Number.isFinite(effectiveSliders.scopeCertainty) ? effectiveSliders.scopeCertainty : 0,
                riskTolerance: Number.isFinite(effectiveSliders.riskTolerance) ? effectiveSliders.riskTolerance : 0
              },
              targetValue: effectiveTargetValue,
              optimizeFor: task.optimizeFor || 'target',
              confidenceLevel: Number.isFinite(task.confidenceLevel) ? task.confidenceLevel : 0.9
            });

            return {
              ...baseData,
              targetProbabilityPoints: {
                value: calculateTargetProbabilityPoints(
                  task.optimistic,
                  task.pessimistic,
                  baseData.triangleMean?.value || task.mostLikely,
                  [effectiveTargetValue || baseData.triangleMean?.value || task.mostLikely, baseData.triangleMean?.value || task.mostLikely, baseData.pertMean?.value || task.mostLikely]
                ),
                description: "Target Probability points for specified values"
              }
            };
          } catch (err) {
            console.error(`Failed to process task ${task.task}:`, err.message);
            return {
              task: { value: task.task, description: "Task name" },
              bestCase: { value: task.optimistic, description: "Optimistic estimate" },
              mostLikely: { value: task.mostLikely, description: "Most likely estimate" },
              worstCase: { value: task.pessimistic, description: "Pessimistic estimate" },
              triangleMean: { value: task.mostLikely, description: "Triangle mean (fallback)" },
              pertMean: { value: task.mostLikely, description: "PERT mean (fallback)" },
              sliderCombinations: { value: [], description: "Slider combinations (fallback)" },
              optimalCombination: { value: null, description: "Optimal combination (fallback)" },
              error: `Failed to process task ${task.task}: ${err.message}`
            };
          }
        });
        console.log('Output results (array):', JSON.stringify(results));
        res.json({ results });
      } else {
        console.error('Invalid request body format:', req.body);
        res.status(400).json({ error: 'Invalid request body. Must be an array of tasks or a single task with sliderValues.' });
      }
    } catch (err) {
      console.error('Error in pmcEstimatorAPI:', err.stack);
      res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    }
  })
};
