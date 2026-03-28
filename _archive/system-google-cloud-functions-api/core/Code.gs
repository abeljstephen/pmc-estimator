/************************************************************
 * Code.gs — PMC (PERT + PLOT)
 * - Local execution version (no Google Cloud API)
 * - Uses core logic from main/main.gs and other local files
 * - All functions are global in Apps Script — no require needed
 * - All old Cloud API code is commented out but preserved for reference
 ************************************************************/

/************************************************************
 * 1. CONFIG
 ************************************************************/
var CFG = {
  SRC_SHEET_NAME: 'data',
  SRC_SHEET_INDEX: 0,

  OUT_SHEET_NAME: 'Estimate Calculations',
  LOG_SHEET_NAME: 'PERT_Logs',

  DATA_ROW_HEIGHT_PX: 50,
  COL_WIDTH_PX: 110,
  STATUS_COL_WIDTH_PX: 300,
  JSON_COL_WIDTH_PX: 220,

  MAX_POINTS: 200,

  API_RETRIES: 3,
  P2_MAX_RETRIES: 2,
  P2_STRONG_RETRY: true,
  LOOP_SAFETY_MS: 6*60*1000 - 15000,

  CONFIDENCE: 0.95,

  ALLOW_P3_WITHOUT_SLIDERS: true,
  DUPLICATE_BASELINE_ON_NO_IMPROVE: true
};

/************************************************************
 * 2. HEADERS
 ************************************************************/
var HEADERS = [
  'Name','Best Case','Most Likely','Worst Case',
  'PERT','MC Smoothed 95% CI Lower','MC Smoothed 95% CI Upper','% Confidence of Original PERT Value',
  'Optimal Budget Flexibility','Optimal Schedule Flexibility','Optimal Scope Certainty','Optimal Scope Reduction Allowance','Optimal Rework Percentage','Optimal Risk Tolerance','Optimal User Confidence',
  '% Confidence of Original PERT Value After Slider Optimization','MC Smoothed Sensitivity Change','KL Divergence To Triangle',
  'Baseline MC Smoothed Points (PDF)','Baseline MC Smoothed Points (CDF)',
  'Optimized MC Smoothed Points (PDF)','Optimized MC Smoothed Points (CDF)',
  'Status'
];

var HEADER_NOTES = [
  'Task name or identifier',
  'Optimistic estimate (best-case)',
  'Most likely estimate (expected)',
  'Pessimistic estimate (worst-case)',

  'PERT mean (local core)',
  '95% CI lower (MC-smoothed, local core)',
  '95% CI upper (MC-smoothed, local core)',
  'Baseline probability at target=PERT (local core)',

  'Optimized budget flexibility (%)',
  'Optimized schedule flexibility (%)',
  'Optimized scope certainty (%)',
  'Optimized scope reduction allowance (%)',
  'Optimized rework percentage (%)',
  'Optimized risk tolerance (%)',
  'Optimized user confidence (%)',

  'Optimized probability at PERT (local core)',
  'Sensitivity change (local core)',
  'KL divergence Triangle→MC-smoothed baseline (local core)',

  'Baseline MC-smoothed PDF (JSON from local core)',
  'Baseline MC-smoothed CDF (local core)',
  'Optimized MC-smoothed PDF (JSON from local core)',
  'Optimized MC-smoothed CDF (local core)',

  'Phase/status with timestamps'
];

/************************************************************
 * 3. UTILITIES
 ************************************************************/
function nowStamp() {
  const d = new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}
function tsMsg(msg) { return `${msg} @ ${nowStamp()}`; }
function safeAlert_(msg) { try { SpreadsheetApp.getUi().alert(msg); } catch(_){} }
function toast_(title, msg, sec) {
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg || '', title || '', sec || 5); } catch(_) {}
}

function isNumber(x) { return typeof x === 'number' && Number.isFinite(x); }
function num(v) {
  if (v === null || v === undefined || v === '') return null;

  let n;
  if (typeof v === 'number') {
    n = v;
  } else if (typeof v === 'string') {
    n = parseFloat(v.trim().replace(/[^0-9.-]/g, ''));
  } else {
    n = Number(v);
  }
  return Number.isFinite(n) && !isNaN(n) ? n : null;
}
function toFixed6(v) { return isNumber(v) ? Number(v).toFixed(6) : ''; }
function clipArray(arr, n) { return Array.isArray(arr) ? arr.slice(0, Math.max(0, n|0)) : []; }
function scale01To100_(v) {
  const n = num(v);
  if (!isNumber(n)) return null;
  return (n >= 0 && n <= 1) ? (n * 100) : (isNumber(n) ? n : null);
}
function normalizePoints_(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const p of arr) {
    if (!p || typeof p !== 'object') continue;
    const x = num(p.x);
    const y = num(p.y);
    if (isNumber(x) && isNumber(y)) out.push({ x, y });
  }
  out.sort((a,b) => a.x - b.x);
  return out;
}
function setHeaderNotes_(sheet) {
  const rng = sheet.getRange(1, 1, 1, HEADERS.length);
  rng.setValues([HEADERS]).setFontWeight('bold');
  for (let c = 1; c <= HEADERS.length; c++) {
    sheet.getRange(1, c).setNote(HEADER_NOTES[c-1] || '');
  }
}

/* -------- Slider key aliasing + normalization helpers ---------- */

var SLIDER_KEYS = [
  'budgetFlexibility','scheduleFlexibility','scopeCertainty',
  'scopeReductionAllowance','reworkPercentage','riskTolerance','userConfidence'
];

function aliasSliderKey_(name) {
  if (!name) return null;
  const n = String(name).toLowerCase().replace(/\s+/g, '').replace(/[^a-z]/g, '');
  const map = {
    'budgetflexibility': 'budgetFlexibility',
    'scheduleflexibility': 'scheduleFlexibility',
    'scopecertainty': 'scopeCertainty',
    'scopereductionallowance': 'scopeReductionAllowance',
    'reworkpercentage': 'reworkPercentage',
    'risktolerance': 'riskTolerance',
    'userconfidence': 'userConfidence'
  };
  return map[n] || null;
}

function normalizeSlidersToPct_(src) {
  if (!src || typeof src !== 'object') return null;
  const out = {};
  if (Array.isArray(src)) {
    src.forEach(it => {
      const key = aliasSliderKey_(it?.slider || it?.key || it?.name || it?.field);
      const v = num(it?.value ?? it?.target ?? it?.optimized ?? it?.opt ?? it?.setting);
      if (key && isNumber(v)) out[key] = scale01To100_(v) || v;
    });
  } else {
    Object.keys(src).forEach(k => {
      const key = aliasSliderKey_(k) || k;
      const v = num(src[k]);
      if (isNumber(v)) out[key] = scale01To100_(v) || v;
    });
  }
  const filtered = {};
  SLIDER_KEYS.forEach(k => { 
    const v = out[k];
    if (isNumber(v)) filtered[k] = Math.max(0, Math.min(100, v)); 
  });
  return Object.keys(filtered).length > 0 ? filtered : null;
}

function isDefaultSliderVector_(slidersPct) {
  if (!slidersPct || typeof slidersPct !== 'object') return false;
  const def = { budgetFlexibility:25, scheduleFlexibility:12.5, scopeCertainty:90, scopeReductionAllowance:25, reworkPercentage:0, riskTolerance:70, userConfidence:77.5 };
  return SLIDER_KEYS.every(k => isNumber(slidersPct[k]) && Math.abs(slidersPct[k] - def[k]) < 1e-6);
}

/* -------- PERT helper -------- */
function computePertMean_(O, M, P) {
  const o = num(O), m = num(M), p = num(P);
  if ([o,m,p].every(isNumber)) return (o + 4*m + p) / 6;
  return null;
}

/************************************************************
 * 4. MENUS
 ************************************************************/
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  const pert = ui.createMenu('PERT')
    .addItem('PERT All Rows', 'pertRunAllRows')
    .addItem('PERT Selected Rows', 'pertRunSelectedRows')
    .addSeparator()
    .addItem('Export Run Log', 'writeLogsToSheet');

  const plot = ui.createMenu('PLOT').addItem('Open', 'openPlotUi');

  ui.createMenu('PMC')
    .addSubMenu(pert)
    .addSubMenu(plot)
    .addToUi();
}

function openPlotUi() {
  const html = HtmlService.createHtmlOutputFromFile('Plot')
    .setTitle('PLOT')
    .setWidth(1200)
    .setHeight(900)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  SpreadsheetApp.getUi().showModelessDialog(html, 'PLOT');
}

/************************************************************
 * 6. API CALLER (LOCAL EXECUTION)
 ************************************************************/
function callEstimatorAPI_(payloadObj, label) {
  try {
    const tasks = Array.isArray(payloadObj) ? payloadObj : (payloadObj.tasks || [payloadObj]);
    const result = pmcEstimatorAPI(tasks);
    Logger.log(`Local core call (${label}): Success`);
    return { ok: true, code: 200, body: result };
  } catch (e) {
    Logger.log(`Local core call (${label}): Error - ${e.message}`);
    return { ok: false, code: 0, body: null, error: e.message || 'Local execution failed' };
  }
}

/************************************************************
 * 7. PAYLOAD BUILDERS — FIXED: Force numbers in payload
 ************************************************************/
function normalizeSlidersOut_(sliders) {
  if (!sliders || typeof sliders !== 'object') return undefined;
  const out = {};
  SLIDER_KEYS.forEach(k => {
    const n = num(sliders[k]);
    if (isNumber(n)) out[k] = Math.max(0, Math.min(100, n));
  });
  return Object.keys(out).length > 0 ? out : undefined;
}

function buildTaskPayload_(task, options) {
  const normalizedSliders = normalizeSlidersOut_(options.sliderValues);

  // Force real numbers — parse twice if needed to bypass any hidden coercion
  const optimistic = Number(num(task.optimistic));
  const mostLikely = Number(num(task.mostLikely));
  const pessimistic = Number(num(task.pessimistic));

  // Debug: confirm types BEFORE sending
  Logger.log('Payload types BEFORE core: optimistic=' + typeof optimistic + ' (' + optimistic + '), mostLikely=' + typeof mostLikely + ' (' + mostLikely + '), pessimistic=' + typeof pessimistic + ' (' + pessimistic + ')');

  const t = {
    task: task.task || task.name || '',
    name: task.task || task.name || '',
    optimistic: optimistic,
    mostLikely: mostLikely,
    pessimistic: pessimistic,
    targetValue: num(options.targetValue),
    confidenceLevel: isNumber(options.confidenceLevel) ? options.confidenceLevel : CFG.CONFIDENCE,
    wantPoints: !!options.wantPoints,
    includeOptimizedPoints: !!options.includeOptimizedPoints,
    includeMetrics: true,
    maxPoints: isNumber(options.maxPoints) ? options.maxPoints : CFG.MAX_POINTS,
    optimize: !!options.optimize,
    optimizeFor: options.optimize ? (options.optimizeFor || 'target') : undefined,
    sliderValues: normalizedSliders,
    profile: options.profile || 'full',
    suppressOtherDistros: false,
    adaptive: !!options.adaptive
  };
  if (options.extraFlags && typeof options.extraFlags === 'object') {
    Object.assign(t, options.extraFlags);
  }
  Object.keys(t).forEach(k => { if (t[k] === undefined || t[k] === null) delete t[k]; });

  return [ t ];
}

/*  CENTRAL: baseline request carries targetValue = PERT  */
function payloadBaseline_(task, targetPert) {
  return buildTaskPayload_(task, {
    targetValue: targetPert,
    wantPoints: true,
    includeOptimizedPoints: false,
    extraFlags: {
      returnProbabilityAtPert: true,
      distributionType: 'monte-carlo-smoothed'
    }
  });
}

function payloadOptimize_(task, pert, strong) {
  return buildTaskPayload_(task, {
    targetValue: pert,
    wantPoints: true,
    optimize: true,
    optimizeFor: 'target',
    includeOptimizedPoints: true,
    adaptive: false,
    extraFlags: Object.assign({
      returnArrays: true,
      materialize: true,
      returnOptimalSliderSettings: true,
      includeSliderSettings: true,
      requireOptimizedPoints: true,
      forceOptimizedPoints: true,
      distributionType: 'monte-carlo-smoothed'
    }, strong ? {
      searchDepth: 3,
      algorithm: 'de',
      optimizationBudget: 250
    } : {})
  });
}

function payloadMaterialize_(task, pert, sliders, extraFlags) {
  return buildTaskPayload_(task, {
    targetValue: pert,
    wantPoints: true,
    includeOptimizedPoints: true,
    sliderValues: sliders,
    adaptive: false,
    extraFlags: Object.assign({
      requireOptimizedPoints: true,
      forceOptimizedPoints: true,
      allowBaselineCopy: true,
      neutralOnNoOp: true,
      returnArrays: true,
      materialize: true,
      distributionType: 'monte-carlo-smoothed'
    }, extraFlags || {})
  });
}

/************************************************************
 * 8. RESPONSE NORMALIZERS
 ************************************************************/
function firstResult_(body) {
  if (!body) return null;
  if (Array.isArray(body) && body.length > 0) return body[0];
  if (Array.isArray(body.results) && body.results.length > 0) return body.results[0];
  if (Array.isArray(body.tasks) && body.tasks.length > 0) return body.tasks[0];
  if (body.result) return body.result;
  if (body.data) return body.data;
  return body;
}

function getAnyPath_(obj, paths) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (let p of paths) {
    try {
      let val = obj;
      for (const k of p.split('.')) {
        if (val == null || !(k in val)) {
          val = undefined;
          break;
        }
        val = val[k];
      }
      if (val !== undefined && val !== null) return val;
    } catch(_){}
  }
  return undefined;
}

/* ---- Baseline parser — FIXED: robust extraction from {value: XX} ---- */
function parseBaseline_(resObj) {
  if (!resObj) {
    Logger.log('parseBaseline_: No resObj at all');
    return { pert: null, ciL: null, ciU: null, baseProb: null, kld: null, basePDF: [], baseCDF: [] };
  }

  Logger.log('parseBaseline_: resObj top keys = ' + Object.keys(resObj).join(', '));
  if (resObj.baseline) {
    Logger.log('parseBaseline_: baseline exists — keys = ' + Object.keys(resObj.baseline).join(', '));
  }

  // Get the pert object
  let pertRaw = getAnyPath_(resObj, ['baseline.pert']);
  let pertValue = null;

  // Debug: show exactly what we have
  if (pertRaw) {
    Logger.log('PERT raw type = ' + typeof pertRaw + ', raw content = ' + JSON.stringify(pertRaw));
    if (typeof pertRaw === 'object' && pertRaw !== null && 'value' in pertRaw) {
      pertValue = pertRaw.value;
      Logger.log('PERT .value found, type = ' + typeof pertValue + ', raw = ' + pertValue);
    }
  }

  // Convert to number — be aggressive
  let pert = Number(pertValue);  // Number() handles string "20" → 20
  if (!isNumber(pert)) {
    pert = num(pertValue);       // fallback to your num() parser
  }
  if (!isNumber(pert)) {
    // Last resort: direct path
    pert = num(getAnyPath_(resObj, ['baseline.pert.value']));
  }

  let ciL = num(getAnyPath_(resObj, ['baseline.monteCarloSmoothed.ci.lower', 'baseline.ciLower']));
  let ciU = num(getAnyPath_(resObj, ['baseline.monteCarloSmoothed.ci.upper', 'baseline.ciUpper']));
  let baseProb = num(getAnyPath_(resObj, ['baseline.probabilityAtTarget.value', 'baseline.probabilityAtPert.value']));
  let kld = num(getAnyPath_(resObj, ['baseline.klDivergenceToTriangle', 'baseline.kld', 'baseline.metrics.klDivergenceToTriangle']));

  let basePDF = normalizePoints_(getAnyPath_(resObj, ['baseline.monteCarloSmoothed.pdfPoints', 'baseline.pdfPoints']) || []);
  let baseCDF = normalizePoints_(getAnyPath_(resObj, ['baseline.monteCarloSmoothed.cdfPoints', 'baseline.cdfPoints']) || []);

  // Final debug — this MUST show PERT = 20 now
  Logger.log('===== parseBaseline_ DEBUG =====');
  Logger.log('PERT raw object = ' + JSON.stringify(pertRaw || 'MISSING'));
  Logger.log('PERT .value raw = ' + (pertValue !== null ? pertValue + ' (type: ' + typeof pertValue + ')' : 'MISSING'));
  Logger.log('PERT extracted = ' + (isNumber(pert) ? pert : 'NULL — FAILED'));
  Logger.log('CI Lower = ' + (ciL || 'NULL'));
  Logger.log('CI Upper = ' + (ciU || 'NULL'));
  Logger.log('Baseline Prob = ' + (baseProb || 'NULL'));
  Logger.log('KL = ' + (kld || 'NULL'));
  Logger.log('PDF points length = ' + basePDF.length);
  Logger.log('CDF points length = ' + baseCDF.length);
  Logger.log('===== END DEBUG =====');

  return { pert, ciL, ciU, baseProb, kld, basePDF, baseCDF };
}

/* ---- Optimized parser — Updated to catch adaptiveOptimalSliderSettings + force plain object ---- */
function parseOptimized_(resObj) {
  if (!resObj) {
    Logger.log('parseOptimized_: ERROR — resObj is null/undefined');
    return { sliders: null, optProb: null, sensChange: null, optPDF: [], optCDF: [], status: 'error' };
  }

  Logger.log('parseOptimized_: Starting — full resObj keys: ' + Object.keys(resObj).join(', '));

  // ────────────────────────────────────────────────
  // 1. Try multiple possible paths for sliders
  // ────────────────────────────────────────────────
  let slidersRaw = 
    getAnyPath_(resObj, ['adaptiveOptimalSliderSettings.value']) || 
    getAnyPath_(resObj, ['adaptiveOptimalSliderSettings']) ||
    getAnyPath_(resObj, ['optimalSliderSettings.value']) ||
    getAnyPath_(resObj, ['optimalSliderSettings']) ||
    getAnyPath_(resObj, ['optimize.winningSliders']) ||
    getAnyPath_(resObj, ['optimize.sliders']) ||
    getAnyPath_(resObj, ['optimize.optimalSliders']) ||
    getAnyPath_(resObj, ['decisionReports', 'optimalSliders']);

  Logger.log('parseOptimized_ — raw sliders found: ' + (slidersRaw ? 'YES' : 'NOT FOUND'));

  let slidersPlain = null;
  if (slidersRaw) {
    // Force deep copy to avoid frozen object / property descriptor issues
    try {
      slidersPlain = JSON.parse(JSON.stringify(slidersRaw));
      Logger.log('Sliders after plain copy: ' + JSON.stringify(slidersPlain, null, 2));
    } catch (e) {
      Logger.log('ERROR forcing plain copy of sliders: ' + e.message);
      slidersPlain = slidersRaw; // fallback
    }
  }

  // ────────────────────────────────────────────────
  // 2. Normalize to percentages (0–100)
  // ────────────────────────────────────────────────
  const slidersPct = normalizeSlidersToPct_(slidersPlain);

  // ────────────────────────────────────────────────
  // 3. Optimized probability at target
  // ────────────────────────────────────────────────
  let optProb = num(
    getAnyPath_(resObj, ['optimize.probabilityAtTarget.value']) ||
    getAnyPath_(resObj, ['targetProbability.value.adjustedOptimized']) ||
    getAnyPath_(resObj, ['optimize.targetProbability']) ||
    getAnyPath_(resObj, ['decisionReports', '1', 'finalProbability']) ||
    getAnyPath_(resObj, ['optimize.metrics.finalProbability'])
  );

  // ────────────────────────────────────────────────
  // 4. Sensitivity change (if present)
  // ────────────────────────────────────────────────
  let sensChange = num(getAnyPath_(resObj, ['optimize.metrics.sensitivityChange']));

  // ────────────────────────────────────────────────
  // 5. Optimized PDF / CDF points
  // ────────────────────────────────────────────────
  let optPDF = normalizePoints_(
    getAnyPath_(resObj, ['optimize.reshapedPoints.pdfPoints']) ||
    getAnyPath_(resObj, ['optimizedReshapedPoints.pdfPoints']) ||
    getAnyPath_(resObj, ['optimize.monteCarloSmoothed.pdfPoints']) || []
  );

  let optCDF = normalizePoints_(
    getAnyPath_(resObj, ['optimize.reshapedPoints.cdfPoints']) ||
    getAnyPath_(resObj, ['optimizedReshapedPoints.cdfPoints']) ||
    getAnyPath_(resObj, ['optimize.monteCarloSmoothed.cdfPoints']) || []
  );

  // ────────────────────────────────────────────────
  // 6. Status
  // ────────────────────────────────────────────────
  const optStatus = String(
    getAnyPath_(resObj, ['optimize.status']) ||
    getAnyPath_(resObj, ['status']) ||
    'unknown'
  ).toLowerCase().trim();

  // ────────────────────────────────────────────────
  // 7. Final logging
  // ────────────────────────────────────────────────
  Logger.log('parseOptimized_ final extracted results:');
  if (slidersPct) {
    Logger.log('  Sliders (pct): ' + JSON.stringify(slidersPct));
  } else {
    Logger.log('  Sliders: null / not found');
  }
  Logger.log('  Optimized Prob: ' + (isNumber(optProb) ? optProb : '—'));
  Logger.log('  Sensitivity Change: ' + (isNumber(sensChange) ? sensChange : '—'));
  Logger.log('  Opt PDF length: ' + optPDF.length);
  Logger.log('  Opt CDF length: ' + optCDF.length);
  Logger.log('  Status: ' + optStatus);

  return {
    sliders: slidersPct,
    optProb,
    sensChange,
    optPDF,
    optCDF,
    status: optStatus
  };
}

// ────────────────────────────────────────────────
// Helper: Normalize sliders object to percentages
// ────────────────────────────────────────────────
function normalizeSlidersToPct_(sliders) {
  if (!sliders || typeof sliders !== 'object') return null;

  const keys = [
    'budgetFlexibility',
    'scheduleFlexibility',
    'scopeCertainty',
    'scopeReductionAllowance',
    'reworkPercentage',
    'riskTolerance',
    'userConfidence'
  ];

  const result = {};
  let foundAny = false;

  keys.forEach(key => {
    let val = sliders[key];
    if (typeof val === 'number' && !isNaN(val)) {
      // Assume input is 0–1 → convert to 0–100
      result[key] = val * 100;
      foundAny = true;
    } else if (typeof val === 'string') {
      // Try parsing percentage strings like "73.31%"
      const clean = val.replace(/[% ]/g, '');
      const numVal = parseFloat(clean);
      if (!isNaN(numVal)) {
        result[key] = numVal;
        foundAny = true;
      }
    }
  });

  return foundAny ? result : null;
}

/* -------- Plot viewer normalization (no synthetic fallbacks) -------- */

function normalizePlotResponseForUI_(resp) {
  try {
    const first = firstResult_(resp) || resp || {};

    // Remap baseline if not directly present
    if (!first.targetProbabilityOriginalPdf && !first.targetProbabilityOriginalCdf) {
      const basePdf = getAnyPath_(first, ['baseline.monteCarloSmoothed.pdfPoints','allDistributions.value.monteCarloSmoothed.pdfPoints']);
      const baseCdf = getAnyPath_(first, ['baseline.monteCarloSmoothed.cdfPoints','allDistributions.value.monteCarloSmoothed.cdfPoints']);
      if (basePdf || baseCdf) {
        first.targetProbabilityOriginalPdf = { value: normalizePoints_(basePdf || []) };
        first.targetProbabilityOriginalCdf = { value: normalizePoints_(baseCdf || []) };
      }
    }

    // Remap optimized if not directly present
    if (!first.targetProbabilityAdjustedPdf && !first.targetProbabilityAdjustedCdf) {
      const adjPdf = getAnyPath_(first, [
        'optimize.reshapedPoints.monteCarloSmoothed.pdfPoints',
        'optimizedResult.reshapedPoints.monteCarloSmoothed.pdfPoints',
        'optimizedReshapedPoints.pdfPoints'
      ]);
      const adjCdf = getAnyPath_(first, [
        'optimize.reshapedPoints.monteCarloSmoothed.cdfPoints',
        'optimizedResult.reshapedPoints.monteCarloSmoothed.cdfPoints',
        'optimizedReshapedPoints.cdfPoints'
      ]);
      if (adjPdf || adjCdf) {
        first.targetProbabilityAdjustedPdf = { value: normalizePoints_(adjPdf || []) };
        first.targetProbabilityAdjustedCdf = { value: normalizePoints_(adjCdf || []) };
      }
    }

    return first;
  } catch (e) {
    Logger.log(`normalizePlotResponseForUI error: ${e.message}`);
    return firstResult_(resp) || resp || {};
  }
}

/************************************************************
 * 9. PERT ENTRY POINTS
 ************************************************************/
function getSourceSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (CFG.SRC_SHEET_NAME) {
    const byName = ss.getSheetByName(CFG.SRC_SHEET_NAME);
    if (byName) return byName;
  }
  const sheets = ss.getSheets();
  for (const sh of sheets) {
    try {
      const a1 = String(sh.getRange(1,1).getDisplayValue() || '').trim().toLowerCase();
      if (a1 === 'name' || a1 === 'task' || a1 === 'title') return sh;
    } catch(_){}
  }
  for (const sh of sheets) {
    if (sh.getLastColumn() >= 4 && sh.getLastRow() >= 2) return sh;
  }
  return sheets[Math.max(0, Math.min(CFG.SRC_SHEET_INDEX, sheets.length - 1))] || null;
}

/** UNFILTERED: read by column names, return every row that has a non-empty Name */
function getAllTasks() {
  try {
    Logger.log('getAllTasks() started @ ' + new Date().toISOString());

    const sh = getSourceSheet_();
    if (!sh) {
      Logger.log('ERROR: No source sheet found');
      return [{ task:'(No source sheet found)', optimistic:null, mostLikely:null, pessimistic:null }];
    }
    Logger.log('Source sheet found: ' + sh.getName() + ' (ID: ' + sh.getSheetId() + ')');

    const lastRow = sh.getLastRow();
    Logger.log('Last row in sheet: ' + lastRow);
    if (lastRow < 2) {
      Logger.log('ERROR: Sheet empty (lastRow < 2)');
      return [{ task:'(Source sheet empty: add rows under headers)', optimistic:null, mostLikely:null, pessimistic:null }];
    }

    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    Logger.log('Raw headers: ' + headers.map(h => JSON.stringify(h)).join(' | '));

    let nameCol = -1, optCol = -1, mostCol = -1, pessCol = -1;
    for (let c = 0; c < headers.length; c++) {
      const h = String(headers[c] || '').trim().toLowerCase().replace(/[-_ ]+/g, ''); // Very flexible
      Logger.log('Header ' + (c+1) + ': "' + h + '"');

      if (h.includes('name') || h.includes('task') || h.includes('title')) nameCol = c + 1;
      if (h.includes('bestcase') || h.includes('optimistic') || h.includes('best')) optCol = c + 1;
      if (h.includes('mostlikely') || h.includes('most') || h.includes('likely')) mostCol = c + 1;
      if (h.includes('worstcase') || h.includes('pessimistic') || h.includes('worst')) pessCol = c + 1;
    }

    Logger.log('Detected columns (1-based): Name=' + nameCol + ', Best=' + optCol + ', Most=' + mostCol + ', Worst=' + pessCol);

    if (nameCol === -1 || optCol === -1 || mostCol === -1 || pessCol === -1) {
      Logger.log('ERROR: Missing required columns');
      return [{ task:'(Missing required headers - check sheet row 1)', optimistic:null, mostLikely:null, pessimistic:null }];
    }

    const values = sh.getRange(2, 1, lastRow - 1, sh.getLastColumn()).getValues();
    Logger.log('Raw data from sheet (first 5 rows): ' + JSON.stringify(values.slice(0, 5)));

    const out = [];
    for (let i = 0; i < values.length; i++) {
      const r = values[i];
      const nameRaw = r[nameCol - 1];
      const name = (nameRaw != null && String(nameRaw).trim()) || '';

      if (!name) {
        Logger.log('Row ' + (i+2) + ': Skipped (empty name)');
        continue;
      }

      const rawO = r[optCol - 1];
      const rawM = r[mostCol - 1];
      const rawP = r[pessCol - 1];

      Logger.log('Row ' + (i+2) + ': Name="' + name + '", Raw Best=' + rawO + ' (type: ' + typeof rawO + '), Raw Most=' + rawM + ' (type: ' + typeof rawM + '), Raw Worst=' + rawP + ' (type: ' + typeof rawP + ')');

      // Trust raw number types directly (Apps Script often returns numbers for numeric cells)
      let O = (typeof rawO === 'number') ? rawO : num(rawO);
      let M = (typeof rawM === 'number') ? rawM : num(rawM);
      let P = (typeof rawP === 'number') ? rawP : num(rawP);

      Logger.log('Row ' + (i+2) + ': Parsed O=' + O + ', M=' + M + ', P=' + P);

      if (isNumber(O) && isNumber(M) && isNumber(P)) {
        Logger.log('Row ' + (i+2) + ': VALID TASK ADDED');
        out.push({ task: name, optimistic: O, mostLikely: M, pessimistic: P });
      } else {
        Logger.log('Row ' + (i+2) + ': Skipped (invalid parsed numbers)');
      }
    }

    if (!out.length) {
      Logger.log('No valid tasks found after processing all rows');
      return [{ task:'(No valid tasks found - check sheet data)', optimistic:null, mostLikely:null, pessimistic:null }];
    }

    Logger.log('Found ' + out.length + ' valid tasks');
    return out;
  } catch (e) {
    Logger.log('ERROR in getAllTasks: ' + e.message + ' (stack: ' + e.stack + ')');
    return [{ task:`(Error reading source: ${e.message})`, optimistic:null, mostLikely:null, pessimistic:null }];
  }
}

/************************************************************
 * 10. PLOT DATA
 ************************************************************/
function getTargetProbabilityData(params) {
  if (!params || !params.task) throw new Error('Missing params.task');

  const task = {
    task: params.task, name: params.task,
    optimistic: params.optimistic, mostLikely: params.mostLikely, pessimistic: params.pessimistic
  };

  const chosenTarget = params.targetValue;

  const extra = {
    returnArrays: true,
    materialize: true,
    returnOptimalSliderSettings: true,
    includeSliderSettings: true,
    requireOptimizedPoints: !!(params && (params.isOptimizeMode || params.optimize)),
    forceOptimizedPoints: !!(params && (params.isOptimizeMode || params.optimize)),
    includeAllDistributions: true,
    returnAllDistributions: true,
    returnDistributions: true,
    returnBaselineDistributions: true,
    includeTriangle: true,
    includeBetaPert: true,
    returnTriangle: true,
    returnBetaPert: true,
    returnMonteCarloSmoothed: true,
    distributions: ['triangle','betaPert','monteCarloSmoothed'],
    includeAdjusted: true,
    returnAdjusted: true,
    returnSliderAdjustedPoints: true,
    returnDecisionReports: true,
    distributionType: 'monte-carlo-smoothed'
  };

  const payload = buildTaskPayload_(task, {
    targetValue: chosenTarget,
    confidenceLevel: (typeof params.confidenceLevel === 'number') ? params.confidenceLevel : CFG.CONFIDENCE,
    wantPoints: true,
    includeOptimizedPoints: !!params.isOptimizeMode || !!params.optimize,
    optimize: !!params.isOptimizeMode || !!params.optimize,
    optimizeFor: (params.mode === 'mean' || params.mode === 'risk') ? params.mode : 'target',
    sliderValues: params.sliderValues || undefined,
    adaptive: !!params.adaptive,
    extraFlags: extra
  });

  const r = callEstimatorAPI_(payload, 'plot_proxy');
  if (!r.ok) throw new Error(r.error || 'API error');

  return normalizePlotResponseForUI_(r.body);
}

/************************************************************
 * 11. RE-MATERIALIZE (Selection)
 ************************************************************/
function rematerializeSelection() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const out = ss.getSheetByName(CFG.OUT_SHEET_NAME);
  if (!out) { safeAlert_('No output sheet found.'); return; }
  const sel = out.getActiveRange();
  if (!sel) { safeAlert_('Select rows in the output sheet first.'); return; }

  const startRow = Math.max(2, sel.getRow());
  const endRow = Math.min(out.getLastRow(), startRow + sel.getNumRows() - 1);

  let ok = 0, err = 0, skip = 0;
  for (let r = startRow; r <= endRow; r++) {
    const name = String(out.getRange(r, 1).getValue() || '').trim();
    const O = num(out.getRange(r, 2).getValue());
    const M = num(out.getRange(r, 3).getValue());
    const P = num(out.getRange(r, 4).getValue());
    const pert = num(out.getRange(r, 5).getValue());

    if (!name || !isNumber(pert) || !isNumber(O) || !isNumber(M) || !isNumber(P)) { 
      skip++; 
      continue; 
    }

    const sliders = {};
    for (let i = 0; i < SLIDER_KEYS.length; i++) {
      const v = num(out.getRange(r, 9 + i).getValue());
      if (isNumber(v)) sliders[SLIDER_KEYS[i]] = v;
    }

    const task = { task: name, optimistic: O, mostLikely: M, pessimistic: P };
    const res = doMaterialize_(task, pert, sliders, r, out);
    if (res && res.ok) ok++; else err++;
  }
  toast_('Re-materialize', `OK=${ok}, Skipped=${skip}, Error=${err}`, 6);
}

function doMaterialize_(task, pert, sliders, row, out) {
  const extraFlags = CFG.DUPLICATE_BASELINE_ON_NO_IMPROVE ? { duplicateBaselineOnNoImprove: true } : {};
  const matPayload = payloadMaterialize_(task, pert, sliders, extraFlags);
  const matRes = callEstimatorAPI_(matPayload, `materialize-${task.task}`);
  if (!matRes.ok) {
    return { ok: false, error: matRes.error };
  }
  const body = firstResult_(matRes.body);
  if (!body) return { ok: false, error: 'Empty response body' };
  const parsedBase = parseBaseline_(body);
  const parsedOpt = parseOptimized_(body);

  // Strict — only write if core gave PERT
  if (!isNumber(parsedBase.pert)) {
    return { ok: false, error: 'No PERT in materialize response' };
  }

  out.getRange(row, 5).setValue(toFixed6(parsedBase.pert));
  out.getRange(row, 6).setValue(toFixed6(parsedBase.ciL));
  out.getRange(row, 7).setValue(toFixed6(parsedBase.ciU));
  out.getRange(row, 8).setValue(parsedBase.baseProb ? (parsedBase.baseProb * 100).toFixed(2) : '');

  let col = 9;
  if (parsedOpt.sliders) {
    SLIDER_KEYS.forEach(k => {
      const v = num(parsedOpt.sliders[k]);
      out.getRange(row, col++).setValue(isNumber(v) ? (v * 100).toFixed(2) : '');
    });
  } else {
    col += SLIDER_KEYS.length;
  }

  out.getRange(row, 16).setValue(parsedOpt.optProb ? (parsedOpt.optProb * 100).toFixed(2) : '');
  out.getRange(row, 17).setValue(toFixed6(parsedOpt.sensChange));
  out.getRange(row, 18).setValue(toFixed6(parsedBase.kld));

  const clip = CFG.MAX_POINTS;
  [parsedBase.basePDF, parsedBase.baseCDF, parsedOpt.optPDF, parsedOpt.optCDF].forEach((pts, idx) => {
    const jsonCol = 19 + idx;
    const jsonStr = JSON.stringify(clipArray(pts, clip));
    out.getRange(row, jsonCol).setValue(jsonStr);
  });

  shadeConfidenceColumns_(out);
  return { ok: true };
}

/************************************************************
 * 12. PERT RUNNERS
 ************************************************************/
function ensureHeadersAndWidths_(sheet) {
  const lastCol = sheet.getMaxColumns();
  if (lastCol < HEADERS.length) {
    sheet.insertColumnsAfter(lastCol, HEADERS.length - lastCol);
  }
  setHeaderNotes_(sheet);
  sheet.getRange(1, 1, 1, HEADERS.length)
    .setBackground('#4285f4')
    .setFontColor('white')
    .setHorizontalAlignment('center');

  for (let c = 1; c <= HEADERS.length; c++) {
    sheet.setColumnWidth(c, c <= 4 ? 120 : (c <= 18 ? 150 : 250));
  }
}

function pertRunAllRows() {
  const tasks = getAllTasks();
  if (!tasks || !tasks.length) { safeAlert_('No tasks found.'); return; }
  runTasks_(tasks, 'All Rows');
}

function pertRunSelectedRows() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = getSourceSheet_();
  if (!src) { safeAlert_('No source sheet.'); return; }

  const headers = src.getRange(1, 1, 1, src.getLastColumn()).getValues()[0];
  let nameCol = -1, optCol = -1, mostCol = -1, pessCol = -1;
  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').trim().toLowerCase();
    if (h.includes('name') || h.includes('task')) nameCol = c + 1;
    if (h.includes('best case') || h.includes('best_case') || h.includes('bestcase') || h.includes('optimistic')) optCol = c + 1;
    if (h.includes('most likely') || h.includes('most_likely') || h.includes('mostlikely')) mostCol = c + 1;
    if (h.includes('worst case') || h.includes('worst_case') || h.includes('worstcase') || h.includes('pessimistic')) pessCol = c + 1;
  }
  if (nameCol === -1) {
    safeAlert_('Name column not found in source sheet.'); return;
  }

  const sel = src.getActiveRange();
  if (!sel || sel.getColumn() !== nameCol || sel.getRow() < 2) {
    safeAlert_(`Select cells in the Name column (starting from row 2) in the source sheet.`); return;
  }
  const startRow = Math.max(2, sel.getRow());
  const endRow = Math.min(src.getLastRow(), startRow + sel.getNumRows() - 1);
  const numCols = Math.max(optCol, mostCol, pessCol, nameCol);
  const values = src.getRange(startRow, 1, endRow - startRow + 1, numCols).getValues();
  const tasks = [];
  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const name = String(r[nameCol - 1] || '').trim();
    if (!name) continue;
    const O = num(r[optCol - 1]), M = num(r[mostCol - 1]), P = num(r[pessCol - 1]);
    if (isNumber(O) && isNumber(M) && isNumber(P)) {
      tasks.push({ task: name, optimistic: O, mostLikely: M, pessimistic: P });
    }
  }
  if (!tasks.length) { safeAlert_('No valid tasks selected.'); return; }
  runTasks_(tasks, 'Selected Rows');
}

function runTasks_(tasks, mode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let out = ss.getSheetByName(CFG.OUT_SHEET_NAME);

  if (!out) {
    out = ss.insertSheet(CFG.OUT_SHEET_NAME);
  }
  if (out.getLastRow() > 1) {
    out.getRange(2, 1, out.getLastRow() - 1, Math.max(out.getLastColumn(), HEADERS.length)).clearContent();
  }
  ensureHeadersAndWidths_(out);

  const logSheet = ensureLogSheet_();
  const startRow = 2;

  let ok = 0, err = 0, partial = 0;
  const startTime = Date.now();
  logSheet.appendRow([tsMsg(`${mode}: Starting ${tasks.length} tasks`)]);

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const row = startRow + i;
    const statusCol = HEADERS.length;
    try {
      out.getRange(row, 1, 1, 4).setValues([[task.task, task.optimistic || '', task.mostLikely || '', task.pessimistic || '']]);
      out.getRange(row, statusCol).setValue('Running...');

      const res = doSingleTask_(task, row, out, logSheet);
      if (res && res.ok) {
        out.getRange(row, statusCol).setValue(tsMsg('OK'));
        ok++;
      } else if (res && res.partial) {
        out.getRange(row, statusCol).setValue(tsMsg('PARTIAL'));
        partial++;
      } else {
        out.getRange(row, statusCol).setValue(tsMsg('ERROR: ' + (res ? res.error : 'Unknown')));
        err++;
      }
    } catch (e) {
      out.getRange(row, statusCol).setValue(tsMsg('EXCEPTION: ' + e.message));
      err++;
      logSheet.appendRow([tsMsg(`Task "${task.task}": ${e.message}`)]);
    }
    SpreadsheetApp.flush();
    if (Date.now() - startTime > CFG.LOOP_SAFETY_MS) {
      logSheet.appendRow([tsMsg('Safety timeout hit')]);
      break;
    }
  }

  shadeConfidenceColumns_(out);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const msg = `Done: ${ok} OK, ${partial} partial, ${err} errors in ${elapsed}s`;
  toast_(mode, msg, 10);
  logSheet.appendRow([tsMsg(msg)]);
}

function doSingleTask_(task, row, out, logSheet) {
  let hasBaseline = false;
  let pertForOpt = null;

  // Phase 1 — Baseline @ PERT
  try {
    const baselinePayload = payloadBaseline_(task, null);
    const baseRes = callEstimatorAPI_(baselinePayload, `baseline-${task.task}`);
    if (baseRes.ok) {
      const body = firstResult_(baseRes.body);
      // Logger.log('Baseline response body: ' + JSON.stringify(body, null, 2));  // Uncomment only for debugging — very verbose

      const baseParsed = parseBaseline_(body);
      if (isNumber(baseParsed.pert)) {
        pertForOpt = baseParsed.pert;

        out.getRange(row, 5).setValue(toFixed6(baseParsed.pert));
        out.getRange(row, 6).setValue(toFixed6(baseParsed.ciL));
        out.getRange(row, 7).setValue(toFixed6(baseParsed.ciU));
        out.getRange(row, 8).setValue(baseParsed.baseProb ? (baseParsed.baseProb * 100).toFixed(2) : '');

        out.getRange(row, 18).setValue(toFixed6(baseParsed.kld));

        const clip = CFG.MAX_POINTS;
        [baseParsed.basePDF, baseParsed.baseCDF].forEach((pts, idx) => {
          const jsonCol = 19 + idx;
          const jsonStr = JSON.stringify(clipArray(pts, clip));
          out.getRange(row, jsonCol).setValue(jsonStr);
        });

        hasBaseline = true;
        Logger.log(`Baseline written row ${row}: PERT=${baseParsed.pert}, Prob=${baseParsed.baseProb}`);
      } else {
        logSheet.appendRow([tsMsg(`Task "${task.task}": No PERT from baseline`)]);
      }
    } else {
      logSheet.appendRow([tsMsg(`Task "${task.task}": Baseline call failed - ${baseRes.error}`)]);
    }
  } catch (e) {
    logSheet.appendRow([tsMsg(`Task "${task.task}": Baseline exception - ${e.message}`)]);
  }

  // Phase 2 — Optimization @ PERT
  let hasOpt = false;
  if (isNumber(pertForOpt)) {
    try {
      const strong = CFG.P2_STRONG_RETRY;
      const optPayload = payloadOptimize_(task, pertForOpt, strong);
      const optRes = callEstimatorAPI_(optPayload, `opt-${task.task}`);
      if (optRes.ok) {
        const body = firstResult_(optRes.body);
        // Logger.log('Optimize response body: ' + JSON.stringify(body, null, 2));  // Uncomment only for debugging

        const optParsed = parseOptimized_(body);

        let col = 9;

        // Write sliders if present — simple existence check only
        if (optParsed.sliders) {
          Logger.log('Sliders found — writing ' + Object.keys(optParsed.sliders).length + ' values for row ' + row);
          SLIDER_KEYS.forEach(k => {
            const rawV = optParsed.sliders[k];
            const v = typeof rawV === 'number' ? rawV : num(rawV);
            const pct = isNumber(v) ? (v * 100).toFixed(2) : '';
            out.getRange(row, col).setValue(pct);
            Logger.log(`Slider ${k} → col ${col}: raw=${rawV} → written=${pct || '(empty)'}`);
            col++;
          });
          hasOpt = true;
        } else {
          Logger.log('No sliders in optParsed for row ' + row);
          col += SLIDER_KEYS.length;
        }

        // Optimized probability as percentage
        const optPct = optParsed.optProb ? (optParsed.optProb * 100).toFixed(2) : '';
        out.getRange(row, 16).setValue(optPct);
        Logger.log(`Optimized % → col 16: ${optPct || '(empty)'}`);

        out.getRange(row, 17).setValue(toFixed6(optParsed.sensChange));

        const clip = CFG.MAX_POINTS;
        [optParsed.optPDF, optParsed.optCDF].forEach((pts, idx) => {
          const jsonCol = 21 + idx;
          const jsonStr = JSON.stringify(clipArray(pts, clip));
          out.getRange(row, jsonCol).setValue(jsonStr);
        });

        if (optParsed.status && optParsed.status !== 'error') {
          out.getRange(row, HEADERS.length).setValue(optParsed.status);
        }

        if (isNumber(optParsed.optProb) || optParsed.optPDF.length > 0 || optParsed.optCDF.length > 0 || optParsed.sliders) {
          hasOpt = true;
        }

        Logger.log(`Optimize processing complete for row ${row}: Prob=${optPct || 'N/A'}, Sliders written=${optParsed.sliders ? 'YES' : 'NO'}`);
      } else {
        logSheet.appendRow([tsMsg(`Task "${task.task}": Opt call failed - ${optRes.error}`)]);
      }
    } catch (e) {
      logSheet.appendRow([tsMsg(`Task "${task.task}": Opt exception - ${e.message}`)]);
    }
  } else {
    logSheet.appendRow([tsMsg(`Task "${task.task}": Skipping opt — no valid PERT from baseline`)]);
  }

  if (hasBaseline && hasOpt) {
    return { ok: true };
  } else if (hasBaseline || hasOpt) {
    return { partial: true };
  } else {
    return { ok: false, error: 'Both baseline and opt failed' };
  }
}

function ensureLogSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let log = ss.getSheetByName(CFG.LOG_SHEET_NAME);
  if (!log) {
    log = ss.insertSheet(CFG.LOG_SHEET_NAME);
    log.getRange(1, 1).setValue('Timestamped Log').setFontWeight('bold');
  }
  return log;
}

function writeLogsToSheet() {
  const logSheet = ensureLogSheet_();
  toast_('Export Log', 'Log sheet already active—view "PERT_Logs"', 5);
}

/************************************************************
 * 13. FORMATTING HELPERS
 ************************************************************/
function shadeConfidenceColumns_(sheet) {
  try {
    const COLS = [5, 8, 16];
    const COLOR = '#d9ead3';
    const headerRow = 1;

    COLS.forEach(col => {
      const lastRow = sheet.getLastRow();
      if (lastRow <= headerRow) return;

      const rng = sheet.getRange(headerRow + 1, col, lastRow - headerRow, 1);
      const vals = rng.getDisplayValues().map(r => (r[0] || '').toString().trim());
      let lastNonEmpty = 0;
      for (let i = vals.length - 1; i >= 0; i--) {
        if (vals[i]) { lastNonEmpty = i + (headerRow + 1); break; }
      }
      if (lastNonEmpty > headerRow) {
        sheet.getRange(headerRow + 1, col, lastNonEmpty - headerRow, 1).setBackground(COLOR);
      }
    });
  } catch (_) {}
}

function testCoreCall() {
  const testTask = {
    task: "Test Project",
    optimistic: 10,
    mostLikely: 20,
    pessimistic: 30
  };
  const payload = [{
    task: testTask.task,
    name: testTask.task,
    optimistic: testTask.optimistic,
    mostLikely: testTask.mostLikely,
    pessimistic: testTask.pessimistic,
    targetValue: 20,
    confidenceLevel: 0.95,
    wantPoints: true,
    includeOptimizedPoints: false
  }];
  
  try {
    const result = pmcEstimatorAPI(payload);
    Logger.log('TEST CORE CALL RESULT: ' + JSON.stringify(result, null, 2));
  } catch (e) {
    Logger.log('TEST CORE CALL ERROR: ' + e.message + ' (stack: ' + e.stack + ')');
  }
}

