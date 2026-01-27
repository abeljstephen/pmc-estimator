// File: test_math.js
// Purpose: Tests the availability of math.cholesky in the mathjs library
// Used in: Debugging the math.cholesky is not a function error in core/reshaping/copula-utils.js
// Validates: Checks if math.cholesky exists and can compute a Cholesky decomposition for a sample matrix

const math = require('mathjs');

console.log('math.cholesky exists:', typeof math.cholesky === 'function');
try {
  // Test with a sample positive definite matrix
  const matrix = [[1, 0.7], [0.7, 1]];
  const L = math.cholesky(matrix);
  console.log('Cholesky decomposition:', L);
} catch (error) {
  console.error('Cholesky error:', error.message);
}
