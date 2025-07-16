/**
 * SECTION 0: PERSONA CONFIGURATION
 * Determines the usage mode and sets configuration for downstream functions.
 */

/**
 * Determines the persona (web or standalone) and returns configuration.
 * @param {Object} [e] - HTTP event for web app mode.
 * @param {string} [context] - Optional context (e.g., 'showPlot', 'addPertColumns').
 * @returns {Object} Configuration with mode, sheetId, sheetName, defaultTask, rowIndex, isWebAppContext, errorHandler.
 */
function personas(e, context) {
  Logger.log('personas called with event: ' + JSON.stringify(e) + ', context: ' + context);
  const config = {
    mode: 'standalone',
    sheetId: null,
    sheetName: null,
    defaultTask: null,
    rowIndex: 2,
    isWebAppContext: false,
    errorHandler: 'alert'
  };

  try {
    // Web app mode: HTTP event with parameters
    if (e && e.parameter) {
      config.mode = 'web';
      config.isWebAppContext = true;
      config.errorHandler = 'confirm';
      if (e.parameter.sheetId) {
        config.sheetId = e.parameter.sheetId;
        config.sheetName = 'Estimation Data';
      } else {
        config.sheetName = 'Estimation Data';
      }
    } else {
      // Standalone mode: Use active spreadsheet
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      if (!ss) {
        Logger.log('Error: No active spreadsheet found in standalone mode');
        throw new Error('No active spreadsheet found. Please run the script from within a Google Sheet.');
      }
      config.sheetId = ss.getId();
      config.sheetName = SpreadsheetApp.getActiveSheet()?.getName() || 'Estimation Data';
      if (context === 'showPlot') {
        const activeRange = SpreadsheetApp.getActiveSheet()?.getActiveRange();
        config.rowIndex = activeRange ? activeRange.getRow() : 2;
        if (config.rowIndex < 2) config.rowIndex = 2;
        const tasks = getAllTasks(config.sheetId).tasks; // Access tasks array
        if (tasks && tasks.length > 0) {
          const sheet = ss.getSheetByName(config.sheetName);
          const selectedTask = tasks.find(task => task.selectedForPlot);
          if (selectedTask) {
            config.defaultTask = selectedTask.task;
          } else if (sheet && config.rowIndex <= sheet.getLastRow()) {
            const taskData = sheet.getRange(config.rowIndex, 1, 1, 4).getValues()[0];
            config.defaultTask = taskData[0] && typeof taskData[0] === 'string' ? taskData[0] : tasks[0].task || 'Unnamed Task';
          } else {
            config.defaultTask = tasks[0].task || 'Unnamed Task';
            config.rowIndex = 2;
          }
        } else {
          Logger.log('No valid tasks found for defaultTask');
          config.defaultTask = 'Unnamed Task';
        }
      }
    }
    Logger.log('personas config: ' + JSON.stringify(config));
    return config;
  } catch (error) {
    Logger.log('Error in personas: ' + error.message);
    throw error;
  }
}

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
  const config = personas(null, 'showPlot');
  Logger.log('showPlot: sheetId = ' + config.sheetId + ', sheetName = ' + config.sheetName + ', rowIndex = ' + config.rowIndex);
  
  var html = HtmlService.createHtmlOutputFromFile('Plot')
      .setWidth(1200)
      .setHeight(900);
  
  html.setContent(
    '<script>' +
    'var sheetId = ' + JSON.stringify(config.sheetId) + ';' +
    'var sheetName = ' + JSON.stringify(config.sheetName) + ';' +
    'var rowIndex = ' + JSON.stringify(config.rowIndex) + ';' +
    'var defaultTask = ' + JSON.stringify(config.defaultTask) + ';' +
    '</script>' + html.getContent()
  );
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Interactive Probability Simulator');
}

/**
 * SECTION 2: API INTERACTION
 * Handles secure API calls to pmcEstimatorAPI with JWT authentication.
 */

/**
 * Calls the web API to perform estimation calculations using secure JWT authentication.
 * @param {Array} tasks - Array of task objects with flattened structure.
 * @returns {Object} API response with computed metrics.
 */
function callEstimatorAPI(tasks) {
  const url = 'https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI';
  const startTime = Date.now();
  try {
    if (!Array.isArray(tasks) || tasks.length === 0) {
      Logger.log('Error: tasks must be a non-empty array');
      throw new Error('Tasks must be a non-empty array');
    }
    tasks.forEach((task, i) => {
      if (!task.task || 
          typeof task.optimistic !== 'number' || !isFinite(task.optimistic) ||
          typeof task.mostLikely !== 'number' || !isFinite(task.mostLikely) ||
          typeof task.pessimistic !== 'number' || !isFinite(task.pessimistic) ||
          typeof task.targetValue !== 'number' || !isFinite(task.targetValue)) {
        Logger.log('Invalid task data at index ' + i + ': ' + JSON.stringify(task));
        throw new Error('All task estimates and targetValue must be finite numbers');
      }
    });
    const keyJsonString = PropertiesService.getScriptProperties().getProperty('SERVICE_ACCOUNT_KEY');
    if (!keyJsonString) {
      Logger.log('Error: SERVICE_ACCOUNT_KEY not found in Script Properties');
      throw new Error('SERVICE_ACCOUNT_KEY not found in Script Properties');
    }
    let keyJson;
    try {
      keyJson = JSON.parse(keyJsonString);
    } catch (e) {
      Logger.log('Error parsing SERVICE_ACCOUNT_KEY: ' + e.message);
      throw new Error('Failed to parse SERVICE_ACCOUNT_KEY: ' + e.message);
    }
    const now = Math.floor(Date.now() / 1000);
    const claimSet = {
      iss: keyJson.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
      target_audience: url
    };
    const header = { alg: 'RS256', typ: 'JWT' };
    const toSign = Utilities.base64EncodeWebSafe(JSON.stringify(header)) + '.' +
                   Utilities.base64EncodeWebSafe(JSON.stringify(claimSet));
    let token;
    try {
      const signature = Utilities.computeRsaSha256Signature(toSign, keyJson.private_key);
      const jwt = toSign + '.' + Utilities.base64EncodeWebSafe(signature);
      Logger.log('Generated JWT: [Redacted]');
      const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        contentType: 'application/x-www-form-urlencoded',
        payload: {
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        },
        muteHttpExceptions: true,
        timeout: 30000 // 30-second timeout
      });
      if (Date.now() - startTime > 30000) {
        Logger.log('Error: Token request timed out');
        throw new Error('Token request timed out');
      }
      Logger.log('Token endpoint response code: ' + response.getResponseCode());
      Logger.log('Token endpoint response: [Redacted]');
      if (response.getResponseCode() !== 200) {
        throw new Error('Failed to obtain token: ' + response.getContentText());
      }
      const tokenData = JSON.parse(response.getContentText());
      token = tokenData.id_token;
      Logger.log('Generated Token: [Redacted]');
    } catch (e) {
      Logger.log('Token generation failed: ' + e.message);
      throw new Error('Failed to obtain token: ' + e.message);
    }
    const options = {
      method: 'POST',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      payload: JSON.stringify(tasks),
      muteHttpExceptions: true,
      timeout: 30000 // 30-second timeout
    };
    Logger.log('Calling API with ' + tasks.length + ' tasks');
    Logger.log('Payload: ' + JSON.stringify(tasks));
    const response = UrlFetchApp.fetch(url, options);
    if (Date.now() - startTime > 30000) {
      Logger.log('Error: API request timed out');
      throw new Error('API request timed out');
    }
    Logger.log('API response code: ' + response.getResponseCode());
    Logger.log('API response content: ' + response.getContentText());
    if (response.getResponseCode() !== 200) {
      Logger.log('API request failed: ' + response.getContentText());
      throw new Error('API request failed: ' + response.getContentText());
    }
    const responseData = JSON.parse(response.getContentText());
    Logger.log('API response data received with ' + (responseData.results ? responseData.results.length : 0) + ' results');
    return responseData;
  } catch (error) {
    Logger.log('Error in callEstimatorAPI: ' + error.message + '\nStack: ' + error.stack);
    throw error;
  }
}

/**
 * SECTION 3: TASK RETRIEVAL
 * Fetches tasks from the specified spreadsheet for use in Plot.html’s dropdown.
 */

/**
 * Fetches all tasks from the specified sheet for Plot.html’s dropdown.
 * Validates that the sheet has at least 4 columns (Name, Best Case, Most Likely, Worst Case) and data starting from row 2.
 * Ensures estimates are numeric, finite, and in valid order (bestCase ≤ mostLikely ≤ worstCase).
 * Returns an array of task objects and the default task index.
 * @param {string} sheetId - Spreadsheet ID.
 * @returns {Object} { tasks: Array, defaultTaskIndex: number }.
 */
function getAllTasks(sheetId) {
  Logger.log('getAllTasks called with sheetId: ' + sheetId);
  try {
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('Estimation Data') || ss.getSheets()[0];
    if (!sheet) {
      Logger.log('Error: No sheets found in spreadsheet: ' + sheetId);
      throw new Error('No sheets found in spreadsheet');
    }
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('No data found in sheet: ' + sheet.getName());
      return { tasks: [], defaultTaskIndex: 0 };
    }
    const tasks = [];
    let defaultTaskIndex = 0;
    data.slice(1).forEach((row, index) => {
      const [task, optimistic, mostLikely, pessimistic, selectedForPlot] = row;
      if (task && Number.isFinite(optimistic) && Number.isFinite(mostLikely) && Number.isFinite(pessimistic) &&
          optimistic < mostLikely && mostLikely < pessimistic) {
        tasks.push({
          task: task.toString(),
          optimistic: optimistic,
          mostLikely: mostLikely,
          pessimistic: pessimistic,
          selectedForPlot: selectedForPlot === true || selectedForPlot === 'TRUE'
        });
        if (selectedForPlot === true || selectedForPlot === 'TRUE') {
          defaultTaskIndex = tasks.length - 1;
        }
      }
    });
    Logger.log('Fetched ' + tasks.length + ' valid tasks, defaultTaskIndex: ' + defaultTaskIndex);
    return { tasks, defaultTaskIndex };
  } catch (error) {
    Logger.log('Error in getAllTasks: ' + error.message + '\nStack: ' + error.stack);
    throw error;
  }
}

/**
 * SECTION 4: PERT CALCULATIONS
 * Processes spreadsheet data and adds PERT metrics to the Estimate Calculations sheet.
 */

/**
 * Adds PERT columns to the "Estimate Calculations" sheet using API-provided metrics.
 * Always writes headers and descriptions, even on failure.
 * @param {Object} config - Persona configuration with sheetId, isWebAppContext, errorHandler.
 * @returns {Object} Result object with status, message, and errors array.
 */
function addPertColumns(config) {
  Logger.log('addPertColumns called with config: ' + JSON.stringify(config));
  const ss = SpreadsheetApp.openById(config.sheetId);
  const sheetName = 'Estimate Calculations';
  let sheet = ss.getSheetByName(sheetName);
  let result = { status: 'success', message: '', errors: [] };

  try {
    if (sheet && !config.isWebAppContext) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Sheet exists',
        'The sheet "' + sheetName + '" already exists. Do you want to overwrite its content?',
        ui.ButtonSet.YES_NO
      );
      if (response === ui.Button.YES) {
        sheet.clear();
      } else {
        throw new Error('Operation cancelled by user.');
      }
    } else if (sheet) {
      sheet.clear();
    } else {
      sheet = ss.insertSheet(sheetName);
    }

    const headers = [
      'Name', 'Best Case', 'Most Likely', 'Worst Case',
      'Triangle Mean', 'Triangle Variance', 'Triangle StdDev', 'Triangle Skewness', 'Triangle Kurtosis', 'Triangle Points',
      'PERT Mean', 'PERT StdDev', 'PERT Variance', 'PERT Skewness', 'PERT Kurtosis', 'PERT Points',
      'Beta Mean', 'Beta Variance', 'Beta Skewness', 'Beta Kurtosis', 'Alpha', 'Beta', 'Beta Mode', 'Beta Points',
      'MC On Beta Unsmoothed Mean', 'MC On Beta Unsmoothed Variance', 'MC On Beta Unsmoothed Skewness', 'MC On Beta Unsmoothed Kurtosis', 
      'MC On Beta Unsmoothed VaR 90%', 'MC On Beta Unsmoothed CVaR 90%', 'MC On Beta Unsmoothed MAD', 'MC On Beta Unsmoothed Points',
      'MC On Beta Smoothed Mean', 'MC On Beta Smoothed Variance', 'MC On Beta Smoothed Skewness', 'MC On Beta Smoothed Kurtosis', 
      'MC On Beta Smoothed VaR 90%', 'MC On Beta Smoothed CVaR 90%', 'MC On Beta Smoothed MAD', 'MC On Beta Smoothed 90th Percentile Confidence', 
      'MC On Beta Smoothed Points',
      'Weighted Estimate (Conservative)', 'Weighted Estimate (Neutral)', 'Weighted Estimate (Optimistic)',
      'Probability Exceeding PERT Mean (Beta)', 'Probability Exceeding PERT Mean (MC Unsmoothed)', 
      'Probability Exceeding PERT Mean (MC Smoothed)', 'CDF Points'
    ];

    const descriptions = [
      'Task name or identifier.', 
      'Optimistic estimate (best-case).', 
      'Most likely estimate.', 
      'Pessimistic estimate (worst-case).',
      'Triangle distribution average.', 
      'Triangle distribution spread.', 
      'Triangle standard deviation.', 
      'Triangle asymmetry.', 
      'Triangle peakedness.', 
      'Triangle cumulative points.',
      'Weighted average (PERT).', 
      'PERT standard deviation.', 
      'PERT spread.', 
      'PERT asymmetry.', 
      'PERT peakedness.', 
      'PERT cumulative points.',
      'Beta distribution mean.', 
      'Beta spread.', 
      'Beta asymmetry.', 
      'Beta peakedness.', 
      'Beta shape (alpha).', 
      'Beta shape (beta).', 
      'Beta mode.', 
      'Beta cumulative points.',
      'Unsmoothed Monte Carlo mean.', 
      'Unsmoothed Monte Carlo spread.', 
      'Unsmoothed Monte Carlo asymmetry.', 
      'Unsmoothed Monte Carlo peakedness.', 
      'Unsmoothed Monte Carlo VaR 90%.', 
      'Unsmoothed Monte Carlo CVaR 90%.', 
      'Unsmoothed Monte Carlo MAD.', 
      'Unsmoothed Monte Carlo points.',
      'Smoothed Monte Carlo mean.', 
      'Smoothed Monte Carlo spread.', 
      'Smoothed Monte Carlo asymmetry.', 
      'Smoothed Monte Carlo peakedness.', 
      'Smoothed Monte Carlo VaR 90%.', 
      'Smoothed Monte Carlo CVaR 90%.', 
      'Smoothed Monte Carlo MAD.', 
      'Smoothed Monte Carlo 90th Percentile.', 
      'Smoothed Monte Carlo points.',
      'Conservative weighted estimate.', 
      'Neutral weighted estimate (PERT Mean).', 
      'Optimistic weighted estimate.', 
      'Probability exceeding PERT Mean (Beta).', 
      'Probability exceeding PERT Mean (MC Unsmoothed).', 
      'Probability exceeding PERT Mean (MC Smoothed).', 
      'Cumulative distribution points.'
    ];

    // Always write headers and descriptions
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.getRange(2, 1, 1, headers.length).setValues([descriptions]).setFontStyle('italic');

    const firstSheet = ss.getSheets()[0];
    if (firstSheet.getLastColumn() < 4) {
      const error = 'First sheet must have at least 4 columns (Name, Best Case, Most Likely, Worst Case).';
      Logger.log('Error: ' + error);
      sheet.getRange(3, 1).setValue('Error: ' + error);
      result.errors.push(error);
      result.status = 'error';
      result.message = error;
      return result;
    }
    const lastRow = firstSheet.getLastRow();
    if (lastRow < 2) {
      const error = 'No data found in the first sheet.';
      Logger.log('Error: ' + error);
      sheet.getRange(3, 1).setValue('Error: ' + error);
      result.errors.push(error);
      result.status = 'error';
      result.message = error;
      return result;
    }

    const dataRange = firstSheet.getRange(2, 1, lastRow - 1, Math.max(4, firstSheet.getLastColumn()));
    const data = dataRange.getValues();
    const errorMessages = [];

    const tasks = data.map((row, index) => {
      const [name, bestCase, mostLikely, worstCase] = row;
      if (typeof bestCase !== 'number' || !isFinite(bestCase) || 
          typeof mostLikely !== 'number' || !isFinite(mostLikely) || 
          typeof worstCase !== 'number' || !isFinite(worstCase)) {
        const error = `Row ${index + 2} has non-numeric or non-finite estimates: ${JSON.stringify(row)}`;
        Logger.log(error);
        errorMessages.push(error);
        result.errors.push(error);
        return { name: name || 'Unnamed Task', error: error };
      }
      if (bestCase > mostLikely || mostLikely > worstCase) {
        const error = `Row ${index + 2} has invalid estimate order: ${JSON.stringify(row)}`;
        Logger.log(error);
        errorMessages.push(error);
        result.errors.push(error);
        return { name: name || 'Unnamed Task', error: error };
      }
      if (bestCase === mostLikely || mostLikely === worstCase) {
        const error = `Row ${index + 2} has estimates too close: ${JSON.stringify(row)}`;
        Logger.log(error);
        errorMessages.push(error);
        result.errors.push(error);
        return { name: name || 'Unnamed Task', error: error };
      }
      const range = worstCase - bestCase;
      const minRange = mostLikely * 0.001;
      if (range < minRange) {
        const error = `Row ${index + 2} has estimate range too small (${range} < ${minRange}): ${JSON.stringify(row)}`;
        Logger.log(error);
        errorMessages.push(error);
        result.errors.push(error);
        return { name: name || 'Unnamed Task', error: error };
      }
      if (bestCase === mostLikely && mostLikely === worstCase) {
        const error = `Row ${index + 2} has zero variance: ${JSON.stringify(row)}`;
        Logger.log(error);
        errorMessages.push(error);
        result.errors.push(error);
        return { name: name || 'Unnamed Task', error: error };
      }
      return {
        task: name || 'Unnamed Task',
        optimistic: bestCase * 1.0,
        mostLikely: mostLikely * 1.0,
        pessimistic: worstCase * 1.0,
        budgetFlexibility: 0.0,
        scheduleFlexibility: 0.0,
        scopeCertainty: 0.0,
        qualityTolerance: 0.0,
        targetValue: bestCase * 1.0,
        confidenceLevel: 0.9,
        targetProbabilityOnly: false,
        optimizeFor: 'target'
      };
    });

    if (errorMessages.length > 0 && !config.isWebAppContext) {
      const ui = SpreadsheetApp.getUi();
      const errorSummary = errorMessages.join('\n');
      const response = ui.alert(
        'Errors Encountered',
        `${errorSummary}\n\nPress "Continue" to proceed with "N/A" for invalid rows, or "Cancel" to stop.`,
        ui.ButtonSet.OK_CANCEL
      );
      if (response === ui.Button.CANCEL) {
        throw new Error('Operation cancelled by user due to invalid input data.');
      }
    }

    const validTasks = tasks.filter(task => !task.error);
    if (validTasks.length === 0 && tasks.length > 0) {
      Logger.log('No valid tasks to send to API, but processing all rows for output.');
      sheet.getRange(3, 1).setValue('Error: No valid tasks found. Check input data.');
      result.status = 'error';
      result.message = 'No valid tasks found.';
      return result;
    }

    let apiResponse = { results: [] };
    if (validTasks.length > 0) {
      try {
        apiResponse = callEstimatorAPI(validTasks);
      } catch (error) {
        Logger.log('API call failed: ' + error.message);
        errorMessages.push(`API call failed: ${error.message}`);
        result.errors.push(`API call failed: ${error.message}`);
        sheet.getRange(3, 1).setValue('Error: Failed to fetch data from API. Please check SERVICE_ACCOUNT_KEY and network connectivity.');
      }
    }

    const results = apiResponse.results || [];
    let resultIndex = 0;
    const allRowData = tasks.map((task, index) => {
      if (task.error) {
        const row = new Array(headers.length).fill('N/A');
        row[0] = task.name;
        Logger.log(`Row ${index + 2} data length: ${row.length}`);
        return row;
      }
      const result = results[resultIndex] || {};
      resultIndex++;
      if (result.error) {
        const error = `Row ${index + 2} API error: ${result.error}`;
        Logger.log(error);
        errorMessages.push(error);
        result.errors.push(error);
        const row = new Array(headers.length).fill('N/A');
        row[0] = task.task || 'Unnamed Task';
        Logger.log(`Row ${index + 2} data length: ${row.length}`);
        return row;
      }
      const row = [
        result.task?.value || 'N/A',
        result.bestCase?.value || 'N/A',
        result.mostLikely?.value || 'N/A',
        result.worstCase?.value || 'N/A',
        result.triangleMean?.value || 'N/A',
        result.triangleVariance?.value || 'N/A',
        result.triangleStdDev?.value || 'N/A',
        result.triangleSkewness?.value || 'N/A',
        result.triangleKurtosis?.value || 'N/A',
        result.trianglePoints?.value ? JSON.stringify(result.trianglePoints.value) : 'N/A',
        result.pertMean?.value || 'N/A',
        result.pertStdDev?.value || 'N/A',
        result.pertVariance?.value || 'N/A',
        result.pertSkewness?.value || 'N/A',
        result.pertKurtosis?.value || 'N/A',
        result.pertPoints?.value ? JSON.stringify(result.pertPoints.value) : 'N/A',
        result.betaMean?.value || 'N/A',
        result.betaVariance?.value || 'N/A',
        result.betaSkewness?.value || 'N/A',
        result.betaKurtosis?.value || 'N/A',
        result.alpha?.value || 'N/A',
        result.beta?.value || 'N/A',
        result.betaMode?.value || 'N/A',
        result.betaPoints?.value ? JSON.stringify(result.betaPoints.value) : 'N/A',
        result.mcMean?.value || 'N/A',
        result.mcVariance?.value || 'N/A',
        result.mcSkewness?.value || 'N/A',
        result.mcKurtosis?.value || 'N/A',
        result.mcVaR?.value || 'N/A',
        result.mcCVaR?.value || 'N/A',
        result.mcMAD?.value || 'N/A',
        result.mcPoints?.value ? JSON.stringify(result.mcPoints.value) : 'N/A',
        result.mcSmoothedMean?.value || 'N/A',
        result.mcSmoothedVariance?.value || 'N/A',
        result.mcSmoothedSkewness?.value || 'N/A',
        result.mcSmoothedKurtosis?.value || 'N/A',
        result.mcSmoothedVaR?.value || 'N/A',
        result.mcSmoothedCVaR?.value || 'N/A',
        result.mcSmoothedMAD?.value || 'N/A',
        result.mcSmoothedConfidenceValues?.value?.valueAt90Percent || 'N/A',
        result.mcSmoothedPoints?.value ? JSON.stringify(result.mcSmoothedPoints.value) : 'N/A',
        result.weightedConservative?.value || 'N/A',
        result.weightedNeutral?.value || 'N/A',
        result.weightedOptimistic?.value || 'N/A',
        result.probExceedPertMeanBeta?.value || 'N/A',
        result.probExceedPertMeanMCUnsmoothed?.value || 'N/A',
        result.probExceedPertMeanMCSmoothed?.value || 'N/A',
        result.cdfPoints?.value ? JSON.stringify(result.cdfPoints.value) : 'N/A'
      ];
      Logger.log(`Row ${index + 2} data length: ${row.length}`);
      return row;
    });

    if (allRowData.length > 0) {
      Logger.log(`Writing ${allRowData.length} rows with ${allRowData[0].length} columns to sheet`);
      sheet.getRange(3, 1, allRowData.length, headers.length).setValues(allRowData);
      const numRows = allRowData.length;
      const columnsToHighlight = [11, 40];
      columnsToHighlight.forEach(col => {
        sheet.getRange(1, col).setFontWeight('bold').setBackground('#d1e7dd');
        sheet.getRange(3, col, numRows, 1).setBackground('#d1e7dd');
      });
    } else {
      Logger.log('No data to write to sheet; all tasks invalid or API failed');
      sheet.getRange(3, 1).setValue('Error: No valid task data or API response available. Please check input data and SERVICE_ACCOUNT_KEY.');
    }

    if (errorMessages.length > 0) {
      result.message = errorMessages.join('; ');
      result.status = 'error';
      if (!config.isWebAppContext) {
        const ui = SpreadsheetApp.getUi();
        ui.alert('Errors Encountered', `${result.message}\n\nThe script completed with "N/A" for affected rows.`, ui.ButtonSet.OK);
      }
    } else {
      result.message = 'PERT calculations completed successfully.';
      if (!config.isWebAppContext) {
        const ui = SpreadsheetApp.getUi();
        ui.alert('Success', 'PERT calculations completed successfully.', ui.ButtonSet.OK);
      }
    }

    return result;
  } catch (error) {
    Logger.log('Error in addPertColumns: ' + error.message);
    sheet.getRange(3, 1).setValue('Error: Failed to process PERT calculations: ' + error.message);
    result.status = 'error';
    result.message = 'Failed to process PERT calculations: ' + error.message;
    result.errors.push(result.message);
    return result;
  }
}

/**
 * SECTION 5: PLOT DATA FETCHING
 * Fetches data for Plot.html visualizations.
 */

/**
 * Fetches properties for plotting in Plot.html.
 * @param {string} sheetId - Spreadsheet ID.
 * @param {string} sheetName - Name of the sheet.
 * @param {number} rowIndex - Row index to fetch input data from.
 * @returns {Object} Properties object with metrics, points, and task name.
 */
function getProperties(sheetId, sheetName, rowIndex) {
  try {
    Logger.log(`getProperties called with sheetId: ${sheetId}, sheetName: ${sheetName}, rowIndex: ${rowIndex}`);

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

    if (sheet.getLastColumn() < 4) {
      Logger.log('Error: Sheet "' + sheetName + '" has fewer than 4 columns');
      throw new Error('Sheet "' + sheetName + '" must have at least 4 columns');
    }

    const data = sheet.getRange(rowIndex, 1, 1, 4).getValues()[0];
    if (!data || data.length < 4) {
      Logger.log(`Error: Insufficient data at row ${rowIndex}`);
      throw new Error(`Insufficient data at row ${rowIndex}`);
    }
    Logger.log('Input data from sheet: ' + JSON.stringify(data));

    const [name, bestCase, mostLikely, worstCase] = data;
    if (typeof bestCase !== 'number' || !isFinite(bestCase) || 
        typeof mostLikely !== 'number' || !isFinite(mostLikely) || 
        typeof worstCase !== 'number' || !isFinite(worstCase)) {
      Logger.log(`Error: Invalid numeric inputs at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
      throw new Error(`Invalid numeric inputs at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
    }
    if (bestCase > mostLikely || mostLikely > worstCase) {
      Logger.log(`Error: Invalid estimate order at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
      throw new Error(`Invalid estimate order at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
    }
    if (bestCase === mostLikely || mostLikely === worstCase) {
      Logger.log(`Error: Estimates too close at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
      throw new Error(`Estimates too close at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
    }
    const range = worstCase - bestCase;
    const minRange = mostLikely * 0.001;
    if (range < minRange) {
      Logger.log(`Error: Estimate range too small at row ${rowIndex}: range=${range}, minRange=${minRange}`);
      throw new Error(`Estimate range too small at row ${rowIndex}: range=${range}, minRange=${minRange}`);
    }
    if (bestCase === mostLikely && mostLikely === worstCase) {
      Logger.log(`Error: Zero variance at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
      throw new Error(`Zero variance at row ${rowIndex}: bestCase=${bestCase}, mostLikely=${mostLikely}, worstCase=${worstCase}`);
    }

    const task = {
      task: name || 'Unnamed Task',
      optimistic: bestCase * 1.0,
      mostLikely: mostLikely * 1.0,
      pessimistic: worstCase * 1.0,
      budgetFlexibility: 0.0,
      scheduleFlexibility: 0.0,
      scopeCertainty: 0.0,
      qualityTolerance: 0.0,
      targetValue: bestCase * 1.0,
      confidenceLevel: 0.9,
      targetProbabilityOnly: false,
      optimizeFor: 'target'
    };
    Logger.log('Task object prepared for API: ' + JSON.stringify(task));

    const apiResponse = callEstimatorAPI([task]);
    if (!apiResponse || !apiResponse.results || !Array.isArray(apiResponse.results) || apiResponse.results.length === 0) {
      Logger.log('Error: API response missing or invalid "results" array');
      throw new Error('API response missing or invalid "results" array');
    }

    const result = apiResponse.results[0];
    Logger.log('API result for task: ' + result.task?.value);

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

    const properties = {
      TASK_NAME: result.task?.value || 'Unnamed Task',
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
      TARGET_PROBABILITY_POINTS: getPoints('targetProbabilityPoints', 'TARGET_PROBABILITY_POINTS')
    };

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
    throw error;
  }
}

/**
 * Fetches target probability data for Plot.html based on user inputs from sliders and mode.
 * @param {Object} params - Parameters including task, estimates, slider values, target value, confidence level, and mode.
 * @returns {Object} API response with probability data or error details.
 */
function getTargetProbabilityData(params) {
  try {
    Logger.log('getTargetProbabilityData called with params: ' + JSON.stringify(params));

    if (!params.task || typeof params.task !== 'string') {
      Logger.log('Error: task must be a non-empty string');
      throw new Error('Task must be a non-empty string');
    }
    if (typeof params.optimistic !== 'number' || !isFinite(params.optimistic) ||
        typeof params.mostLikely !== 'number' || !isFinite(params.mostLikely) ||
        typeof params.pessimistic !== 'number' || !isFinite(params.pessimistic)) {
      Logger.log(`Error: Invalid numeric inputs: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
      throw new Error(`Invalid numeric inputs: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
    }
    if (params.optimistic > params.mostLikely || params.mostLikely > params.pessimistic) {
      Logger.log(`Error: Invalid estimate order: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
      throw new Error(`Invalid estimate order: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
    }
    if (params.optimistic === params.mostLikely || params.mostLikely === params.pessimistic) {
      Logger.log(`Error: Estimates too close: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
      throw new Error(`Estimates too close: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
    }
    const range = params.pessimistic - params.optimistic;
    const minRange = params.mostLikely * 0.001;
    if (range < minRange) {
      Logger.log(`Error: Estimate range too small: range=${range}, minRange=${minRange}`);
      throw new Error(`Estimate range too small: range=${range}, minRange=${minRange}`);
    }
    if (params.optimistic === params.mostLikely && params.mostLikely === params.pessimistic) {
      Logger.log(`Error: Zero variance: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
      throw new Error(`Zero variance: optimistic=${params.optimistic}, mostLikely=${params.mostLikely}, pessimistic=${params.pessimistic}`);
    }
    if (!params.sliderValues || 
        typeof params.sliderValues.budgetFlexibility !== 'number' || !isFinite(params.sliderValues.budgetFlexibility) ||
        typeof params.sliderValues.scheduleFlexibility !== 'number' || !isFinite(params.sliderValues.scheduleFlexibility) ||
        typeof params.sliderValues.scopeCertainty !== 'number' || !isFinite(params.sliderValues.scopeCertainty) ||
        typeof params.sliderValues.qualityTolerance !== 'number' || !isFinite(params.sliderValues.qualityTolerance)) {
      Logger.log('Error: Invalid slider values: ' + JSON.stringify(params.sliderValues));
      throw new Error('All slider values must be finite numbers');
    }
    if (params.sliderValues.budgetFlexibility < 0 || params.sliderValues.budgetFlexibility > 100 ||
        params.sliderValues.scheduleFlexibility < 0 || params.sliderValues.scheduleFlexibility > 100 ||
        params.sliderValues.scopeCertainty < 0 || params.sliderValues.scopeCertainty > 100 ||
        params.sliderValues.qualityTolerance < 0 || params.sliderValues.qualityTolerance > 100) {
      Logger.log('Error: Slider values must be between 0 and 100: ' + JSON.stringify(params.sliderValues));
      throw new Error('Slider values must be between 0 and 100');
    }
    if (typeof params.targetValue !== 'number' || !isFinite(params.targetValue)) {
      Logger.log('Error: Invalid targetValue: ' + params.targetValue);
      throw new Error('Target value must be a finite number');
    }
    if (params.targetValue < params.optimistic || params.targetValue > params.pessimistic) {
      Logger.log(`Error: Target value ${params.targetValue} out of range: [${params.optimistic}, ${params.pessimistic}]`);
      throw new Error(`Target value ${params.targetValue} must be between optimistic (${params.optimistic}) and pessimistic (${params.pessimistic})`);
    }
    if (typeof params.confidenceLevel !== 'number' || !isFinite(params.confidenceLevel) || params.confidenceLevel < 0 || params.confidenceLevel > 1) {
      Logger.log('Error: Invalid confidenceLevel: ' + params.confidenceLevel);
      throw new Error('Confidence level must be a number between 0 and 1');
    }
    if (typeof params.isOptimizeMode !== 'boolean') {
      Logger.log('Error: isOptimizeMode must be a boolean: ' + params.isOptimizeMode);
      throw new Error('isOptimizeMode must be a boolean');
    }
    if (!['target', 'confidence'].includes(params.mode)) {
      Logger.log('Error: Invalid mode: ' + params.mode);
      throw new Error('Mode must be "target" or "confidence"');
    }

    const cache = CacheService.getScriptCache();
    const cacheKey = `cdf_${params.sheetId}_${params.task}`; // Include sheetId for isolation
    let cachedCdf = cache.get(cacheKey);
    let targetProbabilityOriginalCdf = null;
    if (cachedCdf) {
      try {
        targetProbabilityOriginalCdf = JSON.parse(cachedCdf);
        Logger.log('Retrieved cached targetProbabilityOriginalCdf for task: ' + params.task);
      } catch (e) {
        Logger.log('Error parsing cached CDF: ' + e.message);
        cachedCdf = null;
      }
    }

    const task = {
      task: params.task,
      optimistic: params.optimistic * 1.0,
      mostLikely: params.mostLikely * 1.0,
      pessimistic: params.pessimistic * 1.0,
      budgetFlexibility: params.isOptimizeMode && params.previousOptimalSliderSettings ?
        params.previousOptimalSliderSettings.budgetFlexibility * 1.0 :
        params.sliderValues.budgetFlexibility * 1.0,
      scheduleFlexibility: params.isOptimizeMode && params.previousOptimalSliderSettings ?
        params.previousOptimalSliderSettings.scheduleFlexibility * 1.0 :
        params.sliderValues.scheduleFlexibility * 1.0,
      scopeCertainty: params.isOptimizeMode && params.previousOptimalSliderSettings ?
        params.previousOptimalSliderSettings.scopeCertainty * 1.0 :
        params.sliderValues.scopeCertainty * 1.0,
      qualityTolerance: params.isOptimizeMode && params.previousOptimalSliderSettings ?
        params.previousOptimalSliderSettings.qualityTolerance * 1.0 :
        params.sliderValues.qualityTolerance * 1.0,
      targetValue: params.targetValue * 1.0,
      confidenceLevel: params.confidenceLevel,
      targetProbabilityOnly: false,
      optimizeFor: params.mode
    };
    Logger.log('Task object prepared for API: ' + JSON.stringify(task));

    const apiResponse = callEstimatorAPI([task]);
    if (!apiResponse || !apiResponse.results || !Array.isArray(apiResponse.results) || apiResponse.results.length === 0) {
      Logger.log('Error: API response missing or invalid "results" array');
      throw new Error('API response missing or invalid "results" array');
    }

    const result = apiResponse.results[0];
    Logger.log('API result for task: ' + result.task?.value);

    if (!cachedCdf && result.targetProbabilityOriginalCdf?.value) {
      try {
        cache.put(cacheKey, JSON.stringify(result.targetProbabilityOriginalCdf.value), 3600);
        Logger.log('Cached targetProbabilityOriginalCdf for task: ' + params.task);
      } catch (e) {
        Logger.log('Error caching targetProbabilityOriginalCdf: ' + e.message);
      }
    }

    return {
      ...result,
      targetProbabilityOriginalCdf: { value: cachedCdf ? targetProbabilityOriginalCdf : result.targetProbabilityOriginalCdf?.value || [] }
    };
  } catch (error) {
    Logger.log('Error in getTargetProbabilityData: ' + error.message);
    throw new Error('Failed to fetch target probability data: ' + error.message);
  }
}

/**
 * SECTION 6: WEB APP INTEGRATION
 * Handles web app requests for creating and submitting estimate sheets.
 */

/**
 * Shows the HTML form or Plot.html for the web app.
 * @param {Object} e - HTTP event with parameters.
 * @returns {HtmlOutput|TextOutput} HTML form or JSON response.
 */
function doGet(e) {
  Logger.log('doGet called with parameters: ' + JSON.stringify(e?.parameter || {}));
  const startTime = Date.now();
  try {
    const config = personas(e, 'doGet');
    if (e?.parameter?.sheetId) {
      Logger.log('Serving Plot.html with sheetId: ' + config.sheetId);
      try {
        // Verify spreadsheet access
        const ss = SpreadsheetApp.openById(config.sheetId);
        const sheet = ss.getSheetByName(config.sheetName || 'Estimation Data');
        if (!sheet) {
          Logger.log('Error: Sheet not found: ' + config.sheetName);
          throw new Error('Sheet not found: ' + config.sheetName);
        }
        if (Date.now() - startTime > 5000) {
          Logger.log('Error: doGet timed out while accessing spreadsheet');
          throw new Error('Operation timed out while accessing spreadsheet');
        }
        const html = HtmlService.createHtmlOutputFromFile('Plot')
          .setTitle('PERT Estimate Plot')
          .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        html.setContent(
          '<script>' +
          'var sheetId = ' + JSON.stringify(config.sheetId) + ';' +
          'var sheetName = ' + JSON.stringify(config.sheetName) + ';' +
          'var defaultTask = ' + JSON.stringify(config.defaultTask) + ';' +
          '</script>' + html.getContent()
        );
        return html;
      } catch (plotError) {
        Logger.log('Error serving Plot.html: ' + plotError.message + '\nStack: ' + plotError.stack);
        return ContentService.createTextOutput(
          JSON.stringify({ error: 'Failed to load Plot.html: ' + plotError.message })
        ).setMimeType(ContentService.MimeType.JSON);
      }
    }
    Logger.log('Serving submit.html with tasks: ' + (e?.parameter?.tasks || 'none'));
    const template = HtmlService.createTemplateFromFile('submit');
    try {
      // Pass tasks as a parsed JSON object instead of a string
      template.tasks = e?.parameter?.tasks ? JSON.parse(decodeURIComponent(e.parameter.tasks)) : [];
      template.projectName = e?.parameter?.projectName ? decodeURIComponent(e.parameter.projectName) : 'Project';
      Logger.log('Parsed tasks for submit.html: ' + JSON.stringify(template.tasks));
      Logger.log('Project name for submit.html: ' + template.projectName);
    } catch (decodeError) {
      Logger.log('Error decoding or parsing tasks parameter: ' + decodeError.message);
      template.tasks = [];
      template.projectName = e?.parameter?.projectName ? decodeURIComponent(e.parameter.projectName) : 'Project';
    }
    if (Date.now() - startTime > 5000) {
      Logger.log('Error: doGet timed out while rendering submit.html');
      throw new Error('Operation timed out while rendering submit.html');
    }
    return template.evaluate().setTitle('Submit Your Estimates');
  } catch (error) {
    Logger.log('Error in doGet: ' + error.message + '\nStack: ' + error.stack);
    return ContentService.createTextOutput(
      JSON.stringify({ error: 'Server error: ' + error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Creates a spreadsheet and returns URLs for the web app.
 * @param {Array} tasks - Array of task objects.
 * @returns {Object} Object containing sheetUrl, plotUrl, message, errors, and selectedTask.
 */
function createEstimateSheet(tasks) {
  Logger.log('createEstimateSheet called with tasks: ' + JSON.stringify(tasks));
  try {
    // Validate tasks
    let selectedTask = null;
    tasks.forEach((task, i) => {
      task.taskName = (task.taskName || '').replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 50) || `Task_${i + 1}`;
      if (!task.taskName || 
          typeof task.bestCase !== 'number' || !isFinite(task.bestCase) ||
          typeof task.mostLikely !== 'number' || !isFinite(task.mostLikely) ||
          typeof task.worstCase !== 'number' || !isFinite(task.worstCase)) {
        Logger.log('Invalid task data at index ' + i + ': ' + JSON.stringify(task));
        throw new Error('Invalid task data at index ' + i + ': ' + JSON.stringify(task));
      }
      if (task.bestCase > task.mostLikely || task.mostLikely > task.worstCase) {
        Logger.log('Invalid estimate order at index ' + i + ': ' + JSON.stringify(task));
        throw new Error('Invalid estimate order at index ' + i);
      }
      if (task.bestCase === task.mostLikely || task.mostLikely === task.worstCase) {
        Logger.log('Estimates too close at index ' + i + ': ' + JSON.stringify(task));
        throw new Error('Estimates must be distinct at index ' + i);
      }
      const range = task.worstCase - task.bestCase;
      const minRange = task.mostLikely * 0.001;
      if (range < minRange) {
        Logger.log('Estimate range too small at index ' + i + ': range=' + range + ', minRange=' + minRange);
        throw new Error('Estimate range too small at index ' + i);
      }
      if (task.selectedForPlot) {
        if (selectedTask) {
          Logger.log('Multiple tasks selected for plotting at index ' + i);
          throw new Error('Only one task can be selected for plotting');
        }
        selectedTask = task.taskName;
      }
    });

    // Create a new spreadsheet
    const ss = SpreadsheetApp.create('PERT Estimates ' + new Date().toISOString().split('T')[0]);
    const sheet = ss.getSheets()[0];
    sheet.setName('Estimation Data');

    // Write tasks to the sheet
    const data = tasks.map(task => [
      task.taskName,
      task.bestCase,
      task.mostLikely,
      task.worstCase,
      task.selectedForPlot ? 'TRUE' : 'FALSE'
    ]);
    sheet.getRange(2, 1, data.length, 5).setValues(data);

    // Set headers
    sheet.getRange(1, 1, 1, 5).setValues([['Task Name', 'Best Case', 'Most Likely', 'Worst Case', 'Selected for Plot']]).setFontWeight('bold');

    // Call addPertColumns to process the data
    const config = {
      sheetId: ss.getId(),
      isWebAppContext: true,
      errorHandler: 'confirm'
    };
    const result = addPertColumns(config);

    // Prepare response
    const sheetUrl = ss.getUrl();
    const plotUrl = `https://script.google.com/macros/s/${ScriptApp.getScriptId()}/exec?sheetId=${ss.getId()}`;
    return {
      status: result.status,
      sheetUrl: sheetUrl,
      plotUrl: plotUrl,
      message: result.message,
      errors: result.errors,
      selectedTask: selectedTask
    };
  } catch (error) {
    Logger.log('Error in createEstimateSheet: ' + error.message);
    throw new Error('Failed to create estimate sheet: ' + error.message);
  }
}

/**
 * Handles POST requests to auto-create a sheet for the web app.
 * @param {Object} e - HTTP event with parameters.
 * @returns {TextOutput} JSON containing sheetUrl, plotUrl, message, errors, and selectedTask.
 */
function doPost(e) {
  Logger.log('doPost called with parameters: ' + JSON.stringify(e?.parameter));
  try {
    if (!e || !e.parameter || !e.parameter.data) {
      throw new Error('Missing data parameter.');
    }

    const tasks = JSON.parse(e.parameter.data);
    if (!Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('Invalid or empty tasks array.');
    }

    return ContentService.createTextOutput(
      JSON.stringify(createEstimateSheet(tasks))
    ).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doPost: ' + error.message);
    return ContentService.createTextOutput(
      JSON.stringify({ error: error.message })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}
     