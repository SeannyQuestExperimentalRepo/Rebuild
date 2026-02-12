import "server-only";

/**
 * CollegeFootballData.com API client with in-memory caching.
 *
 * Fetches SP+ team efficiency ratings for NCAAF games.
 * Pattern mirrors kenpom.ts for consistency.
 *
 * API docs: https://api.collegefootballdata.com/
 * Free tier: 1,000 calls/month
 */

const CFBD_BASE = "https://api.collegefootballdata.com";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CFBDRating {
  team: string;
  conference: string;
  year: number;
  rating: number; // spOverall
  ranking: number;
  offense: { rating: number; ranking: number };
  defense: { rating: number; ranking: number };
  specialTeams: { rating: number } | null;
}

// ─── Cache ──────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const RATINGS_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const ratingsCacheBySeason = new Map<number, CacheEntry<Map<string, CFBDRating>>>();

export function clearCFBDCache(): void {
  ratingsCacheBySeason.clear();
}

// ─── API Helpers ────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.CFBD_API_KEY;
  if (!key) throw new Error("CFBD_API_KEY not configured");
  return key;
}

async function fetchCFBD<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(path, CFBD_BASE);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`CFBD API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Fetch all SP+ team ratings for the given season.
 * Returns a Map keyed by team name (e.g. "Alabama").
 * Cached for 6 hours.
 */
export async function getCFBDRatings(
  season?: number,
): Promise<Map<string, CFBDRating>> {
  const y = season ?? getCurrentCFBDSeason();
  const now = Date.now();

  const cached = ratingsCacheBySeason.get(y);
  if (cached && now - cached.fetchedAt < RATINGS_TTL_MS) {
    return cached.data;
  }

  const raw = await fetchCFBD<CFBDRating[]>("/ratings/sp", {
    year: String(y),
  });

  const map = new Map<string, CFBDRating>();
  for (const team of raw) {
    map.set(team.team, team);
  }

  ratingsCacheBySeason.set(y, { data: map, fetchedAt: now });
  console.log(`[cfbd] Fetched ${map.size} SP+ ratings for ${y}`);
  return map;
}

/**
 * Look up a team's SP+ rating by name. Handles fuzzy matching between
 * ESPN/DB canonical names and CFBD naming conventions.
 */
export function lookupCFBDRating(
  ratings: Map<string, CFBDRating>,
  teamName: string,
): CFBDRating | undefined {
  // Direct match
  const direct = ratings.get(teamName);
  if (direct) return direct;

  // Try common transformations
  const normalized = normalizeToCFBD(teamName);
  if (normalized !== teamName) {
    const match = ratings.get(normalized);
    if (match) return match;
  }

  // Fallback: case-insensitive match
  const lower = teamName.toLowerCase();
  for (const entry of Array.from(ratings.entries())) {
    if (entry[0].toLowerCase() === lower) return entry[1];
  }

  return undefined;
}

// ─── Name Normalization ─────────────────────────────────────────────────────

/**
 * Map ESPN/DB canonical names → CFBD names.
 * CFBD generally uses full school names.
 */
const ESPN_TO_CFBD: Record<string, string> = {
  "UConn": "Connecticut",
  "UCONN": "Connecticut",
  "Pitt": "Pittsburgh",
  "PITT": "Pittsburgh",
  "Ole Miss": "Mississippi",
  "UCF": "UCF",
  "USC": "USC",
  "UNC": "North Carolina",
  "LSU": "LSU",
  "SMU": "SMU",
  "UNLV": "UNLV",
  "UTEP": "UTEP",
  "UTSA": "UTSA",
  "NIU": "Northern Illinois",
  "Miami (FL)": "Miami",
  "Miami (OH)": "Miami (OH)",
  "Hawai'i": "Hawai'i",
  "Hawaii": "Hawai'i",
  "App State": "Appalachian State",
  "UMass": "Massachusetts",
  "FIU": "FIU",
  "FAU": "Florida Atlantic",
  "UAB": "UAB",
  "ECU": "East Carolina",
  "WKU": "Western Kentucky",
  "MTSU": "Middle Tennessee",
  "BGSU": "Bowling Green",
};

function normalizeToCFBD(espnName: string): string {
  if (ESPN_TO_CFBD[espnName]) return ESPN_TO_CFBD[espnName];
  return espnName;
}

// ─── Season Helper ──────────────────────────────────────────────────────────

function getCurrentCFBDSeason(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  // NCAAF season = calendar year (Aug 2025 → 2025 season)
  // After January, previous year's season is most relevant until August
  return month >= 7 ? year : year - 1;
}
