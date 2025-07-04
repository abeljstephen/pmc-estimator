// index.js

const express = require("express");
const app = express();
const { createFullEstimate } = require("./core");

// Middleware to parse JSON
app.use(express.json());

// POST route for estimation
app.post("/", (req, res) => {
  try {
    const body = req.body;

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
});

// For GET requests, respond with a helpful message
app.get("/", (req, res) => {
  res.status(200).send("PMC Estimator API is running. Please send a POST request with your estimation data.");
});

// Export Express app as Cloud Function
module.exports = app;

