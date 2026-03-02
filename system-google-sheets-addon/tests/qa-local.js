#!/usr/bin/env node
/**
 * QA Local Test Harness for PMC Estimator
 * Tests all pure logic functions against the 11-row QA dataset
 * Run: node tests/qa-local.js
 */

// ============================================================
// 1. SHIMS — Minimal stubs for Apps Script globals
// ============================================================
globalThis.Logger = { log: (...a) => {} }; // suppress Logger.log noise
globalThis.SpreadsheetApp = { flush: () => {} };
globalThis.Utilities = { formatDate: () => new Date().toISOString() };
globalThis.Session = { getScriptTimeZone: () => 'America/Los_Angeles' };

// ============================================================
// 2. LOAD ALL .gs FILES (global scope — mirrors Apps Script)
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const context = vm.createContext(globalThis);

// Load order matters: helpers first, then baseline, reshaping, optimization, main, Code.gs
const loadOrder = [
  // Code.gs first — defines SLIDER_KEYS, CFG, HEADERS, and utility functions
  'Code.gs',
  // Helpers
  'core/helpers/rng.js',
  'core/helpers/validation.gs',
  'core/helpers/metrics.gs',
  // Baseline
  'core/baseline/utilis.gs',
  'core/baseline/triangle-points.gs',
  'core/baseline/pert-points.gs',
  'core/baseline/beta-points.gs',
  'core/baseline/monte-carlo-raw.gs',
  'core/baseline/monte-carlo-smoothed.gs',
  'core/baseline/coordinator.gs',
  // Optimization
  'core/optimization/matrix-utils.gs',
  'core/optimization/kl-divergence.gs',
  'core/optimization/sensitivity-analysis.gs',
  'core/optimization/optimizer.gs',
  // Reshaping
  'core/reshaping/copula-utils.gs',
  'core/reshaping/slider-normalization.gs',
  'core/reshaping/slider-adjustments.gs',
  'core/reshaping/outcome-summary.gs',
  // Reports & Visuals
  'core/report/playbooks.gs',
  'core/report/reshaping_report.gs',
  'core/visuals/annotations.gs',
  'core/visuals/heatmap-data.gs',
  'core/visuals/sankey-flow.gs',
  // Adapter & Main
  'core/variable_map/adapter.gs',
  'core/main/main.gs',
];

let loadErrors = [];
for (const rel of loadOrder) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) {
    loadErrors.push(`MISSING: ${rel}`);
    continue;
  }
  try {
    const src = fs.readFileSync(full, 'utf8');
    vm.runInContext(src, context, { filename: rel });
  } catch (e) {
    loadErrors.push(`LOAD ERROR in ${rel}: ${e.message}`);
  }
}

// ============================================================
// 3. TEST FRAMEWORK
// ============================================================
let passed = 0, failed = 0, errors = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    errors.push({ name, error: e.message });
    console.log(`  ✗ ${name}: ${e.message}`);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertClose(actual, expected, tolerance, msg) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${msg || 'assertClose'}: expected ~${expected}, got ${actual} (tolerance=${tolerance})`);
  }
}

// ============================================================
// 4. QA TEST DATA
// ============================================================
const QA_ROWS = [
  { name: 'Project_1 (Symmetrical_Distribution)',    best: 10,    most: 20,   worst: 30 },
  { name: 'Project_2 (Highly_Skewed_Distribution)',   best: 10,    most: 15,   worst: 50 },
  { name: 'Project_3 (High_Variability)',             best: 5,     most: 20,   worst: 50 },
  { name: 'Project_4 (Invalid_Order)',                best: 10,    most: 10,   worst: 11 },
  { name: 'Project_5 (Narrow_Range)',                 best: 10,    most: 11,   worst: 12 },
  { name: 'Project_6 (Non_Numeric)',                  best: 'abc', most: 20,   worst: 30 },
  { name: '',                                         best: 5,     most: 15,   worst: 25 },
  { name: 'Project_8',                                best: 5,     most: 6,    worst: 30 },
  { name: 'Project_9',                                best: 1,     most: 5,    worst: 100 },
  { name: 'Project_10',                               best: 1,     most: 2,    worst: 3 },
  { name: 'Project_11',                               best: 1800,  most: 2400, worst: 3000 },
];

// ============================================================
// 5. RUN TESTS
// ============================================================
console.log('\n========================================');
console.log('  PMC ESTIMATOR — LOCAL QA TEST SUITE');
console.log('========================================\n');

// --- Load Status ---
console.log('MODULE LOADING:');
if (loadErrors.length === 0) {
  console.log(`  ✓ All ${loadOrder.length} modules loaded successfully\n`);
} else {
  loadErrors.forEach(e => console.log(`  ✗ ${e}`));
  console.log('');
}

// --- Section A: Input Parsing (num / isNumber) ---
console.log('A. INPUT PARSING (num / isNumber)');
test('num(10) = 10', () => assert(context.num(10) === 10));
test('num("20") = 20', () => assert(context.num('20') === 20));
test('num("abc") = null', () => assert(context.num('abc') === null));
test('num("") = null', () => assert(context.num('') === null));
test('num(null) = null', () => assert(context.num(null) === null));
test('num(undefined) = null', () => assert(context.num(undefined) === null));
test('num("$1,234") = 1234', () => assert(context.num('$1,234') === 1234));
test('num(0) = 0', () => assert(context.num(0) === 0));
test('num(-5) = -5', () => assert(context.num(-5) === -5));
test('isNumber(10) = true', () => assert(context.isNumber(10) === true));
test('isNumber(null) = false', () => assert(context.isNumber(null) === false));
test('isNumber(NaN) = false', () => assert(context.isNumber(NaN) === false));
test('isNumber(Infinity) = false', () => assert(context.isNumber(Infinity) === false));

// --- Section B: PERT Mean Calculation ---
console.log('\nB. PERT MEAN CALCULATION (O + 4M + P) / 6');
const pertExpected = [
  { name: 'Project_1', O: 10, M: 20, P: 30, pert: 20.0 },
  { name: 'Project_2', O: 10, M: 15, P: 50, pert: 20.0 },
  { name: 'Project_3', O: 5,  M: 20, P: 50, pert: 22.5 },
  { name: 'Project_4', O: 10, M: 10, P: 11, pert: 10.1667 },
  { name: 'Project_5', O: 10, M: 11, P: 12, pert: 11.0 },
  { name: 'Project_8', O: 5,  M: 6,  P: 30, pert: 9.8333 },
  { name: 'Project_9', O: 1,  M: 5,  P: 100, pert: 20.1667 },
  { name: 'Project_10', O: 1, M: 2,  P: 3,   pert: 2.0 },
  { name: 'Project_11', O: 1800, M: 2400, P: 3000, pert: 2400.0 },
];
for (const t of pertExpected) {
  test(`PERT(${t.O}, ${t.M}, ${t.P}) ≈ ${t.pert}`, () => {
    const result = context.computePertMean_(t.O, t.M, t.P);
    assertClose(result, t.pert, 0.001, t.name);
  });
}
test('PERT(abc, 20, 30) = null', () => {
  assert(context.computePertMean_('abc', 20, 30) === null, 'Should return null for non-numeric');
});

// --- Section C: Estimate Validation ---
console.log('\nC. ESTIMATE VALIDATION (validateEstimates)');
test('(10, 20, 30) valid', () => assert(context.validateEstimates(10, 20, 30).valid === true));
test('(10, 10, 11) valid (equal O=M allowed)', () => assert(context.validateEstimates(10, 10, 11).valid === true));
test('(10, 11, 12) valid (narrow)', () => assert(context.validateEstimates(10, 11, 12).valid === true));
test('(1, 2, 3) valid (small)', () => assert(context.validateEstimates(1, 2, 3).valid === true));
test('(1800, 2400, 3000) valid (large)', () => assert(context.validateEstimates(1800, 2400, 3000).valid === true));
test('(30, 20, 10) INVALID (reversed)', () => assert(context.validateEstimates(30, 20, 10).valid === false));
test('(10, 5, 30) INVALID (M < O)', () => assert(context.validateEstimates(10, 5, 30).valid === false));
test('(NaN, 20, 30) INVALID', () => assert(context.validateEstimates(NaN, 20, 30).valid === false));
test('(10, 10, 10) valid (all equal)', () => assert(context.validateEstimates(10, 10, 10).valid === true));

// --- Section D: Slider Validation ---
console.log('\nD. SLIDER VALIDATION');
const validSliders01 = {
  budgetFlexibility: 0.25, scheduleFlexibility: 0.125,
  scopeCertainty: 0.9, scopeReductionAllowance: 0.25,
  reworkPercentage: 0.0, riskTolerance: 0.7, userConfidence: 0.775
};
test('Default sliders (0-1 range) pass validation', () => {
  assert(context.validateSliders(validSliders01).valid === true);
});
test('Null sliders fail', () => {
  assert(context.validateSliders(null).valid === false);
});
test('Missing key fails', () => {
  const partial = { budgetFlexibility: 0.5 };
  assert(context.validateSliders(partial).valid === false);
});

// --- Section E: to01FromUi Slider Conversion ---
console.log('\nE. SLIDER CONVERSION (to01FromUi)');
test('Budget 50% → 0.5', () => {
  const result = context.to01FromUi({ budgetFlexibility: 50, scheduleFlexibility: 0, scopeCertainty: 0, scopeReductionAllowance: 0, reworkPercentage: 0, riskTolerance: 0, userConfidence: 100 });
  assertClose(result.budgetFlexibility, 0.5, 0.001);
});
test('Rework 25 (UI) → 0.5 (0-1, max=50)', () => {
  const result = context.to01FromUi({ budgetFlexibility: 0, scheduleFlexibility: 0, scopeCertainty: 0, scopeReductionAllowance: 0, reworkPercentage: 25, riskTolerance: 0, userConfidence: 100 });
  assertClose(result.reworkPercentage, 0.5, 0.001);
});

// --- Section F: Data Row Filtering (getAllTasks simulation) ---
console.log('\nF. DATA ROW FILTERING (simulated getAllTasks logic)');
const processedRows = [];
const skippedRows = [];
for (let i = 0; i < QA_ROWS.length; i++) {
  const r = QA_ROWS[i];
  const name = (r.name != null && String(r.name).trim()) || '';
  if (!name) {
    skippedRows.push({ row: i + 2, reason: 'empty name', data: r });
    continue;
  }
  const O = typeof r.best === 'number' ? r.best : context.num(r.best);
  const M = typeof r.most === 'number' ? r.most : context.num(r.most);
  const P = typeof r.worst === 'number' ? r.worst : context.num(r.worst);
  if (context.isNumber(O) && context.isNumber(M) && context.isNumber(P)) {
    processedRows.push({ name, O, M, P, row: i + 2 });
  } else {
    skippedRows.push({ row: i + 2, reason: 'non-numeric values', name, data: r });
  }
}
test(`9 rows should be valid (got ${processedRows.length})`, () => assert(processedRows.length === 9));
test(`2 rows should be skipped (got ${skippedRows.length})`, () => assert(skippedRows.length === 2));
test('Project_6 (abc) is skipped', () => {
  assert(skippedRows.some(s => s.name === 'Project_6 (Non_Numeric)'), 'Project_6 should be skipped');
});
test('Empty name row is skipped', () => {
  assert(skippedRows.some(s => s.reason === 'empty name'), 'Empty name row should be skipped');
});

console.log('\n  Skipped rows detail:');
skippedRows.forEach(s => {
  console.log(`    Row ${s.row}: ${s.reason} — ${s.name || '(no name)'} [${s.data.best}, ${s.data.most}, ${s.data.worst}]`);
});

// --- Section G: Full processTask (end-to-end core logic) ---
console.log('\nG. FULL processTask (end-to-end core calculation)');
const processTaskResults = {};
for (const row of processedRows) {
  const taskInput = {
    task: row.name,
    optimistic: row.O,
    mostLikely: row.M,
    pessimistic: row.P,
    targetValue: (row.O + 4 * row.M + row.P) / 6, // target = PERT mean
    confidenceLevel: 0.95,
    optimize: true,
    optimizeFor: 'target',
    adaptive: true,
    probeLevel: 5,
    wantPoints: true,
    includeOptimizedPoints: true,
    sliderValues: {},
    maxPoints: 200
  };

  try {
    const result = context.processTask(taskInput);
    processTaskResults[row.name] = result;

    if (result.error) {
      test(`${row.name}: processTask → ERROR: ${result.error}`, () => { throw new Error(result.error); });
    } else {
      // Validate baseline
      const pert = result.baseline?.pert?.value;
      const ciL = result.baseline?.metrics?.monteCarloSmoothed?.ci?.lower;
      const ciU = result.baseline?.metrics?.monteCarloSmoothed?.ci?.upper;
      const baseProb = result.baseline?.probabilityAtPert?.value;
      const kl = result.baseline?.metrics?.klDivergenceToTriangle;
      const basePdf = result.baseline?.monteCarloSmoothed?.pdfPoints;
      const baseCdf = result.baseline?.monteCarloSmoothed?.cdfPoints;

      // Validate optimization
      const optBlock = result.optimize;
      const optSliders = optBlock?.sliders;
      const optProb = optBlock?.probabilityAtTarget?.value;
      const sensChange = optBlock?.metrics?.sensitivityChange;
      const optPdf = optBlock?.reshapedPoints?.pdfPoints;
      const optCdf = optBlock?.reshapedPoints?.cdfPoints;

      test(`${row.name}: PERT = ${pert?.toFixed(4)}`, () => {
        assert(Number.isFinite(pert), `PERT should be finite, got ${pert}`);
      });

      test(`${row.name}: CI [${ciL?.toFixed(2)}, ${ciU?.toFixed(2)}]`, () => {
        assert(Number.isFinite(ciL) && Number.isFinite(ciU), 'CI bounds should be finite');
        assert(ciL < ciU, `CI Lower (${ciL}) should be < CI Upper (${ciU})`);
        assert(ciL <= pert && pert <= ciU, `PERT (${pert}) should be within CI [${ciL}, ${ciU}]`);
      });

      test(`${row.name}: Baseline prob = ${baseProb?.toFixed(4)}`, () => {
        assert(Number.isFinite(baseProb), 'Baseline prob should be finite');
        assert(baseProb >= 0 && baseProb <= 1, `Baseline prob should be 0-1, got ${baseProb}`);
      });

      test(`${row.name}: KL divergence = ${kl != null ? kl.toFixed(6) : 'N/A'}`, () => {
        // KL can be undefined for some distributions
        if (kl !== undefined) {
          assert(Number.isFinite(kl), 'KL should be finite');
          assert(kl >= 0, `KL should be >= 0, got ${kl}`);
        }
      });

      test(`${row.name}: Baseline PDF has ${basePdf?.length || 0} points`, () => {
        assert(Array.isArray(basePdf) && basePdf.length >= 2, `PDF should have >= 2 points, got ${basePdf?.length}`);
      });

      test(`${row.name}: Baseline CDF has ${baseCdf?.length || 0} points`, () => {
        assert(Array.isArray(baseCdf) && baseCdf.length >= 2, `CDF should have >= 2 points, got ${baseCdf?.length}`);
      });

      test(`${row.name}: CDF is monotonically non-decreasing`, () => {
        for (let i = 1; i < baseCdf.length; i++) {
          assert(baseCdf[i].y >= baseCdf[i-1].y - 1e-10,
            `CDF violated monotonicity at index ${i}: ${baseCdf[i-1].y} → ${baseCdf[i].y}`);
        }
      });

      test(`${row.name}: Optimizer status = ${optBlock?.status}`, () => {
        assert(optBlock, 'Optimize block should exist');
        assert(['ok', 'error', 'manual', 'skipped'].includes(optBlock.status),
          `Unexpected status: ${optBlock.status}`);
      });

      if (optBlock?.status === 'ok' || optBlock?.status === 'manual') {
        test(`${row.name}: Opt sliders present`, () => {
          assert(optSliders && typeof optSliders === 'object', 'Sliders should be an object');
          const keys = Object.keys(optSliders);
          assert(keys.length > 0, 'Sliders should have keys');
        });

        test(`${row.name}: Opt prob = ${optProb?.toFixed(4)}`, () => {
          if (optProb !== undefined) {
            assert(Number.isFinite(optProb), `Opt prob should be finite, got ${optProb}`);
            assert(optProb >= 0 && optProb <= 1, `Opt prob should be 0-1, got ${optProb}`);
          }
        });

        test(`${row.name}: Opt PDF has ${optPdf?.length || 0} points`, () => {
          assert(Array.isArray(optPdf) && optPdf.length >= 2,
            `Opt PDF should have >= 2 points, got ${optPdf?.length}`);
        });

        test(`${row.name}: Opt CDF has ${optCdf?.length || 0} points`, () => {
          assert(Array.isArray(optCdf) && optCdf.length >= 2,
            `Opt CDF should have >= 2 points, got ${optCdf?.length}`);
        });

        test(`${row.name}: Sensitivity change = ${sensChange?.toFixed(6)}`, () => {
          if (sensChange !== undefined) {
            assert(Number.isFinite(sensChange), `Sensitivity change should be finite, got ${sensChange}`);
          }
        });
      }
    }
  } catch (e) {
    test(`${row.name}: processTask threw exception`, () => { throw e; });
  }
}

// --- Section H: Column Write Simulation ---
console.log('\nH. COLUMN WRITE SIMULATION (parseBaseline_ + parseOptimized_)');
for (const row of processedRows.slice(0, 3)) { // Test first 3 rows
  const result = processTaskResults[row.name];
  if (!result || result.error) continue;

  // Simulate what Code.gs does with callEstimatorAPI_ response
  // The response from pmcEstimatorAPI wraps in { results: [...] }
  const apiResponse = { results: [result] };
  const body = context.firstResult_(apiResponse);

  test(`${row.name}: firstResult_ extracts correctly`, () => {
    assert(body, 'firstResult_ should return non-null');
    assert(body.baseline, 'Should have baseline');
  });

  const baseParsed = context.parseBaseline_(body);
  test(`${row.name}: parseBaseline_ extracts PERT=${baseParsed.pert?.toFixed(4)}`, () => {
    assert(context.isNumber(baseParsed.pert), `PERT should be numeric, got ${baseParsed.pert}`);
  });
  test(`${row.name}: parseBaseline_ extracts CI`, () => {
    assert(context.isNumber(baseParsed.ciL), `ciL should be numeric, got ${baseParsed.ciL}`);
    assert(context.isNumber(baseParsed.ciU), `ciU should be numeric, got ${baseParsed.ciU}`);
  });
  test(`${row.name}: parseBaseline_ extracts baseProb`, () => {
    assert(context.isNumber(baseParsed.baseProb), `baseProb should be numeric, got ${baseParsed.baseProb}`);
  });
  test(`${row.name}: parseBaseline_ extracts PDF (${baseParsed.basePDF?.length} pts)`, () => {
    assert(baseParsed.basePDF.length > 0, 'Should have PDF points');
  });

  const optParsed = context.parseOptimized_(body);
  test(`${row.name}: parseOptimized_ extracts sliders`, () => {
    if (body.optimize?.status === 'ok' || body.optimize?.status === 'manual') {
      assert(optParsed.sliders && Object.keys(optParsed.sliders).length > 0,
        `Should have slider values, got ${JSON.stringify(optParsed.sliders)}`);
    }
  });
}

// ============================================================
// 6. SUMMARY
// ============================================================
console.log('\n========================================');
console.log('  RESULTS SUMMARY');
console.log('========================================');
console.log(`  Total:  ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
if (errors.length > 0) {
  console.log('\n  FAILURES:');
  errors.forEach(e => console.log(`    ✗ ${e.name}: ${e.error}`));
}
console.log('\n========================================');
console.log(failed === 0 ? '  ALL TESTS PASSED ✓' : `  ${failed} TEST(S) FAILED ✗`);
console.log('========================================\n');

process.exit(failed > 0 ? 1 : 0);
