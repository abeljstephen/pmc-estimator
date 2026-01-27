const { generateMonteCarloPoints } = require('./core/Distribution_Generator-Core');
const { calculateAlpha, calculateBeta } = require('./core/Distribution_Metrics-Core');
async function testPoints() {
  try {
    const params = {
      optimistic: 1800,
      mostLikely: 2400,
      pessimistic: 3000,
      iterations: 1000,
      type: 'smoothed'
    };
    const { pdfPoints, cdfPoints } = await generateMonteCarloPoints(params);
    const expectedAlpha = calculateAlpha(params.optimistic, params.mostLikely, params.pessimistic);
    const expectedBeta = calculateBeta(params.optimistic, params.mostLikely, params.pessimistic);
    console.log('Expected Alpha:', expectedAlpha, 'Expected Beta:', expectedBeta);
    console.log('PDF Points:', pdfPoints.slice(0, 5));
    console.log('CDF Points:', cdfPoints.slice(0, 5));
    if (!pdfPoints.length || !cdfPoints.length) {
      throw new Error('Empty PDF or CDF points generated');
    }
  } catch (err) {
    console.error('Error:', err.message, err.stack);
    process.exit(1);
  }
}
testPoints();
