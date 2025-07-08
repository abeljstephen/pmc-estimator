// core.js (Updated with Option 1 for Target Probability, All 76 Fields, and New Target Probability Functions)
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

function calculateMedian(numbers) {
  const sorted = numbers.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
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
    throwContainerError('Cannot calculate smoothed metrics: samples array is empty');
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

function calculateTargetProbabilityPoints(min, max, mean, targets = [mean * 0.9, mean, mean * 1.1]) {
  const points = [];
  for (const target of targets) {
    const prob = jstat.beta.cdf((target - min) / (max - min), 4, 4);
    points.push({ x: target, y: prob, confidence: prob * 100 });
  }
  return points;
}

function calculateProbExceedTargets(type, min, mode, max, alpha, beta, samples, targets) {
  const probs = {};
  for (const target of targets) {
    let prob;
    if (type === 'TRIANGLE') {
      const c = (mode - min) / (max - min);
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

function calculateKLDivergence(points1, points2, step) {
  let kl = 0;
  for (let i = 0; i < points1.length; i++) {
    const p1 = points1[i].y || 1e-10;
    const p2 = points2[i].y || 1e-10;
    kl += p1 * Math.log(p1 / p2) * step;
  }
  return kl;
}

function calculateSensitivity(mean, stdDev, min, max, variation = 0.1) {
  const variedMin = min * (1 - variation);
  const variedMax = max * (1 + variation);
  const variedMean = calculateTriangleMean(variedMin, mean, variedMax);
  return { originalMean: mean, variedMean, change: variedMean - mean };
}

function adjustDistributionPoints(points, sliderValues) {
  const { budgetFlexibility, scheduleFlexibility, scopeCertainty, riskTolerance } = sliderValues;
  
  const bfDelta = (budgetFlexibility - 50) / 100;
  const sfDelta = (scheduleFlexibility - 50) / 100;
  const scDelta = (scopeCertainty - 50) / 100; // Higher certainty reduces variance
  const rtDelta = (riskTolerance - 50) / 100;
  
  const meanShift = -0.1 * (bfDelta + sfDelta);
  const varianceScale = 1 + 0.2 * (rtDelta - scDelta); // Risk increases variance, certainty decreases it
  
  const mean = math.mean(points.map(p => p.x));
  
  return points.map(p => {
    const adjustedX = mean + meanShift + Math.sqrt(varianceScale) * (p.x - mean);
    const adjustedY = p.y / varianceScale; // Approximate adjustment for density
    return { x: adjustedX, y: adjustedY, confidence: p.confidence };
  });
}

function calculateOptimizedMetrics(originalPoints, adjustedPoints) {
  const originalMedian = originalPoints.find(p => p.confidence >= 50)?.x || math.median(originalPoints.map(p => p.x));
  const optimizedMedian = adjustedPoints.find(p => p.confidence >= 50)?.x || math.median(adjustedPoints.map(p => p.x));
  const step = (originalPoints[1]?.x - originalPoints[0]?.x) || 1;
  const newConfidence = adjustedPoints.reduce((sum, p) => sum + p.y * step * (p.x >= optimizedMedian ? 1 : 0), 0) * 100;

  return { originalMedian, optimizedMedian, newConfidence };
}

function adjustCdfPoints(originalCdfPoints, originalMean, originalStdDev, sliderValues) {
  const { budgetFlexibility, scheduleFlexibility, scopeCertainty, riskTolerance } = sliderValues;
  
  // Normalize slider values from 0-100 to 0-1
  const bf = budgetFlexibility / 100;
  const sf = scheduleFlexibility / 100;
  const sc = scopeCertainty / 100;
  const rt = riskTolerance / 100;
  
  // Calculate mean shift: all factors shift mean favorably (to the left, hence negative), scaled by stdDev
  const meanShift = -0.5 * (bf + sf + sc + rt) * originalStdDev;
  
  // Calculate variance scale: scope certainty reduces variance, risk tolerance increases it, flexibility reduces it
  const varianceScale = 1 + 2.0 * (1 - sc) + 1.0 * rt - 0.5 * (bf + sf);
  const stdDevScale = Math.sqrt(Math.max(0.1, varianceScale)); // Clamp to prevent collapse
  
  // Location-scale transformation parameters
  const a = meanShift + originalMean * (1 - stdDevScale);
  const b = stdDevScale;
  
  // Adjust CDF points: transform x values, keep y (cumulative probability) unchanged
  return originalCdfPoints.map(p => {
    const adjustedX = a + b * p.x;
    return { x: adjustedX, y: p.y, confidence: p.confidence };
  });
}

function adjustDistributionPoints(points, originalMean, originalStdDev, sliderValues) {
  const { budgetFlexibility, scheduleFlexibility, scopeCertainty, riskTolerance } = sliderValues;
  
  // Normalize slider values from 0-100 to 0-1
  const bf = budgetFlexibility / 100;
  const sf = scheduleFlexibility / 100;
  const sc = scopeCertainty / 100;
  const rt = riskTolerance / 100;
  
  // Calculate mean shift: consistent with adjustCdfPoints
  const meanShift = -0.5 * (bf + sf + sc + rt) * originalStdDev;
  
  // Calculate variance scale: consistent with adjustCdfPoints
  const varianceScale = 1 + 2.0 * (1 - sc) + 1.0 * rt - 0.5 * (bf + sf); 
  const stdDevScale = Math.sqrt(Math.max(0.1, varianceScale));
  
  // Location-scale transformation parameters
  const a = meanShift + originalMean * (1 - stdDevScale);
  const b = stdDevScale;
  
  // Adjust PDF points: transform x and scale y (density) by 1/b
  return points.map(p => {
    const adjustedX = a + b * p.x;
    const adjustedY = p.y / b; // Correct density adjustment
    return { x: adjustedX, y: adjustedY, confidence: p.confidence };
  });
}


function calculateUnsmoothedMetrics(samples) {
  const mean = math.mean(samples);
  const variance = math.variance(samples);
  const stdDev = Math.sqrt(variance);
  const skewness = jstat.skewness(samples);
  const kurtosis = jstat.kurtosis(samples);
  const var90 = calculateValueAtRisk(0.9, samples.map(x => ({ x })));
  const var95 = calculateValueAtRisk(0.95, samples.map(x => ({ x })));
  const cvar90 = calculateConditionalValueAtRisk(0.9, samples.map(x => ({ x })));
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
    mad,
    median,
    confidenceInterval,
    coefficientOfVariation
  };
}

/* ============================================================================
   🟪 TARGET PROBABILITY FUNCTIONS
============================================================================ */

/**
 * Generates a textual description of the dynamic outcome based on slider settings and probabilities.
 * @param {number} bf - Budget Flexibility (0 to 1)
 * @param {number} sf - Schedule Flexibility (0 to 1)
 * @param {number} sc - Scope Certainty (0 to 1)
 * @param {number} rt - Risk Tolerance (0 to 1)
 * @param {number} origProb - Original probability
 * @param {number} optProb - Optimized probability
 * @param {number} targetValue - Target value for probability computation
 * @param {number} originalMean - Original mean of the distribution
 * @param {number} originalStdDev - Original standard deviation of the distribution
 * @returns {string} Description of the outcome
 */
function generateDynamicOutcome(bf, sf, sc, rt, origProb, optProb, targetValue, originalMean, originalStdDev) {
  const meanShift = 0.2 * originalStdDev * (-bf - sf + 0.5 * (1 - sc)); // Adjusted for scope certainty
  const varianceScale = 1 + 2.0 * (1 - sc); // Higher certainty reduces variance
  const skewAdjustment = -0.05 * rt + 0.2 * (1 - sc);
  const probChange = optProb - origProb;
  const isBelowMean = targetValue < originalMean - 0.5 * originalStdDev;

  let outcome = `With BF=${(bf * 100).toFixed(0)}%, SF=${(sf * 100).toFixed(0)}%, SC=${(sc * 100).toFixed(0)}%, RT=${(rt * 100).toFixed(0)}%, `;

  if (probChange > 0) {
    outcome += `Opt Prob increases by ${(probChange * 100).toFixed(1)}% to ${(optProb * 100).toFixed(1)}%. `;
  } else if (probChange < 0) {
    outcome += `Opt Prob decreases by ${(-probChange * 100).toFixed(1)}% to ${(optProb * 100).toFixed(1)}%. `;
  } else {
    outcome += `Opt Prob remains at ${(optProb * 100).toFixed(1)}%. `;
  }

  if (meanShift > 0) {
    outcome += `Mean shifts right by ${meanShift.toFixed(2)}, `;
  } else if (meanShift < 0) {
    outcome += `Mean shifts left by ${(-meanShift).toFixed(2)}, `;
  } else {
    outcome += `Mean unchanged, `;
  }

  if (varianceScale > 1) {
    outcome += `variance increases by ${(varianceScale - 1).toFixed(2)}, `;
  } else if (varianceScale < 1) {
    outcome += `variance decreases by ${(1 - varianceScale).toFixed(2)}, `;
  } else {
    outcome += `variance unchanged, `;
  }

  if (skewAdjustment > 0) {
    outcome += `skew increases by ${skewAdjustment.toFixed(2)}.`;
  } else if (skewAdjustment < 0) {
    outcome += `skew decreases by ${(-skewAdjustment).toFixed(2)}.`;
  } else {
    outcome += `skew unchanged.`;
  }

  if (isBelowMean) {
    outcome += ` Target is below mean, so probability is higher.`;
  } else {
    outcome += ` Target is above mean, so probability is lower.`;
  }

  return outcome;
}

/**
 * Generates a scenario summary string based on slider values, ordering them by magnitude.
 * @param {number} bf - Budget Flexibility value (0 to 100)
 * @param {number} sf - Schedule Flexibility value (0 to 100)
 * @param {number} sc - Scope Certainty value (0 to 100)
 * @param {number} rt - Risk Tolerance value (0 to 100)
 * @returns {string} Scenario summary string (e.g., "BF = SF < SC = RT")
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
 * Computes outcomes for all possible slider combinations.
 * @param {Array} originalCdfPoints - Original CDF points from the distribution
 * @param {number} targetValue - Target value for probability computation
 * @param {number} originalMean - Original mean of the distribution
 * @param {number} originalStdDev - Original standard deviation of the distribution
 * @param {Array} originalPoints - Original distribution points (PDF)
 * @returns {Array} Array of combination objects with slider settings, probabilities, and outcomes
 */
function computeSliderCombinations(originalCdfPoints, targetValue, originalMean, originalStdDev, originalPoints) {
  const sliderSteps = [0, 25, 50, 75, 100];
  const combinations = [];
  const origProb = originalCdfPoints.find(p => p.x >= targetValue)?.y || 1;

  for (const bf of sliderSteps) {
    for (const sf of sliderSteps) {
      for (const sc of sliderSteps) {
        for (const rt of sliderSteps) {
          const sliderValues = {
            budgetFlexibility: bf,
            scheduleFlexibility: sf,
            scopeCertainty: sc,
            riskTolerance: rt
          };
          const adjustedPoints = adjustDistributionPoints(originalPoints, originalMean, originalStdDev, sliderValues);
          let cdf = 0;
          const step = (adjustedPoints[1]?.x - adjustedPoints[0]?.x) || 1;
          const cdfPoints = adjustedPoints.map(p => {
            cdf += p.y * step;
            return { x: p.x, y: Math.min(cdf, 1) };
          });
          const optProb = cdfPoints.find(p => p.x >= targetValue)?.y || 1;
          const outcome = generateDynamicOutcome(
            bf / 100,
            sf / 100,
            sc / 100,
            rt / 100,
            origProb,
            optProb,
            targetValue,
            originalMean,
            originalStdDev
          );
          const scenarioSummary = getScenarioSummary(bf, sf, sc, rt);
          combinations.push({
            bf,
            sf,
            sc,
            rt,
            origProb,
            optProb,
            scenarioSummary,
            expectedOutcome: outcome
          });
        }
      }
    }
  }
  return combinations;
}
/* ============================================================================
   🟪 MAIN PROCESS FUNCTION
============================================================================ */
function processTask({ task, optimistic, mostLikely, pessimistic, sliderValues, targetValue }) {
  try {
    const defaultSliders = {
      budgetFlexibility: 50,
      scheduleFlexibility: 50,
      scopeCertainty: 50,
      riskTolerance: 50
    };
    const effectiveSliders = sliderValues ? { ...defaultSliders, ...sliderValues } : defaultSliders;
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
    const triangleConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null);
    const triangleConfidenceInterval = isDegenerate ? { lower: mostLikely, upper: mostLikely } : calculateTriangleConfidenceInterval(triangleMean, triangleStdDev);
    const triangleCoefficientOfVariation = isDegenerate ? 0 : calculateTriangleCoefficientOfVariation(triangleMean, triangleStdDev);
    const triangleSensitivity = isDegenerate ? { originalMean: mostLikely, variedMean: mostLikely, change: 0 } : calculateSensitivity(triangleMean, triangleStdDev, optimistic, pessimistic);

    // PERT Distribution
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

    // Monte Carlo Simulation
    const mcUnsmoothed = isDegenerate ? Array(1000).fill(mostLikely) : monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, optimistic, pessimistic);
    const mcMetrics = calculateUnsmoothedMetrics(mcUnsmoothed);
    const mcPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : generateDistributionPoints('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);
    const mcRawPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateMonteCarloRawPoints(mcUnsmoothed, optimistic, pessimistic);
    const probExceedPertMeanMCUnsmoothed = isDegenerate ? 0 : calculateProbExceedPertMeanMC(mcUnsmoothed, pertMean);
    const mcConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

    const smoothedMC = calculateSmoothedMetrics(mcUnsmoothed);
    const probExceedPertMeanMCSmoothed = isDegenerate ? 0 : calculateProbExceedPertMeanMC(smoothedMC.points.map(p => p.x), pertMean);
    const mcSmoothedConfidenceValues = isDegenerate ? { valueAt5Percent: mostLikely, valueAt10Percent: mostLikely, valueAt25Percent: mostLikely, valueAt50Percent: mostLikely, valueAt75Percent: mostLikely, valueAt90Percent: mostLikely, valueAt95Percent: mostLikely, valueAt99Percent: mostLikely } : generateConfidenceValues('MC_SMOOTHED', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, mcUnsmoothed);

    // Additional Calculations
    const probExceedTargetsTriangle = isDegenerate ? {} : calculateProbExceedTargets('TRIANGLE', optimistic, mostLikely, pessimistic, null, null, null, [triangleMean, mostLikely, pertMean]);
    const probExceedTargetsPERT = isDegenerate ? {} : calculateProbExceedTargets('PERT', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null, [triangleMean, mostLikely, pertMean]);
    const probExceedTargetsBeta = isDegenerate ? {} : calculateProbExceedTargets('BETA', optimistic, mostLikely, pessimistic, betaAlpha, betaBeta, null, [triangleMean, mostLikely, pertMean]);
    const probExceedTargetsMC = isDegenerate ? {} : calculateProbExceedTargets('MC_UNSMOOTHED', optimistic, mostLikely, pessimistic, null, null, mcUnsmoothed, [triangleMean, mostLikely, pertMean]);
    const klDivergenceTrianglePERT = isDegenerate ? 0 : calculateKLDivergence(trianglePoints, pertPoints, (pessimistic - optimistic) / 100);

    // Decision Optimizer and Target Probability Enhancements
    const decisionOptimizerPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateDecisionOptimizerPoints(trianglePoints, pertPoints, betaPoints, smoothedMC.points);
    const decisionOptimizerOriginalPoints = smoothedMC.points;
    const decisionOptimizerAdjustedPoints = adjustDistributionPoints(decisionOptimizerOriginalPoints, effectiveSliders);
    const decisionOptimizerMetrics = calculateOptimizedMetrics(decisionOptimizerOriginalPoints, decisionOptimizerAdjustedPoints);
    const targetProbabilityPoints = isDegenerate ? [{ x: mostLikely, y: 1, confidence: 50 }] : calculateTargetProbabilityPoints(optimistic, pessimistic, triangleMean);
    const targetProbabilityOriginalCdf = smoothedMC.cdfPoints;
    const targetProbabilityOptimizedCdf = adjustCdfPoints(targetProbabilityOriginalCdf, smoothedMC.mean, smoothedMC.stdDev, effectiveSliders);

    // Compute Slider Combinations if targetValue is provided
    let sliderCombinations = null;
    if (targetValue !== undefined) {
      sliderCombinations = computeSliderCombinations(
        targetProbabilityOriginalCdf,
        targetValue,
        smoothedMC.mean,
        smoothedMC.stdDev,
        decisionOptimizerOriginalPoints
      );
    }

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
      probExceedTargetsBeta: { value: probExceedTargetsBeta, description: "Beta probabilities of exceeding key targets" },
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
      mcRawPoints: { value: mcRawPoints, description: "Monte Carlo raw histogram points" },
      mcConfidenceValues: { value: mcConfidenceValues, description: "Monte Carlo unsmoothed values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" },
      mcSmoothedMean: { value: smoothedMC.mean, description: "Smoothed Monte Carlo mean" },
      mcSmoothedVariance: { value: smoothedMC.variance, description: "Smoothed Monte Carlo variance" },
      mcSmoothedStdDev: { value: smoothedMC.stdDev, description: "Smoothed Monte Carlo standard deviation" },
      mcSmoothedSkewness: { value: smoothedMC.skewness, description: "Smoothed Monte Carlo skewness" },
      mcSmoothedKurtosis: { value: smoothedMC.kurtosis, description: "Smoothed Monte Carlo kurtosis" },
      mcSmoothedVaR: { value: smoothedMC.var90, description: "Smoothed Monte Carlo VaR 90%" },
      mcSmoothedCVaR: { value: smoothedMC.cvar, description: "Smoothed Monte Carlo CVaR 90%" },
      mcSmoothedMAD: { value: smoothedMC.mad, description: "Smoothed Monte Carlo MAD" },
      mcSmoothedMedian: { value: smoothedMC.median, description: "Smoothed Monte Carlo median" },
      mcSmoothedPoints: { value: smoothedMC.points, description: "Smoothed Monte Carlo distribution points (density)" },
      mcSmoothedCdfPoints: { value: smoothedMC.cdfPoints, description: "Smoothed Monte Carlo distribution points (CDF)" },
      mcSmoothedConfidenceValues: { value: mcSmoothedConfidenceValues, description: "Smoothed Monte Carlo values at 5%, 10%, 25%, 50%, 75%, 90%, 95%, 99% confidence" },
      probExceedPertMeanMCUnsmoothed: { value: probExceedPertMeanMCUnsmoothed, description: "Probability exceeding PERT mean (MC Unsmoothed)" },
      probExceedPertMeanMCSmoothed: { value: probExceedPertMeanMCSmoothed, description: "Probability exceeding PERT mean (MC Smoothed)" },
      probExceedTargetsMC: { value: probExceedTargetsMC, description: "Monte Carlo probabilities of exceeding key targets" },
      klDivergenceTrianglePERT: { value: klDivergenceTrianglePERT, description: "KL Divergence between Triangle and PERT distributions" },
      decisionOptimizerPoints: { value: decisionOptimizerPoints, description: "Decision Optimizer aggregated points" },
      decisionOptimizerOriginalPoints: { value: decisionOptimizerOriginalPoints, description: "Decision Optimizer original distribution points" },
      decisionOptimizerAdjustedPoints: { value: decisionOptimizerAdjustedPoints, description: "Decision Optimizer adjusted distribution points based on sliders" },
      decisionOptimizerMetrics: { value: decisionOptimizerMetrics, description: "Decision Optimizer metrics (originalMedian, optimizedMedian, newConfidence)" },
      targetProbabilityPoints: { value: targetProbabilityPoints, description: "Target Probability points for specified values" },
      targetProbabilityOriginalCdf: { value: targetProbabilityOriginalCdf, description: "Target Probability original CDF points" },
      targetProbabilityOptimizedCdf: { value: targetProbabilityOptimizedCdf, description: "Target Probability optimized CDF points based on sliders" },
      sliderCombinations: sliderCombinations ? { value: sliderCombinations, description: "Slider combinations with probabilities and outcomes" } : undefined
    };
  } catch (err) {
    console.error(`Error processing task ${task}:`, err);
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
      if (req.body.task && req.body.sliderValues && req.body.targetValue) {
        // Handle single task with sliders and target value
        const { task, sliderValues, targetValue, targetProbabilityOnly = false } = req.body;
        const baseData = processTask({
          task: task.task,
          optimistic: task.optimistic,
          mostLikely: task.mostLikely,
          pessimistic: task.pessimistic,
          sliderValues,
          targetValue
        });
        const targetProbabilityPoints = calculateTargetProbabilityPoints(
          task.optimistic,
          task.pessimistic,
          baseData.triangleMean.value,
          [targetValue, baseData.triangleMean.value, baseData.pertMean.value]
        );
        const response = targetProbabilityOnly
          ? {
              task: baseData.task,
              targetProbabilityPoints: { value: targetProbabilityPoints, description: "Target Probability points for specified values" },
              targetProbabilityOriginalCdf: baseData.targetProbabilityOriginalCdf,
              targetProbabilityOptimizedCdf: baseData.targetProbabilityOptimizedCdf,
              decisionOptimizerPoints: baseData.decisionOptimizerPoints,
              decisionOptimizerOriginalPoints: baseData.decisionOptimizerOriginalPoints,
              decisionOptimizerAdjustedPoints: baseData.decisionOptimizerAdjustedPoints,
              decisionOptimizerMetrics: baseData.decisionOptimizerMetrics,
              sliderCombinations: baseData.sliderCombinations
            }
          : {
              ...baseData,
              targetProbabilityPoints: { value: targetProbabilityPoints, description: "Target Probability points for specified values" }
            };
        console.log('Output response (single task):', JSON.stringify(response));
        res.json(response);
      } else if (Array.isArray(req.body)) {
        // Handle array of tasks
        const results = req.body.map(task => {
          try {
            return processTask({
              task: task.task,
              optimistic: task.optimistic,
              mostLikely: task.mostLikely,
              pessimistic: task.pessimistic,
              sliderValues: task.sliderValues,
              targetValue: task.targetValue
            });
          } catch (err) {
            return { error: `Failed to process task ${task.task}: ${err.message}` };
          }
        });
        console.log('Output results (array):', JSON.stringify(results));
        res.json({ results });
      } else {
        res.status(400).json({ error: 'Invalid request body. Must be an array of tasks or a single task with sliderValues and targetValue.' });
      }
    } catch (err) {
      console.error('Error in pmcEstimatorAPI:', err.stack);
      res.status(500).json({ error: `Internal Server Error: ${err.message}` });
    }
  })
};
