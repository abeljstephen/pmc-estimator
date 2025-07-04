// index.js

const express = require("express");
const app = express();
const { createFullEstimate } = require("./core");

app.use(express.json());

app.post("/", (req, res) => {
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    if (Array.isArray(body)) {
      const results = body.map(est => createFullEstimate(est));
      return res.json({
        results,
        message: "Batch estimation successful"
      });
    } else if (typeof body === "object" && body !== null) {
      const result = createFullEstimate(body);
      return res.json(result);
    } else {
      throw new Error("Request body must be an object or an array of objects.");
    }
  } catch (err) {
    console.error("Error in estimator API:", err);
    return res.status(400).json({ error: err.message });
  }
});

module.exports = app;

