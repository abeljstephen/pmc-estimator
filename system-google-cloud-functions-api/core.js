// core.js

function validateEstimates(estimates) {
  const { bestCase, mostLikely, worstCase } = estimates;

  if (
    typeof bestCase !== "number" ||
    typeof mostLikely !== "number" ||
    typeof worstCase !== "number"
  ) {
    throw new Error("All estimates must be numbers.");
  }

  if (bestCase < 0 || mostLikely < 0 || worstCase < 0) {
    throw new Error("Estimates cannot be negative.");
  }

  if (bestCase > mostLikely || mostLikely > worstCase) {
    throw new Error("Estimates must satisfy: best <= mostLikely <= worst.");
  }
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
