// core_proxy.js
const core = require('./core.js');

// Re-export only the needed functions, excluding pmcEstimatorAPI
module.exports = {
  BOBYQAOptimalSliderSettings: core.BOBYQAOptimalSliderSettings,
  sliderAdjustedPDFandCDFPoints: core.sliderAdjustedPDFandCDFPoints,
  interpolateCdf: core.interpolateCdf,
  findValueAtConfidence: core.findValueAtConfidence,
  performKDE: core.performKDE,
  calculateMAD: core.calculateMAD,
  calculateCVaR95: core.calculateCVaR95,
  calculateAlpha: core.calculateAlpha,
  calculateBeta: core.calculateBeta,
  calculatePERTMean: core.calculatePERTMean,
  calculatePERTStdDev: core.calculatePERTStdDev
};
