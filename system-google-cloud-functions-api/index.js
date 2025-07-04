const express = require("express");
const bodyParser = require("body-parser");
const { createFullEstimate } = require("./core");

const app = express();
app.use(bodyParser.json());

// POST endpoint for estimates
app.post("/", (req, res) => {
  try {
    const estimates = req.body;
    // Validate input
    if (!Array.isArray(estimates)) {
      return res.status(400).json({ error: "Input must be an array of estimates." });
    }
    // Sanitize estimates: Convert optimistic, mostLikely, pessimistic to numbers
    const sanitizedEstimates = estimates.map(estimate => {
      const optimistic = Number(estimate.optimistic);
      const mostLikely = Number(estimate.mostLikely);
      const pessimistic = Number(estimate.pessimistic);
      // Check for valid numbers
      if (isNaN(optimistic) || isNaN(mostLikely) || isNaN(pessimistic)) {
        throw new Error("All estimates must be valid numbers.");
      }
      return {
        task: estimate.task,
        optimistic,
        mostLikely,
        pessimistic
      };
    });
    // Call core function with sanitized estimates
    const result = createFullEstimate(sanitizedEstimates);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// Listen on the PORT environment variable (default 8080) and 0.0.0.0
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server listening on port ${port}`);
});

// Export the Express app for Cloud Functions
exports.estimateDistributions = app;
