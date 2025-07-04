const express = require("express");
const bodyParser = require("body-parser");
const { createFullEstimate } = require("./core");

const app = express();
app.use(bodyParser.json());

app.post("/", (req, res) => {
  try {
    const estimates = req.body;
    const result = createFullEstimate(estimates);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error:", err);
    res.status(400).json({ error: err.message });
  }
});

// 👇 THIS IS THE KEY: Export the app for Cloud Functions
exports.app = app;

