/**
 * NCAAMB Spread Data Scraper
 *
 * Sources: Covers.com, TeamRankings.com, OddsShark historical
 * Target: Spread and O/U for D1 games from 2005-present
 *
 * Challenges:
 * - Volume: ~5,500 games/season
 * - Many low-profile games may lack spread data
 * - Focus: Power conference + ranked + tournament games first
 *
 * Implementation in Phase 3, Cycles 131-142.
 */

import { createLogger } from "../utils/logger";

const log = createLogger("ncaamb-spreads");

export interface RawNCAAMBSpread {
  season: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  spread: number | null;
  overUnder: number | null;
}

export async function scrapeNCAAMBSeasonSpreads(
  season: number
): Promise<RawNCAAMBSpread[]> {
  log.info(`NCAAMB spread scraping not yet implemented (season ${season})`);
  return [];
}
