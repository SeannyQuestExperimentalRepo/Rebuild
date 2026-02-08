/**
 * NFL Score Scraper
 *
 * Source: Pro-Football-Reference.com
 * URL: https://www.pro-football-reference.com/years/{year}/games.htm
 * Rate limit: 3 seconds between requests
 *
 * Scrapes NFL game scores by season.
 */

import { fetchWithRateLimit } from "../utils/http";
import { createLogger } from "../utils/logger";

const log = createLogger("nfl-scores");

const PFR_BASE = "https://www.pro-football-reference.com";

export interface RawNFLGameScore {
  season: number;
  week: string;
  dayOfWeek: string;
  date: string;
  time: string | null;
  winnerTie: string;
  atIndicator: string; // "@" means winner was away
  loserTie: string;
  winnerPoints: number;
  loserPoints: number;
}

/**
 * Scrape all game scores for a given NFL season from Pro-Football-Reference.
 */
export async function scrapeNFLSeasonScores(
  season: number
): Promise<RawNFLGameScore[]> {
  const url = `${PFR_BASE}/years/${season}/games.htm`;
  log.info(`Scraping NFL scores for season ${season}`, { url });

  const html = await fetchWithRateLimit(url);

  // TODO: Parse HTML table into RawNFLGameScore[]
  // The PFR games table has columns:
  // Week | Day | Date | Time | Winner/tie | [@ or blank] | Loser/tie | PtsW | PtsL | YdsW | TOW | YdsL | TOL
  log.warn(`HTML parsing not yet implemented for season ${season}`, {
    htmlLength: html.length,
  });

  return [];
}

/**
 * Scrape scores for a range of seasons.
 */
export async function scrapeNFLScoresRange(
  startSeason: number,
  endSeason: number
): Promise<RawNFLGameScore[]> {
  const allGames: RawNFLGameScore[] = [];

  for (let season = startSeason; season <= endSeason; season++) {
    const games = await scrapeNFLSeasonScores(season);
    allGames.push(...games);
    log.info(`Season ${season}: ${games.length} games scraped`, {
      total: allGames.length,
    });
  }

  return allGames;
}
