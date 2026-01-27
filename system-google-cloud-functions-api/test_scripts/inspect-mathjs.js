// File: inspect-mathjs.js
// Purpose: Inspects the mathjs library to list available functions
// Used in: Debugging why math.cholesky is not available in mathjs@13.0.0
// Validates: Outputs the mathjs version and all available functions to diagnose missing exports

const math = require('mathjs');

console.log('mathjs version:', math.version);
console.log('Available functions:', Object.keys(math).filter(k => typeof math[k] === 'function'));
