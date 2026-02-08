/**
 * NFL Spread Data Scraper
 *
 * Source: Pro-Football-Reference.com game pages
 * URL: https://www.pro-football-reference.com/years/{year}/games.htm
 * Column: "PtsSprd" for point spread
 *
 * Available: ~1979 to present
 * Pre-1979: "pre-spread-era" — spread fields remain null
 */

import { fetchWithRateLimit } from "../utils/http";
import { createLogger } from "../utils/logger";

const log = createLogger("nfl-spreads");

const PFR_BASE = "https://www.pro-football-reference.com";

export interface RawNFLSpread {
  season: number;
  week: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  spread: number | null; // Negative = home favored
  overUnder: number | null;
}

/**
 * Scrape spread data for an NFL season from PFR.
 * The spread column appears in the games table as "PtsSprd".
 */
export async function scrapeNFLSeasonSpreads(
  season: number
): Promise<RawNFLSpread[]> {
  if (season < 1979) {
    log.info(`Season ${season} is pre-spread-era, skipping`);
    return [];
  }

  const url = `${PFR_BASE}/years/${season}/games.htm`;
  log.info(`Scraping NFL spreads for season ${season}`, { url });

  const html = await fetchWithRateLimit(url);

  // TODO: Parse HTML table — extract spread and O/U columns
  log.warn(`HTML parsing not yet implemented for season ${season}`, {
    htmlLength: html.length,
  });

  return [];
}
