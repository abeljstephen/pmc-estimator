// Code.gs

// =========================================
// Section 1: Menu Setup
// =========================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("PMC Estimator")
    .addItem("Show Form", "showForm")
    .addItem("Show Plot", "showPlot")
    .addToUi();
}

// =========================================
// Section 2: Sidebar Form
// =========================================
function showForm() {
  var html = HtmlService.createHtmlOutputFromFile("index")
    .setTitle("PMC Estimator");
  SpreadsheetApp.getUi().showSidebar(html);
}

// =========================================
// Section 3: Plot Modal Dialog
// =========================================
function showPlot() {
  var template = HtmlService.createTemplateFromFile("Plot");
  template.estimateResults = getLatestEstimationResults();
  var html = template.evaluate()
    .setWidth(1000)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, "PMC Estimator Plot");
}

// =========================================
// Section 4: Data Fetching
// =========================================
function getEstimatesFromSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inputSheet = ss.getSheets()[0];
  var data = inputSheet.getDataRange().getValues();

  if (data.length < 2) {
    throw new Error("No data rows found in the input sheet.");
  }

  var estimatesArray = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var optimistic = parseFloat(row[1]);
    var mostLikely = parseFloat(row[2]);
    var pessimistic = parseFloat(row[3]);

    if (isNaN(optimistic) || isNaN(mostLikely) || isNaN(pessimistic)) {
      Logger.log(`Row ${i + 1} skipped: Invalid numbers - Task: ${row[0]}, Optimistic: ${row[1]}, Most Likely: ${row[2]}, Pessimistic: ${row[3]}`);
      continue;
    }

    estimatesArray.push({
      task: row[0],
      optimistic: optimistic,
      mostLikely: mostLikely,
      pessimistic: pessimistic
    });
  }

  if (estimatesArray.length === 0) {
    throw new Error("No valid data rows found. All rows contain invalid numeric values.");
  }

  Logger.log('Estimates sent to API: ' + JSON.stringify(estimatesArray));
  return estimatesArray;
}

function getApiFields() {
  var url = "https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPIFields";
  var options = {
    method: "get",
    contentType: "application/json",
    followRedirects: true,
    muteHttpExceptions: true
  };
  try {
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    Logger.log('API fields response: ' + responseText);
    var parsed = JSON.parse(responseText);
    if (parsed.error) throw new Error("API Error: " + parsed.error);
    return parsed.fields;
  } catch (e) {
    Logger.log('API Error fetching fields: ' + e.toString());
    throw new Error("Failed to fetch fields: " + e.message);
  }
}

function callEstimator(estimatesArray, fields) {
  var url = "https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI";
  if (fields) url += "?fields=" + encodeURIComponent(fields.join(','));
  var sanitizedArray = estimatesArray.map(estimate => ({
    task: estimate.task,
    optimistic: Number(estimate.optimistic),
    mostLikely: Number(estimate.mostLikely),
    pessimistic: Number(estimate.pessimistic)
  }));
  var payload = JSON.stringify(sanitizedArray);
  Logger.log('Sanitized payload: ' + payload);
  try {
    var options = {
      method: "post",
      contentType: "application/json",
      payload: payload,
      followRedirects: true,
      muteHttpExceptions: true
    };
    var response = UrlFetchApp.fetch(url, options);
    var responseText = response.getContentText();
    Logger.log('API response: ' + responseText);
    var parsed = JSON.parse(responseText);
    if (parsed.error) throw new Error("API Error: " + parsed.error);
    return parsed;
  } catch (e) {
    Logger.log('API Error details: ' + e.toString());
    throw new Error("Failed to fetch data: " + e.message);
  }
}

function getInputHash() {
  var estimates = getEstimatesFromSheet();
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(estimates))
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
}

function getLatestEstimationResults() {
  var props = PropertiesService.getDocumentProperties();
  var fields = props.getProperty("apiFields");
  if (!fields) return null;
  fields = JSON.parse(fields);
  var results = [];
  var tasks = [];
  fields.forEach(field => {
    for (let i = 0; i < 9; i++) { // Adjust based on number of tasks
      var data = props.getProperty(`result_${field}_${i}`);
      if (data) {
        var parsed = JSON.parse(data);
        if (!tasks.includes(parsed.task)) tasks.push(parsed.task);
        if (!results[i]) results[i] = { task: parsed.task };
        results[i][field] = parsed[field];
      }
    }
  });
  if (results.length === 0) return null;
  return { results: results.filter(r => r !== null) };
}

// =========================================
// Section 5: Main Orchestration
// =========================================
function estimateAndSave() {
  var estimates = getEstimatesFromSheet();
  var currentHash = getInputHash();
  var props = PropertiesService.getDocumentProperties();
  var lastHash = props.getProperty("inputHash");

  // Check if recalculation is needed
  if (currentHash === lastHash) {
    Logger.log('No input changes detected, using cached results');
    return;
  }

  // Fetch available fields
  var fields = getApiFields();
  props.setProperty("apiFields", JSON.stringify(fields));
  Logger.log('Available fields: ' + fields);

  // Required fields for Code.gs and Plot.html
  var requiredFields = [
    "triangleMean", "pertMean", "mcSmoothedMean",
    "trianglePoints", "pertPoints", "betaPoints",
    "mcBetaSamples", "smoothedHistogram",
    "originalCdf", "optimizedCdf", "mcSmoothedVaR90",
    "weightedOptimistic", "weightedNeutral", "weightedConservative",
    "triangleMetrics", "betaMetrics", "mcMetrics"
  ];

  // Fetch required fields
  var apiResponse = callEstimator(estimates, requiredFields);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inputSheet = ss.getSheets()[0];
  var calcSheet = ss.getSheetByName("Estimate Calculations");
  if (!calcSheet) {
    calcSheet = ss.insertSheet("Estimate Calculations");
  }
  calcSheet.clear();
  var headers = inputSheet.getRange(1, 1, 1, inputSheet.getLastColumn()).getValues()[0];
  calcSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var data = inputSheet.getDataRange().getValues();
  calcSheet.getRange(2, 1, data.length - 1, data[0].length).setValues(data.slice(1));

  var apiHeaders = requiredFields;
  var calcRange = calcSheet.getRange(1, headers.length + 1, 1, apiHeaders.length);
  calcRange.setValues([apiHeaders]);
  var rows = apiResponse.results.map(obj => requiredFields.map(field => 
    typeof obj[field] === 'object' ? JSON.stringify(obj[field]) : obj[field]
  ));
  calcSheet.getRange(2, headers.length + 1, rows.length, apiHeaders.length).setValues(rows);

  // Cache individual fields
  apiResponse.results.forEach((result, i) => {
    requiredFields.forEach(field => {
      if (result[field]) {
        var key = `result_${field}_${i}`;
        var value = JSON.stringify({ task: result.task, [field]: result[field] });
        if (value.length < 9216) {
          props.setProperty(key, value);
        } else {
          Logger.log(`Warning: Field ${field} for task ${result.task} too large (${value.length} bytes)`);
        }
      }
    });
  });

  props.setProperty("inputHash", currentHash);
  SpreadsheetApp.getUi().alert("Estimate Calculations completed. You can now open the Plot.");
}

// =========================================
// Section 6: Plot Data
// =========================================
function processDataForPlot() {
  var results = getLatestEstimationResults();
  if (!results || !results.results) {
    Logger.log('No results found, returning empty array');
    return [];
  }
  Logger.log('Plot data: ' + JSON.stringify(results.results));
  return results.results.map(result => ({
    task: result.task,
    trianglePoints: result.trianglePoints ? JSON.parse(result.trianglePoints) : null,
    pertPoints: result.pertPoints ? JSON.parse(result.pertPoints) : null,
    betaPoints: result.betaPoints ? JSON.parse(result.betaPoints) : null,
    mcBetaSamples: result.mcBetaSamples ? JSON.parse(result.mcBetaSamples) : null,
    smoothedHistogram: result.smoothedHistogram ? JSON.parse(result.smoothedHistogram) : null,
    originalCdf: result.originalCdf ? JSON.parse(result.originalCdf) : null,
    optimizedCdf: result.optimizedCdf ? JSON.parse(result.optimizedCdf) : null,
    triangleMetrics: result.triangleMetrics ? JSON.parse(result.triangleMetrics) : null,
    betaMetrics: result.betaMetrics ? JSON.parse(result.betaMetrics) : null,
    mcMetrics: result.mcMetrics ? JSON.parse(result.mcMetrics) : null,
    mcSmoothedVaR90: result.mcSmoothedVaR90,
    weightedOptimistic: result.weightedOptimistic,
    weightedNeutral: result.weightedNeutral,
    weightedConservative: result.weightedConservative
  }));
}

// =========================================
// Section 7: Web App
// =========================================
function doGet(e) {
  var estimates = getEstimatesFromSheet();
  var fields = getApiFields();
  var results = callEstimator(estimates, fields);
  var template = HtmlService.createTemplateFromFile('Plot');
  template.estimateResults = results;
  return template.evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle('PMC Estimator Plot')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}
