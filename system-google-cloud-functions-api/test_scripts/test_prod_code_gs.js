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

// ---------------- helpers (math/display) ----------------

function pertMean(O, M, P) {
  return (O + 4 * M + P) / 6;
}

function interpolateCdf(cdfPoints, x) {
  if (!Array.isArray(cdfPoints) || cdfPoints.length < 2) return null;
  const n = cdfPoints.length;
  if (x <= cdfPoints[0].x) return cdfPoints[0].y ?? 0;
  if (x >= cdfPoints[n - 1].x) return cdfPoints[n - 1].y ?? 1;

  // find segment
  let i = 0;
  while (i < n - 1 && !(cdfPoints[i].x <= x && x <= cdfPoints[i + 1].x)) i++;
  if (i >= n - 1) return cdfPoints[n - 1].y ?? 1;

  const x0 = cdfPoints[i].x, y0 = cdfPoints[i].y;
  const x1 = cdfPoints[i + 1].x, y1 = cdfPoints[i + 1].y;
  const t = (x - x0) / (x1 - x0);
  return y0 + t * (y1 - y0);
}

function meanFromPdf(pdfPoints) {
  if (!Array.isArray(pdfPoints) || pdfPoints.length < 2) return null;
  let integralXF = 0;
  for (let i = 0; i < pdfPoints.length - 1; i++) {
    const x0 = pdfPoints[i].x, f0 = pdfPoints[i].y;
    const x1 = pdfPoints[i + 1].x, f1 = pdfPoints[i + 1].y;
    const dx = x1 - x0;
    integralXF += 0.5 * (x0 * f0 + x1 * f1) * dx;
  }
  return integralXF; // assuming pdf integrates to ~1 already
}

function triPdf(x, O, M, P) {
  if (x < O || x > P) return 0;
  const denomLeft = (P - O) * (M - O);
  const denomRight = (P - O) * (P - M);
  if (x === M) {
    // peak value for continuity
    const left = denomLeft > 0 ? 2 * (M - O) / denomLeft : 0;
    const right = denomRight > 0 ? 2 * (P - M) / denomRight : 0;
    return Math.max(left, right);
  }
  if (x <= M) {
    return denomLeft > 0 ? (2 * (x - O)) / denomLeft : 0;
  } else {
    return denomRight > 0 ? (2 * (P - x)) / denomRight : 0;
  }
}

function klDivergenceTriangleVsMC(pdfMC, O, M, P) {
  if (!Array.isArray(pdfMC) || pdfMC.length < 2) return null;
  const eps = 1e-12;
  let D = 0;
  for (let i = 0; i < pdfMC.length - 1; i++) {
    const x0 = pdfMC[i].x, p0 = Math.max(pdfMC[i].y, eps);
    const x1 = pdfMC[i + 1].x, p1 = Math.max(pdfMC[i + 1].y, eps);
    const q0 = Math.max(triPdf(x0, O, M, P), eps);
    const q1 = Math.max(triPdf(x1, O, M, P), eps);
    const dx = x1 - x0;
    const g0 = p0 * Math.log(p0 / q0);
    const g1 = p1 * Math.log(p1 / q1);
    D += 0.5 * (g0 + g1) * dx;
  }
  return D;
}

function pc(v, digits = 2) {
  if (v == null || !isFinite(v)) return 'N/A';
  return (v * 100).toFixed(digits) + '%';
}

function fmt(v, digits = 6) {
  if (v == null || !isFinite(v)) return 'N/A';
  return Number(v).toFixed(digits);
}

// ---------------- request builders ----------------

function buildTaskBase(targetValue) {
  const O = 1800, M = 2400, P = 3000;

  return {
    task: 'Cost',
    optimistic: O,
    mostLikely: M,
    pessimistic: P,
    targetValue,

    // Include user sliders so API returns the "user reshaped" overlay in the same call.
    // Optimization ignores these when it searches for its own optimum, but this keeps
    // all three curves (baseline, user, optimized) consistent off the SAME baseline.
    sliderValues: {
      budgetFlexibility: 50,
      scheduleFlexibility: 50,
      scopeCertainty: 50,
      scopeReductionAllowance: 50,
      reworkPercentage: 25, // must be <= 50
      riskTolerance: 50,
      userConfidence: 50
    },

    // IMPORTANT: allow triangle points so we can compute KL(Triangle || MC)
    suppressOtherDistros: false,

    // Keep copula off unless you want to test it
    useCopulaForReshaping: false,

    // Do both overlay + optimization in ONE server pass (reuses the same baseline)
    optimize: true,
    optimizeFor: 'target'
  };
}

async function getIdTokenClient(audience) {
  const auth = new GoogleAuth({ credentials: require(SERVICE_ACCOUNT_KEY_PATH) });
  return auth.getIdTokenClient(audience);
}

async function post(client, url, tasks, label) {
  console.log(`\n[${label}] POST ${url}`);
  console.log('Payload:');
  console.dir(tasks, { depth: null });

  try {
    const res = await client.request({
      url,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Client': 'test-prod-code-gs:api-only' },
      data: tasks,
      timeout: HTTP_TIMEOUT_MS
    });

    console.log('\nHTTP OK — raw response from API:');
    console.dir(res.data, { depth: null, maxArrayLength: null });

    const r0 = Array.isArray(res.data?.results) ? res.data.results[0] : null;
    if (!r0) {
      console.log('\n(No first result present)');
      return { ok: true, data: res.data, r0: null };
    }

    // Friendly quick fields (all from ONE response = same baseline)
    const baselineP = r0.initialReshapedPoints?.probability ?? null;
    const userP = r0.targetProbability?.value?.adjusted ?? null;
    const optP  = r0.targetProbability?.value?.adjustedOptimized ?? null;

    console.log('\n— Quick fields —');
    console.log('baseline P(X ≤ target):', baselineP ?? 'N/A');
    console.log('user     P(X ≤ target):', userP ?? 'N/A');
    console.log('optimized P(X ≤ target):', optP ?? 'N/A');

    // Optimized sliders (so we can show them)
    const optSliders = r0.optimizedSliders?.value || r0.optimalSliderSettings?.value || null;
    if (optSliders) {
      console.log('\nOptimized slider settings:', optSliders);
    }

    // Counts for sanity
    const sm = r0.allDistributions?.value?.monteCarloSmoothed;
    if (sm) {
      const pdfN = Array.isArray(sm.pdfPoints) ? sm.pdfPoints.length : null;
      const cdfN = Array.isArray(sm.cdfPoints) ? sm.cdfPoints.length : null;
      console.log('MC-smoothed points:', { pdfPoints: pdfN, cdfPoints: cdfN });
    }

    if (r0.error) {
      console.log('\nResult error:', r0.error);
      if (r0.details) console.log('Result details:', r0.details);
    }

    return { ok: true, data: res.data, r0 };
  } catch (e) {
    const status = e?.response?.status;
    const body = e?.response?.data;
    console.error(`\nHTTP error${status ? ` ${status}` : ''}:`, body || e.message);
    return { ok: false, status, err: e };
  }
}

// ---------------- main ----------------

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

  const O = 1800, M = 2400, P = 3000;
  const targetMinus = Math.round(M * 0.95); // ML - 5%
  const targetPlus  = Math.round(M * 1.05); // ML + 5%

  // One call per target → both "user overlay" and "optimize" reuse the SAME baseline
  const tMinus = buildTaskBase(targetMinus);
  const rMinus = await post(client, SERVICE_URL, [tMinus], `1) USER+OPTIMIZE (target ML - 5% = ${targetMinus})`);
  if (!rMinus.ok) process.exit(1);

  const tPlus = buildTaskBase(targetPlus);
  const rPlus = await post(client, SERVICE_URL, [tPlus], `2) USER+OPTIMIZE (target ML + 5% = ${targetPlus})`);
  if (!rPlus.ok) process.exit(1);

  // Build rows for the big table
  function buildRow(label, resObj) {
    const r0 = resObj.r0 || {};
    const allCI = r0.allCIs?.value?.monteCarloSmoothed || {};
    const mc = r0.allDistributions?.value?.monteCarloSmoothed || {};
    const tri = r0.allDistributions?.value?.triangle || null;

    const baselinePdf = r0.initialReshapedPoints?.pdfPoints || mc.pdfPoints || [];
    const baselineCdf = r0.initialReshapedPoints?.cdfPoints || mc.cdfPoints || [];
    const optPdf = r0.optimizedReshapedPoints?.pdfPoints || [];
    const optCdf = r0.optimizedReshapedPoints?.cdfPoints || [];

    const baselineAtTarget = r0.initialReshapedPoints?.probability ?? null;
    const userAtTarget = r0.targetProbability?.value?.adjusted ?? null;
    const optAtTarget = r0.targetProbability?.value?.adjustedOptimized ?? null;

    const meanBaseline = meanFromPdf(baselinePdf);
    const meanOpt = meanFromPdf(optPdf);
    const deltaMean = (meanBaseline != null && meanOpt != null) ? (meanOpt - meanBaseline) : null;

    // KL (Triangle || MC-smoothed baseline); if triangle points not returned, use analytic triangle
    const KL = klDivergenceTriangleVsMC(baselinePdf, O, M, P);

    // Baseline % confidence for target = optimistic (original O)
    const baseConfAtO = interpolateCdf(baselineCdf, O);
    // Adjusted % confidence for target = optimistic after optimization
    const optConfAtO = interpolateCdf(optCdf, O);

    // Optimized sliders
    const optSliders = r0.optimizedSliders?.value || r0.optimalSliderSettings?.value || {};

    return {
      Name: r0.task || 'Cost',
      Target: label,
      'Best Case': O,
      'Most Likely': M,
      'Worst Case': P,
      'PERT': fmt(pertMean(O, M, P), 2),
      'MC Smoothed 95% CI Lower': fmt(allCI.lower, 2),
      'MC Smoothed 95% CI Upper': fmt(allCI.upper, 2),

      // earlier quick metrics we keep
      'Baseline P(X≤T)': baselineAtTarget != null ? fmt(baselineAtTarget, 6) : 'N/A',
      'User P(X≤T)': userAtTarget != null ? fmt(userAtTarget, 6) : 'N/A',
      'Optimized P(X≤T)': optAtTarget != null ? fmt(optAtTarget, 6) : 'N/A',

      // new columns requested
      '% Confidence of Original Optimistic Value': baseConfAtO != null ? pc(baseConfAtO, 2) : 'N/A',

      'Optimal Budget Flexibility': optSliders.budgetFlexibility ?? 'N/A',
      'Optimal Schedule Flexibility': optSliders.scheduleFlexibility ?? 'N/A',
      'Optimal Scope Certainty': optSliders.scopeCertainty ?? 'N/A',
      'Optimal Scope Reduction Allowance': optSliders.scopeReductionAllowance ?? 'N/A',
      'Optimal Rework Percentage': optSliders.reworkPercentage ?? 'N/A',
      'Optimal Risk Tolerance': optSliders.riskTolerance ?? 'N/A',
      'Optimal User Confidence': optSliders.userConfidence ?? 'N/A',

      '% Confidence of Original Optimistic Value After Slider Optimization':
        optConfAtO != null ? pc(optConfAtO, 2) : 'N/A',

      'MC Smoothed Sensitivity Change': deltaMean != null ? fmt(deltaMean, 4) : 'N/A',
      'KL Divergence To Triangle': KL != null ? fmt(KL, 6) : 'N/A',

      'MC Smoothed Points': Array.isArray(baselinePdf) ? baselinePdf.length : 'N/A',
      'CDF Points': Array.isArray(baselineCdf) ? baselineCdf.length : 'N/A',

      Status: r0.error ? String(r0.error) : 'ok'
    };
  }

  const rows = [
    buildRow(`${targetMinus} (ML - 5%)`, rMinus),
    buildRow(`${targetPlus} (ML + 5%)`, rPlus),
  ];

  console.log('\n===== Summary (two targets around Most Likely) =====');
  console.table(rows);
})();

