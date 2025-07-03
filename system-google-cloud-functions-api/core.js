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
  const pertAlpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
  const pertBeta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);

  // Beta
  const betaMode = calculateBetaMode(pertAlpha, pertBeta, bestCase, worstCase);

  // Monte Carlo samples
  const mcBetaSamples = monteCarloSamplesBetaNoNoise(
    pertAlpha,
    pertBeta,
    bestCase,
    worstCase
  );

  // Smoothed histogram
  const smoothedHistogram = generateSmoothedHistogram(mcBetaSamples, 100);

  // Triangular points for plotting
  const trianglePoints = [];
  const triangleSteps = 100;
  const triangleStepSize = (worstCase - bestCase) / triangleSteps;
  for (let i = 0; i <= triangleSteps; i++) {
    const x = bestCase + i * triangleStepSize;
    trianglePoints.push({
      x,
      y: trianglePdf(x, bestCase, mostLikely, worstCase)
    });
  }

  // Beta PDF points for plotting
  const betaPoints = [];
  for (let i = 0; i <= triangleSteps; i++) {
    const x = bestCase + i * triangleStepSize;
    const scaledX = (x - bestCase) / (worstCase - bestCase);
    const y = (
      Math.pow(scaledX, pertAlpha - 1) *
      Math.pow(1 - scaledX, pertBeta - 1)
    ) / betaFunction(pertAlpha, pertBeta) / (worstCase - bestCase);
    betaPoints.push({ x, y });
  }

  // Percentiles
  const unsmoothedPercentiles = createConfidencePercentiles(mcBetaSamples);
  const smoothedPercentiles = createSmoothedConfidencePercentiles(mcBetaSamples);

  // VaR90 = 90th percentile
  const mcSmoothedVaR90 = smoothedPercentiles[90];

  // Weighted estimates
  const weightedConservative = pertMean + pertStdDev;
  const weightedNeutral = pertMean;
  const weightedOptimistic = pertMean - pertStdDev;

  return {
    estimates,
    triangleMean,
    triangleVariance,
    pertMean,
    pertStdDev,
    pertVariance,
    pertAlpha,
    pertBeta,
    betaMode,
    mcSmoothedVaR90,
    weightedConservative,
    weightedNeutral,
    weightedOptimistic,
    mcBetaSamples,
    smoothedHistogram,
    trianglePoints,
    betaPoints,
    unsmoothedPercentiles,
    smoothedPercentiles,
    message: "Estimation successful"
  };
}

