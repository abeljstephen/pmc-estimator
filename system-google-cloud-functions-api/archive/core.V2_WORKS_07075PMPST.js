const functions = require('@google-cloud/functions-framework');
const jstat = require('jstat');

// Define processTask function to generate statistical data
function processTask(task) {
  const { optimistic, mostLikely, pessimistic } = task;
  // Using PERT approximation for mean and standard deviation
  const mean = (optimistic + 4 * mostLikely + pessimistic) / 6;
  const stdDev = (pessimistic - optimistic) / 6;
  const median = mean; // For normal distribution approximation

  // Generate x values for PDF and CDF points
  const numPoints = 100;
  const xMin = mean - 3 * stdDev;
  const xMax = mean + 3 * stdDev;
  const step = (xMax - xMin) / (numPoints - 1);
  const xValues = Array.from({ length: numPoints }, (_, i) => xMin + i * step);

  // Compute PDF and CDF points using jstat for normal distribution
  const pdfPoints = xValues.map(x => ({ x, y: jstat.normal.pdf(x, mean, stdDev) }));
  const cdfPoints = xValues.map(x => ({ x, y: jstat.normal.cdf(x, mean, stdDev) }));

  return {
    mcSmoothedCdfPoints: { value: cdfPoints },
    mcSmoothedPoints: { value: pdfPoints },
    mcSmoothedMean: { value: mean },
    mcSmoothedStdDev: { value: stdDev },
    mcSmoothedMedian: { value: median },
  };
}

// Retain original function: computeOriginalCdfPoints
function computeOriginalCdfPoints(task) {
  const baseData = processTask(task);
  return baseData.mcSmoothedCdfPoints.value;
}

// Retain original function: computeOptimizedCdfPoints
function computeOptimizedCdfPoints(task, budgetFlex, scheduleFlex, scopeUncert, riskTol, targetValue) {
  const baseData = processTask(task);
  const { mcSmoothedPoints } = baseData;
  const originalMean = baseData.mcSmoothedMean.value;
  const originalStdDev = baseData.mcSmoothedStdDev.value;
  const BF = budgetFlex / 100, SF = scheduleFlex / 100, SU = scopeUncert / 100, RT = riskTol / 100;
  const shiftFactor = 0.2, varianceFactor = 2.0, skewFactorRT = -0.05, skewFactorSU = 0.2;
  const meanShift = shiftFactor * originalStdDev * (-BF - SF + 0.5 * SU);
  const varianceScale = 1 + varianceFactor * SU;
  const skewAdjustment = skewFactorRT * RT + skewFactorSU * SU;
  const allZero = BF === 0 && SF === 0 && SU === 0 && RT === 0;
  let optPoints = JSON.parse(JSON.stringify(mcSmoothedPoints.value));
  const step = optPoints.length > 1 ? optPoints[1].x - optPoints[0].x : 1;

  if (!allZero) {
    const shiftedMean = originalMean + meanShift;
    optPoints.forEach(p => {
      p.x = varianceScale * (p.x - originalMean) + shiftedMean;
      p.y /= varianceScale;
    });
    if (RT > 0 || SU > 0) {
      const skewFactors = optPoints.map(p => Math.exp(skewAdjustment * (p.x - shiftedMean) / originalStdDev));
      optPoints.forEach((p, i) => p.y *= skewFactors[i]);
    }
    const totalDensityAdjusted = optPoints.reduce((sum, p) => sum + p.y * step, 0);
    if (totalDensityAdjusted > 0) optPoints.forEach(p => p.y /= totalDensityAdjusted);
  }

  const sortedPoints = optPoints.slice().sort((a, b) => a.x - b.x);
  let cumulative = 0;
  const cdfPoints = [{ x: sortedPoints[0].x, y: 0 }];
  for (let i = 1; i < sortedPoints.length; i++) {
    const dx = sortedPoints[i].x - sortedPoints[i - 1].x;
    const avgY = (sortedPoints[i - 1].y + sortedPoints[i].y) / 2;
    cumulative += avgY * dx;
    cdfPoints.push({ x: sortedPoints[i].x, y: Math.min(cumulative, 1) });
  }
  return cdfPoints;
}

// Retain original function: computeCombinationExplorerData
function computeCombinationExplorerData(task, targetValue) {
  const baseData = processTask(task);
  const discreteValues = [0, 25, 50, 75, 100];
  const combinations = [];
  for (let bf of discreteValues) {
    for (let sf of discreteValues) {
      for (let su of discreteValues) {
        for (let rt of discreteValues) {
          const optCdfPoints = computeOptimizedCdfPoints(task, bf, sf, su, rt, targetValue);
          let prob = 0;
          for (let i = 0; i < optCdfPoints.length; i++) {
            if (optCdfPoints[i].x >= targetValue) {
              prob = optCdfPoints[i].y * 100;
              break;
            }
          }
          combinations.push({ bf, sf, su, rt, prob });
        }
      }
    }
  }
  return combinations;
}

// Retain original function: computeAnalysisReportData
function computeAnalysisReportData(task, budgetFlex, scheduleFlex, scopeUncert, riskTol, targetValue) {
  const baseData = processTask(task);
  const originalCdfPoints = baseData.mcSmoothedCdfPoints.value;
  const optimizedCdfPoints = computeOptimizedCdfPoints(task, budgetFlex, scheduleFlex, scopeUncert, riskTol, targetValue);
  const BF = budgetFlex / 100, SF = scheduleFlex / 100, SU = scopeUncert / 100, RT = riskTol / 100;
  const shiftFactor = 0.2, varianceFactor = 2.0, skewFactorRT = -0.05, skewFactorSU = 0.2;
  const meanShift = shiftFactor * baseData.mcSmoothedStdDev.value * (-BF - SF + 0.5 * SU);
  const varianceScale = 1 + varianceFactor * SU;
  const skewAdjustment = skewFactorRT * RT + skewFactorSU * SU;
  const optimizedMean = baseData.mcSmoothedMean.value + meanShift;
  const optimizedStdDev = baseData.mcSmoothedStdDev.value * Math.sqrt(varianceScale);
  let origProb = 0, optProb = 0;
  for (let i = 0; i < originalCdfPoints.length; i++) {
    if (originalCdfPoints[i].x >= targetValue) {
      origProb = originalCdfPoints[i].y * 100;
      break;
    }
  }
  for (let i = 0; i < optimizedCdfPoints.length; i++) {
    if (optimizedCdfPoints[i].x >= targetValue) {
      optProb = optimizedCdfPoints[i].y * 100;
      break;
    }
  }
  return {
    originalMedian: baseData.mcSmoothedMedian.value,
    originalMean: baseData.mcSmoothedMean.value,
    originalStdDev: baseData.mcSmoothedStdDev.value,
    optimizedMean,
    optimizedStdDev,
    meanShift,
    varianceScale,
    skewAdjustment,
    origProb,
    optProb
  };
}

// Define and register the API handler
const pmcEstimatorAPI = (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).send('');
  if (!req.body) {
    return res.status(400).json({ error: 'Request body is required.' });
  }
  try {
    if (req.body.task && req.body.sliders && req.body.targetValue) {
      const { task, sliders, targetValue } = req.body;
      const baseData = processTask(task);
      const originalCdfPoints = computeOriginalCdfPoints(task);
      const optimizedCdfPoints = computeOptimizedCdfPoints(task, sliders.budgetFlex, sliders.scheduleFlex, sliders.scopeUncert, sliders.riskTol, targetValue);
      const combinationExplorerData = computeCombinationExplorerData(task, targetValue);
      const analysisReportData = computeAnalysisReportData(task, sliders.budgetFlex, sliders.scheduleFlex, sliders.scopeUncert, sliders.riskTol, targetValue);
      res.json({
        originalCdfPoints,
        optimizedCdfPoints,
        combinationExplorerData,
        analysisReportData
      });
    } else if (Array.isArray(req.body)) {
      const results = req.body.map(task => {
        try {
          return processTask(task);
        } catch (err) {
          return { error: `Failed to process task ${task.task}: ${err.message}` };
        }
      });
      res.json({ results });
    } else {
      res.status(400).json({ error: 'Invalid request body.' });
    }
  } catch (err) {
    console.error('Error in pmcEstimatorAPI:', err.stack);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
};

// Register the function with the framework
functions.http('pmcEstimatorAPI', pmcEstimatorAPI);

// Export the function as an object property
module.exports = { pmcEstimatorAPI };
