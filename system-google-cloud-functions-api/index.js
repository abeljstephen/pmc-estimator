const { createFullEstimate } = require("./core");

exports.pmcEstimatorAPI = (req, res) => {
  try {
    const estimates = req.body;
    if (!Array.isArray(estimates)) {
      return res.status(400).json({ error: "Input must be an array of estimates." });
    }
    const sanitizedEstimates = estimates.map(estimate => {
      const optimistic = Number(estimate.optimistic);
      const mostLikely = Number(estimate.mostLikely);
      const pessimistic = Number(estimate.pessimistic);
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
    const result = createFullEstimate(sanitizedEstimates);
    res.status(200).json(result);
  } catch (err) {
    console.error("Error:", err);
    res.status(400).json({ error: err.message });
  }
};
