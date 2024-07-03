/**
* Adds a custom menu to the Google Sheets UI.
*/
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Menu')
    .addItem('Add PERT Columns', 'addPERTColumns')
    .addItem('Plot: (A) Run "Add PERT Columns" (above) (B) select 3 values [best,worst,likely](C) Click this Plot:...', 'showPlotDialog')
    .addToUi();
}

function addPERTColumns() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getDataRange();
  var values = range.getValues();
  // Get the header row
  var headers = values[0];
  // Check if PERT columns exist
  var pertMeanCol = headers.indexOf('PERT Mean');
  var pertStdDevCol = headers.indexOf('PERT Standard Deviation');
  var normalModeCol = headers.indexOf('Mode after Monte Carlo on Normal');
  var monteCarlo90thCol = headers.indexOf('90th Percentile after Monte Carlo on Normal');
  var betaModeCol = headers.indexOf('Mode of Beta');
  var monteCarloBetaModeCol = headers.indexOf('Mode after Monte Carlo on Beta Distribution');
  var monteCarlo90thBetaCol = headers.indexOf('90th Percentile after Monte Carlo on Beta');
  var betaModeInterpretationCol = headers.indexOf('Recommendation');
  // Add PERT columns if they don't exist
  if (pertMeanCol == -1) {
    sheet.getRange(1, headers.length + 1).setValue('PERT Mean');
    pertMeanCol = headers.length;
  }
  if (pertStdDevCol == -1) {
    sheet.getRange(1, headers.length + 2).setValue('PERT Standard Deviation');
    pertStdDevCol = headers.length + 1;
  }
  if (normalModeCol == -1) {
    sheet.getRange(1, headers.length + 3).setValue('Mode after Monte Carlo on Normal');
    normalModeCol = headers.length + 2;
  }
  if (monteCarlo90thCol == -1) {
    sheet.getRange(1, headers.length + 4).setValue('90th Percentile after Monte Carlo on Normal');
    monteCarlo90thCol = headers.length + 3;
  }
  if (betaModeCol == -1) {
    sheet.getRange(1, headers.length + 5).setValue('Mode of Beta');
    betaModeCol = headers.length + 4;
  }
  if (monteCarloBetaModeCol == -1) {
    sheet.getRange(1, headers.length + 6).setValue('Mode after Monte Carlo on Beta Distribution');
    monteCarloBetaModeCol = headers.length + 5;
  }
  if (monteCarlo90thBetaCol == -1) {
    sheet.getRange(1, headers.length + 7).setValue('90th Percentile after Monte Carlo on Beta');
    monteCarlo90thBetaCol = headers.length + 6;
  }
  if (betaModeInterpretationCol == -1) {
    sheet.getRange(1, headers.length + 8).setValue('Recommendation');
    betaModeInterpretationCol = headers.length + 7;
  }
  // Calculate and set PERT values for each row
  for (var i = 1; i < values.length; i++) {
    var bestCase = values[i][1];
    var mostLikely = values[i][2];
    var worstCase = values[i][3];
    var pertMean = (bestCase + 4 * mostLikely + worstCase) / 6;
    var pertStdDev = (worstCase - bestCase) / 6;
    var monteCarlo90th = monteCarlo90thPercentile(pertMean, pertStdDev);
    var normalMode = calculateMode(monteCarloSamples(pertMean, pertStdDev));
    var alpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
    var beta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);
    var betaMode = calculateBetaMode(alpha, beta, bestCase, worstCase);
    var monteCarloBetaSamples = monteCarloSamplesBeta(alpha, beta, bestCase, worstCase);
    var monteCarloBetaMode = calculateMode(monteCarloBetaSamples);
    var monteCarlo90thBeta = calculatePercentile(monteCarloBetaSamples, 90);
    var betaModeInterpretation = interpretBetaMode(mostLikely, monteCarloBetaMode, monteCarlo90thBeta, monteCarloBetaSamples);
    sheet.getRange(i + 1, pertMeanCol + 1).setValue(pertMean);
    sheet.getRange(i + 1, pertStdDevCol + 1).setValue(pertStdDev);
    sheet.getRange(i + 1, normalModeCol + 1).setValue(normalMode);
    sheet.getRange(i + 1, monteCarlo90thCol + 1).setValue(monteCarlo90th);
    sheet.getRange(i + 1, betaModeCol + 1).setValue(betaMode);
    sheet.getRange(i + 1, monteCarloBetaModeCol + 1).setValue(monteCarloBetaMode);
    sheet.getRange(i + 1, monteCarlo90thBetaCol + 1).setValue(monteCarlo90thBeta);
    sheet.getRange(i + 1, betaModeInterpretationCol + 1).setValue(betaModeInterpretation);
  }

  // Call the copyCalculations function after all calculations are done
  copyCalculations();
}

/**
* Copy specific columns to a new tab called "Estimate Calculations" and remove certain columns from the original sheet.
*/
function copyCalculations() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();

  // Check if the original sheet exists
  if (!sheet) {
    Logger.log('Active sheet not found');
    return;
  }

  var newSheet = spreadsheet.getSheetByName('Estimate Calculations');

  // If the new sheet exists, delete it
  if (newSheet) {
    spreadsheet.deleteSheet(newSheet);
  }

  // Create the new sheet
  newSheet = spreadsheet.insertSheet('Estimate Calculations');

  // Define the columns to be copied
  var columnsToCopy = [
    'Name', 'best_case', 'most_likely', 'worst_case',
    'PERT Mean', 'PERT Standard Deviation',
    'Mode after Monte Carlo on Normal', '90th Percentile after Monte Carlo on Normal',
    'Mode of Beta', 'Mode after Monte Carlo on Beta Distribution',
    '90th Percentile after Monte Carlo on Beta', 'Recommendation'
  ];

  // Get the header row
  var headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Find the indices of the columns to copy
  var columnIndices = columnsToCopy.map(col => headerRow.indexOf(col) + 1);

  // Check if all columns to copy are found
  if (columnIndices.includes(0)) {
    Logger.log('One or more columns to copy not found');
    return;
  }

  // Copy the header row
  columnIndices.forEach((colIndex, i) => {
    newSheet.getRange(1, i + 1).setValue(headerRow[colIndex - 1]);
  });

  // Copy the data rows
  for (var rowIndex = 2; rowIndex <= sheet.getLastRow(); rowIndex++) {
    columnIndices.forEach((colIndex, i) => {
      var value = sheet.getRange(rowIndex, colIndex).getValue();
      newSheet.getRange(rowIndex, i + 1).setValue(value);
    });
  }

  // Remove specified columns from the original sheet
  var columnsToRemove = [
    'PERT Mean', 'PERT Standard Deviation',
    'Mode after Monte Carlo on Normal', '90th Percentile after Monte Carlo on Normal',
    'Mode of Beta', 'Mode after Monte Carlo on Beta Distribution',
    '90th Percentile after Monte Carlo on Beta'
  ];

  var removeColumnIndices = columnsToRemove.map(col => headerRow.indexOf(col) + 1).sort((a, b) => b - a);

  removeColumnIndices.forEach(colIndex => {
    sheet.deleteColumn(colIndex);
  });

  // Activate the original sheet
  sheet.activate();
}

/**
* Calculate Monte Carlo 90th percentile for a specific row.
*/
function monteCarlo90thPercentile(mean, stdDev) {
  var results = monteCarloSamples(mean, stdDev);
  results.sort(function(a, b) { return a - b; });
  var index = Math.floor(0.9 * results.length);
  return results[index];
}

/**
* Generate Monte Carlo samples using Gaussian distribution.
*/
function monteCarloSamples(mean, stdDev) {
  var simulations = 10000;
  var results = [];
  var seed = 123; // Fixed seed for reproducibility
  var random = new Random(seed);
  for (var i = 0; i < simulations; i++) {
    results.push(randomGaussian(mean, stdDev, random));
  }
  return results;
}

/**
* Generate Monte Carlo samples using Beta distribution.
*/
function monteCarloSamplesBeta(alpha, beta, min, max) {
  var simulations = 10000;
  var results = [];
  var seed = 123; // Fixed seed for reproducibility
  var random = new Random(seed);
  for (var i = 0; i < simulations; i++) {
    var sample = betaSample(alpha, beta, random);
    results.push(sample * (max - min) + min);
  }
  return results;
}

/**
* Generate a random value based on Gaussian distribution.
*/
function randomGaussian(mean, stddev, random) {
  var u1 = random.next();
  var u2 = random.next();
  var z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stddev + mean;
}

/**
* Random number generator with seed for reproducibility.
*/
function Random(seed) {
  this.seed = seed;
}
Random.prototype.next = function() {
  var x = Math.sin(this.seed++) * 10000;
  return x - Math.floor(x);
};

/**
* Calculate mode of a dataset.
*/
function calculateMode(samples) {
  var frequency = {};
  var maxFreq = 0;
  var mode;
  samples.forEach(function(sample) {
    var rounded = Math.round(sample * 100) / 100; // Round to 2 decimal places for frequency calculation
    frequency[rounded] = (frequency[rounded] || 0) + 1;
    if (frequency[rounded] > maxFreq) {
      maxFreq = frequency[rounded];
      mode = rounded;
    }
  });
  return mode;
}

/**
* Calculate alpha parameter for Beta distribution.
*/
function calculateAlpha(mean, stdDev, min, max) {
  var range = max - min;
  var meanScaled = (mean - min) / range;
  var varianceScaled = Math.pow(stdDev / range, 2);
  return meanScaled * (meanScaled * (1 - meanScaled) / varianceScaled - 1);
}

/**
* Calculate beta parameter for Beta distribution.
*/
function calculateBeta(mean, stdDev, min, max) {
  var range = max - min;
  var meanScaled = (mean - min) / range;
  var varianceScaled = Math.pow(stdDev / range, 2);
  return (1 - meanScaled) * (meanScaled * (1 - meanScaled) / varianceScaled - 1);
}

/**
* Calculate mode of Beta distribution.
*/
function calculateBetaMode(alpha, beta, min, max) {
  return ((alpha - 1) / (alpha + beta - 2)) * (max - min) + min;
}

/**
* Generate a random value based on Beta distribution.
*/
function betaSample(alpha, beta, random) {
  var x = gammaSample(alpha, random);
  var y = gammaSample(beta, random);
  return x / (x + y);
}

/**
* Generate a random value based on Gamma distribution.
*/
function gammaSample(shape, random) {
  if (shape < 1) {
    shape += 1;
    var u = random.next();
    return gammaSample(shape, random) * Math.pow(u, 1 / shape);
  }
  var d = shape - 1 / 3;
  var c = 1 / Math.sqrt(9 * d);
  while (true) {
    var x = randomGaussian(0, 1, random);
    var v = Math.pow(1 + c * x, 3);
    var u = random.next();
    if (u < 1 - 0.0331 * Math.pow(x, 4)) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * Math.pow(x, 2) + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
* Calculate the confidence level for a given value in a sorted array.
*/
function getConfidenceLevelForValue(value, sortedArray) {
  var rank = sortedArray.findIndex(val => val >= value) / sortedArray.length;
  return rank * 100;
}

/**
* Interpret the beta mode based on the difference from the most likely value.
*/
function interpretBetaMode(mostLikely, monteCarloBetaMode, monteCarlo90thBeta, monteCarloBetaSamples) {
  var diffPercent = ((monteCarloBetaMode - mostLikely) / mostLikely) * 100;
  var comparison = diffPercent >= 0 ? "more" : "less";
  var diffSign = diffPercent >= 0 ? "" : "-";
  diffPercent = Math.abs(diffPercent);
  monteCarloBetaSamples.sort((a, b) => a - b);
  var modeConfidence = getConfidenceLevelForValue(monteCarloBetaMode, monteCarloBetaSamples);
  return `Simulations indicate this item is most likely to take around ${monteCarloBetaMode.toFixed(2)} units, which is ${diffSign}${diffPercent.toFixed(2)}% ${comparison} than the initial estimate of ${mostLikely.toFixed(2)} units. Recommended value is between ${monteCarloBetaMode.toFixed(2)} units (${modeConfidence.toFixed(2)}% confidence) and ${monteCarlo90thBeta.toFixed(2)} units (90% confidence).`;
}

/**
* Opens the Plot dialog.
*/
function showPlotDialog() {
  var html = HtmlService.createHtmlOutputFromFile('Plot')
      .setWidth(900)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Distribution Plots');
}

/**
* Get properties for the plot.
*/
function getProperties() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getActiveRange();
  var values = range.getValues();
  var bestCase = values[0][0];
  var mostLikely = values[0][1];
  var worstCase = values[0][2];
  var pertMean = (bestCase + 4 * mostLikely + worstCase) / 6;
  var pertStdDev = (worstCase - bestCase) / 6;
  var alpha = calculateAlpha(pertMean, pertStdDev, bestCase, worstCase);
  var beta = calculateBeta(pertMean, pertStdDev, bestCase, worstCase);
  var betaMode = calculateBetaMode(alpha, beta, bestCase, worstCase);
  var monteCarloBetaSamples = monteCarloSamplesBeta(alpha, beta, bestCase, worstCase);
  var monteCarloBetaMode = calculateMode(monteCarloBetaSamples);
  var monteCarlo90thBeta = calculatePercentile(monteCarloBetaSamples, 90);
  var recommendation = interpretBetaMode(mostLikely, monteCarloBetaMode, monteCarlo90thBeta, monteCarloBetaSamples);

  return {
    PERT_MEAN: pertMean.toString(),
    PERT_STD: pertStdDev.toString(),
    MIN: bestCase.toString(),
    MAX: worstCase.toString(),
    MOST_LIKELY: mostLikely.toString(),
    ALPHA: alpha.toString(),
    BETA: beta.toString(),
    BETA_MODE: betaMode.toString(),
    MONTE_CARLO_BETA_SAMPLES: JSON.stringify(monteCarloBetaSamples),
    MONTE_CARLO_BETA_MODE: monteCarloBetaMode.toString(),
    RECOMMENDATION: recommendation
  };
}

/**
* Calculate a specific percentile of a sorted array.
*/
function calculatePercentile(arr, p) {
  var index = (p / 100) * (arr.length - 1);
  var lower = Math.floor(index);
  var upper = Math.ceil(index);
  var weight = index % 1;
  return arr[lower] * (1 - weight) + arr[upper] * weight;
}

