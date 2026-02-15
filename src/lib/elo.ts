import "server-only";
import { prisma } from "./db";
import { resolveTeamId } from "./team-resolver";
import type { Sport } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface SignalResult {
  category: string;
  direction: "home" | "away" | "neutral";
  magnitude: number; // 0-10
  confidence: number; // 0-1
  label: string;
  strength: "strong" | "moderate" | "weak" | "noise";
}

/** Shape every sport's game rows are projected into for Elo processing. */
interface EloGameRow {
  gameDate: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
  isNeutralSite: boolean;
  season: number;
}

// ─── Per-Sport Configuration ────────────────────────────────────────────────

interface EloConfig {
  k: number;
  hfa: number; // home-field advantage in Elo points
  seasonRegression: number; // fraction toward 1500 at season boundary
}

const ELO_CONFIGS: Record<Sport, EloConfig> = {
  NFL: { k: 20, hfa: 48, seasonRegression: 0.33 },
  NBA: { k: 20, hfa: 100, seasonRegression: 0.25 },
  NCAAMB: { k: 32, hfa: 100, seasonRegression: 0.5 },
  NCAAF: { k: 25, hfa: 55, seasonRegression: 0.5 },
};

const BASE_ELO = 1500;

// ─── Core Elo Math ──────────────────────────────────────────────────────────

/**
 * Standard Elo expected win probability.
 * @param eloDiff  ratingA - ratingB
 * @returns probability that A wins (0-1)
 */
export function expectedWinProb(eloDiff: number): number {
  return 1 / (1 + Math.pow(10, -eloDiff / 400));
}

/**
 * Convert an Elo difference to a predicted point spread.
 * Positive eloDiff means the first team is favored (negative spread).
 */
export function eloToSpread(eloDiff: number): number {
  return eloDiff / 25;
}

/**
 * FiveThirtyEight's margin-of-victory multiplier.
 * Scales the K-factor update so blowouts count more, but dampens
 * the effect when the winner was already heavily favored.
 */
function movMultiplier(
  marginOfVictory: number,
  eloWinner: number,
  eloLoser: number
): number {
  return (
    Math.log(Math.abs(marginOfVictory) + 1) *
    (2.2 / ((eloWinner - eloLoser) * 0.001 + 2.2))
  );
}

// ─── Season Detection ───────────────────────────────────────────────────────

/**
 * Determine the season a game belongs to based on its date and sport.
 *
 * - NFL:    Aug-Feb  → year of August   (Jan 2026 → 2025 season)
 * - NBA:    Oct-Jun  → year of October  (Jan 2026 → 2025 season, so "2026 season" starts Oct 2025)
 * - NCAAMB: Nov-Apr  → year of April    (Nov 2025 → 2026 season)
 * - NCAAF:  Aug-Jan  → year of August   (Jan 2026 → 2025 season)
 */
function getSeason(date: Date, sport: Sport): number {
  const month = date.getUTCMonth() + 1; // 1-12
  const year = date.getUTCFullYear();

  switch (sport) {
    case "NFL":
      // Aug-Dec → that year; Jan-Feb → previous year
      return month >= 8 ? year : year - 1;

    case "NBA":
      // Oct-Dec → that year as season start; Jan-Jun → previous year as season start
      // Convention: season = year the season ends, so Oct 2025 → 2026
      return month >= 10 ? year + 1 : year;

    case "NCAAMB":
      // Nov-Dec → next year; Jan-Apr → that year
      return month >= 11 ? year + 1 : year;

    case "NCAAF":
      // Aug-Dec → that year; Jan → previous year
      return month >= 8 ? year : year - 1;
  }
}

// ─── Game Loading ───────────────────────────────────────────────────────────

/**
 * Load all completed games for a sport, ordered by date, projected
 * into a uniform shape.
 */
async function loadCompletedGames(sport: Sport): Promise<EloGameRow[]> {
  const select = {
    gameDate: true,
    homeTeamId: true,
    awayTeamId: true,
    homeScore: true,
    awayScore: true,
    isNeutralSite: true,
    season: true,
  } as const;

  switch (sport) {
    case "NFL":
      return prisma.nFLGame.findMany({
        where: { homeScore: { not: null }, awayScore: { not: null } },
        select,
        orderBy: { gameDate: "asc" },
      });

    case "NBA":
      return prisma.nBAGame.findMany({
        where: { homeScore: { not: null }, awayScore: { not: null } },
        select,
        orderBy: { gameDate: "asc" },
      });

    case "NCAAMB":
      return prisma.nCAAMBGame.findMany({
        where: { homeScore: { not: null }, awayScore: { not: null } },
        select,
        orderBy: { gameDate: "asc" },
      });

    case "NCAAF":
      return prisma.nCAAFGame.findMany({
        where: { homeScore: { not: null }, awayScore: { not: null } },
        select,
        orderBy: { gameDate: "asc" },
      });
  }
}

// ─── Full Recalculation ─────────────────────────────────────────────────────

/**
 * Recalculate Elo ratings from scratch for a given sport.
 *
 * 1. Load all completed games ordered by date.
 * 2. Initialize every team at BASE_ELO.
 * 3. Walk through games chronologically, updating Elo after each game.
 * 4. At season boundaries, regress all teams toward BASE_ELO.
 * 5. Upsert daily snapshots into the EloRating table.
 */
export async function recalculateElo(sport: Sport): Promise<void> {
  const config = ELO_CONFIGS[sport];
  console.log(
    `[elo] Starting full recalculation for ${sport} (K=${config.k}, HFA=${config.hfa})`
  );

  // Load all teams for this sport
  const teams = await prisma.team.findMany({ where: { sport } });
  const eloMap = new Map<number, number>();
  for (const t of teams) {
    eloMap.set(t.id, BASE_ELO);
  }

  // Load completed games
  const games = await loadCompletedGames(sport);
  console.log(
    `[elo] ${sport}: ${games.length} completed games, ${teams.length} teams`
  );

  if (games.length === 0) {
    console.log(`[elo] ${sport}: No games to process`);
    return;
  }

  // Track snapshots to upsert: Map<"teamId:date" → { teamId, date, elo }>
  const snapshots = new Map<
    string,
    { teamId: number; date: Date; elo: number }
  >();

  let prevSeason: number | null = null;

  for (const game of games) {
    if (game.homeScore === null || game.awayScore === null) continue;

    const season = getSeason(game.gameDate, sport);

    // Season boundary regression
    if (prevSeason !== null && season !== prevSeason) {
      console.log(
        `[elo] ${sport}: Season boundary ${prevSeason} → ${season}, regressing ${config.seasonRegression * 100}%`
      );
      eloMap.forEach((elo, teamId) => {
        eloMap.set(teamId, elo + (BASE_ELO - elo) * config.seasonRegression);
      });
    }
    prevSeason = season;

    // Ensure both teams exist in the map (handles expansion teams or late-added teams)
    if (!eloMap.has(game.homeTeamId)) eloMap.set(game.homeTeamId, BASE_ELO);
    if (!eloMap.has(game.awayTeamId)) eloMap.set(game.awayTeamId, BASE_ELO);

    const homeElo = eloMap.get(game.homeTeamId)!;
    const awayElo = eloMap.get(game.awayTeamId)!;

    // Home-field advantage: add HFA to home rating for expectation calc (skip for neutral sites)
    const hfaAdj = game.isNeutralSite ? 0 : config.hfa;
    const homeExpected = expectedWinProb(homeElo + hfaAdj - awayElo);

    const margin = game.homeScore - game.awayScore;

    let homeActual: number;
    let newHomeElo: number;
    let newAwayElo: number;

    if (margin === 0) {
      // Tie: split the adjustment
      homeActual = 0.5;
      movMultiplier(0, homeElo, awayElo); // ln(1) * ... = 0, so just base K
      const adjustment = config.k * (homeActual - homeExpected);
      newHomeElo = homeElo + adjustment;
      newAwayElo = awayElo - adjustment;
    } else {
      homeActual = margin > 0 ? 1 : 0;
      const winnerElo = margin > 0 ? homeElo : awayElo;
      const loserElo = margin > 0 ? awayElo : homeElo;
      const mov = movMultiplier(margin, winnerElo, loserElo);
      const adjustment = config.k * mov * (homeActual - homeExpected);
      newHomeElo = homeElo + adjustment;
      newAwayElo = awayElo - adjustment;
    }

    eloMap.set(game.homeTeamId, newHomeElo);
    eloMap.set(game.awayTeamId, newAwayElo);

    // Record snapshots for the game date
    const dateKey = game.gameDate.toISOString().slice(0, 10);
    const homeKey = `${game.homeTeamId}:${dateKey}`;
    const awayKey = `${game.awayTeamId}:${dateKey}`;

    // Use the post-game Elo as the snapshot for that date.
    // If a team plays multiple games on the same day, the last one wins.
    const snapshotDate = new Date(dateKey + "T00:00:00.000Z");
    snapshots.set(homeKey, {
      teamId: game.homeTeamId,
      date: snapshotDate,
      elo: newHomeElo,
    });
    snapshots.set(awayKey, {
      teamId: game.awayTeamId,
      date: snapshotDate,
      elo: newAwayElo,
    });
  }

  // Batch upsert snapshots
  console.log(`[elo] ${sport}: Upserting ${snapshots.size} Elo snapshots`);

  // Delete existing data for this sport to avoid stale rows, then bulk insert
  await prisma.$transaction(async (tx) => {
    await tx.eloRating.deleteMany({ where: { sport } });

    // Batch insert in chunks of 1000
    const rows = Array.from(snapshots.values());
    const CHUNK_SIZE = 1000;
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      await tx.eloRating.createMany({
        data: chunk.map((r) => ({
          teamId: r.teamId,
          sport,
          date: r.date,
          elo: Math.round(r.elo * 100) / 100, // round to 2 decimals
        })),
      });
    }
  });

  console.log(`[elo] ${sport}: Recalculation complete`);
}

// ─── Query Helpers ──────────────────────────────────────────────────────────

/**
 * Get the most recent Elo rating for a team from the DB.
 * Returns BASE_ELO (1500) if no rating is found.
 */
export async function getCurrentElo(
  teamId: number,
  sport: Sport
): Promise<number> {
  const latest = await prisma.eloRating.findFirst({
    where: { teamId, sport },
    orderBy: { date: "desc" },
    select: { elo: true },
  });
  return latest?.elo ?? BASE_ELO;
}

// ─── Signal Function (Pick Engine Integration) ──────────────────────────────

/**
 * Elo-based signal for the pick engine.
 *
 * Computes an Elo-derived predicted spread and compares it to the market spread.
 * The divergence between Elo spread and market spread is the signal magnitude.
 */
export async function signalEloEdge(
  homeTeamName: string,
  awayTeamName: string,
  sport: Sport,
  spread: number | null
): Promise<SignalResult> {
  const neutral: SignalResult = {
    category: "eloEdge",
    direction: "neutral",
    magnitude: 0,
    confidence: 0,
    label: "No Elo data available",
    strength: "noise",
  };

  // Resolve team IDs
  const [homeId, awayId] = await Promise.all([
    resolveTeamId(homeTeamName, sport, "db"),
    resolveTeamId(awayTeamName, sport, "db"),
  ]);

  if (!homeId || !awayId) {
    console.log(
      `[elo] Signal: could not resolve teams — home="${homeTeamName}" away="${awayTeamName}" sport=${sport}`
    );
    return neutral;
  }

  // Get current Elo ratings
  const [homeElo, awayElo] = await Promise.all([
    getCurrentElo(homeId, sport),
    getCurrentElo(awayId, sport),
  ]);

  // If both are at base Elo, we have no useful signal
  if (homeElo === BASE_ELO && awayElo === BASE_ELO) {
    return neutral;
  }

  const config = ELO_CONFIGS[sport];
  const eloDiff = homeElo + config.hfa - awayElo;
  const predictedSpread = eloToSpread(eloDiff); // positive = home favored (negative spread convention)
  const winProb = expectedWinProb(eloDiff);

  // If no market spread, return the raw Elo assessment
  if (spread === null) {
    const direction: SignalResult["direction"] =
      eloDiff > 0 ? "home" : eloDiff < 0 ? "away" : "neutral";
    const mag = Math.min(10, Math.abs(predictedSpread) / 3);
    const conf = Math.abs(winProb - 0.5) * 2; // 0 at 50%, 1 at 100%

    return {
      category: "eloEdge",
      direction,
      magnitude: Math.round(mag * 10) / 10,
      confidence: Math.round(conf * 100) / 100,
      label: `Elo: ${homeTeamName} ${homeElo.toFixed(0)} vs ${awayTeamName} ${awayElo.toFixed(0)} (${(winProb * 100).toFixed(1)}% home)`,
      strength: classifyStrength(mag),
    };
  }

  // Compare Elo spread to market spread
  // Market spread: negative = home favored. Elo predictedSpread: positive = home favored.
  // Convert Elo spread to market convention: negate it.
  const eloMarketSpread = -predictedSpread;
  const edge = eloMarketSpread - spread; // positive edge = Elo thinks home is better than market does

  // Direction: if edge > 0, Elo favors home more than market → bet home ATS
  //            if edge < 0, Elo favors away more than market → bet away ATS
  const absEdge = Math.abs(edge);
  const direction: SignalResult["direction"] =
    absEdge < 1 ? "neutral" : edge > 0 ? "home" : "away";
  const sideLabel =
    direction === "home"
      ? homeTeamName
      : direction === "away"
        ? awayTeamName
        : "neither";

  // Magnitude: scale edge points to 0-10 (3pt edge = ~5 magnitude)
  const magnitude = Math.min(10, Math.round((absEdge / 6) * 10 * 10) / 10);

  // Confidence: based on sample size proxy (distance from 1500 for both teams)
  const avgDeviation =
    (Math.abs(homeElo - BASE_ELO) + Math.abs(awayElo - BASE_ELO)) / 2;
  const confidence = Math.min(1, Math.round((avgDeviation / 300) * 100) / 100);

  return {
    category: "eloEdge",
    direction,
    magnitude,
    confidence,
    label: `Elo edge: ${absEdge.toFixed(1)}pts toward ${sideLabel} (Elo spread ${eloMarketSpread > 0 ? "+" : ""}${eloMarketSpread.toFixed(1)} vs market ${spread > 0 ? "+" : ""}${spread.toFixed(1)})`,
    strength: classifyStrength(magnitude),
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function classifyStrength(magnitude: number): SignalResult["strength"] {
  if (magnitude >= 7) return "strong";
  if (magnitude >= 4) return "moderate";
  if (magnitude >= 2) return "weak";
  return "noise";
}
