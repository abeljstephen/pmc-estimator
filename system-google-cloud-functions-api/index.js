// index.js

const { createFullEstimate } = require("./core");

/**
 * HTTP Cloud Function entry point.
 * 
 * - Accepts POST requests with either:
 *   1. A single estimate object (for one estimation), or
 *   2. An array of estimate objects (for batch estimation).
 * 
 * - Responds with JSON containing estimation results.
 */
exports.pmcEstimatorAPI = (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests are allowed." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (Array.isArray(body)) {
      // Batch estimation
      const results = body.map(est => createFullEstimate(est));
      return res.status(200).json({
        results,
        message: "Batch estimation successful"
      });
    } else if (typeof body === "object" && body !== null) {
      // Single estimation
      const result = createFullEstimate(body);
      return res.status(200).json(result);
    } else {
      throw new Error("Request body must be either an estimate object or an array of estimate objects.");
    }

  } catch (err) {
    console.error("Error in pmcEstimatorAPI:", err);
    return res.status(400).json({ error: err.message });
  }
};

