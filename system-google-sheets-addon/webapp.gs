/**
 * webapp.gs — PMC Estimator Web App
 *
 * Exposes pmcEstimatorAPI to the Custom GPT via HTTP POST.
 * All key validation and quota management is handled by the
 * WordPress PMC CRM plugin at icarenow.io/wp-json/pmc/v1/
 *
 * Script Properties required (set via setup-wp-crm-connection.gs):
 *   WP_URL        — https://icarenow.io
 *   WP_API_SECRET — shared secret matching WordPress PMC CRM settings
 *
 * Endpoints (all POST to this web app URL):
 *   action: "request_trial"  — forward trial request to WordPress
 *   action: "call_api"       — validate key, run estimation, deduct credits
 *   action: "check_quota"    — return current quota for a key
 */

// ── CREDIT COSTS PER OPERATION ────────────────────────────────────────────────
var CREDIT_COSTS = {
  baseline_only: 1,
  full_saco:     2,
  saco_explain:  4
};

// ── ENTRY POINT ───────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    // [A] Guard: reject missing/oversized bodies before parsing (DoS protection)
    if (!e || !e.postData || typeof e.postData.contents !== 'string') {
      return jsonOut({ error: 'Invalid request' });
    }
    if (e.postData.contents.length > 524288) {  // 512 KB hard limit
      return jsonOut({ error: 'Request body too large (max 512 KB)' });
    }
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';

    if (action === 'request_trial') return handleTrial(body);
    if (action === 'call_api')      return handleCallApi(body);
    if (action === 'check_quota')   return handleCheckQuota(body);
    if (action === 'save_session')  return handleSaveSession(body);
    if (action === 'load_sessions') return handleLoadSessions(body);
    if (action === 'ping')          return handlePing(body);

    return jsonOut({ error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('[PMC webapp] doPost error:', err.message, err.stack);
    return jsonOut({ error: 'Server error. Please try again or contact support at icarenow.io.' });
  }
}

// ── TRIAL REQUEST ─────────────────────────────────────────────────────────────
function handleTrial(body) {
  var email = (body.email || '').trim().toLowerCase();
  // RFC 5321 practical validation: local@domain.tld with no spaces
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailPattern.test(email))
    return jsonOut({ error: 'A valid email address is required' });

  var resp = wpPost('/pmc/v1/trial', { email: email });
  return jsonOut(resp);
}

// ── ESTIMATION CALL ───────────────────────────────────────────────────────────
function handleCallApi(body) {
  var key = (body.key || '').trim();
  if (!key) return jsonOut({ error: 'API key is required' });

  // Session token — stable for the life of one conversation.
  // GPT omits it on first call; GAS generates one and returns it.
  // GPT stores and re-sends it on all subsequent calls so plot.html can live-update.
  var sessionToken = (body.session_token || '').trim();
  if (!/^[a-f0-9]{32,64}$/.test(sessionToken)) {
    sessionToken = Utilities.getUuid().replace(/-/g, '');  // 32-char lowercase hex
  }

  // 1. Validate key + get quota from WordPress CRM
  var auth = wpPost('/pmc/v1/validate', { key: key });
  if (!auth.valid) return jsonOut({ error: auth.error, upgrade_url: auth.upgrade_url });

  // 2. Determine credit cost
  var opType = body.operationType || 'full_saco';
  if (!CREDIT_COSTS[opType])
    return jsonOut({ error: 'Unknown operationType: ' + opType + '. Valid values: baseline_only, full_saco, saco_explain' });
  var cost = CREDIT_COSTS[opType];

  if (auth.remaining < cost) {
    return jsonOut({
      error: 'Insufficient credits — need ' + cost + ', have ' + auth.remaining + '.',
      upgrade_url: auth.upgrade_url || getWpUrl()
    });
  }

  // 3. Validate tasks input
  var tasks = body.tasks;
  if (!Array.isArray(tasks) || tasks.length === 0)
    return jsonOut({ error: 'At least one task is required' });
  if (tasks.length > 10)
    return jsonOut({ error: 'Maximum 10 tasks per request, got ' + tasks.length });

  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    if (!t.task)        return jsonOut({ error: 'Task ' + (i+1) + ' is missing a name' });
    if (t.optimistic  == null) return jsonOut({ error: 'Task "' + t.task + '" is missing optimistic value' });
    if (t.mostLikely  == null) return jsonOut({ error: 'Task "' + t.task + '" is missing mostLikely value' });
    if (t.pessimistic == null) return jsonOut({ error: 'Task "' + t.task + '" is missing pessimistic value' });

    // Validate numeric values are finite and within a safe computation range
    var oNum = Number(t.optimistic), mNum = Number(t.mostLikely), pNum = Number(t.pessimistic);
    if (!Number.isFinite(oNum) || !Number.isFinite(mNum) || !Number.isFinite(pNum))
      return jsonOut({ error: 'Task "' + t.task + '": optimistic, mostLikely, and pessimistic must be finite numbers' });
    if (Math.abs(oNum) > 1e9 || Math.abs(mNum) > 1e9 || Math.abs(pNum) > 1e9)
      return jsonOut({ error: 'Task "' + t.task + '": values must be between -1,000,000,000 and 1,000,000,000' });

    if (t.optimistic > t.mostLikely || t.mostLikely > t.pessimistic)
      return jsonOut({ error: 'Task "' + t.task + '": values must satisfy optimistic ≤ mostLikely ≤ pessimistic' });

    // Validate sliderValues bounds if provided
    if (t.sliderValues && typeof t.sliderValues === 'object') {
      var SLIDER_BOUNDS = {
        budgetFlexibility:        100,
        scheduleFlexibility:      100,
        scopeCertainty:           100,
        scopeReductionAllowance:  100,
        reworkPercentage:          50,
        riskTolerance:            100,
        userConfidence:           100
      };
      var sliderKeys = Object.keys(SLIDER_BOUNDS);
      for (var s = 0; s < sliderKeys.length; s++) {
        var sk = sliderKeys[s];
        if (t.sliderValues[sk] == null) continue;
        var sv = Number(t.sliderValues[sk]);
        if (!Number.isFinite(sv) || sv < 0 || sv > SLIDER_BOUNDS[sk])
          return jsonOut({ error: 'Task "' + t.task + '": sliderValues.' + sk + ' must be 0–' + SLIDER_BOUNDS[sk] + ', got ' + t.sliderValues[sk] });
      }
    }

    // Validate confidenceTarget if provided (integer 1–99 percentile)
    if (t.confidenceTarget != null) {
      var ctNum0 = Number(t.confidenceTarget);
      if (!Number.isInteger(ctNum0) || ctNum0 < 1 || ctNum0 > 99)
        return jsonOut({ error: 'Task "' + t.task + '": confidenceTarget must be an integer 1–99, got ' + t.confidenceTarget });
    }

    // Validate parallel flag
    if (t.parallel != null && typeof t.parallel !== 'boolean')
      return jsonOut({ error: 'Task "' + t.task + '": parallel must be a boolean' });

    // Validate scenarios if provided (max 5 per task)
    if (t.scenarios != null) {
      if (!Array.isArray(t.scenarios))
        return jsonOut({ error: 'Task "' + t.task + '": scenarios must be an array' });
      if (t.scenarios.length > 5)
        return jsonOut({ error: 'Task "' + t.task + '": maximum 5 scenarios per task, got ' + t.scenarios.length });
      for (var sc = 0; sc < t.scenarios.length; sc++) {
        var scn = t.scenarios[sc];
        if (!scn.name)
          return jsonOut({ error: 'Task "' + t.task + '": scenario ' + (sc+1) + ' is missing a name' });
        if (scn.targetValue == null && scn.sliderValues == null)
          return jsonOut({ error: 'Task "' + t.task + '": scenario "' + scn.name + '" must have targetValue or sliderValues' });
        if (scn.targetValue != null && !Number.isFinite(Number(scn.targetValue)))
          return jsonOut({ error: 'Task "' + t.task + '": scenario "' + scn.name + '": targetValue must be a finite number' });
      }
    }
  }

  // 4. Run SACO estimation engine
  var engineStart = Date.now();
  var result;
  try {
    result = pmcEstimatorAPI(tasks);
  } catch (err) {
    console.error('[PMC webapp] Engine error:', err.message, err.stack);
    return jsonOut({ error: 'Estimation engine error. Please try again or contact support at icarenow.io.' });
  }
  var durationMs = Date.now() - engineStart;

  // 5. Build chart URLs and report link for the first task only.
  //    Multi-task chart support is not implemented — charts represent task[0] distribution.
  //    Portfolio-level visualization is surfaced via _portfolio P10/P50/P90 instead.
  if (tasks.length > 0 && result.results && result.results[0]) {
    result._charts    = buildChartUrls(result.results[0], tasks[0]);
    result._reportUrl = buildReportUrl(result.results[0], tasks[0]);
  }

  // 8. Enrich per-task results: full percentile table, sensitivity, scenario batch, target-advisor.
  //    Must run before slimResult strips the CDF arrays.
  //    Depends on invertCdf/computeSliderProbability/interpolateCdf in GAS global scope.
  if (result.results && Array.isArray(result.results)) {
    for (var ri = 0; ri < result.results.length; ri++) {
      var rItem       = result.results[ri];
      var rInTask     = ri < tasks.length ? tasks[ri] : null;  // guard: results must not exceed tasks
      var rBasePoints = (rItem.baseline && rItem.baseline.monteCarloSmoothed) || null;
      var rCdf        = (rBasePoints && rBasePoints.cdfPoints) || [];

      if (rCdf.length) {
        // Full percentile table P5–P95
        rItem.percentiles = {
          p5:  invertCdf(rCdf, 0.05),
          p10: invertCdf(rCdf, 0.10),
          p20: invertCdf(rCdf, 0.20),
          p30: invertCdf(rCdf, 0.30),
          p40: invertCdf(rCdf, 0.40),
          p50: invertCdf(rCdf, 0.50),
          p60: invertCdf(rCdf, 0.60),
          p70: invertCdf(rCdf, 0.70),
          p80: invertCdf(rCdf, 0.80),
          p90: invertCdf(rCdf, 0.90),
          p95: invertCdf(rCdf, 0.95)
        };
        // targetAtConfidence — only when confidenceTarget was requested for this task
        var ctNum = rInTask && rInTask.confidenceTarget != null
                    ? Number(rInTask.confidenceTarget) : null;
        if (ctNum !== null) {
          rItem.targetAtConfidence = {
            confidence: ctNum,
            value:      invertCdf(rCdf, ctNum / 100)
          };
        }
      }

      // Sensitivity summary — capped at first 5 tasks to guard GAS execution time.
      // At 8 computeSliderProbability calls per task, 10 tasks = 80 calls → timeout risk.
      if (rInTask && rInTask.targetValue != null && rBasePoints) {
        if (ri < 5) {
          try {
            rItem.sensitivity = computeSensitivityBlock(rInTask, rBasePoints);
          } catch (e) {
            console.error('[PMC webapp] Sensitivity error for task ' + ri + ':', e.message);
          }
        } else {
          rItem.sensitivitySkipped = true;  // omitted to prevent execution timeout
        }
      }

      // Scenario batch — requires scenarios array and baseline points
      if (rInTask && Array.isArray(rInTask.scenarios) && rInTask.scenarios.length && rBasePoints) {
        try {
          rItem.scenarios = computeScenarioBatch(rInTask, rBasePoints);
        } catch (e) {
          console.error('[PMC webapp] Scenario error for task ' + ri + ':', e.message);
        }
      }

      // Optimized CDF percentiles (P10/P50/P90 on SACO-reshaped distribution).
      // Shows how SACO shifts the distribution, not just the probability at target.
      var rOptCdf = (rItem.optimize && rItem.optimize.reshapedPoints &&
                     rItem.optimize.reshapedPoints.cdfPoints) || [];
      if (rOptCdf.length) {
        rItem.optimizedPercentiles = {
          p10: invertCdf(rOptCdf, 0.10),
          p50: invertCdf(rOptCdf, 0.50),
          p90: invertCdf(rOptCdf, 0.90)
        };
      }

      // Slider delta — what SACO changed vs. user's input sliders (UI units).
      // Pulls winningSliders from the last decisionReport (Optimize mode).
      var rReports = rItem.decisionReports;
      var rWinSliders = null;
      if (Array.isArray(rReports)) {
        for (var rri = rReports.length - 1; rri >= 0; rri--) {
          if (rReports[rri] && rReports[rri].winningSliders &&
              typeof rReports[rri].winningSliders === 'object') {
            rWinSliders = rReports[rri].winningSliders;
            break;
          }
        }
      }
      if (rWinSliders && rInTask) {
        var rUserSliders = (rInTask.sliderValues && typeof rInTask.sliderValues === 'object')
          ? rInTask.sliderValues : {};
        var SLIDER_DEFS = {
          budgetFlexibility: 50, scheduleFlexibility: 50, scopeCertainty: 50,
          scopeReductionAllowance: 50, reworkPercentage: 25, riskTolerance: 50, userConfidence: 75
        };
        var DELTA_KEYS = ['budgetFlexibility','scheduleFlexibility','scopeCertainty',
          'scopeReductionAllowance','reworkPercentage','riskTolerance','userConfidence'];
        var sliderDelta = {};
        for (var dki = 0; dki < DELTA_KEYS.length; dki++) {
          var dKey = DELTA_KEYS[dki];
          var uVal = rUserSliders[dKey] != null ? Number(rUserSliders[dKey]) : SLIDER_DEFS[dKey];
          var sVal = rWinSliders[dKey]  != null ? Number(rWinSliders[dKey])  : uVal;
          var dDiff = Math.round((sVal - uVal) * 10) / 10;
          if (Math.abs(dDiff) >= 1) sliderDelta[dKey] = dDiff;
        }
        if (Object.keys(sliderDelta).length > 0) rItem.sliderDelta = sliderDelta;
      }

      // Feasibility score (0–100): P(SACO-optimized) discounted by tail risk.
      // Tail risk = (P90 − P50) / |P50|; values > 0.5 reduce score by up to 20 pts.
      // Only computed when a targetValue is present.
      var rTp = (rItem.targetProbability && rItem.targetProbability.value) || {};
      var rOptProb = rTp.adjustedOptimized != null ? Number(rTp.adjustedOptimized)
                   : rTp.adjusted          != null ? Number(rTp.adjusted)
                   : rTp.original          != null ? Number(rTp.original) : null;
      if (Number.isFinite(rOptProb) && rItem.percentiles) {
        var fP50 = rItem.percentiles.p50, fP90 = rItem.percentiles.p90;
        var tailRatio = (fP50 != null && Math.abs(fP50) > 0 && fP90 != null)
          ? Math.max(0, (fP90 - fP50) / Math.abs(fP50)) : 0;
        var tailPenalty = Math.max(0, Math.min(0.20, (tailRatio - 0.50) / 5));
        rItem.feasibilityScore = Math.max(0, Math.min(100,
          Math.round(rOptProb * (1 - tailPenalty) * 100)));
      }

      // Per-task report URL — all tasks (not just task[0]).
      // result._reportUrl (top-level) kept for backward compatibility.
      if (rInTask) {
        try { rItem._reportUrl = buildReportUrl(rItem, rInTask); } catch (e) {}
      }
    }
  }

  // Portfolio aggregation — sequential (PERT sum) and parallel (critical path) tasks.
  // Sequential tasks: mean = Σ PERT means, variance = Σ PERT variances (PMBOK PERT/CPM).
  // Parallel tasks (task.parallel === true): contribute max(mean_parallel) + max(variance_parallel)
  //   representing the critical path as the longest parallel branch.
  // P10/P50/P90 via normal approximation (CLT). Requires ≥2 tasks.
  if (tasks.length > 1) {
    var seqMean = 0, seqVar = 0;
    var parMeans = [], parVars = [];
    var hasParallel = false;
    for (var pIdx = 0; pIdx < tasks.length; pIdx++) {
      var pTask = tasks[pIdx];
      var pO = Number(pTask.optimistic), pM = Number(pTask.mostLikely), pP = Number(pTask.pessimistic);
      var tMean = (pO + 4 * pM + pP) / 6;
      var tVar  = Math.pow((pP - pO) / 6, 2);
      if (pTask.parallel === true) {
        hasParallel = true;
        parMeans.push(tMean);
        parVars.push(tVar);
      } else {
        seqMean += tMean;
        seqVar  += tVar;
      }
    }
    // Parallel group contributes critical path: max mean + max variance
    if (parMeans.length > 0) {
      seqMean += Math.max.apply(null, parMeans);
      seqVar  += Math.max.apply(null, parVars);
    }
    var pStd = Math.sqrt(seqVar);
    if (Number.isFinite(seqMean) && Number.isFinite(pStd)) {
      result._portfolio = {
        taskCount: tasks.length,
        p10: Math.round((seqMean - 1.282 * pStd) * 100) / 100,
        p50: Math.round(seqMean                   * 100) / 100,
        p90: Math.round((seqMean + 1.282 * pStd)  * 100) / 100,
        method: hasParallel ? 'pert_critical_path' : 'pert_sum'
      };
    } else {
      console.error('[PMC webapp] Portfolio NaN: seqMean=' + seqMean + ' pStd=' + pStd);
    }
  }

  // 6. Compute enrichment metrics for deduct payload
  var deductTaskCount = tasks.length;
  var deductHasSliders = 0;
  var feasibilityScores = [];
  if (result.results && Array.isArray(result.results)) {
    for (var di = 0; di < result.results.length; di++) {
      var dTask = di < tasks.length ? tasks[di] : null;
      if (!deductHasSliders && dTask && dTask.sliderValues && typeof dTask.sliderValues === 'object') {
        var sVals = Object.keys(dTask.sliderValues);
        for (var svi = 0; svi < sVals.length; svi++) {
          if (Number(dTask.sliderValues[sVals[svi]]) !== 0) { deductHasSliders = 1; break; }
        }
      }
      var dItem = result.results[di];
      if (dItem && dItem.feasibilityScore != null) feasibilityScores.push(dItem.feasibilityScore);
    }
  }
  var deductFeasibilityAvg = feasibilityScores.length
    ? Math.round(feasibilityScores.reduce(function(a, b) { return a + b; }, 0) / feasibilityScores.length)
    : 0;

  // 7. Deduct credits in WordPress CRM
  var deduct = wpPost('/pmc/v1/deduct', {
    key:             key,
    cost:            cost,
    operation:       opType,
    duration_ms:     durationMs,
    gas_exec_count:  getDailyExecCount(),
    task_count:      deductTaskCount,
    has_sliders:     deductHasSliders,
    feasibility_avg: deductFeasibilityAvg
  });

  // 8. Build quota display block
  var remaining = deduct.remaining != null ? deduct.remaining : (auth.remaining - cost);
  var total     = deduct.total     != null ? deduct.total     : auth.total;
  var bar       = deduct.bar       || buildBar(total - remaining, total);

  result._quota = {
    plan:              auth.plan,
    expires:           auth.expires,
    operation:         opType,
    credits_this_call: cost,
    credits_remaining: remaining,
    credits_total:     total,
    bar:               bar
  };

  // 9. Build plot data and save to WordPress for live visualization polling.
  //    Must happen BEFORE slimResult() which strips the PDF/CDF arrays.
  if (tasks.length > 0 && result.results && result.results[0]) {
    try {
      var plotData = buildPlotData(result.results[0], tasks[0], result._portfolio || null);
      var plotUrl  = buildPlotUrl(plotData, sessionToken);
      result._plotUrl      = plotUrl;
      result._sessionToken = sessionToken;
      // Save to WordPress (non-fatal — GPT still gets _plotUrl with static data param)
      try {
        wpPost('/pmc/v1/plot-data/save', { token: sessionToken, data: plotData });
      } catch (saveErr) {
        console.error('[PMC webapp] plot-data save failed:', saveErr.message);
      }
    } catch (plotErr) {
      console.error('[PMC webapp] buildPlotData error:', plotErr.message);
      result._sessionToken = sessionToken;
    }
  }

  // 10. Strip large point arrays so response stays under GPT's ~100 KB limit
  result = slimResult(result);

  return jsonOut(result);
}

// ── CHECK QUOTA ───────────────────────────────────────────────────────────────
function handleCheckQuota(body) {
  var key = (body.key || '').trim();
  if (!key) return jsonOut({ error: 'API key is required' });

  var resp = wpPost('/pmc/v1/quota', { key: key });
  return jsonOut(resp);
}

// ── WORDPRESS HTTP HELPER ─────────────────────────────────────────────────────
function getWpUrl() {
  return PropertiesService.getScriptProperties().getProperty('WP_URL') || '';
}

function wpPost(path, payload) {
  var wpUrl  = getWpUrl();
  var secret = PropertiesService.getScriptProperties().getProperty('WP_API_SECRET') || '';

  if (!wpUrl || !secret) {
    console.error('[PMC webapp] WP_URL or WP_API_SECRET not set in Script Properties');
    return { error: 'WordPress connection not configured' };
  }

  // Guard against SSRF — WP_URL must be icarenow.io over HTTPS.
  var _allowed = ['https://icarenow.io', 'https://www.icarenow.io'];
  if (_allowed.indexOf(wpUrl.toLowerCase().replace(/\/$/, '')) === -1) {
    console.error('[PMC webapp] WP_URL rejected: ' + wpUrl);
    return { error: 'WordPress connection misconfigured' };
  }

  try {
    var resp = UrlFetchApp.fetch(wpUrl + '/wp-json' + path, {
      method:             'post',
      contentType:        'application/json',
      headers:            { 'X-PMC-Secret': secret },
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true,
      followRedirects:    false
    });

    var code = resp.getResponseCode();
    var text = resp.getContentText();

    if (code !== 200) {
      console.error('[PMC webapp] WP error ' + code + ':', text.substring(0, 200));
      return { error: 'WordPress returned HTTP ' + code };
    }

    return JSON.parse(text);

  } catch (err) {
    console.error('[PMC webapp] WP fetch error:', err.message);
    return { error: 'Could not reach WordPress: ' + err.message };
  }
}

// ── RESPONSE TRIMMER ─────────────────────────────────────────────────────────
// The adapter spreads the full core object (deeply nested with PDF/CDF arrays).
// Arrays > 10 elements are distribution point data — strip them recursively.
// Strings > 1500 chars are truncated. Large known blobs are dropped by key.

var STRIP_KEYS = ['baselineCsv', 'decisionCsv', 'rawSamples', 'monteCarloPaths'];

function deepSlim(obj, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 8) return '[…]';
  if (obj === null || obj === undefined) return obj;

  // Arrays: drop if large (distribution points); keep small arrays (sliders, flags)
  if (Array.isArray(obj)) {
    if (obj.length > 10) return undefined;  // stripped — caller should omit key
    return obj.map(function(item) { return deepSlim(item, depth + 1); })
              .filter(function(v) { return v !== undefined; });
  }

  // Strings: truncate long ones
  if (typeof obj === 'string') {
    return obj.length > 1500 ? obj.substring(0, 1500) + '…' : obj;
  }

  // Scalars: pass through
  if (typeof obj !== 'object') return obj;

  // Objects: recurse, drop known large keys and undefined values
  var out = {};
  Object.keys(obj).forEach(function(k) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) return;
    if (k === '__proto__' || k === 'constructor' || k === 'prototype') return;
    if (STRIP_KEYS.indexOf(k) !== -1) return;
    var v = deepSlim(obj[k], depth + 1);
    if (v !== undefined) out[k] = v;
  });
  return out;
}

function slimResult(result) {
  if (!result || typeof result !== 'object') return result;
  return deepSlim(result, 0);
}

// ── CHART URL BUILDERS (QuickChart.io) ───────────────────────────────────────
function buildChartUrls(res, task) {
  var urls = {};
  try { urls.distribution  = buildDistributionChart(res, task); } catch(e) { console.error('[PMC webapp] Distribution chart error:', e.message); }
  try { urls.probabilities = buildProbBarChart(res, task);       } catch(e) { console.error('[PMC webapp] Prob bar chart error:', e.message); }
  return urls;
}

function sampleEvery(arr, maxPts) {
  if (!arr || !Array.isArray(arr) || arr.length <= maxPts) return arr;
  var step = Math.ceil(arr.length / maxPts);
  var out  = [];
  for (var i = 0; i < arr.length; i += step) out.push(arr[i]);
  return out;
}

function buildDistributionChart(res, task) {
  var basePdf = sampleEvery(
    (res.baseline && res.baseline.monteCarloSmoothed && res.baseline.monteCarloSmoothed.pdfPoints) || [], 40);
  var adjPdf  = sampleEvery(
    (res.optimize && res.optimize.reshapedPoints && res.optimize.reshapedPoints.pdfPoints) || [], 40);
  if (!basePdf.length && !adjPdf.length) return null;

  var labels   = (basePdf.length ? basePdf : adjPdf).map(function(p){ return Math.round(p.x); });
  var baseData = basePdf.map(function(p){ return p.y != null ? p.y.toFixed(4) : 0; });
  var adjData  = adjPdf.map(function(p){ return p.y != null ? p.y.toFixed(4) : 0; });

  var datasets = [];
  if (baseData.length) datasets.push({
    label: 'Baseline', data: baseData,
    borderColor: '#94A3B8', backgroundColor: 'rgba(148,163,184,0.15)',
    fill: true, tension: 0.4, pointRadius: 0
  });
  if (adjData.length) datasets.push({
    label: 'Optimized (SACO)', data: adjData,
    borderColor: '#3B82F6', backgroundColor: 'rgba(59,130,246,0.15)',
    fill: true, tension: 0.4, pointRadius: 0
  });

  var cfg = {
    type: 'line',
    data: { labels: labels, datasets: datasets },
    options: {
      plugins: { title: { display: true, text: 'Probability Distribution — ' + (task.task || '') } },
      scales: {
        x: { title: { display: true, text: 'Value' } },
        y: { title: { display: true, text: 'Density' } }
      }
    }
  };
  return 'https://quickchart.io/chart?width=600&height=320&c=' + encodeURIComponent(JSON.stringify(cfg));
}

function buildProbBarChart(res, task) {
  var tp    = (res.targetProbability && res.targetProbability.value) || {};
  var bProb = tp.original          != null ? Math.round(tp.original          * 100) : null;
  var aProb = tp.adjusted          != null ? Math.round(tp.adjusted          * 100) : null;
  var oProb = tp.adjustedOptimized != null ? Math.round(tp.adjustedOptimized * 100) : null;

  var labels = [], data = [], colors = [];
  if (bProb != null) { labels.push('Baseline');          data.push(bProb); colors.push('#94A3B8'); }
  if (aProb != null) { labels.push('Your Settings');     data.push(aProb); colors.push('#60A5FA'); }
  if (oProb != null) { labels.push('SACO Optimized');    data.push(oProb); colors.push('#3B82F6'); }
  if (!data.length) return null;

  var cfg = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{ label: 'P(≤ Target)', data: data, backgroundColor: colors }]
    },
    options: {
      plugins: { title: { display: true, text: 'Probability of Meeting Target' } },
      scales:  { y: { min: 0, max: 100, title: { display: true, text: '%' } } }
    }
  };
  return 'https://quickchart.io/chart?width=500&height=300&c=' + encodeURIComponent(JSON.stringify(cfg));
}

function buildReportUrl(res, task) {
  try {
    var tp  = (res.targetProbability && res.targetProbability.value) || {};
    var cdf = (res.baseline && res.baseline.monteCarloSmoothed && res.baseline.monteCarloSmoothed.cdfPoints) || [];
    var data = {
      task:   task.task,
      O:      task.optimistic,
      M:      task.mostLikely,
      P:      task.pessimistic,
      target: task.targetValue,
      baselineProb:  tp.original          != null ? tp.original          : null,
      adjustedProb:  tp.adjusted          != null ? tp.adjusted          : null,
      optimizedProb: tp.adjustedOptimized != null ? tp.adjustedOptimized : null,
      p10: cdf.length ? invertCdf(cdf, 0.10) : null,
      p50: cdf.length ? invertCdf(cdf, 0.50) : null,
      p90: cdf.length ? invertCdf(cdf, 0.90) : null
    };
    var encoded = encodeURIComponent(Utilities.base64Encode(JSON.stringify(data)));
    return 'https://abeljstephen.github.io/pmc-estimator/report/?data=' + encoded;
  } catch(e) {
    return null;
  }
}

// ── PLOT DATA BUILDER ─────────────────────────────────────────────────────────
// Assembles the full data object for plot.html — includes complete PDF/CDF arrays
// (before slimResult strips them) plus all scalar enrichment fields.
function buildPlotData(res, task, portfolio) {
  // Extract winning sliders and narrative from last decisionReport
  var winSliders = null, narrative = null, recommendations = [], counterIntuition = [];
  var rReports = res.decisionReports;
  if (Array.isArray(rReports)) {
    for (var ri = rReports.length - 1; ri >= 0; ri--) {
      var rr = rReports[ri];
      if (!rr) continue;
      if (!winSliders && rr.winningSliders) winSliders = rr.winningSliders;
      if (!narrative  && rr.narrative)     narrative  = rr.narrative;
      if (!recommendations.length && Array.isArray(rr.recommendations)) recommendations = rr.recommendations;
      if (!counterIntuition.length && Array.isArray(rr.counterIntuition)) counterIntuition = rr.counterIntuition;
      if (winSliders && narrative) break;
    }
  }

  return {
    schemaVersion: 1,
    taskName:  task.task,
    O: task.optimistic, M: task.mostLikely, P: task.pessimistic,
    target: task.targetValue != null ? task.targetValue : null,
    // Full distribution arrays (200 points per series)
    basePdf:  safePoints(res, 'baseline', 'monteCarloSmoothed', 'pdfPoints'),
    baseCdf:  safePoints(res, 'baseline', 'monteCarloSmoothed', 'cdfPoints'),
    adjPdf:   safeReshapedPoints(res, 'adjusted', 'pdfPoints'),
    adjCdf:   safeReshapedPoints(res, 'adjusted', 'cdfPoints'),
    optPdf:   safeReshapedPoints(res, 'optimize', 'pdfPoints'),
    optCdf:   safeReshapedPoints(res, 'optimize', 'cdfPoints'),
    triPdf:   safeVal(res, 'trianglePdf', 'value') || [],
    triCdf:   safeVal(res, 'triangleCdf', 'value') || [],
    pertPdf:  safeVal(res, 'betaPertPdf', 'value') || [],
    pertCdf:  safeVal(res, 'betaPertCdf', 'value') || [],
    // Scalars
    targetProbability:    (res.targetProbability && res.targetProbability.value) || {},
    percentiles:          res.percentiles           || {},
    optimizedPercentiles: res.optimizedPercentiles  || {},
    feasibilityScore:     res.feasibilityScore      != null ? res.feasibilityScore : null,
    sensitivity:          res.sensitivity           || null,
    scenarios:            res.scenarios             || [],
    sliderDelta:          res.sliderDelta           || {},
    winningSliders:       winSliders,
    narrative:            narrative,
    recommendations:      recommendations,
    counterIntuition:     counterIntuition,
    portfolio:            portfolio || null
  };
}

function safePoints(res, block, sub, key) {
  try { return res[block][sub][key] || []; } catch(e) { return []; }
}
function safeReshapedPoints(res, block, key) {
  try { return res[block].reshapedPoints[key] || []; } catch(e) { return []; }
}
function safeVal(res, block, key) {
  try { return res[block][key]; } catch(e) { return null; }
}

// Builds the GitHub Pages plot URL.
// URL data param = slim scalars only (no arrays) for instant KPI render on page load.
// Full arrays are fetched via the session poll on first poll cycle.
function buildPlotUrl(pd, token) {
  try {
    var slim = {
      schemaVersion: pd.schemaVersion,
      taskName: pd.taskName,
      O: pd.O, M: pd.M, P: pd.P, target: pd.target,
      targetProbability:    pd.targetProbability,
      percentiles:          pd.percentiles,
      optimizedPercentiles: pd.optimizedPercentiles,
      feasibilityScore:     pd.feasibilityScore,
      winningSliders:       pd.winningSliders,
      portfolio:            pd.portfolio
    };
    var encoded = encodeURIComponent(Utilities.base64Encode(JSON.stringify(slim)));
    return 'https://abeljstephen.github.io/pmc-estimator/plot/?data=' + encoded + '&session=' + token;
  } catch (e) {
    return 'https://abeljstephen.github.io/pmc-estimator/plot/?session=' + token;
  }
}

// ── QUOTA BAR BUILDER ─────────────────────────────────────────────────────────
function buildBar(used, total) {
  if (!total) return '░░░░░░░░░░░░░░░░░░░░  0% remaining';
  var pct    = Math.min(100, Math.round((used / total) * 100));
  var filled = Math.round(pct / 5);
  return '█'.repeat(filled) + '░'.repeat(20 - filled)
    + '  ' + (100 - pct) + '% remaining  (' + (total - used) + ' / ' + total + ' credits)';
}

// ── SENSITIVITY BLOCK (synchronous finite-difference) ────────────────────────
// Computes dP/dSlider for each of the 7 sliders using a forward finite-difference.
// Uses computeSliderProbability() from global GAS scope (slider-adjustments.gs).
// sliderValues expected in UI units (0–100; reworkPercentage 0–50).
// Step = 10 for most sliders; step = 5 for reworkPercentage.
// Returns { baselineProbability, sliders: [{slider, gain, direction}, ...] } sorted by |gain|.
function computeSensitivityBlock(task, basePoints) {
  var sliders = task.sliderValues && typeof task.sliderValues === 'object'
    ? task.sliderValues : {};
  // Neutral defaults when no sliders provided
  var base = {
    budgetFlexibility:       sliders.budgetFlexibility       != null ? sliders.budgetFlexibility       : 50,
    scheduleFlexibility:     sliders.scheduleFlexibility     != null ? sliders.scheduleFlexibility     : 50,
    scopeCertainty:          sliders.scopeCertainty          != null ? sliders.scopeCertainty          : 50,
    scopeReductionAllowance: sliders.scopeReductionAllowance != null ? sliders.scopeReductionAllowance : 50,
    reworkPercentage:        sliders.reworkPercentage        != null ? sliders.reworkPercentage        : 25,
    riskTolerance:           sliders.riskTolerance           != null ? sliders.riskTolerance           : 50,
    userConfidence:          sliders.userConfidence          != null ? sliders.userConfidence          : 75
  };

  var baseRes = computeSliderProbability({
    points: basePoints,
    optimistic:  Number(task.optimistic),
    mostLikely:  Number(task.mostLikely),
    pessimistic: Number(task.pessimistic),
    targetValue: Number(task.targetValue),
    sliderValues: base,
    probeLevel: 1
  });
  var baseProb = (baseRes.probability && Number.isFinite(baseRes.probability.value))
    ? baseRes.probability.value : null;
  if (baseProb === null) return null;

  var KEYS = ['budgetFlexibility','scheduleFlexibility','scopeCertainty',
              'scopeReductionAllowance','reworkPercentage','riskTolerance','userConfidence'];
  var MAX_VAL = { reworkPercentage: 50 };   // all others 100
  var STEP    = { reworkPercentage:  5 };   // all others 10

  var entries = [];
  for (var ki = 0; ki < KEYS.length; ki++) {
    var k      = KEYS[ki];
    var maxV   = MAX_VAL[k] || 100;
    var h      = STEP[k]    || 10;
    var cur    = base[k];
    var right  = Math.min(maxV, cur + h);
    var actualH = right - cur;
    if (actualH <= 0) { entries.push({ slider: k, gain: 0, direction: 'neutral' }); continue; }

    var pert = {};
    for (var pk in base) { if (Object.prototype.hasOwnProperty.call(base, pk)) pert[pk] = base[pk]; }
    pert[k] = right;

    var pRes = computeSliderProbability({
      points: basePoints,
      optimistic:  Number(task.optimistic),
      mostLikely:  Number(task.mostLikely),
      pessimistic: Number(task.pessimistic),
      targetValue: Number(task.targetValue),
      sliderValues: pert,
      probeLevel: 1
    });
    var pProb = (pRes.probability && Number.isFinite(pRes.probability.value))
      ? pRes.probability.value : null;
    if (pProb === null) { entries.push({ slider: k, gain: 0, direction: 'neutral' }); continue; }

    var dPdS = (pProb - baseProb) / actualH;
    entries.push({
      slider:    k,
      gain:      Math.round(dPdS * 1e6) / 1e6,
      direction: dPdS > 1e-6 ? 'positive' : dPdS < -1e-6 ? 'negative' : 'neutral'
    });
  }

  entries.sort(function(a, b) { return Math.abs(b.gain) - Math.abs(a.gain); });
  return { baselineProbability: Math.round(baseProb * 10000) / 10000, sliders: entries };
}

// ── SCENARIO BATCH ────────────────────────────────────────────────────────────
// Evaluates alternative scenarios for a single task.
// Slider-change scenarios: computeSliderProbability with modified sliders (±targetValue).
// Target-only scenarios: interpolateCdf on baseline CDF.
// Returns array of { name, targetValue, probability } or { name, error }.
function computeScenarioBatch(task, basePoints) {
  var baseSliders = task.sliderValues && typeof task.sliderValues === 'object'
    ? task.sliderValues : {};
  var scenarios = task.scenarios;
  var results = [];

  for (var si = 0; si < scenarios.length; si++) {
    var scn = scenarios[si];
    try {
      var scTarget  = scn.targetValue  != null ? Number(scn.targetValue)
                    : task.targetValue != null ? Number(task.targetValue) : null;
      var scSliders = scn.sliderValues != null ? scn.sliderValues : baseSliders;

      if (scn.sliderValues != null) {
        // Slider scenario — compute reshaped probability at target
        if (scTarget === null) {
          results.push({ name: scn.name, note: 'No targetValue — cannot express as probability' });
          continue;
        }
        var sRes = computeSliderProbability({
          points: basePoints,
          optimistic:  Number(task.optimistic),
          mostLikely:  Number(task.mostLikely),
          pessimistic: Number(task.pessimistic),
          targetValue: scTarget,
          sliderValues: scSliders,
          probeLevel: 1
        });
        var sProb = (sRes.probability && Number.isFinite(sRes.probability.value))
          ? Math.round(sRes.probability.value * 10000) / 10000 : null;
        results.push({ name: scn.name, targetValue: scTarget, probability: sProb });

      } else if (scn.targetValue != null) {
        // Target-only scenario — use baseline CDF (no slider change)
        var tVal  = interpolateCdf(basePoints.cdfPoints, Number(scn.targetValue));
        var tProb = (tVal && Number.isFinite(tVal.value))
          ? Math.round(tVal.value * 10000) / 10000 : null;
        results.push({ name: scn.name, targetValue: Number(scn.targetValue), probability: tProb });
      }
    } catch (e) {
      results.push({ name: scn.name, error: 'Scenario computation failed' });
    }
  }
  return results;
}

// ── SESSION HANDLERS ──────────────────────────────────────────────────────────
function handleSaveSession(body) {
  var key   = (body.key   || '').trim();
  var email = (body.email || '').trim().toLowerCase();
  var session = body.session;

  if (!key) return jsonOut({ error: 'API key is required' });
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailPattern.test(email))
    return jsonOut({ error: 'A valid email address is required' });
  if (!session || typeof session !== 'object')
    return jsonOut({ error: 'session must be a JSON object' });
  var sessionSize;
  try { sessionSize = JSON.stringify(session).length; } catch (e) { sessionSize = 0; }
  if (sessionSize > 50000)
    return jsonOut({ error: 'Session data too large (max 50 KB)' });

  var resp = wpPost('/pmc/v1/session/save', { key: key, email: email, session: session });
  return jsonOut(resp);
}

function handleLoadSessions(body) {
  var key   = (body.key   || '').trim();
  var email = (body.email || '').trim().toLowerCase();

  if (!key) return jsonOut({ error: 'API key is required' });
  var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailPattern.test(email))
    return jsonOut({ error: 'A valid email address is required' });

  var resp = wpPost('/pmc/v1/session/load', { key: key, email: email });
  return jsonOut(resp);
}

// ── DAILY EXECUTION COUNTER ───────────────────────────────────────────────────
// Uses PropertiesService to count executions per calendar day (script timezone).
// Resets at midnight. Thread-safe enough for rate-limiting purposes.
function getDailyExecCount() {
  try {
    var props   = PropertiesService.getScriptProperties();
    var tz      = Session.getScriptTimeZone();
    var today   = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var stored  = props.getProperty('pmc_exec_date')  || '';
    var count   = parseInt(props.getProperty('pmc_exec_count') || '0', 10);
    if (stored !== today) {
      count = 1;
      props.setProperties({ pmc_exec_date: today, pmc_exec_count: '1' });
    } else {
      count += 1;
      props.setProperty('pmc_exec_count', String(count));
    }
    return count;
  } catch (e) {
    return 0;
  }
}

// ── PING HANDLER ──────────────────────────────────────────────────────────────
// Lightweight health check — returns version, timestamp, and daily exec count.
// Called by WordPress Tools → Ping GAS button.
function handlePing(body) {
  try {
    var props  = PropertiesService.getScriptProperties();
    var tz     = Session.getScriptTimeZone();
    var today  = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
    var stored = props.getProperty('pmc_exec_date') || '';
    var count  = stored === today
      ? parseInt(props.getProperty('pmc_exec_count') || '0', 10)
      : 0;
    return jsonOut({
      ok:               true,
      version:          60,
      ts:               new Date().toISOString(),
      daily_exec_count: count,
      exec_date:        today
    });
  } catch (e) {
    return jsonOut({ ok: false, error: e.message });
  }
}

// ── JSON RESPONSE HELPER ──────────────────────────────────────────────────────
function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
