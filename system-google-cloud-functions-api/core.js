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
 * Best Practices: Immutable output, structured error handling, confidence derived from cumulative probability (Morgan & Henrion, 1990). Ensures normalized PDF and robust validation (Clemen & Reilly, 2013).
 * Generates PDF points for a Triangular distribution with confidence values.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @returns {Array<{x: number, y: number, confidence: number}>} Array of PDF points
 * @throws {Error} If inputs are invalid
 * @reference Morgan, M. G., & Henrion, M. (1990). Uncertainty: A Guide to Dealing with Uncertainty in Quantitative Risk and Policy Analysis; Clemen, R. T., & Reilly, T. (2013). Making Hard Decisions with DecisionTools.
 */
function calculateTrianglePdfPoints(o, m, p) {
  try {
    if (!Number.isFinite(o) || !Number.isFinite(m) || !Number.isFinite(p) || o > m || m > p) {
      throw new Error(`Invalid estimates: o=${o}, m=${m}, p=${p}`);
    }
    if (m === o || m === p) {
      return [{ x: m, y: 1, confidence: 50 }];
    }
    const points = [];
    const step = (p - o) / 100;
    let cumulative = 0;
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
      cumulative += (Number.isFinite(y) ? y : 0) * step;
      points.push({
        x,
        y: Number.isFinite(y) ? y : 0,
        confidence: Math.min(Math.max(cumulative * 100, 0), 100)
      });
    }
    const totalArea = points.reduce((sum, p) => sum + p.y * step, 0);
    if (totalArea <= 0) {
      throw new Error('Invalid total area for normalization');
    }
    return points.map(p => ({
      x: p.x,
      y: p.y / totalArea,
      confidence: p.confidence
    }));
  } catch (error) {
    console.error('calculateTrianglePdfPoints error:', error.message, { o, m, p });
    return [{ x: m || 0, y: 1, confidence: 50 }];
  }
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
 * Best Practices: Immutable output, structured error handling, confidence derived from cumulative probability (Morgan & Henrion, 1990). Normalized PDF with robust validation (Clemen & Reilly, 2013).
 * Generates PDF points for a PERT distribution using Beta parameters.
 * @param {number} o - Optimistic estimate
 * @param {number} m - Most likely estimate
 * @param {number} p - Pessimistic estimate
 * @param {number} alpha - Beta distribution alpha parameter
 * @param {number} beta - Beta distribution beta parameter
 * @returns {Array<{x: number, y: number, confidence: number}>} Array of PDF points
 * @throws {Error} If inputs are invalid
 * @reference Morgan, M. G., & Henrion, M. (1990); Clemen, R. T., & Reilly, T. (2013).
 */
function calculatePERTPdfPoints(o, m, p, alpha, beta) {
  try {
    if (!Number.isFinite(o) || !Number.isFinite(m) || !Number.isFinite(p) || o > m || m > p) {
      throw new Error(`Invalid estimates: o=${o}, m=${m}, p=${p}`);
    }
    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || alpha <= 0 || beta <= 0) {
      throw new Error(`Invalid alpha=${alpha}, beta=${beta}`);
    }
    if (m === o || m === p) {
      return [{ x: m, y: 1, confidence: 50 }];
    }
    const points = [];
    const step = (p - o) / 100;
    let cumulative = 0;
    for (let i = 0; i <= 100; i++) {
      const x = o + i * step;
      const scaledX = (x - o) / (p - o);
      const y = jstat.beta.pdf(scaledX, alpha, beta) / (p - o);
      cumulative += (Number.isFinite(y) ? y : 0) * step;
      points.push({
        x,
        y: Number.isFinite(y) ? y : 0,
        confidence: Math.min(Math.max(cumulative * 100, 0), 100)
      });
    }
    const totalArea = points.reduce((sum, p) => sum + p.y * step, 0);
    if (totalArea <= 0) {
      throw new Error('Invalid total area for normalization');
    }
    return points.map(p => ({
      x: p.x,
      y: p.y / totalArea,
      confidence: p.confidence
    }));
  } catch (error) {
    console.error('calculatePERTPdfPoints error:', error.message, { o, m, p, alpha, beta });
    return [{ x: m || 0, y: 1, confidence: 50 }];
  }
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
 * Best Practices: Immutable output, structured error handling, confidence derived from cumulative probability (Morgan & Henrion, 1990). Normalized PDF with robust validation (Clemen & Reilly, 2013).
 * Generates PDF points for a Beta distribution.
 * @param {number} alpha - Alpha parameter
 * @param {number} beta - Beta parameter
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array<{x: number, y: number, confidence: number}>} Array of PDF points
 * @throws {Error} If inputs are invalid
 * @reference Morgan, M. G., & Henrion, M. (1990); Clemen, R. T., & Reilly, T. (2013).
 */
function calculateBetaPdfPoints(alpha, beta, min, max) {
  try {
    if (!Number.isFinite(alpha) || !Number.isFinite(beta) || alpha <= 0 || beta <= 0) {
      throw new Error(`Invalid alpha=${alpha}, beta=${beta}`);
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      throw new Error(`Invalid min=${min}, max=${max}`);
    }
    const points = [];
    const step = (max - min) / 100;
    let cumulative = 0;
    for (let i = 0; i <= 100; i++) {
      const x = min + i * step;
      const scaledX = (x - min) / (max - min);
      const y = jstat.beta.pdf(scaledX, alpha, beta) / (max - min);
      cumulative += (Number.isFinite(y) ? y : 0) * step;
      points.push({
        x,
        y: Number.isFinite(y) ? y : 0,
        confidence: Math.min(Math.max(cumulative * 100, 0), 100)
      });
    }
    const totalArea = points.reduce((sum, p) => sum + p.y * step, 0);
    if (totalArea <= 0) {
      throw new Error('Invalid total area for normalization');
    }
    return points.map(p => ({
      x: p.x,
      y: p.y / totalArea,
      confidence: p.confidence
    }));
  } catch (error) {
    console.error('calculateBetaPdfPoints error:', error.message, { alpha, beta, min, max });
    return [{ x: min || 0, y: 1, confidence: 50 }];
  }
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
 * Best Practices: Immutable output, structured error handling, confidence derived from cumulative counts (Morgan & Henrion, 1990). Normalized histogram with robust validation (Clemen & Reilly, 2013).
 * Calculates raw histogram points from Monte Carlo samples.
 * @param {Array<number>} samples - Array of Monte Carlo samples
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {Array<{x: number, y: number, confidence: number}>} Array of histogram points
 * @throws {Error} If inputs are invalid
 * @reference Morgan, M. G., & Henrion, M. (1990); Clemen, R. T., & Reilly, T. (2013).
 */
function calculateMonteCarloRawPoints(samples, min, max) {
  try {
    if (!Array.isArray(samples) || samples.length === 0) {
      throw new Error('Invalid samples array');
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      throw new Error(`Invalid min=${min}, max=${max}`);
    }
    const bins = 50;
    const step = (max - min) / bins;
    const counts = Array(bins).fill(0);
    let totalCount = 0;
    samples.forEach(s => {
      if (Number.isFinite(s)) {
        const bin = Math.min(Math.floor((s - min) / step), bins - 1);
        counts[bin]++;
        totalCount++;
      }
    });
    let cumulative = 0;
    const points = counts.map((count, i) => {
      cumulative += count / totalCount;
      return {
        x: min + i * step,
        y: totalCount > 0 ? count / (totalCount * step) : 0,
        confidence: Math.min(Math.max(cumulative * 100, 0), 100)
      };
    });
    const totalArea = points.reduce((sum, p) => sum + p.y * step, 0);
    if (totalArea <= 0) {
      throw new Error('Invalid total area for normalization');
    }
    return points.map(p => ({
      x: p.x,
      y: p.y / totalArea,
      confidence: p.confidence
    }));
  } catch (error) {
    console.error('calculateMonteCarloRawPoints error:', error.message, { samplesLength: samples.length, min, max });
    return [{ x: min || 0, y: 1, confidence: 50 }];
  }
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
 * Best Practices: Immutable output, structured error handling, confidence derived from cumulative probability (Morgan & Henrion, 1990). Normalized KDE with robust validation (Clemen & Reilly, 2013).
 * Calculates smoothed metrics from Monte Carlo samples using KDE.
 * @param {Array<number>} samples - Array of Monte Carlo samples
 * @returns {Object} Smoothed metrics including mean, variance, stdDev, points, cdfPoints
 * @throws {Error} If inputs are invalid
 * @reference Morgan, M. G., & Henrion, M. (1990); Clemen, R. T., & Reilly, T. (2013).
 */
function calculateSmoothedMetrics(samples) {
  try {
    if (!Array.isArray(samples) || samples.length === 0) {
      throw new Error('Invalid samples array');
    }
    const bandwidth = 1.06 * math.std(samples) * Math.pow(samples.length, -1 / 5);
    const density = performKDE(samples, bandwidth);
    const min = math.min(samples);
    const max = math.max(samples);
    const step = (max - min) / 100;
    const xValues = math.range(min, max, step).toArray();
    const smoothedPoints = xValues.map(x => ({ x, y: density(x) }));
    const totalArea = math.sum(smoothedPoints.map(p => p.y * step));
    if (totalArea <= 0) {
      throw new Error('Invalid total area for normalization');
    }
    let cumulative = 0;
    const normalizedPoints = smoothedPoints.map(p => {
      const normalizedY = p.y / totalArea;
      cumulative += normalizedY * step;
      return {
        x: p.x,
        y: normalizedY,
        confidence: Math.min(Math.max(cumulative * 100, 0), 100)
      };
    });

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
      return {
        x: p.x,
        y: Math.min(Math.max(cdf, 0), 1),
        confidence: Math.min(Math.max(cdf * 100, 0), 100)
      };
    });

    const varIndex90 = cdfPoints.findIndex(p => p.y >= 0.9);
    const smoothedVaR90 = varIndex90 >= 0 ? cdfPoints[varIndex90].x : min;
    const varIndex95 = cdfPoints.findIndex(p => p.y >= 0.95);
    const smoothedVaR95 = varIndex95 >= 0 ? cdfPoints[varIndex95].x : min;

    const tailPoints = cdfPoints.filter(p => p.y <= 0.1);
    const smoothedCVaR = tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : smoothedVaR90;
    const smoothedCVaR95 = calculateCVaR95(cdfPoints, min);

    const smoothedMAD = calculateMAD(samples, smoothedMean);

    const smoothedMedianIndex = cdfPoints.findIndex(p => p.y >= 0.5);
    const smoothedMedian = smoothedMedianIndex >= 0 ? cdfPoints[smoothedMedianIndex].x : smoothedMean;

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
      cdfPoints
    };
  } catch (error) {
    console.error('calculateSmoothedMetrics error:', error.message, { samplesLength: samples.length });
    return {
      mean: 0,
      variance: 0,
      stdDev: 0,
      skewness: 0,
      kurtosis: 0,
      var90: 0,
      var95: 0,
      cvar: 0,
      cvar95: 0,
      mad: 0,
      median: 0,
      coefficientOfVariation: 0,
      confidenceInterval: { lower: 0, upper: 0 },
      points: [{ x: 0, y: 1, confidence: 50 }],
      cdfPoints: [{ x: 0, y: 1, confidence: 50 }]
    };
  }
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
 * Best Practices: Immutable output, structured error handling, multiplicative scaling with robust normalization (Vose, 2008; Clemen & Reilly, 2013). Confidence derived from cumulative probability (Morgan & Henrion, 1990).
 * Adjusts PDF points based on slider values using a multiplicative transformation.
 * @param {Array<{x: number, y: number, confidence?: number}>} points - Original PDF points
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {{budgetFlexibility?: number, scheduleFlexibility?: number, scopeCertainty?: number, riskTolerance?: number}} sliderValues - Slider settings (0–100)
 * @returns {Array<{x: number, y: number, confidence: number}>} Adjusted PDF points
 * @throws {Error} If inputs are invalid
 * @reference Vose, D. (2008). Risk Analysis: A Quantitative Guide; Clemen, R. T., & Reilly, T. (2013); Morgan, M. G., & Henrion, M. (1990); McConnell, S. (2004). Code Complete.
 */
function adjustDistributionPoints(points, originalMean, originalStdDev, sliderValues) {
  try {
    if (!Array.isArray(points) || points.length < 2) {
      throw new Error(`Invalid points array: length=${points.length}`);
    }
    if (!Number.isFinite(originalMean) || !Number.isFinite(originalStdDev) || originalStdDev <= 0) {
      throw new Error(`Invalid mean=${originalMean} or stdDev=${originalStdDev}`);
    }

    const { budgetFlexibility = 0, scheduleFlexibility = 0, scopeCertainty = 0, riskTolerance = 0 } = sliderValues;
    const bf = Math.min(budgetFlexibility, 100) / 100;
    const sf = Math.min(scheduleFlexibility, 100) / 100;
    const sc = Math.min(scopeCertainty, 100) / 100;
    const rt = Math.min(riskTolerance, 100) / 100;

    const TRANSFORMATION_FACTORS = {
      BUDGET_FLEXIBILITY: { base: 0.95, scale: 0.35 },
      SCHEDULE_FLEXIBILITY: { base: 0.95, scale: 0.35 },
      SCOPE_CERTAINTY: { base: 1.0, scale: 0.3 },
      RISK_TOLERANCE: { base: 0.9, scale: 0.3 }
    };

    const bfFactor = TRANSFORMATION_FACTORS.BUDGET_FLEXIBILITY.base - TRANSFORMATION_FACTORS.BUDGET_FLEXIBILITY.scale * bf;
    const sfFactor = TRANSFORMATION_FACTORS.SCHEDULE_FLEXIBILITY.base - TRANSFORMATION_FACTORS.SCHEDULE_FLEXIBILITY.scale * sf;
    const scFactor = TRANSFORMATION_FACTORS.SCOPE_CERTAINTY.base - TRANSFORMATION_FACTORS.SCOPE_CERTAINTY.scale * sc;
    const rtFactor = TRANSFORMATION_FACTORS.RISK_TOLERANCE.base + TRANSFORMATION_FACTORS.RISK_TOLERANCE.scale * rt;
    const scaleFactor = bfFactor * sfFactor * scFactor * rtFactor;

    const adjustedPoints = points.map(p => {
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
        return { x: originalMean, y: 0, confidence: 0 };
      }
      return {
        x: p.x * scaleFactor,
        y: p.y / scaleFactor,
        confidence: Number.isFinite(p.confidence) ? p.confidence : 0
      };
    });

    const step = adjustedPoints[1]?.x - adjustedPoints[0]?.x || 1;
    const totalArea = adjustedPoints.reduce((sum, p) => sum + (Number.isFinite(p.y) ? p.y : 0) * step, 0);
    if (totalArea <= 0) {
      throw new Error(`Invalid total area for normalization: ${totalArea}`);
    }

    let cumulative = 0;
    const normalizedPoints = adjustedPoints.map(p => {
      const normalizedY = p.y / totalArea;
      cumulative += normalizedY * step;
      return {
        x: p.x,
        y: normalizedY,
        confidence: Math.min(Math.max(cumulative * 100, 0), 100)
      };
    });

    return normalizedPoints;
  } catch (error) {
    console.error('adjustDistributionPoints error:', error.message, { points: points.slice(0, 5), originalMean, originalStdDev, sliderValues });
    return points.map(p => ({
      x: p.x || originalMean || 0,
      y: p.y || 0,
      confidence: Number.isFinite(p.confidence) ? p.confidence : 0
    }));
  }
}


/**
 * Best Practices: Immutable output, structured error handling, multiplicative scaling with robust CDF integration (Vose, 2008). Confidence derived from cumulative probability (Morgan & Henrion, 1990).
 * Adjusts CDF points based on slider values, recomputing CDF from adjusted PDF.
 * @param {Array<{x: number, y: number, confidence?: number}>} originalCdfPoints - Original CDF points
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {{budgetFlexibility?: number, scheduleFlexibility?: number, scopeCertainty?: number, riskTolerance?: number}} sliderValues - Slider settings
 * @returns {Array<{x: number, y: number, confidence: number}>} Adjusted CDF points
 * @throws {Error} If inputs are invalid
 * @reference Vose, D. (2008); Morgan, M. G., & Henrion, M. (1990); Clemen, R. T., & Reilly, T. (2013); McConnell, S. (2004).
 */
function adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, sliderValues) {
  try {
    if (!Array.isArray(originalCdfPoints) || originalCdfPoints.length < 2) {
      throw new Error(`Invalid originalCdfPoints: length=${originalCdfPoints.length}`);
    }
    if (!Number.isFinite(originalMean) || !Number.isFinite(originalStdDev) || originalStdDev <= 0) {
      throw new Error(`Invalid mean=${originalMean} or stdDev=${originalStdDev}`);
    }

    const { budgetFlexibility = 0, scheduleFlexibility = 0, scopeCertainty = 0, riskTolerance = 0 } = sliderValues;
    const bf = Math.min(budgetFlexibility, 100) / 100;
    const sf = Math.min(scheduleFlexibility, 100) / 100;
    const sc = Math.min(scopeCertainty, 100) / 100;
    const rt = Math.min(riskTolerance, 100) / 100;

    const TRANSFORMATION_FACTORS = {
      BUDGET_FLEXIBILITY: { base: 0.95, scale: 0.35 },
      SCHEDULE_FLEXIBILITY: { base: 0.95, scale: 0.35 },
      SCOPE_CERTAINTY: { base: 1.0, scale: 0.3 },
      RISK_TOLERANCE: { base: 0.9, scale: 0.3 }
    };

    const bfFactor = TRANSFORMATION_FACTORS.BUDGET_FLEXIBILITY.base - TRANSFORMATION_FACTORS.BUDGET_FLEXIBILITY.scale * bf;
    const sfFactor = TRANSFORMATION_FACTORS.SCHEDULE_FLEXIBILITY.base - TRANSFORMATION_FACTORS.SCHEDULE_FLEXIBILITY.scale * sf;
    const scFactor = TRANSFORMATION_FACTORS.SCOPE_CERTAINTY.base - TRANSFORMATION_FACTORS.SCOPE_CERTAINTY.scale * sc;
    const rtFactor = TRANSFORMATION_FACTORS.RISK_TOLERANCE.base + TRANSFORMATION_FACTORS.RISK_TOLERANCE.scale * rt;
    const scaleFactor = bfFactor * sfFactor * scFactor * rtFactor;

    const step = originalCdfPoints[1]?.x - originalCdfPoints[0]?.x || 1;
    const pdfPoints = originalCdfPoints.map((p, i) => ({
      x: p.x,
      y: i === 0 ? 0 : ((originalCdfPoints[i].y - (originalCdfPoints[i - 1]?.y || 0)) / step),
      confidence: Number.isFinite(p.confidence) ? p.confidence : 0
    }));

    const adjustedPdfPoints = adjustDistributionPoints(pdfPoints, originalMean, originalStdDev, sliderValues);

    let cdf = 0;
    adjustedPdfPoints.sort((a, b) => a.x - b.x);
    const adjustedCdfPoints = adjustedPdfPoints.map(p => {
      cdf += (Number.isFinite(p.y) ? p.y : 0) * step;
      return {
        x: p.x,
        y: Math.min(Math.max(cdf, 0), 1),
        confidence: Math.min(Math.max(cdf * 100, 0), 100)
      };
    });

    return adjustedCdfPoints;
  } catch (error) {
    console.error('adjustCdfPoints error:', error.message, { originalCdfPoints: originalCdfPoints.slice(0, 5), originalMean, originalStdDev, sliderValues });
    return originalCdfPoints.map(p => ({
      x: p.x || originalMean || 0,
      y: p.y || 1,
      confidence: Number.isFinite(p.confidence) ? p.confidence : 50
    }));
  }
}


/**
 * Updates the dynamic outcome description to reflect the multiplicative transformation.
 * @param {number} bf - Budget Flexibility (0 to 1)
 * @param {number} sf - Schedule Flexibility (0 to 1)
 * @param {number} sc - Scope Certainty (0 to 1)
 * @param {number} rt - Risk Tolerance (0 to 1)
 * @param {number} origProb - Original probability
 * @param {number} adjProb - Adjusted probability
 * @param {number} targetValue - Target value
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @returns {string} Descriptive outcome string
 */
function generateDynamicOutcome(bf, sf, sc, rt, origProb, adjProb, targetValue, originalMean, originalStdDev) {
  const bfFactor = 0.95 - 0.35 * bf;
  const sfFactor = 0.95 - 0.35 * sf;
  const scFactor = 1.0 - 0.3 * sc;
  const rtFactor = 0.9 + 0.3 * rt;
  const scaleFactor = bfFactor * sfFactor * scFactor * rtFactor;
  const meanShift = originalMean * (scaleFactor - 1);
  const varianceScale = scFactor * scFactor; // Scope certainty drives variance reduction
  const probChange = adjProb - origProb;
  const isBelowMean = targetValue < originalMean;

  let outcome = `With Budget Flexibility=${(bf * 100).toFixed(0)}%, Schedule Flexibility=${(sf * 100).toFixed(0)}%, Scope Certainty=${(sc * 100).toFixed(0)}%, Risk Tolerance=${(rt * 100).toFixed(0)}%, `;
  if (probChange > 0) {
    outcome += `probability increases by ${(probChange * 100).toFixed(1)}% to ${(adjProb * 100).toFixed(1)}%. `;
  } else if (probChange < 0) {
    outcome += `probability decreases by ${(-probChange * 100).toFixed(1)}% to ${(adjProb * 100).toFixed(1)}%. `;
  } else {
    outcome += `probability remains at ${(adjProb * 100).toFixed(1)}%. `;
  }
  if (meanShift < 0) {
    outcome += `Mean shifts left by ${(-meanShift).toFixed(2)}, `;
  } else if (meanShift > 0) {
    outcome += `Mean shifts right by ${meanShift.toFixed(2)}, `;
  } else {
    outcome += `Mean unchanged, `;
  }
  if (varianceScale < 1) {
    outcome += `variance decreases by ${(1 - varianceScale).toFixed(2)}, `;
  } else if (varianceScale > 1) {
    outcome += `variance increases by ${(varianceScale - 1).toFixed(2)}, `;
  } else {
    outcome += `variance unchanged, `;
  }
  outcome += isBelowMean ? `Target is below mean, so probability is higher.` : `Target is above mean, so probability is lower.`;
  return outcome;
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
 * Best Practices: Immutable output, structured error handling, optimized iteration for performance (Powell, 2009). Ensures valid optimalObjective and probability (Clemen & Reilly, 2013).
 * Finds optimal slider settings to maximize probability for a target or minimize value for a confidence level.
 * @param {Array<{x: number, y: number, confidence: number}>} originalCdfPoints - Original CDF points
 * @param {number} originalMean - Original mean
 * @param {number} originalStdDev - Original standard deviation
 * @param {number|null} targetValue - Target value to maximize P(X <= targetValue)
 * @param {number|null} confidenceLevel - Confidence level to minimize value at
 * @param {Array<{x: number, y: number, confidence: number}>} originalPdfPoints - Original PDF points
 * @returns {{optimalSliderSettings: Object, optimalAdjustedPdfPoints: Array, optimalAdjustedCdfPoints: Array, optimalObjective: number, probability: number}|null} Optimal settings and points
 * @throws {Error} If inputs are invalid
 * @reference Powell, M. J. D. (2009). The BOBYQA algorithm for bound constrained optimization without derivatives; Clemen, R. T., & Reilly, T. (2013); McConnell, S. (2004).
 */
function findOptimalSliderSettings(originalCdfPoints, originalMean, originalStdDev, targetValue, confidenceLevel, originalPdfPoints) {
  try {
    if (!Array.isArray(originalCdfPoints) || originalCdfPoints.length < 2 || !Array.isArray(originalPdfPoints) || originalPdfPoints.length < 2) {
      throw new Error(`Invalid input arrays: cdfPoints=${originalCdfPoints.length}, pdfPoints=${originalPdfPoints.length}`);
    }
    if (!Number.isFinite(originalMean) || !Number.isFinite(originalStdDev) || originalStdDev <= 0) {
      throw new Error(`Invalid mean=${originalMean} or stdDev=${originalStdDev}`);
    }
    if (targetValue && (!Number.isFinite(targetValue) || targetValue < 0)) {
      throw new Error(`Invalid targetValue=${targetValue}`);
    }
    if (confidenceLevel && (!Number.isFinite(confidenceLevel) || confidenceLevel < 0 || confidenceLevel > 1)) {
      throw new Error(`Invalid confidenceLevel=${confidenceLevel}`);
    }

    const sliderSteps = [0, 25, 50, 75, 100]; // Reduced steps for performance
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
              if (Number.isFinite(prob) && prob > bestObjective) {
                bestObjective = prob;
                bestSettings = sliderValues;
                bestAdjustedCdfPoints = adjustedCdfPoints;
                bestProbability = prob;
              }
            } else if (confidenceLevel) {
              const x = findValueAtConfidence(adjustedCdfPoints, confidenceLevel);
              if (Number.isFinite(x) && x < bestObjective) {
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
      const result = {
        optimalSliderSettings: bestSettings,
        optimalAdjustedPdfPoints,
        optimalAdjustedCdfPoints: bestAdjustedCdfPoints,
        optimalObjective: targetValue ? targetValue : bestObjective,
        probability: Number.isFinite(bestProbability) ? Math.min(Math.max(bestProbability, 0), 1) : 0
      };
      return result;
    }
    throw new Error('No valid optimal settings found');
  } catch (error) {
    console.error('findOptimalSliderSettings error:', error.message, { originalCdfPoints: originalCdfPoints.slice(0, 5), originalMean, originalStdDev, targetValue, confidenceLevel });
    return null;
  }
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

    // Initialize defaults for all fields
    let result = {
      task: { value: task, description: "Task name" },
      bestCase: { value: optimistic, description: "Optimistic estimate" },
      mostLikely: { value: mostLikely, description: "Most likely estimate" },
      worstCase: { value: pessimistic, description: "Pessimistic estimate" },
      triangleMean: { value: mostLikely, description: "Triangle mean (fallback)" },
      triangleVariance: { value: 0, description: "Triangle variance (fallback)" },
      triangleStdDev: { value: 0, description: "Triangle standard deviation (fallback)" },
      TRIANGLE_STD: { value: 0, description: "Triangle standard deviation (alias, fallback)" },
      triangleSkewness: { value: 0, description: "Triangle skewness (fallback)" },
      triangleKurtosis: { value: -6/5, description: "Triangle kurtosis (fallback)" },
      triangleMedian: { value: mostLikely, description: "Triangle median (fallback)" },
      trianglePoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Triangle distribution points (CDF, fallback)" },
      trianglePdfPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Triangle distribution points (PDF, fallback)" },
      triangleConfidenceValues: { value: { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely }, description: "Triangle values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence (fallback)" },
      triangle90thPercentile: { value: mostLikely, description: "Triangle 90th percentile (fallback)" },
      triangle95thPercentile: { value: mostLikely, description: "Triangle 95th percentile (fallback)" },
      triangleConfidenceInterval: { value: { lower: mostLikely, upper: mostLikely }, description: "Triangle 95% confidence interval for mean (fallback)" },
      triangleCoefficientOfVariation: { value: 0, description: "Triangle coefficient of variation (fallback)" },
      triangleCVaR95: { value: mostLikely, description: "Triangle CVaR at 95% confidence (fallback)" },
      triangleSensitivity: { value: { originalMean: mostLikely, variedMean: mostLikely, change: 0 }, description: "Triangle sensitivity to input variations (fallback)" },
      probExceedTargetsTriangle: { value: {}, description: "Triangle probabilities of exceeding key targets (fallback)" },
      pertMean: { value: mostLikely, description: "PERT mean (fallback)" },
      pertVariance: { value: 0, description: "PERT variance (fallback)" },
      pertStdDev: { value: 0, description: "PERT standard deviation (fallback)" },
      pertSkewness: { value: 0, description: "PERT skewness (fallback)" },
      pertKurtosis: { value: -6/5, description: "PERT kurtosis (fallback)" },
      pertMedian: { value: mostLikely, description: "PERT median (fallback)" },
      pertPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "PERT distribution points (CDF, fallback)" },
      pertPdfPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "PERT distribution points (PDF, fallback)" },
      weightedConservative: { value: mostLikely, description: "Conservative weighted estimate (fallback)" },
      weightedOptimistic: { value: mostLikely, description: "Optimistic weighted estimate (fallback)" },
      weightedNeutral: { value: mostLikely, description: "Neutral weighted estimate (PERT mean, fallback)" },
      pertConfidenceValues: { value: { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely }, description: "PERT values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence (fallback)" },
      pert90thPercentile: { value: mostLikely, description: "PERT 90th percentile (fallback)" },
      pert95thPercentile: { value: mostLikely, description: "PERT 95th percentile (fallback)" },
      pertConfidenceInterval: { value: { lower: mostLikely, upper: mostLikely }, description: "PERT 95% confidence interval for mean (fallback)" },
      pertCoefficientOfVariation: { value: 0, description: "PERT coefficient of variation (fallback)" },
      pertCVaR95: { value: mostLikely, description: "PERT CVaR at 95% confidence (fallback)" },
      probExceedTargetsPERT: { value: {}, description: "PERT probabilities of exceeding key targets (fallback)" },
      betaMean: { value: mostLikely, description: "Beta mean (fallback)" },
      betaVariance: { value: 0, description: "Beta variance (fallback)" },
      betaStdDev: { value: 0, description: "Beta standard deviation (fallback)" },
      betaSkewness: { value: 0, description: "Beta skewness (fallback)" },
      betaKurtosis: { value: 0, description: "Beta kurtosis (fallback)" },
      betaMode: { value: mostLikely, description: "Beta mode (fallback)" },
      betaMedian: { value: mostLikely, description: "Beta median (fallback)" },
      betaPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Beta distribution points (CDF, fallback)" },
      betaPdfPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Beta distribution points (PDF, fallback)" },
      probExceedPertMeanBeta: { value: 0, description: "Probability exceeding PERT mean (Beta, fallback)" },
      betaConfidenceValues: { value: { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely }, description: "Beta values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence (fallback)" },
      beta90thPercentile: { value: mostLikely, description: "Beta 90th percentile (fallback)" },
      beta95thPercentile: { value: mostLikely, description: "Beta 95th percentile (fallback)" },
      betaConfidenceInterval: { value: { lower: mostLikely, upper: mostLikely }, description: "Beta 95% confidence interval for mean (fallback)" },
      betaCoefficientOfVariation: { value: 0, description: "Beta coefficient of variation (fallback)" },
      betaCVaR95: { value: mostLikely, description: "Beta CVaR at 95% confidence (fallback)" },
      probExceedTargetsBeta: { value: {}, description: "Beta probabilities of exceeding key targets (fallback)" },
      mcMean: { value: mostLikely, description: "Monte Carlo mean (fallback)" },
      mcVariance: { value: 0, description: "Monte Carlo variance (fallback)" },
      mcStdDev: { value: 0, description: "Monte Carlo standard deviation (fallback)" },
      mcSkewness: { value: 0, description: "Monte Carlo skewness (fallback)" },
      mcKurtosis: { value: 0, description: "Monte Carlo kurtosis (fallback)" },
      mcVaR: { value: mostLikely, description: "Monte Carlo VaR 90% (fallback)" },
      mcCVaR: { value: mostLikely, description: "Monte Carlo CVaR 90% (fallback)" },
      mcVaR95: { value: mostLikely, description: "Monte Carlo VaR 95% (fallback)" },
      mcCVaR95: { value: mostLikely, description: "Monte Carlo CVaR 95% (fallback)" },
      mcMAD: { value: 0, description: "Monte Carlo MAD (fallback)" },
      mcMedian: { value: mostLikely, description: "Monte Carlo median (fallback)" },
      mcPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Monte Carlo distribution points (CDF, fallback)" },
      mcRawPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Monte Carlo raw histogram points (fallback)" },
      mcConfidenceValues: { value: { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely }, description: "Monte Carlo unsmoothed values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence (fallback)" },
      mcConfidenceInterval: { value: { lower: mostLikely, upper: mostLikely }, description: "Monte Carlo 95% confidence interval for mean (fallback)" },
      mcCoefficientOfVariation: { value: 0, description: "Monte Carlo coefficient of variation (fallback)" },
      mcSmoothedMean: { value: mostLikely, description: "Smoothed Monte Carlo mean (fallback)" },
      mcSmoothedVariance: { value: 0, description: "Smoothed Monte Carlo variance (fallback)" },
      mcSmoothedStdDev: { value: 0, description: "Smoothed Monte Carlo standard deviation (fallback)" },
      mcSmoothedSkewness: { value: 0, description: "Smoothed Monte Carlo skewness (fallback)" },
      mcSmoothedKurtosis: { value: 0, description: "Smoothed Monte Carlo kurtosis (fallback)" },
      mcSmoothedVaR: { value: mostLikely, description: "Smoothed Monte Carlo VaR 90% (fallback)" },
      mcSmoothedCVaR: { value: mostLikely, description: "Smoothed Monte Carlo CVaR 90% (fallback)" },
      mcSmoothedVaR95: { value: mostLikely, description: "Smoothed Monte Carlo VaR 95% (fallback)" },
      mcSmoothedCVaR95: { value: mostLikely, description: "Smoothed Monte Carlo CVaR 95% (fallback)" },
      mcSmoothedMAD: { value: 0, description: "Smoothed Monte Carlo MAD (fallback)" },
      mcSmoothedMedian: { value: mostLikely, description: "Smoothed Monte Carlo median (fallback)" },
      mcSmoothedPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Smoothed Monte Carlo distribution points (density, fallback)" },
      mcSmoothedCdfPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Smoothed Monte Carlo distribution points (CDF, fallback)" },
      mcSmoothedConfidenceValues: { value: { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely }, description: "Smoothed Monte Carlo values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence (fallback)" },
      mcSmoothedConfidenceInterval: { value: { lower: mostLikely, upper: mostLikely }, description: "Smoothed Monte Carlo 95% confidence interval for mean (fallback)" },
      mcSmoothedCoefficientOfVariation: { value: 0, description: "Smoothed Monte Carlo coefficient of variation (fallback)" },
      probExceedPertMeanMCUnsmoothed: { value: 0, description: "Probability exceeding PERT mean (MC Unsmoothed, fallback)" },
      probExceedPertMeanMCSmoothed: { value: 0, description: "Probability exceeding PERT mean (MC Smoothed, fallback)" },
      probExceedTargetsMC: { value: {}, description: "Monte Carlo probabilities of exceeding key targets (fallback)" },
      klDivergenceTrianglePERT: { value: 0, description: "KL Divergence between Triangle and PERT distributions (fallback)" },
      decisionOptimizerPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Decision Optimizer aggregated points (fallback)" },
      decisionOptimizerOriginalPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Decision Optimizer original distribution points (fallback)" },
      decisionOptimizerAdjustedPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Decision Optimizer adjusted distribution points based on sliders (fallback)" },
      decisionOptimizerMetrics: { value: { originalMedian: mostLikely, adjustedMedian: mostLikely, newConfidence: 50 }, description: "Decision Optimizer metrics (originalMedian, adjustedMedian, newConfidence, fallback)" },
      targetProbabilityPoints: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Target Probability points for specified values (fallback)" },
      targetProbabilityOriginalCdf: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Target Probability original CDF points (smoothed MC, fallback)" },
      targetProbabilityAdjustedCdf: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Target Probability adjusted CDF points based on sliders (fallback)" },
      targetProbabilityOriginalPdf: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Target Probability original PDF points (smoothed MC, fallback)" },
      targetProbabilityAdjustedPdf: { value: [{ x: mostLikely, y: 1, confidence: 50 }], description: "Target Probability adjusted PDF points based on sliders (fallback)" },
      targetProbability: { value: { original: null, adjusted: null }, description: "Interpolated CDF probabilities for the target value (fallback)" },
      valueAtConfidence: { value: { original: null, adjusted: null }, description: "Value at the specified confidence level for original and adjusted CDFs (fallback)" },
      sliderCombinations: { value: [], description: "Slider combinations (fallback)" },
      optimalCombination: { value: null, description: "Optimal combination (fallback)" },
      optimalData: { value: null, description: "Optimal data (fallback)" }
    };

    // PERT Calculations
    try {
      result.pertMean = { value: isDegenerate ? mostLikely : calculatePERTMean(optimistic, mostLikely, pessimistic), description: "PERT mean" };
      result.pertVariance = { value: isDegenerate ? 0 : calculatePERTVariance(optimistic, mostLikely, pessimistic), description: "PERT variance" };
      result.pertStdDev = { value: isDegenerate ? 0 : calculatePERTStdDev(optimistic, mostLikely, pessimistic), description: "PERT standard deviation" };
      const betaAlpha = isDegenerate ? 1 : Math.max(1, calculateAlpha(result.pertMean.value, result.pertStdDev.value, optimistic, pessimistic));
      const betaBeta = isDegenerate ? 1 : Math.max(1, calculateBeta(result.pertMean.value, result.pertStdDev.value, optimistic, pessimistic));
      result.pertSkewness = { value: isDegenerate ? 0 : calculatePERTSkewness(optimistic, mostLikely, pessimistic), description: "PERT skewness" };
      result.pertKurtosis = { value: calculatePERTKurtosis(optimistic, mostLikely, pessimistic), description: "PERT kurtosis" };
      result.pertMedian = { value: isDegenerate ? mostLikely : calculatePERTMedian(optimistic, mostLikely, pessimistic, betaAlpha, betaBeta), description: "PERT median" };
      result.pertPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null), description: "PERT distribution points (CDF)" };
      result.pertPdfPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculatePERTPdfPoints(optimistic, mostLikely, pessimistic, betaAlpha, betaBeta), description: "PERT distribution points (PDF)" };
      result.weightedConservative = { value: isDegenerate ? mostLikely : calculateConservativeEstimate(optimistic, mostLikely, pessimistic), description: "Conservative weighted estimate" };
      result.weightedOptimistic = { value: isDegenerate ? mostLikely : calculateOptimisticEstimate(optimistic, mostLikely, pessimistic), description: "Optimistic weighted estimate" };
      result.weightedNeutral = { value: result.pertMean.value, description: "Neutral weighted estimate (PERT mean)" };
      result.pertConfidenceValues = { value: isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null), description: "PERT values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" };
      result.pert90thPercentile = { value: result.pertConfidenceValues.value.valueAt90Percent, description: "PERT 90th percentile" };
      result.pert95thPercentile = { value: result.pertConfidenceValues.value.valueAt95Percent, description: "PERT 95th percentile" };
      result.pertConfidenceInterval = { value: isDegenerate ? { lower: mostLikely, upper: mostLikely } : calculatePERTConfidenceInterval(result.pertMean.value, result.pertStdDev.value), description: "PERT 95% confidence interval for mean" };
      result.pertCoefficientOfVariation = { value: isDegenerate ? 0 : calculatePERTCoefficientOfVariation(result.pertMean.value, result.pertStdDev.value), description: "PERT coefficient of variation" };
      result.pertCVaR95 = { value: isDegenerate ? mostLikely : calculatePERTCVaR95(result.pertPoints.value, optimistic), description: "PERT CVaR at 95% confidence" };
      result.probExceedTargetsPERT = { value: isDegenerate ? {} : calculateProbExceedTargets('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null, [result.triangleMean.value, mostLikely, result.pertMean.value]), description: "PERT probabilities of exceeding key targets" };
    } catch (err) {
      console.warn('PERT calculations failed:', err.message);
    }

    // Triangle Calculations
    try {
      result.triangleMean = { value: isDegenerate ? mostLikely : calculateTriangleMean(optimistic, mostLikely, pessimistic), description: "Triangle mean" };
      result.triangleVariance = { value: isDegenerate ? 0 : calculateTriangleVariance(optimistic, mostLikely, pessimistic), description: "Triangle variance" };
      result.triangleStdDev = { value: isDegenerate ? 0 : calculateTriangleStdDev(optimistic, mostLikely, pessimistic), description: "Triangle standard deviation" };
      result.TRIANGLE_STD = { value: result.triangleStdDev.value, description: "Triangle standard deviation (alias)" };
      result.triangleSkewness = { value: isDegenerate ? 0 : calculateTriangleSkewness(optimistic, mostLikely, pessimistic), description: "Triangle skewness" };
      result.triangleKurtosis = { value: calculateTriangleKurtosis(optimistic, mostLikely, pessimistic), description: "Triangle kurtosis" };
      result.triangleMedian = { value: isDegenerate ? mostLikely : calculateTriangleMedian(optimistic, mostLikely, pessimistic), description: "Triangle median" };
      result.trianglePoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null), description: "Triangle distribution points (CDF)" };
      result.trianglePdfPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateTrianglePdfPoints(optimistic, mostLikely, pessimistic), description: "Triangle distribution points (PDF)" };
      result.triangleConfidenceValues = { value: isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null), description: "Triangle values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" };
      result.triangle90thPercentile = { value: result.triangleConfidenceValues.value.valueAt90Percent, description: "Triangle 90th percentile" };
      result.triangle95thPercentile = { value: result.triangleConfidenceValues.value.valueAt95Percent, description: "Triangle 95th percentile" };
      result.triangleConfidenceInterval = { value: isDegenerate ? { lower: mostLikely, upper: mostLikely } : calculateTriangleConfidenceInterval(result.triangleMean.value, result.triangleStdDev.value), description: "Triangle 95% confidence interval for mean" };
      result.triangleCoefficientOfVariation = { value: isDegenerate ? 0 : calculateTriangleCoefficientOfVariation(result.triangleMean.value, result.triangleStdDev.value), description: "Triangle coefficient of variation" };
      result.triangleCVaR95 = { value: isDegenerate ? mostLikely : calculateTriangleCVaR95(result.trianglePoints.value, optimistic), description: "Triangle CVaR at 95% confidence" };
      result.triangleSensitivity = { value: isDegenerate ? { originalMean: mostLikely, variedMean: mostLikely, change: 0 } : calculateSensitivity(result.triangleMean.value, result.triangleStdDev.value, optimistic, pessimistic), description: "Triangle sensitivity to input variations" };
      result.probExceedTargetsTriangle = { value: isDegenerate ? {} : calculateProbExceedTargets('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null, [result.triangleMean.value, mostLikely, result.pertMean.value]), description: "Triangle probabilities of exceeding key targets" };
    } catch (err) {
      console.warn('Triangle calculations failed:', err.message);
    }

    // Beta Calculations
    try {
      const betaAlpha = isDegenerate ? 1 : Math.max(1, calculateAlpha(result.pertMean.value, result.pertStdDev.value, optimistic, pessimistic));
      const betaBeta = isDegenerate ? 1 : Math.max(1, calculateBeta(result.pertMean.value, result.pertStdDev.value, optimistic, pessimistic));
      result.betaMean = { value: isDegenerate ? mostLikely : calculateBetaMean(betaAlpha, betaBeta, optimistic, pessimistic), description: "Beta mean" };
      result.betaVariance = { value: isDegenerate ? 0 : calculateBetaVariance(betaAlpha, betaBeta, optimistic, pessimistic), description: "Beta variance" };
      result.betaStdDev = { value: isDegenerate ? 0 : calculateBetaStdDev(betaAlpha, betaBeta, optimistic, pessimistic), description: "Beta standard deviation" };
      result.betaSkewness = { value: isDegenerate ? 0 : calculateBetaSkewness(betaAlpha, betaBeta), description: "Beta skewness" };
      result.betaKurtosis = { value: calculateBetaKurtosis(betaAlpha, betaBeta), description: "Beta kurtosis" };
      result.betaMode = { value: isDegenerate ? mostLikely : calculateBetaMode(betaAlpha, betaBeta, optimistic, pessimistic), description: "Beta mode" };
      result.betaMedian = { value: isDegenerate ? mostLikely : calculateBetaMedian(betaAlpha, betaBeta, optimistic, pessimistic), description: "Beta median" };
      result.betaPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null), description: "Beta distribution points (CDF)" };
      result.betaPdfPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateBetaPdfPoints(betaAlpha, betaBeta, optimistic, pessimistic), description: "Beta distribution points (PDF)" };
      result.probExceedPertMeanBeta = { value: isDegenerate ? 0 : calculateProbExceedPertMeanBeta(result.pertMean.value, betaAlpha, betaBeta, optimistic, pessimistic), description: "Probability exceeding PERT mean (Beta)" };
      result.betaConfidenceValues = { value: isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null), description: "Beta values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" };
      result.beta90thPercentile = { value: result.betaConfidenceValues.value.valueAt90Percent, description: "Beta 90th percentile" };
      result.beta95thPercentile = { value: result.betaConfidenceValues.value.valueAt95Percent, description: "Beta 95th percentile" };
      result.betaConfidenceInterval = { value: isDegenerate ? { lower: mostLikely, upper: mostLikely } : calculateBetaConfidenceInterval(result.betaMean.value, result.betaStdDev.value), description: "Beta 95% confidence interval for mean" };
      result.betaCoefficientOfVariation = { value: isDegenerate ? 0 : calculateBetaCoefficientOfVariation(result.betaMean.value, result.betaStdDev.value), description: "Beta coefficient of variation" };
      result.betaCVaR95 = { value: isDegenerate ? mostLikely : calculateBetaCVaR95(result.betaPoints.value, optimistic), description: "Beta CVaR at 95% confidence" };
      result.probExceedTargetsBeta = { value: isDegenerate ? {} : calculateProbExceedTargets('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null, [result.triangleMean.value, mostLikely, result.pertMean.value]), description: "Beta probabilities of exceeding key targets" };
    } catch (err) {
      console.warn('Beta calculations failed:', err.message);
    }

    // Monte Carlo Simulation
    let mcUnsmoothed;
    try {
      mcUnsmoothed = isDegenerate ? Array(1000).fill(mostLikely) : monteCarloSamplesBetaNoNoise(result.betaAlpha || 1, result.betaBeta || 1, optimistic, pessimistic);
      result.mcMean = { value: calculateUnsmoothedMetrics(mcUnsmoothed).mean, description: "Monte Carlo mean" };
      result.mcVariance = { value: calculateUnsmoothedMetrics(mcUnsmoothed).variance, description: "Monte Carlo variance" };
      result.mcStdDev = { value: calculateUnsmoothedMetrics(mcUnsmoothed).stdDev, description: "Monte Carlo standard deviation" };
      result.mcSkewness = { value: calculateUnsmoothedMetrics(mcUnsmoothed).skewness, description: "Monte Carlo skewness" };
      result.mcKurtosis = { value: calculateUnsmoothedMetrics(mcUnsmoothed).kurtosis, description: "Monte Carlo kurtosis" };
      result.mcVaR = { value: calculateUnsmoothedMetrics(mcUnsmoothed).var90, description: "Monte Carlo VaR 90%" };
      result.mcCVaR = { value: calculateUnsmoothedMetrics(mcUnsmoothed).cvar90, description: "Monte Carlo CVaR 90%" };
      result.mcVaR95 = { value: calculateUnsmoothedMetrics(mcUnsmoothed).var95, description: "Monte Carlo VaR 95%" };
      result.mcCVaR95 = { value: calculateUnsmoothedMetrics(mcUnsmoothed).cvar95, description: "Monte Carlo CVaR 95%" };
      result.mcMAD = { value: calculateUnsmoothedMetrics(mcUnsmoothed).mad, description: "Monte Carlo MAD" };
      result.mcMedian = { value: calculateUnsmoothedMetrics(mcUnsmoothed).median, description: "Monte Carlo median" };
      result.mcPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, result.betaAlpha || 1, result.betaBeta || 1, mcUnsmoothed), description: "Monte Carlo distribution points (CDF)" };
      result.mcRawPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateMonteCarloRawPoints(mcUnsmoothed, optimistic, pessimistic), description: "Monte Carlo raw histogram points" };
      result.mcConfidenceValues = { value: isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, result.betaAlpha || 1, result.betaBeta || 1, mcUnsmoothed), description: "Monte Carlo unsmoothed values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" };
      result.mcConfidenceInterval = { value: calculateUnsmoothedMetrics(mcUnsmoothed).confidenceInterval, description: "Monte Carlo 95% confidence interval for mean" };
      result.mcCoefficientOfVariation = { value: calculateUnsmoothedMetrics(mcUnsmoothed).coefficientOfVariation, description: "Monte Carlo coefficient of variation" };
      result.probExceedPertMeanMCUnsmoothed = { value: isDegenerate ? 0 : calculateProbExceedPertMeanMC(mcUnsmoothed, result.pertMean.value), description: "Probability exceeding PERT mean (MC Unsmoothed)" };
    } catch (err) {
      console.warn('Monte Carlo simulation failed:', err.message);
    }

    // Smoothed Monte Carlo
    try {
      const smoothedMC = calculateSmoothedMetrics(mcUnsmoothed || Array(1000).fill(mostLikely));
      result.mcSmoothedMean = { value: smoothedMC.mean, description: "Smoothed Monte Carlo mean" };
      result.mcSmoothedVariance = { value: smoothedMC.variance, description: "Smoothed Monte Carlo variance" };
      result.mcSmoothedStdDev = { value: smoothedMC.stdDev, description: "Smoothed Monte Carlo standard deviation" };
      result.mcSmoothedSkewness = { value: smoothedMC.skewness, description: "Smoothed Monte Carlo skewness" };
      result.mcSmoothedKurtosis = { value: smoothedMC.kurtosis, description: "Smoothed Monte Carlo kurtosis" };
      result.mcSmoothedVaR = { value: smoothedMC.var90, description: "Smoothed Monte Carlo VaR 90%" };
      result.mcSmoothedCVaR = { value: smoothedMC.cvar, description: "Smoothed Monte Carlo CVaR 90%" };
      result.mcSmoothedVaR95 = { value: smoothedMC.var95, description: "Smoothed Monte Carlo VaR 95%" };
      result.mcSmoothedCVaR95 = { value: smoothedMC.cvar95, description: "Smoothed Monte Carlo CVaR 95%" };
      result.mcSmoothedMAD = { value: smoothedMC.mad, description: "Smoothed Monte Carlo MAD" };
      result.mcSmoothedMedian = { value: smoothedMC.median, description: "Smoothed Monte Carlo median" };
      result.mcSmoothedPoints = { value: smoothedMC.points, description: "Smoothed Monte Carlo distribution points (density)" };
      result.mcSmoothedCdfPoints = { value: smoothedMC.cdfPoints, description: "Smoothed Monte Carlo distribution points (CDF)" };
      result.mcSmoothedConfidenceValues = { value: isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('MC_SMOOTHED', optimistic, mostLikely, pessimistic, result.betaAlpha || 1, result.betaBeta || 1, mcUnsmoothed), description: "Smoothed Monte Carlo values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" };
      result.mcSmoothedConfidenceInterval = { value: smoothedMC.confidenceInterval, description: "Smoothed Monte Carlo 95% confidence interval for mean" };
      result.mcSmoothedCoefficientOfVariation = { value: smoothedMC.coefficientOfVariation, description: "Smoothed Monte Carlo coefficient of variation" };
      result.probExceedPertMeanMCSmoothed = { value: isDegenerate ? 0 : calculateProbExceedPertMeanMC(smoothedMC.points.map(p => p.x), result.pertMean.value), description: "Probability exceeding PERT mean (MC Smoothed)" };
    } catch (err) {
      console.warn('Smoothed Monte Carlo calculations failed:', err.message);
    }

    // Additional Calculations
    try {
      result.probExceedTargetsMC = { value: isDegenerate ? {} : calculateProbExceedTargets('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, null, null, mcUnsmoothed, [result.triangleMean.value, mostLikely, result.pertMean.value]), description: "Monte Carlo probabilities of exceeding key targets" };
      result.klDivergenceTrianglePERT = { value: isDegenerate ? 0 : calculateKLDivergence(result.trianglePoints.value, result.pertPoints.value, (pessimistic - optimistic) / 100), description: "KL Divergence between Triangle and PERT distributions" };
    } catch (err) {
      console.warn('Additional calculations failed:', err.message);
    }

    // Decision Optimizer and Target Probability
    try {
      result.decisionOptimizerPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateDecisionOptimizerPoints(result.trianglePoints.value, result.pertPoints.value, result.betaPoints.value, result.mcSmoothedPoints.value), description: "Decision Optimizer aggregated points" };
      result.decisionOptimizerOriginalPoints = { value: result.mcSmoothedPoints.value || [{ x: mostLikely, y: 1, confidence: 50 }], description: "Decision Optimizer original distribution points" };
      result.decisionOptimizerAdjustedPoints = { value: adjustDistributionPoints(result.decisionOptimizerOriginalPoints.value, result.mcSmoothedMean.value || mostLikely, result.mcSmoothedStdDev.value || 0, effectiveSliders), description: "Decision Optimizer adjusted distribution points based on sliders" };
      result.decisionOptimizerMetrics = { value: calculateAdjustedMetrics(result.decisionOptimizerOriginalPoints.value, result.decisionOptimizerAdjustedPoints.value), description: "Decision Optimizer metrics (originalMedian, adjustedMedian, newConfidence)" };
      result.targetProbabilityPoints = { value: isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateTargetProbabilityPoints(optimistic, pessimistic, result.triangleMean.value, [effectiveTargetValue, result.triangleMean.value, result.pertMean.value]), description: "Target Probability points for specified values" };
      result.targetProbabilityOriginalCdf = { value: result.mcSmoothedCdfPoints.value || [{ x: mostLikely, y: 1, confidence: 50 }], description: "Target Probability original CDF points (smoothed MC)" };
      result.targetProbabilityAdjustedCdf = { value: adjustCdfPoints(result.targetProbabilityOriginalCdf.value, result.mcSmoothedMean.value || mostLikely, result.mcSmoothedStdDev.value || 0, effectiveSliders), description: "Target Probability adjusted CDF points based on sliders" };
      result.targetProbabilityOriginalPdf = { value: result.mcSmoothedPoints.value || [{ x: mostLikely, y: 1, confidence: 50 }], description: "Target Probability original PDF points (smoothed MC)" };
      result.targetProbabilityAdjustedPdf = { value: adjustDistributionPoints(result.targetProbabilityOriginalPdf.value, result.mcSmoothedMean.value || mostLikely, result.mcSmoothedStdDev.value || 0, effectiveSliders), description: "Target Probability adjusted PDF points based on sliders" };
      result.targetProbability = {
        value: {
          original: effectiveTargetValue && isValidCdfArray(result.targetProbabilityOriginalCdf.value) ? interpolateCdf(result.targetProbabilityOriginalCdf.value, effectiveTargetValue) : null,
          adjusted: effectiveTargetValue && isValidCdfArray(result.targetProbabilityAdjustedCdf.value) ? interpolateCdf(result.targetProbabilityAdjustedCdf.value, effectiveTargetValue) : null
        },
        description: "Interpolated CDF probabilities for the target value"
      };
      result.valueAtConfidence = {
        value: {
          original: confidenceLevel && isValidCdfArray(result.targetProbabilityOriginalCdf.value) ? findValueAtConfidence(result.targetProbabilityOriginalCdf.value, confidenceLevel) : null,
          adjusted: confidenceLevel && isValidCdfArray(result.targetProbabilityAdjustedCdf.value) ? findValueAtConfidence(result.targetProbabilityAdjustedCdf.value, confidenceLevel) : null
        },
        description: "Value at the specified confidence level for original and adjusted CDFs"
      };
    } catch (err) {
      console.warn('Decision optimizer and target probability calculations failed:', err.message);
    }

    // Optimization and Slider Combinations
    try {
      if (optimizeFor) {
        result.optimalData = findOptimalSliderSettings(
          result.targetProbabilityOriginalCdf.value,
          result.mcSmoothedMean.value || mostLikely,
          result.mcSmoothedStdDev.value || 0,
          effectiveTargetValue,
          confidenceLevel,
          result.targetProbabilityOriginalPdf.value
        );
        result.optimalData = {
          value: result.optimalData ? {
            optimalSliderSettings: result.optimalData.optimalSliderSettings,
            optimalAdjustedPdfPoints: result.optimalData.optimalAdjustedPdfPoints,
            optimalAdjustedCdfPoints: result.optimalData.optimalAdjustedCdfPoints,
            optimalObjective: result.optimalData.optimalObjective,
            probability: result.optimalData.probability
          } : null,
          description: optimizeFor === 'target' ? "Optimal slider settings and points maximizing probability for target value" : "Optimal slider settings and points minimizing value at confidence level"
        };
      }
      if (Number.isFinite(effectiveTargetValue)) {
        const sliderSteps = [0, 25, 50, 75, 100];
        result.sliderCombinations = computeSliderCombinations(
          result.targetProbabilityOriginalCdf.value,
          effectiveTargetValue,
          result.mcSmoothedMean.value || mostLikely,
          result.mcSmoothedStdDev.value || 0,
          result.targetProbabilityOriginalPdf.value,
          sliderSteps
        );
        result.sliderCombinations = { value: result.sliderCombinations || [], description: "Slider combinations with probabilities, impacts, and additional metrics" };
        result.optimalCombination = result.sliderCombinations.value.length > 0 ? getOptimalCombination(result.sliderCombinations.value) : null;
        result.optimalCombination = {
          value: result.optimalCombination ? {
            budgetFlexibility: result.optimalCombination.bf,
            scheduleFlexibility: result.optimalCombination.sf,
            scopeCertainty: result.optimalCombination.sc,
            riskTolerance: result.optimalCombination.rt,
            probability: result.optimalCombination.adjProb,
            scenarioSummary: result.optimalCombination.scenarioSummary,
            expectedOutcome: result.optimalCombination.expectedOutcome,
            budgetFlexImpact: result.optimalCombination.budgetFlexImpact,
            scheduleFlexImpact: result.optimalCombination.scheduleFlexImpact,
            scopeCertImpact: result.optimalCombination.scopeCertImpact,
            tolPoorQualImpact: result.optimalCombination.tolPoorQualImpact,
            expectedShortfall: result.optimalCombination.expectedShortfall,
            sensitivities: result.optimalCombination.sensitivities,
            meanShift: result.optimalCombination.meanShift,
            varianceScale: result.optimalCombination.varianceScale,
            riskAdjustedRatio: result.optimalCombination.riskAdjustedRatio,
            riskProbabilities: result.optimalCombination.riskProbabilities,
            keyImpact: result.optimalCombination.keyImpact
          } : null,
          description: "Optimal slider combination for highest probability of meeting target value"
        };
      }
    } catch (err) {
      console.warn('Optimization and slider combinations failed:', err.message);
    }

    return result;
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
