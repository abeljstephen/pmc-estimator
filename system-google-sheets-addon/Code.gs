// =========================================
// Section 1: API Call
// =========================================
/**
 * Calls your Cloud Function API with an array of estimates.
 */
function callEstimator(estimatesArray) {
  var url = "https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI";
  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(estimatesArray),
    muteHttpExceptions: true // helpful for debugging errors
  });
  var parsed = JSON.parse(response.getContentText());
  if (parsed.error) throw new Error("API Error: " + parsed.error);
  return parsed;
}

// =========================================
// Section 2: Sheet Output
// =========================================
/**
 * Writes Estimate Calculations sheet.
 */
function createEstimateSheet(results) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Estimate Calculations");
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet("Estimate Calculations");
  }

  // Headers
  sheet.getRange(1, 1, 1, 17).setValues([
    [
      "Task",
      "Best Case\n(Minimum estimate)",
      "Most Likely\n(Most probable value)",
      "Worst Case\n(Maximum estimate)",
      "Triangle Mean\n(Average of min, mode, max)",
      "Triangle Variance\n(Spread of Triangle)",
      "PERT Mean\n(Expected value for planning)",
      "PERT StdDev\n(Uncertainty measure)",
      "PERT Variance\n(Spread of PERT)",
      "Beta Alpha\n(Beta distribution shape α)",
      "Beta Beta\n(Beta distribution shape β)",
      "Beta Mode\n(Most frequent Beta value)",
      "MC Smoothed Mean\n(Average from simulation)",
      "MC Smoothed VaR90\n(90% percentile—risk buffer)",
      "Weighted Conservative\n(PERT mean + std dev)",
      "Weighted Neutral\n(PERT mean)",
      "Weighted Optimistic\n(PERT mean - std dev)"
    ]
  ]);

  // Rows
  var rows = results.map(function(result, i) {
    return [
      "Task " + (i + 1),
      result.estimates?.bestCase ?? "",
      result.estimates?.mostLikely ?? "",
      result.estimates?.worstCase ?? "",
      result.triangleMean ?? "",
      result.triangleVariance ?? "",
      result.pertMean ?? "",
      result.pertStdDev ?? "",
      result.pertVariance ?? "",
      result.pertAlpha ?? "",             // ✅ Corrected
      result.pertBeta ?? "",              // ✅ Corrected
      result.betaMode ?? "",
      result.mcSmoothedMean ?? "",
      result.mcSmoothedVaR90 ?? "",
      result.pertMean !== undefined && result.pertStdDev !== undefined ? result.pertMean + result.pertStdDev : "",
      result.pertMean ?? "",
      result.pertMean !== undefined && result.pertStdDev !== undefined ? result.pertMean - result.pertStdDev : ""
    ];
  });

  sheet.getRange(2, 1, rows.length, 17).setValues(rows);
  sheet.getRange(2, 7, rows.length, 1).setBackground("#c6efce");
}


// =========================================
// Section 3: Main Orchestration
// =========================================
/**
 * Master function called by "PERT" button or test manually.
 */
function estimateAndSave() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inputSheet = ss.getSheets()[0];
  var data = inputSheet.getDataRange().getValues();

  if (data.length < 2) {
    SpreadsheetApp.getUi().alert("No data rows found in the input sheet.");
    return;
  }

  var estimatesArray = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    estimatesArray.push({
      bestCase: row[1],
      mostLikely: row[2],
      worstCase: row[3]
    });
  }

  var apiResponse = callEstimator(estimatesArray);

  // Clone and remove large properties that exceed Apps Script property size
  var cloned = JSON.parse(JSON.stringify(apiResponse));
  cloned.results.forEach(function(task) {
    delete task.mcBetaSamples;
    delete task.unsmoothedPercentiles;
    delete task.smoothedPercentiles;
    delete task.smoothedHistogram;
    delete task.trianglePoints;
    delete task.pertPoints;
    delete task.originalCdf;
    delete task.optimizedCdf;
  });

  PropertiesService.getDocumentProperties().setProperty(
    "latestEstimationResults",
    JSON.stringify(cloned)
  );

  createEstimateSheet(apiResponse.results);

  SpreadsheetApp.getUi().alert(
    "Estimate Calculations completed. You can now open the Plot."
  );
}

// =========================================
// Section 4: UI Functions
// =========================================
/**
 * Shows the sidebar form.
 */
function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("submit.html")
    .setTitle("PMC Estimator");
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Shows the plot modal dialog.
 */
function showPlot() {
  var template = HtmlService.createTemplateFromFile("Plot");
  template.estimateResults = getLatestEstimationResults();
  var html = template.evaluate()
    .setWidth(1000)
    .setHeight(700);
  SpreadsheetApp.getUi().showModalDialog(html, "Estimation Plots & Explorer");
}


/**
 * Returns the stored estimation JSON for plot.html.
 */
function getLatestEstimationResults() {
  var json = PropertiesService.getDocumentProperties().getProperty(
    "latestEstimationResults"
  );
  return json ? JSON.parse(json) : null;
}

// =========================================
// Section 5: Debug & Testing Helpers
// =========================================
/**
 * Test function: estimate and log.
 */
function testEstimatorBatch() {
  estimateAndSave();
}

/**
 * Debug function: log API response JSON.
 */
function logApiResponse() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inputSheet = ss.getSheets()[0];
  var data = inputSheet.getDataRange().getValues();

  var estimatesArray = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    estimatesArray.push({
      bestCase: row[1],
      mostLikely: row[2],
      worstCase: row[3]
    });
  }

  var apiResponse = callEstimator(estimatesArray);

  // Only keep summary of each result for logging
  var summary = apiResponse.results.map(function(r, idx) {
    return {
      task: idx + 1,
      triangleMean: r.triangleMean,
      pertMean: r.pertMean,
      pertStdDev: r.pertStdDev,
      betaAlpha: r.betaAlpha,
      betaBeta: r.betaBeta,
      betaMode: r.betaMode,
      mcSmoothedMean: r.mcSmoothedMean,
      mcSmoothedVaR90: r.mcSmoothedVaR90,
      weightedConservative: r.weightedConservative,
      weightedNeutral: r.weightedNeutral,
      weightedOptimistic: r.weightedOptimistic
    };
  });

  Logger.log(JSON.stringify(summary, null, 2));
}

/**
 * Debug function: time API call.
 */
function testApiTiming() {
  var estimatesArray = [
    { bestCase: 2, mostLikely: 4, worstCase: 6 }
  ];
  var start = new Date();
  var response = callEstimator(estimatesArray);
  var end = new Date();
  Logger.log("API call duration (ms): " + (end - start));
}

function debugGetResults() {
  const res = getLatestEstimationResults();
  Logger.log(JSON.stringify(res, null, 2));
}
