const functions = require('@google-cloud/functions-framework');
const core = require('./core');

// Define the HTTP function
functions.http('pmcEstimatorAPI', core.handleRequest);

// Export the function for deployment
module.exports = {
  pmcEstimatorAPI: core.handleRequest
};
