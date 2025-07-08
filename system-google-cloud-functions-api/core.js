// core.js (Updated to Return Everything as Before)

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
  if (mostLikely === optimistic || mostLikely === pessimistic) {
    console.warn('Edge case: mostLikely equals optimistic or pessimistic, using fallback values');
    return true; // Indicate degenerate case
  }
  return false;
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
  if (variance === 0) return 0;
  const numerator = Math.sqrt(2) * (o + p - 2 * m) * (2 * o - p - m) * (o - 2 * p + m);
  const denominator = 5 * Math.pow(variance, 1.5);
  return numerator / denominator;
}

function calculateTriangleKurtosis(o, m, p) {
  return -6 / 5;
}

function calculateTriangleMedian(o, m, p) {
  if (m === o || m === p) return m;
  const c = (m - o) / (p - o);
  if (c <= 0.5) {
    return o + Math.sqrt((p - o) * (m - o) / 2);
  } else {
    return p - Math.sqrt((p - o) * (p - m) / 2);
  }
}

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

function calculateTriangleConfidenceInterval(mean, stdDev, sampleSize = 1000) {
  const z = 1.96; // 95% confidence
  const se = stdDev / Math.sqrt(sampleSize);
  return { lower: mean - z * se, upper: mean + z * se };
}

function calculateTriangleCoefficientOfVariation(mean, stdDev) {
  return mean !== 0 ? stdDev / mean : 0;
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
  if (variance === 0) return 0;
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

function calculatePERTMedian(o, m, p, alpha, beta) {
  const scaledMedian = jstat.beta.inv(0.5, alpha, beta);
  return o + scaledMedian * (p - o);
}

function calculatePERTValueAtConfidence(o, m, p, alpha, beta, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  const scaledValue = jstat.beta.inv(confidence, alpha, beta);
  return o + scaledValue * (p - o);
}

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

function calculatePERTConfidenceInterval(mean, stdDev, sampleSize = 1000) {
  const z = 1.96;
  const se = stdDev / Math.sqrt(sampleSize);
  return { lower: mean - z * se, upper: mean + z * se };
}

function calculatePERTCoefficientOfVariation(mean, stdDev) {
  return mean !== 0 ? stdDev / mean : 0;
}

/* ============================================================================
   🟨 BETA DISTRIBUTION FUNCTIONS
============================================================================ */
function calculateAlpha(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
  if (variance < 1e-10) return 1;
  const factor = ((mean - min) * (max - mean)) / variance - 1;
  return Math.max(1, factor * ((mean - min) / (max - min)));
}

function calculateBeta(mean, stdDev, min, max) {
  const variance = stdDev * stdDev;
  if (variance < 1e-10) return 1;
  const factor = ((mean - min) * (max - mean)) / variance - 1;
  return Math.max(1, factor * ((max - mean) / (max - min)));
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

function calculateBetaMedian(alpha, beta, min, max) {
  const scaledMedian = jstat.beta.inv(0.5, alpha, beta);
  return min + scaledMedian * (max - min);
}

function calculateBetaValueAtConfidence(alpha, beta, min, max, confidence) {
  if (confidence < 0 || confidence > 1) return null;
  const scaledValue = jstat.beta.inv(confidence, alpha, beta);
  return min + scaledValue * (max - min);
}

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

function calculateBetaConfidenceInterval(mean, stdDev, sampleSize = 1000) {
  const z = 1.96;
  const se = stdDev / Math.sqrt(sampleSize);
  return { lower: mean - z * se, upper: mean + z * se };
}

function calculateBetaCoefficientOfVariation(mean, stdDev) {
  return mean !== 0 ? stdDev / mean : 0;
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

  const smoothedMAD = calculateMAD(samples, smoothedMean);

  const smoothedMedianIndex = cdfPoints.findIndex(p => p.y >= 0.5);
  const smoothedMedian = smoothedMedianIndex > 0 ? cdfPoints[smoothedMedianIndex].x : smoothedMean;

  return {
    mean: smoothedMean,
    variance: smoothedVariance,
    stdDev: smoothedStdDev,
    skewness: smoothedSkewness,
    kurtosis: smoothedKurtosis,
    var90: smoothedVaR90,
    var95: smoothedVaR95,
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
      if (x < mode) {
        y = Math.pow(x - min, 2) / ((max - min) * (mode - min));
      } else if (x === mode) {
        y = (mode - min) / (max - min);
      } else {
        y = 1 - Math.pow(max - x, 2) / ((max - min) * (max - mode));
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
   🟪 ADDITIONAL FUNCTIONS FOR SINGLE TASK WITH SLIDERS
============================================================================ */
// These functions need to be implemented based on your original `core.js` logic
function computeOriginalCdfPoints(task) {
  // Placeholder: Compute original CDF points based on task estimates
  // Example: Use Triangle or PERT distribution points
  const { optimistic, mostLikely, pessimistic } = task;
  return calculateTrianglePdfPoints(optimistic, mostLikely, pessimistic); // Replace with your original logic
}

function computeOptimizedCdfPoints(task, budgetFlex, scheduleFlex, scopeUncert, riskTol, targetValue) {
  // Placeholder: Compute optimized CDF points adjusting for sliders and target value
  const { optimistic, mostLikely, pessimistic } = task;
  // Example adjustment (implement your logic here)
  const adjustedOptimistic = optimistic * (1 - budgetFlex);
  const adjustedPessimistic = pessimistic * (1 + scheduleFlex);
  return calculateTrianglePdfPoints(adjustedOptimistic, mostLikely, adjustedPessimistic); // Replace with your original logic
}

function computeCombinationExplorerData(task, targetValue) {
  // Placeholder: Compute data for exploring combinations
  const { optimistic, mostLikely, pessimistic } = task;
  return generateDistributionPoints('PERT', optimistic, mostLikely, pessimistic, 4, 4, null); // Replace with your original logic
}

function computeAnalysisReportData(task, budgetFlex, scheduleFlex, scopeUncert, riskTol, targetValue) {
  // Placeholder: Compute analysis report data
  return {
    riskAssessment: `Risk tolerance: ${riskTol}`,
    targetFeasibility: targetValue <= pessimistic ? "Feasible" : "Challenging"
  }; // Replace with your original logic
}

/* ============================================================================
   🟪 MAIN PROCESS FUNCTION
============================================================================ */
function processTask(task) {
  try {
    const { optimistic, mostLikely, pessimistic } = task;
    const isDegenerate = validateEstimates(optimistic, mostLikely, pessimistic);

    // PERT Calculations
    const pertMean = isDegenerate ? mostLikely : calculatePERTMean(optimistic, mostLikely, pessimistic);
    const pertVariance = isDegenerate ? 0 : calculatePERTVariance(optimistic, mostLikely, pessimistic);
    const pertStdDev = isDegenerate ? 0 : calculatePERTStdDev(optimistic, mostLikely, pessimistic);

    // Beta Parameters
    const betaAlpha = isDegenerate ? 1 : Math.max(1, calculateAlpha(pertMean, pertStdDev, optimistic, pessimistic));
    const betaBeta = isDegenerate ? 1 : Math.max(1, calculateBeta(pertMean, pertStdDev, optimistic, pessimistic));

    // Triangle Distribution
    const triangleMean = isDegenerate ? mostLikely : calculateTriangleMean(optimistic, mostLikely, pessimistic);
    const triangleVariance = isDegenerate ? 0 : calculateTriangleVariance(optimistic, mostLikely, pessimistic);
    const triangleStdDev = isDegenerate ? 0 : calculateTriangleStdDev(optimistic, mostLikely, pessimistic);
    const triangleSkewness = isDegenerate ? 0 : calculateTriangleSkewness(optimistic, mostLikely, pessimistic);
    const triangleKurtosis = calculateTriangleKurtosis(optimistic, mostLikely, pessimistic);
    const triangleMedian = isDegenerate ? mostLikely : calculateTriangleMedian(optimistic, mostLikely, pessimistic);
    const trianglePoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null);
    const trianglePdfPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateTrianglePdfPoints(optimistic, mostLikely, pessimistic);
    const triangleConfidenceValues = isDegenerate ? { valueAt50Percent: mostLikely } : generateConfidenceValues('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null);

    // PERT Distribution
    const pertSkewness = isDegenerate ? 0 : calculatePERTSkewness(optimistic, mostLikely, pessimistic);
    const pertKurtosis = calculatePERTKurtosis(optimistic, mostLikely, pessimistic);
    const pertMedian = isDegenerate ? mostLikely : calculatePERTMedian(optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
    const pertPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null);
    const pertPdfPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculatePERTPdfPoints(optimistic, mostLikely, pessimistic, betaAlpha, betaBeta);
    const weightedConservative = isDegenerate ? mostLikely : calculateConservativeEstimate(optimistic, mostLikely, pessimistic);
    const weightedOptimistic = isDegenerate ? mostLikely : calculateOptimisticEstimate(optimistic, mostLikely, pessimistic);
    const pertConfidenceValues = isDegenerate ? { valueAt50Percent: mostLikely } : generateConfidenceValues('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null);

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
    const betaConfidenceValues = isDegenerate ? { valueAt50Percent: mostLikely } : generateConfidenceValues('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null);

    // Monte Carlo Simulation
    const mcUnsmoothed = isDegenerate ? Array(1000).fill(mostLikely) : monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, optimistic, pessimistic);
    const smoothedMC = calculateSmoothedMetrics(mcUnsmoothed);
    const mcPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);
    const mcConfidenceValues = isDegenerate ? { valueAt50Percent: mostLikely } : generateConfidenceValues('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

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
      trianglePdfPoints: { value: trianglePdfPoints, description: "Triangle distribution points (PDF)" },
      triangleConfidenceValues: { value: triangleConfidenceValues, description: "Triangle confidence values" },
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
      pertConfidenceValues: { value: pertConfidenceValues, description: "PERT confidence values" },
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
      betaConfidenceValues: { value: betaConfidenceValues, description: "Beta confidence values" },
      mcSmoothedMean: { value: smoothedMC.mean, description: "Smoothed Monte Carlo mean" },
      mcSmoothedStdDev: { value: smoothedMC.stdDev, description: "Smoothed Monte Carlo standard deviation" },
      mcSmoothedMedian: { value: smoothedMC.median, description: "Smoothed Monte Carlo median" },
      mcSmoothedPoints: { value: smoothedMC.points, description: "Smoothed Monte Carlo distribution points" },
      mcSmoothedCdfPoints: { value: smoothedMC.cdfPoints, description: "Smoothed Monte Carlo CDF points" },
      mcPoints: { value: mcPoints, description: "Monte Carlo unsmoothed points" },
      mcConfidenceValues: { value: mcConfidenceValues, description: "Monte Carlo confidence values" }
    };
  } catch (err) {
    console.error(`Error processing task ${task.task}:`, err);
    throw new Error(`Failed to process task: ${err.message}`);
  }
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
    if (!req.body) {
      return res.status(400).json({ error: 'Request body is required.' });
    }
    try {
      console.log('Input request:', JSON.stringify(req.body));
      if (req.body.task && req.body.sliders && req.body.targetValue) {
        // Handle single task with sliders and target value
        const { task, sliders, targetValue } = req.body;
        const baseData = processTask(task);
        const originalCdfPoints = computeOriginalCdfPoints(task);
        const optimizedCdfPoints = computeOptimizedCdfPoints(task, sliders.budgetFlex, sliders.scheduleFlex, sliders.scopeUncert, sliders.riskTol, targetValue);
        const combinationExplorerData = computeCombinationExplorerData(task, targetValue);
        const analysisReportData = computeAnalysisReportData(task, sliders.budgetFlex, sliders.scheduleFlex, sliders.scopeUncert, sliders.riskTol, targetValue);
        const response = {
          ...baseData,
          originalCdfPoints: { value: originalCdfPoints, description: "Original CDF points" },
          optimizedCdfPoints: { value: optimizedCdfPoints, description: "Optimized CDF points" },
          combinationExplorerData: { value: combinationExplorerData, description: "Combination explorer data" },
          analysisReportData: { value: analysisReportData, description: "Analysis report data" }
        };
        console.log('Output response (single task):', JSON.stringify(response));
        res.json(response);
      } else if (Array.isArray(req.body)) {
        // Handle array of tasks
        const results = req.body.map(task => {
          try {
            return processTask(task);
          } catch (err) {
            return { error: `Failed to process task ${task.task}: ${err.message}` };
          }
        });
        console.log('Output results (array):', JSON.stringify(results));
        res.json({ results });
      } else {
        res.status(400).json({ error: 'Invalid request body. Must be an array of tasks or a single task with sliders and targetValue.' });
      }
    } catch (err) {
      console.error('Error in pmcEstimatorAPI:', err.stack);
      res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    }
  })
};
