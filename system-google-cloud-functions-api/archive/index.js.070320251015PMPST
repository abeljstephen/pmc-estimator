// index.js
const express = require("express");
const bodyParser = require("body-parser");
const { createFullEstimate } = require("./core");

const app = express();
app.use(bodyParser.json());

/**
 * POST / 
 * Accepts:
 *   - Single estimate object
 *   - Array of estimate objects
 */
app.post("/", (req, res) => {
  try {
    const body = req.body;

    if (Array.isArray(body)) {
      const results = body.map(est => createFullEstimate(est));
      return res.status(200).json({
        results,
        message: "Batch estimation successful"
      });
    } else if (typeof body === "object" && body !== null) {
      const result = createFullEstimate(body);
      return res.status(200).json(result);
    } else {
      throw new Error("Request body must be either an estimate object or an array of estimate objects.");
    }
  } catch (err) {
    console.error("Error in estimation:", err);
    return res.status(400).json({ error: err.message });
  }
});

// For GET requests (optional: health check)
app.get("/", (req, res) => {
  res.send("PMC Estimator API is running.");
});

// Start the server (required for gen2)
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`PMC Estimator API listening on port ${PORT}`);
});

// Export app (so Cloud Functions knows the entry point)
module.exports = app;

