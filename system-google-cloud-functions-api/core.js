// core.js
// https://github.com/abeljstephen/pmc-estimator/blob/main/system-google-cloud-functions-api/core.js

'use strict';

const math = require('mathjs');
const jstat = require('jstat');
const functions = require('@google-cloud/functions-framework');

// --- Utility Functions ---
// These functions are used throughout the module for calculations and validations

/**
 * Validates the estimates to ensure optimistic <= mostLikely <= pessimistic.
 * Throws an error if the condition is not met.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 */
function validateEstimates(optimistic, mostLikely, pessimistic) {
  if (!Number.isFinite(optimistic) || !Number.isFinite(mostLikely) || !Number.isFinite(pessimistic)) {
    throw new Error('Estimates must be finite numbers');
  }
  if (optimistic > mostLikely || mostLikely > pessimistic) {
    throw new Error('Invalid estimates: optimistic <= mostLikely <= pessimistic required');
  }
}

// --- Active Functions ---
// These functions are currently in use and optimized for performance

/**
 * Calculates the PERT distribution points for plotting.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @returns {Object} An object with x and y arrays for plotting.
 */
function calculatePERTDistribution(optimistic, mostLikely, pessimistic) {
  validateEstimates(optimistic, mostLikely, pessimistic);
  const numPoints = 100; // Fixed to 100 points for performance and accuracy
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

/**
 * Generates Monte Carlo samples for estimation.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @param {number} [samples=1000] - The number of samples to generate.
 * @returns {number[]} An array of Monte Carlo samples.
 */
function generateMonteCarloSamples(optimistic, mostLikely, pessimistic, samples = 1000) {
  validateEstimates(optimistic, mostLikely, pessimistic);
  if (!Number.isInteger(samples) || samples <= 0) {
    throw new Error('Number of samples must be a positive integer');
  }
  const results = [];
  for (let i = 0; i < samples; i++) {
    const r1 = Math.random();
    const r2 = Math.random();
    const mean = (optimistic + 4 * mostLikely + pessimistic) / 6;
    const stdDev = (pessimistic - optimistic) / 6;
    // Box-Muller transform for normal distribution approximation
    results.push(mean + stdDev * Math.sqrt(-2 * Math.log(r1)) * Math.cos(2 * Math.PI * r2));
  }
  return results;
}

/**
 * Creates a smoothed histogram from Monte Carlo samples.
 * @param {number[]} samples - The Monte Carlo samples.
 * @returns {Object[]} An array of objects with x and y for plotting.
 */
function smoothHistogram(samples) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Samples must be a non-empty array');
  }
  const bins = 100; // Fixed to 100 bins for performance and accuracy
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

// --- Additional Utility Functions ---
// These functions provide extra calculations that may be useful in the future

/**
 * Calculates the standard deviation for a triangular distribution.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @returns {number} The standard deviation.
 */
function calculateStandardDeviation(optimistic, mostLikely, pessimistic) {
  validateEstimates(optimistic, mostLikely, pessimistic);
  const a = optimistic, b = mostLikely, c = pessimistic;
  const variance = (a * a + b * b + c * c - a * b - a * c - b * c) / 18;
  return Math.sqrt(variance);
}

/**
 * Calculates the confidence interval for the estimates based on Monte Carlo samples.
 * @param {number[]} samples - The Monte Carlo samples.
 * @param {number} confidenceLevel - The confidence level (e.g., 0.95 for 95%).
 * @returns {Object} An object with lower and upper bounds of the interval.
 */
function calculateConfidenceInterval(samples, confidenceLevel) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Samples must be a non-empty array');
  }
  if (confidenceLevel <= 0 || confidenceLevel >= 1) {
    throw new Error('Confidence level must be between 0 and 1');
  }
  const sorted = samples.slice().sort((a, b) => a - b);
  const lowerIdx = Math.floor((1 - confidenceLevel) / 2 * sorted.length);
  const upperIdx = Math.ceil((1 + confidenceLevel) / 2 * sorted.length) - 1;
  return {
    lower: sorted[lowerIdx],
    upper: sorted[upperIdx]
  };
}

/**
 * Calculates the probability of completing a task by a target value (e.g., time or cost).
 * @param {number[]} samples - The Monte Carlo samples.
 * @param {number} target - The target value to compare against.
 * @returns {number} The probability (between 0 and 1) of being less than or equal to the target.
 */
function calculateProbability(samples, target) {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error('Samples must be a non-empty array');
  }
  if (!Number.isFinite(target)) {
    throw new Error('Target must be a finite number');
  }
  const count = samples.filter(s => s <= target).length;
  return count / samples.length;
}

// --- WARNING: Potentially Large Data Generation ---
// The following functions are not currently needed or may result in JSON being too large.
// Use with caution or modify sample sizes if necessary.

/**
 * Generates a high volume of Monte Carlo samples.
 * @param {number} optimistic - The optimistic estimate.
 * @param {number} mostLikely - The most likely estimate.
 * @param {number} pessimistic - The pessimistic estimate.
 * @returns {number[]} An array of 10,000 Monte Carlo samples.
 */
function generateHighVolumeSamples(optimistic, mostLikely, pessimistic) {
  // WARNING: This may result in JSON being too large when using 10,000 samples.
  const samples = 10000; // High sample count not currently needed
  return generateMonteCarloSamples(optimistic, mostLikely, pessimistic, samples);
}

// --- HTTP Endpoints ---
// These functions handle HTTP requests for the Cloud Function

functions.http('pmcEstimatorAPI', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (!req.body || !Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON array of tasks.' });
  }

  const tasks = req.body.map(task => ({
    task: task.task,
    optimistic: parseFloat(task.optimistic),
    mostLikely: parseFloat(task.mostLikely),
    pessimistic: parseFloat(task.pessimistic)
  }));

  try {
    const results = tasks.map(processTask);
    res.json({ results });
  } catch (err) {
    console.error('Error in pmcEstimatorAPI:', err.stack);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
});

/**
 * Processes a single task and returns its analysis.
 * @param {Object} task - The task object with task name and estimates.
 * @returns {Object} The analysis results for the task.
 */
function processTask(task) {
  const { optimistic, mostLikely, pessimistic } = task;
  const pertPoints = calculatePERTDistribution(optimistic, mostLikely, pessimistic);
  const mcSamples = generateMonteCarloSamples(optimistic, mostLikely, pessimistic);
  const histogram = smoothHistogram(mcSamples);
  const stdDev = calculateStandardDeviation(optimistic, mostLikely, pessimistic);
  const confidenceInterval = calculateConfidenceInterval(mcSamples, 0.95);
  const probabilityUnderMean = calculateProbability(mcSamples, (optimistic + 4 * mostLikely + pessimistic) / 6);

  return {
    task: task.task,
    pertPoints,
    histogram,
    stdDev,
    confidenceInterval,
    probabilityUnderMean
  };
}
