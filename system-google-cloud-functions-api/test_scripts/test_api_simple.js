/*
 * File: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/test_scripts/test_api_simple.js
 * Sends a single HTTP POST request to pmcEstimatorAPI to test its response, mimicking the simplest Google Sheets (Code.gs) interaction.
 *
 * Purpose:
 * This script tests the pmcEstimatorAPI Cloud Function by sending a minimal payload with estimates, sliders, target value, and distribution type, authenticating with an ID token generated via google-auth-library. It logs the response to verify the structure (allCIs, sliders, reshapedPoints) and diagnose Google Sheets issues like repeating values (90.00%, 50, 0.05, 0.01, N/A confidence intervals), empty MC Smoothed Points and CDF Points, and Row 8 errors. The script bypasses authentication issues seen in test_api_rows.sh and uses minimal dependencies.
 *
 * Roadmap:
 * 1. **Authentication**: Generate an ID token using google-auth-library and the service account key.
 * 2. **API Request**: Send a single POST request to pmcEstimatorAPI with a minimal payload.
 * 3. **Response Logging**: Log the response, including allCIs, sliders, points, and errors, to verify correctness.
 * 4. **Error Handling**: Implement try-catch blocks and detailed logging to diagnose API failures.
 *
 * Dependencies:
 * - node-fetch@2: For making HTTP POST requests.
 * - google-auth-library: For generating ID tokens.
 *
 * Implementation Choices:
 * - **Minimal Payload**: Uses a single set of estimates and sliders to test the API with the simplest input.
 * - **Authentication**: Uses google-auth-library to avoid gcloud auth issues in test_api_rows.sh.
 * - **Logging**: Outputs detailed response structure to diagnose Google Sheets issues.
 * - **Error Handling**: Catches authentication, request, and response parsing errors for robust debugging.
 *
 * Fixes Applied:
 * - [2025-09-08] Created test_api_simple.js to send a single authenticated request to pmcEstimatorAPI, bypassing test_api_rows.sh authentication issues and testing the simplest API interaction (Fix 99).
 */

'use strict';

const path = require('path');
const fs = require('fs');

// Validate dependencies
let fetch, GoogleAuth;
try {
  fetch = require('node-fetch');
} catch (error) {
  console.error('test_api_simple.js: Missing node-fetch module. Please run: npm install node-fetch@2');
  process.exit(1);
}
try {
  GoogleAuth = require('google-auth-library').GoogleAuth;
} catch (error) {
  console.error('test_api_simple.js: Missing google-auth-library module. Please run: npm install google-auth-library');
  process.exit(1);
}

console.log('test_api_simple.js: File found at', __filename);
console.log('test_api_simple.js: Starting');
console.log('Testing pmcEstimatorAPI with a single request.');

// Configuration
const API_URL = 'https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI';
const SERVICE_ACCOUNT_KEY_PATH = '/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/pmc-estimator-b50a03244199.json';
const AUDIENCE = API_URL;

// Validate service account key
if (!fs.existsSync(SERVICE_ACCOUNT_KEY_PATH)) {
  console.error('test_api_simple.js: Service account key not found at', SERVICE_ACCOUNT_KEY_PATH);
  process.exit(1);
}

// Minimal payload
const payload = {
  optimistic: 1800,
  mostLikely: 2400,
  pessimistic: 3000,
  targetValue: 2000,
  distributionType: 'monte-carlo-smoothed',
  sliderValues: {
    budgetFlexibility: 20,
    scheduleFlexibility: 40,
    scopeCertainty: 60,
    scopeReductionAllowance: 80,
    reworkPercentage: 0,
    riskTolerance: 100,
    userConfidence: 100
  },
  optimizeFor: 'target'
};

// Generate ID token
async function getIdToken() {
  try {
    const auth = new GoogleAuth({
      keyFile: SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getIdTokenClient(AUDIENCE);
    const token = await client.idTokenProvider.fetchIdToken(AUDIENCE);
    console.log('getIdToken: Successfully generated ID token');
    return token;
  } catch (error) {
    console.error('getIdToken: Failed to generate ID token', { message: error.message, stack: error.stack });
    throw new Error(`Failed to generate ID token: ${error.message}`);
  }
}

// Send API request
async function testApi() {
  console.time('testApi');
  try {
    console.log('testApi: Sending API request', { payload });
    const token = await getIdToken();
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}: ${await response.text()}`);
    }
    const result = await response.json();
    console.log('testApi: Received API response', {
      allCIs: result.allCIs?.value,
      sliders: result.sliders,
      pdfPointsLength: result.reshapedPoints?.pdfPoints?.length,
      cdfPointsLength: result.reshapedPoints?.cdfPoints?.length,
      error: result.error
    });
    if (result.error) {
      throw new Error(`API returned error: ${result.error}`);
    }
    // Validate response
    if (!result.allCIs?.value || !result.sliders || !result.reshapedPoints) {
      console.warn('testApi: Invalid API response: missing required fields', { result });
      throw new Error('Invalid API response: missing required fields');
    }
    const distributions = ['triangle', 'pert', 'beta', 'monte-carlo-raw', 'monte-carlo-smoothed'];
    for (const dist of distributions) {
      if (!result.allCIs.value[dist]?.probability || !Number.isFinite(result.allCIs.value[dist].lower) || !Number.isFinite(result.allCIs.value[dist].upper)) {
        console.warn(`testApi: Invalid or missing CI for ${dist}`, { ci: result.allCIs.value[dist] });
      }
    }
    if (!Array.isArray(result.reshapedPoints.pdfPoints) || !Array.isArray(result.reshapedPoints.cdfPoints)) {
      console.warn('testApi: Invalid reshaped points', {
        pdfPointsLength: result.reshapedPoints?.pdfPoints?.length,
        cdfPointsLength: result.reshapedPoints?.cdfPoints?.length
      });
    }
    console.timeEnd('testApi');
    return result;
  } catch (error) {
    console.error('testApi: Failed', { message: error.message, stack: error.stack });
    console.timeEnd('testApi');
    return { error: error.message, allCIs: { value: {} }, sliders: {}, reshapedPoints: { pdfPoints: [], cdfPoints: [] } };
  }
}

async function main() {
  console.time('main');
  try {
    console.log('Starting simple API test...');
    const result = await testApi();
    console.log('Final API Response:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('main: Error', { message: error.message, stack: error.stack });
  } finally {
    console.timeEnd('main');
  }
}

main().catch(console.error);
