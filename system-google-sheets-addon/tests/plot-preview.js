#!/usr/bin/env node
/**
 * Plot Preview Server — Local testing for Plot.html
 *
 * Serves Plot.html in the browser with google.script.run mocked.
 * The mock uses the real core .gs modules (loaded via vm) to generate
 * actual distribution data, so the charts show real curves.
 *
 * Usage: node tests/plot-preview.js [--port=3456]
 * Then open http://localhost:3456 in your browser.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const vm   = require('vm');
const { exec } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const PORT = (() => {
  const arg = process.argv.find(a => a.startsWith('--port='));
  return arg ? parseInt(arg.split('=')[1], 10) : 3456;
})();

// ────────────────────────────────────────────────
// 1. Load core modules (same approach as qa-local.js)
// ────────────────────────────────────────────────
globalThis.Logger = { log: () => {} };
globalThis.SpreadsheetApp = { flush: () => {}, getActiveSpreadsheet: () => null, getUi: () => ({}) };
globalThis.Utilities = { formatDate: () => new Date().toISOString() };
globalThis.Session = { getScriptTimeZone: () => 'America/Los_Angeles' };
globalThis.HtmlService = { createHtmlOutputFromFile: () => ({ setTitle: () => ({ setWidth: () => ({ setHeight: () => ({ setXFrameOptionsMode: () => ({}) }) }) }) }) };

const context = vm.createContext(globalThis);

const loadOrder = [
  'Code.gs',
  'core/helpers/rng.js',
  'core/helpers/validation.gs',
  'core/helpers/metrics.gs',
  'core/baseline/utilis.gs',
  'core/baseline/triangle-points.gs',
  'core/baseline/pert-points.gs',
  'core/baseline/beta-points.gs',
  'core/baseline/monte-carlo-raw.gs',
  'core/baseline/monte-carlo-smoothed.gs',
  'core/baseline/coordinator.gs',
  'core/optimization/matrix-utils.gs',
  'core/optimization/kl-divergence.gs',
  'core/optimization/sensitivity-analysis.gs',
  'core/optimization/optimizer.gs',
  'core/reshaping/copula-utils.gs',
  'core/reshaping/slider-normalization.gs',
  'core/reshaping/slider-adjustments.gs',
  'core/reshaping/outcome-summary.gs',
  'core/report/playbooks.gs',
  'core/report/reshaping_report.gs',
  'core/visuals/annotations.gs',
  'core/visuals/heatmap-data.gs',
  'core/visuals/sankey-flow.gs',
  'core/variable_map/adapter.gs',
  'core/main/main.gs',
];

let loadErrors = [];
for (const rel of loadOrder) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) { loadErrors.push(`MISSING: ${rel}`); continue; }
  try {
    vm.runInContext(fs.readFileSync(full, 'utf8'), context, { filename: rel });
  } catch (e) {
    loadErrors.push(`LOAD ERROR in ${rel}: ${e.message}`);
  }
}

if (loadErrors.length) {
  console.log('Module load warnings:');
  loadErrors.forEach(e => console.log(`  - ${e}`));
}
console.log(`Loaded ${loadOrder.length - loadErrors.length}/${loadOrder.length} modules`);

// ────────────────────────────────────────────────
// 2. Test data (tasks from the QA dataset)
// ────────────────────────────────────────────────
const TEST_TASKS = [
  { task: 'Project_1 (Symmetrical)',   optimistic: 10, mostLikely: 20, pessimistic: 30 },
  { task: 'Project_2 (Skewed)',        optimistic: 10, mostLikely: 15, pessimistic: 50 },
  { task: 'Project_3 (High Var)',      optimistic: 5,  mostLikely: 20, pessimistic: 50 },
  { task: 'Project_5 (Narrow)',        optimistic: 10, mostLikely: 11, pessimistic: 12 },
  { task: 'Project_8 (Small Values)',  optimistic: 1,  mostLikely: 2,  pessimistic: 3  },
  { task: 'Project_9 (Large Values)',  optimistic: 1800, mostLikely: 2400, pessimistic: 3000 },
];

// ────────────────────────────────────────────────
// 3. Server-side API handler (mirrors google.script.run)
// ────────────────────────────────────────────────
function handleRPC(method, params) {
  if (method === 'getAllTasks') {
    return TEST_TASKS;
  }

  if (method === 'getTargetProbabilityData') {
    const p = params || {};
    const o = Number(p.optimistic), m = Number(p.mostLikely), pe = Number(p.pessimistic);
    const target = p.targetValue != null ? Number(p.targetValue) : m;

    try {
      // Use the real processTask from main.gs
      const taskInput = {
        optimistic: o, mostLikely: m, pessimistic: pe,
        targetValue: target,
        numSamples: 200,
        optimize: !!p.optimize,
        sliderValues: p.sliderValues || undefined,
        adaptive: !!p.adaptive,
        probeLevel: p.probeLevel != null ? Number(p.probeLevel) : (p.adaptive ? 3 : undefined),
        reshapeTriangle: true,
        reshapeBetaPert: true,
      };

      const result = context.processTask(taskInput);
      if (!result) throw new Error('processTask returned null');

      // Normalize using the same function Code.gs uses
      if (typeof context.normalizePlotResponseForUI_ === 'function') {
        return context.normalizePlotResponseForUI_(result);
      }
      return result;
    } catch (e) {
      console.error(`RPC error for ${method}:`, e.message);
      throw e;
    }
  }

  throw new Error(`Unknown RPC method: ${method}`);
}

// ────────────────────────────────────────────────
// 4. Build the mock script to inject into Plot.html
// ────────────────────────────────────────────────
const MOCK_SCRIPT = `
<script>
// Error reporter — sends JS errors back to Node server AND shows on page
window.onerror = function(msg, url, line, col, err) {
  var b = document.getElementById('errorBanner');
  if (b) { b.style.display='block'; b.innerHTML += '<div>[ERROR] '+msg+' (line '+line+':'+col+')</div>'; }
  fetch('/console', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({type:'error',msg:msg,url:url,line:line,col:col,stack:err&&err.stack})
  }).catch(function(){});
  return false;
};

// Mock google.script.run — NO Proxy (avoids thenable/Symbol traps)
(function() {
  window.google = window.google || {};
  google.script = google.script || {};

  function callRpc(rpcMethod, params, successFn, failFn) {
    console.log('[mock] RPC call: ' + rpcMethod, params);
    fetch('/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: rpcMethod, params: params })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (data.error) {
        console.error('[mock] RPC error:', data.error);
        if (failFn) failFn(new Error(data.error));
      } else {
        console.log('[mock] RPC success:', rpcMethod, data.result ? 'has data' : 'empty');
        if (successFn) successFn(data.result);
      }
    })
    .catch(function(err) {
      console.error('[mock] fetch error:', err);
      if (failFn) failFn(err);
    });
  }

  // Build a runner object with all known RPC methods pre-defined
  function makeRunner(successFn, failFn) {
    var runner = {};
    var methods = ['getAllTasks', 'getTargetProbabilityData', 'processTask',
                   'getSheetData', 'saveSettings', 'loadSettings'];
    methods.forEach(function(m) {
      runner[m] = function(params) { callRpc(m, params, successFn, failFn); };
    });
    // Fallback: withFailureHandler returns same runner
    runner.withFailureHandler = function(fn) { return makeRunner(successFn, fn); };
    runner.withSuccessHandler = function(fn) { return makeRunner(fn, failFn); };
    return runner;
  }

  google.script.run = {
    withSuccessHandler: function(successFn) {
      return makeRunner(successFn, function(e) { console.error('[mock] unhandled failure:', e); });
    },
    withFailureHandler: function(failFn) {
      return makeRunner(function() {}, failFn);
    },
    // Direct call methods (no handlers)
    getAllTasks: function(p) { callRpc('getAllTasks', p, null, null); },
    getTargetProbabilityData: function(p) { callRpc('getTargetProbabilityData', p, null, null); }
  };

  console.log('[PMC Plot Preview] google.script.run mock active (no-Proxy version)');
})();

// Diagnostic — runs 4s after DOMContentLoaded
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    var sel = document.getElementById('taskSel');
    var diag = {
      type: 'diagnostic',
      taskSelOptions: sel ? sel.options.length : 0,
      taskSelValue: sel ? sel.value : 'N/A',
      chartJsLoaded: typeof Chart !== 'undefined',
      updateChart: typeof window.updateChart === 'function',
      ensureCharts: typeof window.ensureCharts === 'function',
      pdfChartExists: !!(window.S && window.S.pdfChart),
      fetchStatus: document.getElementById('fetchStatus') ? document.getElementById('fetchStatus').textContent : 'N/A',
      plotMsgText: document.getElementById('plotMsg') ? document.getElementById('plotMsg').textContent : '',
      errorBanner: document.getElementById('errorBanner') ? document.getElementById('errorBanner').textContent : ''
    };
    fetch('/console', { method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(diag) }).catch(function(){});
  }, 4000);
});
</script>
`;

// ────────────────────────────────────────────────
// 5. HTTP Server
// ────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // RPC endpoint
  if (req.method === 'POST' && req.url === '/rpc') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { method, params } = JSON.parse(body);
        const result = handleRPC(method, params);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Console error reporter from browser
  if (req.method === 'POST' && req.url === '/console') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const msg = JSON.parse(body);
        if (msg.type === 'diagnostic') {
          console.log(`\n[BROWSER DIAGNOSTIC]`);
          Object.entries(msg).filter(([k]) => k !== 'type').forEach(([k,v]) => console.log(`  ${k}: ${v}`));
        } else {
          console.log(`\n[BROWSER ${msg.type}] ${msg.msg}`);
          if (msg.line) console.log(`  at ${msg.url}:${msg.line}:${msg.col}`);
          if (msg.stack) console.log(`  ${msg.stack.split('\n').slice(0,5).join('\n  ')}`);
        }
      } catch(e) {}
      res.writeHead(200); res.end('ok');
    });
    return;
  }

  // Serve Plot.html with mock injected
  if (req.url === '/' || req.url === '/index.html' || req.url.startsWith('/?')) {
    let html = fs.readFileSync(path.join(ROOT, 'Plot.html'), 'utf8');
    // Inject mock right after <head>
    html = html.replace('<head>', '<head>' + MOCK_SCRIPT);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store, no-cache, must-revalidate', 'Pragma': 'no-cache' });
    res.end(html);
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\nPlot Preview running at: ${url}`);
  console.log(`Tasks available: ${TEST_TASKS.map(t => t.task).join(', ')}`);
  console.log('Press Ctrl+C to stop.\n');

  // Open browser
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  exec(`${cmd} "${url}"`);
});
