// core.js

// ==============================================
// Beta Distribution Parameter Estimation Helpers
// ==============================================

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

function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) {
    return alpha < beta ? min : max;
  }
  const mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}

// ==============================================
// Triangle Distribution Helpers
// ==============================================

function generateTrianglePoints(min, mode, max, numPoints = 100) {
  const points = { x: [], y: [] };
  const step = (max - min) / (numPoints - 1);
  const peak = 2 / (max - min); // Normalize area to 1
  for (let i = 0; i < numPoints; i++) {
    const x = min + i * step;
    let y;
    if (x < min || x > max) y = 0;
    else if (x <= mode) y = (2 * (x - min)) / ((max - min) * (mode - min));
    else y = (2 * (max - x)) / ((max - min) * (max - mode));
    points.x.push(x);
    points.y.push(y);
  }
  return points;
}

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

  // Use generateTrianglePoints instead of trianglePdf
  const points = generateTrianglePoints(min, mode, max);

  return {
    points, // Now returns { x: [], y: [] }
    mean,
    variance,
    stdDev,
    skewness
  };
}

// ==============================================
// Beta PDF Helpers
// ==============================================

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

function betaPdfNormalized(x, alpha, beta, min, max) {
  const scaledX = (x - min) / (max - min);
  return (
    (Math.pow(scaledX, alpha - 1) * Math.pow(1 - scaledX, beta - 1)) /
    betaFunction(alpha, beta) /
    (max - min)
  );
}

function createBetaPoints(min, max, alpha, beta) {
  const steps = 100;
  const step = (max - min) / steps;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = min + i * step;
    return { x, y: betaPdfNormalized(x, alpha, beta, min, max) };
  });
}

function createPertPoints(min, max, alpha, beta) {
  return createBetaPoints(min, max, alpha, beta);
}

// ==============================================
// Monte Carlo Sampling Helpers
// ==============================================

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

// ==============================================
// Percentile and Metrics Helpers
// ==============================================

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

function computeSampleStdDev(samples) {
  const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length;
  const variance = samples.reduce((sum, x) => sum + Math.pow(x - mean, 2), 0) / samples.length;
  return Math.sqrt(variance);
}

function computeSampleSkewness(samples) {
  const n = samples.length;
  const mean = samples.reduce((sum, x) => sum + x, 0) / n;
  const stdDev = computeSampleStdDev(samples);
  return (
    (n / ((n - 1) * (n - 2))) *
    samples.reduce((sum, x) => sum + Math.pow((x - mean) / stdDev, 3), 0)
  );
}

// ==============================================
// Main Exported Estimation Function
// ==============================================

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

  const triangleSummary = createTriangleSummary(bestCase, mostLikely, worstCase);
  const trianglePercentiles = createConfidencePercentiles(
    triangleSummary.points.x // Use x-values for percentiles
  );

  const pertMean = (bestCase + 4 * mostLikely + worstCase) / 6;
  const pertStdDev = (worstCase - bestCase) / 6;
  const pertVariance = Math.pow(pertStdDev, 2);
  const pertAlpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
  const pertBeta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);
  const betaMode = calculateBetaMode(pertAlpha, pertBeta, bestCase, worstCase);

  const betaPoints = createBetaPoints(bestCase, worstCase, pertAlpha, pertBeta);
  const pertPoints = createPertPoints(bestCase, worstCase, pertAlpha, pertBeta);

  const mcBetaSamples = monteCarloSamplesBetaNoNoise(pertAlpha, pertBeta, bestCase, worstCase);
  const smoothedHistogram = generateSmoothedHistogram(mcBetaSamples, 100);
  const smoothedPercentiles = createConfidencePercentiles(mcBetaSamples);

  const mcSmoothedMean = smoothedHistogram.reduce((sum, p) => sum + p.x * p.y, 0);
  const mcStdDev = computeSampleStdDev(mcBetaSamples);
  const mcSkewness = computeSampleSkewness(mcBetaSamples);

  const weightedConservative = pertMean + pertStdDev;
  const weightedNeutral = pertMean;
  const weightedOptimistic = pertMean - pertStdDev;

  return {
    estimates,
    trianglePoints: triangleSummary.points, // Now { x: [], y: [] }
    triangleMean: triangleSummary.mean,
    triangleVariance: triangleSummary.variance,
    triangleStdDev: triangleSummary.stdDev,
    triangleSkewness: triangleSummary.skewness,
    triangleMetrics: {
      mean: triangleSummary.mean,
      stdDev: triangleSummary.stdDev,
      skewness: triangleSummary.skewness,
      percentiles: trianglePercentiles
    },
    betaPoints,
    pertPoints,
    pertMean,
    pertStdDev,
    pertVariance,
    pertAlpha,
    pertBeta,
    betaAlpha: pertAlpha,
    betaBeta: pertBeta,
    betaMode,
    betaMetrics: {
      mean: pertMean,
      mode: betaMode,
      stdDev: pertStdDev,
      skewness: 0,
      percentiles: smoothedPercentiles
    },
    mcBetaSamples,
    smoothedHistogram,
    mcSmoothedMean,
    mcMetrics: {
      mean: mcSmoothedMean,
      stdDev: mcStdDev,
      skewness: mcSkewness,
      percentiles: smoothedPercentiles
    },
    mcSmoothedVaR90: smoothedPercentiles["90"],
    weightedConservative,
    weightedNeutral,
    weightedOptimistic,
    message: "Estimation successful",
    timestamp: Date.now()
  };
}

// ==============================================
// Cloud Function Handler
// ==============================================

exports.handler = async (req, res) => {
  try {
    const inputData = req.body; // Array of [{ bestCase, mostLikely, worstCase }, ...]
    if (!Array.isArray(inputData)) {
      throw new Error("Input must be an array of estimate objects.");
    }

    const results = inputData.map((estimate, index) => {
      const result = createFullEstimate(estimate);
      result.task = index + 1; // Add task ID
      return result;
    });

    res.status(200).json({ results });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
};
