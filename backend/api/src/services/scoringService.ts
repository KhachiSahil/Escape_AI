/**
 * Multi-factor lead scoring: combines 1-10 sub-scores (LLM-set via
 * update_lead, based on what the caller actually said) into a single
 * deterministic composite score. Weights are illustrative defaults, tunable
 * without touching call sites.
 *
 * This exists because most of the original spec's scoring factors (budget,
 * interest, buying signals, conversation quality, course fit) are free text
 * in this schema, not structured data - see CLAUDE.md's Phase 2h entry.
 * Rather than fabricate a formula over unstructured prose, the LLM emits
 * numeric sub-scores per factor (Lead.budgetScore etc.) and this module
 * combines them deterministically.
 */

export const SCORE_WEIGHTS = {
  budgetScore: 0.25,
  urgencyScore: 0.2,
  interestScore: 0.2,
  buyingSignalsScore: 0.15,
  courseFitScore: 0.1,
  callQualityScore: 0.1,
} as const;

export type ScorableLead = {
  budgetScore?: number | null;
  urgencyScore?: number | null;
  interestScore?: number | null;
  buyingSignalsScore?: number | null;
  courseFitScore?: number | null;
  callQualityScore?: number | null;
};

/**
 * Returns a weighted composite score, or null if none of the sub-scores are
 * set yet (nothing to compute, rather than a misleading 0).
 */
export function computeCompositeScore(lead: ScorableLead): number | null {
  const entries = Object.entries(SCORE_WEIGHTS) as [keyof typeof SCORE_WEIGHTS, number][];
  const present = entries.filter(([key]) => lead[key] != null);

  if (present.length === 0) return null;

  const weightedSum = present.reduce((sum, [key, weight]) => sum + lead[key]! * weight, 0);
  const weightUsed = present.reduce((sum, [, weight]) => sum + weight, 0);

  return weightedSum / weightUsed;
}
