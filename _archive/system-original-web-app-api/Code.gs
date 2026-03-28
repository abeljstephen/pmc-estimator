/** 
 * SECTION 1: MENU SETUP
 * Defines the custom menu in Google Sheets to provide user access to key functionalities.
 * Purpose: Allows users to trigger column generation and plotting from the UI within Google Sheets.
 * Note: Used exclusively for the Add-On interface, unaffected by web app deployment.
 */

/**
 * Adds an Add-On menu to the Google Sheets UI for user interaction.
 * Creates a menu named 'Project Estimation' with options 'PERT' and 'PLOT'.
 */
function onOpen(e) {
  var ui = SpreadsheetApp.getUi();
  ui.createAddonMenu()
    .addItem('PERT', 'addPERTColumns')
    .addItem('PLOT', 'showPlot')
    .addToUi();
}

/**
 * Displays a modal dialog for plotting.
 * Utility: Opens the Plot.html interface for visualizing distributions within Google Sheets.
 * Note: Used by the Add-On to display charts/tables/sliders in a modal dialog.
 * Modification: Passes the active spreadsheet's sheetId to Plot.html for consistency with Web App.
 */
function showPlot() {
  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  var html = HtmlService.createHtmlOutputFromFile('Plot')
    .setWidth(1200)
    .setHeight(900)
    .append('<script>var sheetId = "' + sheetId + '";</script>');
  SpreadsheetApp.getUi().showModalDialog(html, 'Distribution Plots');
}

/** 
 * SECTION 2: UTILITY FUNCTIONS
 * Contains low-level helper functions used across multiple calculations in later sections.
 * Purpose: Provides foundational tools for random number generation and risk metrics.
 */

/**
 * Generates a random number between 0 and 1 for Monte Carlo simulations.
 * Used in: Monte Carlo sampling functions (Section 3).
 */
function random() {
  return Math.random();
}

/**
 * Calculates Value at Risk (VaR) at a specified confidence level from points array.
 * Used in: Monte Carlo tables in Section 6 (addPERTColumns).
 * @param {number} confidenceLevel - Confidence level (e.g., 90 for 90%).
 * @param {Array} points - Array of points with x (value) and confidence properties.
 * @returns {number} VaR value.
 */
function calculateValueAtRisk(confidenceLevel, points) {
  if (!points || points.length === 0) throw new Error('Points array is missing or empty.');
  const sortedPoints = points.slice().sort((a, b) => a.x - b.x);
  const index = Math.floor((1 - confidenceLevel / 100) * sortedPoints.length);
  return sortedPoints[index].x;
}

/**
 * Calculates Conditional Value at Risk (CVaR) at a confidence level from points array.
 * Used in: Monte Carlo tables in Section 6 (addPERTColumns).
 * @param {number} confidenceLevel - Confidence level (e.g., 90 for 90%).
 * @param {Array} points - Array of points with x (value) properties.
 * @returns {number} CVaR value.
 */
function calculateConditionalValueAtRisk(confidenceLevel, points) {
  if (!points || points.length === 0) throw new Error('Points array is missing or empty.');
  const sortedPoints = points.slice().sort((a, b) => a.x - b.x);
  const varIndex = Math.floor((1 - confidenceLevel / 100) * sortedPoints.length);
  const tailPoints = sortedPoints.slice(0, varIndex + 1);
  return tailPoints.reduce((sum, point) => sum + point.x, 0) / tailPoints.length;
}

/**
 * Finds the confidence level closest to a given value in the points array.
 * Used in: Plot annotations in Plot.html (Section 7).
 * @param {number} value - Target value to find confidence for.
 * @param {Array} points - Array of points with x (value) and confidence properties.
 * @returns {number} Closest confidence level.
 */
function findConfidenceForValue(value, points) {
  if (!points || points.length === 0) throw new Error('Points array is missing or empty.');
  let closestConfidence = null;
  let smallestDifference = Infinity;
  points.forEach(point => {
    const difference = Math.abs(point.x - value);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      closestConfidence = point.confidence;
    }
  });
  return closestConfidence;
}

/**
 * SECTION 3: MONTE CARLO SIMULATION FUNCTIONS
 * Handles the generation and processing of Monte Carlo samples for Beta-based stochastic modeling.
 * Purpose: Provides sampling and percentile mapping for Monte Carlo On Beta Unsmoothed and Smoothed in Section 6.
 */

/**
 * Generates Monte Carlo samples for a Beta distribution without noise.
 * Used in: Monte Carlo On Beta Unsmoothed and Smoothed in Section 6 (addPERTColumns).
 * @param {number} alpha - Alpha parameter of Beta distribution.
 * @param {number} beta - Beta parameter of Beta distribution.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {Array} Array of simulated values.
 */
function monteCarloSamplesBetaNoNoise(alpha, beta, min, max) {
  var simulations = [];
  for (var i = 0; i < 1000; i++) {
    var x = random();
    var y = random();
    var z = Math.pow(x, 1 / alpha) / (Math.pow(x, 1 / alpha) + Math.pow(y, 1 / beta));
    simulations.push(min + z * (max - min));
  }
  return simulations;
}

/**
 * Creates confidence percentiles from Monte Carlo samples, extended to 1-100%.
 * Used in: Monte Carlo On Beta Unsmoothed in Section 6 (addPERTColumns).
 * @param {Array} samples - Monte Carlo simulation samples.
 * @returns {Object} Percentiles from 1 to 100.
 */
function createConfidencePercentiles(samples) {
  if (!samples || samples.length === 0) throw new Error('Samples array is missing or empty.');
  const sortedSamples = samples.slice().sort((a, b) => a - b);
  const percentiles = {};
  for (let i = 1; i <= 100; i++) {
    const index = Math.floor(((i - 1) / 100) * sortedSamples.length);
    percentiles[i] = sortedSamples[Math.min(index, sortedSamples.length - 1)];
  }
  return percentiles;
}

/**
 * Creates smoothed confidence percentiles from Monte Carlo samples, extended to 1-100%.
 * Used in: Monte Carlo On Beta Smoothed in Section 6 (addPERTColumns).
 * @param {Array} samples - Monte Carlo simulation samples.
 * @returns {Object} Smoothed percentiles from 1 to 100.
 */
function createSmoothedConfidencePercentiles(samples) {
  if (!samples || samples.length === 0) throw new Error('Samples array is missing or empty.');
  const smoothedHistogram = generateSmoothedHistogram(samples, 100);
  const smoothedPercentiles = {};
  for (let i = 1; i <= 100; i++) {
    const index = Math.floor(((i - 1) / 100) * smoothedHistogram.length);
    smoothedPercentiles[i] = smoothedHistogram[Math.min(index, smoothedHistogram.length - 1)].x;
  }
  return smoothedPercentiles;
}

/**
 * SECTION 4: BETA DISTRIBUTION FUNCTIONS
 * Calculates parameters and metrics specific to the Beta distribution.
 * Purpose: Provides the theoretical foundation for Beta-based estimates used in PERT and Beta distributions in Section 6.
 */

/**
 * Calculates the alpha parameter for the Beta distribution.
 * Used in: PERT and Beta Distributions in Section 6 (addPERTColumns).
 * @param {number} mean - Mean of the distribution.
 * @param {number} stdDev - Standard deviation of the distribution.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Alpha parameter.
 */
function calculateAlpha(mean, stdDev, min, max) {
  var variance = Math.pow(stdDev, 2);
  var commonFactor = (mean - min) * (max - mean) / variance - 1;
  return commonFactor * (mean - min) / (max - min);
}

/**
 * Calculates the beta parameter for the Beta distribution.
 * Used in: PERT and Beta Distributions in Section 6 (addPERTColumns).
 * @param {number} mean - Mean of the distribution.
 * @param {number} stdDev - Standard deviation of the distribution.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Beta parameter.
 */
function calculateBeta(mean, stdDev, min, max) {
  var variance = Math.pow(stdDev, 2);
  var commonFactor = (mean - min) * (max - mean) / variance - 1;
  return commonFactor * (max - mean) / (max - min);
}

/**
 * Calculates the mode of the Beta distribution.
 * Used in: Beta Distribution in Section 6 (addPERTColumns).
 * @param {number} alpha - Alpha parameter.
 * @param {number} beta - Beta parameter.
 * @param {number} min - Minimum value (best case).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Mode of the Beta distribution.
 */
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) {
    return alpha < beta ? min : max;
  }
  var mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}

/**
 * SECTION 5: DATA PREPARATION FUNCTIONS
 * Prepares data structures and calculates probability density for use in Sections 6 and 7.
 * Purpose: Supports 100-point array generation for all distributions displayed in Plot.html.
 */

/**
 * Probability Density Function (PDF) for the Beta distribution.
 * Used in: PERT, Beta, Monte Carlo On Beta in Section 6 (addPERTColumns).
 * @param {number} x - Scaled value between 0 and 1.
 * @param {number} alpha - Alpha parameter.
 * @param {number} beta - Beta parameter.
 * @returns {number} Density value.
 */
function betaPdf(x, alpha, beta) {
  if (x < 0 || x > 1) return 0;
  return (Math.pow(x, alpha - 1) * Math.pow(1 - x, beta - 1)) / betaFunction(alpha, beta);
}

/**
 * Beta function for normalizing the Beta PDF.
 * Used in: betaPdf for density calculations.
 * @param {number} alpha - Alpha parameter.
 * @param {number} beta - Beta parameter.
 * @returns {number} Beta function value.
 */
function betaFunction(alpha, beta) {
  return gamma(alpha) * gamma(beta) / gamma(alpha + beta);
}

/**
 * Gamma function approximation for Beta function calculation.
 * Used in: betaFunction for Beta PDF normalization.
 * @param {number} z - Input value.
 * @returns {number} Gamma function approximation.
 */
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
    1.5056327351493116e-7,
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

/**
 * Probability Density Function (PDF) for the Triangular distribution.
 * Used in: Triangular Distribution in Section 6 (addPERTColumns).
 * @param {number} x - Value to evaluate.
 * @param {number} min - Minimum value (best case).
 * @param {number} mode - Mode (most likely).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Density value.
 */
function trianglePdf(x, min, mode, max) {
  if (x < min || x > max) return 0;
  if (x <= mode) {
    return 2 * (x - min) / ((max - min) * (mode - min));
  } else {
    return 2 * (max - x) / ((max - min) * (max - mode));
  }
}

/**
 * Cumulative Distribution Function (CDF) for the Triangular distribution.
 * Used in: Triangular and CDF in Section 6 (addPERTColumns).
 * @param {number} x - Value to evaluate.
 * @param {number} min - Minimum value (best case).
 * @param {number} mode - Mode (most likely).
 * @param {number} max - Maximum value (worst case).
 * @returns {number} Cumulative probability.
 */
function triangleCdf(x, min, mode, max) {
  if (x <= min) return 0;
  if (x >= max) return 1;
  if (x <= mode) {
    return ((x - min) * (x - min)) / ((max - min) * (mode - min));
  } else {
    return 1 - ((max - x) * (max - x)) / ((max - min) * (max - mode));
  }
}

/**
 * Generates a smoothed histogram from samples using Gaussian kernel density estimation.
 * Used in: Monte Carlo On Beta Smoothed in Section 6 (addPERTColumns).
 * @param {Array} samples - Monte Carlo simulation samples.
 * @param {number} bins - Number of bins for histogram.
 * @returns {Array} Smoothed histogram points with x (value) and y (density).
 */
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
    y: 0,
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

/**
 * Calculates the Median Absolute Deviation (MAD) from a given median.
 * Used in: Monte Carlo distributions in Section 6 (addPERTColumns).
 * @param {Array} samples - Monte Carlo simulation samples.
 * @param {number} median - Median value.
 * @returns {number} MAD value.
 */
function calculateMAD(samples, median) {
  const deviations = samples.map(sample => Math.abs(sample - median));
  deviations.sort((a, b) => a - b);
  const mid = Math.floor(deviations.length / 2);
  return deviations.length % 2 === 0 ? (deviations[mid - 1] + deviations[mid]) / 2 : deviations[mid];
}

/**
 * SECTION 6: PERT COLUMNS ADDITION
 * Populates the "Estimate Calculations" sheet with metrics for all distributions.
 * Purpose: Computes and organizes variables by distribution type (Triangular, PERT, Beta, Monte Carlo, CDF),
 * generating 100-point arrays for plotting in Plot.html.
 */

/**
 * Adds PERT columns to the "Estimate Calculations" sheet with all metrics.
 * Progression: Triangular → PERT → Beta → Monte Carlo On Beta Unsmoothed → Smoothed → CDF.
 * Note: Called by the Add-On (via Extensions menu) and web app (via doPost).
 */
function addPERTColumns() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getActiveSheet();
  const range = sheet.getDataRange();
  const values = range.getValues();

  let newSheet = spreadsheet.getSheetByName('Estimate Calculations');
  if (!newSheet) {
    newSheet = spreadsheet.insertSheet('Estimate Calculations');
  } else {
    newSheet.clear();
  }

  const headers = [
    'Name', 'Best Case', 'Most Likely', 'Worst Case',
    'Triangle Mean', 'Triangle Variance', 'Triangle Skewness', 'Triangle Kurtosis', 'Triangle Points',
    'PERT Mean', 'PERT StdDev', 'PERT Variance', 'PERT Skewness', 'PERT Kurtosis', 'PERT Points',
    'Beta Mean', 'Beta Variance', 'Beta Skewness', 'Beta Kurtosis', 'Alpha', 'Beta', 'Beta Mode', 'Beta Points',
    'MC On Beta Unsmoothed Mean', 'MC On Beta Unsmoothed Variance', 'MC On Beta Unsmoothed Skewness', 'MC On Beta Unsmoothed Kurtosis', 'MC On Beta Unsmoothed VaR 90%', 'MC On Beta Unsmoothed CVaR 90%', 'MC On Beta Unsmoothed MAD', 'MC On Beta Unsmoothed Points',
    'MC On Beta Smoothed Mean', 'MC On Beta Smoothed Variance', 'MC On Beta Smoothed Skewness', 'MC On Beta Smoothed Kurtosis', 'MC On Beta Smoothed VaR 90%', 'MC On Beta Smoothed CVaR 90%', 'MC On Beta Smoothed MAD', 'MC On Beta Smoothed Points',
    'Weighted Estimate (Conservative)', 'Weighted Estimate (Neutral)', 'Weighted Estimate (Optimistic)',
    'Probability Exceeding PERT Mean (Beta)', 'Probability Exceeding PERT Mean (MC Unsmoothed)', 'Probability Exceeding PERT Mean (MC Smoothed)',
    'CDF Points'
  ];
  newSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  for (let i = 1; i < values.length; i++) {
    const [name, bestCaseRaw, mostLikelyRaw, worstCaseRaw] = values[i];
    if (!bestCaseRaw || !mostLikelyRaw || !worstCaseRaw) continue;

    const bestCase = parseFloat(bestCaseRaw);
    const mostLikely = parseFloat(mostLikelyRaw);
    const worstCase = parseFloat(worstCaseRaw);

    if (isNaN(bestCase) || isNaN(mostLikely) || isNaN(worstCase) || bestCase > mostLikely || mostLikely > worstCase) {
      newSheet.appendRow([name, bestCaseRaw, mostLikelyRaw, worstCaseRaw, 'Error: Invalid input values']);
      continue;
    }

    // Triangular
    const triangleMean = (bestCase + mostLikely + worstCase) / 3;
    const triangleVariance = (Math.pow(bestCase, 2) + Math.pow(mostLikely, 2) + Math.pow(worstCase, 2) - bestCase * mostLikely - bestCase * worstCase - mostLikely * worstCase) / 18;
    const triangleSkewness = (mostLikely - triangleMean) / Math.sqrt(triangleVariance);
    const triangleKurtosis = 2.4;
    const trianglePoints = generateDistributionPoints('TRIANGLE', bestCase, mostLikely, worstCase);

    // PERT
    const pertMean = (bestCase + 4 * mostLikely + worstCase) / 6;
    const range = worstCase - bestCase;
    const baseStdDev = range / 6;
    const midpoint = (bestCase + worstCase) / 2;
    const modeDeviation = (mostLikely - midpoint) / (range / 2); // -1 to 1: negative = left skew, positive = right skew
    const skewFactor = 1 + Math.abs(modeDeviation) * 0.5; // Increase variance with skew, max 50% boost
    const pertStdDev = baseStdDev * skewFactor;
    const pertVariance = Math.pow(pertStdDev, 2);
    const pertAlpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
    const pertBeta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);
    const pertSkewness = (2 * (pertBeta - pertAlpha) * Math.sqrt(pertAlpha + pertBeta + 1)) / ((pertAlpha + pertBeta + 2) * Math.sqrt(pertAlpha * pertBeta));
    const pertKurtosis = (6 * ((pertAlpha - pertBeta) * (pertAlpha - pertBeta) * (pertAlpha + pertBeta + 1) - pertAlpha * pertBeta * (pertAlpha + pertBeta + 2))) / (pertAlpha * pertBeta * (pertAlpha + pertBeta + 2) * (pertAlpha + pertBeta + 3)) + 3;
    const pertPoints = generateDistributionPoints('PERT', bestCase, mostLikely, worstCase, pertAlpha, pertBeta);

    // Beta
    const betaAlpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
    const betaBeta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);
    const betaMean = bestCase + (betaAlpha / (betaAlpha + betaBeta)) * (worstCase - bestCase);
    const betaVariance = (betaAlpha * betaBeta * Math.pow(worstCase - bestCase, 2)) / (Math.pow(betaAlpha + betaBeta, 2) * (betaAlpha + betaBeta + 1));
    const betaSkewness = (2 * (betaBeta - betaAlpha) * Math.sqrt(betaAlpha + betaBeta + 1)) / ((betaAlpha + betaBeta + 2) * Math.sqrt(betaAlpha * betaBeta));
    const betaKurtosis = (6 * ((betaAlpha - betaBeta) * (betaAlpha - betaBeta) * (betaAlpha + betaBeta + 1) - betaAlpha * betaBeta * (betaAlpha + betaBeta + 2))) / (betaAlpha * betaBeta * (betaAlpha + betaBeta + 2) * (betaAlpha + betaBeta + 3)) + 3;
    const betaMode = calculateBetaMode(betaAlpha, betaBeta, bestCase, worstCase);
    const betaPoints = generateDistributionPoints('BETA', bestCase, mostLikely, worstCase, betaAlpha, betaBeta);

    // Monte Carlo On Beta Unsmoothed
    const mcBetaSamples = monteCarloSamplesBetaNoNoise(betaAlpha, betaBeta, bestCase, worstCase);
    const mcUnsmoothedMean = mcBetaSamples.reduce((sum, val) => sum + val, 0) / mcBetaSamples.length;
    const mcUnsmoothedVariance = mcBetaSamples.reduce((sum, val) => sum + Math.pow(val - mcUnsmoothedMean, 2), 0) / (mcBetaSamples.length - 1);
    const mcUnsmoothedSkewness = mcBetaSamples.reduce((sum, val) => sum + Math.pow(val - mcUnsmoothedMean, 3), 0) / (mcBetaSamples.length * Math.pow(mcUnsmoothedVariance, 1.5));
    const mcUnsmoothedKurtosis = mcBetaSamples.reduce((sum, val) => sum + Math.pow(val - mcUnsmoothedMean, 4), 0) / (mcBetaSamples.length * Math.pow(mcUnsmoothedVariance, 2)) - 3;
    const mcUnsmoothedPoints = generateDistributionPoints('MC_UNSMOOTHED', bestCase, mostLikely, worstCase, betaAlpha, betaBeta, mcBetaSamples);
    const mcUnsmoothedVaR90 = calculateValueAtRisk(90, mcUnsmoothedPoints);
    const mcUnsmoothedCVaR90 = calculateConditionalValueAtRisk(90, mcUnsmoothedPoints);
    const mcUnsmoothedMAD = calculateMAD(mcBetaSamples, mcUnsmoothedPoints.find(p => p.confidence === 50).x);

    // Monte Carlo On Beta Smoothed
    const smoothedHistogram = generateSmoothedHistogram(mcBetaSamples, 100);
    const mcSmoothedMean = smoothedHistogram.reduce((sum, bin) => sum + bin.x * bin.y, 0) / smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0);
    const mcSmoothedVariance = smoothedHistogram.reduce((sum, bin) => sum + bin.y * Math.pow(bin.x - mcSmoothedMean, 2), 0) / smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0);
    const mcSmoothedStdDev = Math.sqrt(mcSmoothedVariance);
    const mcSmoothedSkewness = smoothedHistogram.reduce((sum, bin) => sum + bin.y * Math.pow((bin.x - mcSmoothedMean) / mcSmoothedStdDev, 3), 0) / smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0);
    const mcSmoothedKurtosis = smoothedHistogram.reduce((sum, bin) => sum + bin.y * Math.pow((bin.x - mcSmoothedMean) / mcSmoothedStdDev, 4), 0) / smoothedHistogram.reduce((sum, bin) => sum + bin.y, 0) - 3;
    const mcSmoothedPoints = generateDistributionPoints('MC_SMOOTHED', bestCase, mostLikely, worstCase, betaAlpha, betaBeta, mcBetaSamples);
    const mcSmoothedVaR90 = calculateValueAtRisk(90, mcSmoothedPoints);
    const mcSmoothedCVaR90 = calculateConditionalValueAtRisk(90, mcSmoothedPoints);
    const mcSmoothedMAD = calculateMAD(mcBetaSamples, mcSmoothedPoints.find(p => p.confidence === 50).x);

    // Weighted Estimates
    const weightedConservative = pertMean + pertStdDev;
    const weightedNeutral = pertMean;
    const weightedOptimistic = pertMean - pertStdDev;

    // Probabilities
    const probExceedPertMeanBeta = betaPoints.filter(p => p.x > pertMean).length / 100 * 100;
    const probExceedPertMeanUnsmoothed = mcUnsmoothedPoints.filter(p => p.x > pertMean).length / 100 * 100;
    const probExceedPertMeanSmoothed = mcSmoothedPoints.filter(p => p.x > pertMean).length / 100 * 100;

    // CDF
    const cdfPoints = generateDistributionPoints('CDF', bestCase, mostLikely, worstCase);

    newSheet.appendRow([
      name, bestCase, mostLikely, worstCase,
      triangleMean, triangleVariance, triangleSkewness, triangleKurtosis, JSON.stringify(trianglePoints),
      pertMean, pertStdDev, pertVariance, pertSkewness, pertKurtosis, JSON.stringify(pertPoints),
      betaMean, betaVariance, betaSkewness, betaKurtosis, betaAlpha, betaBeta, betaMode, JSON.stringify(betaPoints),
      mcUnsmoothedMean, mcUnsmoothedVariance, mcUnsmoothedSkewness, mcUnsmoothedKurtosis, mcUnsmoothedVaR90, mcUnsmoothedCVaR90, mcUnsmoothedMAD, JSON.stringify(mcUnsmoothedPoints),
      mcSmoothedMean, mcSmoothedVariance, mcSmoothedSkewness, mcSmoothedKurtosis, mcSmoothedVaR90, mcSmoothedCVaR90, mcSmoothedMAD, JSON.stringify(mcSmoothedPoints),
      weightedConservative, weightedNeutral, weightedOptimistic,
      probExceedPertMeanBeta, probExceedPertMeanUnsmoothed, probExceedPertMeanSmoothed,
      JSON.stringify(cdfPoints)
    ]);
  }

  // Highlight the "PERT Mean" column (column 10, index 9) in light green and bold the header
  const lastRow = newSheet.getLastRow();
  // Bold and highlight the "PERT Mean" header (cell J1)
  newSheet.getRange(1, 10).setFontWeight('bold').setBackground('#d1e7dd');
  // Highlight the "PERT Mean" data cells (from row 2 onward)
  if (lastRow > 1) { // Ensure there are data rows
    newSheet.getRange(2, 10, lastRow - 1, 1).setBackground('#d1e7dd'); // Light green
  }
}

/**
 * Generates 100-point arrays for each distribution type for plotting.
 * @param {string} type - Distribution type (TRIANGLE, PERT, BETA, MC_UNSMOOTHED, MC_SMOOTHED, CDF).
 * @param {number} min - Minimum value (best case).
 * @param {number} mode - Mode (most likely).
 * @param {number} max - Maximum value (worst case).
 * @param {number} [alpha] - Alpha parameter for PERT/Beta.
 * @param {number} [beta] - Beta parameter for PERT/Beta.
 * @param {Array} [samples] - Monte Carlo samples for MC distributions.
 * @returns {Array} Array of points with x (value), y (density/probability), and confidence.
 */
function generateDistributionPoints(type, min, mode, max, alpha, beta, samples) {
  const points = [];
  if (type === 'TRIANGLE') {
    for (let p = 1; p <= 100; p++) {
      const percentile = p / 100;
      let low = min, high = max, precision = 0.01;
      while (high - low > precision) {
        const mid = (low + high) / 2;
        if (triangleCdf(mid, min, mode, max) < percentile) {
          low = mid;
        } else {
          high = mid;
        }
      }
      const x = (low + high) / 2;
      const y = trianglePdf(x, min, mode, max);
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'PERT' || type === 'BETA') {
    // Use linear interpolation for 100 points based on Beta parameters
    const range = max - min;
    for (let p = 1; p <= 100; p++) {
      const scaled = (p - 1) / 99; // 0 to 1 over 100 points
      const x = min + scaled * range;
      const y = betaPdf((x - min) / range, alpha, beta) / range;
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'MC_UNSMOOTHED') {
    const percentiles = createConfidencePercentiles(samples);
    for (let p = 1; p <= 100; p++) {
      const x = percentiles[p];
      const y = betaPdf((x - min) / (max - min), alpha, beta) / (max - min);
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'MC_SMOOTHED') {
    const percentiles = createSmoothedConfidencePercentiles(samples);
    for (let p = 1; p <= 100; p++) {
      const x = percentiles[p];
      const y = betaPdf((x - min) / (max - min), alpha, beta) / (max - min);
      points.push({ x: x, y: y, confidence: p });
    }
  } else if (type === 'CDF') {
    for (let p = 1; p <= 100; p++) {
      const percentile = p / 100;
      let low = min, high = max, precision = 0.01;
      while (high - low > precision) {
        const mid = (low + high) / 2;
        if (triangleCdf(mid, min, mode, max) < percentile) {
          low = mid;
        } else {
          high = mid;
        }
      }
      const x = (low + high) / 2;
      const y = p / 100;
      points.push({ x: x, y: y, confidence: p });
    }
  }
  return points;
}

/**
 * SECTION 7: PLOT-RELATED FUNCTIONS
 * Manages visualization and data transfer to Plot.html for graphical representation.
 * Purpose: Fetches data from "Estimate Calculations" for charts, tables, and sliders in Plot.html.
 */

/**
 * Fetches properties from "Estimate Calculations" for plotting in Plot.html.
 * Supports both Add-On (modal dialog) and web app (external access) contexts.
 * Modification: Requires sheetId to ensure consistency across Add-On and Web App; removes fallback.
 * @param {string} sheetId - Spreadsheet ID for accessing the correct spreadsheet.
 * @returns {Object} Properties object with metrics and points for visualization.
 */
function getProperties(sheetId) {
  try {
    if (!sheetId) throw new Error('sheetId is required');
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName('Estimate Calculations');
    if (!sheet) throw new Error('The "Estimate Calculations" sheet does not exist.');

    const activeRange = sheet.getActiveRange();
    let rowIndex = activeRange ? activeRange.getRowIndex() : 2;
    if (rowIndex === 1) rowIndex = 2;

    const data = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!data || data.length === 0) throw new Error('No data found.');

    const [
      name, bestCase, mostLikely, worstCase,
      triangleMean, triangleVariance, triangleSkewness, triangleKurtosis, trianglePointsJSON,
      pertMean, pertStdDev, pertVariance, pertSkewness, pertKurtosis, pertPointsJSON,
      betaMean, betaVariance, betaSkewness, betaKurtosis, alpha, beta, betaMode, betaPointsJSON,
      mcUnsmoothedMean, mcUnsmoothedVariance, mcUnsmoothedSkewness, mcUnsmoothedKurtosis, mcUnsmoothedVaR90, mcUnsmoothedCVaR90, mcUnsmoothedMAD, mcUnsmoothedPointsJSON,
      mcSmoothedMean, mcSmoothedVariance, mcSmoothedSkewness, mcSmoothedKurtosis, mcSmoothedVaR90, mcSmoothedCVaR90, mcSmoothedMAD, mcSmoothedPointsJSON,
      weightedConservative, weightedNeutral, weightedOptimistic,
      probExceedPertMeanBeta, probExceedPertMeanUnsmoothed, probExceedPertMeanSmoothed,
      cdfPointsJSON
    ] = data;

    return {
      MIN: parseFloat(bestCase),
      MOST_LIKELY: parseFloat(mostLikely),
      MAX: parseFloat(worstCase),
      TRIANGLE_MEAN: parseFloat(triangleMean),
      TRIANGLE_VARIANCE: parseFloat(triangleVariance),
      TRIANGLE_SKEWNESS: parseFloat(triangleSkewness),
      TRIANGLE_KURTOSIS: parseFloat(triangleKurtosis),
      TRIANGLE_POINTS: JSON.parse(trianglePointsJSON || "[]"),
      PERT_MEAN: parseFloat(pertMean),
      PERT_STD: parseFloat(pertStdDev),
      PERT_VARIANCE: parseFloat(pertVariance),
      PERT_SKEWNESS: parseFloat(pertSkewness),
      PERT_KURTOSIS: parseFloat(pertKurtosis),
      PERT_POINTS: JSON.parse(pertPointsJSON || "[]"),
      BETA_MEAN: parseFloat(betaMean),
      BETA_VARIANCE: parseFloat(betaVariance),
      BETA_SKEWNESS: parseFloat(betaSkewness),
      BETA_KURTOSIS: parseFloat(betaKurtosis),
      ALPHA: parseFloat(alpha),
      BETA: parseFloat(beta),
      BETA_MODE: parseFloat(betaMode),
      BETA_POINTS: JSON.parse(betaPointsJSON || "[]"),
      MC_UNSMOOTHED_MEAN: parseFloat(mcUnsmoothedMean),
      MC_UNSMOOTHED_VARIANCE: parseFloat(mcUnsmoothedVariance),
      MC_UNSMOOTHED_SKEWNESS: parseFloat(mcUnsmoothedSkewness),
      MC_UNSMOOTHED_KURTOSIS: parseFloat(mcUnsmoothedKurtosis),
      MC_UNSMOOTHED_VaR_90: parseFloat(mcUnsmoothedVaR90),
      MC_UNSMOOTHED_CVaR_90: parseFloat(mcUnsmoothedCVaR90),
      MC_UNSMOOTHED_MAD: parseFloat(mcUnsmoothedMAD),
      MC_UNSMOOTHED_POINTS: JSON.parse(mcUnsmoothedPointsJSON || "[]"),
      MC_SMOOTHED_MEAN: parseFloat(mcSmoothedMean),
      MC_SMOOTHED_VARIANCE: parseFloat(mcSmoothedVariance),
      MC_SMOOTHED_SKEWNESS: parseFloat(mcSmoothedSkewness),
      MC_SMOOTHED_KURTOSIS: parseFloat(mcSmoothedKurtosis),
      MC_SMOOTHED_VaR_90: parseFloat(mcSmoothedVaR90),
      MC_SMOOTHED_CVaR_90: parseFloat(mcSmoothedCVaR90),
      MC_SMOOTHED_MAD: parseFloat(mcSmoothedMAD),
      MC_SMOOTHED_POINTS: JSON.parse(mcSmoothedPointsJSON || "[]"),
      WEIGHTED_CONSERVATIVE: parseFloat(weightedConservative),
      WEIGHTED_NEUTRAL: parseFloat(weightedNeutral),
      WEIGHTED_OPTIMISTIC: parseFloat(weightedOptimistic),
      PROB_EXCEED_PERT_MEAN_BETA: parseFloat(probExceedPertMeanBeta),
      PROB_EXCEED_PERT_MEAN_MC_UNSMOOTHED: parseFloat(probExceedPertMeanUnsmoothed),
      PROB_EXCEED_PERT_MEAN_MC_SMOOTHED: parseFloat(probExceedPertMeanSmoothed),
      CDF_POINTS: JSON.parse(cdfPointsJSON || "[]")
    };
  } catch (error) {
    console.error('Error in getProperties:', error.message);
    throw error;
  }
}

/**
 * SECTION 8: WEB APP INTEGRATION
 * Handles HTTP requests for integration with a custom GPT in ChatGPT.
 * Purpose: Allows external task data submission (manual or CSV/Excel) and serves Plot.html.
 * Note: Does not affect Add-On functionality (Sections 1-7).
 */

/**
 * Show the HTML form when user opens the Web App, or auto-create the Sheet if ?sheetId= is provided.
 */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.sheetId) {
      // Directly display Plot.html for a specific Sheet ID
      return HtmlService.createHtmlOutputFromFile('Plot')
        .setTitle("PERT Estimate Plot")
        .append('<script>var sheetId = "' + e.parameter.sheetId + '";</script>');
    }

    if (e && e.parameter && e.parameter.data) {
      // Instead of auto-creating the sheet, pass data to the form for user review
      const tasks = JSON.parse(e.parameter.data);
      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new Error("Invalid or empty tasks array.");
      }

      const template = HtmlService.createTemplateFromFile('submit');
      template.prefillData = tasks;
      return template.evaluate().setTitle("Review and Submit Estimates");
    }

    // No params = blank form
    return HtmlService.createHtmlOutputFromFile('submit')
      .setTitle("Submit Your Estimates");

  } catch (error) {
    console.error("Error in doGet:", error);
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Called by google.script.run from the form.
 * Creates the Spreadsheet and returns URLs.
 * @param {Array} tasks - array of {taskName, bestCase, mostLikely, worstCase}
 * @returns {Object} { sheetUrl, plotUrl }
 */
function createEstimateSheet(tasks) {
  if (!tasks || tasks.length === 0) {
    throw new Error("No tasks provided.");
  }

  const spreadsheet = SpreadsheetApp.create("Project Estimates");
  const sheet = spreadsheet.getActiveSheet();
  sheet.clear();

  // Column headers
  sheet.getRange("A1:E1").setValues([
    ["Name", "best_case", "most_likely", "worst_case", "SelectedForPlot"]
  ]);

  tasks.forEach((task, i) => {
    sheet.getRange(i + 2, 1, 1, 5).setValues([
      [task.taskName, task.bestCase, task.mostLikely, task.worstCase, task.selectedForPlot ? "TRUE" : "FALSE"]
    ]);
  });

  SpreadsheetApp.setActiveSpreadsheet(spreadsheet);

  // This adds the Estimate Calculations sheet
  addPERTColumns();

  // Get the Estimate Calculations sheet
  const calcSheet = spreadsheet.getSheetByName('Estimate Calculations');

  // You can optionally set it as active if you want, but it's not required
  // spreadsheet.setActiveSheet(calcSheet);

  // Prepare the URLs
  const sheetId = spreadsheet.getId();

  // ✅ This is the ONLY change: append the gid of the Estimate Calculations sheet
  const sheetUrl = spreadsheet.getUrl() + "#gid=" + calcSheet.getSheetId();

  const plotUrl = ScriptApp.getService().getUrl() + "?sheetId=" + sheetId;

  return {
    sheetUrl: sheetUrl,
    plotUrl: plotUrl
  };
}





/**
 * Handles POST requests to auto-create a sheet without showing a form.
 * Useful for fully automated GPT integrations.
 * Expects JSON in ?data= parameter.
 * @param {Object} e - HTTP event
 * @returns {TextOutput} - JSON containing { sheetUrl, plotUrl }
 */
/**
 * Handles POST requests to auto-create a sheet without showing a form.
 * Useful for fully automated GPT integrations.
 * Expects JSON in ?data= parameter.
 * @param {Object} e - HTTP event
 * @returns {TextOutput} - JSON containing { sheetUrl, plotUrl }
 */
function doPost(e) {
  try {
    if (!e || !e.parameter || !e.parameter.data) {
      throw new Error("Missing data parameter.");
    }

    const tasks = JSON.parse(e.parameter.data);
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error("Invalid or empty tasks array.");
    }

    const spreadsheet = SpreadsheetApp.create("Project Estimates");
    const sheet = spreadsheet.getActiveSheet();
    sheet.clear();

    // Column headers
    sheet.getRange("A1:E1").setValues([
      ["Name", "best_case", "most_likely", "worst_case", "SelectedForPlot"]
    ]);

    tasks.forEach((task, i) => {
      sheet.getRange(i + 2, 1, 1, 5).setValues([
        [task.taskName, task.bestCase, task.mostLikely, task.worstCase, task.selectedForPlot ? "TRUE" : "FALSE"]
      ]);
    });

    spreadsheet.setActiveSheet(sheet);

    addPERTColumns();

    const calcSheet = spreadsheet.getSheetByName('Estimate Calculations');
    spreadsheet.setActiveSheet(calcSheet);

    const sheetId = spreadsheet.getId();
    const plotUrl = ScriptApp.getService().getUrl() + "?sheetId=" + sheetId;

    const result = {
      sheetUrl: spreadsheet.getUrl(),
      plotUrl: plotUrl
    };

    return ContentService.createTextOutput(
      JSON.stringify(result)
    ).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    console.error("Error in doPost:", error);
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
