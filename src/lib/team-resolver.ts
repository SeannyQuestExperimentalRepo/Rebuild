import "server-only";
import { prisma } from "./db";
import { TEAM_ALIASES } from "./team-aliases.generated";

// ─── Types ──────────────────────────────────────────────────────────────────

export type DataSource =
  | "espn"
  | "kenpom"
  | "cfbd"
  | "oddsapi"
  | "barttorvik"
  | "nbacom"
  | "nflverse"
  | "db"
  | "unknown";

// ─── In-Memory Caches ──────────────────────────────────────────────────────

// Per-sport canonical names from DB: name → id
const canonicalNames = new Map<string, Map<string, number>>();

// Per-sport: normalized(canonical) → original canonical name
const normalizedCanonical = new Map<string, Map<string, string>>();

// Per-sport alias maps from generated file: normalized key → canonical
const aliasLookup = new Map<string, Map<string, string>>();

// Resolved cache: "sport:normalizedInput" → canonical name
const resolvedCache = new Map<string, string>();

// Unresolved names log (for debugging/fixing)
const unresolvedLog = new Map<
  string,
  { source: DataSource; sport: string; count: number }
>();

let initialized = false;

// ─── Normalization ──────────────────────────────────────────────────────────

/**
 * Normalize a team name for comparison.
 * Must match the normalization used by the consolidation script.
 */
export function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'\u2019\u2018]/g, "") // Remove periods, apostrophes
    .replace(/[()]/g, " ") // Parentheses → space
    .replace(/-/g, " ") // Hyphens → space
    .replace(/&/g, "") // Remove ampersand (A&M → AM)
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Initialization ─────────────────────────────────────────────────────────

async function ensureInitialized(): Promise<void> {
  if (initialized) return;

  const teams = await prisma.team.findMany({
    where: { sport: { in: ["NFL", "NCAAF", "NCAAMB", "NBA"] } },
    select: { id: true, name: true, sport: true },
  });

  for (const team of teams) {
    if (!canonicalNames.has(team.sport))
      canonicalNames.set(team.sport, new Map());
    canonicalNames.get(team.sport)!.set(team.name, team.id);

    if (!normalizedCanonical.has(team.sport))
      normalizedCanonical.set(team.sport, new Map());
    normalizedCanonical.get(team.sport)!.set(normalize(team.name), team.name);
  }

  // Load alias table from generated file
  for (const [sport, aliases] of Object.entries(TEAM_ALIASES)) {
    const map = new Map<string, string>();
    for (const [key, canonical] of Object.entries(aliases)) {
      map.set(key, canonical);
    }
    aliasLookup.set(sport, map);
  }

  initialized = true;
  console.log(`[team-resolver] Loaded ${teams.length} canonical team names`);
}

// ─── Core Resolution ────────────────────────────────────────────────────────

/**
 * Try to resolve a normalized name against canonical names or aliases.
 * Returns the canonical name or null.
 */
function tryResolve(norm: string, sport: string): string | null {
  // Normalized canonical match first (handles case/punctuation differences)
  const fromCanonical = normalizedCanonical.get(sport)?.get(norm);
  if (fromCanonical) return fromCanonical;

  // Alias table lookup
  const fromAlias = aliasLookup.get(sport)?.get(norm);
  if (fromAlias) return fromAlias;

  return null;
}

/**
 * Resolve ANY team name from ANY source to the canonical DB name.
 *
 * This is the ONLY function that should be used for team name resolution
 * anywhere in the codebase.
 *
 * @param name - The team name as it appears in the source
 * @param sport - The sport (NFL, NCAAF, NCAAMB, NBA)
 * @param source - Where this name came from (for debugging)
 * @returns The canonical DB name, or the input name if unresolved
 */
export async function resolveTeamName(
  name: string,
  sport: string,
  source: DataSource = "unknown"
): Promise<string> {
  await ensureInitialized();

  const norm = normalize(name);
  const cacheKey = `${sport}:${norm}`;

  // 1. Check resolved cache
  const cached = resolvedCache.get(cacheKey);
  if (cached !== undefined) return cached;

  // 2. Exact match against DB canonical names
  const sportCanonical = canonicalNames.get(sport);
  if (sportCanonical?.has(name)) {
    resolvedCache.set(cacheKey, name);
    return name;
  }

  // 3. Normalized canonical match + alias table lookup
  const resolved = tryResolve(norm, sport);
  if (resolved) {
    resolvedCache.set(cacheKey, resolved);
    return resolved;
  }

  // 4. Fuzzy matching strategies
  const fuzzy = fuzzyMatch(norm, sport);
  if (fuzzy) {
    resolvedCache.set(cacheKey, fuzzy);
    return fuzzy;
  }

  // 5. Unresolved — log and return input name
  const logKey = `${source}:${sport}:${name}`;
  const existing = unresolvedLog.get(logKey);
  if (existing) {
    existing.count++;
  } else {
    unresolvedLog.set(logKey, { source, sport, count: 1 });
    console.warn(
      `[team-resolver] UNRESOLVED: "${name}" (sport=${sport}, source=${source})`
    );
  }

  resolvedCache.set(cacheKey, name); // Cache the miss to avoid repeated lookups
  return name;
}

// ─── Fuzzy Matching ─────────────────────────────────────────────────────────

function fuzzyMatch(norm: string, sport: string): string | null {
  const words = norm.split(" ");

  // Strategy 1: Strip last word (mascot) — "gonzaga bulldogs" → "gonzaga"
  if (words.length >= 2) {
    const noMascot = words.slice(0, -1).join(" ");
    const match = tryResolve(noMascot, sport);
    if (match) return match;
  }

  // Strategy 2: Strip last 2 words — "north carolina tar heels" → "north carolina"
  if (words.length >= 3) {
    const noMascot2 = words.slice(0, -2).join(" ");
    const match = tryResolve(noMascot2, sport);
    if (match) return match;
  }

  // Strategy 3: "state" ↔ "st" at end of string
  for (const v of [
    norm.replace(/ st$/, " state"),
    norm.replace(/ state$/, " st"),
  ]) {
    if (v !== norm) {
      const match = tryResolve(v, sport);
      if (match) return match;
    }
  }

  // Strategy 4: "saint" ↔ "st" at start of string
  for (const v of [
    norm.replace(/^saint /, "st "),
    norm.replace(/^st /, "saint "),
  ]) {
    if (v !== norm) {
      const match = tryResolve(v, sport);
      if (match) return match;
    }
  }

  // Strategy 5: Remove "university", "college", "of" noise words
  const cleaned = norm
    .replace(/\buniversity\b/g, "")
    .replace(/\bcollege\b/g, "")
    .replace(/\bof\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned !== norm) {
    const match = tryResolve(cleaned, sport);
    if (match) return match;
  }

  return null;
}

// ─── Batch + Utility Functions ──────────────────────────────────────────────

/**
 * Batch resolve — more efficient for resolving many names at once.
 */
export async function resolveTeamNames(
  names: string[],
  sport: string,
  source: DataSource = "unknown"
): Promise<Map<string, string>> {
  await ensureInitialized();
  const result = new Map<string, string>();
  for (const name of names) {
    result.set(name, await resolveTeamName(name, sport, source));
  }
  return result;
}

/**
 * Resolve a team name and return the DB team ID.
 * Returns null if the team is not found in the DB.
 */
export async function resolveTeamId(
  name: string,
  sport: string,
  source: DataSource = "unknown"
): Promise<number | null> {
  const canonical = await resolveTeamName(name, sport, source);
  const sportCanonical = canonicalNames.get(sport);
  return sportCanonical?.get(canonical) ?? null;
}

/**
 * Get all unresolved team names (for debugging and the admin endpoint).
 */
export function getUnresolvedNames(): Map<
  string,
  { source: DataSource; sport: string; count: number }
> {
  return new Map(unresolvedLog);
}

/**
 * Clear all caches (useful for testing or after DB changes).
 */
export function clearTeamResolverCache(): void {
  resolvedCache.clear();
  canonicalNames.clear();
  normalizedCanonical.clear();
  aliasLookup.clear();
  unresolvedLog.clear();
  initialized = false;
}
