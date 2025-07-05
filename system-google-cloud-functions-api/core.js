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
function calculateTriangleSkewness(o, m, p) {
  const numerator = Math.sqrt(2) * (o + p - 2 * m) * (2 * o - p - m) * (o - 2 * p + m);
  const denominator = 5 * Math.pow(calculateTriangleVariance(o, m, p), 1.5);
  return numerator / denominator;
}
function calculateTriangleKurtosis(o, m, p) {
  return -6 / 5;
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
function calculatePERTSkewness(o, m, p) {
  return (2 * (p - o) * (p + o - 2 * m)) / (5 * Math.pow(p - o, 2));
}
function calculatePERTKurtosis(o, m, p) {
  return -6 / 5;
}

function calculateConservativeEstimate(o, m, p) {
  return (o + 2 * m + 3 * p) / 6; // More weight to pessimistic
}

function calculateOptimisticEstimate(o, m, p) {
  return (3 * o + 2 * m + p) / 6; // More weight to optimistic
}

/* ============================================================================
   🟨 BETA DISTRIBUTION FUNCTIONS
============================================================================ */
function calculateAlpha(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
  const factor = ((mean - min) * (max - mean)) / variance - 1;
  return factor * ((mean - min) / (max - min));
}
function calculateBeta(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
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
  const bandwidth = 1.06 * math.std(samples) * Math.pow(samples.length, -1 / 5); // Silverman's rule
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
  const m3 = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 3) * p.y * step));
  const m4 = math.sum(normalizedPoints.map(p => Math.pow(p.x - smoothedMean, 4) * p.y * step));
  const smoothedSkewness = m3 / Math.pow(smoothedVariance, 1.5);
  const smoothedKurtosis = m4 / Math.pow(smoothedVariance, 2) - 3;

  let cdf = 0;
  const cdfPoints = normalizedPoints.map(p => {
    cdf += p.y * step;
    return { x: p.x, y: cdf };
  });

  const varIndex = cdfPoints.findIndex(p => p.y >= 0.1); // 90% confidence
  const smoothedVaR = varIndex > 0 ? cdfPoints[varIndex].x : min;

  const tailPoints = cdfPoints.filter(p => p.y <= 0.1);
  const smoothedCVaR = tailPoints.length > 0 ? math.mean(tailPoints.map(p => p.x)) : smoothedVaR;

  const smoothedMAD = calculateMAD(samples, smoothedMean);

  return {
    mean: smoothedMean,
    variance: smoothedVariance,
    skewness: smoothedSkewness,
    kurtosis: smoothedKurtosis,
    var: smoothedVaR,
    cvar: smoothedCVaR,
    mad: smoothedMAD,
    points: normalizedPoints
  };
}

function calculateProbExceedPertMeanMC(samples, pertMean) {
  return samples.filter(x => x > pertMean).length / samples.length;
}

function calculateValueAtRisk(confLevel, points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confLevel) * sorted.length);
  return sorted[index].x;
}

function calculateConditionalValueAtRisk(confLevel, points) {
  const sorted = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confLevel) * sorted.length);
  const tail = sorted.slice(0, index + 1);
  return tail.reduce((sum, p) => sum + p.x, 0) / tail.length;
}

function calculateMAD(samples, median) {
  const deviations = samples.map(x => Math.abs(x - median)).sort((a, b) => a - b);
  const mid = Math.floor(deviations.length / 2);
  return deviations.length % 2 === 0 ? (deviations[mid - 1] + deviations[mid]) / 2 : deviations[mid];
}

function generateDistributionPoints(type, min, mode, max, alpha, beta, samples) {
  const points = [];
  for (let p = 1; p <= 100; p++) {
    const percentile = p / 100;
    let x = min + percentile * (max - min);
    let y;
    if (type === 'TRIANGLE') {
      if (x < mode) y = Math.pow(x - min, 2) / ((max - min) * (mode - min));
      else y = 1 - Math.pow(max - x, 2) / ((max - min) * (max - mode));
    } else if (type === 'PERT' || type === 'BETA') {
      y = jstat.beta.cdf((x - min) / (max - min), alpha, beta);
    } else if (type === 'MC_UNSMOOTHED') {
      y = samples.filter(s => s <= x).length / samples.length;
    } else {
      y = 0;
    }
    points.push({ x, y });
  }
  return points;
}

/* ============================================================================
   🟥 MAIN PROCESS FUNCTION
============================================================================ */
function processTask(task) {
  const { optimistic, mostLikely, pessimistic } = task;
  validateEstimates(optimistic, mostLikely, pessimistic);

  // PERT Calculations (needed for betaAlpha and betaBeta)
  const pertMean = calculatePERTMean(optimistic, mostLikely, pessimistic);
  const pertVariance = calculatePERTVariance(optimistic, mostLikely, pessimistic);
  const pertStdDev = Math.sqrt(pertVariance);

  // Beta Distribution Parameters (used in PERT and Beta distributions)
  const betaAlpha = calculateAlpha(pertMean, pertStdDev, optimistic, pessimistic);
  const betaBeta = calculateBeta(pertMean, pertStdDev, optimistic, pessimistic);

  // Triangle Distribution
  const triangleMean = calculateTriangleMean(optimistic, mostLikely, pessimistic);
  const triangleVariance = calculateTriangleVariance(optimistic, mostLikely, pessimistic);
  const triangleSkewness = calculateTriangleSkewness(optimistic, mostLikely, pessimistic);
  const triangleKurtosis = calculateTriangleKurtosis(optimistic, mostLikely, pessimistic);
  const trianglePoints = generateDistributionPoints('TRIANGLE', optimistic, mostLikely, pessimistic);

  // PERT Distribution (uses betaAlpha and betaBeta)
  const pertSkewness = calculatePERTSkewness(optimistic, mostLikely, pessimistic);
  const pertKurtosis = calculatePERTKurtosis(optimistic, mostLikely, pessimistic);
  const pertPoints = generateDistributionPoints('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
  const weightedConservative = calculateConservativeEstimate(optimistic, mostLikely, pessimistic);
  const weightedOptimistic = calculateOptimisticEstimate(optimistic, mostLikely, pessimistic);

  // Beta Distribution
  const betaMean = calculateBetaMean(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaVariance = calculateBetaVariance(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaSkewness = calculateBetaSkewness(betaAlpha, betaBeta);
  const betaKurtosis = calculateBetaKurtosis(betaAlpha, betaBeta);
  const betaMode = calculateBetaMode(betaAlpha, betaBeta, optimistic, pessimistic);
  const betaPoints = generateDistributionPoints('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
  const probExceedPertMeanBeta = calculateProbExceedPertMeanBeta(pertMean, betaAlpha, betaBeta, optimistic, pessimistic);

  // Monte Carlo Simulation
  const mcUnsmoothed = monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, optimistic, pessimistic);
  const mcMean = math.mean(mcUnsmoothed);
  const mcVariance = math.variance(mcUnsmoothed);
  const mcSkewness = jstat.skewness(mcUnsmoothed);
  const mcKurtosis = jstat.kurtosis(mcUnsmoothed);
  const mcVaR = calculateValueAtRisk(0.9, mcUnsmoothed.map(x => ({ x })));
  const mcCVaR = calculateConditionalValueAtRisk(0.9, mcUnsmoothed.map(x => ({ x })));
  const mcMAD = calculateMAD(mcUnsmoothed, mcMean);
  const mcPoints = generateDistributionPoints('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

  const smoothedMC = calculateSmoothedMetrics(mcUnsmoothed);
  const probExceedPertMeanMCUnsmoothed = calculateProbExceedPertMeanMC(mcUnsmoothed, pertMean);
  const probExceedPertMeanMCSmoothed = calculateProbExceedPertMeanMC(smoothedMC.points.map(p => p.x), pertMean);

  return {
    task: { value: task.task, description: "Task name" },
    bestCase: { value: optimistic, description: "Optimistic estimate" },
    mostLikely: { value: mostLikely, description: "Most likely estimate" },
    worstCase: { value: pessimistic, description: "Pessimistic estimate" },
    triangleMean: { value: triangleMean, description: "Triangle mean" },
    triangleVariance: { value: triangleVariance, description: "Triangle variance" },
    triangleSkewness: { value: triangleSkewness, description: "Triangle skewness" },
    triangleKurtosis: { value: triangleKurtosis, description: "Triangle kurtosis" },
    trianglePoints: { value: trianglePoints, description: "Triangle distribution points (CDF)" },
    pertMean: { value: pertMean, description: "PERT mean" },
    pertVariance: { value: pertVariance, description: "PERT variance" },
    pertStdDev: { value: pertStdDev, description: "PERT standard deviation" },
    pertSkewness: { value: pertSkewness, description: "PERT skewness" },
    pertKurtosis: { value: pertKurtosis, description: "PERT kurtosis" },
    pertPoints: { value: pertPoints, description: "PERT distribution points (CDF)" },
    betaMean: { value: betaMean, description: "Beta mean" },
    betaVariance: { value: betaVariance, description: "Beta variance" },
    betaSkewness: { value: betaSkewness, description: "Beta skewness" },
    betaKurtosis: { value: betaKurtosis, description: "Beta kurtosis" },
    betaMode: { value: betaMode, description: "Beta mode" },
    betaPoints: { value: betaPoints, description: "Beta distribution points (CDF)" },
    mcMean: { value: mcMean, description: "Monte Carlo mean" },
    mcVariance: { value: mcVariance, description: "Monte Carlo variance" },
    mcSkewness: { value: mcSkewness, description: "Monte Carlo skewness" },
    mcKurtosis: { value: mcKurtosis, description: "Monte Carlo kurtosis" },
    mcVaR: { value: mcVaR, description: "Monte Carlo VaR 90%" },
    mcCVaR: { value: mcCVaR, description: "Monte Carlo CVaR 90%" },
    mcMAD: { value: mcMAD, description: "Monte Carlo MAD" },
    mcPoints: { value: mcPoints, description: "Monte Carlo distribution points (CDF)" },
    mcSmoothedMean: { value: smoothedMC.mean, description: "Smoothed Monte Carlo mean" },
    mcSmoothedVariance: { value: smoothedMC.variance, description: "Smoothed Monte Carlo variance" },
    mcSmoothedSkewness: { value: smoothedMC.skewness, description: "Smoothed Monte Carlo skewness" },
    mcSmoothedKurtosis: { value: smoothedMC.kurtosis, description: "Smoothed Monte Carlo kurtosis" },
    mcSmoothedVaR: { value: smoothedMC.var, description: "Smoothed Monte Carlo VaR 90%" },
    mcSmoothedCVaR: { value: smoothedMC.cvar, description: "Smoothed Monte Carlo CVaR 90%" },
    mcSmoothedMAD: { value: smoothedMC.mad, description: "Smoothed Monte Carlo MAD" },
    mcSmoothedPoints: { value: smoothedMC.points, description: "Smoothed Monte Carlo distribution points (density)" },
    weightedConservative: { value: weightedConservative, description: "Conservative weighted estimate" },
    weightedOptimistic: { value: weightedOptimistic, description: "Optimistic weighted estimate" },
    probExceedPertMeanBeta: { value: probExceedPertMeanBeta, description: "Probability exceeding PERT mean (Beta)" },
    probExceedPertMeanMCUnsmoothed: { value: probExceedPertMeanMCUnsmoothed, description: "Probability exceeding PERT mean (MC Unsmoothed)" },
    probExceedPertMeanMCSmoothed: { value: probExceedPertMeanMCSmoothed, description: "Probability exceeding PERT mean (MC Smoothed)" }
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
