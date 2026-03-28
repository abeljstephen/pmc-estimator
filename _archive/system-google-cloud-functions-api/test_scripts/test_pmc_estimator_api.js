// File: test_pmc_estimator_api.js
// Purpose: Tests the pmcEstimatorAPI function from core/main/main.js
// Used in: deploy_pmc.sh step 15
// Validates: Processes an array of tasks, ensuring valid response structure and required fields
// Ensures: Returns a results array with valid fields, non-empty PDF/CDF points for initialReshapedPoints

const { pmcEstimatorAPI } = require('../core/main/main');

(async () => {
  try {
    // Sample task input
    const tasks = [{
      task: "Cost",
      optimistic: 1800,
      mostLikely: 2400,
      pessimistic: 3000,
      sliderValues: {
        budgetFlexibility: 50,
        scheduleFlexibility: 50,
        scopeCertainty: 50,
        scopeReductionAllowance: 50,
        reworkPercentage: 50,
        riskTolerance: 50
      },
      targetValue: 1800,
      confidenceLevel: 0.9,
      optimizeFor: "target",
      optimize: true,
      userSlider_Confidence: "confident"
    }];
    
    console.log('Test pmcEstimatorAPI: Starting with tasks', JSON.stringify(tasks, null, 2));
    process.env.USE_CORE = "1";
    const result = await pmcEstimatorAPI(tasks);
    console.log('Test pmcEstimatorAPI: Result received', JSON.stringify(result, null, 2));
    
    // Validate response structure
    if (!result.results || !Array.isArray(result.results) || result.results.length !== 1) {
      console.error('Test Failed: Invalid response structure', JSON.stringify(result, null, 2));
      process.exit(1);
    }
    
    const taskResult = result.results[0];
    const requiredFields = [
      'task', 'optimistic', 'mostLikely', 'pessimistic', 'pertMean', 'allCIs',
      'targetProbability', 'optimalSliderSettings', 'correlatedSliders',
      'sliderSensitivity', 'sensitivityMatrix', 'allDistributions',
      'initialReshapedPoints', 'optimizedReshapedPoints', 'mcSmoothedMean',
      'mcSmoothedVaR95'
    ];
    
    // Check for missing fields
    const missingFields = requiredFields.filter(field => !taskResult[field] || (taskResult[field].value === undefined && field !== 'initialReshapedPoints' && field !== 'optimizedReshapedPoints'));
    if (missingFields.length > 0) {
      console.error('Test Failed: Missing required fields in task result', { missingFields, taskResult });
      process.exit(1);
    }
    
    // Validate initialReshapedPoints
    if (!taskResult.initialReshapedPoints.pdfPoints.length || !taskResult.initialReshapedPoints.cdfPoints.length) {
      console.error('Test Failed: Empty initialReshapedPoints in task result', {
        pdfPointsLength: taskResult.initialReshapedPoints.pdfPoints?.length,
        cdfPointsLength: taskResult.initialReshapedPoints.cdfPoints?.length,
        taskResult
      });
      process.exit(1);
    }
    
    console.log('Test Passed: pmcEstimatorAPI returned valid response', JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error('Test Failed: Error in pmcEstimatorAPI', err.message, err.stack, err.details);
    process.exit(1);
  }
})();
