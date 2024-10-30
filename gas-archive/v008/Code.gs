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
 
function checkAndAddPERTColumns() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  
  // Check if "Estimate Calculations" sheet exists and delete it if it does
  var sheet = spreadsheet.getSheetByName('Estimate Calculations');
  if (sheet) {
    spreadsheet.deleteSheet(sheet);

    // Poll to confirm the sheet has been deleted
    while (spreadsheet.getSheetByName('Estimate Calculations')) {
      Utilities.sleep(100); // Wait for 100 milliseconds before checking again
    }

    // Additional delay to ensure the deletion process completes
    Utilities.sleep(500);
  }

  // Now call the function to add PERT columns
  addPERTColumns();
}

function addPERTColumns() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getActiveSheet();

  // Check if "Temp_Estimate_Calculations" sheet exists and delete it if it does
  var tempSheet = spreadsheet.getSheetByName('Temp_Estimate_Calculations');
  if (tempSheet) {
    spreadsheet.deleteSheet(tempSheet);

    // Ensure it's fully deleted before creating a new one
    Utilities.sleep(500);
  }

  // Insert a new sheet with the temporary name
  var newSheet = spreadsheet.insertSheet('Temp_Estimate_Calculations');

  var range = sheet.getDataRange();
  var values = range.getValues();

  // Define columns to be copied
  var columnsToCopy = ['Name', 'best_case', 'most_likely', 'worst_case'];
  var headers = values[0];
  var columnIndices = columnsToCopy.map(col => headers.indexOf(col) + 1);

  // Check if all columns to copy are found
  if (columnIndices.includes(0)) {
    Logger.log('One or more columns to copy not found');
    return;
  }

  // Copy headers
  columnsToCopy.forEach((col, i) => {
    newSheet.getRange(1, i + 1).setValue(col);
  });

  // Copy data
  for (var i = 1; i < values.length; i++) {
    columnIndices.forEach((colIndex, j) => {
      newSheet.getRange(i + 1, j + 1).setValue(values[i][colIndex - 1]);
    });
  }

  // Calculate and set additional columns in 'Estimate Calculations'
  var additionalHeaders = [
    'PERT Mean',
    'PERT Standard Deviation',
    'Mode after Monte Carlo on Normal',
    '90th Percentile after Monte Carlo on Normal',
    'Mode of Beta',
    'Mode after Monte Carlo on Beta Distribution',
    '90th Percentile after Monte Carlo on Beta',
    'Recommendation',
    'Confidence Percentiles Array' // New column for confidence percentiles
  ];
  additionalHeaders.forEach((header, idx) => {
    newSheet.getRange(1, columnsToCopy.length + idx + 1).setValue(header);
  });

  // Process each row to calculate additional columns
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
    var monteCarlo90thBeta = calculateBetaPercentile(monteCarloBetaSamples, 90);

    var betaModeInterpretation = interpretBetaMode(mostLikely, monteCarloBetaMode, monteCarlo90thBeta, monteCarloBetaSamples);
    var confidencePercentiles = {};
    for (var j = 1; j <= 100; j++) {
      confidencePercentiles[j] = calculateBetaPercentile(monteCarloBetaSamples, j);
    }
    var confidencePercentilesString = JSON.stringify(confidencePercentiles);
    newSheet.getRange(i + 1, columnsToCopy.length + 1).setValue(pertMean);
    newSheet.getRange(i + 1, columnsToCopy.length + 2).setValue(pertStdDev);
    newSheet.getRange(i + 1, columnsToCopy.length + 3).setValue(normalMode);
    newSheet.getRange(i + 1, columnsToCopy.length + 4).setValue(monteCarlo90th);
    newSheet.getRange(i + 1, columnsToCopy.length + 5).setValue(betaMode);
    newSheet.getRange(i + 1, columnsToCopy.length + 6).setValue(monteCarloBetaMode);
    newSheet.getRange(i + 1, columnsToCopy.length + 7).setValue(monteCarlo90thBeta);
    newSheet.getRange(i + 1, columnsToCopy.length + 8).setValue(betaModeInterpretation);
    newSheet.getRange(i + 1, columnsToCopy.length + 9).setValue(confidencePercentilesString); // Store the array
  }

  // Ensure no existing sheet with the desired name before renaming
  var finalSheetName = 'Estimate Calculations';
  var existingSheet = spreadsheet.getSheetByName(finalSheetName);
  if (existingSheet) {
    spreadsheet.deleteSheet(existingSheet);
    Utilities.sleep(500); // Extra delay to ensure the sheet is fully deleted
  }

  // Rename the temporary sheet to 'Estimate Calculations'
  newSheet.setName(finalSheetName);
}








function getConfidencePercentilesArray() {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Estimate Calculations');
    if (!sheet) {
        throw new Error('The "Estimate Calculations" sheet does not exist.');
    }
    var activeRange = sheet.getActiveRange();
    var rowIndex = activeRange.getRowIndex();
    if (rowIndex === 1) { // If the header row is selected, default to the first data row
        rowIndex = 2;
    }
    var data = sheet.getRange(rowIndex, sheet.getLastColumn()).getValue(); // Get the JSON string from the last column
    return data;
}





/**
* Generate random numbers for Monte Carlo simulations.
*/
function random() {
  return Math.random();
}
 
/**
* Generate Monte Carlo samples using Gaussian distribution.
*/
function monteCarloSamples(mean, stdDev) {
  var simulations = [];
  for (var i = 0; i < 1000; i++) {
    var u1 = random();
    var u2 = random();
    var z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    simulations.push(mean + stdDev * z);
  }
  return simulations;
}
 
/**
* Calculate the 90th percentile of Monte Carlo samples.
*/
function monteCarlo90thPercentile(mean, stdDev) {
  var samples = monteCarloSamples(mean, stdDev);
  samples.sort(function(a, b) { return a - b; });
  var index = Math.floor(0.9 * samples.length);
  return samples[index];
}
 
/**
* Calculate the mode of a set of samples.
*/
function calculateMode(samples) {
  var frequency = {};
  var maxFreq = 0;
  var mode = [];
  for (var i = 0; i < samples.length; i++) {
    var value = samples[i];
    frequency[value] = (frequency[value] || 0) + 1;
    if (frequency[value] > maxFreq) {
      maxFreq = frequency[value];
      mode = [value];
    } else if (frequency[value] === maxFreq) {
      mode.push(value);
    }
  }
  return mode[0];
}
 
/**
* Calculate Beta distribution mode.
*/
function calculateBetaMode(alpha, beta, min, max) {
  if (alpha <= 1 || beta <= 1) {
    console.log(`Alpha or Beta less than or equal to 1. Alpha: ${alpha}, Beta: ${beta}`);
    return (alpha < beta) ? min : max;
  }
  var mode = (alpha - 1) / (alpha + beta - 2);
  return min + mode * (max - min);
}
 
/**
* Calculate Beta distribution parameters (alpha and beta).
*/
function calculateAlpha(mean, stdDev, min, max) {
  var variance = Math.pow(stdDev, 2);
  var commonFactor = (mean - min) * (max - mean) / variance - 1;
  var alpha = commonFactor * (mean - min) / (max - min);
  console.log(`calculateAlpha - mean: ${mean}, stdDev: ${stdDev}, min: ${min}, max: ${max}, alpha: ${alpha}`);
  return alpha;
}
 
function calculateBeta(mean, stdDev, min, max) {
  var variance = Math.pow(stdDev, 2);
  var commonFactor = (mean - min) * (max - mean) / variance - 1;
  var beta = commonFactor * (max - mean) / (max - min);
  console.log(`calculateBeta - mean: ${mean}, stdDev: ${stdDev}, min: ${min}, max: ${max}, beta: ${beta}`);
  return beta;
}
 
/**
* Generate Monte Carlo samples for Beta distribution.
*/
function monteCarloSamplesBeta(alpha, beta, min, max) {
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
* Calculate percentile of Beta distribution samples.
*/
function calculateBetaPercentile(samples, percentile) {
  samples.sort(function(a, b) { return a - b; });
  var index = Math.floor(percentile / 100 * samples.length);
  return samples[index];
}
 
/**
* Interpret Beta Mode with recommended range.
*/
function interpretBetaMode(mostLikely, betaMode, percentile90, betaSamples) {
  var recommendation = `The mode (of the Monte Carlo on the beta distribution is) ${betaMode}. The recommended range is between 50th percentile ${calculateBetaPercentile(betaSamples, 50)} and 90th percentile ${percentile90}.`;
  return recommendation;
}
 
/**
* Show plot dialog.
*/
function showPlotDialog() {
  var html = HtmlService.createHtmlOutputFromFile('Plot')
      .setWidth(800)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Plot');
}
 
/**
 * Get properties for Plot.html.
 */
function getProperties() {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheetName = 'Estimate Calculations';
    var sheet = null;
    var maxRetries = 5;
    var delay = 500;

    // Try to get the sheet, retrying if necessary
    for (var attempt = 1; attempt <= maxRetries; attempt++) {
        sheet = spreadsheet.getSheetByName(sheetName);
        if (sheet) {
            break;  // Sheet found, exit loop
        }
        Logger.log('Attempt ' + attempt + ': Sheet not found, retrying...');
        Utilities.sleep(delay);  // Wait before retrying
    }

    // If the sheet is still not found, throw an error
    if (!sheet) {
        throw new Error('The "' + sheetName + '" sheet does not exist after ' + maxRetries + ' attempts.');
    }

    var activeRange = sheet.getActiveRange();
    var rowIndex = activeRange.getRowIndex();

    // If the header row is selected, default to the first data row
    if (rowIndex === 1) {
        rowIndex = 2;
    }

    var data = sheet.getDataRange().getValues();

    // Calculate the confidence percentiles
    var monteCarloBetaSamples = monteCarloSamplesBeta(
        calculateAlpha(data[rowIndex - 1][4], data[rowIndex - 1][5], data[rowIndex - 1][1], data[rowIndex - 1][3]),
        calculateBeta(data[rowIndex - 1][4], data[rowIndex - 1][5], data[rowIndex - 1][1], data[rowIndex - 1][3]),
        data[rowIndex - 1][1], data[rowIndex - 1][3]
    );

    var confidencePercentiles = {};
    for (var i = 1; i <= 100; i++) {
        confidencePercentiles[i] = calculateBetaPercentile(monteCarloBetaSamples, i);
    }

    var properties = {
        MIN: data[rowIndex - 1][1],
        MAX: data[rowIndex - 1][3],
        MOST_LIKELY: data[rowIndex - 1][2],
        PERT_MEAN: data[rowIndex - 1][4],
        PERT_STD: data[rowIndex - 1][5],
        ALPHA: calculateAlpha(data[rowIndex - 1][4], data[rowIndex - 1][5], data[rowIndex - 1][1], data[rowIndex - 1][3]),
        BETA: calculateBeta(data[rowIndex - 1][4], data[rowIndex - 1][5], data[rowIndex - 1][1], data[rowIndex - 1][3]),
        BETA_MODE: data[rowIndex - 1][8],
        MONTE_CARLO_BETA_SAMPLES: JSON.stringify(monteCarloBetaSamples),
        MONTE_CARLO_BETA_MODE: data[rowIndex - 1][9],
        RECOMMENDATION: data[rowIndex - 1][11],
        CONFIDENCE_PERCENTILES: JSON.stringify(confidencePercentiles) // Pass confidence percentiles
    };

    return properties;
}



 
 


 