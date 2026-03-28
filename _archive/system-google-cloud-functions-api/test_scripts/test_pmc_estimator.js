// test_pmc_estimator.js
const { pmcEstimatorAPI } = require('./core/core-master');

async function testPmcEstimator(targetValue) {
  try {
    const tasks = [{
      task: `Cost (Target ${targetValue})`,
      optimistic: 1800,
      mostLikely: 2400,
      pessimistic: 3000,
      sliderValues: {
        budgetFlexibility: 0,
        scheduleFlexibility: 0,
        scopeCertainty: 0,
        scopeReductionAllowance: 0,
        reworkPercentage: 0,
        riskTolerance: 0
      },
      targetValue: targetValue,
      confidenceLevel: 0.9,
      optimizeFor: "target",
      optimize: true,
      userSlider_Confidence: "confident"
    }];
    console.log('Testing pmcEstimatorAPI with input:', JSON.stringify(tasks, null, 2));
    process.env.USE_CORE = "1";
    const result = await pmcEstimatorAPI(tasks);
    
    // Log values for estimate calculations tab
    const taskResult = result.results[0];
    console.log('Estimate Calculations Tab Values:');
    console.log('Name:', taskResult.task?.value);
    console.log('Best Case:', taskResult.optimistic?.value);
    console.log('Most Likely:', taskResult.mostLikely?.value);
    console.log('Worst Case:', taskResult.pessimistic?.value);
    console.log('PERT:', taskResult.pertMean?.value);
    console.log('MC Smoothed 95% CI Lower:', taskResult.allCIs?.value?.monteCarloSmoothed?.lower);
    console.log('MC Smoothed 95% CI Upper:', taskResult.allCIs?.value?.monteCarloSmoothed?.upper);
    console.log('% Confidence of Original Target Value:', (taskResult.targetProbability?.value?.original * 100).toFixed(1));
    console.log('Optimal Budget Flexibility:', taskResult.optimalSliderSettings?.value?.budgetFlexibility);
    console.log('Optimal Schedule Flexibility:', taskResult.optimalSliderSettings?.value?.scheduleFlexibility);
    console.log('Optimal Scope Certainty:', taskResult.optimalSliderSettings?.value?.scopeCertainty);
    console.log('Optimal Scope Reduction Allowance:', taskResult.optimalSliderSettings?.value?.scopeReductionAllowance);
    console.log('Optimal Rework Percentage:', taskResult.optimalSliderSettings?.value?.reworkPercentage);
    console.log('Optimal Risk Tolerance:', taskResult.optimalSliderSettings?.value?.riskTolerance);
    console.log('% Confidence of Original Target Value After Slider Optimization:', (taskResult.targetProbability?.value?.adjustedOptimized * 100).toFixed(1));
    console.log('MC Smoothed Sensitivity Change:', taskResult.sliderSensitivity?.value?.change?.toFixed(2));
    console.log('KL Divergence To Triangle:', taskResult.sensitivityMatrix?.value?.['triangle-monteCarloSmoothed']?.toFixed(2));
    console.log('MC Smoothed Points:', JSON.stringify(taskResult.adjustedResults?.value?.monteCarloSmoothed?.pdfPoints?.slice(0, 5)));
    console.log('CDF Points:', JSON.stringify(taskResult.adjustedResults?.value?.monteCarloSmoothed?.cdfPoints?.slice(0, 5)));
    console.log('Status:', taskResult.feedbackMessages?.join('; '));
    
    // Validate response
    const requiredFields = [
      'task', 'optimistic', 'mostLikely', 'pessimistic', 'pertMean', 'metrics', 'allCIs',
      'targetProbability', 'optimalSliderSettings', 'sliderSensitivity',
      'sensitivityMatrix', 'allDistributions', 'adjustedResults', 'adjustedPoints', 'optimizedPoints',
      'mcSmoothedMean', 'mcSmoothedVaR95', 'valueAtConfidence'
    ];
    const missingFields = requiredFields.filter(field => !taskResult[field]);
    if (missingFields.length > 0) {
      console.error('Test Failed: Missing required fields', { missingFields });
      process.exit(1);
    }
    if (!taskResult.adjustedResults?.value?.monteCarloSmoothed?.pdfPoints?.length || 
        !taskResult.adjustedResults?.value?.monteCarloSmoothed?.cdfPoints?.length) {
      console.error('Test Failed: Empty adjustedResults.monteCarloSmoothed', {
        pdfPointsLength: taskResult.adjustedResults?.value?.monteCarloSmoothed?.pdfPoints?.length,
        cdfPointsLength: taskResult.adjustedResults?.value?.monteCarloSmoothed?.cdfPoints?.length
      });
      process.exit(1);
    }
    console.log('Test Passed: pmcEstimatorAPI returned valid result');
    return taskResult;
  } catch (err) {
    console.error('Test Failed: Error in pmcEstimatorAPI', err.message, err.stack);
    process.exit(1);
  }
}

// Run tests for multiple targets
async function runTests() {
  const targets = [1800, 2400, 3000]; // Best case, most likely, worst case
  for (const target of targets) {
    console.log(`\n=== Testing with targetValue: ${target} ===`);
    await testPmcEstimator(target);
  }
  process.exit(0);
}

runTests();
