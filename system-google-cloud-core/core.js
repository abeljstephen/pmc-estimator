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

// Create confidence percentiles from raw samples
function createConfidencePercentiles(samples) {
  if (!samples || samples.length === 0) throw new Error("Samples array is missing or empty.");
  const sorted = samples.slice().sort((a, b) => a - b);
  const percentiles = {};
  for (let i = 1; i <= 100; i++) {
    const index = Math.floor(((i - 1) / 100) * sorted.length);
    percentiles[i] = sorted[Math.min(index, sorted.length - 1)];
  }
  return percentiles;
}

// Create smoothed percentiles from smoothed histogram
function createSmoothedConfidencePercentiles(samples) {
  if (!samples || samples.length === 0) throw new Error("Samples array is missing or empty.");
  const smoothed = generateSmoothedHistogram(samples, 100);
  const percentiles = {};
  for (let i = 1; i <= 100; i++) {
    const index = Math.floor(((i - 1) / 100) * smoothed.length);
    percentiles[i] = smoothed[Math.min(index, smoothed.length - 1)].x;
  }
  return percentiles;
}


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

  // Triangular
  const triangleMean = (bestCase + mostLikely + worstCase) / 3;
  const triangleVariance = (
    Math.pow(bestCase, 2) +
    Math.pow(mostLikely, 2) +
    Math.pow(worstCase, 2) -
    bestCase * mostLikely -
    bestCase * worstCase -
    mostLikely * worstCase
  ) / 18;
  const triangleSkewness = (mostLikely - triangleMean) / Math.sqrt(triangleVariance);
  const triangleKurtosis = 2.4;

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
  const pertSkewness = (2 * (pertBeta - pertAlpha) * Math.sqrt(pertAlpha + pertBeta + 1)) / (
    (pertAlpha + pertBeta + 2) * Math.sqrt(pertAlpha * pertBeta)
  );
  const pertKurtosis =
    (6 *
      ((pertAlpha - pertBeta) * (pertAlpha - pertBeta) * (pertAlpha + pertBeta + 1) -
        pertAlpha * pertBeta * (pertAlpha + pertBeta + 2))) /
      (pertAlpha * pertBeta * (pertAlpha + pertBeta + 2) * (pertAlpha + pertBeta + 3)) +
    3;

  // Beta
  const betaAlpha = pertAlpha;
  const betaBeta = pertBeta;
  const betaMean = pertMean;
  const betaVariance = pertVariance;
  const betaSkewness = pertSkewness;
  const betaKurtosis = pertKurtosis;
  const betaMode = calculateBetaMode(betaAlpha, betaBeta, bestCase, worstCase);

  // Monte Carlo Unsmoothed
  const mcBetaSamples = monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, bestCase, worstCase);
  const mcUnsmoothedMean =
    mcBetaSamples.reduce((sum, val) => sum + val, 0) / mcBetaSamples.length;
  const mcUnsmoothedVariance =
    mcBetaSamples.reduce((sum, val) => sum + Math.pow(val - mcUnsmoothedMean, 2), 0) /
    (mcBetaSamples.length - 1);
  const mcUnsmoothedSkewness =
    mcBetaSamples.reduce((sum, val) => sum + Math.pow(val - mcUnsmoothedMean, 3), 0) /
    (mcBetaSamples.length * Math.pow(mcUnsmoothedVariance, 1.5));
  const mcUnsmoothedKurtosis =
    mcBetaSamples.reduce((sum, val) => sum + Math.pow(val - mcUnsmoothedMean, 4), 0) /
      (mcBetaSamples.length * Math.pow(mcUnsmoothedVariance, 2)) -
    3;
  const mcUnsmoothedVaR90 = createConfidencePercentiles(mcBetaSamples)[90];
  const mcUnsmoothedMAD = calculateMAD(
    mcBetaSamples,
    createConfidencePercentiles(mcBetaSamples)[50]
  );

  // Monte Carlo Smoothed
  const smoothedHistogram = generateSmoothedHistogram(mcBetaSamples, 100);
  const mcSmoothedMean =
    smoothedHistogram.reduce((sum, bin) => sum + bin.x * bin.y, 0) /
    smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0);

  const mcSmoothedVariance =
    smoothedHistogram.reduce(
      (sum, bin) => sum + bin.y * Math.pow(bin.x - mcSmoothedMean, 2),
      0
    ) /
    smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0);

  const mcSmoothedSkewness =
    smoothedHistogram.reduce(
      (sum, bin) => sum + bin.y * Math.pow((bin.x - mcSmoothedMean) / Math.sqrt(mcSmoothedVariance), 3),
      0
    ) / smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0);

  const mcSmoothedKurtosis =
    smoothedHistogram.reduce(
      (sum, bin) => sum + bin.y * Math.pow((bin.x - mcSmoothedMean) / Math.sqrt(mcSmoothedVariance), 4),
      0
    ) / smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0) - 3;

  const mcSmoothedVaR90 = createSmoothedConfidencePercentiles(mcBetaSamples)[90];
  const mcSmoothedMAD = calculateMAD(
    mcBetaSamples,
    createSmoothedConfidencePercentiles(mcBetaSamples)[50]
  );

  // Weighted Estimates
  const weightedConservative = pertMean + pertStdDev;
  const weightedNeutral = pertMean;
  const weightedOptimistic = pertMean - pertStdDev;

  return {
    estimates,
    triangleMean,
    triangleVariance,
    triangleSkewness,
    triangleKurtosis,
    pertMean,
    pertStdDev,
    pertVariance,
    pertSkewness,
    pertKurtosis,
    betaAlpha,
    betaBeta,
    betaMean,
    betaVariance,
    betaSkewness,
    betaKurtosis,
    betaMode,
    mcUnsmoothedMean,
    mcUnsmoothedVariance,
    mcUnsmoothedSkewness,
    mcUnsmoothedKurtosis,
    mcUnsmoothedVaR90,
    mcUnsmoothedMAD,
    mcSmoothedMean,
    mcSmoothedVariance,
    mcSmoothedSkewness,
    mcSmoothedKurtosis,
    mcSmoothedVaR90,
    mcSmoothedMAD,
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
  createConfidencePercentiles,
  createSmoothedConfidencePercentiles,
  createFullEstimate
};

