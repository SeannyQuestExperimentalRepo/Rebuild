import "server-only";

/**
 * Barttorvik T-Rank scraper with in-memory caching.
 *
 * Fetches team efficiency ratings from barttorvik.com for NCAAMB
 * ensemble modeling (60% KenPom + 40% Barttorvik at the weight level).
 *
 * Cache TTL: 6 hours for ratings.
 */

import * as cheerio from "cheerio";
import { prisma } from "./db";
import { resolveTeamName, resolveTeamId, normalize } from "./team-resolver";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface BarttovikRating {
  team: string;
  tRank: number;
  tRankRating: number;
  adjOE: number;
  adjDE: number;
  barthag: number;
  adjTempo: number;
  luck: number;
  sos: number;
  wins: number;
  losses: number;
}

export interface SignalResult {
  category: string;
  direction: "home" | "away" | "over" | "under" | "neutral";
  magnitude: number; // 0-10
  confidence: number; // 0-1
  label: string;
  strength: "strong" | "moderate" | "weak" | "noise";
}

// ─── Constants ──────────────────────────────────────────────────────────────

const JSON_URL = "https://barttorvik.com/getadvstats.php";
const HTML_URL = "https://barttorvik.com/trank.php";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Home court advantage in points (Barttorvik convention ~3.5) */
const HCA_POINTS = 3.5;

// ─── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const RATINGS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

const ratingsCacheBySeason = new Map<
  number,
  CacheEntry<Map<string, BarttovikRating>>
>();

export function clearBarttovikCache(): void {
  ratingsCacheBySeason.clear();
  console.log("[barttorvik] Cache cleared");
}

// ─── Season Helper ──────────────────────────────────────────────────────────

function getCurrentBarttovikSeason(): number {
  const now = new Date();
  // NCAAMB season: Nov-Apr. Use ending year (2025-26 season = 2026)
  return now.getMonth() >= 10 ? now.getFullYear() + 1 : now.getFullYear();
}

// ─── Fetch Helpers ──────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to fetch ratings from the JSON endpoint.
 * Returns null if the endpoint fails or returns unexpected data.
 */
async function fetchJsonRatings(
  season: number
): Promise<BarttovikRating[] | null> {
  try {
    const url = `${JSON_URL}?year=${season}`;
    console.log(`[barttorvik] Trying JSON endpoint for ${season}...`);

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.log(
        `[barttorvik] JSON endpoint returned ${res.status}, falling back to HTML`
      );
      return null;
    }

    const text = await res.text();

    // The JSON endpoint may return HTML or empty data in some cases
    if (!text || text.trim().startsWith("<") || text.trim().startsWith("<!")) {
      console.log(
        "[barttorvik] JSON endpoint returned HTML, falling back to HTML scraper"
      );
      return null;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      console.log(
        "[barttorvik] JSON endpoint returned invalid JSON, falling back to HTML"
      );
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) {
      console.log(
        "[barttorvik] JSON endpoint returned empty/unexpected data, falling back to HTML"
      );
      return null;
    }

    // Parse the JSON array — each element is an array of values
    // Format: [rank, team, conf, record, adjOE, adjDE, barthag, ..., adjTempo, ..., luck, ..., sos, ...]
    // The exact indices depend on the API response structure
    const ratings: BarttovikRating[] = [];

    for (const row of data) {
      if (!Array.isArray(row) || row.length < 10) continue;

      const teamName = String(row[0] ?? "").trim();
      if (!teamName) continue;

      // Parse record string like "20-5"
      const recordStr = String(row[2] ?? "0-0");
      const recordParts = recordStr.split("-");
      const wins = parseInt(recordParts[0]) || 0;
      const losses = parseInt(recordParts[1]) || 0;

      ratings.push({
        team: teamName,
        tRank: parseInt(row[17]) || 0,
        tRankRating: parseFloat(row[4]) || 0,
        adjOE: parseFloat(row[5]) || 0,
        adjDE: parseFloat(row[6]) || 0,
        barthag: parseFloat(row[3]) || 0,
        adjTempo: parseFloat(row[7]) || 0,
        luck: parseFloat(row[9]) || 0,
        sos: parseFloat(row[10]) || 0,
        wins,
        losses,
      });
    }

    if (ratings.length > 0) {
      console.log(
        `[barttorvik] JSON endpoint returned ${ratings.length} teams`
      );
      return ratings;
    }

    console.log(
      "[barttorvik] JSON parsing produced no valid teams, falling back to HTML"
    );
    return null;
  } catch (err) {
    console.log(
      `[barttorvik] JSON endpoint error: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}

/**
 * Fetch ratings by scraping the HTML T-Rank page.
 */
async function fetchHtmlRatings(
  season: number
): Promise<BarttovikRating[] | null> {
  try {
    const url = `${HTML_URL}?year=${season}&sort=&lastx=0&hession=All&show=&top=0&conlimit=All&venue=All&type=All&count=500`;
    console.log(`[barttorvik] Scraping HTML for ${season}...`);

    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.error(`[barttorvik] HTML page returned ${res.status}`);
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const ratings: BarttovikRating[] = [];

    // The main table contains all team ratings
    // Each row has cells: Rank, Team, Conf, Record, AdjOE, AdjDE, Barthag, ...
    $(
      "table#content-table tbody tr, table.datatable tbody tr, table tbody tr"
    ).each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 10) return;

      const rank = parseInt($(cells[0]).text().trim());
      if (isNaN(rank)) return; // Skip header/non-data rows

      const teamName = $(cells[1]).text().trim();
      if (!teamName) return;

      // Parse record — may be in format "20-5" or similar
      const recordText = $(cells[3]).text().trim();
      const recordParts = recordText.split("-");
      const wins = parseInt(recordParts[0]) || 0;
      const losses = parseInt(recordParts[1]) || 0;

      ratings.push({
        team: teamName,
        tRank: rank,
        tRankRating: parseFloat($(cells[4]).text().trim()) || 0,
        adjOE: parseFloat($(cells[5]).text().trim()) || 0,
        adjDE: parseFloat($(cells[6]).text().trim()) || 0,
        barthag: parseFloat($(cells[7]).text().trim()) || 0,
        adjTempo: parseFloat($(cells[8]).text().trim()) || 0,
        luck: parseFloat($(cells[9]).text().trim()) || 0,
        sos: parseFloat($(cells[10]).text().trim()) || 0,
        wins,
        losses,
      });
    });

    if (ratings.length > 0) {
      console.log(`[barttorvik] HTML scraper found ${ratings.length} teams`);
      return ratings;
    }

    console.error("[barttorvik] HTML scraper found no teams in table");
    return null;
  } catch (err) {
    console.error(
      `[barttorvik] HTML scraper error: ${err instanceof Error ? err.message : err}`
    );
    return null;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch T-Rank ratings for the given season.
 * Returns a Map keyed by canonical DB team name.
 * Tries the JSON endpoint first, falls back to HTML scraping.
 * Cached for 6 hours.
 */
export async function getBarttovikRatings(
  season?: number
): Promise<Map<string, BarttovikRating>> {
  const y = season ?? getCurrentBarttovikSeason();
  const now = Date.now();

  const cached = ratingsCacheBySeason.get(y);
  if (cached && now - cached.fetchedAt < RATINGS_TTL_MS) {
    return cached.data;
  }

  // Try JSON endpoint first, then fall back to HTML
  let rawRatings = await fetchJsonRatings(y);

  if (!rawRatings) {
    await delay(2000); // Respect rate limits between requests
    rawRatings = await fetchHtmlRatings(y);
  }

  if (!rawRatings || rawRatings.length === 0) {
    console.error(`[barttorvik] Failed to fetch ratings for ${y}`);
    // Return empty map (or stale cache if available)
    if (cached) {
      console.log("[barttorvik] Returning stale cache");
      return cached.data;
    }
    return new Map();
  }

  // Re-key by DB canonical name using team-resolver
  const map = new Map<string, BarttovikRating>();
  let resolved = 0;

  for (const rating of rawRatings) {
    const canonical = await resolveTeamName(
      rating.team,
      "NCAAMB",
      "barttorvik"
    );
    map.set(canonical, { ...rating, team: canonical });
    resolved++;
  }

  ratingsCacheBySeason.set(y, { data: map, fetchedAt: now });
  console.log(
    `[barttorvik] Fetched ${map.size} team ratings for ${y} (${resolved} resolved)`
  );
  return map;
}

/**
 * Look up a team by name with fuzzy matching.
 * First tries exact match, then normalized match against all keys.
 */
export function lookupBarttovikRating(
  ratings: Map<string, BarttovikRating>,
  teamName: string
): BarttovikRating | undefined {
  // 1. Exact match
  const exact = ratings.get(teamName);
  if (exact) return exact;

  // 2. Normalized match against all keys
  const norm = normalize(teamName);
  for (const [key, val] of Array.from(ratings.entries())) {
    if (normalize(key) === norm) return val;
  }

  return undefined;
}

/**
 * Fetch current ratings and upsert into BarttovikSnapshot table for today's date.
 */
export async function syncBarttovikRatings(
  season?: number
): Promise<{ synced: number; errors: number }> {
  const y = season ?? getCurrentBarttovikSeason();
  const ratings = await getBarttovikRatings(y);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let synced = 0;
  let errors = 0;

  for (const [teamName, rating] of Array.from(ratings.entries())) {
    try {
      const teamId = await resolveTeamId(teamName, "NCAAMB", "barttorvik");
      if (!teamId) {
        console.warn(
          `[barttorvik] No team ID found for "${teamName}", skipping snapshot`
        );
        errors++;
        continue;
      }

      await prisma.barttovikSnapshot.upsert({
        where: {
          teamId_date: { teamId, date: today },
        },
        create: {
          teamId,
          date: today,
          season: y,
          tRank: rating.tRank,
          tRankRating: rating.tRankRating,
          adjOE: rating.adjOE,
          adjDE: rating.adjDE,
          barthag: rating.barthag,
          adjTempo: rating.adjTempo,
          luck: rating.luck,
          sos: rating.sos,
          wins: rating.wins,
          losses: rating.losses,
        },
        update: {
          season: y,
          tRank: rating.tRank,
          tRankRating: rating.tRankRating,
          adjOE: rating.adjOE,
          adjDE: rating.adjDE,
          barthag: rating.barthag,
          adjTempo: rating.adjTempo,
          luck: rating.luck,
          sos: rating.sos,
          wins: rating.wins,
          losses: rating.losses,
        },
      });

      synced++;
    } catch (err) {
      console.error(
        `[barttorvik] Error syncing ${teamName}: ${err instanceof Error ? err.message : err}`
      );
      errors++;
    }
  }

  console.log(`[barttorvik] Sync complete: ${synced} synced, ${errors} errors`);
  return { synced, errors };
}

/**
 * Pick engine signal using Barttorvik T-Rank ratings.
 *
 * Computes a predicted spread from Barttorvik efficiency data and compares
 * it to the market spread to find edges. For O/U, sums adjusted offenses
 * and tempos to predict a total.
 *
 * Note: The 60/40 KenPom/Barttorvik blending happens at the weight level
 * in the pick engine — this signal uses only Barttorvik data.
 */
export async function signalBarttovikEnsemble(
  homeTeamName: string,
  awayTeamName: string,
  spread: number | null,
  overUnder: number | null
): Promise<SignalResult> {
  const neutral: SignalResult = {
    category: "barttorvik",
    direction: "neutral",
    magnitude: 0,
    confidence: 0,
    label: "No Barttorvik data",
    strength: "noise",
  };

  try {
    const ratings = await getBarttovikRatings();
    const home = lookupBarttovikRating(ratings, homeTeamName);
    const away = lookupBarttovikRating(ratings, awayTeamName);

    if (!home || !away) {
      const missing = !home ? homeTeamName : awayTeamName;
      return {
        ...neutral,
        label: `Barttorvik data missing for ${missing}`,
      };
    }

    // ─── Spread Signal ────────────────────────────────────────────────
    // predictedSpread = (homeAdjOE - homeAdjDE) - (awayAdjOE - awayAdjDE) + HCA
    // Negative spread = home favored (convention: spread is from home perspective)
    const homeEM = home.adjOE - home.adjDE;
    const awayEM = away.adjOE - away.adjDE;
    const predictedSpread = -(homeEM - awayEM + HCA_POINTS);

    if (spread !== null) {
      // Spread edge: how much the market disagrees with Barttorvik
      const spreadEdge = predictedSpread - spread;
      const absEdge = Math.abs(spreadEdge);

      // Determine direction: negative edge means home is undervalued
      const direction: "home" | "away" = spreadEdge < 0 ? "home" : "away";
      const magnitude = Math.min(10, absEdge / 2); // Scale: 2 pts edge = 1 mag
      const confidence = Math.min(1, absEdge / 15); // Scale: 15 pts = full confidence

      const strength = classifyStrength(magnitude);
      const favoredTeam = direction === "home" ? homeTeamName : awayTeamName;

      return {
        category: "barttorvik",
        direction,
        magnitude: Math.round(magnitude * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        label: `T-Rank ${strength} ${favoredTeam} (edge ${absEdge.toFixed(1)} pts)`,
        strength,
      };
    }

    // ─── O/U Signal ───────────────────────────────────────────────────
    if (overUnder !== null) {
      // Predicted total: average of (homeOE + awayOE) adjusted by tempo
      // Simple model: (homeAdjOE + awayAdjOE) * avgTempo / 100 * 2
      // Each team's possessions = tempo, and each team scores at their OE rate
      const avgTempo = (home.adjTempo + away.adjTempo) / 2;
      // Expected total = (homeAdjOE/100 + awayAdjOE/100) * avgTempo
      // But we also need to account for defenses:
      // homePoints ~ (homeAdjOE + awayAdjDE) / 2 / 100 * avgTempo
      // awayPoints ~ (awayAdjOE + homeAdjDE) / 2 / 100 * avgTempo
      const homeExpected = ((home.adjOE + away.adjDE) / 2 / 100) * avgTempo;
      const awayExpected = ((away.adjOE + home.adjDE) / 2 / 100) * avgTempo;
      const predictedTotal = homeExpected + awayExpected;

      const ouEdge = predictedTotal - overUnder;
      const absOUEdge = Math.abs(ouEdge);

      const ouDirection: "over" | "under" = ouEdge > 0 ? "over" : "under";
      const magnitude = Math.min(10, absOUEdge / 2);
      const confidence = Math.min(1, absOUEdge / 15);
      const strength = classifyStrength(magnitude);

      return {
        category: "barttorvik",
        direction: ouDirection,
        magnitude: Math.round(magnitude * 10) / 10,
        confidence: Math.round(confidence * 100) / 100,
        label: `T-Rank ${strength} ${ouDirection.toUpperCase()} (pred ${predictedTotal.toFixed(1)}, edge ${absOUEdge.toFixed(1)})`,
        strength,
      };
    }

    // No market line available — return efficiency comparison
    return {
      category: "barttorvik",
      direction: homeEM > awayEM ? "home" : "away",
      magnitude: Math.min(10, Math.abs(homeEM - awayEM) / 3),
      confidence: 0.3,
      label: `T-Rank: ${homeTeamName} EM ${homeEM.toFixed(1)} vs ${awayTeamName} EM ${awayEM.toFixed(1)}`,
      strength: "weak",
    };
  } catch (err) {
    console.error(
      `[barttorvik] Signal error: ${err instanceof Error ? err.message : err}`
    );
    return neutral;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function classifyStrength(
  magnitude: number
): "strong" | "moderate" | "weak" | "noise" {
  if (magnitude >= 6) return "strong";
  if (magnitude >= 3) return "moderate";
  if (magnitude >= 1) return "weak";
  return "noise";
}
