// File: test_triangle_points.js
// Purpose: Tests the generateTrianglePoints function from core/baseline/triangle-points.js
// Used in: deploy_pmc.sh step 14
// Validates: Generates valid PDF points for a triangular distribution with inputs optimistic=1800, mostLikely=2400, pessimistic=3000
// Ensures: pdfPoints is an array with at least 2 points, each with finite x/y values, non-negative y, and a positive step size

const { generateTrianglePoints } = require('../core/baseline/triangle-points');

try {
  // Test with sample inputs
  const result = generateTrianglePoints({ optimistic: 1800, mostLikely: 2400, pessimistic: 3000 });
  
  // Validate pdfPoints array
  if (!Array.isArray(result.pdfPoints) || result.pdfPoints.length < 2 || !result.pdfPoints.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.y >= 0)) {
    console.error('Test Failed: Invalid pdfPoints', { pdfPoints: result.pdfPoints.slice(0, 5) });
    process.exit(1);
  }
  
  // Validate step size between points
  const step = result.pdfPoints[1].x - result.pdfPoints[0].x;
  if (!Number.isFinite(step) || step <= 0) {
    console.error('Test Failed: Invalid step size', { step, pdfPoints: result.pdfPoints.slice(0, 5) });
    process.exit(1);
  }
  
  console.log('Test Passed: generateTrianglePoints returned valid pdfPoints', { pdfPoints: result.pdfPoints.slice(0, 5), step });
  process.exit(0);
} catch (err) {
  console.error('Test Failed: Error in generateTrianglePoints', err.message, err.stack);
  process.exit(1);
}
