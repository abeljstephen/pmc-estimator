/**
 * SECTION 1: MENU SETUP
 * Defines the custom menu in Google Sheets to provide user access to key functionalities.
 */

/**
 * Adds an Add-On menu to the Google Sheets UI for user interaction.
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
 */
function showPlot() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var activeRange = sheet.getActiveRange();
  var rowIndex = activeRange ? activeRange.getRow() : 2; // Default to row 2 if no selection
  if (rowIndex < 2) rowIndex = 2; // Ensure row index is at least 2
  var sheetId = SpreadsheetApp.getActiveSpreadsheet().getId();
  
  Logger.log('showPlot: sheetId = ' + sheetId);
  Logger.log('showPlot: sheetName = ' + sheet.getName());
  Logger.log('showPlot: rowIndex = ' + rowIndex);
  
  var html = HtmlService.createHtmlOutputFromFile('Plot')
      .setWidth(1200)
      .setHeight(900);
  
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
 * @param {Array} tasks - Array of task objects.
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
  Logger.log('Calling API with ' + tasks.length + ' tasks');
  Logger.log('Payload: ' + JSON.stringify(tasks));
  const response = UrlFetchApp.fetch(url, options);
  Logger.log('API response code: ' + response.getResponseCode());
  Logger.log('API response content: ' + response.getContentText());
  if (response.getResponseCode() !== 200) {
    Logger.log('API request failed with content: ' + response.getContentText());
    throw new Error('API request failed: ' + response.getContentText());
  }
  const responseData = JSON.parse(response.getContentText());
  Logger.log('API response data received with ' + (responseData.results ? responseData.results.length : 0) + ' results');
  return responseData;
}

/**
 * Adds PERT columns to the "Estimate Calculations" sheet using API-provided metrics.
 */
function addPertColumns() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetName = "Estimate Calculations";
  let sheet = ss.getSheetByName(sheetName);

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

  const headers = [
    "Name", "Best Case", "Most Likely", "Worst Case",
    "Triangle Mean", "Triangle Variance", "Triangle StdDev", "Triangle Skewness", "Triangle Kurtosis", "Triangle Points",
    "PERT Mean", "PERT StdDev", "PERT Variance", "PERT Skewness", "PERT Kurtosis", "PERT Points",
    "Beta Mean", "Beta Variance", "Beta Skewness", "Beta Kurtosis", "Alpha", "Beta", "Beta Mode", "Beta Points",
    "MC On Beta Unsmoothed Mean", "MC On Beta Unsmoothed Variance", "MC On Beta Unsmoothed Skewness", "MC On Beta Unsmoothed Kurtosis", "MC On Beta Unsmoothed VaR 90%", "MC On Beta Unsmoothed CVaR 90%", "MC On Beta Unsmoothed MAD", "MC On Beta Unsmoothed Points",
    "MC On Beta Smoothed Mean", "MC On Beta Smoothed Variance", "MC On Beta Smoothed Skewness", "MC On Beta Smoothed Kurtosis", "MC On Beta Smoothed VaR 90%", "MC On Beta Smoothed CVaR 90%", "MC On Beta Smoothed MAD", "MC On Beta Smoothed Points",
    "Weighted Estimate (Conservative)", "Weighted Estimate (Neutral)", "Weighted Estimate (Optimistic)",
    "Probability Exceeding PERT Mean (Beta)", "Probability Exceeding PERT Mean (MC Unsmoothed)", "Probability Exceeding PERT Mean (MC Smoothed)", "CDF Points"
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  const firstSheet = ss.getSheets()[0];
  if (firstSheet.getLastColumn() < 4) {
    throw new Error("The first  first sheet must have at least 4 columns: Name, Best Case, Most Likely, Worst Case.");
  }
  const lastRow = firstSheet.getLastRow();

  if (lastRow < 2) {
    throw new Error("No data immutable found in the first sheet.");
  }

  const dataRange = firstSheet.getRange(2, 1, lastRow - 1, 4);
  const data = dataRange.getValues();

  const tasks = data.map(row => {
    const [name, bestCase, mostLikely, worstCase] = row;
    if (typeof bestCase !== 'number' || typeof mostLikely !== 'number' || typeof worstCase !== 'number') {
      Logger.log(`Skipping row with non-numeric estimates: ${row}`);
      return null;
    }
    if (bestCase > mostLikely || mostLikely > worstCase) {
      Logger.log(`Skipping row with invalid estimate order: ${row}`);
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
  } catch (error) {
    Logger.log('API call failed: ' + error.message);
    throw new Error("Failed to retrieve data from API.");
  }

  const results = apiResponse.results;
  if (!results || !Array.isArray(results)) {
    throw new Error("Invalid API response: 'results' is not an array.");
  }

  const allRowData = results.map(result => [
    result.task?.value || "N/A",
    result.bestCase?.value || "N/A",
    result.mostLikely?.value || "N/A",
    result.worstCase?.value || "N/A",
    result.triangleMean?.value || "N/A",
    result.triangleVariance?.value || "N/A",
    result.triangleStdDev?.value || "N/A",
    result.triangleSkewness?.value || "N/A",
    result.triangleKurtosis?.value || "N/A",
    result.trianglePoints?.value ? JSON.stringify(result.trianglePoints.value) : "N/A",
    result.pertMean?.value || "N/A",
    result.pertStdDev?.value || "N/A",
    result.pertVariance?.value || "N/A",
    result.pertSkewness?.value || "N/A",
    result.pertKurtosis?.value || "N/A",
    result.pertPoints?.value ? JSON.stringify(result.pertPoints.value) : "N/A",
    result.betaMean?.value || "N/A",
    result.betaVariance?.value || "N/A",
    result.betaSkewness?.value || "N/A",
    result.betaKurtosis?.value || "N/A",
    result.alpha?.value || "N/A",
    result.beta?.value || "N/A",
    result.betaMode?.value || "N/A",
    result.betaPoints?.value ? JSON.stringify(result.betaPoints.value) : "N/A",
    result.mcMean?.value || "N/A",
    result.mcVariance?.value || "N/A",
    result.mcSkewness?.value || "N/A",
    result.mcKurtosis?.value || "N/A",
    result.mcVaR?.value || "N/A",
    result.mcCVaR?.value || "N/A",
    result.mcMAD?.value || "N/A",
    result.mcPoints?.value ? JSON.stringify(result.mcPoints.value) : "N/A",
    result.mcSmoothedMean?.value || "N/A",
    result.mcSmoothedVariance?.value || "N/A",
    result.mcSmoothedSkewness?.value || "N/A",
    result.mcSmoothedKurtosis?.value || "N/A",
    result.mcSmoothedVaR?.value || "N/A",
    result.mcSmoothedCVaR?.value || "N/A",
    result.mcSmoothedMAD?.value || "N/A",
    result.mcSmoothedPoints?.value ? JSON.stringify(result.mcSmoothedPoints.value) : "N/A",
    result.weightedConservative?.value || "N/A",
    result.weightedNeutral?.value || "N/A",
    result.weightedOptimistic?.value || "N/A",
    result.probExceedPertMeanBeta?.value || "N/A",
    result.probExceedPertMeanMCUnsmoothed?.value || "N/A",
    result.probExceedPertMeanMCSmoothed?.value || "N/A",
    result.cdfPoints?.value ? JSON.stringify(result.cdfPoints.value) : "N/A"
  ]);

  if (allRowData.length > 0) {
    sheet.getRange(2, 1, allRowData.length, allRowData[0].length).setValues(allRowData);
    const numRows = allRowData.length;
    // Apply formatting to specific columns
    const columnsToFormat = [5, 10, 16, 24, 32, 39, 41];
    columnsToFormat.forEach(col => {
      sheet.getRange(1, col).setFontWeight('bold').setBackground('#d1e7dd');
      sheet.getRange(2, col, numRows, 1).setBackground('#d1e7dd');
    });
  }
}

/**
 * Fetches properties directly from the API for plotting in Plot.html.
 * @param {string} sheetId - Spreadsheet ID.
 * @param {string} sheetName - Name of the sheet.
 * @param {number} rowIndex - Row index to fetch input data from.
 * @returns {Object} Properties object with metrics, points, and task name.
 */
function getProperties(sheetId, sheetName, rowIndex) {
  try {
    Logger.log(`getProperties called with sheetId: ${sheetId}, sheetName: ${sheetName}, rowIndex: ${rowIndex}`);

    // Input validation
    if (typeof sheetId !== 'string' || !sheetId) {
      Logger.log('Error: sheetId must be a non-empty string');
      throw new Error('sheetId must be a non-empty string');
    }
    if (typeof sheetName !== 'string' || !sheetName) {
      Logger.log('Error: sheetName must be a non-empty string');
      throw new Error('sheetName must be a non-empty string');
    }
    if (typeof rowIndex !== 'number' || rowIndex < 2 || !Number.isInteger(rowIndex)) {
      Logger.log('Error: rowIndex must be an integer >= 2');
      throw new Error('rowIndex must be an integer >= 2');
    }

    const spreadsheet = SpreadsheetApp.openById(sheetId);
    if (!spreadsheet) {
      Logger.log('Error: Spreadsheet not found');
      throw new Error('Spreadsheet not found');
    }
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Error: Sheet "${sheetName}" not found`);
      throw new Error(`Sheet "${sheetName}" not found`);
    }

    const lastRow = sheet.getLastRow();
    if (rowIndex > lastRow) {
      Logger.log(`Error: rowIndex ${rowIndex} exceeds sheet's last row: ${lastRow}`);
      throw new Error(`rowIndex ${rowIndex} exceeds sheet's last row: ${lastRow}`);
    }

    // Validate column count before fetching data
    if (sheet.getLastColumn() < 4) {
      Logger.log('Error: Sheet "' + sheetName + '" has fewer than 4 columns');
      throw new Error('Sheet "' + sheetName + '" must have at least 4 columns');
    }

    // Read input data (columns 1-4: Name, best_case, most_likely, worst_case)
    const data = sheet.getRange(rowIndex, 1, 1, 4).getValues()[0];
    if (!data || data.length < 4) {
      Logger.log(`Error: Insufficient data at row ${rowIndex}`);
      throw new Error(`Insufficient data at row ${rowIndex}`);
    }
    Logger.log('Input data from sheet: ' + JSON.stringify(data));

    const [name, bestCase, mostLikely, worstCase] = data;
    if (typeof bestCase !== 'number' || typeof mostLikely !== 'number' || typeof worstCase !== 'number') {
      Logger.log(`Error: Invalid numeric inputs at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
      throw new Error(`Invalid numeric inputs at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
    }

    const task = {
      task: name || "Unnamed Task",
      optimistic: bestCase,
      mostLikely: mostLikely,
      pessimistic: worstCase
    };
    Logger.log('Task object prepared for API: ' + JSON.stringify(task));

    // Fetch data from API
    const apiResponse = callEstimatorAPI([task]);
    if (!apiResponse || !apiResponse.results || !Array.isArray(apiResponse.results) || apiResponse.results.length === 0) {
      Logger.log('Error: API response missing or invalid "results" array');
      throw new Error('API response missing or invalid "results" array');
    }

    const result = apiResponse.results[0];
    Logger.log('API result for task: ' + result.task?.value);

    // Helper functions for safe extraction with logging
    function getValue(field, fieldName) {
      const value = result[field]?.value;
      if (value === undefined || value === null || typeof value !== 'number' || isNaN(value)) {
        Logger.log(`Warning: ${fieldName} is invalid or missing (value: ${value}), defaulting to 0`);
        return 0;
      }
      return value;
    }

    function getPoints(field, fieldName) {
      const points = result[field]?.value;
      if (!Array.isArray(points) || points.length === 0) {
        Logger.log(`Warning: ${fieldName} is invalid or empty, defaulting to []`);
        return [];
      }
      if (!points.every(p => typeof p.x === 'number' && typeof p.y === 'number')) {
        Logger.log(`Warning: ${fieldName} contains invalid point format, defaulting to []`);
        return [];
      }
      return points;
    }

    // Construct properties object
    const properties = {
      TASK_NAME: result.task?.value || "Unnamed Task",
      MIN: getValue('bestCase', 'MIN'),
      MOST_LIKELY: getValue('mostLikely', 'MOST_LIKELY'),
      MAX: getValue('worstCase', 'MAX'),
      TRIANGLE_MEAN: getValue('triangleMean', 'TRIANGLE_MEAN'),
      TRIANGLE_VARIANCE: getValue('triangleVariance', 'TRIANGLE_VARIANCE'),
      TRIANGLE_STD: getValue('triangleStdDev', 'TRIANGLE_STD'),
      TRIANGLE_SKEWNESS: getValue('triangleSkewness', 'TRIANGLE_SKEWNESS'),
      TRIANGLE_KURTOSIS: getValue('triangleKurtosis', 'TRIANGLE_KURTOSIS'),
      TRIANGLE_POINTS: getPoints('trianglePoints', 'TRIANGLE_POINTS'),
      PERT_MEAN: getValue('pertMean', 'PERT_MEAN'),
      PERT_STD: getValue('pertStdDev', 'PERT_STD'),
      PERT_VARIANCE: getValue('pertVariance', 'PERT_VARIANCE'),
      PERT_SKEWNESS: getValue('pertSkewness', 'PERT_SKEWNESS'),
      PERT_KURTOSIS: getValue('pertKurtosis', 'PERT_KURTOSIS'),
      PERT_POINTS: getPoints('pertPoints', 'PERT_POINTS'),
      BETA_MEAN: getValue('betaMean', 'BETA_MEAN'),
      BETA_VARIANCE: getValue('betaVariance', 'BETA_VARIANCE'),
      BETA_SKEWNESS: getValue('betaSkewness', 'BETA_SKEWNESS'),
      BETA_KURTOSIS: getValue('betaKurtosis', 'BETA_KURTOSIS'),
      ALPHA: getValue('alpha', 'ALPHA'),
      BETA: getValue('beta', 'BETA'),
      BETA_MODE: getValue('betaMode', 'BETA_MODE'),
      BETA_POINTS: getPoints('betaPoints', 'BETA_POINTS'),
      MC_UNSMOOTHED_MEAN: getValue('mcMean', 'MC_UNSMOOTHED_MEAN'),
      MC_UNSMOOTHED_VARIANCE: getValue('mcVariance', 'MC_UNSMOOTHED_VARIANCE'),
      MC_UNSMOOTHED_SKEWNESS: getValue('mcSkewness', 'MC_UNSMOOTHED_SKEWNESS'),
      MC_UNSMOOTHED_KURTOSIS: getValue('mcKurtosis', 'MC_UNSMOOTHED_KURTOSIS'),
      MC_UNSMOOTHED_VaR_90: getValue('mcVaR', 'MC_UNSMOOTHED_VaR_90'),
      MC_UNSMOOTHED_CVaR_90: getValue('mcCVaR', 'MC_UNSMOOTHED_CVaR_90'),
      MC_UNSMOOTHED_MAD: getValue('mcMAD', 'MC_UNSMOOTHED_MAD'),
      MC_UNSMOOTHED_POINTS: getPoints('mcPoints', 'MC_UNSMOOTHED_POINTS'),
      MC_SMOOTHED_MEAN: getValue('mcSmoothedMean', 'MC_SMOOTHED_MEAN'),
      MC_SMOOTHED_VARIANCE: getValue('mcSmoothedVariance', 'MC_SMOOTHED_VARIANCE'),
      MC_SMOOTHED_SKEWNESS: getValue('mcSmoothedSkewness', 'MC_SMOOTHED_SKEWNESS'),
      MC_SMOOTHED_KURTOSIS: getValue('mcSmoothedKurtosis', 'MC_SMOOTHED_KURTOSIS'),
      MC_SMOOTHED_VaR_90: getValue('mcSmoothedVaR', 'MC_SMOOTHED_VaR_90'),
      MC_SMOOTHED_CVaR_90: getValue('mcSmoothedCVaR', 'MC_SMOOTHED_CVaR_90'),
      MC_SMOOTHED_MAD: getValue('mcSmoothedMAD', 'MC_SMOOTHED_MAD'),
      MC_SMOOTHED_POINTS: getPoints('mcSmoothedPoints', 'MC_SMOOTHED_POINTS'),
      WEIGHTED_CONSERVATIVE: getValue('weightedConservative', 'WEIGHTED_CONSERVATIVE'),
      WEIGHTED_NEUTRAL: getValue('weightedNeutral', 'WEIGHTED_NEUTRAL'),
      WEIGHTED_OPTIMISTIC: getValue('weightedOptimistic', 'WEIGHTED_OPTIMISTIC'),
      PROB_EXCEED_PERT_MEAN_BETA: getValue('probExceedPertMeanBeta', 'PROB_EXCEED_PERT_MEAN_BETA'),
      PROB_EXCEED_PERT_MEAN_MC_UNSMOOTHED: getValue('probExceedPertMeanMCUnsmoothed', 'PROB_EXCEED_PERT_MEAN_MC_UNSMOOTHED'),
      PROB_EXCEED_PERT_MEAN_MC_SMOOTHED: getValue('probExceedPertMeanMCSmoothed', 'PROB_EXCEED_PERT_MEAN_MC_SMOOTHED'),
      CDF_POINTS: getPoints('cdfPoints', 'CDF_POINTS'),
      TARGET_PROBABILITY_POINTS: getPoints('targetProbabilityPoints', 'TARGET_PROBABILITY_POINTS'),
    };

    // Verify critical fields for Plot.html
    const requiredPointFields = [
      'TRIANGLE_POINTS', 'PERT_POINTS', 'BETA_POINTS',
      'MC_UNSMOOTHED_POINTS', 'MC_SMOOTHED_POINTS', 'CDF_POINTS',
      'TARGET_PROBABILITY_POINTS'
    ];
    requiredPointFields.forEach(field => {
      if (!properties[field] || properties[field].length === 0) {
        Logger.log(`Warning: ${field} is empty; plot may not render correctly`);
      }
    });

    Logger.log('Returning properties for task: ' + properties.TASK_NAME);
    return properties;
  } catch (error) {
    Logger.log('Error in getProperties: ' + error.message);
    throw error; // Re-throw to allow caller (e.g., Plot.html) to handle
  }
}

/**
 * SECTION 8: WEB APP INTEGRATION
 */

/**
 * Show the HTML form or auto-create the Sheet for Web App.
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
    Logger.log("Error in doGet: " + error.message);
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Creates the Spreadsheet and returns URLs.
 * @param {Array} tasks - Array of task objects.
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
  addPertColumns();

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
 * Handles POST requests to auto-create a sheet.
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

    // Validate tasks
    tasks.forEach(task => {
      if (!task.taskName || typeof task.bestCase !== 'number' || typeof task.mostLikely !== 'number' || typeof task.worstCase !== 'number') {
        throw new Error("Invalid task data: " + JSON.stringify(task));
      }
    });

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
    addPertColumns();

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
    Logger.log("Error in doPost: " + error.message);
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
