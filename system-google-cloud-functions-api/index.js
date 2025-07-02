const core = require("../system-google-cloud-core/core");

exports.pmcEstimatorAPI = (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests are allowed." });
  }

  try {
    const data = req.body;

    if (!Array.isArray(data)) {
      throw new Error("Request body must be an array of estimates.");
    }

    const results = data.map((estimates) => {
      return core.createFullEstimate(estimates);
    });

    res.status(200).json({
      results,
      message: "Batch estimation successful"
    });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

