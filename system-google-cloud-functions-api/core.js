// core.js

function validateEstimates(estimates) {
  let { bestCase, mostLikely, worstCase } = estimates;

  // Convert strings to numbers if needed
  bestCase = Number(bestCase);
  mostLikely = Number(mostLikely);
  worstCase = Number(worstCase);

  if (
    isNaN(bestCase) ||
    isNaN(mostLikely) ||
    isNaN(worstCase)
  ) {
    throw new Error("All estimates must be valid numbers.");
  }

  if (bestCase < 0 || mostLikely < 0 || worstCase < 0) {
    throw new Error("Estimates cannot be negative.");
  }

  if (bestCase > mostLikely || mostLikely > worstCase) {
    throw new Error("Estimates must satisfy: best <= mostLikely <= worst.");
  }

  // Update the estimates object to hold numeric values
  estimates.bestCase = bestCase;
  estimates.mostLikely = mostLikely;
  estimates.worstCase = worstCase;
}

function calculatePertEstimate(bestCase, mostLikely, worstCase) {
  return (bestCase + 4 * mostLikely + worstCase) / 6;
}

function createEstimateResponse(estimates) {
  validateEstimates(estimates);

  const expectedValue = calculatePertEstimate(
    estimates.bestCase,
    estimates.mostLikely,
    estimates.worstCase
  );

  return {
    estimates,
    expectedValue,
    message: "Estimation successful"
  };
}

module.exports = {
  validateEstimates,
  calculatePertEstimate,
  createEstimateResponse
};
