/**
 * NCAAMB Score Scraper
 *
 * Source: Sports-Reference.com College Basketball
 * URL: https://www.sports-reference.com/cbb/seasons/{year}-school-stats.html
 * Rate limit: 3 seconds between requests
 *
 * NOTE: D1 basketball has ~363 teams × ~30+ games = ~5,500+ games/season.
 * Much higher volume than football. Must deduplicate (each game on two team pages).
 *
 * Implementation in Phase 3, Cycles 121-130.
 */

import { createLogger } from "../utils/logger";

const log = createLogger("ncaamb-scores");

export interface RawNCAAMBGameScore {
  season: number; // Year season ends (2024 = 2023-24)
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  homeRank: number | null;
  awayRank: number | null;
  isNeutralSite: boolean;
  isConferenceGame: boolean;
  notes: string | null; // Tournament round, NIT, etc.
}

export async function scrapeNCAAMBSeasonScores(
  season: number
): Promise<RawNCAAMBGameScore[]> {
  log.info(`NCAAMB score scraping not yet implemented (season ${season})`);
  return [];
}
