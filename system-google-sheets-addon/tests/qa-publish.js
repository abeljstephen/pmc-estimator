#!/usr/bin/env node
// File: tests/qa-publish.js
// QA Gate Script — Pre-Publish Validation Pipeline
// Runs static analysis, unit/integration tests, and pre-flight checks before deploying.
// Usage: node tests/qa-publish.js [--dry-run]

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ────────────────────────────────────────────────
// CONFIG
// ────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const EXPECTED_OAUTH_SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/script.container.ui',
  'https://www.googleapis.com/auth/spreadsheets',
];

// Credential file patterns that must NOT be pushed
const CREDENTIAL_PATTERNS = [
  /\.env$/i,
  /credentials\.json$/i,
  /service[-_]?account.*\.json$/i,
  /private[-_]?key/i,
  /\.pem$/i,
  /\.p12$/i,
];

// Known intentional duplicates (function/var name → minimum expected count)
// These exist in multiple .gs files by design and are tolerated.
const KNOWN_COLLISIONS = {
  clamp01: 5,
  pct: 3,
  LANCZOS_COEFFS: 2,
  SLIDER_KEYS: 2,
  W_MEAN: 2,
  alignPoints: 2,
  asArray: 2,
  asPointsArray: 2,
  betaPdf: 2,
  betaSample: 2,
  computeBetaMoments: 2,
  gammaSample: 2,
  isValidCdfArray: 2,
  isValidPdfArray: 2,
  logGamma: 2,
  mean: 2,
  renormalizePdf: 2,
  testCoreCall: 2,
  trapezoidArea: 2,
};

// ────────────────────────────────────────────────
// ANSI colors
// ────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function pass(msg) { console.log(`  ${C.green}✓${C.reset} ${msg}`); }
function fail(msg) { console.log(`  ${C.red}✗${C.reset} ${msg}`); }
function warn(msg) { console.log(`  ${C.yellow}⚠${C.reset} ${msg}`); }
function header(msg) { console.log(`\n${C.bold}${C.cyan}${msg}${C.reset}`); }

// ────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────

/** Recursively find all .gs files under PROJECT_ROOT, excluding archive/backup dirs */
function findGsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip archive, node_modules, .git, and timestamped backup files
      if (/^(archive|node_modules|\.git|SAFE)$/i.test(entry.name)) continue;
      results.push(...findGsFiles(full));
    } else if (entry.name.endsWith('.gs') && !/_\d{8}_/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

/** Extract global declarations from a .gs file */
function extractGlobals(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const globals = [];
  const re = /^(?:function|var|const|let)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/gm;
  let m;
  while ((m = re.exec(content)) !== null) {
    globals.push(m[1]);
  }
  return globals;
}

// ────────────────────────────────────────────────
// PHASE 1: STATIC ANALYSIS
// ────────────────────────────────────────────────
function phase1_staticAnalysis() {
  header('Phase 1: Static Analysis');
  let errors = 0;

  // 1a. Find all .gs files
  const gsFiles = findGsFiles(PROJECT_ROOT);
  pass(`Found ${gsFiles.length} .gs files`);

  // 1b. Check for global name collisions
  const symbolMap = {}; // name → [file, file, ...]
  for (const f of gsFiles) {
    const rel = path.relative(PROJECT_ROOT, f);
    for (const name of extractGlobals(f)) {
      if (!symbolMap[name]) symbolMap[name] = [];
      symbolMap[name].push(rel);
    }
  }

  const collisions = Object.entries(symbolMap).filter(([, files]) => files.length > 1);
  let unknownCollisions = 0;
  for (const [name, files] of collisions) {
    if (KNOWN_COLLISIONS[name] && files.length <= KNOWN_COLLISIONS[name]) {
      // Known and within expected count — skip
      continue;
    }
    if (KNOWN_COLLISIONS[name]) {
      warn(`Collision "${name}" in ${files.length} files (expected ≤${KNOWN_COLLISIONS[name]}): ${files.join(', ')}`);
    } else {
      fail(`NEW collision: "${name}" defined in ${files.length} files: ${files.join(', ')}`);
    }
    unknownCollisions++;
  }
  if (unknownCollisions === 0) {
    pass(`No unexpected global name collisions (${collisions.length} known, whitelisted)`);
  } else {
    errors += unknownCollisions;
  }

  // 1c. Verify OAuth scopes in appsscript.json
  const manifestPath = path.join(PROJECT_ROOT, 'appsscript.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const scopes = manifest.oauthScopes || [];
    const missing = EXPECTED_OAUTH_SCOPES.filter(s => !scopes.includes(s));
    const extra = scopes.filter(s => !EXPECTED_OAUTH_SCOPES.includes(s));
    if (missing.length === 0 && extra.length === 0) {
      pass(`OAuth scopes match (${scopes.length} scopes)`);
    } else {
      if (missing.length) { fail(`Missing OAuth scopes: ${missing.join(', ')}`); errors++; }
      if (extra.length) { warn(`Extra OAuth scopes: ${extra.join(', ')}`); }
    }
  } else {
    fail('appsscript.json not found'); errors++;
  }

  // 1d. Check for credential files in push scope
  const allFiles = [];
  function walkAll(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (/^(archive|node_modules|\.git|SAFE)$/i.test(entry.name)) continue;
        walkAll(full);
      } else {
        allFiles.push(full);
      }
    }
  }
  walkAll(PROJECT_ROOT);

  let credentialsFound = 0;
  for (const f of allFiles) {
    const rel = path.relative(PROJECT_ROOT, f);
    for (const pat of CREDENTIAL_PATTERNS) {
      if (pat.test(rel)) {
        fail(`Credential file in push scope: ${rel}`);
        credentialsFound++;
        break;
      }
    }
  }
  if (credentialsFound === 0) {
    pass('No credential files found in push scope');
  } else {
    errors += credentialsFound;
  }

  // 1e. Check HEADERS length matches expected columns (23)
  const codeGsPath = path.join(PROJECT_ROOT, 'Code.gs');
  if (fs.existsSync(codeGsPath)) {
    const codeContent = fs.readFileSync(codeGsPath, 'utf8');
    const headersMatch = codeContent.match(/(?:var|const|let)\s+HEADERS\s*=\s*\[([\s\S]*?)\];/);
    if (headersMatch) {
      const headerEntries = headersMatch[1].split(',').filter(e => e.trim().length > 0 && e.trim().startsWith("'"));
      if (headerEntries.length === 23) {
        pass(`HEADERS array has 23 entries`);
      } else {
        fail(`HEADERS array has ${headerEntries.length} entries (expected 23)`);
        errors++;
      }
    } else {
      warn('Could not parse HEADERS array from Code.gs');
    }
  }

  return errors;
}

// ────────────────────────────────────────────────
// PHASE 2: UNIT + INTEGRATION TESTS
// ────────────────────────────────────────────────
function phase2_unitTests() {
  header('Phase 2: Unit + Integration Tests');
  const qaLocalPath = path.join(__dirname, 'qa-local.js');

  if (!fs.existsSync(qaLocalPath)) {
    fail('tests/qa-local.js not found');
    return 1;
  }

  try {
    const output = execSync(`node "${qaLocalPath}"`, {
      cwd: PROJECT_ROOT,
      encoding: 'utf8',
      timeout: 120000,
      maxBuffer: 50 * 1024 * 1024, // 50MB — qa-local.js produces verbose output
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Extract summary line (e.g., "ALL TESTS PASSED" or "FAILED")
    const lines = output.trim().split('\n');
    const summaryLine = lines.find(l => /ALL TESTS PASSED|FAILED/.test(l)) || lines[lines.length - 1];
    pass(`qa-local.js: ${summaryLine.trim()}`);
    return 0;
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    const lines = output.trim().split('\n');
    // Show last 10 lines for context
    const tail = lines.slice(-10).join('\n    ');
    fail(`qa-local.js failed (exit code ${err.status}):\n    ${tail}`);
    return 1;
  }
}

// ────────────────────────────────────────────────
// PHASE 3: PRE-FLIGHT CHECKS
// ────────────────────────────────────────────────
function phase3_preflight() {
  header('Phase 3: Pre-flight Checks');

  if (DRY_RUN) {
    console.log(`  ${C.dim}(skipped — dry run)${C.reset}`);
    return 0;
  }

  let errors = 0;

  // 3a. Check .clasp.json
  const claspPath = path.join(PROJECT_ROOT, '.clasp.json');
  if (fs.existsSync(claspPath)) {
    const clasp = JSON.parse(fs.readFileSync(claspPath, 'utf8'));
    if (clasp.scriptId && clasp.scriptId.length > 10) {
      pass(`.clasp.json has valid scriptId`);
    } else {
      fail('.clasp.json missing or invalid scriptId'); errors++;
    }
  } else {
    fail('.clasp.json not found'); errors++;
  }

  // 3b. Check clasp CLI installed
  try {
    execSync('which clasp', { encoding: 'utf8', stdio: 'pipe' });
    pass('clasp CLI is installed');
  } catch {
    fail('clasp CLI not found — install with: npm install -g @google/clasp');
    errors++;
  }

  // 3c. Check clasp login status
  try {
    execSync('clasp login --status', { encoding: 'utf8', stdio: 'pipe', timeout: 10000 });
    pass('clasp login active');
  } catch {
    warn('clasp login status check failed — you may need to run: clasp login');
  }

  return errors;
}

// ────────────────────────────────────────────────
// PHASE 4: REPORT
// ────────────────────────────────────────────────
function run() {
  console.log(`${C.bold}╔══════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}║  PMC Estimator — QA Gate (Pre-Publish)       ║${C.reset}`);
  console.log(`${C.bold}╚══════════════════════════════════════════════╝${C.reset}`);
  if (DRY_RUN) console.log(`${C.dim}  Mode: --dry-run (skipping clasp checks)${C.reset}`);

  const results = {};
  results['Static Analysis'] = phase1_staticAnalysis();
  results['Unit Tests'] = phase2_unitTests();
  results['Pre-flight'] = phase3_preflight();

  // Summary
  header('Summary');
  let totalErrors = 0;
  for (const [phase, errCount] of Object.entries(results)) {
    totalErrors += errCount;
    if (errCount === 0) {
      pass(`${phase}: PASSED`);
    } else {
      fail(`${phase}: FAILED (${errCount} error${errCount > 1 ? 's' : ''})`);
    }
  }

  console.log('');
  if (totalErrors === 0) {
    console.log(`${C.bold}${C.green}ALL CHECKS PASSED — safe to publish${C.reset}`);
    process.exit(0);
  } else {
    console.log(`${C.bold}${C.red}${totalErrors} ERROR(S) — fix before publishing${C.reset}`);
    process.exit(1);
  }
}

run();
