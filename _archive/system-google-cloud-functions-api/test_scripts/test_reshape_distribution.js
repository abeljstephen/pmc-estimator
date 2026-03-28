// File: test_reshape_distribution.js
// Purpose: Tests the reshapeDistribution function from core/reshaping/slider-adjustments.js
// Used in: deploy_pmc.sh step 14.7
// Validates: Reshapes Monte Carlo smoothed points with zeroed sliders, ensuring valid PDF and CDF points
// Ensures: Returns non-empty arrays for pdfPoints and cdfPoints with at least 2 elements each

const { generateMonteCarloSmoothedPoints } = require('../core/baseline/monte-carlo-smoothed');
const { reshapeDistribution } = require('../core/reshaping/slider-adjustments');

(async () => {
  try {
    // Generate input points
    const { pdfPoints } = await generateMonteCarloSmoothedPoints({ optimistic: 1800, mostLikely: 2400, pessimistic: 3000, alpha: 4, beta: 4 });
    
    // Test reshapeDistribution with zeroed sliders
    const result = await reshapeDistribution({
      points: pdfPoints,
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
      distributionType: 'monteCarloSmoothed',
      userSlider_Confidence: 'confident',
      shiftDirection: -1
    });
    
    // Validate output arrays
    if (!Array.isArray(result.pdfPoints) || !Array.isArray(result.cdfPoints) || result.pdfPoints.length < 2 || result.cdfPoints.length < 2) {
      console.error('Test Failed: Invalid adjusted points', { pdfPointsLength: result.pdfPoints.length, cdfPointsLength: result.cdfPoints.length });
      process.exit(1);
    }
    
    console.log('Test Passed: reshapeDistribution returned valid result', { pdfPoints: result.pdfPoints.slice(0, 5), cdfPoints: result.cdfPoints.slice(0, 5) });
    process.exit(0);
  } catch (err) {
    console.error('Test Failed: Error in reshapeDistribution', err.message, err.stack);
    process.exit(1);
  }
})();
