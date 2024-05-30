/**
 * Adds a custom menu to the Google Sheets UI.
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('Custom Menu')
    .addItem('Plot Gaussian', 'openGaussianPlot')
    .addToUi();
}

/**
 * Opens the Gaussian plot dialog.
 */
function openGaussianPlot() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var range = sheet.getActiveRange();
  var values = range.getValues();

  // Assuming the selected range contains the mean, stddev, and 90th percentile in the first row.
  var pert_mean = values[0][0];
  var pert_std = values[0][1];
  var monte_carlo_90th = values[0][2];

  PropertiesService.getDocumentProperties().setProperties({
    'PERT_MEAN': pert_mean,
    'PERT_STD': pert_std,
    'MONTE_CARLO_90TH': monte_carlo_90th
  });

  var htmlOutput = HtmlService.createHtmlOutputFromFile('GaussianPlot')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, 'Gaussian Plot');
}

/**
 * Returns the properties for the Gaussian plot.
 */
function getProperties() {
  var properties = PropertiesService.getDocumentProperties().getProperties();
  return properties;
}

/**
 * Calculates the PERT Mean.
 * @param {number} best_case The best case estimate.
 * @param {number} most_likely The most likely estimate.
 * @param {number} worst_case The worst case estimate.
 * @return The PERT mean.
 * @customfunction
 */
function PERT_MEAN(best_case, most_likely, worst_case) {
  return (best_case + 4 * most_likely + worst_case) / 6;
}

/**
 * Calculates the PERT Standard Deviation.
 * @param {number} best_case The best case estimate.
 * @param {number} worst_case The worst case estimate.
 * @return The PERT standard deviation.
 * @customfunction
 */
function PERT_STD_DEV(best_case, worst_case) {
  return (worst_case - best_case) / 6;
}

/**
 * Generates a random value based on Gaussian distribution.
 * @param {number} mean The mean of the distribution.
 * @param {number} stddev The standard deviation of the distribution.
 * @return A random value following Gaussian distribution.
 */
function randomGaussian(mean, stddev) {
  var u1 = Math.random();
  var u2 = Math.random();
  var z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return z0 * stddev + mean;
}

/**
 * Performs Monte Carlo simulation to find the 90th percentile.
 * @param {number} mean The mean value.
 * @param {number} stddev The standard deviation value.
 * @return The 90th percentile value from the Monte Carlo simulation.
 * @customfunction
 */
function MONTE_CARLO_90TH(mean, stddev) {
  var simulations = 10000;
  var results = [];
  for (var i = 0; i < simulations; i++) {
    results.push(randomGaussian(mean, stddev));
  }
  results.sort(function(a, b) { return a - b; });
  var index = Math.floor(0.9 * simulations);
  return results[index];
}

/**
 * Wrapper function to calculate the PERT Mean, Standard Deviation, and Monte Carlo 90th percentile.
 * @param {number} best_case The best case estimate.
 * @param {number} most_likely The most likely estimate.
 * @param {number} worst_case The worst case estimate.
 * @return An array with PERT Mean, Standard Deviation, and Monte Carlo 90th percentile.
 * @customfunction
 */
function PERT_CALCULATION(best_case, most_likely, worst_case) {
  var mean = PERT_MEAN(best_case, most_likely, worst_case);
  var stddev = PERT_STD_DEV(best_case, worst_case);
  var percentile_90 = MONTE_CARLO_90TH(mean, stddev);
  return [mean, stddev, percentile_90];
}
