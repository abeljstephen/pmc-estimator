// File: test_beta_moments.js
// Purpose: Tests the computeBetaMoments function from core/baseline/pert-points.js
// Used in: deploy_pmc.sh step 14.5
// Validates: Computes valid alpha and beta parameters for a PERT distribution with inputs optimistic=1800, mostLikely=2400, pessimistic=3000
// Ensures: Returns finite, positive alpha and beta values

const { computeBetaMoments } = require('../core/baseline/pert-points');

try {
  // Test with sample inputs
  const result = computeBetaMoments(1800, 2400, 3000);
  
  // Validate alpha and beta
  if (!Number.isFinite(result.alpha) || !Number.isFinite(result.beta) || result.alpha <= 0 || result.beta <= 0) {
    console.error('Test Failed: Invalid alpha or beta', result);
    process.exit(1);
  }
  
  console.log('Test Passed: computeBetaMoments returned valid alpha and beta', result);
  process.exit(0);
} catch (err) {
  console.error('Test Failed: Error in computeBetaMoments', err.message, err.stack);
  process.exit(1);
}
