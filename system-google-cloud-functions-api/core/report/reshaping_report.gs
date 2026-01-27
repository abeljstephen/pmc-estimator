// File: report/reshaping_report.gs
// Build a compact textual + structured summary for reshaping outcomes.
 // Cleaned for pure Apps Script - global scope, no Node.js

function fmt(v, digits = 6) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return String(Number(n.toFixed(digits)));
}

function pct(v, digits = 2) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 'N/A';
  return String((n * 100).toFixed(digits)) + '%';
}

function safe(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.replace(/\r?\n/g, ' ').trim();
  if (typeof v === 'number') return fmt(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return JSON.stringify(v);
}

function csvRow(arr) {
  return arr.map(x => {
    const s = String(x ?? '');
    return (s.includes(',') || s.includes('"') || s.includes('\n'))
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  }).join(',');
}

function summarizeBaseline(taskMeta, baseline) {
  const name = taskMeta?.task || '';
  const O = taskMeta?.optimistic;
  const M = taskMeta?.mostLikely;
  const P = taskMeta?.pessimistic;
  const tau = taskMeta?.targetValue ?? M;

  const pert = baseline?.pert?.value;
  const baseProbAtTau = baseline?.probabilityAtTarget?.value;
  const baseProbAtPert = baseline?.probabilityAtPert?.value;
  const ciL = baseline?.metrics?.monteCarloSmoothed?.ci?.lower;
  const ciU = baseline?.metrics?.monteCarloSmoothed?.ci?.upper;
  const kld = baseline?.metrics?.klDivergenceToTriangle;

  const bits = [];
  bits.push(`Task "${name}" baseline set by O=${O}, M=${M}, P=${P}.`);
  if (Number.isFinite(pert)) bits.push(`PERT≈${fmt(pert, 4)}.`);
  if (Number.isFinite(tau)) bits.push(`Target τ=${fmt(tau, 4)}.`);
  if (Number.isFinite(baseProbAtTau)) bits.push(`F₀(τ)=${pct(baseProbAtTau)}.`);
  if (Number.isFinite(baseProbAtPert)) bits.push(`F₀(PERT)=${pct(baseProbAtPert)}.`);
  if (Number.isFinite(ciL) && Number.isFinite(ciU)) bits.push(`MC-smoothed 95% CI=[${fmt(ciL,4)}, ${fmt(ciU,4)}].`);
  if (Number.isFinite(kld)) bits.push(`KL divergence vs Triangle=${fmt(kld,6)}.`);
  return bits.join(' ');
}

function summarizeExplain(label, explain) {
  if (!explain) return null;
  const base = explain?.baselineProb;
  const fin  = explain?.finalProb;
  const usedProj = !!explain?.projection?.used;
  const lam = explain?.projection?.lambda;
  const fmin = explain?.projection?.Fmin;

  const modeBadge = getModeBadge(explain.mode || (label.toLowerCase() === 'adjusted' ? 'manual' : 'fixed'), !!explain.seedBest);
  const modeSuffix = ` (${modeBadge})`;

  let sacoSuffix = '';
  if (explain.klDivergence != null || explain.robustStd != null || explain.moments || explain.chainingDrift != null) {
    sacoSuffix = ` (SACO: KL=${fmt(explain.klDivergence || 0,3)}, std=${fmt(explain.robustStd || 0,3)}${explain.moments ? ', moments' : ''}${explain.chainingDrift != null ? `, drift=${fmt(explain.chainingDrift,1)}%` : ''})`;
  }

  const parts = [];
  parts.push(`${label} ${modeBadge}: F(τ) ${Number.isFinite(base) ? pct(base) : '–'} → ${Number.isFinite(fin) ? pct(fin) : '–'}${sacoSuffix}.`);
  parts.push(usedProj ? `Projection guard active (λ=${fmt(lam,3)}, Fmin=${pct(fmin)}).` : `Convex blend; no projection guard.`);
  const sCount = Array.isArray(explain?.sliders) ? explain.sliders.length : 0;
  parts.push(`Contributors=${sCount} sliders.`);
  return parts.join(' ');
}

function buildBaselineCsv(taskMeta, baseline) {
  const rows = [];
  rows.push(csvRow(['Section','Metric','Value']));
  rows.push(csvRow(['Task','Name', safe(taskMeta?.task)]));
  rows.push(csvRow(['Inputs','Optimistic (O)', fmt(taskMeta?.optimistic)]));
  rows.push(csvRow(['Inputs','Most Likely (M)', fmt(taskMeta?.mostLikely)]));
  rows.push(csvRow(['Inputs','Pessimistic (P)', fmt(taskMeta?.pessimistic)]));
  rows.push(csvRow(['Target','τ (Target Value)', fmt(taskMeta?.targetValue ?? taskMeta?.mostLikely)]));
  rows.push(csvRow(['Parameters','Confidence Level', fmt(taskMeta?.confidenceLevel)]));
  rows.push(csvRow(['Baseline','PERT Mean', fmt(baseline?.pert?.value)]));
  rows.push(csvRow(['Baseline','F₀(τ)', pct(baseline?.probabilityAtTarget?.value)]));
  rows.push(csvRow(['Baseline','F₀(PERT)', pct(baseline?.probabilityAtPert?.value)]));
  rows.push(csvRow(['Baseline','MC-smoothed 95% CI Lower', fmt(baseline?.metrics?.monteCarloSmoothed?.ci?.lower)]));
  rows.push(csvRow(['Baseline','MC-smoothed 95% CI Upper', fmt(baseline?.metrics?.monteCarloSmoothed?.ci?.upper)]));
  rows.push(csvRow(['Baseline','KL Divergence (Triangle→MC)', fmt(baseline?.metrics?.klDivergenceToTriangle, 8)]));
  return rows.join('\n');
}

function buildDecisionCsv(taskMeta, baseline, adjusted, optimized, mode) {
  const rows = [];
  rows.push(csvRow(['Block','Mode','Slider','Category','Band','Value (0..1)','λ_i (blend part)','α (left shift)','β (tail shave)','ΔProb raw','Projection share','ΔProb total','m0 (moments)','m1 (moments)','KL Divergence','Robust Std','CV Proxy','Raw Value','m0 per Slider','m1 per Slider','Bootstrap AvgP','Bootstrap StdP','Partial Impact','Chaining Drift %']));

  const bandOf = (v01) => {
    const v = Number(v01);
    if (!Number.isFinite(v)) return '';
    const pct100 = v * 100;
    if (pct100 <= 25) return '0–25';
    if (pct100 <= 50) return '26–50';
    if (pct100 <= 75) return '51–75';
    return '76–100';
  };

  const pushBlock = (label, blockExplain, blockMode = 'manual') => {
    if (!blockExplain) return;
    const sliders = Array.isArray(blockExplain.sliders) ? blockExplain.sliders : [];
    const badge = getModeBadge(blockMode, !!blockExplain.seedBest);
    for (const s of sliders) {
      const v = Number(s.value ?? 0);
      const cat = s.category || 'other';
      const lamPart = Number(s?.weights?.blend ?? 0) * v;
      const a = Number(s?.weights?.leftShift ?? s?.modeledEffect?.alpha ?? 0);
      const b = Number(s?.weights?.tailShave ?? s?.modeledEffect?.beta ?? 0);
      const dRaw = Number(s?.contribution?.deltaTargetProbFromRaw ?? 0);
      const dProj = Number(s?.contribution?.shareOfProjectionLift ?? 0);
      const dTot = (Number.isFinite(dRaw) ? dRaw : 0) + (Number.isFinite(dProj) ? dProj : 0);
      const m0 = fmt(s.moments?.m0 || blockExplain.moments?.m0 || NaN, 3);
      const m1 = fmt(s.moments?.m1 || blockExplain.moments?.m1 || NaN, 3);
      const kl = fmt(blockExplain.klDivergence || NaN, 3);
      const std = fmt(blockExplain.robustStd || NaN, 3);
      const cv = fmt(blockExplain.cv || NaN, 3);
      const rawVal = fmt(blockExplain.rawSliders?.[s.slider] || NaN, 2);
      const m0Per = fmt(blockExplain.momentsBreakdown?.[s.slider]?.m0 || NaN, 3);
      const m1Per = fmt(blockExplain.momentsBreakdown?.[s.slider]?.m1 || NaN, 3);
      const bootAvg = fmt(blockExplain.bootstrapPerMode?.[blockMode]?.avgP || NaN, 3);
      const bootStd = fmt(blockExplain.bootstrapPerMode?.[blockMode]?.stdP || NaN, 3);
      const partial = fmt(blockExplain.partialImpact || 0, 3);
      const drift = fmt(blockExplain.chainingDrift || NaN, 1);

      rows.push(csvRow([
        label,
        badge,
        safe(s.slider),
        safe(cat),
        bandOf(v),
        fmt(v, 4),
        fmt(lamPart, 4),
        fmt(a, 4),
        fmt(b, 4),
        pct(dRaw),
        pct(dProj),
        pct(dTot),
        m0,
        m1,
        kl,
        std,
        cv,
        rawVal,
        m0Per,
        m1Per,
        bootAvg,
        bootStd,
        partial,
        drift
      ]));
    }
    rows.push(csvRow([
      label,
      badge,
      'Σ','','','','','','','','','', '', '', '', '', '', '', '', '', '', '', '', '', ''
    ]));
    rows.push(csvRow([
      '',
      '',
      '',
      pct(Number(blockExplain.finalProb ?? 0) - Number(blockExplain.baselineProb ?? 0)),
      '',
      fmt(blockExplain.klDivergence || '', 3),
      fmt(blockExplain.robustStd || '', 3),
      fmt(blockExplain.chainingDrift || '', 1)
    ]));
  };

  if (adjusted?.explain) pushBlock('Adjusted', adjusted.explain, 'manual');
  if (optimized?.explain) {
    const optMode = optimized.explain.mode || 'fixed';
    pushBlock('Optimized', optimized.explain, optMode);
  }

  if (!adjusted?.explain && !optimized?.explain) {
    const placeholderMode = getModeBadge('manual');
    rows.push(csvRow(['Baseline', placeholderMode, '(no sliders moved)','-','-','0','0','0','0',pct(0),pct(0),pct(0), '', '', '', '', '', '', '', '', '', '', '', '']));
  }

  return rows.join('\n');
}

function buildReportsArray(taskMeta, adjusted, optimized) {
  const out = [];

  const toEntry = (modeLabel, block) => {
    if (!block || !block.explain) return null;
    const ex = block.explain;
    const baselineProb = Number.isFinite(ex.baselineProb) ? ex.baselineProb : null;
    const finalProb = Number.isFinite(ex.finalProb) ? ex.finalProb : null;
    const lift = (baselineProb != null && finalProb != null) ? (finalProb - baselineProb) : null;
    const cert = (typeof block.certificate === 'string')
      ? block.certificate
      : (block.certificate ? JSON.stringify(block.certificate) : '—');

    const modeBadge = getModeBadge(ex.mode || (modeLabel.toLowerCase() === 'adjusted' ? 'manual' : 'fixed'), !!ex.seedBest);
    const modeSuffix = ` (${modeBadge})`;

    let sacoSuffix = '';
    if (ex.klDivergence != null || ex.robustStd != null || ex.moments || ex.chainingDrift != null) {
      sacoSuffix = ` (KL=${fmt(ex.klDivergence,3)}, std=${fmt(ex.robustStd,3)}${ex.moments ? ', moments' : ''}${ex.chainingDrift != null ? `, drift=${fmt(ex.chainingDrift,1)}%` : ''})`;
    }

    return {
      mode: modeLabel,
      narrative: ((ex.narrative || '') + modeSuffix + sacoSuffix),
      target: Number.isFinite(taskMeta?.targetValue) ? taskMeta.targetValue : taskMeta?.mostLikely ?? null,
      baselineProbability: baselineProb,
      finalProbability: finalProb,
      liftPoints: lift,
      lambda: (ex.projection && Number.isFinite(ex.projection.lambda)) ? ex.projection.lambda : null,
      certificate: cert,
      diagnostics: {
        monotonicityAtTarget: ex.monotonicityAtTarget || 'N/A',
        allZeroSlidersPassThrough: ex.allZeroSlidersPassThrough || 'N/A',
        winnerHasSliders: (ex.winningSliders && Object.keys(ex.winningSliders).length > 0) ? true : false,
        chainingDrift: ex.chainingDrift || 'N/A'
      },
      counterIntuition: Array.isArray(ex.counterIntuition) ? ex.counterIntuition : [],
      recommendations: Array.isArray(ex.recommendations) ? ex.recommendations : [],
      bands: ex.bands || {},
      winningSliders: ex.winningSliders || {},
      sliderCategories: ex.sliderCategories || {},
      klDivergence: ex.klDivergence || null,
      robustStd: ex.robustStd || null,
      moments: ex.moments || null,
      chainingDrift: ex.chainingDrift || null,
      scaledSliders: ex.slidersScaled || null,
      normalizedSliders: ex.slidersNormalized || null,
      cv: ex.cv || null,
      rawSliders: ex.rawSliders || null,
      momentsBreakdown: ex.momentsBreakdown || null,
      bootstrapPerMode: ex.bootstrapPerMode || null,
      partialImpact: ex.partialImpact || null
    };
  };

  const adj = toEntry('Adjusted', adjusted);
  const opt = toEntry('Optimize', optimized);
  if (adj) out.push(adj);
  if (opt) out.push(opt);

  return out;
}

function buildReports({ taskMeta, baseline, adjusted, optimized, mode }) {
  const baselineCsv = buildBaselineCsv(taskMeta, baseline);
  const decisionCsv = buildDecisionCsv(taskMeta, baseline, adjusted, optimized, mode);

  const summaries = {
    baseline: summarizeBaseline(taskMeta, baseline),
    adjusted: adjusted?.explain ? summarizeExplain('Adjusted', adjusted.explain) : null,
    optimized: optimized?.explain ? summarizeExplain('Optimized', optimized.explain) : null
  };

  const reports = buildReportsArray(taskMeta, adjusted, optimized);

  return {
    baselineCsv,
    decisionCsv,
    summaries,
    meta: {
      builtAt: new Date().toISOString(),
      task: taskMeta?.task || '',
      targetValue: taskMeta?.targetValue ?? taskMeta?.mostLikely ?? null,
      confidenceLevel: taskMeta?.confidenceLevel ?? null
    },
    reports
  };
}
