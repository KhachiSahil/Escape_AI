import { describe, expect, it } from "vitest";

import { computeCompositeScore, SCORE_WEIGHTS } from "./scoringService";

describe("SCORE_WEIGHTS", () => {
  it("sums to 1.0", () => {
    const total = Object.values(SCORE_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(total).toBeCloseTo(1.0, 10);
  });
});

describe("computeCompositeScore", () => {
  it("returns null when no sub-scores are set", () => {
    expect(computeCompositeScore({})).toBeNull();
  });

  it("computes the full weighted average when all sub-scores are set", () => {
    const result = computeCompositeScore({
      budgetScore: 10,
      urgencyScore: 10,
      interestScore: 10,
      buyingSignalsScore: 10,
      courseFitScore: 10,
      callQualityScore: 10,
    });
    expect(result).toBeCloseTo(10, 10);
  });

  it("re-weights over only the sub-scores that are present", () => {
    // Only budgetScore (weight 0.25) and urgencyScore (weight 0.20) set -
    // should average to their raw values weighted relative to each other,
    // not diluted by the unset factors.
    const result = computeCompositeScore({ budgetScore: 10, urgencyScore: 5 });
    const expected = (10 * 0.25 + 5 * 0.2) / (0.25 + 0.2);
    expect(result).toBeCloseTo(expected, 10);
  });

  it("treats explicit null the same as unset", () => {
    const result = computeCompositeScore({
      budgetScore: 8,
      urgencyScore: null,
      interestScore: undefined,
    });
    expect(result).toBeCloseTo(8, 10);
  });
});
