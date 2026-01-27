/**
 * testCoreCall - Quick debug/test function to call the local core logic directly
 * 
 * PURPOSE / WHY THIS HELPS:
 *   - Bypasses the full menu/sheet workflow
 *   - Calls pmcEstimatorAPI directly with a single hardcoded test task
 *   - Writes the FULL RAW JSON RESPONSE to sheet "testcore" (creates or clears it)
 *   - Splits huge JSON line-by-line to avoid the 50,000 char/cell limit
 *   - Also shows extracted key values in a table
 * 
 * HOW TO USE:
 *   1. Paste/replace this function in Code.gs
 *   2. Save
 *   3. Editor dropdown → select "testCoreCall" → Run
 *   4. Look at sheet "testcore" in your spreadsheet
 * 
 * TIP: If sliders are still reverted or missing → look in the JSON lines for
 *      "optimalSliderSettings", "optimize.status", "reverted", "clamp", etc.
 */
function testCoreCall() {
  // ────────────────────────────────────────────────
  // 1. Hardcoded test task
  // ────────────────────────────────────────────────
  const testTask = {
    task: "Test Project",
    optimistic: 10,
    mostLikely: 20,
    pessimistic: 30,
    targetValue: 20,
    confidenceLevel: 0.95,
    wantPoints: true,
    includeOptimizedPoints: false
  };

  const payload = [testTask];

  let rawResult = null;
  let errorMsg = null;

  // ────────────────────────────────────────────────
  // 2. Call core
  // ────────────────────────────────────────────────
  try {
    console.log('TEST CORE CALL: Starting →', JSON.stringify(testTask, null, 2));
    rawResult = pmcEstimatorAPI(payload);
    console.log('TEST CORE CALL RESULT:', JSON.stringify(rawResult, null, 2));
    
    if (rawResult?.results?.[0]) {
      const first = rawResult.results[0];
      if (first.error) {
        console.log('CORE ERROR:', first.error);
      } else {
        console.log('CORE SUCCESS — Baseline?', !!first.baseline);
      }
    }
  } catch (e) {
    errorMsg = e.message + '\n' + e.stack;
    console.log('TEST CORE CALL ERROR:', errorMsg);
  }

  // ────────────────────────────────────────────────
  // 3. Write to sheet "testcore"
  // ────────────────────────────────────────────────
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("testcore");

  if (!sheet) {
    sheet = ss.insertSheet("testcore");
    console.log('Created sheet: testcore');
  } else {
    sheet.clear();
    console.log('Cleared sheet: testcore');
  }

  const now = new Date();
  const ts = Utilities.formatDate(now, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss z");

  // Header
  sheet.getRange("A1")
    .setValue("PMC Core Test — " + ts)
    .setFontWeight("bold")
    .setFontSize(14)
    .setBackground("#e6f3ff");

  sheet.getRange("A2")
    .setValue("RAW JSON RESPONSE (line by line — scroll down)")
    .setFontWeight("bold");

  // Write JSON line-by-line to avoid 50k char limit
  let startRow = 3;
  if (rawResult) {
    const jsonPretty = JSON.stringify(rawResult, null, 2);
    const lines = jsonPretty.split('\n');
    
    // Write in chunks of ~200 lines to be safe (Sheets handles ~10k rows fine)
    const chunkSize = 200;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      sheet.getRange(startRow, 1, chunk.length, 1).setValues(chunk.map(line => [line]));
      startRow += chunk.length;
    }
    
    console.log(`Wrote ${lines.length} JSON lines to testcore!A${3}:${startRow-1}`);
    
    // Auto-resize column A
    sheet.autoResizeColumn(1);
  } else {
    sheet.getRange(startRow, 1).setValue("No result returned");
    startRow++;
  }

  // Error block
  if (errorMsg) {
    sheet.getRange(startRow + 1, 1)
      .setValue("ERROR:\n" + errorMsg)
      .setFontColor("red")
      .setFontWeight("bold");
    startRow += 3;
  }

  // ────────────────────────────────────────────────
  // 4. Extracted summary table
  // ────────────────────────────────────────────────
  sheet.getRange(startRow + 1, 1)
    .setValue("EXTRACTED SUMMARY")
    .setFontWeight("bold");
  startRow += 2;

  const headers = ["Field", "Value", "Notes / Path"];
  sheet.getRange(startRow, 1, 1, 3)
    .setValues([headers])
    .setFontWeight("bold")
    .setBackground("#d9ead3");
  startRow++;

  const first = rawResult?.results?.[0] ?? rawResult?.[0] ?? rawResult ?? {};

  const summaryData = [
    ["PERT (baseline)", first?.baseline?.pert?.value ?? first?.baseline?.mean?.value ?? first?.baseline?.PERT?.value ?? "—", "baseline.pert.value / baseline.mean.value"],
    ["Baseline Prob at Target", first?.baseline?.probabilityAtTarget?.value ?? first?.baseline?.targetProbability?.value ?? "—", "baseline.probabilityAtTarget.value"],
    ["Optimized Prob at Target", first?.optimize?.probabilityAtTarget?.value ?? first?.targetProbability?.value?.adjustedOptimized ?? "—", "optimize.probabilityAtTarget.value"],
    ["Optimal Sliders (JSON)", JSON.stringify(first?.optimalSliderSettings?.value ?? first?.optimalSliderSettings ?? first?.optimize?.sliders ?? "—", null, 2), "optimalSliderSettings.value"],
    ["Optimization Status", first?.optimize?.status ?? first?.status ?? "—", "optimize.status"],
    ["Reverted / Clamped?", first?.optimize?.message?.includes?.("Reverted") || first?.optimize?.message?.includes?.("clamp") ? "YES" : "No / Not mentioned", "Look for 'Reverted sliders' in JSON"],
    ["PDF Points (baseline)", first?.baseline?.monteCarloSmoothed?.pdfPoints?.length ?? first?.baseline?.pdfPoints?.length ?? 0, "Length of baseline PDF array"],
    ["PDF Points (optimized)", first?.optimize?.reshapedPoints?.pdfPoints?.length ?? first?.optimizedReshapedPoints?.pdfPoints?.length ?? 0, "Length — 0 usually means reverted/no opt points"],
    ["Error Field", first?.error ?? "None", "results[0].error"]
  ];

  sheet.getRange(startRow, 1, summaryData.length, 3).setValues(summaryData);
  sheet.autoResizeColumns(1, 3);

  SpreadsheetApp.flush();
  console.log('Finished writing to sheet: testcore');

  return rawResult;
}
