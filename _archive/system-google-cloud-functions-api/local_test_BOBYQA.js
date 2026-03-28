// local_test_BOBYQA.js

// npm install mathjs jstat numeric

// to run this script, `node local_test_BOBYQA.js`

var math = require('mathjs');
var jstat = require('jstat');
var numeric = require('numeric');

// Import from core.js
var {
  BOBYQAOptimalSliderSettings,
  sliderAdjustedPDFandCDFPoints,
  interpolateCdf,
  findValueAtConfidence,
  performKDE,
  calculateMAD,
  calculateCVaR95,
  calculateAlpha,
  calculateBeta,
  calculatePERTMean,
  calculatePERTStdDev
} = require('./core.js');

// Dummy data based on the original curl test payload
var originalMean = 2403.228150783253;
var originalStdDev = 111.24663841376824;
var targetValue = 2500;
var confidenceLevel = 0.9;
var optimistic = 1800;
var mostLikely = 2400;
var pessimistic = 3000;

// Calculate Beta parameters for realistic dummy data
var pertMean = calculatePERTMean(optimistic, mostLikely, pessimistic); // (1800 + 4*2400 + 3000) / 6 = 2400
var pertStdDev = calculatePERTStdDev(optimistic, mostLikely, pessimistic); // sqrt((3000-1800)^2/36) ≈ 200
var betaAlpha = calculateAlpha(pertMean, pertStdDev, optimistic, pessimistic);
var betaBeta = calculateBeta(pertMean, pertStdDev, optimistic, pessimistic);

// Validate Beta parameters
if (!Number.isFinite(betaAlpha) || !Number.isFinite(betaBeta) || betaAlpha <= 0 || betaBeta <= 0) {
  console.error('Invalid Beta parameters:', { betaAlpha, betaBeta });
  throw new Error('Invalid Beta distribution parameters');
}

// Generate dummy PDF and CDF points using PERT distribution
var min = optimistic; // 1800
var max = pessimistic; // 3000
var step = (max - min) / 100;
var xValues = math.range(min, max + step, step).toArray();
var dummyPdfPoints = xValues.map(x => {
  const scaledX = (x - min) / (max - min);
  const y = jstat.beta.pdf(scaledX, betaAlpha, betaBeta) / (max - min);
  return {
    x,
    y: Number.isFinite(y) ? y : 0,
    plotCumulative_Confidence: 0 // Will be updated in CDF calculation
  };
});
var totalArea = dummyPdfPoints.reduce((sum, p) => sum + p.y * step, 0);
var normalizedPdfPoints = dummyPdfPoints.map(p => ({
  x: p.x,
  y: totalArea > 0 ? p.y / totalArea : 0,
  plotCumulative_Confidence: 0
}));
let cumulative = 0;
var dummyCdfPoints = normalizedPdfPoints.map(p => {
  cumulative += p.y * step;
  const y = Math.min(Math.max(cumulative, 0), 1);
  return {
    x: p.x,
    y,
    plotCumulative_Confidence: y * 100
  };
});

// Debug CDF points
console.log('dummyCdfPoints range:', {
  minX: Math.min(...dummyCdfPoints.map(p => p.x)),
  maxX: Math.max(...dummyCdfPoints.map(p => p.x))
});

// Test cases for all methods
var testCases = [
  {
    name: 'Multiplicative - Not Confident',
    sliders: {
      budgetFlexibility: 20,
      scheduleFlexibility: 20,
      scopeCertainty: 20,
      scopeReductionAllowance: 5,
      reworkPercentage: 20,
      riskTolerance: 20
    },
    userSlider_Confidence: 'not_confident',
    expectedMode: 'multiplicative',
    description: 'Tests multiplicative method with low confidence (Rule 1)'
  },
  {
    name: 'Multiplicative - Low Impact Sliders',
    sliders: {
      budgetFlexibility: 25,
      scheduleFlexibility: 25,
      scopeCertainty: 25,
      scopeReductionAllowance: 5,
      reworkPercentage: 25,
      riskTolerance: 25
    },
    userSlider_Confidence: 'confident',
    expectedMode: 'multiplicative',
    description: 'Tests multiplicative method with sliders < 30% (Rule 2)'
  },
  {
    name: 'Multiplicative - Uniform Sliders',
    sliders: {
      budgetFlexibility: 40,
      scheduleFlexibility: 42,
      scopeCertainty: 41,
      scopeReductionAllowance: 39,
      reworkPercentage: 40,
      riskTolerance: 41
    },
    userSlider_Confidence: 'confident',
    expectedMode: 'multiplicative',
    description: 'Tests multiplicative method with uniform sliders (max - min < 20%, Rule 3)'
  },
  {
    name: 'Multiplicative - Conflicting Sliders',
    sliders: {
      budgetFlexibility: 70,
      scheduleFlexibility: 70,
      scopeCertainty: 70,
      scopeReductionAllowance: 10,
      reworkPercentage: 70,
      riskTolerance: 70
    },
    userSlider_Confidence: 'confident',
    expectedMode: 'multiplicative',
    description: 'Tests multiplicative method with conflicting sliders (Rule 5)'
  },
  {
    name: 'Matrix Non-Extreme - Confident',
    sliders: {
      budgetFlexibility: 50,
      scheduleFlexibility: 50,
      scopeCertainty: 50,
      scopeReductionAllowance: 20,
      reworkPercentage: 50,
      riskTolerance: 50
    },
    userSlider_Confidence: 'confident',
    expectedMode: 'matrix-non-extreme',
    description: 'Tests matrix non-extreme method with moderate sliders and confident setting (Rule 7)'
  },
  {
    name: 'Matrix Extreme - Very Confident',
    sliders: {
      budgetFlexibility: 90,
      scheduleFlexibility: 90,
      scopeCertainty: 90,
      scopeReductionAllowance: 10,
      reworkPercentage: 90,
      riskTolerance: 90
    },
    userSlider_Confidence: 'very_confident',
    expectedMode: 'matrix-extreme',
    description: 'Tests matrix extreme method with extreme sliders and very confident setting (Rule 6)'
  }
];

// Helper function to validate points
function validatePoints(points, fieldName) {
  if (!Array.isArray(points) || points.length < 2) {
    console.warn(`validatePoints: Invalid ${fieldName} array`, { length: points?.length });
    return false;
  }
  return points.every((p, i) => {
    const isValid = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.plotCumulative_Confidence);
    if (!isValid) {
      console.warn(`validatePoints: Invalid point in ${fieldName} at index ${i}`, { point: p });
    }
    return isValid;
  });
}

// Run tests
testCases.forEach((testCase, index) => {
  console.log(`\n=== Test Case ${index + 1}: ${testCase.name} ===`);
  console.log('Test Case Details:', {
    sliders: testCase.sliders,
    userSlider_Confidence: testCase.userSlider_Confidence,
    expectedMode: testCase.expectedMode,
    description: testCase.description
  });

  try {
    // Test sliderAdjustedPDFandCDFPoints
    const adjustedResult = sliderAdjustedPDFandCDFPoints({
      points: normalizedPdfPoints,
      optimistic,
      mostLikely,
      pessimistic,
      sliderValues: testCase.sliders,
      userSlider_Confidence: testCase.userSlider_Confidence,
      isCalibrated: true
    });

    // Validate results
    const isPdfValid = validatePoints(adjustedResult.pdfPoints, 'pdfPoints');
    const isCdfValid = validatePoints(adjustedResult.cdfPoints, 'cdfPoints');
    const isModeCorrect = adjustedResult.calculationMode === testCase.expectedMode;

    console.log('sliderAdjustedPDFandCDFPoints Result:', JSON.stringify({
      pdfPointsLength: adjustedResult.pdfPoints.length,
      cdfPointsLength: adjustedResult.cdfPoints.length,
      calculationMode: adjustedResult.calculationMode,
      isModeCorrect: isModeCorrect,
      feedbackMessage: adjustedResult.feedbackMessage,
      isPdfValid: isPdfValid,
      isCdfValid: isCdfValid,
      error: adjustedResult.error
    }, null, 2));

    if (!isModeCorrect) {
      console.warn(`Test Case ${testCase.name}: Expected calculationMode ${testCase.expectedMode}, got ${adjustedResult.calculationMode}`);
    }
    if (!isPdfValid || !isCdfValid) {
      console.warn(`Test Case ${testCase.name}: Invalid points in pdfPoints or cdfPoints`);
    }

    // Test BOBYQAOptimalSliderSettings
    console.log(`Testing BOBYQAOptimalSliderSettings for ${testCase.name}`);
    const bobyqaResult = BOBYQAOptimalSliderSettings(
      dummyCdfPoints,
      originalMean,
      originalStdDev,
      targetValue,
      confidenceLevel,
      normalizedPdfPoints,
      testCase.userSlider_Confidence,
      optimistic,
      mostLikely,
      pessimistic
    );

    // Validate BOBYQA results
    const isOptimalPdfValid = validatePoints(bobyqaResult.optimalAdjustedPdfPoints, 'optimalAdjustedPdfPoints');
    const isOptimalCdfValid = validatePoints(bobyqaResult.optimalAdjustedCdfPoints, 'optimalAdjustedCdfPoints');
    const isProbabilityValid = Number.isFinite(bobyqaResult.probability) && bobyqaResult.probability >= 0 && bobyqaResult.probability <= 1;
    const isSlidersValid = Object.values(bobyqaResult.optimalSliderSettings).every(v => Number.isFinite(v) && v >= 0 && v <= (v === bobyqaResult.optimalSliderSettings.scopeReductionAllowance ? 90 : 100));

    console.log('BOBYQAOptimalSliderSettings Result:', JSON.stringify({
      optimalSliders: bobyqaResult.optimalSliderSettings,
      optimalAdjustedPdfPointsLength: bobyqaResult.optimalAdjustedPdfPoints.length,
      optimalAdjustedCdfPointsLength: bobyqaResult.optimalAdjustedCdfPoints.length,
      calculationMode: bobyqaResult.calculationMode,
      probability: bobyqaResult.probability,
      optimalObjective: bobyqaResult.optimalObjective,
      feedbackMessage: bobyqaResult.feedbackMessage,
      isOptimalPdfValid: isOptimalPdfValid,
      isOptimalCdfValid: isOptimalCdfValid,
      isProbabilityValid: isProbabilityValid,
      isSlidersValid: isSlidersValid
    }, null, 2));

    if (!isOptimalPdfValid || !isOptimalCdfValid) {
      console.warn(`Test Case ${testCase.name}: Invalid points in BOBYQA optimalAdjustedPdfPoints or optimalAdjustedCdfPoints`);
    }
    if (!isProbabilityValid) {
      console.warn(`Test Case ${testCase.name}: Invalid probability`, { probability: bobyqaResult.probability });
    }
    if (!isSlidersValid) {
      console.warn(`Test Case ${testCase.name}: Invalid optimal slider values`, { optimalSliders: bobyqaResult.optimalSliderSettings });
    }

  } catch (error) {
    console.error(`Test Case ${testCase.name} Error:`, error.message, { stack: error.stack });
  }
});

console.log('\n=== Test Summary ===');
console.log(`Completed ${testCases.length} test cases`);
