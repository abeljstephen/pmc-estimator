// core.js

// ============================================================
// ========== Helper Functions: Beta Parameter Estimation =====
// ============================================================

// Calculates alpha for Beta distribution
function calculateAlpha(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = ((mean - min) * (max - mean)) / variance - 1;
  return commonFactor * (mean - min) / (max - min);
}

// Calculates beta for Beta distribution
function calculateBeta(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = ((mean - min) * (max - mean)) / variance - 1;
  return commonFactor * (max - mean) / (max - min);
}

// Calculates mode for Beta distribution
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) {
    return alpha < beta ? min : max;
  }
  const mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}

// ============================================================
// ========== Helper Functions: Triangle Distribution =========
// ============================================================

// Creates triangle summary with CDF, mean, variance, stddev, skewness
function createTriangleSummary(bestCase, mostLikely, worstCase) {
  const min = bestCase;
  const mode = mostLikely;
  const max = worstCase;

  const mean = (min + mode + max) / 3;
  const variance = (
    Math.pow(min, 2) +
    Math.pow(mode, 2) +
    Math.pow(max, 2) -
    min * mode -
    min * max -
    mode * max
  ) / 18;
  const stdDev = Math.sqrt(variance);
  const skewness = (Math.sqrt(2) * (min + max - 2 * mode)) / (max - min);

  const TRIANGLE_POINTS = [];
  const steps = 100;
  const step = (max - min) / steps;
  let cumulative = 0;

  for (let i = 0; i <= steps; i++) {
    const x = min + i * step;
    const y = trianglePdf(x, min, mode, max);
    cumulative += y * step;
    TRIANGLE_POINTS.push({ x, y, confidence: Math.min(cumulative * 100, 100) });
  }

  return {
    points: TRIANGLE_POINTS,
    mean,
    variance,
    stdDev,
    skewness
  };
}

// Triangle PDF function
function trianglePdf(x, min, mode, max) {
  if (x < min || x > max) return 0;
  if (x <= mode) {
    return (2 * (x - min)) / ((max - min) * (mode - min));
  } else {
    return (2 * (max - x)) / ((max - min) * (max - mode));
  }
}

// ============================================================
// ========== Helper Functions: Beta PDF & Gamma ==============
// ============================================================

function betaPdfNormalized(x, alpha, beta, min, max) {
  const scaledX = (x - min) / (max - min);
  return (
    Math.pow(scaledX, alpha - 1) *
    Math.pow(1 - scaledX, beta - 1)
  ) / betaFunction(alpha, beta) / (max - min);
}

function betaFunction(a, b) {
  return gamma(a) * gamma(b) / gamma(a + b);
}

function gamma(z) {
  const g = 7;
  const p = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7
  ];
  if (z < 0.5) return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
  z -= 1;
  let x = p[0];
  for (let i = 1; i < g + 2; i++) x += p[i] / (z + i);
  const t = z + g + 0.5;
  return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * x;
}

// ============================================================
// ========== Monte Carlo Sampling & Smoothing ================
// ============================================================

function monteCarloSamplesBetaNoNoise(alpha, beta, min, max) {
  const simulations = [];
  for (let i = 0; i < 1000; i++) {
    const x = Math.random();
    const y = Math.random();
    const z = Math.pow(x, 1 / alpha) / (Math.pow(x, 1 / alpha) + Math.pow(y, 1 / beta));
    simulations.push(min + z * (max - min));
  }
  return simulations;
}

function generateSmoothedHistogram(samples, bins) {
  const minVal = Math.min(...samples);
  const maxVal = Math.max(...samples);
  const binWidth = (maxVal - minVal) / bins;
  const histogram = Array.from({ length: bins }, (_, i) => ({
    x: minVal + i * binWidth,
    y: 0
  }));

  const bandwidth = 0.05 * (maxVal - minVal);
  const gaussianKernel = (x) => Math.exp(-0.5 * Math.pow(x / bandwidth, 2));

  histogram.forEach((bin) => {
    let weightedSum = 0;
    samples.forEach((s) => {
      weightedSum += gaussianKernel(bin.x - s);
    });
    bin.y = weightedSum / (samples.length * binWidth);
  });

  const densitySum = histogram.reduce((sum, bin) => sum + bin.y * binWidth, 0);
  if (densitySum > 0) {
    histogram.forEach((bin) => bin.y /= densitySum);
  }

  return histogram;
}

function computeCdfFromHistogram(histogram) {
  let cumulative = 0;
  const step = histogram[1].x - histogram[0].x;
  return histogram.map((p) => {
    cumulative += p.y * step;
    return { x: p.x, y: Math.min(cumulative, 1) };
  });
}

// ============================================================
// ========== Point Generators for Charts =====================
// ============================================================

function createTrianglePoints(min, mode, max) {
  const steps = 100;
  const step = (max - min) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = min + i * step;
    return { x, y: trianglePdf(x, min, mode, max) };
  });
}

function createPertPoints(min, max, alpha, beta) {
  const steps = 100;
  const step = (max - min) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = min + i * step;
    return { x, y: betaPdfNormalized(x, alpha, beta, min, max) };
  });
}

// ============================================================
// ========== Percentiles =====================================
// ============================================================

function createConfidencePercentiles(samples) {
  if (!samples || !samples.length) return {};
  const sorted = samples.slice().sort((a, b) => a - b);
  const percentiles = {};
  [5, 10, 25, 50, 75, 90, 95].forEach(p => {
    const index = Math.floor((p / 100) * sorted.length);
    percentiles[p] = sorted[index];
  });
  return percentiles;
}

function createSmoothedConfidencePercentiles(samples) {
  return createConfidencePercentiles(samples);
}

// ============================================================
// ========== Main Exported Function ==========================
// ============================================================

function createFullEstimate(estimates) {
  const { bestCase, mostLikely, worstCase } = estimates;

  // Input validation
  if (
    typeof bestCase !== "number" ||
    typeof mostLikely !== "number" ||
    typeof worstCase !== "number"
  ) {
    throw new Error("All estimates must be numbers.");
  }
  if (bestCase < 0 || mostLikely < 0 || worstCase < 0) {
    throw new Error("Estimates cannot be negative.");
  }
  if (bestCase > mostLikely || mostLikely > worstCase) {
    throw new Error("Estimates must satisfy: best <= mostLikely <= worst.");
  }

  // Triangle Distribution
  const triangleSummary = createTriangleSummary(bestCase, mostLikely, worstCase);

  // PERT Beta Distribution
  const pertMean = (bestCase + 4 * mostLikely + worstCase) / 6;
  const range = worstCase - bestCase;
  const baseStdDev = range / 6;
  const midpoint = (bestCase + worstCase) / 2;
  const modeDeviation = (mostLikely - midpoint) / (range / 2);
  const skewFactor = 1 + Math.abs(modeDeviation) * 0.5;
  const pertStdDev = baseStdDev * skewFactor;
  const pertVariance = Math.pow(pertStdDev, 2);
  const pertAlpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
  const pertBeta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);
  const betaMode = calculateBetaMode(pertAlpha, pertBeta, bestCase, worstCase);

  // Monte Carlo Simulation
  const mcBetaSamples = monteCarloSamplesBetaNoNoise(pertAlpha, pertBeta, bestCase, worstCase);
  const unsmoothedPercentiles = createConfidencePercentiles(mcBetaSamples);
  const smoothedHistogram = generateSmoothedHistogram(mcBetaSamples, 100);
  const smoothedPercentiles = createSmoothedConfidencePercentiles(mcBetaSamples);

  const smoothedSum = smoothedHistogram.reduce((sum, p) => sum + p.x * p.y, 0);
  const smoothedArea = smoothedHistogram.reduce((sum, p) => sum + p.y, 0);
  const mcSmoothedMean = smoothedArea > 0 ? smoothedSum / smoothedArea : pertMean;

  // Beta metrics (moved INSIDE here to avoid errors)
  const betaPoints = createPertPoints(bestCase, worstCase, pertAlpha, pertBeta);
  const betaPercentiles = smoothedPercentiles;
  const betaStdDev = pertStdDev;
  const betaSkewness = 0;

  return {
    estimates,
    trianglePoints: triangleSummary.points,
    triangleMean: triangleSummary.mean,
    triangleVariance: triangleSummary.variance,
    triangleStdDev: triangleSummary.stdDev,
    triangleSkewness: triangleSummary.skewness,
    pertPoints: betaPoints,
    pertMean,
    pertStdDev,
    pertVariance,
    pertAlpha,
    pertBeta,
    betaMode,
    betaMetrics: {
      mean: pertMean,
      mode: betaMode,
      stdDev: betaStdDev,
      skewness: betaSkewness,
      percentiles: betaPercentiles
    },
    mcBetaSamples,
    smoothedHistogram,
    unsmoothedPercentiles,
    smoothedPercentiles,
    mcSmoothedMean,
    mcSmoothedVaR90: smoothedPercentiles["90"],
    mcUnsmoothedVaR90: unsmoothedPercentiles["90"],
    message: "Estimation successful",
    timestamp: Date.now()
  };
}

module.exports = {
  createFullEstimate
};

