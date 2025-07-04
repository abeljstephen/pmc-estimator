// https://github.com/abeljstephen/pmc-estimator/blob/main/system-google-cloud-functions-api/core.js

'use strict';

const math = require('mathjs');
const jstat = require('jstat');
const functions = require('@google-cloud/functions-framework');

functions.http('pmcEstimatorAPI', (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Validate request
  if (!req.body || !Array.isArray(req.body)) {
    return res.status(400).json({ error: "Request body must be a JSON array of tasks." });
  }

  const tasks = req.body.map(task => ({
    task: task.task || `Task ${req.body.indexOf(task) + 1}`,
    optimistic: parseFloat(task.optimistic || task.bestCase),
    mostLikely: parseFloat(task.mostLikely),
    pessimistic: parseFloat(task.pessimistic || task.worstCase)
  }));

  if (!tasks.every(task => 
    !isNaN(task.optimistic) && 
    !isNaN(task.mostLikely) && 
    !isNaN(task.pessimistic))) {
    return res.status(400).json({ error: "All estimates (optimistic, mostLikely, pessimistic) must be numbers." });
  }

  try {
    const results = tasks.map(processTask);
    res.json({ results, message: "Batch estimation successful" });
  } catch (err) {
    console.error("Error in pmcEstimatorAPI:", err.stack);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
});

function processTask(task) {
  const { optimistic, mostLikely, pessimistic } = task;

  // Validate inputs
  if (pessimistic - optimistic <= 0) {
    throw new Error(`Invalid range for task ${task.task}: pessimistic (${pessimistic}) must be greater than optimistic (${optimistic})`);
  }
  if (optimistic > mostLikely || mostLikely > pessimistic) {
    throw new Error(`Invalid passage order for task ${task.task}: optimistic (${optimistic}) <= mostLikely (${mostLikely}) <= pessimistic (${pessimistic})`);
  }

  // Calculate triangular distribution points (Triangle plot)
  const numPoints = 100;
  const trianglePoints = [];
  const step = (pessimistic - optimistic) / (numPoints - 1);
  const peak = 2 / (pessimistic - optimistic);

  for (let i = 0; i < numPoints; i++) {
    const x = optimistic + i * step;
    let y;
    if (x < optimistic || x > pessimistic) y = 0;
    else if (x <= mostLikely) y = (2 * (x - optimistic)) / ((pessimistic - optimistic) * (mostLikely - optimistic));
    else y = (2 * (pessimistic - x)) / ((pessimistic - optimistic) * (pessimistic - mostLikely));
    trianglePoints.push([x, y]);
  }

  const trianglePointsObj = { x: trianglePoints.map(p => p[0]), y: trianglePoints.map(p => p[1]) };

  // Calculate PERT distribution points (PERT Beta plot)
  const pertPoints = calculatePERTDistribution(optimistic, mostLikely, pessimistic);

  // Calculate Beta distribution points (Beta plot)
  const betaPoints = calculateBetaDistribution(optimistic, mostLikely, pessimistic);

  // Generate Monte Carlo samples (Monte Carlo plot)
  const mcBetaSamples = generateMonteCarloSamples(optimistic, mostLikely, pessimistic, 10000);

  // Smooth histogram (Smoothed MC plot)
  const smoothedHistogram = smoothHistogram(mcBetaSamples);

  // Compute CDFs (Optimizer and Target Explorer plots/tables)
  const originalCdf = computeCDF(smoothedHistogram);
  const mcSmoothedVaR90 = computeVaR90(originalCdf);
  const optimizedCdf = computeTargetOptimizedCdf(0, 0, 0, 0, mcSmoothedVaR90);

  // Calculate metrics
  const triangleMean = (optimistic + mostLikely + pessimistic) / 3;
  const pertMean = (optimistic + 4 * mostLikely + pessimistic) / 6;
  const mcMean = mcBetaSamples.reduce((a, b) => a + b, 0) / mcBetaSamples.length;
  const mcStdDev = Math.sqrt(mcBetaSamples.reduce((a, b) => a + Math.pow(b - mcMean, 2), 0) / mcBetaSamples.length);
  const mcSkewness = computeSkewness(mcBetaSamples, mcMean, mcStdDev);
  const percentiles = computePercentiles(originalCdf);
  const triangleMetrics = { mean: triangleMean, stdDev: 0, percentiles, skewness: 0 };
  const betaMetrics = { mean: pertMean, stdDev: 0, percentiles, skewness: 0 };
  const mcMetrics = { mean: mcMean, stdDev: mcStdDev, percentiles, skewness: mcSkewness };

  // Weighted estimates
  const weightedOptimistic = optimistic;
  const weightedNeutral = mostLikely;
  const weightedConservative = pessimistic;

  return {
    task: task.task,
    estimates: { optimistic, mostLikely, pessimistic },
    trianglePoints: trianglePointsObj,
    pertPoints,
    betaPoints,
    mcBetaSamples,
    smoothedHistogram,
    originalCdf,
    optimizedCdf,
    weightedOptimistic,
    weightedNeutral,
    weightedConservative,
    triangleMean,
    pertMean,
    mcSmoothedMean: mcMean,
    triangleMetrics,
    betaMetrics,
    mcMetrics,
    mcSmoothedVaR90
  };
}

// Helper functions (all retained from original core.js)
function calculatePERTDistribution(optimistic, mostLikely, pessimistic) {
  const numPoints = 100;
  const points = [];
  const step = (pessimistic - optimistic) / (numPoints - 1);
  const scale = 6 / (pessimistic - optimistic);
  for (let i = 0; i < numPoints; i++) {
    const x = optimistic + i * step;
    let y = 0;
    if (x >= optimistic && x <= pessimistic) {
      const t = (x - optimistic) / (pessimistic - optimistic);
      y = scale * t * (1 - t) * Math.exp(4 * (t - 0.5) * (t - 0.5));
      if (x <= mostLikely) y *= (mostLikely - optimistic) / (pessimistic - optimistic);
      else y *= (pessimistic - mostLikely) / (pessimistic - optimistic);
    }
    points.push([x, y]);
  }
  return { x: points.map(p => p[0]), y: points.map(p => p[1]) };
}

function calculateBetaDistribution(optimistic, mostLikely, pessimistic) {
  const numPoints = 100;
  const alpha = 2 + 4 * (mostLikely - optimistic) / (pessimistic - optimistic);
  const beta = 2 + 4 * (pessimistic - mostLikely) / (pessimistic - optimistic);
  const points = [];
  const step = (pessimistic - optimistic) / (numPoints - 1);
  for (let i = 0; i < numPoints; i++) {
    const x = optimistic + i * step;
    const t = (x - optimistic) / (pessimistic - optimistic);
    const y = t ** (alpha - 1) * (1 - t) ** (beta - 1) / betaFunction(alpha, beta);
    points.push([x, y]);
  }
  return { x: points.map(p => p[0]), y: points.map(p => p[1]) };
}

function betaFunction(alpha, beta) {
  return gamma(alpha) * gamma(beta) / gamma(alpha + beta);
}

function gamma(z) {
  try {
    if (z <= 0) throw new Error('Gamma function not defined for non-positive numbers');
    if (z === 1) return 1;
    if (z === 0.5) return Math.sqrt(Math.PI);

    const p = [
      0.99999999999980993,
      676.5203681218851,
      -1259.1392167224028,
      771.32342877765313,
      -176.61502916214059,
      12.507343278686905,
      -0.13857109526572012,
      9.9843695780195716e-6,
      1.5056327351493116e-7
    ];
    let g = 7;
    if (z < 0.5) {
      return Math.PI / (Math.sin(Math.PI * z) * gamma(1 - z));
    }
    z -= 1;
    let a = p[0];
    let t = z + g + 0.5;
    for (let i = 1; i < p.length; i++) {
      a += p[i] / (z + i);
    }
    return Math.sqrt(2 * Math.PI) * Math.pow(t, z + 0.5) * Math.exp(-t) * a;
  } catch (err) {
    throw new Error(`Gamma function error: ${err.message}`);
  }
}

function generateMonteCarloSamples(optimistic, mostLikely, pessimistic, samples = 10000) {
  const results = [];
  for (let i = 0; i < samples; i++) {
    const r1 = Math.random();
    const r2 = Math.random();
    const mean = (optimistic + 4 * mostLikely + pessimistic) / 6;
    const stdDev = (pessimistic - optimistic) / 6;
    results.push(mean + stdDev * (Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2)));
  }
  return results;
}

function smoothHistogram(samples) {
  const bins = 30;
  const min = Math.min(...samples);
  const max = Math.max(...samples);
  const binWidth = (max - min) / bins;
  const histogram = Array(bins).fill(0);
  samples.forEach(s => {
    const idx = Math.min(Math.floor((s - min) / binWidth), bins - 1);
    histogram[idx]++;
  });
  const norm = samples.length * binWidth;
  return histogram.map((count, i) => ({
    x: min + i * binWidth + binWidth / 2,
    y: count / norm
  }));
}

function computeCDF(histogram) {
  const cdf = [];
  let cumulative = 0;
  const binWidth = histogram.length > 1 ? histogram[1].x - histogram[0].x : 1;
  histogram.forEach(p => {
    cumulative += p.y * binWidth;
    cdf.push({ x: p.x, y: Math.min(cumulative, 1) });
  });
  return cdf;
}

function computeVaR90(cdf) {
  for (let i = 0; i < cdf.length; i++) {
    if (cdf[i].y >= 0.9) return cdf[i].x;
  }
  return cdf[cdf.length - 1].x;
}

function computeTargetOptimizedCdf(budget, schedule, scope, risk, vaR90) {
  const adjustment = (budget + schedule - scope + risk) / 4;
  const shift = vaR90 * adjustment;
  const histogram = smoothHistogram(generateMonteCarloSamples(0, 0, 0));
  return histogram.map(p => ({
    x: p.x + shift,
    y: p.y
  }));
}

function computePercentiles(cdf) {
  return { "50": cdf[Math.floor(cdf.length * 0.5)].x, "90": cdf[Math.floor(cdf.length * 0.9)].x };
}

function computeSkewness(samples, mean, stdDev) {
  const n = samples.length;
  const m3 = samples.reduce((a, b) => a + Math.pow(b - mean, 3), 0) / n;
  return m3 / Math.pow(stdDev, 3);
}
