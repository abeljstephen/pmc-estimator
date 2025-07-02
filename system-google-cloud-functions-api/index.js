const core = require("./core");

exports.pmcEstimatorAPI = (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests are allowed." });
  }

  try {
    const data = req.body;
    const result = core.createEstimateResponse(data);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
