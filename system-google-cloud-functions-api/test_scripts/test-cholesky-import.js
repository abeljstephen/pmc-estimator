// File: test-cholesky-import.js
// Purpose: Tests explicit import of mathjs Cholesky function to bypass math.cholesky is not a function error
// Used in: Debugging mathjs library issues
// Validates: Checks if the cholesky function can be imported directly and computes a valid decomposition

const cholesky = require('mathjs/lib/function/matrix/cholesky');

console.log('cholesky exists:', typeof cholesky === 'function');
try {
  // Test with a sample positive definite matrix
  const matrix = [[1, 0.7], [0.7, 1]];
  const L = cholesky(matrix);
  console.log('Cholesky decomposition:', L);
} catch (error) {
  console.error('Cholesky error:', error.message);
}
