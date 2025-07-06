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
    .addItem('PERT', 'addPertColumns')
    .addItem('PLOT', 'showPlot')
    .addToUi();
}


/**
 * Displays a modal dialog for plotting.
 * Utility: Opens the Plot.html interface for visualizing distributions within Google Sheets.
 * Note: Captures the sheetId and rowIndex at the time of opening to retain context.
 */
function showPlot() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var activeRange = sheet.getActiveRange();
  var rowIndex = activeRange ? activeRange.getRow() : 2; // Default to row 2 if no selection
  if (rowIndex < 2) rowIndex = 2; // Ensure row index is at least 2
  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  
  // Log values for debugging
  Logger.log('showPlot: sheetId = ' + sheetId);
  Logger.log('showPlot: sheetName = ' + sheet.getName());
  Logger.log('showPlot: rowIndex = ' + rowIndex);
  
  var html = HtmlService.createHtmlOutputFromFile('Plot')
      .setWidth(1200)
      .setHeight(900);
  
  // Inject sheetId, sheetName, and rowIndex as global variables using JSON.stringify for safety
  html.setContent(
    '<script>' +
    'var sheetId = ' + JSON.stringify(sheetId) + ';' +
    'var sheetName = ' + JSON.stringify(sheet.getName()) + ';' +
    'var rowIndex = ' + JSON.stringify(rowIndex) + ';' +
    '</script>' + html.getContent()
  );
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Distribution Plots');
}

/**
 * Calls the web API to perform estimation calculations.
 * @param {Array} tasks - Array of task objects with task, optimistic, mostLikely, and pessimistic properties.
 * @returns {Object} API response with computed metrics.
 */
function callEstimatorAPI(tasks) {
  const url = 'https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI';
  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: JSON.stringify(tasks),
    muteHttpExceptions: true
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error('API request failed: ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

/**
 * Adds PERT columns to the "Estimate Calculations" sheet using API-provided metrics.
 * Reads data from the first sheet (Name, best_case, most_likely, worst_case),
 * processes it via the API, and writes results to a new or existing sheet.
 */
function addPertColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "Estimate Calculations";
  let sheet = ss.getSheetByName(sheetName);

  // Check if the sheet already exists
  if (sheet) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      "Sheet exists",
      "The sheet '" + sheetName + "' already exists. Do you want to overwrite its content?",
      ui.ButtonSet.YES_NO
    );

    if (response === ui.Button.YES) {
      sheet.clear();
    } else {
      throw new Error("Operation cancelled by user.");
    }
  } else {
    sheet = ss.insertSheet(sheetName);
  }

  // Updated headers to include "Triangle StdDev"
  const headers = [
    "Name", "Best Case", "Most Likely", "Worst Case",
    "Triangle Mean", "Triangle Variance", "Triangle StdDev", "Triangle Skewness", "Triangle Kurtosis", "Triangle Points",
    "PERT Mean", "PERT StdDev", "PERT Variance", "PERT Skewness", "PERT Kurtosis", "PERT Points",
    "Beta Mean", "Beta Variance", "Beta Skewness", "Beta Kurtosis", "Alpha", "Beta", "Beta Mode", "Beta Points",
    "MC On Beta Unsmoothed Mean", "MC On Beta Unsmoothed Variance", "MC On Beta Unsmoothed Skewness", "MC On Beta Unsmoothed Kurtosis", "MC On Beta Unsmoothed VaR 90%", "MC On Beta Unsmoothed CVaR 90%", "MC On Beta Unsmoothed MAD", "MC On Beta Unsmoothed Points",
    "MC On Beta Smoothed Mean", "MC On Beta Smoothed Variance", "MC On Beta Smoothed Skewness", "MC On Beta Smoothed Kurtosis", "MC On Beta Smoothed VaR 90%", "MC On Beta Smoothed CVaR 90%", "MC On Beta Smoothed MAD", "MC On Beta Smoothed Points",
    "Weighted Estimate (Conservative)", "Weighted Estimate (Neutral)", "Weighted Estimate (Optimistic)",
    "Probability Exceeding nanowMean (Beta)", "Probability Exceeding PERT Mean (MC Unsmoothed)", "Probability Exceeding PERT Mean (MC Smoothed)", "CDF Points"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  const firstSheet = ss.getSheets()[0];
  const lastRow = firstSheet.getLastRow();

  if (lastRow < 2) {
    throw new Error("No data found in the first sheet.");
  }

  const dataRange = firstSheet.getRange(2, 1, lastRow - 1, 4);
  const data = dataRange.getValues();

  const tasks = data.map(row => {
    const [name, bestCase, mostLikely, worstCase] = row;
    if (typeof bestCase !== 'number' || typeof mostLikely !== 'number' || typeof worstCase !== 'number') {
      Logger.log(`Skipping row with non-numeric estimates: ${row}`);
      return null;
    }
    return {
      task: name,
      optimistic: bestCase,
      mostLikely: mostLikely,
      pessimistic: worstCase
    };
  }).filter(task => task !== null);

  if (tasks.length === 0) {
    throw new Error("No valid tasks found after filtering.");
  }

  let apiResponse;
  try {
    apiResponse = callEstimatorAPI(tasks);
    Logger.log("API Response: " + JSON.stringify(apiResponse));
  } catch (error) {
    Logger.log('API call failed: ' + error.message);
    throw new Error("Failed to retrieve data from API.");
  }

  const results = apiResponse.results;
  if (!results || !Array.isArray(results)) {
    throw new Error("Invalid API response: 'results' is not an array.");
  }

  results.forEach(result => {
    const rowData = [
      (result.task && result.task.value) ? result.task.value : "N/A",
      (result.bestCase && result.bestCase.value) ? result.bestCase.value : "N/A",
      (result.mostLikely && result.mostLikely.value) ? result.mostLikely.value : "N/A",
      (result.worstCase && result.worstCase.value) ? result.worstCase.value : "N/A",
      (result.triangleMean && result.triangleMean.value) ? result.triangleMean.value : "N/A",
      (result.triangleVariance && result.triangleVariance.value) ? result.triangleVariance.value : "N/A",
      (result.triangleStdDev && result.triangleStdDev.value) ? result.triangleStdDev.value : "N/A",
      (result.triangleSkewness && result.triangleSkewness.value) ? result.triangleSkewness.value : "N/A",
      (result.triangleKurtosis && result.triangleKurtosis.value) ? result.triangleKurtosis.value : "N/A",
      (result.trianglePoints && result.trianglePoints.value) ? JSON.stringify(result.trianglePoints.value) : "N/A",
      (result.pertMean && result.pertMean.value) ? result.pertMean.value : "N/A",
      (result.pertStdDev && result.pertStdDev.value) ? result.pertStdDev.value : "N/A",
      (result.pertVariance && result.pertVariance.value) ? result.pertVariance.value : "N/A",
      (result.pertSkewness && result.pertSkewness.value) ? result.pertSkewness.value : "N/A",
      (result.pertKurtosis && result.pertKurtosis.value) ? result.pertKurtosis.value : "N/A",
      (result.pertPoints && result.pertPoints.value) ? JSON.stringify(result.pertPoints.value) : "N/A",
      (result.betaMean && result.betaMean.value) ? result.betaMean.value : "N/A",
           (result.betaVariance && result.betaVariance.value) ? result.betaVariance.value : "N/A",
      (result.betaSkewness && result.betaSkewness.value) ? result.betaSkewness.value : "N/A",
      (result.betaKurtosis && result.betaKurtosis.value) ? result.betaKurtosis.value : "N/A",
      (result.alpha && result.alpha.value) ? result.alpha.value : "N/A",
      (result.beta && result.beta.value) ? result.beta.value : "N/A",
      (result.betaMode && result.betaMode.value) ? result.betaMode.value : "N/A",
      (result.betaPoints && result.betaPoints.value) ? JSON.stringify(result.betaPoints.value) : "N/A",
      (result.mcMean && result.mcMean.value) ? result.mcMean.value : "N/A",
      (result.mcVariance && result.mcVariance.value) ? result.mcVariance.value : "N/A",
      (result.mcSkewness && result.mcSkewness.value) ? result.mcSkewness.value : "N/A",
      (result.mcKurtosis && result.mcKurtosis.value) ? result.mcKurtosis.value : "N/A",
      (result.mcVaR && result.mcVaR.value) ? result.mcVaR.value : "N/A",
      (result.mcCVaR && result.mcCVaR.value) ? result.mcCVaR.value : "N/A",
      (result.mcMAD && result.mcMAD.value) ? result.mcMAD.value : "N/A",
      (result.mcPoints && result.mcPoints.value) ? JSON.stringify(result.mcPoints.value) : "N/A",
      (result.mcSmoothedMean && result.mcSmoothedMean.value) ? result.mcSmoothedMean.value : "N/A",
      (result.mcSmoothedVariance && result.mcSmoothedVariance.value) ? result.mcSmoothedVariance.value : "N/A",
      (result.mcSmoothedSkewness && result.mcSmoothedSkewness.value) ? result.mcSmoothedSkewness.value : "N/A",
      (result.mcSmoothedKurtosis && result.mcSmoothedKurtosis.value) ? result.mcSmoothedKurtosis.value : "N/A",
      (result.mcSmoothedVaR && result.mcSmoothedVaR.value) ? result.mcSmoothedVaR.value : "N/A",
      (result.mcSmoothedCVaR && result.mcSmoothedCVaR.value) ? result.mcSmoothedCVaR.value : "N/A",
      (result.mcSmoothedMAD && result.mcSmoothedMAD.value) ? result.mcSmoothedMAD.value : "N/A",
      (result.mcSmoothedPoints && result.mcSmoothedPoints.value) ? JSON.stringify(result.mcSmoothedPoints.value) : "N/A",
      (result.weightedConservative && result.weightedConservative.value) ? result.weightedConservative.value : "N/A",
      (result.weightedNeutral && result.weightedNeutral.value) ? result.weightedNeutral.value : "N/A",
      (result.weightedOptimistic && result.weightedOptimistic.value) ? result.weightedOptimistic.value : "N/A",
      (result.probExceedPertMeanBeta && result.probExceedPertMeanBeta.value) ? result.probExceedPertMeanBeta.value : "N/A",
      (result.probExceedPertMeanMCUnsmoothed && result.probExceedPertMeanMCUnsmoothed.value) ? result.probExceedPertMeanMCUnsmoothed.value : "N/A",
      (result.probExceedPertMeanMCSmoothed && result.probExceedPertMeanMCSmoothed.value) ? result.probExceedPertMeanMCSmoothed.value : "N/A",
      (result.cdfPoints && result.cdfPoints.value) ? JSON.stringify(result.cdfPoints.value) : "N/A"
    ];
    sheet.appendRow(rowData);
  });

  const lastRowNew = sheet.getLastRow();
  if (lastRowNew > 1) {
    sheet.getRange(1, 10).setFontWeight('bold').setBackground('#d1e7dd');
    sheet.getRange(2, 10, lastRowNew - 1, 1).setBackground('#d1e7dd');
    sheet.getRange(1, 5).setFontWeight('bold').setBackground('#d1e7dd');
    sheet.getRange(2, 5, lastRowNew - 1, 1).setBackground('#d1e7dd');
    sheet.getRange(1, 16).setFontWeight('bold').setBackground('#d1e7dd');
    sheet.getRange(2, 16, lastRowNew - 1, 1).setBackground('#d1e7dd');
    sheet.getRange(1, 24).setFontWeight('bold').setBackground('#d1e7dd');
    sheet.getRange(2, 24, lastRowNew - 1, 1).setBackground('#d1e7dd');
    sheet.getRange(1, 32).setFontWeight('bold').setBackground('#d1e7dd');
    sheet.getRange(2, 32, lastRowNew - 1, 1).setBackground('#d1e7dd');
    sheet.getRange(1, 39).setFontWeight('bold').setBackground('#d1e7dd');
    sheet.getRange(2, 39, lastRowNew - 1, 1).setBackground('#d1e7dd');
    sheet.getRange(1, 41).setFontWeight('bold').setBackground('#d1e7dd');
    sheet.getRange(2, 41, lastRowNew - 1, 1).setBackground('#d1e7dd');
  }
}

/**
 * Fetches properties from "Estimate Calculations" for plotting in Plot.html.
 * @param {string} sheetId - Spreadsheet ID for accessing the correct spreadsheet.
 * @param {number} rowIndex - Row index to fetch data from, ensuring consistent data retrieval.
 * @returns {Object} Properties object with metrics, points, and task name for visualization.
 */
function getProperties(sheetId, sheetName, rowIndex) {
  try {
    // Log the input parameters for debugging
    Logger.log('getProperties called with sheetId: ' + sheetId + ', sheetName: ' + sheetName + ', rowIndex: ' + rowIndex);

    // Validate input parameters with type checks
    if (typeof sheetId !== 'string' || !sheetId) throw new Error('sheetId must be a non-empty string');
    if (typeof sheetName !== 'string' || !sheetName) throw new Error('sheetName must be a non-empty string');
    if (typeof rowIndex !== 'number' || rowIndex < 2 || !Number.isInteger(rowIndex)) throw new Error('rowIndex must be an integer greater than or equal to 2');

    // Access the spreadsheet and sheet
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" does not exist.`);

    // Check if rowIndex is within the sheet's range
    const lastRow = sheet.getLastRow();
    if (rowIndex > lastRow) throw new Error(`rowIndex ${rowIndex} is out of range; sheet has only ${lastRow} rows`);

    // Helper functions for parsing numbers
    const parseFloatOrDefault = (value, fieldName, defaultValue = 0) => {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? defaultValue : parsed;
    };

    const parseFloatOrThrow = (value, fieldName) => {
      const parsed = parseFloat(value);
      if (isNaN(parsed)) throw new Error(`Invalid value for ${fieldName}: not a number`);
      return parsed;
    };

    // Fetch data from the specified row
    Logger.log('Fetching data from row: ' + rowIndex);
    const data = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (!data || data.length < 45) throw new Error(`Insufficient columns in the row; expected at least 45, got ${data.length}`);

    // Destructure the row data into variables
    const [
      name, bestCase, mostLikely, worstCase,
      triangleMean, triangleVariance, triangleStdDev, triangleSkewness, triangleKurtosis, trianglePointsJSON,
      pertMean, pertStdDev, pertVariance, pertSkewness, pertKurtosis, pertPointsJSON,
      betaMean, betaVariance, betaSkewness, betaKurtosis, alpha, beta, betaMode, betaPointsJSON,
      mcUnsmoothedMean, mcUnsmoothedVariance, mcUnsmoothedSkewness, mcUnsmoothedKurtosis,
      mcUnsmoothedVaR90, mcUnsmoothedCVaR90, mcUnsmoothedMAD, mcUnsmoothedPointsJSON,
      mcSmoothedMean, mcSmoothedVariance, mcSmoothedSkewness, mcSmoothedKurtosis,
      mcSmoothedVaR90, mcSmoothedCVaR90, mcSmoothedMAD, mcSmoothedPointsJSON,
      weightedConservative, weightedNeutral, weightedOptimistic,
      probExceedPertMeanBeta, probExceedPertMeanUnsmoothed, probExceedPertMeanSmoothed,
      cdfPointsJSON
    ] = data;

    // Construct the properties object
    const properties = {
      TASK_NAME: name || "Unnamed Task",
      MIN: parseFloatOrThrow(bestCase, 'bestCase'),
      MOST_LIKELY: parseFloatOrThrow(mostLikely, 'mostLikely'),
      MAX: parseFloatOrThrow(worstCase, 'worstCase'),
      TRIANGLE_MEAN: parseFloatOrThrow(triangleMean, 'triangleMean'),
      TRIANGLE_VARIANCE: parseFloatOrThrow(triangleVariance, 'triangleVariance'),
      TRIANGLE_STD: parseFloatOrThrow(triangleStdDev, 'triangleStdDev'),
      TRIANGLE_SKEWNESS: parseFloatOrDefault(triangleSkewness, 'triangleSkewness'),
      TRIANGLE_KURTOSIS: parseFloatOrThrow(triangleKurtosis, 'triangleKurtosis'),
      TRIANGLE_POINTS: JSON.parse(trianglePointsJSON || "[]"),
      PERT_MEAN: parseFloatOrThrow(pertMean, 'pertMean'),
      PERT_STD: parseFloatOrThrow(pertStdDev, 'pertStdDev'),
      PERT_VARIANCE: parseFloatOrThrow(pertVariance, 'pertVariance'),
      PERT_SKEWNESS: parseFloatOrDefault(pertSkewness, 'pertSkewness'),
      PERT_KURTOSIS: parseFloatOrThrow(pertKurtosis, 'pertKurtosis'),
      PERT_POINTS: JSON.parse(pertPointsJSON || "[]"),
      BETA_MEAN: parseFloatOrThrow(betaMean, 'betaMean'),
      BETA_VARIANCE: parseFloatOrThrow(betaVariance, 'betaVariance'),
      BETA_SKEWNESS: parseFloatOrDefault(betaSkewness, 'betaSkewness'),
      BETA_KURTOSIS: parseFloatOrThrow(betaKurtosis, 'betaKurtosis'),
      ALPHA: parseFloatOrDefault(alpha, 'alpha'),
      BETA: parseFloatOrDefault(beta, 'beta'),
      BETA_MODE: parseFloatOrThrow(betaMode, 'betaMode'),
      BETA_POINTS: JSON.parse(betaPointsJSON || "[]"),
      MC_UNSMOOTHED_MEAN: parseFloatOrThrow(mcUnsmoothedMean, 'mcUnsmoothedMean'),
      MC_UNSMOOTHED_VARIANCE: parseFloatOrThrow(mcUnsmoothedVariance, 'mcUnsmoothedVariance'),
      MC_UNSMOOTHED_SKEWNESS: parseFloatOrDefault(mcUnsmoothedSkewness, 'mcUnsmoothedSkewness'),
      MC_UNSMOOTHED_KURTOSIS: parseFloatOrThrow(mcUnsmoothedKurtosis, 'mcUnsmoothedKurtosis'),
      MC_UNSMOOTHED_VaR_90: parseFloatOrThrow(mcUnsmoothedVaR90, 'mcUnsmoothedVaR90'),
      MC_UNSMOOTHED_CVaR_90: parseFloatOrThrow(mcUnsmoothedCVaR90, 'mcUnsmoothedCVaR90'),
      MC_UNSMOOTHED_MAD: parseFloatOrThrow(mcUnsmoothedMAD, 'mcUnsmoothedMAD'),
      MC_UNSMOOTHED_POINTS: JSON.parse(mcUnsmoothedPointsJSON || "[]"),
      MC_SMOOTHED_MEAN: parseFloatOrThrow(mcSmoothedMean, 'mcSmoothedMean'),
      MC_SMOOTHED_VARIANCE: parseFloatOrThrow(mcSmoothedVariance, 'mcSmoothedVariance'),
      MC_SMOOTHED_SKEWNESS: parseFloatOrDefault(mcSmoothedSkewness, 'mcSmoothedSkewness'),
      MC_SMOOTHED_KURTOSIS: parseFloatOrThrow(mcSmoothedKurtosis, 'mcSmoothedKurtosis'),
      MC_SMOOTHED_VaR_90: parseFloatOrThrow(mcSmoothedVaR90, 'mcSmoothedVaR90'),
      MC_SMOOTHED_CVaR_90: parseFloatOrThrow(mcSmoothedCVaR90, 'mcSmoothedCVaR90'),
      MC_SMOOTHED_MAD: parseFloatOrThrow(mcSmoothedMAD, 'mcSmoothedMAD'),
      MC_SMOOTHED_POINTS: JSON.parse(mcSmoothedPointsJSON || "[]"),
      WEIGHTED_CONSERVATIVE: parseFloatOrThrow(weightedConservative, 'weightedConservative'),
      WEIGHTED_NEUTRAL: parseFloatOrThrow(weightedNeutral, 'weightedNeutral'),
      WEIGHTED_OPTIMISTIC: parseFloatOrThrow(weightedOptimistic, 'weightedOptimistic'),
      PROB_EXCEED_PERT_MEAN_BETA: parseFloatOrThrow(probExceedPertMeanBeta, 'probExceedPertMeanBeta'),
      PROB_EXCEED_PERT_MEAN_MC_UNSMOOTHED: parseFloatOrThrow(probExceedPertMeanUnsmoothed, 'probExceedPertMeanUnsmoothed'),
      PROB_EXCEED_PERT_MEAN_MC_SMOOTHED: parseFloatOrThrow(probExceedPertMeanSmoothed, 'probExceedPertMeanSmoothed'),
      CDF_POINTS: (() => {
        try {
          return JSON.parse(cdfPointsJSON || "[]");
        } catch (e) {
          Logger.log(`Failed to parse CDF_POINTS JSON: ${cdfPointsJSON}, defaulting to []`);
          return [];
        }
      })()
    };

    // Log success and return the properties
    Logger.log('getProperties returning properties');
    return properties;
  } catch (error) {
    // Log any errors and rethrow them
    Logger.log('Error in getProperties: ' + error.message);
    throw error;
  }
}

/**
 * SECTION 8: WEB APP INTEGRATION
 * Handles HTTP requests for integration with a custom GPT in ChatGPT.
 */

/**
 * Show the HTML form when user opens the Web App, or auto-create the Sheet if ?sheetId= is provided.
 */
function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.sheetId) {
      return HtmlService.createHtmlOutputFromFile('Plot')
        .setTitle("PERT Estimate Plot")
        .append('<script>var sheetId = "' + e.parameter.sheetId + '";</script>');
    }

    if (e && e.parameter && e.parameter.data) {
      const tasks = JSON.parse(e.parameter.data);
      if (!Array.isArray(tasks) || tasks.length === 0) {
        throw new Error("Invalid or empty tasks array.");
      }

      const template = HtmlService.createTemplateFromFile('submit');
      template.prefillData = tasks;
      return template.evaluate().setTitle("Review and Submit Estimates");
    }

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

  sheet.getRange("A1:E1").setValues([
    ["Name", "best_case", "most_likely", "worst_case", "SelectedForPlot"]
  ]);

  tasks.forEach((task, i) => {
    sheet.getRange(i + 2, 1, 1, 5).setValues([
      [task.taskName, task.bestCase, task.mostLikely, task.worstCase, task.selectedForPlot ? "TRUE" : "FALSE"]
    ]);
  });

  SpreadsheetApp.setActiveSpreadsheet(spreadsheet);
  addPERTColumns();

  const calcSheet = spreadsheet.getSheetByName('Estimate Calculations');
  const sheetId = spreadsheet.getId();
  const sheetUrl = spreadsheet.getUrl() + "#gid=" + calcSheet.getSheetId();
  const plotUrl = ScriptApp.getService().getUrl() + "?sheetId=" + sheetId;

  return {
    sheetUrl: sheetUrl,
    plotUrl: plotUrl
  };
}

/**
 * Handles POST requests to auto-create a sheet without showing a form.
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
