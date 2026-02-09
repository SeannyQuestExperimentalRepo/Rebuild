/**
 * ESPN Sync Logic
 *
 * Shared functions for:
 * 1. refreshUpcomingGames — fetch ESPN odds → upsert into UpcomingGame table
 * 2. syncCompletedGames — fetch ESPN scoreboard → insert completed games into
 *    NFLGame/NCAAFGame/NCAAMBGame tables (daily cron)
 *
 * The UpcomingGame table uses canonical team names as strings (no FK),
 * so we can upsert freely. Completed game sync requires mapping to team IDs.
 */

import { prisma } from "./db";
import {
  fetchUpcomingWithOdds,
  fetchScoreboard,
  mapTeamToCanonical,
  type Sport,
} from "./espn-api";

// ─── Refresh Upcoming Games (Odds) ──────────────────────────────────────────

export interface RefreshResult {
  sport: Sport;
  fetched: number;
  upserted: number;
  cleaned: number;
}

/**
 * Fetch upcoming games with odds from ESPN and upsert into UpcomingGame table.
 * Also cleans up games older than 1 day.
 */
export async function refreshUpcomingGames(sport: Sport): Promise<RefreshResult> {
  const games = await fetchUpcomingWithOdds(sport);

  let upserted = 0;
  for (const g of games) {
    // Only store games with at least one useful odds field
    if (g.odds.spread == null && g.odds.overUnder == null) continue;

    // Use canonical name if available, otherwise fall back to display name
    const homeTeam = g.homeCanonical ?? g.homeTeam.displayName;
    const awayTeam = g.awayCanonical ?? g.awayTeam.displayName;
    const gameDate = new Date(g.date);

    try {
      await prisma.upcomingGame.upsert({
        where: {
          sport_gameDate_homeTeam_awayTeam: {
            sport,
            gameDate,
            homeTeam,
            awayTeam,
          },
        },
        create: {
          sport,
          gameDate,
          homeTeam,
          awayTeam,
          spread: g.odds.spread,
          overUnder: g.odds.overUnder,
          moneylineHome: g.odds.moneylineHome,
          moneylineAway: g.odds.moneylineAway,
        },
        update: {
          spread: g.odds.spread,
          overUnder: g.odds.overUnder,
          moneylineHome: g.odds.moneylineHome,
          moneylineAway: g.odds.moneylineAway,
        },
      });
      upserted++;
    } catch (err) {
      console.warn(`[ESPN Sync] Upsert failed for ${awayTeam} @ ${homeTeam}:`, err);
    }
  }

  // Clean up old games (older than 1 day)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 1);
  const { count: cleaned } = await prisma.upcomingGame.deleteMany({
    where: {
      sport,
      gameDate: { lt: cutoff },
    },
  });

  console.log(
    `[ESPN Sync] ${sport}: fetched=${games.length}, upserted=${upserted}, cleaned=${cleaned}`,
  );

  return { sport, fetched: games.length, upserted, cleaned };
}

// ─── Sync Completed Games (Daily Cron) ──────────────────────────────────────

export interface SyncResult {
  sport: Sport;
  fetched: number;
  inserted: number;
  skipped: number;
}

/**
 * Fetch yesterday's completed games from ESPN scoreboard and insert into
 * the appropriate game table (NFLGame, NCAAFGame, NCAAMBGame).
 *
 * Uses team canonical names to look up team IDs, then inserts with
 * createMany({ skipDuplicates: true }) to avoid duplicating existing games.
 */
export async function syncCompletedGames(
  sport: Sport,
  date?: string,
): Promise<SyncResult> {
  // Default to yesterday
  const targetDate =
    date ??
    (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    })();

  const games = await fetchScoreboard(sport, targetDate);
  const completed = games.filter((g) => g.status === "final");

  if (completed.length === 0) {
    return { sport, fetched: games.length, inserted: 0, skipped: 0 };
  }

  // Load team ID map
  const teamIdMap = await getTeamIdMap();
  let inserted = 0;
  let skipped = 0;

  for (const game of completed) {
    const homeCanonical = mapTeamToCanonical(game.homeTeam, sport);
    const awayCanonical = mapTeamToCanonical(game.awayTeam, sport);

    if (!homeCanonical || !awayCanonical) {
      skipped++;
      continue;
    }

    const homeId = teamIdMap.get(`${sport}:${homeCanonical}`);
    const awayId = teamIdMap.get(`${sport}:${awayCanonical}`);

    if (!homeId || !awayId) {
      console.warn(
        `[ESPN Sync] Missing team ID: ${homeCanonical}=${homeId}, ${awayCanonical}=${awayId}`,
      );
      skipped++;
      continue;
    }

    const homeScore = game.homeTeam.score;
    const awayScore = game.awayTeam.score;

    if (homeScore == null || awayScore == null) {
      skipped++;
      continue;
    }

    try {
      const success = await insertCompletedGame(
        sport,
        homeId,
        awayId,
        homeScore,
        awayScore,
        new Date(game.date),
      );
      if (success) inserted++;
      else skipped++;
    } catch (err) {
      console.warn(
        `[ESPN Sync] Insert failed for ${awayCanonical} @ ${homeCanonical}:`,
        err,
      );
      skipped++;
    }
  }

  console.log(
    `[ESPN Sync] ${sport} ${targetDate}: fetched=${games.length}, completed=${completed.length}, inserted=${inserted}, skipped=${skipped}`,
  );

  return { sport, fetched: games.length, inserted, skipped };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Calculate spread result from HOME perspective. Exported for future use. */
export function calculateSpreadResult(
  homeScore: number,
  awayScore: number,
  spread: number | null,
): string | null {
  if (spread == null) return null;
  const margin = homeScore - awayScore + spread;
  if (margin > 0) return "COVERED";
  if (margin < 0) return "LOST";
  return "PUSH";
}

/** Calculate over/under result. Exported for future use. */
export function calculateOUResult(
  homeScore: number,
  awayScore: number,
  overUnder: number | null,
): string | null {
  if (overUnder == null) return null;
  const total = homeScore + awayScore;
  if (total > overUnder) return "OVER";
  if (total < overUnder) return "UNDER";
  return "PUSH";
}

/** Build a map of "SPORT:canonicalName" → team ID */
async function getTeamIdMap(): Promise<Map<string, number>> {
  const teams = await prisma.team.findMany({
    select: { id: true, name: true, sport: true },
  });

  const map = new Map<string, number>();
  for (const t of teams) {
    map.set(`${t.sport}:${t.name}`, t.id);
  }
  return map;
}

/**
 * Determine the current season year for a given game date + sport.
 * NFL/NCAAF: season = year when season starts (Aug-Jan: year of Aug)
 * NCAAMB: season = year when season ends (Nov-Apr: year of Apr)
 */
function getSeason(date: Date, sport: Sport): number {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();

  if (sport === "NCAAMB") {
    // NCAAMB season spans Nov-Apr; season year = calendar year when it ends
    // Nov, Dec → next year's season. Jan-Apr → current year's season.
    return month >= 11 ? year + 1 : year;
  }

  // NFL & NCAAF: season starts in Aug/Sep, playoffs in Jan/Feb
  // Aug-Dec → current year. Jan-Feb → previous year.
  return month <= 2 ? year - 1 : year;
}

/** Insert a completed game into the appropriate sport table */
async function insertCompletedGame(
  sport: Sport,
  homeTeamId: number,
  awayTeamId: number,
  homeScore: number,
  awayScore: number,
  gameDate: Date,
): Promise<boolean> {
  const season = getSeason(gameDate, sport);

  switch (sport) {
    case "NFL":
      await prisma.nFLGame.create({
        data: {
          season,
          week: "0", // Unknown from ESPN, will be updated if needed
          dayOfWeek: gameDate.toLocaleDateString("en-US", { weekday: "long" }),
          gameDate,
          homeTeamId,
          awayTeamId,
          homeScore,
          awayScore,
        },
      });
      return true;

    case "NCAAF":
      await prisma.nCAAFGame.create({
        data: {
          season,
          week: "0",
          dayOfWeek: gameDate.toLocaleDateString("en-US", { weekday: "long" }),
          gameDate,
          homeTeamId,
          awayTeamId,
          homeScore,
          awayScore,
        },
      });
      return true;

    case "NCAAMB":
      await prisma.nCAAMBGame.create({
        data: {
          season,
          gameDate,
          homeTeamId,
          awayTeamId,
          homeScore,
          awayScore,
        },
      });
      return true;

    default:
      return false;
  }
}
