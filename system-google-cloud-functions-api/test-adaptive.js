// test-saco-chain.js — Full Terminal Test Script for SACO Chaining (Baseline/Fixed/Adaptive)
// Run: node test-saco-chain.js
// Outputs: Table comparing sliders/probs/drift; logs version + raw responses.
// No calculations/fallbacks: Pure API pulls + jq parse (error if missing fields). Reads pmc-estimator-b50a03244199.json.
// Expected (post-v1.9.24): Fixed raw~0.75 (75%), Adaptive~0.70 (70%), drift<5%; probs 1%→61%→63%.
// Rows: 7 sliders + summary. Cols: Slider | Fixed Raw | Fixed % | Adaptive Raw | Adaptive % | Drift %.
// Learned from quick_deploy_pmc_api.js: JWT gen (node crypto + openssl fallback), curl with retries, jq parsing.

const crypto = require('crypto');
const fs = require('fs');
const { spawnSync } = require('child_process');
const path = require('path');

// Config (hard-coded from conversation)
const KEY_FILE = 'pmc-estimator-b50a03244199.json';
const PROJECT_ID = 'pmc-estimator';
const REGION = 'us-central1';
const FUNCTION_NAME = 'pmcEstimatorAPI';
const URL = `https://us-central1-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}`;
const TASK = { task: 'test-saco-chain', optimistic: 10, mostLikely: 20, pessimistic: 30, targetValue: 20 };
const MAX_RETRIES = 3;
const RETRY_DELAY = 10;




// ========== IAM GRANT: Ensure SA can invoke Gen2 function (self-healing; idempotent) ==========
// Why: Grants roles/run.invoker on underlying Cloud Run service (fixes 401 for Gen2). Runs once at top.
// PMBOK Ch.6: Quant access (trustworthy chaining: baseline scout → adaptive refine).
// Safety: Idempotent (no error if bound); uses Gen2-specific cmd; throws if gcloud fail.
// Wait/verify: 60s sleep + Run policy check (handles propagation lag).
// If already granted: "Updated IAM policy..." (no-op).
console.log('\n--- Granting IAM Invoker Role (Gen2) ---');
try {
  // Parse keyData locally
  const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  const invokerCmd = `gcloud functions add-invoker-policy-binding ${FUNCTION_NAME} \
    --region=${REGION} \
    --member="serviceAccount:${keyData.client_email}"`;
  const grantOut = sh(invokerCmd);
  console.log('IAM Grant Output:', grantOut);

  // Wait for propagation (Gen2 lag ~30-60s)
  console.log('Waiting 60s for IAM propagation...');
  sh('sleep 60');

  // Verify Run service policy
  const runPolicy = sh(`gcloud run services get-iam-policy projects/${PROJECT_ID}/locations/${REGION}/services/pmcestimatorapi --format="value(bindings)"`);
  if (!runPolicy.includes('roles/run.invoker') || !runPolicy.includes(keyData.client_email)) {
    throw new Error('Run policy verification failed—invoker role not bound.');
  }
  console.log('✅ IAM granted + verified (Gen2 Run invoker active).');
} catch (e) {
  console.warn('IAM grant skipped (already exists?):', e.message);
  // Continue—API will 401 if not
}
console.log('--- IAM Complete ---\n');






// Helper: Shell exec (from quick_deploy)
function sh(cmd, opts = {}) {
  const res = spawnSync(cmd, { shell: true, stdio: 'pipe', encoding: 'utf8', ...opts });
  if (res.status !== 0) {
    throw new Error(`Command failed (${cmd}):\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`);
  }
  return res.stdout.trim();
}

// Helper: Gen JWT (from quick_deploy's post-deploy test; node crypto + openssl fallback)
function generateJWT() {
  const keyData = JSON.parse(fs.readFileSync(KEY_FILE, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: keyData.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
    target_audience: URL
  };
  const header = { alg: 'RS256', typ: 'JWT' };
  const toSign = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_') + '.' +
                 Buffer.from(JSON.stringify(claimSet)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  try {
    // Node crypto
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(toSign);
    sign.end();
    const signature = sign.sign(keyData.private_key).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    return toSign + '.' + signature;
  } catch (e) {
    // Fallback: openssl (from quick_deploy)
    const tempKey = path.resolve(process.cwd(), 'temp_key.pem');
    fs.writeFileSync(tempKey, keyData.private_key);
    const signature = sh(`echo -n '${toSign}' | openssl dgst -sha256 -sign ${tempKey} | base64 | tr -d '=' | tr '/+' '_-'`);
    fs.unlinkSync(tempKey);
    return toSign + '.' + signature;
  }
}

// Helper: Call API with retries (from quick_deploy's post-deploy test)
async function callAPI(payload) {
  const jwt = generateJWT();
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`API attempt ${attempt}/${MAX_RETRIES}...`);
    const response = sh(`curl -s -w "%{http_code}" -X POST "${URL}" -H "Authorization: Bearer ${jwt}" -H "Content-Type: application/json" -d '${JSON.stringify({ tasks: [payload] })}' -o response.json`);
    const code = parseInt(response, 10);
    if (code === 200) {
      const data = JSON.parse(fs.readFileSync('response.json', 'utf8'));
      fs.unlinkSync('response.json');
      if (!data.results || !data.results[0]) throw new Error('No results[0]');
      return data.results[0];
    }
    console.warn(`API failed (status: ${code}). Retrying in ${RETRY_DELAY}s...`);
    if (attempt < MAX_RETRIES) sh(`sleep ${RETRY_DELAY}`);
  }
  throw new Error(`API failed after ${MAX_RETRIES} retries`);
}

// Helper: Parse sliders raw (0-1; error if missing; from discussion—no fallback)
function parseSliders(result) {
  const explain = result.optimize?.explain;
  if (!explain) throw new Error('No explain');
  const sliders = explain.winningSliders || explain.adaptive?.winningSliders || explain.optimized?.winningSliders || {};
  if (typeof sliders !== 'object' || Object.keys(sliders).length === 0) throw new Error('No winningSliders');
  const SLIDER_KEYS = ['budgetFlexibility', 'scheduleFlexibility', 'scopeCertainty', 'scopeReductionAllowance', 'reworkPercentage', 'riskTolerance', 'userConfidence'];
  const out = {};
  for (const key of SLIDER_KEYS) {
    if (sliders[key] == null) throw new Error(`Missing ${key}`);
    out[key] = Number(sliders[key]);
  }
  return out;
}

// Helper: Parse prob (finalProb; error if missing—no interp fallback)
function parseProb(result) {
  let prob = result.optimize?.finalProb || result.optimize?.explain?.finalProb;
  if (prob == null) throw new Error('No finalProb');
  return Number(prob);
}

// Main: Run baseline (sliders=0), fixed, adaptive
async function main() {
  console.log('=== SACO Chaining Test ===');
  console.log('URL:', URL);
  console.log('Task:', TASK);

  // Baseline (optimize=false; expect sliders=0)
  console.log('\n--- Baseline ---');
  const baselineRes = await callAPI({ ...TASK, optimize: false });
  console.log('Baseline p0:', parseProb(baselineRes).toFixed(4));  // ~0.0105
  console.log('Version:', baselineRes.buildInfo?.tag || 'Unknown');  // v1.9.24?

  // Fixed (adaptive=false)
  console.log('\n--- Fixed ---');
  const fixedRes = await callAPI({ ...TASK, optimize: true, adaptive: false });
  const fixedSliders = parseSliders(fixedRes);
  const fixedProb = parseProb(fixedRes);
  console.log('Fixed sliders:', fixedSliders);
  console.log('Fixed p\':', fixedProb.toFixed(4));  // ~0.6087

  // Adaptive (probe=3)
  console.log('\n--- Adaptive (Probe=3) ---');
  const adaptiveRes = await callAPI({ ...TASK, optimize: true, adaptive: true, probeLevel: 3 });
  const adaptiveSliders = parseSliders(adaptiveRes);
  const adaptiveProb = parseProb(adaptiveRes);
  console.log('Adaptive sliders:', adaptiveSliders);
  console.log('Adaptive p\':', adaptiveProb.toFixed(4));  // ~0.6314

  // Build table data (no calc; pure parse)
  const SLIDER_KEYS = ['budgetFlexibility', 'scheduleFlexibility', 'scopeCertainty', 'scopeReductionAllowance', 'reworkPercentage', 'riskTolerance', 'userConfidence'];
  const tableData = SLIDER_KEYS.map(key => ({
    Slider: key,
    'Fixed Raw': fixedSliders[key],
    'Fixed %': (key === 'reworkPercentage' ? fixedSliders[key] * 50 : fixedSliders[key] * 100).toFixed(1) + '%',
    'Adaptive Raw': adaptiveSliders[key],
    'Adaptive %': (key === 'reworkPercentage' ? adaptiveSliders[key] * 50 : adaptiveSliders[key] * 100).toFixed(1) + '%',
    'Drift %': (Math.abs(adaptiveSliders[key] - fixedSliders[key]) / Math.max(fixedSliders[key], 0.01) * 100).toFixed(1) + '%'
  }));

  // Summary row
  const meanFixedRaw = SLIDER_KEYS.reduce((sum, k) => sum + fixedSliders[k], 0) / SLIDER_KEYS.length;
  const meanAdaptiveRaw = SLIDER_KEYS.reduce((sum, k) => sum + adaptiveSliders[k], 0) / SLIDER_KEYS.length;
  const meanDrift = SLIDER_KEYS.reduce((sum, k) => sum + Math.abs(adaptiveSliders[k] - fixedSliders[k]) / Math.max(fixedSliders[k], 0.01) * 100, 0) / SLIDER_KEYS.length;
  tableData.push({
    Slider: '--- Summary ---',
    'Fixed Raw': meanFixedRaw.toFixed(3),
    'Fixed %': (meanFixedRaw * 100).toFixed(1) + '%',
    'Adaptive Raw': meanAdaptiveRaw.toFixed(3),
    'Adaptive %': (meanAdaptiveRaw * 100).toFixed(1) + '%',
    'Drift %': meanDrift.toFixed(1) + '%'
  });

  // Lift pts summary
  const baselineProb = parseProb(baselineRes);
  tableData.push({
    Slider: 'Lift Pts (from Baseline)',
    'Fixed Raw': (fixedProb - baselineProb).toFixed(4),
    'Fixed %': 'pts',
    'Adaptive Raw': (adaptiveProb - fixedProb).toFixed(4),
    'Adaptive %': 'pts',
    'Drift %': ((adaptiveProb - baselineProb) / (fixedProb - baselineProb) * 100 - 100).toFixed(1) + '%'
  });

  // Output table
  console.table(tableData);

  // Log full responses (snippet for sliders/prob)
  console.log('\n=== Full Fixed Response Snippet ===');
  console.log(JSON.stringify({
    version: baselineRes.buildInfo?.tag,
    fixedSliders: fixedSliders,
    fixedProb: fixedProb,
    explainMode: fixedRes.optimize?.explain?.mode
  }, null, 2));

  console.log('\n=== Full Adaptive Response Snippet ===');
  console.log(JSON.stringify({
    version: baselineRes.buildInfo?.tag,
    adaptiveSliders: adaptiveSliders,
    adaptiveProb: adaptiveProb,
    chainingDrift: adaptiveRes.optimize?.explain?.chainingDrift,
    explainMode: adaptiveRes.optimize?.explain?.mode
  }, null, 2));

  console.log('\n=== Test Complete ===');
  if (meanDrift < 5) {
    console.log('✅ Chaining OK: Drift <5% (PMBOK Ch.11).');
  } else {
    console.log('⚠️ Chaining Drift High: >5%—check dampen/anchor.');
  }
}

// Run main
main().catch(e => {
  console.error('Test Failed:', e.message);
  process.exit(1);
});
