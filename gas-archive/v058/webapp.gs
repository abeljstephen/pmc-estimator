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
    var body = JSON.parse(e.postData.contents);
    var action = body.action || '';

    if (action === 'request_trial') return handleTrial(body);
    if (action === 'call_api')      return handleCallApi(body);
    if (action === 'check_quota')   return handleCheckQuota(body);

    return jsonOut({ error: 'Unknown action: ' + action });

  } catch (err) {
    console.error('[PMC webapp] doPost error:', err.message);
    return jsonOut({ error: 'Server error: ' + err.message });
  }
}

// ── TRIAL REQUEST ─────────────────────────────────────────────────────────────
function handleTrial(body) {
  var email = (body.email || '').trim().toLowerCase();
  if (!email || email.indexOf('@') === -1)
    return jsonOut({ error: 'A valid email address is required' });

  var resp = wpPost('/pmc/v1/trial', { email: email });
  return jsonOut(resp);
}

// ── ESTIMATION CALL ───────────────────────────────────────────────────────────
function handleCallApi(body) {
  var key = (body.key || '').trim();
  if (!key) return jsonOut({ error: 'API key is required' });

  // 1. Validate key + get quota from WordPress CRM
  var auth = wpPost('/pmc/v1/validate', { key: key });
  if (!auth.valid) return jsonOut({ error: auth.error, upgrade_url: auth.upgrade_url });

  // 2. Determine credit cost
  var opType = body.operationType || 'full_saco';
  var cost   = CREDIT_COSTS[opType] || 2;

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

  for (var i = 0; i < tasks.length; i++) {
    var t = tasks[i];
    if (!t.task)        return jsonOut({ error: 'Task ' + (i+1) + ' is missing a name' });
    if (t.optimistic  == null) return jsonOut({ error: 'Task "' + t.task + '" is missing optimistic value' });
    if (t.mostLikely  == null) return jsonOut({ error: 'Task "' + t.task + '" is missing mostLikely value' });
    if (t.pessimistic == null) return jsonOut({ error: 'Task "' + t.task + '" is missing pessimistic value' });
    if (t.optimistic > t.mostLikely || t.mostLikely > t.pessimistic)
      return jsonOut({ error: 'Task "' + t.task + '": values must satisfy optimistic ≤ mostLikely ≤ pessimistic' });
  }

  // 4. Run SACO estimation engine
  var result;
  try {
    result = pmcEstimatorAPI(tasks);
  } catch (err) {
    console.error('[PMC webapp] Engine error:', err.message);
    return jsonOut({ error: 'Estimation engine error: ' + err.message });
  }

  // 5. Deduct credits in WordPress CRM
  var deduct = wpPost('/pmc/v1/deduct', {
    key:       key,
    cost:      cost,
    operation: opType
  });

  // 6. Build quota display block
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

  // 7. Build chart URLs and report link (needs arrays — do before stripping)
  if (tasks.length > 0 && result.results && result.results[0]) {
    result._charts    = buildChartUrls(result.results[0], tasks[0]);
    result._reportUrl = buildReportUrl(result.results[0], tasks[0]);
  }

  // 8. Strip large point arrays so response stays under GPT's ~100 KB limit
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

  try {
    var resp = UrlFetchApp.fetch(wpUrl + '/wp-json' + path, {
      method:             'post',
      contentType:        'application/json',
      headers:            { 'X-PMC-Secret': secret },
      payload:            JSON.stringify(payload),
      muteHttpExceptions: true
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
// Removes distribution point arrays (PDF/CDF) from each task result.
// The GPT only needs scalar metrics + sliders + text summaries.
// Chart URLs are pre-built before this runs, so nothing is lost.
var ARRAY_KEYS_TO_STRIP = [
  'baselinePdf',  'baselineCdf',
  'adjustedPdf',  'adjustedCdf',
  'optimizedPdf', 'optimizedCdf',
  'trianglePdf',  'triangleCdf',
  'pertPdf',      'pertCdf',
  'mcRawPdf',     'mcRawCdf',
  'smoothedPdf',  'smoothedCdf',
  'pdf',          'cdf',
  'points',       'rawPoints',
  'baselinePoints', 'adjustedPoints', 'optimizedPoints'
];

function slimResult(result) {
  if (!result || typeof result !== 'object') return result;

  // Strip arrays from each task result
  if (Array.isArray(result.results)) {
    result.results = result.results.map(function(r) {
      if (!r || typeof r !== 'object') return r;
      var slim = {};
      Object.keys(r).forEach(function(k) {
        if (ARRAY_KEYS_TO_STRIP.indexOf(k) === -1) slim[k] = r[k];
      });
      return slim;
    });
  }

  // Truncate playbook strings to 2000 chars each
  if (result.playbooks && typeof result.playbooks === 'object') {
    Object.keys(result.playbooks).forEach(function(k) {
      if (typeof result.playbooks[k] === 'string' && result.playbooks[k].length > 2000) {
        result.playbooks[k] = result.playbooks[k].substring(0, 2000) + '…';
      }
    });
  }

  // Drop raw CSV strings (large, not useful for GPT)
  delete result.baselineCsv;
  delete result.decisionCsv;

  return result;
}

// ── CHART URL BUILDERS (QuickChart.io) ───────────────────────────────────────
function buildChartUrls(res, task) {
  var urls = {};
  try { urls.distribution  = buildDistributionChart(res, task); } catch(e) {}
  try { urls.probabilities = buildProbBarChart(res, task);       } catch(e) {}
  return urls;
}

function sampleEvery(arr, maxPts) {
  if (!arr || arr.length <= maxPts) return arr;
  var step = Math.ceil(arr.length / maxPts);
  var out  = [];
  for (var i = 0; i < arr.length; i += step) out.push(arr[i]);
  return out;
}

function buildDistributionChart(res, task) {
  var basePdf = sampleEvery(res.baselinePdf  || res.basePdf  || [], 40);
  var adjPdf  = sampleEvery(res.adjustedPdf  || res.adjPdf   || [], 40);
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
  var bProb = res.baselineProb  != null ? Math.round(res.baselineProb  * 100) : null;
  var aProb = res.adjustedProb  != null ? Math.round(res.adjustedProb  * 100) : null;
  var oProb = res.optimizedProb != null ? Math.round(res.optimizedProb * 100) : null;

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
    var data = {
      task:   task.task,
      O:      task.optimistic,
      M:      task.mostLikely,
      P:      task.pessimistic,
      target: task.targetValue,
      baselineProb:  res.baselineProb,
      adjustedProb:  res.adjustedProb,
      optimizedProb: res.optimizedProb,
      p10: res.p10, p50: res.p50, p90: res.p90
    };
    var encoded = encodeURIComponent(Utilities.base64Encode(JSON.stringify(data)));
    return 'https://abeljstephen.github.io/pmc-estimator/report/?data=' + encoded;
  } catch(e) {
    return null;
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

// ── JSON RESPONSE HELPER ──────────────────────────────────────────────────────
function jsonOut(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
