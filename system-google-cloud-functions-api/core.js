// core.js
'use strict';

const math = require('mathjs');
const jstat = require('jstat');
const functions = require('@google-cloud/functions-framework');

/* ============================================================================
   🟩 BASIC UTILITIES
============================================================================ */
function validateEstimates(optimistic, mostLikely, pessimistic) {
  if (!Number.isFinite(optimistic) || !Number.isFinite(mostLikely) || !Number.isFinite(pessimistic)) {
    throw new Error('Estimates must be finite numbers');
  }
  if (optimistic > mostLikely || mostLikely > pessimistic) {
    throw new Error('Invalid estimates: optimistic <= mostLikely <= pessimistic required');
  }
  // New: Warn about edge cases that could cause division by zero
  if (mostLikely === optimistic || mostLikely === pessimistic) {
    console.warn('Edge case detected: mostLikely equals optimistic or pessimistic, may cause issues in distribution calculations');
  }
}

/* ============================================================================
   🟦 TRIANGLE DISTRIBUTION FUNCTIONS
============================================================================ */
function calculateTriangleMean(o, m, p) {
  return (o + m + p) / 3;
}
function calculateTriangleVariance(o, m, p) {
  return (o * o + m * m + p * p - o * m - o * p - m * p) / 18;
}
function calculateTriangleStdDev(o, m, p) {
  return Math.sqrt(calculateTriangleVariance(o, m, p));
}
function calculateTriangleSkewness(o, m, p) {
  const variance = calculateTriangleVariance(o, m, p);
  if (variance === 0) return 0; // Prevent division by zero
  const numerator = Math.sqrt(2) * (o + p - 2 * m) * (2 * o - p - m) * (o - 2 * p + m);
  const denominator = 5 * Math.pow(variance, 1.5);
  return numerator / denominator;
}
function calculateTriangleKurtosis(o, m, p) {
  return -6 / 5;
}
// New: Calculate Triangular median
function calculateTriangleMedian(o, m, p) {
  if (m === o || m === p) return m; // Edge case: return mode if equal to min or max
  const c = (m - o) / (p - o);
  if (c <= 0.5) {
    return o + Math.sqrt((p - o) * (m - o) / 2);
  } else {
    return p - Math.sqrt((p - o) * (p - m) / 2);
  }
}
// New: Calculate value at specific confidence level
function calculateTriangleValueAtConfidence(o, m, p, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  if (m === o || m === p) return m; // Edge case
  const c = (m - o) / (p - o);
  const F = confidence; // CDF value
  if (F <= c) {
    return o + Math.sqrt(F * (p - o) * (m - o));
  } else {
    return p - Math.sqrt((1 - F) * (p - o) * (p - m));
  }
}

/* ============================================================================
   🟧 PERT DISTRIBUTION FUNCTIONS
============================================================================ */
function calculatePERTMean(o, m, p) {
  return (o + 4 * m + p) / 6;
}
function calculatePERTVariance(o, m, p) {
  return Math.pow(p - o, 2) / 36;
}
function calculatePERTStdDev(o, m, p) {
  return Math.sqrt(calculatePERTVariance(o, m, p));
}
function calculatePERTSkewness(o, m, p) {
  const variance = calculatePERTVariance(o, m, p);
  if (variance === 0) return 0; // Prevent division by zero
  return (2 * (p - o) * (p + o - 2 * m)) / (5 * Math.pow(p - o, 2));
}
function calculatePERTKurtosis(o, m, p) {
  return -6 / 5;
}
function calculateConservativeEstimate(o, m, p) {
  return (o + 2 * m + 3 * p) / 6;
}
function calculateOptimisticEstimate(o, m, p) {
  return (3 * o + 2 * m + p) / 6;
}
// New: Calculate PERT median (approximated using Beta distribution)
function calculatePERTMedian(o, m, p, alpha, beta) {
  const scaledMedian = jstat.beta.inv(0.5, alpha, beta);
  return o + scaledMedian * (p - o);
}
// New: Calculate PERT value at confidence level
function calculatePERTValueAtConfidence(o, m, p, alpha, beta, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  const scaledValue = jstat.beta.inv(confidence, alpha, beta);
  return o + scaledValue * (p - o);
}

/* ============================================================================
   🟨 BETA DISTRIBUTION FUNCTIONS
============================================================================ */
function calculateAlpha(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
  if (variance === 0) return 1; // Prevent division by zero
  const factor = ((mean - min) * (max - mean)) / variance - 1;
  return factor * ((mean - min) / (max - min));
}
function calculateBeta(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
  if (variance === 0) return 1; // Prevent division by zero
  const factor = ((mean - min) * (max - mean)) / variance - 1;
  return factor * ((max - mean) / (max - min));
}
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) return min;
  const mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}
function calculateBetaMean(alpha, beta, min, max) {
  return min + (alpha / (alpha + beta)) * (max - min);
}
function calculateBetaVariance(alpha, beta, min, max) {
  const range = max - min;
  return (alpha * beta * range * range) / ((Math.pow(alpha + beta, 2) * (alpha + beta + 1)));
}
function calculateBetaStdDev(alpha, beta, min, max) {
  return Math.sqrt(calculateBetaVariance(alpha, beta, min, max));
}
function calculateBetaSkewness(alpha, beta) {
  const num = 2 * (beta - alpha) * Math.sqrt(alpha + beta + 1);
  const den = (alpha + beta + 2) * Math.sqrt(alpha * beta);
  return num / den;
}
function calculateBetaKurtosis(alpha, beta) {
  const num = 6 * (Math.pow(alpha - beta, 2) * (alpha + beta + 1) - alpha * beta * (alpha + beta + 2));
  const den = alpha * beta * (alpha + beta + 2) * (alpha + beta + 3);
  return num / den;
}
function calculateProbExceedPertMeanBeta(pertMean, alpha, beta, min, max) {
  const scaledPertMean = (pertMean - min) / (max - min);
  return 1 - jstat.beta.cdf(scaledPertMean, alpha, beta);
}
// New: Calculate Beta median
function calculateBetaMedian(alpha, beta, min, max) {
  const scaledMedian = jstat.beta.inv(0.5, alpha, beta);
  return min + scaledMedian * (max - min);
}
// New: Calculate Beta value at confidence level
function calculateBetaValueAtConfidence(alpha, beta, min, max, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  const scaledValue = jstat.beta.inv(confidence, alpha, beta);
  return min + scaledValue * (max - min);
}

/* ============================================================================
   🟩 MONTE CARLO SAMPLING + UTILITY
============================================================================ */
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

function performKDE(samples, bandwidth) {
  const n = samples.length;
  const kernel = (x) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
  const density = (x) => {
    return (1 / (n * bandwidth)) * samples.reduce((sum, s) => sum + kernel((x - s) / bandwidth), 0);
  };
  return density;
}

function calculateSmoothedMetrics(samples) {
  const bandwidth = 1.06 * math.std(samples) * Math.pow(samples.length, -1 / 5);
  const density = performKDE(samples, bandwidth);
  const min = math.min(samples);
  const max = math.max(samples);
  const step = (max - min) / 100;
  const xValues = math.range(min, max, step).toArray();
  const smoothedPoints = xValues.map(x => ({ x, y: density(x) }));
  const totalArea = math.sum(smoothedPoints.map(p => p.y * step));
  const normalizedPoints = smoothedPoints.map(p => ({ x: p.x, y: p.y / totalArea }));

  const smoothedMean = math.sum(normalizedPoints.map(p => p.x * p.y * step));
  const smoothedVariance = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 2) * p.y * step));
  const smoothedStdDev = Math.sqrt(smoothedVariance);
  const m3 = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 3) * p.y * step));
  const m4 = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 4) * p.y * step));
  const smoothedSkewness = smoothedVariance > 0 ? m3 / Math.pow(smoothedVariance, 1.5) : 0;
  const smoothedKurtosis = smoothedVariance > 0 ? m4 / Math.pow(smoothedVariance, 2) - 3 : 0;

  let cdf = 0;
  const cdfPoints = normalizedPoints.map(p => {
    cdf += p.y * step;
    return { x: p.x, y: Math.min(cdf, 1), confidence: Math.min(cdf, 1) * 100 };
  });

  const varIndex = cdfPoints.findIndex(p => p.y >= 0.9);
  const smoothedVaR = varIndex > 0 ? cdfPoints[varIndex].x : min;

  const tailPoints = cdfPoints.filter(p => p.y <= 0.1);
  const smoothedCVaR = tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : smoothedVaR;

  const smoothedMAD = calculateMAD(samples, smoothedMean);

  // New: Calculate Monte Carlo smoothed median
  const smoothedMedianIndex = cdfPoints.findIndex(p => p.y >= 0.5);
  const smoothedMedian = smoothedMedianIndex > 0 ? cdfPoints[smoothedMedianIndex].x : smoothedMean;

  return {
    mean: smoothedMean,
    variance: smoothedVariance,
    stdDev: smoothedStdDev,
    skewness: smoothedSkewness,
    kurtosis: smoothedKurtosis,
    var: smoothedVaR,
    cvar: smoothedCVaR,
    mad: smoothedMAD,
    median: smoothedMedian,
    points: normalizedPoints,
    cdfPoints: cdfPoints
  };
}

function calculateProbExceedPertMeanMC(samples, pertMean) {
  return samples.filter(x => x > pertMean).length / samples.length;
}

function calculateValueAtRisk(confLevel, points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confLevel) * sorted.length);
  return sorted[index]?.x || sorted[0]?.x || 0;
}

function calculateConditionalValueAtRisk(confLevel, points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confLevel) * sorted.length);
  const tail = sorted.slice(0, index + 1);
  return tail.length > 0 ? tail.reduce((sum, p) => sum + p.x, 0) / tail.length : sorted[0]?.x || 0;
}

function calculateMAD(samples, median) {
  const deviations = samples.map(x => Math.abs(x - median)).sort((a, b) => a - b);
  const mid = Math.floor(deviations.length / 2);
  return deviations.length % 2 === 0 ? (deviations[mid - 1] + deviations[mid]) / 2 : deviations[mid];
}

// Modified: Enhanced to handle edge cases and generate proper CDF points
function generateDistributionPoints(type, min, mode, max, alpha, beta, samples) {
  if (mode === min || mode === max) {
    // Handle edge case: return single point if mode equals min or max
    return [{ x: mode, y: 1, confidence: 50 }];
  }
  const points = [];
  const step = (max - min) / 100;
  for (let i = 0; i <= 100; i++) {
    const x = min + i * step;
    let y;
    if (type === 'TRIANGLE') {
      if (x < mode) {
        y = 2 * (x - min) / ((max - min) * (mode - min));
      } else if (x === mode) {
        y = 2 / (max - min);
      } else {
        y = 2 * (max - x) / ((max - min) * (max - mode));
      }
      // Compute CDF by integrating PDF
      let cdf;
      if (x < mode) {
        cdf = Math.pow(x - min, 2) / ((max - min) * (mode - min));
      } else if (x === mode) {
        cdf = (mode - min) / (max - min);
      } else {
        cdf = 1 - Math.pow(max - x, 2) / ((max - min) * (max - mode));
      }
      points.push({ x, y: cdf, confidence: cdf * 100 });
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

// New: Generate values at specific confidence levels for all distributions
function generateConfidenceValues(type, min, mode, max, alpha, beta, samples, confidenceLevels = [0.1, 0.5, 0.9]) {
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
    values[`valueAt${Math.round(conf * 100)}Percent`] = value !== null ? value : null;
  }
  return values;
}

/* ============================================================================
   🟩 MONTE CARLO UNSMOOTHED METRICS
============================================================================ */
// New: Calculate Monte Carlo unsmoothed metrics explicitly
function calculateUnsmoothedMetrics(samples) {
  const mean = math.mean(samples);
  const variance = math.variance(samples);
  const stdDev = Math.sqrt(variance);
  const skewness = jstat.skewness(samples);
  const kurtosis = jstat.kurtosis(samples);
  const var90 = calculateValueAtRisk(0.9, samples.map(x => ({ x })));
  const cvar90 = calculateConditionalValueAtRisk(0.9, samples.map(x => ({ x })));
  const mad = calculateMAD(samples, mean);
  // Calculate median
  const sorted = samples.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  return {
    mean,
    variance,
    stdDev,
    skewness,
    kurtosis,
    var90,
    cvar90,
    mad,
    median
  };
}

/* ============================================================================
   🟪 MAIN PROCESS FUNCTION
============================================================================ */
function processTask(task) {
  const { optimistic, mostLikely, pessimistic } = task;
  validateEstimates(optimistic, mostLikely, pessimistic);

  // PERT Calculations (needed for betaAlpha and betaBeta)
  const pertMean = calculatePERTMean(optimistic, mostLikely, pessimistic);
  const pertVariance = calculatePERTVariance(optimistic, mostLikely, pessimistic);
  const pertStdDev = calculatePERTStdDev(optimistic, mostLikely, pessimistic);

  // Beta Distribution Parameters
  const betaAlpha = calculateAlpha(pertMean, pertStdDev, optimistic, pessimistic);
  const betaBeta = calculateBeta(pertMean, pertStdDev, optimistic, pessimistic);

  // Triangle Distribution
  const triangleMean = calculateTriangleMean(optimistic, mostLikely, pessimistic);
  const triangleVariance = calculateTriangleVariance(optimistic, mostLikely, pessimistic);
  const triangleStdDev = calculateTriangleStdDev(optimistic, mostLikely, pessimistic);
  const triangleSkewness = calculateTriangleSkewness(optimistic, mostLikely, pessimistic);
  const triangleKurtosis = calculateTriangleKurtosis(optimistic, mostLikely, pessimistic);
  const triangleMedian = calculateTriangleMedian(optimistic, mostLikely, pessimistic);
  const trianglePoints = generateDistributionPoints('TRIANGLE', optimistic, mostLikely, pessimistic);
  const triangleConfidenceValues = generateConfidenceValues('TRIANGLE', optimistic, mostLikely, pessimistic);

  // PERT Distribution
  const pertSkewness = calculatePERTSkewness(optimistic, mostLikely, pessimistic);
  const pertKurtosis = calculatePERTKurtosis(optimistic, mostLikely, pessimistic);
  const pertMedian = calculatePERTMedian(optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
  const pertPoints = generateDistributionPoints('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
  const weightedConservative = calculateConservativeEstimate(optimistic, mostLikely, pessimistic);
  const weightedOptimistic = calculateOptimisticEstimate(optimistic, mostLikely, pessimistic);
  const weightedNeutral = pertMean; // New: Neutral estimate as PERT mean
  const pertConfidenceValues = generateConfidenceValues('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);

  // Beta Distribution
  const betaMean = calculateBetaMean(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaVariance = calculateBetaVariance(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaStdDev = calculateBetaStdDev(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaSkewness = calculateBetaSkewness(betaAlpha, betaBeta);
  const betaKurtosis = calculateBetaKurtosis(betaAlpha, betaBeta);
  const betaMode = calculateBetaMode(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaMedian = calculateBetaMedian(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaPoints = generateDistributionPoints('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
  const probExceedPertMeanBeta = calculateProbExceedPertMeanBeta(pertMean, betaAlpha, betaBeta, optimistic, pessimistic);
  const betaConfidenceValues = generateConfidenceValues('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);

  // Monte Carlo Simulation
  const mcUnsmoothed = monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, optimistic, pessimistic);
  const mcMetrics = calculateUnsmoothedMetrics(mcUnsmoothed);
  const mcPoints = generateDistributionPoints('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);
  const probExceedPertMeanMCUnsmoothed = calculateProbExceedPertMeanMC(mcUnsmoothed, pertMean);
  const mcConfidenceValues = generateConfidenceValues('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

  const smoothedMC = calculateSmoothedMetrics(mcUnsmoothed);
  const probExceedPertMeanMCSmoothed = calculateProbExceedPertMeanMC(smoothedMC.points.map(p => p.x), pertMean);
  const mcSmoothedConfidenceValues = generateConfidenceValues('MC_SMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

  return {
    task: { value: task.task, description: "Task name" },
    bestCase: { value: optimistic, description: "Optimistic estimate" },
    mostLikely: { value: mostLikely, description: "Most likely estimate" },
    worstCase: { value: pessimistic, description: "Pessimistic estimate" },
    triangleMean: { value: triangleMean, description: "Triangle mean" },
    triangleVariance: { value: triangleVariance, description: "Triangle variance" },
    triangleStdDev: { value: triangleStdDev, description: "Triangle standard deviation" },
    triangleSkewness: { value: triangleSkewness, description: "Triangle skewness" },
    triangleKurtosis: { value: triangleKurtosis, description: "Triangle kurtosis" },
    triangleMedian: { value: triangleMedian, description: "Triangle median" },
    trianglePoints: { value: trianglePoints, description: "Triangle distribution points (CDF)" },
    triangleConfidenceValues: { value: triangleConfidenceValues, description: "Triangle values at 10%, 50%, 90% confidence" },
    pertMean: { value: pertMean, description: "PERT mean" },
    pertVariance: { value: pertVariance, description: "PERT variance" },
    pertStdDev: { value: pertStdDev, description: "PERT standard deviation" },
    pertSkewness: { value: pertSkewness, description: "PERT skewness" },
    pertKurtosis: { value: pertKurtosis, description: "PERT kurtosis" },
    pertMedian: { value: pertMedian, description: "PERT median" },
    pertPoints: { value: pertPoints, description: "PERT distribution points (CDF)" },
    weightedConservative: { value: weightedConservative, description: "Conservative weighted estimate" },
    weightedOptimistic: { value: weightedOptimistic, description: "Optimistic weighted estimate" },
    weightedNeutral: { value: weightedNeutral, description: "Neutral weighted estimate (PERT mean)" },
    pertConfidenceValues: { value: pertConfidenceValues, description: "PERT values at 10%, 50%, 90% confidence" },
    betaMean: { value: betaMean, description: "Beta mean" },
    betaVariance: { value: betaVariance, description: "Beta variance" },
    betaStdDev: { value: betaStdDev, description: "Beta standard deviation" },
    betaSkewness: { value: betaSkewness, description: "Beta skewness" },
    betaKurtosis: { value: betaKurtosis, description: "Beta kurtosis" },
    betaMode: { value: betaMode, description: "Beta mode" },
    betaMedian: { value: betaMedian, description: "Beta median" },
    betaPoints: { value: betaPoints, description: "Beta distribution points (CDF)" },
    probExceedPertMeanBeta: { value: probExceedPertMeanBeta, description: "Probability exceeding PERT mean (Beta)" },
    betaConfidenceValues: { value: betaConfidenceValues, description: "Beta values at 10%, 50%, 90% confidence" },
    mcMean: { value: mcMetrics.mean, description: "Monte Carlo mean" },
    mcVariance: { value: mcMetrics.variance, description: "Monte Carlo variance" },
    mcStdDev: { value: mcMetrics.stdDev, description: "Monte Carlo standard deviation" },
    mcSkewness: { value: mcMetrics.skewness, description: "Monte Carlo skewness" },
    mcKurtosis: { value: mcMetrics.kurtosis, description: "Monte Carlo kurtosis" },
    mcVaR: { value: mcMetrics.var90, description: "Monte Carlo VaR 90%" },
    mcCVaR: { value: mcMetrics.cvar90, description: "Monte Carlo CVaR 90%" },
    mcMAD: { value: mcMetrics.mad, description: "Monte Carlo MAD" },
    mcMedian: { value: mcMetrics.median, description: "Monte Carlo median" },
    mcPoints: { value: mcPoints, description: "Monte Carlo distribution points (CDF)" },
    mcConfidenceValues: { value: mcConfidenceValues, description: "Monte Carlo unsmoothed values at 10%, 50%, 90% confidence" },
    mcSmoothedMean: { value: smoothedMC.mean, description: "Smoothed Monte Carlo mean" },
    mcSmoothedVariance: { value: smoothedMC.variance, description: "Smoothed Monte Carlo variance" },
    mcSmoothedStdDev: { value: smoothedMC.stdDev, description: "Smoothed Monte Carlo standard deviation" },
    mcSmoothedSkewness: { value: smoothedMC.skewness, description: "Smoothed Monte Carlo skewness" },
    mcSmoothedKurtosis: { value: smoothedMC.kurtosis, description: "Smoothed Monte Carlo kurtosis" },
    mcSmoothedVaR: { value: smoothedMC.var, description: "Smoothed Monte Carlo VaR 90%" },
    mcSmoothedCVaR: { value: smoothedMC.cvar, description: "Smoothed Monte Carlo CVaR 90%" },
    mcSmoothedMAD: { value: smoothedMC.mad, description: "Smoothed Monte Carlo MAD" },
    mcSmoothedMedian: { value: smoothedMC.median, description: "Smoothed Monte Carlo median" },
    mcSmoothedPoints: { value: smoothedMC.points, description: "Smoothed Monte Carlo distribution points (density)" },
    mcSmoothedCdfPoints: { value: smoothedMC.cdfPoints, description: "Smoothed Monte Carlo distribution points (CDF)" },
    probExceedPertMeanMCUnsmoothed: { value: probExceedPertMeanMCUnsmoothed, description: "Probability exceeding PERT mean (MC Unsmoothed)" },
    probExceedPertMeanMCSmoothed: { value: probExceedPertMeanMCSmoothed, description: "Probability exceeding PERT mean (MC Smoothed)" },
    mcSmoothedConfidenceValues: { value: mcSmoothedConfidenceValues, description: "Smoothed Monte Carlo values at 10%, 50%, 90% confidence" }
  };
}

/* ============================================================================
   🟪 EXPORT HTTP HANDLER
============================================================================ */
module.exports = {
  pmcEstimatorAPI: functions.http('pmcEstimatorAPI', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(204).send('');
    if (!req.body || !Array.isArray(req.body)) {
      return res.status(400).json({ error: 'Request body must be an array of tasks.' });
    }
    try {
      const results = req.body.map(processTask);
      res.json({ results });
    } catch (err) {
      console.error('Error in pmcEstimatorAPI:', err.stack);
      res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    }
  })
};
