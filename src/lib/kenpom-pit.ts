import "server-only";

/**
 * Point-in-time (PIT) KenPom lookup module.
 *
 * Queries the KenpomSnapshot table for historical ratings as they were
 * on a specific date, avoiding end-of-season (EOS) look-ahead bias.
 *
 * For today's games, falls back to the live KenPom API (which IS true PIT).
 */

import { prisma } from "./db";
import { getKenpomRatings, type KenpomRating } from "./kenpom";

// ─── Types ──────────────────────────────────────────────────────────────────

/** Minimal PIT rating — matches the fields stored in KenpomSnapshot. */
export interface PITRating {
  teamName: string;
  snapshotDate: Date;
  season: number;
  adjEM: number;
  adjOE: number;
  adjDE: number;
  adjTempo: number;
  rankAdjEM: number;
  confShort: string;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

// Past-date lookups are immutable, so cache aggressively.
// Key: "teamName:YYYY-MM-DD"
const pitCache = new Map<string, PITRating | null>();
const MAX_CACHE_SIZE = 50_000;

function cacheKey(teamName: string, date: string): string {
  return `${teamName}:${date}`;
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getUTCFullYear() === now.getUTCFullYear() &&
    date.getUTCMonth() === now.getUTCMonth() &&
    date.getUTCDate() === now.getUTCDate()
  );
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get point-in-time KenPom rating for a team on a specific date.
 *
 * Returns the most recent KenpomSnapshot on or before `gameDate`.
 * For today's date, falls back to the live KenPom API.
 */
export async function getKenpomPIT(
  teamName: string,
  gameDate: Date,
  season?: number
): Promise<PITRating | null> {
  // For today's games, use the live API (which is true PIT)
  if (isToday(gameDate)) {
    return getKenpomPITFromLive(teamName, season);
  }

  const dateStr = gameDate.toISOString().slice(0, 10);
  const key = cacheKey(teamName, dateStr);

  if (pitCache.has(key)) {
    return pitCache.get(key) ?? null;
  }

  const snapshot = await prisma.kenpomSnapshot.findFirst({
    where: {
      teamName,
      snapshotDate: { lte: gameDate },
      ...(season != null ? { season } : {}),
    },
    orderBy: { snapshotDate: "desc" },
  });

  const result: PITRating | null = snapshot
    ? {
        teamName: snapshot.teamName,
        snapshotDate: snapshot.snapshotDate,
        season: snapshot.season,
        adjEM: snapshot.adjEM,
        adjOE: snapshot.adjOE,
        adjDE: snapshot.adjDE,
        adjTempo: snapshot.adjTempo,
        rankAdjEM: snapshot.rankAdjEM,
        confShort: snapshot.confShort,
      }
    : null;

  // Evict if cache too large
  if (pitCache.size >= MAX_CACHE_SIZE) {
    pitCache.clear();
  }
  pitCache.set(key, result);

  return result;
}

/**
 * Batch PIT lookup for multiple teams on the same date.
 * More efficient than N individual queries — uses a single DB query.
 */
export async function getKenpomPITBatch(
  teamNames: string[],
  gameDate: Date,
  season?: number
): Promise<Map<string, PITRating>> {
  const result = new Map<string, PITRating>();

  if (teamNames.length === 0) return result;

  // For today's games, use the live API
  if (isToday(gameDate)) {
    const ratings = await getKenpomRatings(season);
    for (const name of teamNames) {
      const r = ratings.get(name);
      if (r) {
        result.set(name, liveRatingToPIT(r, gameDate));
      }
    }
    return result;
  }

  const dateStr = gameDate.toISOString().slice(0, 10);

  // Check cache for all teams, collect misses
  const misses: string[] = [];
  for (const name of teamNames) {
    const key = cacheKey(name, dateStr);
    if (pitCache.has(key)) {
      const cached = pitCache.get(key);
      if (cached) result.set(name, cached);
    } else {
      misses.push(name);
    }
  }

  if (misses.length === 0) return result;

  // Batch query: get the most recent snapshot for each team on or before gameDate.
  // Uses a raw query with DISTINCT ON for efficiency.
  type SnapshotRow = {
    teamName: string;
    snapshotDate: Date;
    season: number;
    adjEM: number;
    adjOE: number;
    adjDE: number;
    adjTempo: number;
    rankAdjEM: number;
    confShort: string;
  };

  const snapshots: SnapshotRow[] =
    season != null
      ? await prisma.$queryRaw<SnapshotRow[]>`
          SELECT DISTINCT ON ("teamName")
            "teamName", "snapshotDate", "season",
            "adjEM", "adjOE", "adjDE", "adjTempo",
            "rankAdjEM", "confShort"
          FROM "KenpomSnapshot"
          WHERE "teamName" = ANY(${misses})
            AND "snapshotDate" <= ${gameDate}
            AND "season" = ${season}
          ORDER BY "teamName", "snapshotDate" DESC
        `
      : await prisma.$queryRaw<SnapshotRow[]>`
          SELECT DISTINCT ON ("teamName")
            "teamName", "snapshotDate", "season",
            "adjEM", "adjOE", "adjDE", "adjTempo",
            "rankAdjEM", "confShort"
          FROM "KenpomSnapshot"
          WHERE "teamName" = ANY(${misses})
            AND "snapshotDate" <= ${gameDate}
          ORDER BY "teamName", "snapshotDate" DESC
        `;

  // Cache results
  for (const s of snapshots) {
    const pit: PITRating = {
      teamName: s.teamName,
      snapshotDate: s.snapshotDate,
      season: s.season,
      adjEM: Number(s.adjEM),
      adjOE: Number(s.adjOE),
      adjDE: Number(s.adjDE),
      adjTempo: Number(s.adjTempo),
      rankAdjEM: Number(s.rankAdjEM),
      confShort: s.confShort,
    };
    result.set(s.teamName, pit);
    const key = cacheKey(s.teamName, dateStr);
    if (pitCache.size >= MAX_CACHE_SIZE) pitCache.clear();
    pitCache.set(key, pit);
  }

  // Cache nulls for teams with no snapshot
  for (const name of misses) {
    if (!result.has(name)) {
      const key = cacheKey(name, dateStr);
      pitCache.set(key, null);
    }
  }

  return result;
}

/**
 * Clear the PIT cache (useful for testing or after bulk imports).
 */
export function clearPITCache(): void {
  pitCache.clear();
}

// ─── Private Helpers ────────────────────────────────────────────────────────

async function getKenpomPITFromLive(
  teamName: string,
  season?: number
): Promise<PITRating | null> {
  const ratings = await getKenpomRatings(season);
  const r = ratings.get(teamName);
  if (!r) return null;
  return liveRatingToPIT(r, new Date());
}

function liveRatingToPIT(r: KenpomRating, date: Date): PITRating {
  return {
    teamName: r.TeamName,
    snapshotDate: date,
    season: r.Season,
    adjEM: r.AdjEM,
    adjOE: r.AdjOE,
    adjDE: r.AdjDE,
    adjTempo: r.AdjTempo,
    rankAdjEM: r.RankAdjEM,
    confShort: r.ConfShort,
  };
}
