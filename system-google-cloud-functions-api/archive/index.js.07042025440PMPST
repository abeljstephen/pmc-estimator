const { createFullEstimate } = require("./core");

exports.pmcEstimatorAPI = (req, res) => {
  try {
    const estimates = req.body;
    if (!Array.isArray(estimates)) {
      console.error("Invalid input: Input must be an array of estimates.");
      return res.status(400).json({ error: "Input must be an array of estimates." });
    }
    const sanitizedEstimates = estimates.map(estimate => {
      const optimistic = Number(estimate.optimistic);
      const mostLikely = Number(estimate.mostLikely);
      const pessimistic = Number(estimate.pessimistic);
      if (isNaN(optimistic) || isNaN(mostLikely) || isNaN(pessimistic)) {
        console.error(`Invalid numbers for task ${estimate.task}: optimistic=${estimate.optimistic}, mostLikely=${estimate.mostLikely}, pessimistic=${estimate.pessimistic}`);
        throw new Error(`All estimates must be valid numbers for task ${estimate.task}.`);
      }
      if (optimistic > mostLikely || mostLikely > pessimistic) {
        console.error(`Invalid order for task ${estimate.task}: optimistic=${optimistic}, mostLikely=${mostLikely}, pessimistic=${pessimistic}`);
        throw new Error(`Invalid estimate order for task ${estimate.task}: optimistic <= mostLikely <= pessimistic`);
      }
      if (pessimistic - optimistic <= 0) {
        console.error(`Invalid range for task ${estimate.task}: pessimistic=${pessimistic}, optimistic=${optimistic}`);
        throw new Error(`Invalid range for task ${estimate.task}: pessimistic must be greater than optimistic`);
      }
      return {
        task: estimate.task,
        optimistic,
        mostLikely,
        pessimistic
      };
    });
    const result = createFullEstimate(sanitizedEstimates);
    res.status(200).json({ results: result, message: "Batch estimation successful" });
  } catch (err) {
    console.error("Error in pmcEstimatorAPI:", err.stack);
    res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
};
