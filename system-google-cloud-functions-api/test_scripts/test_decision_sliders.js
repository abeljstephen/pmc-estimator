/* eslint-disable no-console */
'use strict';

const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const SERVICE_URL =
  process.env.SERVICE_URL ||
  'https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI';

const SERVICE_ACCOUNT_KEY_PATH =
  process.env.SERVICE_ACCOUNT_KEY_PATH ||
  path.join(__dirname, '../pmc-estimator-b50a03244199.json');

const HTTP_TIMEOUT_MS = 180000;

// ---------------------------------------------------------------------
// Auth helpers (kept as-is style)
// ---------------------------------------------------------------------
async function getIdTokenClient(audience) {
  const auth = new GoogleAuth({ credentials: require(SERVICE_ACCOUNT_KEY_PATH) });
  return auth.getIdTokenClient(audience);
}

// ---------------------------------------------------------------------
// Slider helpers
// ---------------------------------------------------------------------

const SLIDER_KEYS = [
  'budgetFlexibility',
  'scheduleFlexibility',
  'scopeCertainty',
  'scopeReductionAllowance',
  'reworkPercentage',
  'riskTolerance',
  'userConfidence'
];

const LABELS = {
  budgetFlexibility:       'Budget Flexibility',
  scheduleFlexibility:     'Schedule Flexibility',
  scopeCertainty:          'Scope Certainty',
  scopeReductionAllowance: 'Scope Reduction Allowance',
  reworkPercentage:        'Rework Percentage',
  riskTolerance:           'Risk Tolerance',
  userConfidence:          'User Confidence'
};

// Normalize any slider block → UI units:
// - If value in [0,1], treat as normalized and scale to %
//   • most sliders: 0–1 → 0–100
//   • reworkPercentage: 0–1 → 0–50
// - Otherwise assume it's already in UI units and clamp.
function normalizeToUi(sliderBlock = {}) {
  const out = {};
  for (const key of SLIDER_KEYS) {
    let v = sliderBlock[key];
    if (v == null || !Number.isFinite(v)) {
      out[key] = 0;
      continue;
    }
    const raw = Number(v);
    const isRework = key === 'reworkPercentage';

    if (raw >= 0 && raw <= 1) {
      // 0–1 → UI units
      const scale = isRework ? 50 : 100;
      out[key] = raw * scale;
    } else {
      // Already in UI range; clamp
      const max = isRework ? 50 : 100;
      out[key] = Math.max(0, Math.min(max, raw));
    }
  }
  return out;
}

// Helper to build a nice dict of all four columns for one slider row
function buildRow(sliderKey, baselineUi, manualUi, fixedUi, adaptiveUi) {
  return {
    Slider: LABELS[sliderKey] || sliderKey,
    Baseline: baselineUi[sliderKey]?.toFixed(2),
    Manual: manualUi[sliderKey]?.toFixed(2),
    Fixed: fixedUi[sliderKey]?.toFixed(2),
    Adaptive: adaptiveUi[sliderKey]?.toFixed(2)
  };
}

// Helper: choose best UI-scale source for a run
function pickUiSlidersForRun(r, modeLabel) {
  let src = null;
  let sourceName = 'none/UI-fallback';

  if (modeLabel === 'FIXED') {
    // Fixed: prefer explain.optimized.winningSliders
    src =
      r.explain?.optimized?.winningSliders ||
      r.optimalSliderSettings?.value ||
      r.optimize?.scaledSliders ||
      r.optimize?.sliders ||
      null;

    if (r.explain?.optimized?.winningSliders) {
      sourceName = 'explain.optimized.winningSliders';
    } else if (r.optimalSliderSettings?.value) {
      sourceName = 'optimalSliderSettings.value';
    } else if (r.optimize?.scaledSliders) {
      sourceName = 'optimize.scaledSliders';
    } else if (r.optimize?.sliders) {
      sourceName = 'optimize.sliders';
    }
  } else {
    // ADAPTIVE: be more defensive
    src =
      // 1) adaptive winners, if present
      r.explain?.adaptive?.winningSliders ||
      // 2) sometimes the winners only live under optimized.*
      r.explain?.optimized?.winningSliders ||
      // 3) generic optimal slider settings
      r.optimalSliderSettings?.value ||
      // 4) optimized blocks
      r.optimize?.scaledSliders ||
      r.optimize?.sliders ||
      null;

    if (r.explain?.adaptive?.winningSliders) {
      sourceName = 'explain.adaptive.winningSliders';
    } else if (r.explain?.optimized?.winningSliders) {
      sourceName = 'explain.optimized.winningSliders (adaptive run)';
    } else if (r.optimalSliderSettings?.value) {
      sourceName = 'optimalSliderSettings.value (adaptive run)';
    } else if (r.optimize?.scaledSliders) {
      sourceName = 'optimize.scaledSliders (adaptive run)';
    } else if (r.optimize?.sliders) {
      sourceName = 'optimize.sliders (adaptive run)';
    }
  }

  // If we still don't have anything, fall back to sliders01 (0–1 domain)
  if (!src && r.optimize?.sliders01) {
    src = r.optimize.sliders01;
    sourceName = `${sourceName} → fallback to optimize.sliders01 (0–1; will be normalizedToUi)`;
  }

  console.log(`\n[${modeLabel}] Using slider source for UI column: ${sourceName}`);
  if (src) console.dir(src, { depth: null });

  return normalizeToUi(src || {});
}

// ---------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------

// One common O/M/P/target + hard-coded manual sliders
function buildBaseTask(overrides = {}) {
  const O = 10;
  const M = 20;
  const P = 30;
  const target = 22; // simple hard-coded target for demo

  return {
    task: 'Decision Sliders Demo',
    optimistic: O,
    mostLikely: M,
    pessimistic: P,
    targetValue: target,

    // manual slider values in UI units
    sliderValues: {
      budgetFlexibility: 60,
      scheduleFlexibility: 40,
      scopeCertainty: 80,
      scopeReductionAllowance: 20,
      reworkPercentage: 15, // 0–50
      riskTolerance: 50,
      userConfidence: 90
    },

    suppressOtherDistros: false,
    optimizeFor: 'target',
    confidenceLevel: 0.95,

    // defaults; overridden per variant below
    optimize: false,
    adaptive: false,
    probeLevel: 0,

    ...overrides
  };
}

// Call API once with a single task, and dump raw slider fields for inspection
async function callOnce(client, url, task, label) {
  console.log(`\n[${label}] POST ${url}`);
  console.log('Payload:');
  console.dir([task], { depth: null });

  try {
    const res = await client.request({
      url,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client': 'test-decision-sliders'
      },
      data: [task],
      timeout: HTTP_TIMEOUT_MS
    });

    console.log('\nHTTP OK — schema / build info:');
    const r0 = Array.isArray(res.data?.results) ? res.data.results[0] : null;
    if (!r0) {
      console.log('(No first result present)');
      return null;
    }
    console.log('schemaVersion:', r0.schemaVersion);
    console.log('buildInfo.tag:', r0.buildInfo?.tag);
    console.log('buildInfo.builtAt:', r0.buildInfo?.builtAt);

    // --- RAW FIELD DIAGNOSTICS ---------------------------------------
    console.log('\n--- RAW FIELD SNAPSHOT (' + label + ') ---');
    console.log('adjusted.manualSliders01:', r0.adjusted?.manualSliders01);
    console.log('adjusted.explain.manualSliders:', r0.adjusted?.explain?.manualSliders);
    console.log('adjusted.explain.winningSliders:', r0.adjusted?.explain?.winningSliders);

    console.log('optimize.sliders01:', r0.optimize?.sliders01);
    console.log('optimize.sliders:', r0.optimize?.sliders);
    console.log('optimize.scaledSliders:', r0.optimize?.scaledSliders);

    console.log('optimalSliderSettings.value:', r0.optimalSliderSettings?.value);

    console.log('explain.optimized.winningSliders:', r0.explain?.optimized?.winningSliders);
    console.log('explain.adaptive.winningSliders:', r0.explain?.adaptive?.winningSliders);

    return r0;
  } catch (e) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    console.error(`\nHTTP error${status ? ` ${status}` : ''}:`, body || e.message);
    return null;
  }
}

// ---------------------------------------------------------------------
// Main: build Decision Sliders style table
// ---------------------------------------------------------------------

(async function main() {
  console.log('Authenticating with service account…');
  let client;
  try {
    client = await getIdTokenClient(SERVICE_URL);
    console.log('Auth ready. Using endpoint:', SERVICE_URL);
  } catch (err) {
    console.error('FATAL: Auth failed:', err?.message || err);
    process.exit(1);
  }

  // ---- 1) Manual (overlay) run ---------------------------------------
  // Manual reshaping only; we want adjusted.manualSliders01.
  const manualTask = buildBaseTask({
    optimize: false,
    adaptive: false,
    probeLevel: 0, // manual-only; no auto optimization
    mode: 'view'
  });

  const manualRes = await callOnce(client, SERVICE_URL, manualTask, 'MANUAL');
  if (!manualRes) process.exit(1);

  // Extract manual slider info:
  // Prefer adjusted.manualSliders01 (0–1 from adapter); then any explain.manualSliders;
  // then explain.winningSliders; finally fall back to the original UI sliderValues.
  const manual01 =
    manualRes.adjusted?.manualSliders01 ||
    manualRes.adjusted?.explain?.manualSliders ||
    manualRes.adjusted?.explain?.winningSliders ||
    null;

  const manualUi =
    manual01
      ? normalizeToUi(manual01)
      : normalizeToUi(manualTask.sliderValues); // fallback (UI → UI, normalizeToUi just clamps)

  // ---- 2) Fixed optimization run ------------------------------------
  // Fixed mode: optimize=true, adaptive=false
  const fixedTask = buildBaseTask({
    optimize: true,
    adaptive: false,
    probeLevel: 3, // moderate search depth
    mode: 'fixed'
  });

  const fixedRes = await callOnce(client, SERVICE_URL, fixedTask, 'FIXED');
  if (!fixedRes) process.exit(1);

  const fixedUi = pickUiSlidersForRun(fixedRes, 'FIXED');

  // ---- 3) Adaptive optimization run --------------------------------
  // Adaptive mode: optimize=true, adaptive=true
  const adaptiveTask = buildBaseTask({
    optimize: true,
    adaptive: true,
    probeLevel: 5, // deeper SACO probe
    mode: 'adaptive'
  });

  const adaptiveRes = await callOnce(client, SERVICE_URL, adaptiveTask, 'ADAPTIVE');
  if (!adaptiveRes) process.exit(1);

  const adaptiveUi = pickUiSlidersForRun(adaptiveRes, 'ADAPTIVE');

  // ---- Build Decision Sliders style table --------------------------
  const baselineUi = normalizeToUi({}); // all zeros

  const rows = SLIDER_KEYS.map((key) =>
    buildRow(key, baselineUi, manualUi, fixedUi, adaptiveUi)
  );

  console.log('\n===== Decision Sliders Table (Baseline / Manual / Fixed / Adaptive) =====');
  console.table(rows);

  // Also show final probabilities for context
  const manualP  = manualRes.targetProbability?.value?.adjusted ?? null;
  const fixedP   = fixedRes.targetProbability?.value?.adjustedOptimized ?? null;
  const adaptP   = adaptiveRes.targetProbability?.value?.adaptiveOptimized
                ?? adaptiveRes.targetProbability?.value?.adjustedOptimized
                ?? null;
  const baseP    = manualRes.targetProbability?.value?.original ?? null;

  console.log('\nProbabilities at target (from API):');
  console.log('  Baseline :', baseP);
  console.log('  Manual   :', manualP);
  console.log('  Fixed    :', fixedP);
  console.log('  Adaptive :', adaptP);

  console.log('\nDone.');
})();

