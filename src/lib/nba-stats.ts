import "server-only";

/**
 * NBA.com Stats API client with in-memory caching.
 *
 * Fetches team advanced stats and Four Factors from the official
 * NBA.com stats API. Stores daily snapshots in NBATeamStats table.
 *
 * Cache TTL: 6 hours. 1-second delay between API requests.
 */

import { prisma } from "./db";

// ─── Constants ─────────────────────────────────────────────────────────────

const NBA_STATS_BASE = "https://stats.nba.com/stats/leaguedashteamstats";

const NBA_HEADERS: Record<string, string> = {
  Referer: "https://www.nba.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

/** Home-court advantage in NBA, roughly 2.5 points. */
const HCA = 2.5;

// ─── Types ─────────────────────────────────────────────────────────────────

export interface NBATeamAdvancedStats {
  teamId: number; // NBA.com team ID
  teamName: string;
  wins: number;
  losses: number;
  // Advanced
  netRating: number;
  offRating: number;
  defRating: number;
  pace: number;
  // Four Factors (offense)
  efgPct: number;
  tovPct: number;
  orbPct: number;
  ftRate: number;
  // Four Factors (opponent/defense)
  oppEfgPct: number;
  oppTovPct: number;
  oppOrbPct: number;
  oppFtRate: number;
}

export interface SignalResult {
  category: string;
  direction: "home" | "away" | "over" | "under" | "neutral";
  magnitude: number; // 0-10
  confidence: number; // 0-1
  label: string;
  strength: "strong" | "moderate" | "weak" | "noise";
}

interface NBAStatsApiResponse {
  resultSets: Array<{
    headers: string[];
    rowSet: (string | number | null)[][];
  }>;
}

// ─── Cache ─────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const statsCacheBySeason = new Map<
  string,
  CacheEntry<Map<string, NBATeamAdvancedStats>>
>();

export function clearNBACache(): void {
  statsCacheBySeason.clear();
  console.log("[nba-stats] Cache cleared");
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Compute the NBA season string from the current date.
 * NBA seasons span two calendar years; October starts a new season.
 * e.g. "2025-26" for the 2025-26 season.
 */
function getCurrentNBASeason(): string {
  const now = new Date();
  const year = now.getMonth() >= 9 ? now.getFullYear() : now.getFullYear() - 1;
  const nextYear = (year + 1) % 100;
  return `${year}-${String(nextYear).padStart(2, "0")}`;
}

/** Sleep for the given number of milliseconds. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch a single measure type from the NBA.com stats API.
 * Returns the first resultSet's headers and rowSet.
 */
async function fetchNBAStats(
  measureType: string,
  season: string
): Promise<{ headers: string[]; rows: (string | number | null)[][] }> {
  const url = new URL(NBA_STATS_BASE);
  url.searchParams.set("MeasureType", measureType);
  url.searchParams.set("Season", season);
  url.searchParams.set("SeasonType", "Regular Season");
  url.searchParams.set("PerMode", "PerGame");

  const res = await fetch(url.toString(), {
    headers: NBA_HEADERS,
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `NBA Stats API ${res.status} (${measureType}): ${text.slice(0, 300)}`
    );
  }

  const json = (await res.json()) as NBAStatsApiResponse;
  const rs = json.resultSets?.[0];
  if (!rs) {
    throw new Error(`NBA Stats API: no resultSets for ${measureType}`);
  }

  return { headers: rs.headers, rows: rs.rowSet };
}

/**
 * Extract a value from a row by header name.
 * Returns undefined if the header is not found.
 */
function getVal(
  headers: string[],
  row: (string | number | null)[],
  headerName: string
): string | number | null | undefined {
  const idx = headers.indexOf(headerName);
  return idx >= 0 ? row[idx] : undefined;
}

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Fetch NBA team advanced stats + Four Factors for the given season.
 * Returns a Map keyed by team name (e.g. "Los Angeles Lakers").
 * Cached for 6 hours in memory.
 */
export async function getNBATeamStats(
  season?: string
): Promise<Map<string, NBATeamAdvancedStats>> {
  const s = season ?? getCurrentNBASeason();
  const now = Date.now();

  const cached = statsCacheBySeason.get(s);
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  console.log(`[nba-stats] Fetching advanced stats for ${s}...`);

  // Fetch advanced stats
  const advanced = await fetchNBAStats("Advanced", s);

  // 1-second delay between requests
  await sleep(1000);

  // Fetch Four Factors
  const fourFactors = await fetchNBAStats("Four Factors", s);

  // Build a lookup from the Four Factors data keyed by NBA team ID
  const ffByTeamId = new Map<
    number,
    { headers: string[]; row: (string | number | null)[] }
  >();
  for (const row of fourFactors.rows) {
    const tid = getVal(fourFactors.headers, row, "TEAM_ID") as number;
    if (tid != null) {
      ffByTeamId.set(tid, { headers: fourFactors.headers, row });
    }
  }

  // Merge into a single NBATeamAdvancedStats per team
  const result = new Map<string, NBATeamAdvancedStats>();

  for (const row of advanced.rows) {
    const nbaTeamId = getVal(advanced.headers, row, "TEAM_ID") as number;
    const teamName = getVal(advanced.headers, row, "TEAM_NAME") as string;

    if (!teamName || nbaTeamId == null) continue;

    const ff = ffByTeamId.get(nbaTeamId);

    const stats: NBATeamAdvancedStats = {
      teamId: nbaTeamId,
      teamName,
      wins: (getVal(advanced.headers, row, "W") as number) ?? 0,
      losses: (getVal(advanced.headers, row, "L") as number) ?? 0,
      // Advanced
      netRating: (getVal(advanced.headers, row, "NET_RATING") as number) ?? 0,
      offRating: (getVal(advanced.headers, row, "OFF_RATING") as number) ?? 0,
      defRating: (getVal(advanced.headers, row, "DEF_RATING") as number) ?? 0,
      pace: (getVal(advanced.headers, row, "PACE") as number) ?? 0,
      // Four Factors (offense) — from FF endpoint
      efgPct: ff ? ((getVal(ff.headers, ff.row, "EFG_PCT") as number) ?? 0) : 0,
      tovPct: ff
        ? ((getVal(ff.headers, ff.row, "TM_TOV_PCT") as number) ?? 0)
        : 0,
      orbPct: ff
        ? ((getVal(ff.headers, ff.row, "OREB_PCT") as number) ?? 0)
        : 0,
      ftRate: ff
        ? ((getVal(ff.headers, ff.row, "FTA_RATE") as number) ?? 0)
        : 0,
      // Four Factors (opponent/defense) — from FF endpoint
      oppEfgPct: ff
        ? ((getVal(ff.headers, ff.row, "OPP_EFG_PCT") as number) ?? 0)
        : 0,
      oppTovPct: ff
        ? ((getVal(ff.headers, ff.row, "OPP_TOV_PCT") as number) ?? 0)
        : 0,
      oppOrbPct: ff
        ? ((getVal(ff.headers, ff.row, "OPP_OREB_PCT") as number) ?? 0)
        : 0,
      oppFtRate: ff
        ? ((getVal(ff.headers, ff.row, "OPP_FTA_RATE") as number) ?? 0)
        : 0,
    };

    result.set(teamName, stats);
  }

  statsCacheBySeason.set(s, { data: result, fetchedAt: Date.now() });
  console.log(`[nba-stats] Fetched ${result.size} teams for ${s}`);

  return result;
}

// ─── Sync to DB ────────────────────────────────────────────────────────────

/**
 * Fetch current NBA team stats and upsert into NBATeamStats for today's date.
 * Resolves NBA team names to internal Team IDs.
 * Returns { synced, errors }.
 */
export async function syncNBATeamStats(): Promise<{
  synced: number;
  errors: number;
}> {
  const season = getCurrentNBASeason();
  const stats = await getNBATeamStats(season);

  // Build name -> DB Team ID mapping
  const dbTeams = await prisma.team.findMany({
    where: { sport: "NBA" },
    select: { id: true, name: true },
  });
  const nameToDbId = new Map<string, number>();
  for (const t of dbTeams) {
    nameToDbId.set(t.name, t.id);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let synced = 0;
  let errors = 0;

  for (const [teamName, s] of Array.from(stats.entries())) {
    const dbTeamId = nameToDbId.get(teamName);
    if (!dbTeamId) {
      console.log(`[nba-stats] No DB team found for "${teamName}", skipping`);
      errors++;
      continue;
    }

    try {
      await prisma.nBATeamStats.upsert({
        where: {
          teamId_date: {
            teamId: dbTeamId,
            date: today,
          },
        },
        create: {
          teamId: dbTeamId,
          date: today,
          netRating: s.netRating,
          offRating: s.offRating,
          defRating: s.defRating,
          pace: s.pace,
          efgPct: s.efgPct,
          tovPct: s.tovPct,
          orbPct: s.orbPct,
          ftRate: s.ftRate,
          oppEfgPct: s.oppEfgPct,
          oppTovPct: s.oppTovPct,
          oppOrbPct: s.oppOrbPct,
          oppFtRate: s.oppFtRate,
          wins: s.wins,
          losses: s.losses,
        },
        update: {
          netRating: s.netRating,
          offRating: s.offRating,
          defRating: s.defRating,
          pace: s.pace,
          efgPct: s.efgPct,
          tovPct: s.tovPct,
          orbPct: s.orbPct,
          ftRate: s.ftRate,
          oppEfgPct: s.oppEfgPct,
          oppTovPct: s.oppTovPct,
          oppOrbPct: s.oppOrbPct,
          oppFtRate: s.oppFtRate,
          wins: s.wins,
          losses: s.losses,
        },
      });
      synced++;
    } catch (err) {
      console.log(
        `[nba-stats] Error upserting ${teamName}: ${err instanceof Error ? err.message : err}`
      );
      errors++;
    }
  }

  console.log(`[nba-stats] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

// ─── Pick Engine Signal ────────────────────────────────────────────────────

/**
 * Compute spread + O/U signals from NBA Four Factors data.
 *
 * Spread: Compare net ratings with HCA adjustment.
 *   predictedSpread = (homeNetRating - awayNetRating) * 0.3 + HCA
 *   Edge = predictedSpread - marketSpread
 *
 * O/U: Use pace and offensive ratings to estimate total.
 *   predictedTotal = (homePace + awayPace) / 2 * (homeOffRating + awayOffRating) / 200
 *   Edge = predictedTotal - marketTotal
 */
export async function signalNBAFourFactors(
  homeTeamName: string,
  awayTeamName: string,
  spread: number | null,
  overUnder: number | null
): Promise<{ spread: SignalResult; ou: SignalResult }> {
  const neutral: SignalResult = {
    category: "nbaFourFactors",
    direction: "neutral",
    magnitude: 0,
    confidence: 0,
    label: "No NBA stats available",
    strength: "noise",
  };

  let stats: Map<string, NBATeamAdvancedStats>;
  try {
    stats = await getNBATeamStats();
  } catch (err) {
    console.log(
      `[nba-stats] Signal fetch error: ${err instanceof Error ? err.message : err}`
    );
    return { spread: neutral, ou: neutral };
  }

  const home = stats.get(homeTeamName);
  const away = stats.get(awayTeamName);

  if (!home || !away) {
    const missing = !home ? homeTeamName : awayTeamName;
    console.log(`[nba-stats] No stats for "${missing}", returning neutral`);
    return { spread: neutral, ou: neutral };
  }

  // ── Spread signal ──────────────────────────────────────────────────────
  let spreadSignal: SignalResult = { ...neutral };

  if (spread !== null) {
    // Positive spread means home is underdog in standard convention
    // predictedSpread: negative = home favored
    const predictedSpread = -((home.netRating - away.netRating) * 0.3 + HCA);
    const edge = predictedSpread - spread;
    const absEdge = Math.abs(edge);

    // Magnitude: scale 0-10, with 5 points of edge = 10
    const magnitude = Math.min(10, (absEdge / 5) * 10);

    // Confidence: based on edge size and sample (wins+losses)
    const homeGames = home.wins + home.losses;
    const awayGames = away.wins + away.losses;
    const sampleFactor = Math.min(1, Math.min(homeGames, awayGames) / 40);
    const confidence = Math.min(1, (absEdge / 8) * sampleFactor);

    const direction: "home" | "away" = edge < 0 ? "home" : "away";
    const strength = getStrength(absEdge, [4, 2.5, 1]);

    spreadSignal = {
      category: "nbaFourFactors",
      direction,
      magnitude: round2(magnitude),
      confidence: round2(confidence),
      label: `Net rating edge: ${direction === "home" ? home.teamName : away.teamName} by ${absEdge.toFixed(1)}pts (predicted ${predictedSpread.toFixed(1)} vs line ${spread > 0 ? "+" : ""}${spread})`,
      strength,
    };
  }

  // ── O/U signal ─────────────────────────────────────────────────────────
  let ouSignal: SignalResult = { ...neutral };

  if (overUnder !== null) {
    const avgPace = (home.pace + away.pace) / 2;
    const predictedTotal = (avgPace * (home.offRating + away.offRating)) / 200;
    const edge = predictedTotal - overUnder;
    const absEdge = Math.abs(edge);

    const magnitude = Math.min(10, (absEdge / 8) * 10);

    const homeGames = home.wins + home.losses;
    const awayGames = away.wins + away.losses;
    const sampleFactor = Math.min(1, Math.min(homeGames, awayGames) / 40);
    const confidence = Math.min(1, (absEdge / 12) * sampleFactor);

    const direction: "over" | "under" = edge > 0 ? "over" : "under";
    const strength = getStrength(absEdge, [6, 3, 1.5]);

    ouSignal = {
      category: "nbaFourFactors",
      direction,
      magnitude: round2(magnitude),
      confidence: round2(confidence),
      label: `Pace/rating total: ${predictedTotal.toFixed(1)} vs line ${overUnder} (${direction} by ${absEdge.toFixed(1)})`,
      strength,
    };
  }

  return { spread: spreadSignal, ou: ouSignal };
}

// ─── Internal Utilities ────────────────────────────────────────────────────

function getStrength(
  absEdge: number,
  thresholds: [number, number, number]
): "strong" | "moderate" | "weak" | "noise" {
  if (absEdge >= thresholds[0]) return "strong";
  if (absEdge >= thresholds[1]) return "moderate";
  if (absEdge >= thresholds[2]) return "weak";
  return "noise";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
