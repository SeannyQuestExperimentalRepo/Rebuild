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
const ratingsCacheBySeason = new Map<
  number,
  CacheEntry<Map<string, CFBDRating>>
>();

export function clearCFBDCache(): void {
  ratingsCacheBySeason.clear();
}

// ─── API Helpers ────────────────────────────────────────────────────────────

function getApiKey(): string {
  const key = process.env.CFBD_API_KEY;
  if (!key) throw new Error("CFBD_API_KEY not configured");
  return key;
}

async function fetchCFBD<T>(
  path: string,
  params: Record<string, string> = {}
): Promise<T> {
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
  season?: number
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
  teamName: string
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

  // Log unmatched name for incremental improvement of mappings
  console.warn(
    `[cfbd] Unmatched team name: "${teamName}" (normalized: "${normalized}")`
  );
  return undefined;
}

// ─── Name Normalization ─────────────────────────────────────────────────────

/**
 * Map ESPN/DB canonical names → CFBD names.
 * CFBD generally uses full school names.
 */
const ESPN_TO_CFBD: Record<string, string> = {
  UConn: "Connecticut",
  UCONN: "Connecticut",
  Pitt: "Pittsburgh",
  PITT: "Pittsburgh",
  "Ole Miss": "Mississippi",
  UCF: "UCF",
  USC: "USC",
  UNC: "North Carolina",
  LSU: "LSU",
  SMU: "SMU",
  UNLV: "UNLV",
  UTEP: "UTEP",
  UTSA: "UTSA",
  NIU: "Northern Illinois",
  "Miami (FL)": "Miami",
  "Miami (OH)": "Miami (OH)",
  "Hawai'i": "Hawai'i",
  Hawaii: "Hawai'i",
  "App State": "Appalachian State",
  UMass: "Massachusetts",
  FIU: "FIU",
  FAU: "Florida Atlantic",
  UAB: "UAB",
  ECU: "East Carolina",
  WKU: "Western Kentucky",
  MTSU: "Middle Tennessee",
  BGSU: "Bowling Green",
  // Additional ESPN→CFBD mappings
  "N.C. State": "NC State",
  "NC State": "NC State",
  BYU: "BYU",
  TCU: "TCU",
  USF: "South Florida",
  "South Florida": "South Florida",
  "North Texas": "North Texas",
  Louisiana: "Louisiana",
  "Louisiana-Lafayette": "Louisiana",
  "Louisiana-Monroe": "Louisiana Monroe",
  "Middle Tennessee": "Middle Tennessee",
  ETSU: "East Tennessee",
  "Central Michigan": "Central Michigan",
  "Eastern Michigan": "Eastern Michigan",
  "Western Michigan": "Western Michigan",
  "Southern Miss": "Southern Mississippi",
  "Southern Mississippi": "Southern Mississippi",
  "Sam Houston": "Sam Houston State",
  "Sam Houston State": "Sam Houston State",
  "Jacksonville State": "Jacksonville State",
  "Kennesaw State": "Kennesaw State",
};

function normalizeToCFBD(espnName: string): string {
  if (ESPN_TO_CFBD[espnName]) return ESPN_TO_CFBD[espnName];
  return espnName;
}

// ─── Advanced Stats API Endpoints ──────────────────────────────────────────

interface CFBDEloEntry {
  team: string;
  conference: string;
  year: number;
  elo: number;
}

interface CFBDTalentEntry {
  year: number;
  school: string;
  talent: number;
}

interface CFBDPPAEntry {
  team: string;
  conference: string;
  season: number;
  offense: { overall: number; passing: number; rushing: number };
  defense: { overall: number; passing: number; rushing: number };
}

interface CFBDSRSEntry {
  team: string;
  conference: string;
  year: number;
  rating: number;
  ranking: number;
}

/**
 * Fetch Elo ratings from CFBD for a season.
 */
export async function getCFBDElo(season?: number): Promise<CFBDEloEntry[]> {
  const y = season ?? getCurrentCFBDSeason();
  return fetchCFBD<CFBDEloEntry[]>("/ratings/elo", { year: String(y) });
}

/**
 * Fetch 247Sports recruiting talent composite for a season.
 */
export async function getCFBDTalent(
  season?: number
): Promise<CFBDTalentEntry[]> {
  const y = season ?? getCurrentCFBDSeason();
  return fetchCFBD<CFBDTalentEntry[]>("/talent", { year: String(y) });
}

/**
 * Fetch Predicted Points Added (PPA) team stats for a season.
 */
export async function getCFBDPPA(season?: number): Promise<CFBDPPAEntry[]> {
  const y = season ?? getCurrentCFBDSeason();
  return fetchCFBD<CFBDPPAEntry[]>("/ppa/teams", { year: String(y) });
}

/**
 * Fetch Simple Rating System (SRS) for a season.
 */
export async function getCFBDSRS(season?: number): Promise<CFBDSRSEntry[]> {
  const y = season ?? getCurrentCFBDSeason();
  return fetchCFBD<CFBDSRSEntry[]>("/ratings/srs", { year: String(y) });
}

/**
 * Fetch and merge all CFBD advanced stats into a single map keyed by team name.
 */
export async function getCFBDAdvancedStats(season?: number): Promise<
  Map<
    string,
    {
      spOverall: number | null;
      spOffense: number | null;
      spDefense: number | null;
      elo: number | null;
      srs: number | null;
      talentComposite: number | null;
      ppaOverall: number | null;
      ppaPass: number | null;
      ppaRush: number | null;
      ppaDef: number | null;
    }
  >
> {
  const y = season ?? getCurrentCFBDSeason();

  // Fetch all endpoints in parallel
  const [spRatings, eloData, talentData, ppaData, srsData] = await Promise.all([
    getCFBDRatings(y).catch(() => new Map<string, CFBDRating>()),
    getCFBDElo(y).catch(() => [] as CFBDEloEntry[]),
    getCFBDTalent(y).catch(() => [] as CFBDTalentEntry[]),
    getCFBDPPA(y).catch(() => [] as CFBDPPAEntry[]),
    getCFBDSRS(y).catch(() => [] as CFBDSRSEntry[]),
  ]);

  // Build lookup maps
  const eloMap = new Map(eloData.map((e) => [e.team, e.elo]));
  const talentMap = new Map(talentData.map((t) => [t.school, t.talent]));
  const ppaMap = new Map(ppaData.map((p) => [p.team, p]));
  const srsMap = new Map(srsData.map((s) => [s.team, s.rating]));

  // Merge all sources
  const allTeams = new Set([
    ...Array.from(spRatings.keys()),
    ...Array.from(eloMap.keys()),
    ...Array.from(talentMap.keys()),
    ...Array.from(ppaMap.keys()),
    ...Array.from(srsMap.keys()),
  ]);

  const result = new Map<
    string,
    {
      spOverall: number | null;
      spOffense: number | null;
      spDefense: number | null;
      elo: number | null;
      srs: number | null;
      talentComposite: number | null;
      ppaOverall: number | null;
      ppaPass: number | null;
      ppaRush: number | null;
      ppaDef: number | null;
    }
  >();

  for (const team of Array.from(allTeams)) {
    const sp = spRatings.get(team);
    const ppa = ppaMap.get(team);
    result.set(team, {
      spOverall: sp?.rating ?? null,
      spOffense: sp?.offense.rating ?? null,
      spDefense: sp?.defense.rating ?? null,
      elo: eloMap.get(team) ?? null,
      srs: srsMap.get(team) ?? null,
      talentComposite: talentMap.get(team) ?? null,
      ppaOverall: ppa?.offense.overall ?? null,
      ppaPass: ppa?.offense.passing ?? null,
      ppaRush: ppa?.offense.rushing ?? null,
      ppaDef: ppa?.defense.overall ?? null,
    });
  }

  console.log(
    `[cfbd] Merged advanced stats for ${result.size} teams (season ${y})`
  );
  return result;
}

/**
 * Sync all CFBD advanced stats into the NCAAFAdvancedStats table.
 * Resolves CFBD team names to DB Team IDs using name matching.
 */
export async function syncCFBDAdvancedStats(
  season?: number
): Promise<{ synced: number; errors: number }> {
  const { prisma } = await import("./db");
  const y = season ?? getCurrentCFBDSeason();

  const stats = await getCFBDAdvancedStats(y);

  // Build team ID lookup
  const teams = await prisma.team.findMany({ where: { sport: "NCAAF" } });
  const teamMap = new Map<string, number>();
  for (const t of teams) {
    teamMap.set(t.name.toLowerCase(), t.id);
  }

  let synced = 0;
  let errors = 0;

  for (const [cfbdName, data] of Array.from(stats)) {
    // Try to resolve CFBD name to DB team
    const normalized = normalizeToCFBD(cfbdName);
    let teamId =
      teamMap.get(cfbdName.toLowerCase()) ??
      teamMap.get(normalized.toLowerCase());

    // Try reverse lookup from CFBD→ESPN mapping
    if (!teamId) {
      for (const [espn, cfbd] of Object.entries(ESPN_TO_CFBD)) {
        if (cfbd === cfbdName || cfbd === normalized) {
          teamId = teamMap.get(espn.toLowerCase());
          if (teamId) break;
        }
      }
    }

    if (!teamId) {
      errors++;
      continue;
    }

    try {
      await prisma.nCAAFAdvancedStats.upsert({
        where: { teamId_season: { teamId, season: y } },
        update: { ...data },
        create: { teamId, season: y, ...data },
      });
      synced++;
    } catch {
      errors++;
    }
  }

  console.log(
    `[cfbd] Synced ${synced} advanced stats, ${errors} errors (season ${y})`
  );
  return { synced, errors };
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
