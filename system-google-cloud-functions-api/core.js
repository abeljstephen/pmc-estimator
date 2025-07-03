// core.js

// Calculate alpha parameter for Beta distribution
function calculateAlpha(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = ((mean - min) * (max - mean)) / variance - 1;
  return commonFactor * (mean - min) / (max - min);
}

// Calculate beta parameter for Beta distribution
function calculateBeta(mean, stdDev, min, max) {
  const variance = Math.pow(stdDev, 2);
  const commonFactor = ((mean - min) * (max - mean)) / variance - 1;
  return commonFactor * (max - mean) / (max - min);
}

// Calculate the mode of Beta distribution
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) {
    return alpha < beta ? min : max;
  }
  const mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}

// Triangular PDF
function trianglePdf(x, min, mode, max) {
  if (x < min || x > max) return 0;
  if (x <= mode) {
    return (2 * (x - min)) / ((max - min) * (mode - min));
  } else {
    return (2 * (max - x)) / ((max - min) * (max - mode));
  }
}

// Triangular CDF
function triangleCdf(x, min, mode, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  if (x <= mode) {
    return Math.pow(x - min, 2) / ((max - min) * (mode - min));
  } else {
    return 1 - Math.pow(max - x, 2) / ((max - min) * (max - mode));
  }
}

// Monte Carlo sampling of Beta distribution
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

// Median Absolute Deviation (MAD)
function calculateMAD(samples, median) {
  const deviations = samples.map((s) => Math.abs(s - median));
  deviations.sort((a, b) => a - b);
  const mid = Math.floor(deviations.length / 2);
  return deviations.length % 2 === 0
    ? (deviations[mid - 1] + deviations[mid]) / 2
    : deviations[mid];
}

// Beta PDF
function betaPdf(x, alpha, beta) {
  if (x < 0 || x > 1) return 0;
  return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) / betaFunction(alpha, beta);
}

// Beta function (B)
function betaFunction(alpha, beta) {
  return gamma(alpha) * gamma(beta) / gamma(alpha + beta);
}

// Gamma function (Lanczos approximation)
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
    1.5056327351493116e-7
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

// Smoothed histogram with Gaussian kernel
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
    y: 0
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

// Updated createFullEstimate
function createFullEstimate(estimates) {
  const { bestCase, mostLikely, worstCase } = estimates;

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
  const betaAlpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
  const betaBeta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);
  const betaMode = calculateBetaMode(betaAlpha, betaBeta, bestCase, worstCase);

  // Monte Carlo
  const mcSamples = monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, bestCase, worstCase);
  const mcMean = mcSamples.reduce((a, b) => a + b, 0) / mcSamples.length;
  const mcVariance = mcSamples.reduce((sum, x) => sum + Math.pow(x - mcMean, 2), 0) / mcSamples.length;
  const sorted = mcSamples.slice().sort((a, b) => a - b);
  const mcVaR90 = sorted[Math.floor(0.9 * sorted.length)];
  const smoothedHistogram = generateSmoothedHistogram(mcSamples, 100);
  const smoothedMean = smoothedHistogram.reduce((sum, p) => sum + p.x * p.y, 0);

  // Weighted
  const weightedConservative = pertMean + pertStdDev;
  const weightedNeutral = pertMean;
  const weightedOptimistic = Math.max(pertMean - pertStdDev, 0);

  return {
    estimates,
    triangleMean,
    triangleVariance,
    pertMean,
    pertStdDev,
    pertVariance,
    betaAlpha,
    betaBeta,
    betaMode,
    mcSmoothedMean: smoothedMean,
    mcSmoothedVaR90: mcVaR90,
    weightedConservative,
    weightedNeutral,
    weightedOptimistic,
    message: "Estimation successful"
  };
}

module.exports = {
  calculateAlpha,
  calculateBeta,
  calculateBetaMode,
  trianglePdf,
  triangleCdf,
  monteCarloSamplesBetaNoNoise,
  calculateMAD,
  betaPdf,
  betaFunction,
  gamma,
  generateSmoothedHistogram,
  createFullEstimate
};

