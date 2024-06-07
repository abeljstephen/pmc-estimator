/**
 * Adds a custom menu to the Google Sheets UI.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Menu')
    .addItem('Add PERT Columns', 'addPERTColumns')
    .addItem('Plot', 'showPlotDialog')
    .addToUi();
}

/**
 * Adds PERT columns and calculates their values.
 */
function addPERTColumns() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getDataRange();
  var values = range.getValues();

  // Get the header row
  var headers = values[0];
  
  // Check if PERT columns exist
  var pertMeanCol = headers.indexOf('PERT Mean');
  var pertStdDevCol = headers.indexOf('PERT Standard Deviation');
  var monteCarlo90thCol = headers.indexOf('Monte Carlo 90th Percentile');
  
  // Add PERT columns if they don't exist
  if (pertMeanCol == -1) {
    sheet.getRange(1, headers.length + 1).setValue('PERT Mean');
    pertMeanCol = headers.length;
  }
  if (pertStdDevCol == -1) {
    sheet.getRange(1, headers.length + 2).setValue('PERT Standard Deviation');
    pertStdDevCol = headers.length + 1;
  }
  if (monteCarlo90thCol == -1) {
    sheet.getRange(1, headers.length + 3).setValue('Monte Carlo 90th Percentile');
    monteCarlo90thCol = headers.length + 2;
  }

  // Calculate and set PERT values for each row
  for (var i = 1; i < values.length; i++) {
    var bestCase = values[i][1];
    var mostLikely = values[i][2];
    var worstCase = values[i][3];
    
    var pertMean = (bestCase + 4 * mostLikely + worstCase) / 6;
    var pertStdDev = (worstCase - bestCase) / 6;

    var monteCarlo90th = monteCarlo90thPercentile(pertMean, pertStdDev);
    
    sheet.getRange(i + 1, pertMeanCol + 1).setValue(pertMean);
    sheet.getRange(i + 1, pertStdDevCol + 1).setValue(pertStdDev);
    sheet.getRange(i + 1, monteCarlo90thCol + 1).setValue(monteCarlo90th);
  }
}

/**
 * Calculate Monte Carlo 90th percentile for a specific row.
 */
function monteCarlo90thPercentile(mean, stdDev) {
  var simulations = 10000;
  var results = [];
  var seed = 123; // Fixed seed for reproducibility
  var random = new Random(seed);

  for (var i = 0; i < simulations; i++) {
    results.push(randomGaussian(mean, stdDev, random));
  }

  results.sort(function(a, b) { return a - b; });
  var index = Math.floor(0.9 * simulations);
  return results[index];
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
 * Opens the Plot dialog.
 */
function showPlotDialog() {
  var html = HtmlService.createHtmlOutputFromFile('Plot')
      .setWidth(900)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Beta Distribution Plot');
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
  
  return {
    PERT_MEAN: pertMean.toString(),
    PERT_STD: pertStdDev.toString(),
    MIN: bestCase.toString(),
    MAX: worstCase.toString()
  };
}

