// baseline/monte-carlo-smoothed.gs — Monte Carlo smoothing via KDE (pure Apps Script - global)
// Force sync - Jan 16 2026 - Node.js removed

/**
 * Smooth RAW Monte Carlo samples via Gaussian KDE on a regular grid. v1.9.24
 * If samples are not provided, fallback to Beta(α,β) sampling on [O,P].
 * Returns { pdfPoints, cdfPoints } with strict hygiene:
 *  • pdf integrates to 1 (trapezoid)
 *  • cdf is sorted by x, y∈[0,1], non-decreasing, and ends at 1.0
 * SACO Step 1: Smoothed baseline pdf/cdf for P_0(τ); used in Step 5 refit interp (monotone ensures KL computable).
 * Math: KDE h=range/63.3 (rule-of-thumb); renormalize ∫pdf=1 for exp(-KL) fidelity; Ch.6: erf-slack via clamp.
 */
function generateMonteCarloSmoothedPoints(params) {
  console.log('generateMonteCarloSmoothedPoints: Starting', {
    params: { ...params, samples: Array.isArray(params?.samples) ? `(n=${params.samples.length})` : undefined }
  });
  console.time('generateMonteCarloSmoothedPoints');
  try {
    const { optimistic, mostLikely, pessimistic, numSamples = 2000, samples: rawSamples } = params;

    if (![optimistic, mostLikely, pessimistic].every(Number.isFinite)) {
      throw new Error('Invalid estimates: must be finite numbers');
    }
    if (!(optimistic <= mostLikely && mostLikely <= pessimistic)) {
      throw new Error('Estimates must satisfy optimistic <= mostLikely <= pessimistic');
    }
    const range = pessimistic - optimistic;
    if (range <= 0) throw new Error('Degenerate case: zero range');
    if (!Number.isFinite(numSamples) || numSamples < 100) {
      throw new Error('Invalid numSamples: must be >= 100');
    }

    // Prefer provided samples; else sample from Beta over [O,P]
    let samples = Array.isArray(rawSamples) ? rawSamples.slice() : null;
    if (!samples || samples.length === 0) {
      const { alpha, beta } = computeBetaMoments({ optimistic, mostLikely, pessimistic });
      if (!Number.isFinite(alpha) || !Number.isFinite(beta) || alpha <= 0 || beta <= 0) {
        throw new Error('Invalid beta parameters');
      }
      samples = Array(numSamples).fill().map(() => optimistic + betaSample(alpha, beta) * range);
    }

    // Clamp to [O,P]
    samples = samples.map(s => Math.max(optimistic, Math.min(pessimistic, Number(s)))).filter(Number.isFinite);

    // KDE on a fixed grid (200 points)
    const nPoints = 200;
    const xMin = optimistic, xMax = pessimistic;
    const dx = (xMax - xMin) / (nPoints - 1);
    const pdf = Array.from({ length: nPoints }, (_, i) => ({ x: xMin + i * dx, y: 0 }));

    // Bandwidth (simple rule-of-thumb)
    const h = range / 63.3;
    const invH = 1 / h;
    const invSqrt2pi = 1 / Math.sqrt(2 * Math.PI);

    for (let i = 0; i < nPoints; i++) {
      const x = pdf[i].x;
      let sum = 0;
      for (const s of samples) {
        const z = (x - s) * invH;
        sum += Math.exp(-0.5 * z * z) * invH * invSqrt2pi;
      }
      pdf[i].y = sum / samples.length;
    }

    // Normalize PDF by trapezoid rule
    const area = trapezoidIntegral(pdf);
    if (!(area > 0 && Number.isFinite(area))) throw new Error('Invalid PDF integral');
    const nPdf = pdf.map(p => ({ x: p.x, y: p.y / area }));

    // Build CDF by cumulative trapezoid (same grid), then enforce hygiene
    const cdfRaw = [];
    let cum = 0;
    cdfRaw.push({ x: nPdf[0].x, y: 0 });
    for (let i = 1; i < nPdf.length; i++) {
      const dxSeg = nPdf[i].x - nPdf[i - 1].x;
      cum += 0.5 * (nPdf[i - 1].y + nPdf[i].y) * dxSeg;
      cdfRaw.push({ x: nPdf[i].x, y: cum });
    }
    // Clamp numeric drift and enforce monotone + tail=1
    let cdf = cdfRaw.map(p => ({ x: p.x, y: Math.max(0, Math.min(1, p.y)) }));
    cdf = ensureSortedMonotoneCdf(cdf);
    if (cdf.length) cdf[cdf.length - 1].y = 1.0;

    if (!isValidPdfArray(nPdf) || !isValidCdfArray(cdf)) {
      throw new Error('Invalid PDF/CDF points generated');
    }

    console.log('generateMonteCarloSmoothedPoints: Completed', {
      pdfPointsLength: nPdf.length, cdfPointsLength: cdf.length
    });
    console.timeEnd('generateMonteCarloSmoothedPoints');
    return { pdfPoints: nPdf, cdfPoints: cdf };
  } catch (error) {
    console.error('generateMonteCarloSmoothedPoints: Error', { message: error.message, stack: error.stack });
    return { pdfPoints: [], cdfPoints: [], error: error.message };
  }
}
