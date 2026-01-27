// File: index.js
//
// WHAT:
//   HTTP entrypoint for the Google Cloud Function wrapping the core
//   pmcEstimatorAPI engine. This file:
//     - Lazily loads core/main/main.js (pmcEstimatorAPI, SCHEMA_VERSION).
//     - Uses core/variable_map/adapter.js to normalize per-task results to the
//       UI-facing schema expected by Plot.html and Code.gs.
//     - Exposes a stable HTTP surface for Cloud Functions v2.
//
// DEPENDENCIES:
//   - ./core/main/main.js
//       exports:
//         - pmcEstimatorAPI(tasks)  → { results, error, feedbackMessages, ... }
//         - SCHEMA_VERSION          → '2025-10-16.api-envelope.v1' (or similar)
//   - ./core/variable_map/adapter.js
//       exports:
//         - adaptResponse(taskResult) → <UI-shaped task envelope>
//   - @google-cloud/functions-framework
//
// OUTPUT SHAPE (top-level HTTP payload):
//   {
//     schemaVersion: <string>,         // forced from core.SCHEMA_VERSION
//     buildInfo:     <object|null>,    // from core envelope or first task
//     feedbackMessages: <string[]>,
//     results: [ <ADAPTED_TASK_RESULT>, ... ]
//   }
//
// ADAPTED PER-TASK RESULT (as used by Plot.html & Code.gs):
//   Each item in `results[]` is the output of adaptResponse(taskResult) and is
//   expected to surface, among others, the following fields:
//
//   - trianglePdf.value, triangleCdf.value
//   - betaPertPdf.value, betaPertCdf.value
//   - targetProbabilityOriginalPdf.value, targetProbabilityOriginalCdf.value
//   - targetProbabilityAdjustedPdf.value, targetProbabilityAdjustedCdf.value
//   - targetProbability.value.{original, adjusted, adjustedOptimized, adaptiveOptimized?}
//   - optimizedReshapedPoints.{pdfPoints, cdfPoints}
//   - adaptiveReshapedPoints.{pdfPoints, cdfPoints}? (if adaptive enabled)
//   - optimalSliderSettings.value       // “best” slider vector (UI units)
//   - adaptiveOptimalSliderSettings.value? // adaptive-specific slider vector
//   - decisionReports, decisionCsv
//
// ENTRYPOINTS:
//   - functions-framework (local):   target = "pmcEstimatorAPI"
//   - Cloud Functions (prod):        --entry-point apiHandler (alias to same fn)
//
//   Both exports.pmcEstimatorAPI and exports.apiHandler point at the same HTTP
//   handler so local and deployed executions share identical behavior.
//

'use strict';

// Global: load only Functions Framework at module init time.
const functions = require('@google-cloud/functions-framework');

console.log('index.js: module init (framework loaded)');

// Lazy-loaded core references (to avoid startup crashes if core throws)
let coreHandler = null;     // will be assigned to core.pmcEstimatorAPI
let SCHEMA_VERSION = null;  // will be assigned to core.SCHEMA_VERSION
let adaptResponse = null;   // will be assigned to require('./core/variable_map/adapter').adaptResponse

/**
 * Lazy-load core modules on first request.
 * This keeps the function robust if core initialization throws; the error
 * will surface on the first HTTP call instead of blocking cold start.
 */
function lazyLoadCore() {
  if (coreHandler) return; // Already loaded

  try {
    console.log('Lazy-loading core modules...');
    const core = require('./core/main/main');

    coreHandler = core.pmcEstimatorAPI;
    SCHEMA_VERSION = core.SCHEMA_VERSION;
    adaptResponse = require('./core/variable_map/adapter').adaptResponse;

    console.log('Core loaded successfully');
  } catch (error) {
    console.error('Failed to lazy-load core:', error.message || error);
    // Re-throw so the HTTP handler can return a clear 500
    throw error;
  }
}

/**
 * Normalize request body → array of task objects.
 * Supported request formats:
 *   - [ { ...task }, { ...task }, ... ]
 *   - { tasks: [ { ...task }, ... ] }
 */
function extractTasksFromBody(body) {
  if (Array.isArray(body)) return body;
  if (body && Array.isArray(body.tasks)) return body.tasks;
  return null;
}

/**
 * Normalize core envelope → array of per-task results.
 *   coreEnvelope.results is expected to already be an array; if a single
 *   object appears (defensive guard), it's wrapped into a 1-element array.
 */
function resultsArrayFromEnvelope(envelope) {
  if (envelope && Array.isArray(envelope.results)) return envelope.results;
  if (envelope && envelope.results && !Array.isArray(envelope.results)) {
    return [envelope.results];
  }
  return [];
}

/**
 * Derive buildInfo for the top-level payload.
 * Preference order:
 *   1) coreEnvelope.buildInfo
 *   2) first task’s buildInfo
 *   3) null
 */
function pickBuildInfo(coreEnvelope, rawResults) {
  if (coreEnvelope && coreEnvelope.buildInfo) return coreEnvelope.buildInfo;
  if (Array.isArray(rawResults) && rawResults.length > 0) {
    return rawResults[0]?.buildInfo ?? null;
  }
  return null;
}

/**
 * HTTP handler for the pmcEstimatorAPI Cloud Function.
 *
 * Responsibilities:
 *   - Basic CORS + method/content-type validation.
 *   - Extract tasks from request body.
 *   - Invoke core.pmcEstimatorAPI(tasks).
 *   - Adapt each per-task result via adaptResponse(...) for UI/Plot.html.
 *   - Return normalized envelope with schemaVersion + buildInfo at top level.
 */
async function pmcEstimatorAPI(req, res) {
  // Ensure core is loaded exactly once
  lazyLoadCore();

  try {
    // Basic CORS (no changes to auth model)
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed; use POST' });
      return;
    }

    if (!req.is('application/json')) {
      res.status(400).json({ error: 'Content-Type must be application/json' });
      return;
    }

    const tasks = extractTasksFromBody(req.body);
    if (!tasks || tasks.length === 0) {
      res.status(400).json({
        error: 'Request body must be a non-empty array of tasks or { tasks: [...] }'
      });
      return;
    }

    // Core call (single pass, no retries here).
    // coreHandler is core.pmcEstimatorAPI from ./core/main/main.js.
    const coreEnvelope = await coreHandler(tasks);

    // Pull raw per-task results *before* adaptation so we can source buildInfo.
    const rawResults = resultsArrayFromEnvelope(coreEnvelope);

    // Adapt each task result to the UI schema expected by Plot.html / Code.gs
    const adaptedResults = rawResults.map((taskResult, idx) => {
      try {
        return adaptResponse(taskResult);
      } catch (e) {
        console.error(`adapter failure @ results[${idx}]`, e?.stack || e);
        return {
          error: `Adapter failed for results[${idx}]: ${e?.message || String(e)}`
        };
      }
    });

    // Final HTTP payload:
    //   - schemaVersion: always taken from core.SCHEMA_VERSION (deploy preflight depends on this).
    //   - buildInfo: derived from envelope or first task’s buildInfo.
    //   - feedbackMessages: pass through from coreEnvelope if present.
    //   - results: adaptedResults only (raw coreEnvelope.results is not exposed).
    const payload = {
      schemaVersion: SCHEMA_VERSION,
      buildInfo: pickBuildInfo(coreEnvelope, rawResults),
      feedbackMessages: Array.isArray(coreEnvelope?.feedbackMessages)
        ? coreEnvelope.feedbackMessages
        : [],
      results: adaptedResults
    };

    res.set('Content-Type', 'application/json; charset=utf-8');
    res.status(200).send(JSON.stringify(payload));
  } catch (error) {
    console.error('pmcEstimatorAPI: unhandled error', {
      message: error?.message,
      stack: error?.stack
    });

    // Heuristic: 400 for obvious client-side issues; 500 otherwise.
    const status = (error?.message && /must be|not allowed|Content-Type/i.test(error.message))
      ? 400
      : 500;

    res.status(status).json({
      schemaVersion: SCHEMA_VERSION || 'unknown', // fallback if core failed to load
      error: `Failed to process request: ${error?.message || String(error)}`,
      details: error?.details || {},
      feedbackMessages: [error?.message || 'Unhandled error'],
      results: []
    });
  }
}

// Register with functions-framework (for local dev / containerized runs)
//   npm start → functions-framework --target=pmcEstimatorAPI --port=8080
functions.http('pmcEstimatorAPI', pmcEstimatorAPI);

// Export for Cloud Functions entrypoint resolution.
//   - Gen2 deploy can use:   --entry-point pmcEstimatorAPI
//   - Existing scripts use:  --entry-point apiHandler
// Both point to the same underlying handler, so behavior is identical.
exports.pmcEstimatorAPI = pmcEstimatorAPI;
exports.apiHandler = pmcEstimatorAPI;

// For local testing when running `node index.js` directly.
// (functions-framework will still handle the actual HTTP server startup.)
if (require.main === module) {
  console.log('Running locally on port 8080 (functions-framework target: pmcEstimatorAPI)');
}

console.log('index.js: ready (server registered)');

