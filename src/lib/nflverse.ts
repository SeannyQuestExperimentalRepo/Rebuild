import "server-only";

/**
 * nflverse NFL Team EPA stats module.
 *
 * Downloads pre-aggregated team stats CSVs from nflverse GitHub releases,
 * parses EPA and efficiency metrics, caches on disk weekly, and stores
 * per-team per-week data in the NFLTeamEPA table.
 *
 * Data source: https://github.com/nflverse/nflverse-data
 */

import { prisma } from "./db";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  statSync,
  unlinkSync,
  readdirSync,
} from "fs";

// ─── Constants ───────────────────────────────────────────────────────────────

const CACHE_DIR = "/tmp/nflverse";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const LOG_PREFIX = "[nflverse]";

/**
 * nflverse team stats CSV URL per season.
 * Primary: nflverse-data releases "player_stats" with team-level aggregation.
 * Fallback: raw githubusercontent team_stats endpoint.
 */
const TEAM_STATS_URLS = (season: number): string[] => [
  `https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_${season}.csv`,
];

// ─── NFL Abbreviation Mapping ────────────────────────────────────────────────

const NFL_ABBREV_TO_NAME: Record<string, string> = {
  ARI: "Arizona Cardinals",
  ATL: "Atlanta Falcons",
  BAL: "Baltimore Ravens",
  BUF: "Buffalo Bills",
  CAR: "Carolina Panthers",
  CHI: "Chicago Bears",
  CIN: "Cincinnati Bengals",
  CLE: "Cleveland Browns",
  DAL: "Dallas Cowboys",
  DEN: "Denver Broncos",
  DET: "Detroit Lions",
  GB: "Green Bay Packers",
  HOU: "Houston Texans",
  IND: "Indianapolis Colts",
  JAX: "Jacksonville Jaguars",
  KC: "Kansas City Chiefs",
  LAC: "Los Angeles Chargers",
  LAR: "Los Angeles Rams",
  LV: "Las Vegas Raiders",
  MIA: "Miami Dolphins",
  MIN: "Minnesota Vikings",
  NE: "New England Patriots",
  NO: "New Orleans Saints",
  NYG: "New York Giants",
  NYJ: "New York Jets",
  PHI: "Philadelphia Eagles",
  PIT: "Pittsburgh Steelers",
  SEA: "Seattle Seahawks",
  SF: "San Francisco 49ers",
  TB: "Tampa Bay Buccaneers",
  TEN: "Tennessee Titans",
  WAS: "Washington Commanders",
};

/** Reverse mapping: full name -> abbreviation */
const NFL_NAME_TO_ABBREV: Record<string, string> = Object.fromEntries(
  Object.entries(NFL_ABBREV_TO_NAME).map(([abbrev, name]) => [name, abbrev])
);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TeamEPAData {
  team: string; // abbreviation (KC, BUF, etc.)
  season: number;
  week: number;
  offEpaPerPlay: number | null;
  defEpaPerPlay: number | null;
  passEpa: number | null;
  rushEpa: number | null;
  successRate: number | null;
  cpoe: number | null;
  redZoneTdPct: number | null;
  thirdDownPct: number | null;
  explosivePlayRate: number | null;
  turnoverMargin: number | null;
}

export interface SignalResult {
  category: string;
  direction: "home" | "away" | "over" | "under" | "neutral";
  magnitude: number; // 0-10
  confidence: number; // 0-1
  label: string;
  strength: "strong" | "moderate" | "weak" | "noise";
}

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into an array of objects keyed by header names.
 * Handles quoted fields (including commas inside quotes) and CRLF/LF line endings.
 */
function parseCSV(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const results: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    results.push(row);
  }

  return results;
}

/**
 * Parse a single CSV line, respecting quoted fields.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        // Check for escaped quote ("")
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip next quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }

  fields.push(current.trim());
  return fields;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function safeFloat(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA" || val === "NaN") return null;
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function safeInt(val: string | undefined): number | null {
  if (!val || val === "" || val === "NA" || val === "NaN") return null;
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function getCurrentNFLSeason(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // NFL season: Sept through Feb. If Jan/Feb, it's the previous year's season.
  return month <= 2 ? year - 1 : year;
}

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
    console.log(`${LOG_PREFIX} Created cache directory: ${CACHE_DIR}`);
  }
}

function getCachePath(season: number): string {
  return `${CACHE_DIR}/player_stats_${season}.csv`;
}

function isCacheFresh(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false;
    const stats = statSync(filePath);
    const age = Date.now() - stats.mtimeMs;
    return age < CACHE_TTL_MS;
  } catch {
    return false;
  }
}

// ─── Data Download ───────────────────────────────────────────────────────────

/**
 * Download player stats CSV for a given season.
 * Tries each URL in sequence until one succeeds.
 */
async function downloadCSV(season: number): Promise<string> {
  const urls = TEAM_STATS_URLS(season);

  for (const url of urls) {
    try {
      console.log(`${LOG_PREFIX} Downloading: ${url}`);
      const res = await fetch(url, {
        headers: { Accept: "text/csv,application/octet-stream,*/*" },
      });

      if (!res.ok) {
        console.log(
          `${LOG_PREFIX} HTTP ${res.status} from ${url}, trying next...`
        );
        continue;
      }

      const text = await res.text();
      if (text.length < 100) {
        console.log(
          `${LOG_PREFIX} Response too short (${text.length} chars), trying next...`
        );
        continue;
      }

      console.log(
        `${LOG_PREFIX} Downloaded ${text.length} bytes for season ${season}`
      );
      return text;
    } catch (err) {
      console.log(
        `${LOG_PREFIX} Failed to fetch ${url}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error(
    `${LOG_PREFIX} All download URLs failed for season ${season}`
  );
}

/**
 * Get CSV content for a season, using disk cache with weekly refresh.
 */
async function getCSVContent(season: number): Promise<string> {
  ensureCacheDir();
  const cachePath = getCachePath(season);

  if (isCacheFresh(cachePath)) {
    console.log(`${LOG_PREFIX} Using cached CSV for season ${season}`);
    return readFileSync(cachePath, "utf-8");
  }

  const content = await downloadCSV(season);
  writeFileSync(cachePath, content, "utf-8");
  console.log(`${LOG_PREFIX} Cached CSV to ${cachePath}`);
  return content;
}

// ─── Data Aggregation ────────────────────────────────────────────────────────

/**
 * Aggregate player-level stats into team-level EPA data per week.
 *
 * The nflverse player_stats CSV has one row per player per week. We group
 * by (recent_team, season, week) and sum EPA columns, then compute per-play rates.
 */
function aggregateTeamStats(
  rows: Record<string, string>[]
): Map<string, TeamEPAData> {
  // Group rows by team+season+week
  const buckets = new Map<
    string,
    {
      team: string;
      season: number;
      week: number;
      passingEpa: number;
      rushingEpa: number;
      passingAttempts: number;
      rushingAttempts: number;
      completions: number;
      passingYards: number;
      carries: number;
      rushingYards: number;
      interceptions: number;
      fumbles: number;
      passingTds: number;
      rushingTds: number;
      passingFirstDowns: number;
      rushingFirstDowns: number;
      dakota: number | null; // CPOE (completion probability over expected)
      dakotaCount: number;
      passingAirYards: number;
      passingYardsAfterCatch: number;
      receiving20Plus: number;
      rushing20Plus: number;
      totalPlays: number;
      thirdDownAtt: number;
      thirdDownConv: number;
      redZoneAtt: number;
      redZoneTd: number;
    }
  >();

  for (const row of rows) {
    const team = row["recent_team"] || row["team"];
    const season = safeInt(row["season"]);
    const week = safeInt(row["week"]);

    if (!team || !season || !week) continue;
    // Skip non-regular season types if present (postseason may be "POST")
    const seasonType = row["season_type"] || "";
    if (seasonType && seasonType !== "REG" && seasonType !== "POST") continue;

    const key = `${team}_${season}_${week}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        team,
        season,
        week,
        passingEpa: 0,
        rushingEpa: 0,
        passingAttempts: 0,
        rushingAttempts: 0,
        completions: 0,
        passingYards: 0,
        carries: 0,
        rushingYards: 0,
        interceptions: 0,
        fumbles: 0,
        passingTds: 0,
        rushingTds: 0,
        passingFirstDowns: 0,
        rushingFirstDowns: 0,
        dakota: null,
        dakotaCount: 0,
        passingAirYards: 0,
        passingYardsAfterCatch: 0,
        receiving20Plus: 0,
        rushing20Plus: 0,
        totalPlays: 0,
        thirdDownAtt: 0,
        thirdDownConv: 0,
        redZoneAtt: 0,
        redZoneTd: 0,
      });
    }

    const b = buckets.get(key)!;

    // Sum EPA columns
    const passEpa = safeFloat(row["passing_epa"]);
    const rushEpa = safeFloat(row["rushing_epa"]);
    const attempts = safeInt(row["attempts"]) ?? 0;
    const carries = safeInt(row["carries"]) ?? 0;
    const completionsVal = safeInt(row["completions"]) ?? 0;
    const passYards = safeFloat(row["passing_yards"]) ?? 0;
    const rushYards = safeFloat(row["rushing_yards"]) ?? 0;
    const ints = safeInt(row["interceptions"]) ?? 0;
    const fumbles = safeInt(row["sack_fumbles_lost"]) ?? 0;
    const passTds = safeInt(row["passing_tds"]) ?? 0;
    const rushTds = safeInt(row["rushing_tds"]) ?? 0;
    const passFirstDowns = safeInt(row["passing_first_downs"]) ?? 0;
    const rushFirstDowns = safeInt(row["rushing_first_downs"]) ?? 0;
    const dakotaVal = safeFloat(row["dakota"]);
    const airYards = safeFloat(row["passing_air_yards"]) ?? 0;
    const yac = safeFloat(row["passing_yards_after_catch"]) ?? 0;

    if (passEpa !== null) b.passingEpa += passEpa;
    if (rushEpa !== null) b.rushingEpa += rushEpa;
    b.passingAttempts += attempts;
    b.rushingAttempts += carries;
    b.completions += completionsVal;
    b.passingYards += passYards;
    b.carries += carries;
    b.rushingYards += rushYards;
    b.interceptions += ints;
    b.fumbles += fumbles;
    b.passingTds += passTds;
    b.rushingTds += rushTds;
    b.passingFirstDowns += passFirstDowns;
    b.rushingFirstDowns += rushFirstDowns;
    b.passingAirYards += airYards;
    b.passingYardsAfterCatch += yac;
    b.totalPlays += attempts + carries;

    if (dakotaVal !== null) {
      b.dakota = (b.dakota ?? 0) + dakotaVal;
      b.dakotaCount++;
    }
  }

  // Convert aggregated buckets to TeamEPAData
  const result = new Map<string, TeamEPAData>();

  for (const [key, b] of Array.from(buckets.entries())) {
    const totalPlays = b.passingAttempts + b.rushingAttempts;
    const offEpaPerPlay =
      totalPlays > 0 ? (b.passingEpa + b.rushingEpa) / totalPlays : null;

    // Success rate: approximate as (first downs + TDs) / total plays
    const successPlays =
      b.passingFirstDowns + b.rushingFirstDowns + b.passingTds + b.rushingTds;
    const successRate = totalPlays > 0 ? successPlays / totalPlays : null;

    // CPOE: average dakota across players with valid values
    const cpoe = b.dakotaCount > 0 ? b.dakota! / b.dakotaCount : null;

    // Explosive play rate: approximate from 20+ yard plays if available
    // (nflverse player stats don't directly have this, so we estimate from air yards)
    const explosivePlayRate = null; // Will be null unless we get play-by-play

    // Turnover margin: we only have offensive turnovers here; defensive turnovers need opponent data
    const turnoverMargin = null;

    const data: TeamEPAData = {
      team: b.team,
      season: b.season,
      week: b.week,
      offEpaPerPlay,
      defEpaPerPlay: null, // Requires opponent aggregation (see buildDefensiveEpa)
      passEpa: b.passingAttempts > 0 ? b.passingEpa / b.passingAttempts : null,
      rushEpa: b.rushingAttempts > 0 ? b.rushingEpa / b.rushingAttempts : null,
      successRate,
      cpoe,
      redZoneTdPct: null, // Not available in player-level stats
      thirdDownPct: null, // Not available in player-level stats
      explosivePlayRate,
      turnoverMargin,
    };

    result.set(key, data);
  }

  // ── Build defensive EPA from opponent data ──
  // For each team-week, find the opposing team's offensive EPA against them.
  // This requires knowing matchups, which player_stats doesn't directly provide.
  // Instead, we use a league-relative approach: each team's defensive EPA is
  // approximated by looking at the average offensive EPA allowed across the season.
  // For now, leave defEpaPerPlay as null — it will be populated if/when we
  // add opponent-level tracking or use play-by-play data.

  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Download and parse nflverse player stats CSV for a season.
 * Returns a Map<string, TeamEPAData> keyed by "TEAM_SEASON_WEEK" (e.g. "KC_2025_1").
 *
 * Results are cached on disk for one week.
 */
export async function getNFLTeamEPA(
  season?: number
): Promise<Map<string, TeamEPAData>> {
  const s = season ?? getCurrentNFLSeason();
  console.log(`${LOG_PREFIX} Fetching team EPA data for season ${s}`);

  const csv = await getCSVContent(s);
  const rows = parseCSV(csv);
  console.log(`${LOG_PREFIX} Parsed ${rows.length} player-stat rows`);

  const teamData = aggregateTeamStats(rows);
  console.log(`${LOG_PREFIX} Aggregated ${teamData.size} team-week entries`);

  return teamData;
}

/**
 * Fetch CSV and upsert all rows into NFLTeamEPA table.
 * Resolves team abbreviations to Team IDs via the Team table.
 * Returns { synced: number, errors: number }.
 */
export async function syncNFLTeamEPA(
  season?: number
): Promise<{ synced: number; errors: number }> {
  const s = season ?? getCurrentNFLSeason();
  console.log(`${LOG_PREFIX} Starting sync for season ${s}`);

  const teamData = await getNFLTeamEPA(s);

  // Resolve team abbreviations to DB Team IDs
  const nflTeams = await prisma.team.findMany({
    where: { sport: "NFL" },
    select: { id: true, name: true, abbreviation: true },
  });

  const abbrevToId = new Map<string, number>();
  for (const t of nflTeams) {
    abbrevToId.set(t.abbreviation, t.id);
    // Also map by full name lookup
    const abbrev = NFL_NAME_TO_ABBREV[t.name];
    if (abbrev) abbrevToId.set(abbrev, t.id);
  }

  let synced = 0;
  let errors = 0;

  // Batch upserts for performance
  const upsertPromises: Promise<void>[] = [];

  for (const [, data] of Array.from(teamData.entries())) {
    const teamId = abbrevToId.get(data.team);
    if (!teamId) {
      const fullName = NFL_ABBREV_TO_NAME[data.team];
      if (fullName) {
        // Try looking up by full name
        const found = nflTeams.find(
          (t) => t.name.toLowerCase() === fullName.toLowerCase()
        );
        if (found) {
          abbrevToId.set(data.team, found.id);
        } else {
          console.log(
            `${LOG_PREFIX} Unknown team abbreviation: ${data.team} (${fullName})`
          );
          errors++;
          continue;
        }
      } else {
        console.log(
          `${LOG_PREFIX} No mapping for team abbreviation: ${data.team}`
        );
        errors++;
        continue;
      }
    }

    const resolvedTeamId = abbrevToId.get(data.team)!;

    upsertPromises.push(
      prisma.nFLTeamEPA
        .upsert({
          where: {
            teamId_season_week: {
              teamId: resolvedTeamId,
              season: data.season,
              week: data.week,
            },
          },
          update: {
            offEpaPerPlay: data.offEpaPerPlay,
            defEpaPerPlay: data.defEpaPerPlay,
            passEpa: data.passEpa,
            rushEpa: data.rushEpa,
            successRate: data.successRate,
            cpoe: data.cpoe,
            redZoneTdPct: data.redZoneTdPct,
            thirdDownPct: data.thirdDownPct,
            explosivePlayRate: data.explosivePlayRate,
            turnoverMargin: data.turnoverMargin,
          },
          create: {
            teamId: resolvedTeamId,
            season: data.season,
            week: data.week,
            offEpaPerPlay: data.offEpaPerPlay,
            defEpaPerPlay: data.defEpaPerPlay,
            passEpa: data.passEpa,
            rushEpa: data.rushEpa,
            successRate: data.successRate,
            cpoe: data.cpoe,
            redZoneTdPct: data.redZoneTdPct,
            thirdDownPct: data.thirdDownPct,
            explosivePlayRate: data.explosivePlayRate,
            turnoverMargin: data.turnoverMargin,
          },
        })
        .then(() => {
          synced++;
        })
        .catch((err) => {
          console.log(
            `${LOG_PREFIX} Upsert error for ${data.team} week ${data.week}: ${err instanceof Error ? err.message : String(err)}`
          );
          errors++;
        })
    );

    // Batch in groups of 50 to avoid overwhelming the DB
    if (upsertPromises.length >= 50) {
      await Promise.all(upsertPromises);
      upsertPromises.length = 0;
    }
  }

  // Flush remaining
  if (upsertPromises.length > 0) {
    await Promise.all(upsertPromises);
  }

  console.log(
    `${LOG_PREFIX} Sync complete: ${synced} upserted, ${errors} errors`
  );
  return { synced, errors };
}

/**
 * Pick engine signal based on NFL EPA data.
 *
 * For spread: compares composite EPA (offEPA - defEPA). Higher composite = better team.
 *   Applies home-field advantage of ~2.5 points.
 * For O/U: high combined offensive EPA -> over lean; high combined defensive EPA -> under lean.
 *
 * Uses the most recent week's stats from the NFLTeamEPA table.
 */
export async function signalNFLEPA(
  homeTeamName: string,
  awayTeamName: string,
  spread: number | null,
  overUnder: number | null
): Promise<{ spread: SignalResult; ou: SignalResult }> {
  const neutral: SignalResult = {
    category: "nflEpa",
    direction: "neutral",
    magnitude: 0,
    confidence: 0,
    label: "No NFL EPA data available",
    strength: "noise",
  };

  // Resolve team names to abbreviations
  const homeAbbrev = NFL_NAME_TO_ABBREV[homeTeamName];
  const awayAbbrev = NFL_NAME_TO_ABBREV[awayTeamName];

  if (!homeAbbrev || !awayAbbrev) {
    console.log(
      `${LOG_PREFIX} Could not resolve team names: home="${homeTeamName}" away="${awayTeamName}"`
    );
    return { spread: neutral, ou: { ...neutral } };
  }

  // Fetch most recent EPA data for both teams
  const season = getCurrentNFLSeason();

  const [homeStats, awayStats] = await Promise.all([
    getLatestTeamEPA(homeAbbrev, season),
    getLatestTeamEPA(awayAbbrev, season),
  ]);

  if (!homeStats || !awayStats) {
    console.log(
      `${LOG_PREFIX} Missing EPA data: home=${homeAbbrev}(${!!homeStats}) away=${awayAbbrev}(${!!awayStats})`
    );
    return { spread: neutral, ou: { ...neutral } };
  }

  // ── Composite EPA: offense EPA - defense EPA (higher = better) ──
  const homeOffEpa = homeStats.offEpaPerPlay ?? 0;
  const awayOffEpa = awayStats.offEpaPerPlay ?? 0;
  const homeDefEpa = homeStats.defEpaPerPlay ?? 0; // Lower (more negative) = better defense
  const awayDefEpa = awayStats.defEpaPerPlay ?? 0;

  const homeComposite = homeOffEpa - homeDefEpa;
  const awayComposite = awayOffEpa - awayDefEpa;

  // EPA difference scaled to approximate point spread.
  // EPA per play difference of ~0.10 roughly translates to ~3-4 points.
  const EPA_TO_POINTS = 35; // Scaling factor: EPA/play diff * factor ~ point diff
  const HFA = 2.5; // NFL home-field advantage in points

  // ── Spread Signal ──
  let spreadSignal: SignalResult = neutral;
  if (spread !== null) {
    const predictedMargin =
      (homeComposite - awayComposite) * EPA_TO_POINTS + HFA;
    const spreadEdge = predictedMargin + spread; // spread is negative for home fav

    const absMag = clamp(Math.abs(spreadEdge) / 1.5, 0, 10);
    const conf = 0.55; // EPA-based model: moderate confidence

    spreadSignal = {
      category: "nflEpa",
      direction: spreadEdge > 0 ? "home" : spreadEdge < 0 ? "away" : "neutral",
      magnitude: absMag,
      confidence: conf,
      label: `EPA composite: home ${homeComposite.toFixed(3)} vs away ${awayComposite.toFixed(3)}, predicted margin ${predictedMargin > 0 ? "+" : ""}${predictedMargin.toFixed(1)}`,
      strength:
        absMag >= 7
          ? "strong"
          : absMag >= 4
            ? "moderate"
            : absMag >= 2
              ? "weak"
              : "noise",
    };
  }

  // ── O/U Signal ──
  let ouSignal: SignalResult = { ...neutral };
  if (overUnder !== null) {
    // Combined offensive EPA suggests scoring environment
    const combinedOffEpa = homeOffEpa + awayOffEpa;
    // Combined defensive EPA (more negative = better combined defense = lower scoring)
    const combinedDefEpa = homeDefEpa + awayDefEpa;

    // Net scoring tendency: positive = higher scoring, negative = lower scoring
    const scoringTendency = combinedOffEpa - combinedDefEpa;

    // Scale: EPA/play scoring tendency of 0.05 suggests ~2-3 point total deviation
    const TOTAL_SCALE = 25;
    const totalEdge = scoringTendency * TOTAL_SCALE;

    const absMag = clamp(Math.abs(totalEdge) / 2.0, 0, 10);
    const direction: "over" | "under" | "neutral" =
      totalEdge > 0.5 ? "over" : totalEdge < -0.5 ? "under" : "neutral";

    ouSignal = {
      category: "nflEpa",
      direction,
      magnitude: absMag,
      confidence: 0.5,
      label: `Combined off EPA/play: ${combinedOffEpa.toFixed(3)}, def EPA/play: ${combinedDefEpa.toFixed(3)}, scoring tendency ${totalEdge > 0 ? "+" : ""}${totalEdge.toFixed(1)}`,
      strength:
        absMag >= 7
          ? "strong"
          : absMag >= 4
            ? "moderate"
            : absMag >= 2
              ? "weak"
              : "noise",
    };
  }

  return { spread: spreadSignal, ou: ouSignal };
}

/**
 * Get the most recent week's EPA data for a team from the DB.
 * Falls back to in-memory data if DB has no rows.
 */
async function getLatestTeamEPA(
  teamAbbrev: string,
  season: number
): Promise<TeamEPAData | null> {
  // Try DB first
  const fullName = NFL_ABBREV_TO_NAME[teamAbbrev];
  if (!fullName) return null;

  try {
    const dbRow = await prisma.nFLTeamEPA.findFirst({
      where: {
        team: { name: fullName, sport: "NFL" },
        season,
      },
      orderBy: { week: "desc" },
    });

    if (dbRow) {
      return {
        team: teamAbbrev,
        season: dbRow.season,
        week: dbRow.week,
        offEpaPerPlay: dbRow.offEpaPerPlay,
        defEpaPerPlay: dbRow.defEpaPerPlay,
        passEpa: dbRow.passEpa,
        rushEpa: dbRow.rushEpa,
        successRate: dbRow.successRate,
        cpoe: dbRow.cpoe,
        redZoneTdPct: dbRow.redZoneTdPct,
        thirdDownPct: dbRow.thirdDownPct,
        explosivePlayRate: dbRow.explosivePlayRate,
        turnoverMargin: dbRow.turnoverMargin,
      };
    }
  } catch (err) {
    console.log(
      `${LOG_PREFIX} DB lookup failed for ${teamAbbrev}: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Fallback: compute from CSV
  try {
    const teamData = await getNFLTeamEPA(season);

    // Find the most recent week for this team
    let latest: TeamEPAData | null = null;
    for (const [, data] of Array.from(teamData.entries())) {
      if (data.team === teamAbbrev && data.season === season) {
        if (!latest || data.week > latest.week) {
          latest = data;
        }
      }
    }
    return latest;
  } catch (err) {
    console.log(
      `${LOG_PREFIX} CSV fallback failed for ${teamAbbrev}: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

// ─── Cache Management ────────────────────────────────────────────────────────

/**
 * Delete all cached nflverse CSV files from disk.
 */
export function clearNFLCache(): void {
  if (!existsSync(CACHE_DIR)) {
    console.log(
      `${LOG_PREFIX} Cache directory does not exist, nothing to clear`
    );
    return;
  }

  try {
    const files = readdirSync(CACHE_DIR);
    let deleted = 0;

    for (const file of files) {
      if (file.endsWith(".csv")) {
        unlinkSync(`${CACHE_DIR}/${file}`);
        deleted++;
      }
    }

    console.log(
      `${LOG_PREFIX} Cleared ${deleted} cached file(s) from ${CACHE_DIR}`
    );
  } catch (err) {
    console.log(
      `${LOG_PREFIX} Error clearing cache: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
