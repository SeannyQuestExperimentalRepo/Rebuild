/**
 * NCAAF Score Scraper
 *
 * Source: Sports-Reference.com College Football
 * URL: https://www.sports-reference.com/cfb/years/{year}-schedule.html
 * Rate limit: 3 seconds between requests
 *
 * Target: FBS games from 2000-present (scores), 2005-present (with spreads)
 */

import { createLogger } from "../utils/logger";

const log = createLogger("ncaaf-scores");

export interface RawNCAAFGameScore {
  season: number;
  week: string;
  date: string;
  dayOfWeek: string;
  time: string | null;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeRank: number | null;
  awayRank: number | null;
  isNeutralSite: boolean;
  notes: string | null; // Bowl name, etc.
}

/**
 * Scrape all FBS game scores for a given season.
 * Implementation in Phase 2, Cycles 61-68.
 */
export async function scrapeNCAAFSeasonScores(
  season: number
): Promise<RawNCAAFGameScore[]> {
  log.info(`NCAAF score scraping not yet implemented (season ${season})`);
  return [];
}
