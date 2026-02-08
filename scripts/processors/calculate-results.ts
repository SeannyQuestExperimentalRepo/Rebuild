/**
 * Spread Result & O/U Result Calculator
 *
 * Given final scores and betting lines, calculates:
 * - SpreadResult: COVERED / LOST / PUSH
 * - OUResult: OVER / UNDER / PUSH
 * - Score difference (signed, from home perspective)
 */

import { createLogger } from "../utils/logger";

const log = createLogger("calculate-results");

type SpreadResult = "COVERED" | "LOST" | "PUSH";
type OUResult = "OVER" | "UNDER" | "PUSH";

/**
 * Calculate the spread result from the HOME team's perspective.
 *
 * Spread convention: negative = home favored
 * - Home -7 means home is favored by 7
 * - If home wins by more than 7, home COVERED
 * - If home wins by exactly 7, PUSH
 * - If home wins by less than 7 or loses, home LOST (did not cover)
 *
 * @param homeScore Final home score
 * @param awayScore Final away score
 * @param spread The point spread (negative = home favored)
 * @returns SpreadResult from the HOME team's perspective
 */
export function calculateSpreadResult(
  homeScore: number,
  awayScore: number,
  spread: number | null
): SpreadResult | null {
  if (spread == null) return null;

  // Score difference from home perspective
  const scoreDiff = homeScore - awayScore;

  // Home team covers if they beat the spread
  // spread is the "line" — home team needs scoreDiff > -spread to cover
  // Example: spread = -7 (home favored by 7)
  //   scoreDiff = 10 → 10 + (-7) = 3 > 0 → COVERED
  //   scoreDiff = 7  → 7 + (-7) = 0 → PUSH
  //   scoreDiff = 3  → 3 + (-7) = -4 < 0 → LOST
  const margin = scoreDiff + spread;

  if (margin > 0) return "COVERED";
  if (margin < 0) return "LOST";
  return "PUSH";
}

/**
 * Calculate the over/under result.
 *
 * @param homeScore Final home score
 * @param awayScore Final away score
 * @param overUnder The total points line
 */
export function calculateOUResult(
  homeScore: number,
  awayScore: number,
  overUnder: number | null
): OUResult | null {
  if (overUnder == null) return null;

  const totalPoints = homeScore + awayScore;

  if (totalPoints > overUnder) return "OVER";
  if (totalPoints < overUnder) return "UNDER";
  return "PUSH";
}

/**
 * Calculate signed score difference (home perspective).
 * Positive = home win, Negative = away win, 0 = tie.
 */
export function calculateScoreDifference(
  homeScore: number,
  awayScore: number
): number {
  return homeScore - awayScore;
}
