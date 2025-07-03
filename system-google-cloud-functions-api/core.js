// core.js

// ========== Existing Helper Functions ==========

// Beta alpha/beta
function calculateAlpha(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = ((mean - min) * (max - mean)) / variance - 1;
  return commonFactor * (mean - min) / (max - min);
}

function calculateBeta(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = ((mean - min) * (max - mean)) / variance - 1;
  return commonFactor * (max - mean) / (max - min);
}

// Beta mode
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) {
    return alpha < beta ? min : max;
  }
  const mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}

// Triangle PDF
function trianglePdf(x, min, mode, max) {
  if (x < min || x > max) return 0;
  if (x <= mode) {
    return (2 * (x - min)) / ((max - min) * (mode - min));
  } else {
    return (2 * (max - x)) / ((max - min) * (max - mode));
  }
}

// Beta PDF normalized over [min, max]
function betaPdfNormalized(x, alpha, beta, min, max) {
  const scaledX = (x - min) / (max - min);
  return (
    (Math.pow(scaledX, alpha - 1) * Math.pow(1 - scaledX, beta - 1)) /
    betaFunction(alpha, beta) /
    (max - min)
  );
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

// Monte Carlo sampling of Beta
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

// Smoothed histogram
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

  // Normalize
  const densitySum = histogram.reduce((sum, bin) => sum + bin.y * binWidth, 0);
  if (densitySum > 0) {
    histogram.forEach((bin) => bin.y /= densitySum);
  }

  return histogram;
}

// Create CDF from histogram
function computeCdfFromHistogram(histogram) {
  let cumulative = 0;
  const step = histogram[1].x - histogram[0].x;
  const cdf = histogram.map((p) => {
    cumulative += p.y * step;
    return { x: p.x, y: Math.min(cumulative, 1) };
  });
  return cdf;
}

// Generate Triangle points
function createTrianglePoints(min, mode, max) {
  const steps = 100;
  const step = (max - min) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = min + i * step;
    return { x, y: trianglePdf(x, min, mode, max) };
  });
}

// Generate PERT Beta points
function createPertPoints(min, max, alpha, beta) {
  const steps = 100;
  const step = (max - min) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = min + i * step;
    return { x, y: betaPdfNormalized(x, alpha, beta, min, max) };
  });
}

// Monte Carlo Histogram
function createMonteCarloHistogram(samples, bins) {
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const binWidth = (max - min) / bins;
  const histogram = Array.from({ length: bins }, (_, i) => ({
    x: min + i * binWidth,
    y: 0
  }));
  samples.forEach((s) => {
    const idx = Math.min(Math.floor((s - min) / binWidth), bins - 1);
    histogram[idx].y++;
  });
  // Normalize
  const norm = samples.length * binWidth;
  histogram.forEach((h) => h.y /= norm);
  return histogram;
}

// ========== MAIN EXPORT FUNCTION ==========

function createFullEstimate(estimates) {
  const { bestCase, mostLikely, worstCase } = estimates;

  // Validation
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

  // Triangle
  const triangleMean = (bestCase + mostLikely + worstCase) / 3;
  const triangleVariance = (
    Math.pow(bestCase, 2) +
    Math.pow(mostLikely, 2) +
    Math.pow(worstCase, 2) -
    bestCase * mostLikely -
    bestCase * worstCase -
    mostLikely * worstCase
  ) / 18;

  // PERT
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

  // Monte Carlo samples
  const mcBetaSamples = monteCarloSamplesBetaNoNoise(pertAlpha, pertBeta, bestCase, worstCase);

  // Derived Monte Carlo metrics
  const mcSmoothedMean = mcBetaSamples.reduce((sum, v) => sum + v, 0) / mcBetaSamples.length;
  const unsmoothedPercentiles = createConfidencePercentiles(mcBetaSamples);
  const smoothedHistogram = generateSmoothedHistogram(mcBetaSamples, 100);
  const smoothedPercentiles = createSmoothedConfidencePercentiles(mcBetaSamples);

  // Weighted
  const weightedConservative = pertMean + pertStdDev;
  const weightedNeutral = pertMean;
  const weightedOptimistic = pertMean - pertStdDev;

  // Return everything, clearly labeled
  return {
    // Raw input
    estimates,

    // Triangle
    triangleMean,
    triangleVariance,

    // PERT
    pertMean,
    pertStdDev,
    pertVariance,
    pertAlpha,
    pertBeta,

    // Beta
    betaAlpha: pertAlpha,
    betaBeta: pertBeta,
    betaMode,

    // Monte Carlo
    mcBetaSamples, // raw samples—**disable later if needed**
    mcSmoothedMean,
    mcSmoothedVaR90: smoothedPercentiles["90"],
    mcUnsmoothedVaR90: unsmoothedPercentiles["90"],
    unsmoothedPercentiles,
    smoothedPercentiles,
    smoothedHistogram,

    // Weighted
    weightedConservative,
    weightedNeutral,
    weightedOptimistic,

    // Chart Points
    trianglePoints: createTrianglePoints(bestCase, mostLikely, worstCase),
    pertPoints: createPertPoints(bestCase, worstCase, pertAlpha, pertBeta),

    // Metadata
    message: "Estimation successful",
    timestamp: Date.now()
  };
}


module.exports = {
  createFullEstimate
};

