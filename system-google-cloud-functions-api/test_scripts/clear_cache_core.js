/*
 * File: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/test_scripts/clear_cache_core.js
 * Clears the Node.js module cache for all core files in the 'core' directory to ensure the latest versions are used.
 * Run from the test_scripts directory before executing test_distribution.js.
 */

'use strict';

const path = require('path');

// Define module paths relative to test_scripts directory
const modules = [
  path.join(__dirname, '../core/optimization/slider-optimizer'),
  path.join(__dirname, '../core/reshaping/slider-adjustments'),
  path.join(__dirname, '../core/reshaping/slider-normalization'),
  path.join(__dirname, '../core/reshaping/copula-utils'),
  path.join(__dirname, '../core/helpers/validation'),
  path.join(__dirname, '../core/helpers/metrics')
];

modules.forEach(modulePath => {
  try {
    delete require.cache[require.resolve(modulePath)];
    console.log(`Cleared module cache for ${modulePath}`);
  } catch (error) {
    console.error(`Failed to clear cache for ${modulePath}`, { message: error.message });
  }
});
