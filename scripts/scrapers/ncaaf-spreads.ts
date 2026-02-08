/**
 * NCAAF Spread Data Scraper
 *
 * Sources: Covers.com, TeamRankings.com, OddsShark historical
 * Target: Spread and O/U for FBS games from 2005-present
 *
 * Implementation in Phase 2, Cycles 69-78.
 */

import { createLogger } from "../utils/logger";

const log = createLogger("ncaaf-spreads");

export interface RawNCAAFSpread {
  season: number;
  date: string;
  homeTeam: string;
  awayTeam: string;
  spread: number | null;
  overUnder: number | null;
}

export async function scrapeNCAAFSeasonSpreads(
  season: number
): Promise<RawNCAAFSpread[]> {
  log.info(`NCAAF spread scraping not yet implemented (season ${season})`);
  return [];
}
