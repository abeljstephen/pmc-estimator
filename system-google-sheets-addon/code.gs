/**
 * Calls your Cloud Function API.
 */
function callEstimator(estimates) {
  var url = "https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI";
  var response = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(estimates)
  });
  return JSON.parse(response.getContentText());
}

/**
 * Creates (or updates) the Estimate Calculations sheet.
 */
function createEstimateSheet(result) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Estimate Calculations");
  if (sheet) {
    sheet.clear();
  } else {
    sheet = ss.insertSheet("Estimate Calculations");
  }

  sheet.getRange("A1").setValue("Best Case");
  sheet.getRange("B1").setValue("Most Likely");
  sheet.getRange("C1").setValue("Worst Case");
  sheet.getRange("D1").setValue("Expected Value");

  sheet.getRange("A2").setValue(result.estimates.bestCase);
  sheet.getRange("B2").setValue(result.estimates.mostLikely);
  sheet.getRange("C2").setValue(result.estimates.worstCase);
  sheet.getRange("D2").setValue(result.expectedValue);
}

/**
 * Master function to call from submit.html or test manually.
 */
function estimateAndSave(estimates) {
  var result = callEstimator(estimates);
  createEstimateSheet(result);
  return result;
}

