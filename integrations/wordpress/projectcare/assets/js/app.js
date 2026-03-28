/**
 * ProjectCare by iCareNOW — Full UI Application (WordPress)
 * Depends on: window.PMCBaseline, window.PMCCopula, window.PMCOptimizer, window.PMCSACO
 * Depends on: Chart.js 4.x
 *
 * Architecture: single IIFE, all state in S, all DOM ids prefixed pmc-
 */
(function () {
  'use strict';

  // ── Helpers ──────────────────────────────────────────────────────────────
  const qs   = id => document.getElementById(id);
  const fmtP = v  => (v == null || !isFinite(v)) ? '–' : (v * 100).toFixed(2) + '%';
  const fmtN = (v, d) => (v == null || !isFinite(v)) ? '–' : Number(v).toFixed(d == null ? 2 : d);
  const clamp01 = v => Math.max(0, Math.min(1, v));
  const escHtml = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function interpY(pts, x) {
    if (!pts || pts.length < 2 || x == null || !isFinite(x)) return null;
    if (x <= pts[0].x) return pts[0].y;
    const n = pts.length;
    if (x >= pts[n-1].x) return pts[n-1].y;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo+hi)>>1; pts[m].x <= x ? lo=m : hi=m; }
    const p0=pts[lo], p1=pts[hi];
    const t = (x-p0.x)/(p1.x-p0.x||1e-10);
    const y = p0.y + t*(p1.y-p0.y);
    return isFinite(y) ? y : null;
  }
  function interpX(pts, y) {
    if (!pts || pts.length < 2 || y == null || !isFinite(y)) return null;
    if (y <= pts[0].y) return pts[0].x;
    const n = pts.length;
    if (y >= pts[n-1].y) return pts[n-1].x;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo+hi)>>1; pts[m].y <= y ? lo=m : hi=m; }
    const p0=pts[lo], p1=pts[hi];
    const t = (y-p0.y)/(p1.y-p0.y||1e-10);
    const x = p0.x + t*(p1.x-p0.x);
    return isFinite(x) ? x : null;
  }
  function percentile(pts, p) { return interpX(pts, p); }

  // ── State ────────────────────────────────────────────────────────────────
  const S = {
    tab: 'progress',   // 'progress' | 'overlay'
    mode: 'single',    // 'single' | 'group'
    targetMode: 'value', // 'value' | 'probability'

    O: null, M: null, P: null,
    target: null,
    taskName: '',

    // Series data
    triPdf: [], triCdf: [],
    betaPdf: [], betaCdf: [],
    basePdf: [], baseCdf: [],
    manPdf: [], manCdf: [],
    fixPdf: [], fixCdf: [],
    adpPdf: [], adpCdf: [],

    // Probabilities at target
    baseProb: null, manProb: null, fixProb: null, adpProb: null,

    // Optimal slider values from engine
    optSlidersFixed: null,
    optSlidersAdaptive: null,

    // Active series toggles
    seriesOn: { baseline: true, manual: false, fixed: false, adaptive: false },

    // Plot visibility
    showTri: true, showPdf: false, showCdf: false,
    overlayShowCdf: true, overlayShowPdf: false, overlayShowRadar: true,
    overlayShowSaco3d: false, overlayShowSphere: false, overlayShowHypercube3d: false,

    // Charts
    pdfChart: null, cdfChart: null, triChart: null, radarChart: null,

    // Task store
    tasks: [],
    selectedTaskId: null,
    groupSelected: new Set(),

    // Edit state
    editTaskId: null,
    csvParsed: null,

    // Target slider range
    tgtMin: null, tgtMax: null,

    // Slider values (unconstrained / manual)
    sliders: {
      budgetFlexibility: 0,
      scheduleFlexibility: 0,
      scopeCertainty: 0,
      scopeReductionAllowance: 0,
      reworkPercentage: 0,
      riskTolerance: 0,
      userConfidence: 100
    },

    // Historical context (Bayesian MCMC baseline)
    priorHistory: null,   // { n, meanOverrunFrac, stdOverrunFrac } or null

    // Run options (advanced controls)
    runOptions: {
      optimizeFor: 'target',  // 'target' | 'mean' | 'risk'
      klWeight:    70,         // 0–100 → higher = stricter baseline fidelity
      leash:       35,         // 0–100 → smaller = closer to user slider values
      probeLevel:  5,          // 1–7
      lambda:      4           // PERT mode weight
    },

    // Posterior stats from MCMC run (for display)
    posteriorStats: null
  };

  // ── Slider help content ───────────────────────────────────────────────────
  const SLIDER_HELP = {
    budgetFlexibility: {
      title: 'Budget Flexibility',
      body: '<p>Think of your current budget as 100%. Setting this to 10% means you believe you could realistically access an extra 10% more budget if the project needs it — not guaranteed, but a plausible contingency.</p><em>Example: Budget = $100K, slider = 15% → optimizer can consider up to $115K if needed.</em>'
    },
    scheduleFlexibility: {
      title: 'Schedule Flexibility',
      body: '<p>If your deadline is 20 days, setting this to 10% tells the optimizer you could absorb about 2 extra days without serious consequences.</p><em>Example: Deadline = 20 days, slider = 10% → optimizer can stretch to ~22 days if it improves success odds.</em>'
    },
    scopeCertainty: {
      title: 'Scope Certainty',
      body: '<p>100% means requirements are fully locked and understood. 60% means roughly 40% of scope is still uncertain — which directly widens your distribution.</p><em>Rule of thumb: Early discovery → 40–60%. Specification-complete → 80–90%.</em>'
    },
    scopeReductionAllowance: {
      title: 'Scope Reduction Allowance',
      body: '<p>If the project runs over, is there any scope that could be cut? 20% means you believe you could drop about 20% of deliverables in a crunch.</p><em>Example: Slider = 20% → optimizer can propose dropping up to 1 in 5 features to stay on target.</em>'
    },
    reworkPercentage: {
      title: 'Rework Percentage',
      body: '<p>What fraction of completed work typically needs to be done again? Rework multiplies your effective effort — the distribution shifts right as this increases.</p><em>Benchmarks: Mature teams 5–10% · Average teams 15–25% · High-change environments 25–40%.</em>'
    },
    riskTolerance: {
      title: 'Risk Tolerance',
      body: '<p>How conservative should the optimizer be? At 0% it only recommends changes that strongly reduce downside risk. At 100% it is willing to accept higher variance in exchange for a better expected result.</p><em>Guidance: Fixed-price or safety-critical → 20–30%. Internal agile → 60–70%.</em>'
    },
    userConfidence: {
      title: 'User Confidence',
      body: '<p>How much do you trust your own three-point estimates? At 100% the optimizer treats your values as reliable anchors. At lower values it allows the distribution to stretch to account for estimator bias.</p><em>Tip: If past projects routinely came in 20–30% over your Most Likely estimate, try 60–70%.</em>'
    }
  };

  // ── DOM refs (assigned after DOMContentLoaded) ───────────────────────────
  let pdfChart = null, cdfChart = null, triChart = null, radarChart = null;

  // ── Slider ID map ─────────────────────────────────────────────────────────
  const SLIDER_MAP = {
    budgetFlexibility:       'pmc-s-budget',
    scheduleFlexibility:     'pmc-s-schedule',
    scopeCertainty:          'pmc-s-scopecert',
    scopeReductionAllowance: 'pmc-s-scopered',
    reworkPercentage:        'pmc-s-rework',
    riskTolerance:           'pmc-s-risk',
    userConfidence:          'pmc-s-userconf'
  };

  // ── Chart colors ───────────────────────────────────────────────────────────
  const COLOR = {
    base:     '#10B981',
    manual:   '#059669',
    fixed:    '#6D28D9',
    adaptive: '#F59E0B',
    tri:      '#3B82F6',
    beta:     '#7C3AED'
  };

  // ════════════════════════════════════════════════════════════════════════
  //  INITIALIZATION
  // ════════════════════════════════════════════════════════════════════════
  function init() {
    loadTasksFromStorage();
    wireTabs();
    wireSeriesToggles();
    wireRunButton();
    wireModeToggle();
    wireTargetPanel();
    wireSliderPanel();
    wirePselBars();
    wireTaskModal();
    wireCsvModal();
    wireSliderHelp();
    wireReportTabs();
    wireGroupControls();
    wireRunOptions();
    wireHistoricalContext();
    updateGroupList();

    // Expose state for viz3d.js
    window.pmcState = S;

    // Initialize tab display (hides series toggles in progress tab, etc.)
    updateTabVisibility();

    // Pre-fill demo values (O=1, M=2, P=3) so the tool works immediately on load
    const oEl = qs('pmc-optimistic'), mEl = qs('pmc-most-likely'), pEl = qs('pmc-pessimistic');
    const nmEl = qs('pmc-task-name');
    if (oEl && !oEl.value) { oEl.value = 1; mEl.value = 2; pEl.value = 3; }
    if (nmEl && !nmEl.value) nmEl.value = 'Test';

    // Auto-run with demo values so charts and KPIs appear immediately
    setTimeout(() => {
      try { if (window.PMCSACO) runSingle(); } catch(e) { /* ignore auto-run errors */ }
    }, 200);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TABS
  // ════════════════════════════════════════════════════════════════════════
  function wireTabs() {
    document.querySelectorAll('#projectcare .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#projectcare .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        S.tab = tab.dataset.tab;
        updateTabVisibility();
      });
    });
  }

  function updateTabVisibility() {
    const isOverlay = S.tab === 'overlay';
    const overlayKpis = qs('pmc-overlay-kpis');
    const plotSelBar  = qs('pmc-plot-sel-bar');
    const oSelBar     = qs('pmc-overlay-sel-bar');
    const legendOv    = qs('pmc-legend-overlay');
    const legendDist  = qs('pmc-legend-distributions');
    const seriesTg    = qs('pmc-series-toggles');
    const distTiles   = qs('pmc-dist-tiles');

    if (overlayKpis) overlayKpis.style.display = isOverlay ? '' : 'none';
    if (plotSelBar)  plotSelBar.style.display   = isOverlay ? 'none' : '';
    if (oSelBar)     oSelBar.style.display      = isOverlay ? '' : 'none';
    if (legendOv)    legendOv.style.display     = isOverlay ? '' : 'none';
    if (legendDist)  legendDist.style.display   = isOverlay ? 'none' : '';
    if (seriesTg)    seriesTg.style.display     = isOverlay ? '' : 'none';
    if (distTiles)   distTiles.style.display    = isOverlay ? 'none' : '';

    updatePlotPanes();
    updateRadarVisibility();
    updateWhyResult();
    redrawAllCharts();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SERIES TOGGLES
  // ════════════════════════════════════════════════════════════════════════
  function wireSeriesToggles() {
    document.querySelectorAll('#projectcare .tg[data-series]').forEach(btn => {
      btn.setAttribute('aria-pressed', S.seriesOn[btn.dataset.series] ? 'true' : 'false');
      btn.addEventListener('click', () => {
        const s = btn.dataset.series;
        if (s === 'baseline') return; // baseline always on
        S.seriesOn[s] = !S.seriesOn[s];
        btn.setAttribute('aria-pressed', S.seriesOn[s] ? 'true' : 'false');
        updateOverlayKpiActive(s);
        redrawAllCharts();
        updateProbSummaryBar();
        updateSensitivity();
        updateRecBanner();
      });
    });
  }

  function updateOverlayKpiActive(series) {
    const kpiMap = { baseline: 'pmc-kpi-baseline', manual: 'pmc-kpi-adjusted', fixed: 'pmc-kpi-optimized', adaptive: 'pmc-kpi-adaptive' };
    const el = qs(kpiMap[series]);
    if (!el) return;
    el.classList.toggle('inactive', !S.seriesOn[series]);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  MODE TOGGLE (single / group)
  // ════════════════════════════════════════════════════════════════════════
  function wireModeToggle() {
    qs('pmc-mode-single').addEventListener('click', () => setMode('single'));
    qs('pmc-mode-group').addEventListener('click',  () => setMode('group'));
  }

  function setMode(mode) {
    S.mode = mode;
    qs('pmc-mode-single').classList.toggle('active', mode === 'single');
    qs('pmc-mode-group').classList.toggle('active',  mode === 'group');
    qs('pmc-single-inputs').style.display = mode === 'single' ? '' : 'none';
    qs('pmc-group-inputs').style.display  = mode === 'group'  ? '' : 'none';
    qs('pmc-est-single').style.display    = mode === 'single' ? '' : 'none';
    qs('pmc-est-group').style.display     = mode === 'group'  ? '' : 'none';
    qs('pmc-est-subtitle').textContent    = mode === 'single' ? 'Single task' : 'Group mode';
    updateGroupList();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  GROUP CONTROLS
  // ════════════════════════════════════════════════════════════════════════
  function wireGroupControls() {
    qs('pmc-grp-all').addEventListener('click',  () => { S.tasks.forEach(t => S.groupSelected.add(t.id)); updateGroupList(); });
    qs('pmc-grp-none').addEventListener('click', () => { S.groupSelected.clear(); updateGroupList(); });
    qs('pmc-grp-run').addEventListener('click',  () => runGroupEstimation());
  }

  function updateGroupList() {
    const list = qs('pmc-grp-list');
    const cnt  = qs('pmc-grp-count');
    if (!list) return;
    if (S.tasks.length === 0) {
      list.innerHTML = '<div style="padding:8px;color:var(--muted);font-size:11px;text-align:center;">No tasks yet. Add tasks below.</div>';
      if (cnt) cnt.textContent = '0 tasks';
      return;
    }
    list.innerHTML = S.tasks.map(t => {
      const chk = S.groupSelected.has(t.id) ? 'checked' : '';
      return `<div class="grp-task-row${S.groupSelected.has(t.id) ? ' grp-active' : ''}" data-id="${escHtml(t.id)}">
        <input type="checkbox" ${chk} style="cursor:pointer;" />
        <span class="grp-task-name">${escHtml(t.task_name)}</span>
        <span class="grp-task-omp">${fmtN(t.best_case,0)}/${fmtN(t.most_likely,0)}/${fmtN(t.worst_case,0)}</span>
      </div>`;
    }).join('');
    if (cnt) cnt.textContent = S.groupSelected.size + ' selected';

    list.querySelectorAll('.grp-task-row').forEach(row => {
      row.addEventListener('click', e => {
        const id = row.dataset.id;
        const chk = row.querySelector('input[type=checkbox]');
        if (S.groupSelected.has(id)) { S.groupSelected.delete(id); if(chk) chk.checked = false; row.classList.remove('grp-active'); }
        else                         { S.groupSelected.add(id);    if(chk) chk.checked = true;  row.classList.add('grp-active'); }
        if (cnt) cnt.textContent = S.groupSelected.size + ' selected';
      });
    });
  }

  function runGroupEstimation() {
    const selected = S.tasks.filter(t => S.groupSelected.has(t.id));
    if (selected.length === 0) { showError('Select at least one task.'); return; }

    showSpinner(true);
    setTimeout(() => {
      try {
        // Combine with Monte Carlo convolution
        const N = 5000;
        const combined = new Float64Array(N);
        selected.forEach(t => {
          const o = t.best_case, m = t.most_likely, p = t.worst_case;
          for (let i = 0; i < N; i++) {
            const u = Math.random();
            // Triangle CDF inverse
            const fc = (m - o) / (p - o);
            if (u < fc) combined[i] += o + Math.sqrt(u * (p - o) * (m - o));
            else        combined[i] += p - Math.sqrt((1 - u) * (p - o) * (p - m));
          }
        });

        // Build PDF/CDF from samples
        const sorted = Array.from(combined).sort((a, b) => a - b);
        const mn = sorted[0], mx = sorted[N-1];
        const bins = 100;
        const bw = (mx - mn) / bins;
        const hist = new Array(bins).fill(0);
        sorted.forEach(v => { const b = Math.min(bins-1, Math.floor((v-mn)/bw)); hist[b]++; });

        // Aggregate stats
        const mean = sorted.reduce((s, v) => s + v, 0) / N;
        const p50 = sorted[Math.floor(N * 0.5)];
        const p80 = sorted[Math.floor(N * 0.8)];
        const p90 = sorted[Math.floor(N * 0.9)];

        // Update estimates panel
        qs('pmc-agg-tasks').textContent = selected.length;
        qs('pmc-agg-mean').textContent  = fmtN(mean, 1);
        qs('pmc-agg-p50').textContent   = fmtN(p50, 1);
        qs('pmc-agg-p80').textContent   = fmtN(p80, 1);

        // Use O+M+P from first selected task for SACO
        const first = selected[0];
        S.O = first.best_case; S.M = first.most_likely; S.P = first.worst_case;
        S.taskName = selected.map(t => t.task_name).join(', ');

        qs('pmc-task-info').textContent = `Group: ${selected.length} tasks`;
        qs('pmc-agg-prob').textContent = '–';

        showSpinner(false);
        showError('');
        showResults();
        runSACO();
      } catch(e) {
        showSpinner(false);
        showError('Group run error: ' + e.message);
      }
    }, 20);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RUN BUTTON (single mode)
  // ════════════════════════════════════════════════════════════════════════
  function wireRunButton() {
    qs('pmc-run').addEventListener('click', runSingle);
    qs('pmc-optimistic').addEventListener('keydown',  e => { if(e.key==='Enter') runSingle(); });
    qs('pmc-most-likely').addEventListener('keydown', e => { if(e.key==='Enter') runSingle(); });
    qs('pmc-pessimistic').addEventListener('keydown', e => { if(e.key==='Enter') runSingle(); });
  }

  function runSingle() {
    const O = parseFloat(qs('pmc-optimistic').value);
    const M = parseFloat(qs('pmc-most-likely').value);
    const P = parseFloat(qs('pmc-pessimistic').value);
    const name = (qs('pmc-task-name').value || '').trim();

    if (isNaN(O) || isNaN(M) || isNaN(P)) { showError('Enter numeric values for O, M, and P.'); return; }
    if (!(O <= M && M <= P))               { showError('Values must satisfy O ≤ M ≤ P.'); return; }
    if (O === P)                           { showError('O and P must be different.'); return; }

    S.O = O; S.M = M; S.P = P;
    S.taskName = name || 'Task';

    // Update estimates panel
    qs('pmc-o-val').textContent   = fmtN(O, 2);
    qs('pmc-m-val').textContent   = fmtN(M, 2);
    qs('pmc-p-val').textContent   = fmtN(P, 2);
    const pert = (O + 4*M + P) / 6;
    qs('pmc-pert-val').textContent = fmtN(pert, 2);
    qs('pmc-task-info').textContent = name || 'Single task';

    showError('');
    showSpinner(true);
    setTimeout(() => {
      try {
        runSACO();
        showSpinner(false);
        showResults();
      } catch(e) {
        showSpinner(false);
        showError('Computation error: ' + e.message);
        console.error(e);
      }
    }, 20);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SACO ENGINE CALL
  // ════════════════════════════════════════════════════════════════════════
  function readSliders() {
    const sv = {};
    Object.entries(SLIDER_MAP).forEach(([key, id]) => {
      sv[key] = parseFloat(qs(id).value) || 0;
    });
    return sv;
  }

  function runSACO() {
    const O = S.O, M = S.M, P = S.P;
    const sliders = readSliders();

    if (!window.PMCSACO) throw new Error('SACO engine not loaded');

    const pertMean = (O + 4*M + P) / 6;
    const targetValue = S.target != null ? S.target : pertMean;
    const seed = Date.now();

    const ro = S.runOptions;
    const probeAdp = Math.max(1, Math.min(7, ro.probeLevel || 5));
    const probeFix = Math.max(1, Math.min(7, Math.max(1, probeAdp - 2)));

    // Base task definition (correct engine input names)
    const baseTask = {
      task:            S.taskName,
      optimistic:      O,
      mostLikely:      M,
      pessimistic:     P,
      targetValue:     targetValue,
      confidenceLevel: 0.95,
      optimize:        true,
      randomSeed:      seed,
      sliderValues:    sliders,   // UI units: 0-100 (rework 0-50)
      priorHistory:    S.priorHistory || undefined,  // Bayesian MCMC if set
      lambda:          ro.lambda || 4               // PERT mode weight
    };

    // Run 1: Conservative (adaptive COBYLA)
    const rAdp = window.PMCSACO.run(Object.assign({}, baseTask, { adaptive: true,  probeLevel: probeAdp }));

    // Run 2: General Optimization (fixed LHS only, lower probeLevel)
    const rFix = window.PMCSACO.run(Object.assign({}, baseTask, { adaptive: false, probeLevel: probeFix }));

    if (rAdp.error) throw new Error('Conservative run: ' + rAdp.error);

    // ── Extract series from conservative run (baseline + manual + adaptive) ──
    const ext = (obj, key) => normalizePoints(obj && obj[key] && obj[key].value ? obj[key].value : (obj && obj[key] ? obj[key] : []), true);
    const extCdf = (obj, key) => normalizePoints(obj && obj[key] && obj[key].value ? obj[key].value : (obj && obj[key] ? obj[key] : []), false);

    S.triPdf  = normalizePoints((rAdp.trianglePdf  && rAdp.trianglePdf.value)  || [], true);
    S.triCdf  = normalizePoints((rAdp.triangleCdf  && rAdp.triangleCdf.value)  || [], false);
    S.betaPdf = normalizePoints((rAdp.betaPertPdf  && rAdp.betaPertPdf.value)  || [], true);
    S.betaCdf = normalizePoints((rAdp.betaPertCdf  && rAdp.betaPertCdf.value)  || [], false);

    // Baseline = MC-smoothed original
    S.basePdf = normalizePoints((rAdp.targetProbabilityOriginalPdf && rAdp.targetProbabilityOriginalPdf.value) || [], true);
    S.baseCdf = normalizePoints((rAdp.targetProbabilityOriginalCdf && rAdp.targetProbabilityOriginalCdf.value) || [], false);

    // Manual/Unconstrained = adjusted (slider values applied)
    S.manPdf = normalizePoints((rAdp.targetProbabilityAdjustedPdf && rAdp.targetProbabilityAdjustedPdf.value) || [], true);
    S.manCdf = normalizePoints((rAdp.targetProbabilityAdjustedCdf && rAdp.targetProbabilityAdjustedCdf.value) || [], false);

    // Conservative = adaptive SACO optimized
    S.adpPdf = normalizePoints((rAdp.optimizedReshapedPoints && rAdp.optimizedReshapedPoints.pdfPoints) || [], true);
    S.adpCdf = normalizePoints((rAdp.optimizedReshapedPoints && rAdp.optimizedReshapedPoints.cdfPoints) || [], false);

    // General Opt = fixed LHS optimized (from second run)
    if (rFix && !rFix.error) {
      S.fixPdf = normalizePoints((rFix.optimizedReshapedPoints && rFix.optimizedReshapedPoints.pdfPoints) || [], true);
      S.fixCdf = normalizePoints((rFix.optimizedReshapedPoints && rFix.optimizedReshapedPoints.cdfPoints) || [], false);
    } else {
      S.fixPdf = S.adpPdf; S.fixCdf = S.adpCdf; // fallback
    }

    // ── Probabilities at target ──
    const tp = rAdp.targetProbability && rAdp.targetProbability.value || {};
    S.baseProb = tp.original  != null ? tp.original  : interpY(S.baseCdf, targetValue);
    S.manProb  = tp.adjusted  != null ? tp.adjusted  : interpY(S.manCdf,  targetValue);
    S.adpProb  = tp.adaptiveOptimized != null ? tp.adaptiveOptimized
                  : interpY(S.adpCdf, targetValue);

    const tpFix = rFix && !rFix.error && rFix.targetProbability && rFix.targetProbability.value || {};
    S.fixProb = (tpFix.adaptiveOptimized || tpFix.adjustedOptimized || tpFix.original)
                  ?? interpY(S.fixCdf, targetValue);

    // ── Optimal slider values in UI units (0-100) ──
    function sliders01ToUi(s01) {
      if (!s01 || typeof s01 !== 'object') return null;
      const out = {};
      const SCALE = { budgetFlexibility:100, scheduleFlexibility:100, scopeCertainty:100, scopeReductionAllowance:100, reworkPercentage:50, riskTolerance:100, userConfidence:100 };
      Object.entries(s01).forEach(([k, v]) => {
        const scale = SCALE[k] || 100;
        const n = Number(v);
        if (!isFinite(n)) return;
        // normalizeSliderBlock01 in engine already normalizes to 0-1
        out[k] = Math.round(n * scale);
      });
      return out;
    }
    S.optSlidersAdaptive = sliders01ToUi(rAdp.optimize && rAdp.optimize.sliders);
    S.optSlidersFixed    = sliders01ToUi(rFix && !rFix.error && rFix.optimize && rFix.optimize.sliders);

    // ── Set target and range ──
    if (S.target == null) S.target = targetValue;
    const allX = S.basePdf.map(p => p.x);
    if (allX.length) { S.tgtMin = Math.min(...allX); S.tgtMax = Math.max(...allX); }
    else             { S.tgtMin = O; S.tgtMax = P; }

    // Capture posterior stats from MCMC baseline (if applicable)
    S.posteriorStats = (rAdp && rAdp.posteriorStats) || null;

    updateKpiTiles();
    updateTargetSliderRange();
    updateProbSummaryBar();
    updateSliderOptimalMarkers();
    updateSensitivity();
    updateRecBanner();
    updateWhyResult();
    updateHistoricalBadge();
    redrawAllCharts();
    updateReportNarrative();
    updateStatsTable();
  }

  function normalizePoints(arr, isPdf) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const p of arr) {
      const x = Number(p?.x ?? p?.[0]); const y = Number(p?.y ?? p?.[1]);
      if (isFinite(x) && isFinite(y)) out.push({ x, y });
    }
    out.sort((a, b) => a.x - b.x);
    if (isPdf && out.length >= 2) {
      if (out[0].y !== 0)          out.unshift({ x: out[0].x - 0.001, y: 0 });
      if (out[out.length-1].y !==0) out.push({ x: out[out.length-1].x + 0.001, y: 0 });
    }
    return out;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  KPI TILES
  // ════════════════════════════════════════════════════════════════════════
  function updateKpiTiles() {
    const tiles = [
      { id: 'pmc-kpi-baseline', prob: S.baseProb, color: 'base' },
      { id: 'pmc-kpi-adaptive', prob: S.adpProb,  color: 'adaptive' },
      { id: 'pmc-kpi-optimized',prob: S.fixProb,  color: 'optimized' },
      { id: 'pmc-kpi-adjusted', prob: S.manProb,  color: 'adjusted' }
    ];
    tiles.forEach(({ id, prob }) => {
      const el = qs(id);
      if (!el) return;
      const val = el.querySelector('.val');
      if (val) val.textContent = fmtP(prob);
      el.classList.remove('inactive');
      el.classList.add('glow');
      setTimeout(() => el.classList.remove('glow'), 700);
    });

    // Dist tiles (How It's Built tab — always show PERT mean)
    const pertMean = S.O != null ? (S.O + 4*S.M + S.P) / 6 : null;
    const distKpiBase = qs('pmc-kpi-base-dist');
    if (distKpiBase) distKpiBase.querySelector('.val').textContent = fmtN(pertMean, 1);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  PROBABILITY SUMMARY BAR
  // ════════════════════════════════════════════════════════════════════════
  function updateProbSummaryBar() {
    const bar = qs('pmc-prob-summary-bar');
    if (!bar) return;
    if (S.target == null || S.baseCdf.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = '';

    const tau = S.target;
    qs('psb-tau').textContent  = 'τ = ' + fmtN(tau, 2);
    qs('psb-base').textContent = 'Baseline: ' + fmtP(S.baseProb);

    const adaptiveEl = qs('psb-adaptive');
    const fixedEl    = qs('psb-fixed');
    const manualEl   = qs('psb-manual');

    if (adaptiveEl) { adaptiveEl.style.display = S.seriesOn.adaptive ? '' : 'none'; adaptiveEl.textContent = 'Conservative: ' + fmtP(S.adpProb); }
    if (fixedEl)    { fixedEl.style.display    = S.seriesOn.fixed    ? '' : 'none'; fixedEl.textContent    = 'General: '      + fmtP(S.fixProb); }
    if (manualEl)   { manualEl.style.display   = S.seriesOn.manual   ? '' : 'none'; manualEl.textContent   = 'Unconstrained: '+ fmtP(S.manProb); }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TARGET PANEL
  // ════════════════════════════════════════════════════════════════════════
  function wireTargetPanel() {
    const modeSelect = qs('pmc-tgt-mode');
    const slider     = qs('pmc-target-slider');
    if (modeSelect) modeSelect.addEventListener('change', () => {
      S.targetMode = modeSelect.value;
      updateTargetPanelDisplay();
    });
    if (slider) slider.addEventListener('input', () => onTargetSliderInput());
  }

  function updateTargetSliderRange() {
    const slider = qs('pmc-target-slider');
    if (!slider || S.tgtMin == null) return;

    if (S.targetMode === 'value') {
      const pad = (S.tgtMax - S.tgtMin) * 0.1;
      slider.min = S.tgtMin - pad;
      slider.max = S.tgtMax + pad;
      slider.step = (S.tgtMax - S.tgtMin) / 200;
      slider.value = S.target != null ? S.target : (S.tgtMin + S.tgtMax) / 2;
    } else {
      slider.min = 1; slider.max = 99; slider.step = 1;
      slider.value = S.target != null ? Math.round(interpY(S.baseCdf, S.target) * 100) || 50 : 50;
    }
    updateTargetPanelDisplay();
  }

  function onTargetSliderInput() {
    const v = parseFloat(qs('pmc-target-slider').value);
    if (S.targetMode === 'value') {
      S.target = v;
      // Recompute probabilities without re-running SACO
      S.baseProb = interpY(S.baseCdf, v);
      S.manProb  = interpY(S.manCdf,  v);
      S.fixProb  = interpY(S.fixCdf,  v);
      S.adpProb  = interpY(S.adpCdf,  v);
    } else {
      const prob = v / 100;
      S.target = interpX(S.baseCdf, prob);
      S.baseProb = prob;
      S.manProb  = interpY(S.manCdf, S.target);
      S.fixProb  = interpY(S.fixCdf, S.target);
      S.adpProb  = interpY(S.adpCdf, S.target);
    }
    updateTargetPanelDisplay();
    updateProbSummaryBar();
    updateKpiTiles();
    redrawAllCharts();
  }

  function updateTargetPanelDisplay() {
    const isValue = S.targetMode === 'value';
    const tgtValDisp  = qs('pmc-tgt-val-display');
    const tgtProbDisp = qs('pmc-tgt-prob-display');
    const sentValue   = qs('pmc-tgt-sent-value');
    const sentProb    = qs('pmc-tgt-sent-prob');
    const valChip     = qs('pmc-target-val-chip');
    const probChip    = qs('pmc-target-prob-chip');
    const resultProb  = qs('pmc-tgt-result-prob');
    const resultVal   = qs('pmc-tgt-result-val');
    const ctx         = qs('pmc-tgt-context');

    if (tgtValDisp)  tgtValDisp.classList.toggle('active',  isValue);
    if (tgtProbDisp) tgtProbDisp.classList.toggle('active', !isValue);
    if (sentValue)   sentValue.classList.toggle('active',  isValue);
    if (sentProb)    sentProb.classList.toggle('active',  !isValue);

    if (isValue) {
      if (valChip)    valChip.textContent   = S.target != null ? fmtN(S.target, 2) : '–';
      if (resultProb) resultProb.textContent = fmtP(S.baseProb);
    } else {
      if (probChip)   probChip.textContent  = S.baseProb != null ? fmtP(S.baseProb) : '–';
      if (resultVal)  resultVal.textContent = S.target != null ? fmtN(S.target, 2) : '–';
    }

    if (ctx && S.O != null) {
      const pert = (S.O + 4*S.M + S.P) / 6;
      const dist = S.target != null ? S.target - pert : null;
      ctx.textContent = `PERT mean: ${fmtN(pert, 2)}` + (dist != null ? ` · Δ from mean: ${dist >= 0 ? '+' : ''}${fmtN(dist, 2)}` : '');
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SLIDER PANEL
  // ════════════════════════════════════════════════════════════════════════
  function wireSliderPanel() {
    // Sync range ↔ number inputs
    Object.entries(SLIDER_MAP).forEach(([key, baseId]) => {
      const rangeEl = qs(baseId + '-range');
      const numEl   = qs(baseId);
      if (!rangeEl || !numEl) return;

      rangeEl.addEventListener('input', () => {
        numEl.value = rangeEl.value;
        S.sliders[key] = parseFloat(rangeEl.value) || 0;
        onSliderChange();
      });
      numEl.addEventListener('input', () => {
        const v = Math.max(+numEl.min||0, Math.min(+numEl.max||100, parseFloat(numEl.value)||0));
        numEl.value = v;
        rangeEl.value = v;
        S.sliders[key] = v;
        onSliderChange();
      });
    });

    const resetBtn   = qs('pmc-reset-sliders');
    const matchBtn   = qs('pmc-match-optimized');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      Object.entries(SLIDER_MAP).forEach(([key, id]) => {
        const v = key === 'userConfidence' ? 100 : 0;
        const numEl = qs(id), rangeEl = qs(id + '-range');
        if (numEl)   numEl.value   = v;
        if (rangeEl) rangeEl.value = v;
        S.sliders[key] = v;
      });
      onSliderChange();
    });
    if (matchBtn) matchBtn.addEventListener('click', () => {
      if (!S.optSlidersFixed) return;
      Object.entries(SLIDER_MAP).forEach(([key, id]) => {
        const v = S.optSlidersFixed[key] != null ? S.optSlidersFixed[key] : (key === 'userConfidence' ? 100 : 0);
        const numEl = qs(id), rangeEl = qs(id + '-range');
        if (numEl)   numEl.value   = v;
        if (rangeEl) rangeEl.value = v;
        S.sliders[key] = v;
      });
      onSliderChange();
    });
  }

  function onSliderChange() {
    if (S.O == null) return;
    // Re-run unconstrained/manual with new slider values
    showSpinner(true);
    setTimeout(() => {
      try {
        runSACO();
        showSpinner(false);
      } catch(e) {
        showSpinner(false);
      }
    }, 20);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RUN OPTIONS POPOVER
  // ════════════════════════════════════════════════════════════════════════
  function wireRunOptions() {
    const btn     = qs('pmc-run-opts-btn');
    const popover = qs('pmc-run-opts-popover');
    const closeBtn= qs('pmc-run-opts-close');
    const runBtn  = qs('pmc-run-opts-run');
    const klEl    = qs('pmc-ropt-kl');
    const leashEl = qs('pmc-ropt-leash');
    const probeEl = qs('pmc-ropt-probe');

    if (!btn || !popover) return;

    btn.addEventListener('click', () => {
      popover.style.display = popover.style.display === 'none' ? '' : 'none';
    });
    if (closeBtn) closeBtn.addEventListener('click', () => { popover.style.display = 'none'; });
    if (runBtn)   runBtn.addEventListener('click', () => {
      popover.style.display = 'none';
      readRunOptions();
      if (S.O != null) { showSpinner(true); setTimeout(() => { try { runSACO(); showSpinner(false); } catch(e) { showSpinner(false); } }, 20); }
    });

    // Live value display
    if (klEl) { klEl.addEventListener('input', () => { qs('pmc-ropt-kl-val').textContent = klEl.value; S.runOptions.klWeight = +klEl.value; }); }
    if (leashEl) { leashEl.addEventListener('input', () => { qs('pmc-ropt-leash-val').textContent = leashEl.value; S.runOptions.leash = +leashEl.value; }); }
    if (probeEl) { probeEl.addEventListener('input', () => { qs('pmc-ropt-probe-val').textContent = probeEl.value; S.runOptions.probeLevel = +probeEl.value; }); }

    // Radio groups
    document.querySelectorAll('input[name="pmc-optfor"]').forEach(r => {
      r.addEventListener('change', () => { if (r.checked) S.runOptions.optimizeFor = r.value; });
    });
    document.querySelectorAll('input[name="pmc-lambda"]').forEach(r => {
      r.addEventListener('change', () => { if (r.checked) S.runOptions.lambda = +r.value; });
    });
  }

  function readRunOptions() {
    const klEl    = qs('pmc-ropt-kl');
    const leashEl = qs('pmc-ropt-leash');
    const probeEl = qs('pmc-ropt-probe');
    if (klEl)    S.runOptions.klWeight   = +klEl.value;
    if (leashEl) S.runOptions.leash      = +leashEl.value;
    if (probeEl) S.runOptions.probeLevel = +probeEl.value;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  HISTORICAL CONTEXT (Bayesian MCMC baseline)
  // ════════════════════════════════════════════════════════════════════════
  function wireHistoricalContext() {
    const nEl      = qs('pmc-hist-n');
    const meanEl   = qs('pmc-hist-mean');
    const stdEl    = qs('pmc-hist-std');
    const clearBtn = qs('pmc-hist-clear');
    const applyBtn = qs('pmc-hist-apply');
    const warnEl   = qs('pmc-hist-warning');
    const prevEl   = qs('pmc-hist-preview');

    if (!nEl || !meanEl) return;

    function refreshHistWarning() {
      const n    = parseFloat(nEl.value);
      const mean = parseFloat(meanEl.value);
      if (!isFinite(n) || !isFinite(mean)) {
        if (warnEl) { warnEl.style.display = 'none'; warnEl.textContent = ''; }
        if (prevEl) { prevEl.style.display = 'none'; prevEl.textContent = ''; }
        return;
      }
      // Credibility warning
      let warn = '', warnCls = '';
      if (n < 3) { warn = 'N=' + n + ': very low confidence. Use ≥ 3 projects for reliable adjustment.'; warnCls = 'pmc-hist-warn-low'; }
      else if (n < 10) { warn = 'N=' + n + ': moderate confidence.'; warnCls = 'pmc-hist-warn-mid'; }
      else { warn = 'N=' + n + ': strong historical signal.'; warnCls = 'pmc-hist-warn-good'; }
      if (warnEl) { warnEl.textContent = warn; warnEl.className = 'pmc-hist-warning ' + warnCls; warnEl.style.display = ''; }

      // Preview shift — simple PERT mean adjustment
      if (prevEl && S.O != null) {
        const pertMean = (S.O + 4*S.M + S.P) / 6;
        const shifted  = pertMean * (1 + mean / 100);
        prevEl.textContent = 'Baseline mean: ' + fmtN(pertMean, 2) + ' → ~' + fmtN(shifted, 2) + ' (estimated after Bayesian update)';
        prevEl.style.display = '';
      }
    }

    [nEl, meanEl, stdEl].forEach(el => { if (el) el.addEventListener('input', refreshHistWarning); });

    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (nEl) nEl.value = '';
      if (meanEl) meanEl.value = '';
      if (stdEl) stdEl.value = '';
      S.priorHistory = null;
      if (warnEl) { warnEl.style.display = 'none'; }
      if (prevEl) { prevEl.style.display = 'none'; }
      if (S.O != null) { showSpinner(true); setTimeout(() => { try { runSACO(); showSpinner(false); } catch(e) { showSpinner(false); } }, 20); }
    });

    if (applyBtn) applyBtn.addEventListener('click', () => {
      const n    = parseFloat(nEl.value);
      const mean = parseFloat(meanEl.value);
      const std  = parseFloat(stdEl.value);
      if (!isFinite(n) || n < 1 || !isFinite(mean)) {
        showError('Historical Context: enter N (≥1) and Mean Overrun %.');
        return;
      }
      S.priorHistory = {
        n:               n,
        meanOverrunFrac: mean / 100,
        stdOverrunFrac:  isFinite(std) && std > 0 ? std / 100 : null
      };
      showError('');
      if (S.O != null) { showSpinner(true); setTimeout(() => { try { runSACO(); showSpinner(false); } catch(e) { showSpinner(false); } }, 20); }
    });
  }

  function updateSliderOptimalMarkers() {
    const MARKER_KEYS = ['budgetFlexibility','scheduleFlexibility','scopeCertainty','scopeReductionAllowance','reworkPercentage','riskTolerance','userConfidence'];
    const MARKER_IDS  = ['pmc-s-budget','pmc-s-schedule','pmc-s-scopecert','pmc-s-scopered','pmc-s-rework','pmc-s-risk','pmc-s-userconf'];

    MARKER_KEYS.forEach((key, i) => {
      const markerId = MARKER_IDS[i] + '-marker';
      const el = qs(markerId);
      if (!el) return;
      const parts = [];
      if (S.optSlidersAdaptive?.[key] != null) parts.push(`Conservative: ${fmtN(S.optSlidersAdaptive[key],0)}%`);
      if (S.optSlidersFixed?.[key]    != null) parts.push(`General: ${fmtN(S.optSlidersFixed[key],0)}%`);
      el.textContent = parts.length ? 'Optimal → ' + parts.join(' · ') : '';
    });
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SENSITIVITY
  // ════════════════════════════════════════════════════════════════════════
  function updateSensitivity() {
    const panel  = qs('pmc-sensitivity');
    const content= qs('pmc-sensitivity-content');
    if (!panel || !content) return;
    if (S.baseCdf.length === 0 || S.target == null) { panel.style.display = 'none'; return; }

    // Relative impact weights (from SACO copula)
    const weights = {
      'Budget Flexibility':       0.20,
      'Schedule Flexibility':     0.20,
      'Scope Certainty':          0.20,
      'Scope Reduction':          0.15,
      'Rework %':                -0.15,
      'Risk Tolerance':           0.07,
      'User Confidence':          0.03
    };
    const maxAbs = Math.max(...Object.values(weights).map(Math.abs));

    let html = '';
    Object.entries(weights).forEach(([label, w]) => {
      const pct = Math.round(Math.abs(w) / maxAbs * 100);
      const dir = w >= 0 ? 'positive' : 'negative';
      html += `<div class="sens-row">
        <span class="sens-label">${escHtml(label)}</span>
        <div class="sens-bar-wrap"><div class="sens-bar-fill ${dir}" style="width:${pct}%"></div></div>
        <span class="sens-val">${w >= 0 ? '+' : ''}${fmtN(w*100,0)}%</span>
      </div>`;
    });
    content.innerHTML = html;
    panel.style.display = '';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RECOMMENDATION BANNER
  // ════════════════════════════════════════════════════════════════════════
  function updateRecBanner() {
    const banner = qs('pmc-rec-banner');
    if (!banner || S.baseCdf.length === 0 || S.target == null) return;

    const p0  = S.baseProb ?? 0;
    const pFx = S.fixProb  ?? 0;
    const pAd = S.adpProb  ?? 0;
    const pMn = S.manProb  ?? 0;

    const bestP = Math.max(p0, pFx, pAd, pMn);
    const lift  = bestP - p0;

    let cls, stmt, ctx;
    if (p0 >= 0.90) {
      cls = 'rec-green';
      stmt = 'Your estimate already has strong probability of success (' + fmtP(p0) + ').';
      ctx  = 'Minor optimization strategies can add small incremental improvements.';
    } else if (bestP >= 0.75 || lift >= 0.10) {
      cls = 'rec-amber';
      stmt = 'Optimization can raise probability from ' + fmtP(p0) + ' to ~' + fmtP(bestP) + ' (+' + fmtN(lift*100,1) + ' pp).';
      ctx  = 'Review the Compare Strategies tab to identify the best approach for your constraints.';
    } else {
      cls = 'rec-red';
      stmt = 'Current probability is low (' + fmtP(p0) + '). Significant intervention needed.';
      ctx  = 'Consider revising estimates, adding budget/schedule flexibility, or reducing scope.';
    }

    // Active chips
    let chipsHtml = '<div class="rec-active-bar">';
    chipsHtml += `<span class="rec-chip base">Baseline: ${fmtP(p0)}</span>`;
    if (S.seriesOn.adaptive) chipsHtml += `<span class="rec-chip adaptive">Conservative: ${fmtP(pAd)}</span>`;
    if (S.seriesOn.fixed)    chipsHtml += `<span class="rec-chip fixed">General: ${fmtP(pFx)}</span>`;
    if (S.seriesOn.manual)   chipsHtml += `<span class="rec-chip manual">Unconstrained: ${fmtP(pMn)}</span>`;
    chipsHtml += '</div>';

    // Next steps
    let details = '<div class="rec-details">';
    if (lift > 0.05) {
      details += `<div class="rec-next-row"><div class="rec-next-action">Activate Compare Strategies tab</div><div class="rec-next-why">Compare all four optimization strategies to find the best fit.</div></div>`;
      details += `<div class="rec-next-row"><div class="rec-next-action">Review Decision Sliders</div><div class="rec-next-why">Adjust Budget & Schedule Flexibility to access more headroom.</div></div>`;
    }
    if (p0 < 0.50) {
      details += `<div class="rec-next-row"><div class="rec-next-action">Revisit your three-point estimates</div><div class="rec-next-why">Consider whether your Pessimistic estimate is realistic or overly conservative.</div></div>`;
    }
    details += '</div>';

    banner.className = 'rec-banner ' + cls;
    banner.style.display = '';
    qs('pmc-rec-active-bar').innerHTML = chipsHtml;
    qs('pmc-rec-statement').textContent = stmt;
    qs('pmc-rec-context').textContent   = ctx;
    qs('pmc-rec-details').innerHTML     = details;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  WHY THIS RESULT — Optimizer explainer panel
  // ════════════════════════════════════════════════════════════════════════
  function updateWhyResult() {
    const panel = qs('pmc-why-result');
    const body  = qs('pmc-why-body');
    if (!panel || !body) return;

    // Only show in overlay tab when at least one optimized series is active
    const hasOpt = S.seriesOn.fixed || S.seriesOn.adaptive;
    if (!hasOpt || S.baseCdf.length === 0 || S.target == null) {
      panel.style.display = 'none';
      return;
    }

    // Pick the active optimized result to explain
    const optSliders = S.seriesOn.fixed && S.optSlidersFixed    ? S.optSlidersFixed
                     : S.seriesOn.adaptive && S.optSlidersAdaptive ? S.optSlidersAdaptive
                     : null;
    const optLabel   = S.seriesOn.fixed ? 'General Opt.' : 'Conservative';
    const p0  = S.baseProb ?? 0;
    const pOpt= S.seriesOn.fixed ? (S.fixProb ?? 0) : (S.adpProb ?? 0);
    const lift = pOpt - p0;

    // Compute per-slider deltas: optSlider vs user slider
    const SLIDER_LABELS = {
      budgetFlexibility:       'Budget Flexibility',
      scheduleFlexibility:     'Schedule Flexibility',
      scopeCertainty:          'Scope Certainty',
      scopeReductionAllowance: 'Scope Reduction',
      reworkPercentage:        'Rework %',
      riskTolerance:           'Risk Tolerance',
      userConfidence:          'User Confidence'
    };
    // PMBOK weights — from BASE_R / patent Section VIII
    const WEIGHTS = { budgetFlexibility:0.20, scheduleFlexibility:0.20, scopeCertainty:0.18,
                      scopeReductionAllowance:0.15, reworkPercentage:0.10, riskTolerance:0.09, userConfidence:0.08 };

    const moves = [];
    if (optSliders) {
      Object.keys(SLIDER_LABELS).forEach(key => {
        const userVal = S.sliders[key] ?? 0;
        const optVal  = optSliders[key] ?? userVal;
        const delta   = optVal - userVal;
        if (Math.abs(delta) >= 2) {
          moves.push({ key, label: SLIDER_LABELS[key], userVal, optVal, delta, weight: WEIGHTS[key] || 0 });
        }
      });
      moves.sort((a, b) => Math.abs(b.delta) * b.weight - Math.abs(a.delta) * a.weight);
    }

    let html = '';

    // Objective force breakdown
    const klBias = S.runOptions.klWeight / 100;
    const leashBias = S.runOptions.leash / 100;
    html += '<div class="pmc-why-forces">';
    html += '<div class="pmc-why-force-row">';
    html += '<span class="pmc-why-force-label">Hit target &#964;</span>';
    const targetBar = Math.round(80 - klBias * 20 - leashBias * 10);
    html += `<div class="pmc-why-bar-wrap"><div class="pmc-why-bar primary" style="width:${targetBar}%"></div></div>`;
    html += '<span class="pmc-why-force-note">primary driver</span></div>';

    html += '<div class="pmc-why-force-row">';
    html += '<span class="pmc-why-force-label">Stay near baseline</span>';
    html += `<div class="pmc-why-bar-wrap"><div class="pmc-why-bar secondary" style="width:${Math.round(klBias*60)}%"></div></div>`;
    html += `<span class="pmc-why-force-note">KL weight ${S.runOptions.klWeight}</span></div>`;

    html += '<div class="pmc-why-force-row">';
    html += '<span class="pmc-why-force-label">Limit slider moves</span>';
    html += `<div class="pmc-why-bar-wrap"><div class="pmc-why-bar tertiary" style="width:${Math.round(leashBias*40)}%"></div></div>`;
    html += `<span class="pmc-why-force-note">leash ${S.runOptions.leash}</span></div>`;
    html += '</div>';

    // Slider movement narrative
    if (moves.length > 0) {
      html += '<div class="pmc-why-moves">';
      html += `<div class="pmc-why-moves-hdr">${optLabel} changed ${moves.length} slider${moves.length>1?'s':''}:</div>`;
      moves.slice(0, 4).forEach(m => {
        const dir = m.delta > 0 ? '&#9650;' : '&#9660;';
        const cls = m.delta > 0 ? 'up' : 'down';
        html += `<div class="pmc-why-move-row">
          <span class="pmc-why-move-label">${escHtml(m.label)}</span>
          <span class="pmc-why-move-vals">${fmtN(m.userVal,0)} <span class="pmc-why-move-arrow ${cls}">${dir}</span> ${fmtN(m.optVal,0)}</span>
        </div>`;
      });
      html += '</div>';
    } else if (!optSliders) {
      html += '<p class="pmc-why-note">Run an optimization strategy to see slider recommendations.</p>';
    } else {
      html += '<p class="pmc-why-note">SACO kept all sliders close to your current values — the distribution is near-optimal already.</p>';
    }

    // Summary line
    if (lift > 0.005) {
      html += `<div class="pmc-why-summary">Result: ${fmtP(p0)} &#8594; ${fmtP(pOpt)} <span class="pmc-why-lift">(+${fmtN(lift*100,1)}pp)</span></div>`;
    }

    body.innerHTML = html;
    panel.style.display = '';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  HISTORICAL CONTEXT BADGE (shows MCMC mode indicator)
  // ════════════════════════════════════════════════════════════════════════
  function updateHistoricalBadge() {
    const ps = S.posteriorStats;
    const prevEl = qs('pmc-hist-preview');
    if (!prevEl) return;
    if (!ps) {
      // No MCMC active — clear any stale preview
      return;
    }
    // Update preview with actual posterior result
    const pertMean = S.O != null ? (S.O + 4*S.M + S.P) / 6 : null;
    if (pertMean != null) {
      const shifted = pertMean * (1 + ps.muPost);
      prevEl.textContent = 'Bayesian result: baseline mean ≈ ' + fmtN(shifted, 2)
        + ' · posterior overrun ' + (ps.muPost >= 0 ? '+' : '') + fmtN(ps.muPost * 100, 1) + '%'
        + ' ± ' + fmtN(ps.sigmaPost * 100, 1) + '% (N=' + ps.nHist + ')';
      prevEl.style.display = '';
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  PLOT SELECTOR DROPDOWNS
  // ════════════════════════════════════════════════════════════════════════
  function wirePselBars() {
    // ── Dropdown toggle helper ──
    function wireDropdown(btnId, menuId, countId) {
      const btn  = qs(btnId);
      const menu = qs(menuId);
      if (!btn || !menu) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = menu.style.display !== 'none';
        // Close all plot dropdowns first
        ['pmc-psel-menu','pmc-osel-menu'].forEach(id => {
          const m = qs(id); if (m) m.style.display = 'none';
        });
        ['pmc-psel-btn','pmc-osel-btn'].forEach(id => {
          const b = qs(id); if (b) b.setAttribute('aria-expanded','false');
        });
        if (!isOpen) {
          menu.style.display = '';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    }
    wireDropdown('pmc-psel-btn', 'pmc-psel-menu', 'pmc-psel-count');
    wireDropdown('pmc-osel-btn', 'pmc-osel-menu', 'pmc-osel-count');

    // Close on outside click
    document.addEventListener('click', () => {
      ['pmc-psel-menu','pmc-osel-menu'].forEach(id => {
        const m = qs(id); if (m) m.style.display = 'none';
      });
      ['pmc-psel-btn','pmc-osel-btn'].forEach(id => {
        const b = qs(id); if (b) b.setAttribute('aria-expanded','false');
      });
    });
    // Prevent menu clicks from propagating to document
    ['pmc-psel-menu','pmc-osel-menu'].forEach(id => {
      const m = qs(id);
      if (m) m.addEventListener('click', e => e.stopPropagation());
    });

    // ── Badge count updater ──
    function updatePselBadge() {
      const countEl = qs('pmc-psel-count');
      if (countEl) countEl.textContent = [S.showTri, S.showPdf, S.showCdf].filter(Boolean).length || 1;
    }
    function updateOselBadge() {
      const countEl = qs('pmc-osel-count');
      if (countEl) countEl.textContent = [
        S.overlayShowCdf, S.overlayShowPdf, S.overlayShowRadar,
        S.overlayShowSaco3d, S.overlayShowSphere, S.overlayShowHypercube3d
      ].filter(Boolean).length || 1;
    }

    // ── "How It's Built" checkboxes ──
    const pselCbks = [
      { id: 'pmc-psel-triangle', state: 'showTri' },
      { id: 'pmc-psel-pdf',      state: 'showPdf' },
      { id: 'pmc-psel-cdf',      state: 'showCdf' }
    ];
    pselCbks.forEach(({ id, state }) => {
      const el = qs(id);
      if (!el) return;
      el.addEventListener('change', () => {
        S[state] = el.checked;
        updatePselBadge();
        updatePlotPanes();
        redrawAllCharts();
      });
    });

    // ── "Compare Strategies" checkboxes ──
    const oselCbks = [
      { id: 'pmc-osel-cdf',         state: 'overlayShowCdf' },
      { id: 'pmc-osel-pdf',         state: 'overlayShowPdf' },
      { id: 'pmc-osel-radar',       state: 'overlayShowRadar' },
      { id: 'pmc-osel-saco3d',      state: 'overlayShowSaco3d' },
      { id: 'pmc-osel-sphere',      state: 'overlayShowSphere' },
      { id: 'pmc-osel-hypercube3d', state: 'overlayShowHypercube3d' }
    ];
    oselCbks.forEach(({ id, state }) => {
      const el = qs(id);
      if (!el) return;
      el.addEventListener('change', () => {
        S[state] = el.checked;
        updateOselBadge();
        updatePlotPanes();
        updateRadarVisibility();
        redrawAllCharts();
      });
    });
  }

  function updatePlotPanes() {
    const isOverlay = S.tab === 'overlay';
    const triWrap  = qs('pmc-tri-wrap');
    const pdfWrap  = qs('pmc-pdf-wrap');
    const cdfWrap  = qs('pmc-cdf-wrap');

    if (triWrap) triWrap.style.display = (!isOverlay && S.showTri)                        ? '' : 'none';
    if (pdfWrap) pdfWrap.style.display = (!isOverlay && S.showPdf) || (isOverlay && S.overlayShowPdf) ? '' : 'none';
    if (cdfWrap) cdfWrap.style.display = (!isOverlay && S.showCdf) || (isOverlay && S.overlayShowCdf) ? '' : 'none';

    // 3D visualizations (overlay only)
    const saco3dSec  = qs('pmc-saco3d-section');
    const sphereSec  = qs('pmc-sphere-section');
    const hyp3dSec   = qs('pmc-hypercube3d-section');
    if (saco3dSec)  saco3dSec.style.display  = isOverlay && S.overlayShowSaco3d      ? '' : 'none';
    if (sphereSec)  sphereSec.style.display  = isOverlay && S.overlayShowSphere       ? '' : 'none';
    if (hyp3dSec)   hyp3dSec.style.display   = isOverlay && S.overlayShowHypercube3d  ? '' : 'none';

    // If nothing selected in overlay, show CDF by default
    if (isOverlay && !S.overlayShowPdf && !S.overlayShowCdf && !S.overlayShowRadar &&
        !S.overlayShowSaco3d && !S.overlayShowSphere && !S.overlayShowHypercube3d) {
      if (cdfWrap) cdfWrap.style.display = '';
    }
  }

  function updateRadarVisibility() {
    const section = qs('pmc-hypercube-section');
    if (!section) return;
    section.style.display = S.tab === 'overlay' && S.overlayShowRadar ? '' : 'none';
    if (S.tab === 'overlay' && S.overlayShowRadar) {
      setTimeout(() => redrawRadar(), 50);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CHARTS
  // ════════════════════════════════════════════════════════════════════════
  function redrawAllCharts() {
    if (S.basePdf.length === 0) return;
    if (S.tab === 'progress') {
      drawTriChart();
      if (S.showPdf) drawPdfChart(false);
      if (S.showCdf) drawCdfChart(false);
    } else {
      // overlay
      if (S.overlayShowPdf || S.overlayShowCdf) {
        drawPdfChart(true);
        drawCdfChart(true);
      }
      if (S.overlayShowRadar) redrawRadar();
      if (window.PMCViz3D) {
        if (S.overlayShowSaco3d)      window.PMCViz3D.renderSaco3D();
        if (S.overlayShowSphere)      window.PMCViz3D.renderSphere();
        if (S.overlayShowHypercube3d) window.PMCViz3D.renderHypercube();
      }
    }
  }

  function makeChartConfig(type, datasets, opts) {
    return {
      type,
      data: { datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 300 },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const v = ctx.parsed.y;
                return ` ${ctx.dataset.label}: ${fmtN(v, 4)}`;
              }
            }
          }
        },
        scales: {
          x: { type: 'linear', grid: { color: 'rgba(0,0,0,.04)' }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
          y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 10 } } }
        },
        ...opts
      }
    };
  }

  function destroyChart(ref) { try { ref.destroy(); } catch(e) {} }

  function drawTriChart() {
    const canvas = qs('pmc-chart-triangle');
    if (!canvas) return;
    if (triChart) destroyChart(triChart);

    const datasets = [];
    if (S.triPdf.length) datasets.push({ label: 'Triangle', data: S.triPdf, borderColor: COLOR.tri, backgroundColor: COLOR.tri+'22', fill: true, borderWidth: 2, pointRadius: 0, tension: 0.3 });
    if (S.betaPdf.length) datasets.push({ label: 'Beta-PERT', data: S.betaPdf, borderColor: COLOR.beta, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, borderDash: [4,3] });
    if (S.basePdf.length) datasets.push({ label: 'Baseline', data: S.basePdf, borderColor: COLOR.base, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 0, tension: 0.3, borderDash: [2,2] });

    triChart = new Chart(canvas, makeChartConfig('line', datasets, {
      plugins: { tooltip: { mode: 'index', intersect: false } }
    }));
    addTargetLine(triChart);
  }

  function drawPdfChart(isOverlay) {
    const canvas = qs('pmc-chart-pdf');
    if (!canvas) return;
    if (pdfChart) destroyChart(pdfChart);

    const datasets = buildPdfDatasets(isOverlay);
    pdfChart = new Chart(canvas, makeChartConfig('line', datasets, {
      plugins: { tooltip: { mode: 'index', intersect: false } }
    }));
    addTargetLine(pdfChart);
  }

  function drawCdfChart(isOverlay) {
    const canvas = qs('pmc-chart-cdf');
    if (!canvas) return;
    if (cdfChart) destroyChart(cdfChart);

    const datasets = buildCdfDatasets(isOverlay);
    cdfChart = new Chart(canvas, makeChartConfig('line', datasets, {
      scales: {
        x: { type: 'linear', grid: { color: 'rgba(0,0,0,.04)' }, ticks: { maxTicksLimit: 8, font: { size: 10 } } },
        y: { beginAtZero: true, max: 1, grid: { color: 'rgba(0,0,0,.04)' }, ticks: { font: { size: 10 }, callback: v => fmtN(v*100,0)+'%' } }
      },
      plugins: { tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmtN(ctx.parsed.y*100,2)}%` } } }
    }));
    addTargetLine(cdfChart);
  }

  function buildPdfDatasets(isOverlay) {
    const ds = [];
    if (!isOverlay) {
      // progress tab: only baseline
      if (S.basePdf.length) ds.push(mkDs('Your Estimate', S.basePdf, COLOR.base, true));
    } else {
      if (S.seriesOn.baseline  && S.basePdf.length) ds.push(mkDs('Your Estimate', S.basePdf, COLOR.base, true));
      if (S.seriesOn.adaptive  && S.adpPdf.length)  ds.push(mkDs('Conservative',  S.adpPdf,  COLOR.adaptive, false));
      if (S.seriesOn.fixed     && S.fixPdf.length)  ds.push(mkDs('General Opt.',  S.fixPdf,  COLOR.fixed, false));
      if (S.seriesOn.manual    && S.manPdf.length)  ds.push(mkDs('Unconstrained', S.manPdf,  COLOR.manual, false));
    }
    return ds;
  }

  function buildCdfDatasets(isOverlay) {
    const ds = [];
    if (!isOverlay) {
      if (S.baseCdf.length) ds.push(mkDs('Your Estimate', S.baseCdf, COLOR.base, false));
    } else {
      if (S.seriesOn.baseline  && S.baseCdf.length) ds.push(mkDs('Your Estimate', S.baseCdf, COLOR.base, false));
      if (S.seriesOn.adaptive  && S.adpCdf.length)  ds.push(mkDs('Conservative',  S.adpCdf,  COLOR.adaptive, false));
      if (S.seriesOn.fixed     && S.fixCdf.length)  ds.push(mkDs('General Opt.',  S.fixCdf,  COLOR.fixed, false));
      if (S.seriesOn.manual    && S.manCdf.length)  ds.push(mkDs('Unconstrained', S.manCdf,  COLOR.manual, false));
    }
    return ds;
  }

  function mkDs(label, data, color, fill) {
    return { label, data, borderColor: color, backgroundColor: fill ? color+'22' : 'transparent', fill, borderWidth: 2, pointRadius: 0, tension: 0.3 };
  }

  function addTargetLine(chart) {
    if (S.target == null || !chart) return;
    chart.options.plugins.annotation = chart.options.plugins.annotation || {};
    // Use Chart.js annotation plugin if available, else manual
    chart.update('none');
  }

  // ── Radar chart (Compare Strategies tab) ─────────────────────────────
  function redrawRadar() {
    const canvas = qs('pmc-chart-radar');
    if (!canvas) return;
    if (radarChart) destroyChart(radarChart);

    const labels = ['Budget\nFlexibility','Schedule\nFlexibility','Scope\nCertainty','Scope\nReduction','Rework\n%','Risk\nTolerance','User\nConfidence'];
    const datasets = [];

    const sliderKeys = ['budgetFlexibility','scheduleFlexibility','scopeCertainty','scopeReductionAllowance','reworkPercentage','riskTolerance','userConfidence'];
    const maxVals    = [100, 100, 100, 100, 50, 100, 100];

    const normalize = (vals) => sliderKeys.map((k, i) => (vals[k] || 0) / maxVals[i] * 100);

    if (S.seriesOn.baseline) {
      datasets.push({ label: 'Your Estimate', data: sliderKeys.map(() => 0), borderColor: COLOR.base, backgroundColor: COLOR.base+'22', fill: true });
    }
    if (S.seriesOn.adaptive && S.optSlidersAdaptive) {
      datasets.push({ label: 'Conservative', data: normalize(S.optSlidersAdaptive), borderColor: COLOR.adaptive, backgroundColor: COLOR.adaptive+'22', fill: true });
    }
    if (S.seriesOn.fixed && S.optSlidersFixed) {
      datasets.push({ label: 'General Opt.', data: normalize(S.optSlidersFixed), borderColor: COLOR.fixed, backgroundColor: COLOR.fixed+'22', fill: true });
    }
    if (S.seriesOn.manual) {
      const current = sliderKeys.map(k => S.sliders[k] || 0);
      const norm = sliderKeys.map((k, i) => (S.sliders[k] || 0) / maxVals[i] * 100);
      datasets.push({ label: 'Unconstrained', data: norm, borderColor: COLOR.manual, backgroundColor: COLOR.manual+'22', fill: true });
    }

    radarChart = new Chart(canvas, {
      type: 'radar',
      data: { labels, datasets },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true, min: 0, max: 100,
            ticks: { font: { size: 9 }, color: '#6B7280', stepSize: 25 },
            pointLabels: { font: { size: 10, weight: '600' }, color: '#374151' },
            grid: { color: 'rgba(0,0,0,.06)' },
            angleLines: { color: 'rgba(0,0,0,.06)' }
          }
        },
        plugins: { legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, padding: 12 } } }
      }
    });

    const sub = qs('pmc-radar-subtitle');
    if (sub) sub.textContent = 'Normalized slider values (0–100%) per strategy. Larger area = more levers engaged.';
  }

  // ════════════════════════════════════════════════════════════════════════
  //  REPORT / NARRATIVE
  // ════════════════════════════════════════════════════════════════════════
  function wireReportTabs() {
    document.querySelectorAll('#projectcare .rep-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#projectcare .rep-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const rep = btn.dataset.rep;
        qs('pmc-rep-narrative').style.display = rep === 'narrative' ? '' : 'none';
        qs('pmc-rep-stats').style.display     = rep === 'stats'     ? '' : 'none';
        qs('pmc-rep-export').style.display    = rep === 'export'    ? '' : 'none';
      });
    });

    qs('pmc-export-csv').addEventListener('click', exportCsv);
    qs('pmc-copy-summary').addEventListener('click', copySummary);
  }

  function updateReportNarrative() {
    const div = qs('pmc-rep-narrative');
    if (!div || S.O == null) return;

    const pert = (S.O + 4*S.M + S.P) / 6;
    const range = S.P - S.O;
    const cov = range / pert;
    const tau = S.target;

    let html = `<div class="narrative-block">
      <h4>Estimate Overview — ${escHtml(S.taskName)}</h4>
      <p>Your three-point estimate spans from <strong>${fmtN(S.O,2)}</strong> (optimistic) through <strong>${fmtN(S.M,2)}</strong> (most likely) to <strong>${fmtN(S.P,2)}</strong> (pessimistic), with a PERT mean of <strong>${fmtN(pert,2)}</strong>. The range is ${fmtN(range,2)} (coefficient of variation: ${fmtN(cov*100,1)}%).</p>
    </div>`;

    if (tau != null) {
      html += `<div class="narrative-block">
        <h4>Probability Analysis at Target τ = ${fmtN(tau,2)}</h4>
        <p>Based on your baseline Monte Carlo distribution, there is a <strong>${fmtP(S.baseProb)}</strong> probability of completing at or below this target.</p>`;
      if (S.seriesOn.fixed && S.fixProb != null) {
        html += `<p>General Optimization raises this to <strong>${fmtP(S.fixProb)}</strong>, a gain of <strong>+${fmtN((S.fixProb-S.baseProb)*100,1)} pp</strong>.</p>`;
      }
      if (S.seriesOn.adaptive && S.adpProb != null) {
        html += `<p>Conservative Optimization achieves <strong>${fmtP(S.adpProb)}</strong> within tightest defensible constraints.</p>`;
      }
      html += '</div>';
    }

    if (cov > 0.5) {
      html += `<div class="narrative-block" style="border-left-color:#F59E0B;background:#FFFBEB;">
        <h4>High Uncertainty Alert</h4>
        <p>The range P − O = ${fmtN(range,2)} is large relative to the PERT mean (${fmtN(cov*100,1)}% CoV). Consider breaking this task into smaller, better-understood components to reduce estimation uncertainty.</p>
      </div>`;
    }

    div.innerHTML = html;

    // Show report card
    const reportCard = qs('pmc-report');
    if (reportCard) reportCard.style.display = '';
  }

  function updateStatsTable() {
    const tbody = qs('pmc-stats-body');
    if (!tbody || S.baseCdf.length === 0) return;

    const rows = [
      ['PERT Mean', fmtN((S.O+4*S.M+S.P)/6, 3), '–', '–', '–'],
      ['P(≤τ)', fmtP(S.baseProb), fmtP(S.manProb), fmtP(S.fixProb), fmtP(S.adpProb)],
      ['P10',  fmtN(percentile(S.baseCdf,0.10),2), fmtN(percentile(S.manCdf,0.10),2), fmtN(percentile(S.fixCdf,0.10),2), fmtN(percentile(S.adpCdf,0.10),2)],
      ['P50',  fmtN(percentile(S.baseCdf,0.50),2), fmtN(percentile(S.manCdf,0.50),2), fmtN(percentile(S.fixCdf,0.50),2), fmtN(percentile(S.adpCdf,0.50),2)],
      ['P80',  fmtN(percentile(S.baseCdf,0.80),2), fmtN(percentile(S.manCdf,0.80),2), fmtN(percentile(S.fixCdf,0.80),2), fmtN(percentile(S.adpCdf,0.80),2)],
      ['P90',  fmtN(percentile(S.baseCdf,0.90),2), fmtN(percentile(S.manCdf,0.90),2), fmtN(percentile(S.fixCdf,0.90),2), fmtN(percentile(S.adpCdf,0.90),2)],
      ['P95',  fmtN(percentile(S.baseCdf,0.95),2), fmtN(percentile(S.manCdf,0.95),2), fmtN(percentile(S.fixCdf,0.95),2), fmtN(percentile(S.adpCdf,0.95),2)]
    ];

    tbody.innerHTML = rows.map(r =>
      `<tr>${r.map((c,i) => i===0 ? `<th>${escHtml(c)}</th>` : `<td>${escHtml(c)}</td>`).join('')}</tr>`
    ).join('');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  EXPORT
  // ════════════════════════════════════════════════════════════════════════
  function exportCsv() {
    if (S.O == null) { showToast('Run an estimation first.'); return; }
    const pert = (S.O + 4*S.M + S.P) / 6;
    const tau  = S.target;
    const rows = [
      ['Metric', 'Baseline', 'Unconstrained', 'General Opt.', 'Conservative'],
      ['Task', S.taskName, S.taskName, S.taskName, S.taskName],
      ['O', S.O, S.O, S.O, S.O],
      ['M', S.M, S.M, S.M, S.M],
      ['P', S.P, S.P, S.P, S.P],
      ['PERT Mean', pert.toFixed(4), '', '', ''],
      ['Target (τ)', tau != null ? tau.toFixed(4) : '', '', '', ''],
      ['P(≤τ)', S.baseProb != null ? S.baseProb.toFixed(6) : '', S.manProb != null ? S.manProb.toFixed(6) : '', S.fixProb != null ? S.fixProb.toFixed(6) : '', S.adpProb != null ? S.adpProb.toFixed(6) : ''],
      ['P50', percentile(S.baseCdf,0.5)?.toFixed(4)||'', percentile(S.manCdf,0.5)?.toFixed(4)||'', percentile(S.fixCdf,0.5)?.toFixed(4)||'', percentile(S.adpCdf,0.5)?.toFixed(4)||''],
      ['P80', percentile(S.baseCdf,0.8)?.toFixed(4)||'', percentile(S.manCdf,0.8)?.toFixed(4)||'', percentile(S.fixCdf,0.8)?.toFixed(4)||'', percentile(S.adpCdf,0.8)?.toFixed(4)||''],
      ['P90', percentile(S.baseCdf,0.9)?.toFixed(4)||'', percentile(S.manCdf,0.9)?.toFixed(4)||'', percentile(S.fixCdf,0.9)?.toFixed(4)||'', percentile(S.adpCdf,0.9)?.toFixed(4)||'']
    ];
    const csv = rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: 'projectcare-' + Date.now() + '.csv' });
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported.');
  }

  function copySummary() {
    if (S.O == null) { showToast('Run an estimation first.'); return; }
    const pert = (S.O + 4*S.M + S.P) / 6;
    const lines = [
      'ProjectCare — ' + S.taskName,
      'O: ' + fmtN(S.O,2) + '  M: ' + fmtN(S.M,2) + '  P: ' + fmtN(S.P,2),
      'PERT Mean: ' + fmtN(pert,2),
      'Target (τ): ' + (S.target != null ? fmtN(S.target,2) : '–'),
      '',
      'P(≤τ)',
      '  Baseline:        ' + fmtP(S.baseProb),
      '  Conservative:    ' + fmtP(S.adpProb),
      '  General Opt.:    ' + fmtP(S.fixProb),
      '  Unconstrained:   ' + fmtP(S.manProb),
      '',
      'Percentiles (Baseline)',
      '  P50: ' + fmtN(percentile(S.baseCdf,0.5),2),
      '  P80: ' + fmtN(percentile(S.baseCdf,0.8),2),
      '  P90: ' + fmtN(percentile(S.baseCdf,0.9),2)
    ];
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => showToast('Summary copied to clipboard.'))
      .catch(() => showToast('Copy failed — try again.'));
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TASK MODAL
  // ════════════════════════════════════════════════════════════════════════
  function wireTaskModal() {
    qs('pmc-btn-add-task').addEventListener('click', () => openTaskModal(null));
    qs('pmc-task-modal-close').addEventListener('click',  closeTaskModal);
    qs('pmc-task-modal-cancel').addEventListener('click', closeTaskModal);
    qs('pmc-task-modal-save').addEventListener('click',   saveTask);

    // Live triangle preview
    ['pmc-tm-o','pmc-tm-m','pmc-tm-p'].forEach(id => {
      qs(id)?.addEventListener('input', drawTriPreview);
    });

    // Close on backdrop click
    qs('pmc-task-modal-backdrop').addEventListener('click', e => {
      if (e.target === qs('pmc-task-modal-backdrop')) closeTaskModal();
    });
  }

  function openTaskModal(taskId) {
    S.editTaskId = taskId;
    const task = taskId ? S.tasks.find(t => t.id === taskId) : null;
    qs('pmc-task-modal-title').textContent = task ? 'Edit Task' : 'Add Task';
    qs('pmc-tm-name').value   = task?.task_name   || '';
    qs('pmc-tm-o').value      = task?.best_case   || '';
    qs('pmc-tm-m').value      = task?.most_likely || '';
    qs('pmc-tm-p').value      = task?.worst_case  || '';
    qs('pmc-tm-target').value = task?.target      || '';
    const err = qs('pmc-task-modal-error');
    if (err) { err.hidden = true; err.textContent = ''; }
    qs('pmc-task-modal-backdrop').classList.add('open');
    drawTriPreview();
  }

  function closeTaskModal() {
    qs('pmc-task-modal-backdrop').classList.remove('open');
    S.editTaskId = null;
  }

  function saveTask() {
    const name   = (qs('pmc-tm-name').value || '').trim();
    const o      = parseFloat(qs('pmc-tm-o').value);
    const m      = parseFloat(qs('pmc-tm-m').value);
    const p      = parseFloat(qs('pmc-tm-p').value);
    const target = parseFloat(qs('pmc-tm-target').value) || null;

    const errEl = qs('pmc-task-modal-error');
    if (!name)                    { showFieldError(errEl,'Task name is required.'); return; }
    if (isNaN(o)||isNaN(m)||isNaN(p)) { showFieldError(errEl,'O, M, P are required numbers.'); return; }
    if (!(o<=m&&m<=p))            { showFieldError(errEl,'Values must satisfy O ≤ M ≤ P.'); return; }

    if (S.editTaskId) {
      const idx = S.tasks.findIndex(t => t.id === S.editTaskId);
      if (idx >= 0) {
        S.tasks[idx] = { ...S.tasks[idx], task_name: name, best_case: o, most_likely: m, worst_case: p, target };
      }
    } else {
      S.tasks.push({ id: 'tid_' + Date.now(), task_name: name, best_case: o, most_likely: m, worst_case: p, target, active: true });
    }

    saveTasksToStorage();
    updateGroupList();
    closeTaskModal();
    showToast((S.editTaskId ? 'Task updated.' : 'Task added.'));

    // If single mode and first task, populate inputs
    if (!S.editTaskId && S.mode === 'single') {
      qs('pmc-task-name').value   = name;
      qs('pmc-optimistic').value  = o;
      qs('pmc-most-likely').value = m;
      qs('pmc-pessimistic').value = p;
    }
  }

  function showFieldError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  // Triangle preview
  function drawTriPreview() {
    const canvas = qs('pmc-tri-preview');
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');
    const o = parseFloat(qs('pmc-tm-o').value);
    const m = parseFloat(qs('pmc-tm-m').value);
    const p = parseFloat(qs('pmc-tm-p').value);

    const W = canvas.width, H = canvas.height;
    ctx2d.clearRect(0, 0, W, H);
    ctx2d.fillStyle = '#F9FAFB';
    ctx2d.fillRect(0, 0, W, H);

    if (isNaN(o)||isNaN(m)||isNaN(p)||o>=p) return;

    const pad = 20;
    const toX = v => pad + (v - o) / (p - o) * (W - 2*pad);
    const modeH = H - pad - 10;

    ctx2d.beginPath();
    ctx2d.moveTo(toX(o), H - pad);
    ctx2d.lineTo(toX(m), modeH - (H - 2*pad - 10));
    ctx2d.lineTo(toX(p), H - pad);
    ctx2d.closePath();
    ctx2d.fillStyle = 'rgba(59,130,246,.15)';
    ctx2d.fill();
    ctx2d.strokeStyle = '#3B82F6';
    ctx2d.lineWidth = 2;
    ctx2d.stroke();

    // Labels
    qs('pmc-tri-prev-o').textContent = fmtN(o,1);
    qs('pmc-tri-prev-m').textContent = fmtN(m,1);
    qs('pmc-tri-prev-p').textContent = fmtN(p,1);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  CSV MODAL
  // ════════════════════════════════════════════════════════════════════════
  function wireCsvModal() {
    qs('pmc-btn-csv').addEventListener('click',     openCsvModal);
    qs('pmc-csv-close').addEventListener('click',   closeCsvModal);
    qs('pmc-csv-cancel').addEventListener('click',  closeCsvModal);
    qs('pmc-csv-backdrop').addEventListener('click', e => { if (e.target === qs('pmc-csv-backdrop')) closeCsvModal(); });
    qs('pmc-csv-file').addEventListener('change',   e => csvFileChosen(e.target));
    qs('pmc-csv-import-btn').addEventListener('click', csvCommit);
  }

  function openCsvModal() {
    S.csvParsed = null;
    qs('pmc-csv-step1').style.display = 'block';
    qs('pmc-csv-step2').style.display = 'none';
    qs('pmc-csv-import-btn').style.display = 'none';
    qs('pmc-csv-file').value = '';
    qs('pmc-csv-parse-status').textContent = '';
    qs('pmc-csv-backdrop').classList.add('open');
  }

  function closeCsvModal() { qs('pmc-csv-backdrop').classList.remove('open'); }

  function csvFileChosen(input) {
    const file = input?.files?.[0];
    if (!file) return;
    const status = qs('pmc-csv-parse-status');
    if (status) status.textContent = 'Parsing…';
    const reader = new FileReader();
    reader.onload = e => { S.csvParsed = parseCSV(e.target.result); renderCsvPreview(S.csvParsed); };
    reader.onerror = () => { if (status) status.textContent = 'Error reading file.'; };
    reader.readAsText(file);
  }

  function csvLine(line) {
    const cells = [], re = /("(?:[^"]|"")*"|[^,]*)(,|$)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      let v = m[1];
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1,-1).replace(/""/g,'"');
      cells.push(v);
      if (m[2] === '') break;
    }
    return cells;
  }

  function parseCSV(text) {
    const lines = text.replace(/\r\n/g,'\n').replace(/\r/g,'\n').split('\n').filter(l => l.trim());
    if (lines.length < 2) return { tasks:[], warnings:['CSV has no data rows.'], errors:[] };

    const headers = csvLine(lines[0]).map(h => h.toLowerCase().trim().replace(/[\s_\-]+/g,''));
    const KEYWORDS = {
      task_name:   ['task','name','activity','item','work','feature','title'],
      best_case:   ['best','optimistic','min','minimum','low','opt'],
      most_likely: ['likely','expected','nominal','typical','modal','mid'],
      worst_case:  ['worst','pessimistic','max','maximum','high','pess'],
      target:      ['target','deadline','budget','goal'],
      risk_weight: ['risk','weight','priority','impact'],
      active:      ['active','enabled','include','flag'],
      notes:       ['note','comment','remark','detail']
    };
    const colMap = {}; const usedCols = {};
    Object.keys(KEYWORDS).forEach(field => {
      const kws = KEYWORDS[field];
      let bestScore = 0, bestCol = -1;
      headers.forEach((h, ci) => {
        if (usedCols[ci]) return;
        let score = 0;
        kws.forEach(kw => { if (h === kw) score = Math.max(score,10); else if (h.indexOf(kw)!==-1||kw.indexOf(h)!==-1) score = Math.max(score,5); });
        if (score > bestScore) { bestScore = score; bestCol = ci; }
      });
      colMap[field] = bestScore > 0 ? bestCol : -1;
      if (bestScore > 0) usedCols[bestCol] = true;
    });

    const tasks=[], warnings=[], errors=[];
    for (let ri=1; ri<lines.length; ri++) {
      const row = csvLine(lines[ri]);
      const getCol = f => { const ci=colMap[f]; return (ci>=0&&ci<row.length)?row[ci].trim():''; };
      const name = getCol('task_name');
      if (!name) continue;

      let a=parseFloat(getCol('best_case')), c=parseFloat(getCol('most_likely')), b=parseFloat(getCol('worst_case'));
      const w=parseFloat(getCol('risk_weight')); const t=parseFloat(getCol('target'));
      const actRaw=getCol('active'); const active = actRaw===''?true:!(actRaw.toLowerCase()==='false'||actRaw==='0');

      const rowWarnings=[], rowErrors=[];
      if (isNaN(a)||isNaN(c)||isNaN(b)) {
        rowErrors.push('Missing or non-numeric estimate values');
      } else {
        const sorted=[a,c,b].sort((x,y)=>x-y);
        if (a!==sorted[0]||c!==sorted[1]||b!==sorted[2]) { rowWarnings.push('Values re-ordered'); a=sorted[0]; c=sorted[1]; b=sorted[2]; }
        if (a===b) rowWarnings.push('Zero-variance task');
      }

      tasks.push({ _row:ri+1,_errors:rowErrors,_warnings:rowWarnings, task_name:name, best_case:isNaN(a)?null:a, most_likely:isNaN(c)?null:c, worst_case:isNaN(b)?null:b, target:isNaN(t)?null:t, risk_weight:isNaN(w)?1:Math.max(0,Math.min(10,w)), active, notes:getCol('notes') });
      if (rowErrors.length)   errors.push('Row '+(ri+1)+': '+rowErrors.join('; '));
      if (rowWarnings.length) warnings.push('Row '+(ri+1)+' ('+name+'): '+rowWarnings.join('; '));
    }
    return { tasks, warnings, errors };
  }

  function renderCsvPreview(result) {
    qs('pmc-csv-step1').style.display = 'block';
    qs('pmc-csv-step2').style.display = 'block';
    const importBtn = qs('pmc-csv-import-btn');
    const warnEl    = qs('pmc-csv-warnings');
    const summEl    = qs('pmc-csv-summary');
    const tbody     = qs('pmc-csv-preview-body');

    const validCount = result.tasks.filter(t => t._errors.length===0).length;
    if (summEl) summEl.textContent = validCount+' valid, '+result.errors.length+' errors, '+result.warnings.length+' warnings.';
    if (importBtn) importBtn.style.display = validCount > 0 ? 'inline-flex' : 'none';

    if (warnEl) {
      if (result.warnings.length > 0) {
        warnEl.innerHTML = '<div class="tm-warnings"><div class="warn-title">&#9888; Warnings ('+result.warnings.length+')</div><ul>'+result.warnings.map(w=>'<li>'+escHtml(w)+'</li>').join('')+'</ul></div>';
      } else { warnEl.innerHTML = ''; }
    }

    if (tbody) {
      tbody.innerHTML = result.tasks.map(t => {
        const cls = t._errors.length>0 ? 'csv-err' : (t._warnings.length>0 ? 'csv-warn' : 'csv-ok');
        const icon = t._errors.length>0 ? '&#10060;' : (t._warnings.length>0 ? '&#9888;' : '&#10003;');
        return `<tr class="${cls}"><td>${icon}</td><td>${escHtml(t.task_name)}</td><td>${t.best_case??'?'}</td><td>${t.most_likely??'?'}</td><td>${t.worst_case??'?'}</td><td>${t.risk_weight}</td><td>${escHtml(t.notes||'')}</td></tr>`;
      }).join('');
    }
  }

  function csvCommit() {
    if (!S.csvParsed) return;
    const valid = S.csvParsed.tasks.filter(t => t._errors.length === 0);
    if (!valid.length) return;
    valid.forEach((t, i) => {
      S.tasks.push({ id:'tid_csv_'+Date.now()+'_'+i, task_name:t.task_name, best_case:t.best_case, most_likely:t.most_likely, worst_case:t.worst_case, target:t.target, active:t.active, notes:t.notes });
    });
    saveTasksToStorage();
    closeCsvModal();
    updateGroupList();
    showToast(valid.length+' task'+( valid.length===1?'':'s')+' imported.');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SLIDER HELP MODAL
  // ════════════════════════════════════════════════════════════════════════
  function wireSliderHelp() {
    document.addEventListener('click', e => {
      const btn = e.target.closest && e.target.closest('.slider-help-btn');
      if (btn) { openSliderHelp(btn.getAttribute('data-slider-help')); return; }
      const icon = e.target.closest && e.target.closest('.help-icon[data-title]');
      if (icon) { openHelpModal(icon.getAttribute('data-title'), icon.getAttribute('data-body')); return; }
      const tgt = e.target;
      if (tgt.id==='pmc-slider-help-backdrop'||tgt.id==='pmc-shm-close') closeSliderHelp();
    });
    qs('pmc-shm-close').addEventListener('click', closeSliderHelp);
    document.addEventListener('keydown', e => { if (e.key==='Escape') closeSliderHelp(); });
  }

  function openSliderHelp(key) {
    const info = SLIDER_HELP[key];
    if (!info) return;
    qs('pmc-shm-title').textContent   = info.title;
    qs('pmc-shm-body').innerHTML      = info.body;
    qs('pmc-slider-help-modal').classList.add('visible');
    qs('pmc-slider-help-backdrop').classList.add('visible');
  }

  function openHelpModal(title, bodyText) {
    qs('pmc-shm-title').textContent = title || 'Help';
    qs('pmc-shm-body').innerHTML    = '<p>' + escHtml(bodyText || '') + '</p>';
    qs('pmc-slider-help-modal').classList.add('visible');
    qs('pmc-slider-help-backdrop').classList.add('visible');
  }

  function closeSliderHelp() {
    qs('pmc-slider-help-modal').classList.remove('visible');
    qs('pmc-slider-help-backdrop').classList.remove('visible');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  TASK STORAGE (localStorage)
  // ════════════════════════════════════════════════════════════════════════
  function saveTasksToStorage() {
    try { localStorage.setItem('pmc_tasks_v1', JSON.stringify(S.tasks)); } catch(e) {}
  }

  function loadTasksFromStorage() {
    try {
      const raw = localStorage.getItem('pmc_tasks_v1');
      if (raw) S.tasks = JSON.parse(raw);
    } catch(e) { S.tasks = []; }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  UI HELPERS
  // ════════════════════════════════════════════════════════════════════════
  function showResults() {
    const section = qs('pmc-results');
    if (section) section.hidden = false;
    updateTabVisibility();
    updatePlotPanes();
  }

  function showSpinner(on) {
    const s = qs('pmc-spinner');
    if (s) { s.hidden = !on; s.style.display = on ? 'inline-block' : 'none'; }
    const btn = qs('pmc-run');
    if (btn) btn.disabled = on;
  }

  function showError(msg) {
    const el = qs('pmc-error');
    if (!el) return;
    el.hidden = !msg;
    el.textContent = msg;
  }

  function showToast(msg) {
    const el = qs('pmc-toast');
    if (!el) return;
    el.textContent = msg;
    el.style.display = '';
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.style.display = 'none'; }, 3000);
  }

  // ════════════════════════════════════════════════════════════════════════
  //  BOOT
  // ════════════════════════════════════════════════════════════════════════
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
