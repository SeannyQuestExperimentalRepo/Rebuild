/**
 * Import JSON game data into Neon PostgreSQL via Prisma.
 *
 * Usage:
 *   npx tsx scripts/import-to-postgres.ts
 *
 * Steps:
 *   1. Reads all 3 JSON data files
 *   2. Extracts unique team names → inserts into Team table
 *   3. Batch-inserts NFL, NCAAF, NCAAMB games with FK references
 */

import { PrismaClient, Sport, VenueType, SpreadResult, OUResult, WeatherCategory } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const DATA_DIR = path.resolve(process.cwd(), "data");
const BATCH_SIZE = 500; // Neon handles 500 rows per insert well

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function loadJSON<T>(filename: string): T {
  const raw = fs.readFileSync(path.join(DATA_DIR, filename), "utf8");
  return JSON.parse(raw);
}

function parseDate(dateStr: string): Date {
  // JSON dates are "YYYY-MM-DD" format
  const d = new Date(dateStr + "T12:00:00Z"); // Noon UTC to avoid timezone issues
  return d;
}

function toSpreadResult(val: string | null | undefined): SpreadResult | null {
  if (!val) return null;
  const upper = val.toUpperCase();
  if (upper === "COVERED") return SpreadResult.COVERED;
  if (upper === "LOST") return SpreadResult.LOST;
  if (upper === "PUSH") return SpreadResult.PUSH;
  return null;
}

function toOUResult(val: string | null | undefined): OUResult | null {
  if (!val) return null;
  const upper = val.toUpperCase();
  if (upper === "OVER") return OUResult.OVER;
  if (upper === "UNDER") return OUResult.UNDER;
  if (upper === "PUSH") return OUResult.PUSH;
  return null;
}

function toWeatherCategory(val: string | null | undefined): WeatherCategory | null {
  if (!val) return null;
  const upper = val.toUpperCase().replace(/[^A-Z_]/g, "");
  const map: Record<string, WeatherCategory> = {
    CLEAR: WeatherCategory.CLEAR,
    CLOUDY: WeatherCategory.CLOUDY,
    RAIN: WeatherCategory.RAIN,
    SNOW: WeatherCategory.SNOW,
    WIND: WeatherCategory.WIND,
    FOG: WeatherCategory.FOG,
    DOME: WeatherCategory.DOME,
    RETRACTABLE_CLOSED: WeatherCategory.RETRACTABLE_CLOSED,
    RETRACTABLE_OPEN: WeatherCategory.RETRACTABLE_OPEN,
    RETRACTABLECLOSED: WeatherCategory.RETRACTABLE_CLOSED,
    RETRACTABLEOPEN: WeatherCategory.RETRACTABLE_OPEN,
  };
  return map[upper] ?? null;
}

function toVenueType(val: string | null | undefined): VenueType {
  if (!val) return VenueType.OUTDOOR;
  const upper = val.toUpperCase();
  if (upper === "DOME") return VenueType.DOME;
  if (upper === "RETRACTABLE") return VenueType.RETRACTABLE;
  return VenueType.OUTDOOR;
}

async function batchCreate<T>(
  label: string,
  items: T[],
  createFn: (batch: T[]) => Promise<void>,
) {
  const total = items.length;
  let done = 0;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await createFn(batch);
    done += batch.length;
    process.stdout.write(`\r  ${label}: ${done.toLocaleString()} / ${total.toLocaleString()} (${((done / total) * 100).toFixed(1)}%)`);
  }
  console.log(); // newline
}

// ─── NFL TEAM METADATA ───────────────────────────────────────────────────────

const NFL_TEAMS: Record<string, { abbr: string; conf: string; div: string; city: string; state: string }> = {
  "Arizona Cardinals": { abbr: "ARI", conf: "NFC", div: "West", city: "Glendale", state: "AZ" },
  "Atlanta Falcons": { abbr: "ATL", conf: "NFC", div: "South", city: "Atlanta", state: "GA" },
  "Baltimore Ravens": { abbr: "BAL", conf: "AFC", div: "North", city: "Baltimore", state: "MD" },
  "Buffalo Bills": { abbr: "BUF", conf: "AFC", div: "East", city: "Orchard Park", state: "NY" },
  "Carolina Panthers": { abbr: "CAR", conf: "NFC", div: "South", city: "Charlotte", state: "NC" },
  "Chicago Bears": { abbr: "CHI", conf: "NFC", div: "North", city: "Chicago", state: "IL" },
  "Cincinnati Bengals": { abbr: "CIN", conf: "AFC", div: "North", city: "Cincinnati", state: "OH" },
  "Cleveland Browns": { abbr: "CLE", conf: "AFC", div: "North", city: "Cleveland", state: "OH" },
  "Dallas Cowboys": { abbr: "DAL", conf: "NFC", div: "East", city: "Arlington", state: "TX" },
  "Denver Broncos": { abbr: "DEN", conf: "AFC", div: "West", city: "Denver", state: "CO" },
  "Detroit Lions": { abbr: "DET", conf: "NFC", div: "North", city: "Detroit", state: "MI" },
  "Green Bay Packers": { abbr: "GB", conf: "NFC", div: "North", city: "Green Bay", state: "WI" },
  "Houston Texans": { abbr: "HOU", conf: "AFC", div: "South", city: "Houston", state: "TX" },
  "Indianapolis Colts": { abbr: "IND", conf: "AFC", div: "South", city: "Indianapolis", state: "IN" },
  "Jacksonville Jaguars": { abbr: "JAX", conf: "AFC", div: "South", city: "Jacksonville", state: "FL" },
  "Kansas City Chiefs": { abbr: "KC", conf: "AFC", div: "West", city: "Kansas City", state: "MO" },
  "Las Vegas Raiders": { abbr: "LV", conf: "AFC", div: "West", city: "Las Vegas", state: "NV" },
  "Los Angeles Chargers": { abbr: "LAC", conf: "AFC", div: "West", city: "Inglewood", state: "CA" },
  "Los Angeles Rams": { abbr: "LAR", conf: "NFC", div: "West", city: "Inglewood", state: "CA" },
  "Miami Dolphins": { abbr: "MIA", conf: "AFC", div: "East", city: "Miami Gardens", state: "FL" },
  "Minnesota Vikings": { abbr: "MIN", conf: "NFC", div: "North", city: "Minneapolis", state: "MN" },
  "New England Patriots": { abbr: "NE", conf: "AFC", div: "East", city: "Foxborough", state: "MA" },
  "New Orleans Saints": { abbr: "NO", conf: "NFC", div: "South", city: "New Orleans", state: "LA" },
  "New York Giants": { abbr: "NYG", conf: "NFC", div: "East", city: "East Rutherford", state: "NJ" },
  "New York Jets": { abbr: "NYJ", conf: "AFC", div: "East", city: "East Rutherford", state: "NJ" },
  "Philadelphia Eagles": { abbr: "PHI", conf: "NFC", div: "East", city: "Philadelphia", state: "PA" },
  "Pittsburgh Steelers": { abbr: "PIT", conf: "AFC", div: "North", city: "Pittsburgh", state: "PA" },
  "San Francisco 49ers": { abbr: "SF", conf: "NFC", div: "West", city: "Santa Clara", state: "CA" },
  "Seattle Seahawks": { abbr: "SEA", conf: "NFC", div: "West", city: "Seattle", state: "WA" },
  "Tampa Bay Buccaneers": { abbr: "TB", conf: "NFC", div: "South", city: "Tampa", state: "FL" },
  "Tennessee Titans": { abbr: "TEN", conf: "AFC", div: "South", city: "Nashville", state: "TN" },
  "Washington Commanders": { abbr: "WSH", conf: "NFC", div: "East", city: "Landover", state: "MD" },
};

// ─── MAIN IMPORT ─────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();

  console.log("═══ TrendLine → PostgreSQL Import ═══\n");

  // ─── Load Data ───────────────────────────────────────────────────
  console.log("Loading JSON data files...");
  const nflGames = loadJSON<any[]>("nfl-games-staging.json");
  const ncaafGames = loadJSON<any[]>("ncaaf-games-final.json");

  console.log("  Loading NCAAMB (120K games, may take a moment)...");
  const ncaambGames = loadJSON<any[]>("ncaamb-games-staging.json");

  console.log(`  NFL: ${nflGames.length.toLocaleString()} games`);
  console.log(`  NCAAF: ${ncaafGames.length.toLocaleString()} games`);
  console.log(`  NCAAMB: ${ncaambGames.length.toLocaleString()} games`);
  console.log(`  Total: ${(nflGames.length + ncaafGames.length + ncaambGames.length).toLocaleString()} games\n`);

  // ─── Clear existing data (fresh import) ──────────────────────────
  console.log("Clearing existing data...");
  await prisma.nCAAMBGame.deleteMany();
  await prisma.nCAAFGame.deleteMany();
  await prisma.nFLGame.deleteMany();
  await prisma.team.deleteMany();
  console.log("  Done.\n");

  // ─── Step 1: Create Teams ────────────────────────────────────────
  console.log("Creating teams...");

  // NFL teams (rich metadata)
  const nflTeamRecords = Object.entries(NFL_TEAMS).map(([name, meta]) => ({
    name,
    abbreviation: meta.abbr,
    sport: Sport.NFL,
    conference: meta.conf,
    division: meta.div,
    city: meta.city,
    state: meta.state,
    venueType: VenueType.OUTDOOR,
  }));

  await prisma.team.createMany({ data: nflTeamRecords });
  console.log(`  NFL: ${nflTeamRecords.length} teams`);

  // NCAAF teams (extract from game data)
  const ncaafTeamSet = new Map<string, { conf: string }>();
  for (const g of ncaafGames) {
    const home = g.homeTeamCanonical || g.homeTeam;
    const away = g.awayTeamCanonical || g.awayTeam;
    if (home && !ncaafTeamSet.has(home)) {
      ncaafTeamSet.set(home, { conf: g.homeConference || "Unknown" });
    }
    if (away && !ncaafTeamSet.has(away)) {
      ncaafTeamSet.set(away, { conf: g.awayConference || "Unknown" });
    }
  }

  const ncaafTeamRecords = Array.from(ncaafTeamSet.entries()).map(([name, meta]) => ({
    name,
    abbreviation: name.substring(0, 6).toUpperCase(),
    sport: Sport.NCAAF,
    conference: meta.conf,
    city: "",
    state: "",
    venueType: VenueType.OUTDOOR,
  }));

  await prisma.team.createMany({ data: ncaafTeamRecords });
  console.log(`  NCAAF: ${ncaafTeamRecords.length} teams`);

  // NCAAMB teams (extract from game data)
  const ncaambTeamSet = new Map<string, { conf: string }>();
  for (const g of ncaambGames) {
    if (g.homeTeam && !ncaambTeamSet.has(g.homeTeam)) {
      ncaambTeamSet.set(g.homeTeam, { conf: g.homeConference || "Unknown" });
    }
    if (g.awayTeam && !ncaambTeamSet.has(g.awayTeam)) {
      ncaambTeamSet.set(g.awayTeam, { conf: g.awayConference || "Unknown" });
    }
  }

  const ncaambTeamRecords = Array.from(ncaambTeamSet.entries()).map(([name, meta]) => ({
    name,
    abbreviation: name.substring(0, 6).toUpperCase(),
    sport: Sport.NCAAMB,
    conference: meta.conf,
    city: "",
    state: "",
    venueType: VenueType.DOME, // basketball is indoors
  }));

  await prisma.team.createMany({ data: ncaambTeamRecords });
  console.log(`  NCAAMB: ${ncaambTeamRecords.length} teams\n`);

  // ─── Build team name → ID lookup maps ────────────────────────────
  console.log("Building team ID lookup maps...");
  const allTeams = await prisma.team.findMany();

  const nflTeamMap = new Map<string, number>();
  const ncaafTeamMap = new Map<string, number>();
  const ncaambTeamMap = new Map<string, number>();

  for (const t of allTeams) {
    if (t.sport === Sport.NFL) nflTeamMap.set(t.name, t.id);
    else if (t.sport === Sport.NCAAF) ncaafTeamMap.set(t.name, t.id);
    else if (t.sport === Sport.NCAAMB) ncaambTeamMap.set(t.name, t.id);
  }
  console.log(`  NFL: ${nflTeamMap.size}, NCAAF: ${ncaafTeamMap.size}, NCAAMB: ${ncaambTeamMap.size}\n`);

  // ─── Step 2: Import NFL Games ────────────────────────────────────
  console.log("Importing NFL games...");
  let nflSkipped = 0;

  const nflRecords = nflGames.map((g) => {
    const homeId = nflTeamMap.get(g.homeTeamCanonical);
    const awayId = nflTeamMap.get(g.awayTeamCanonical);
    const winnerId = g.winnerCanonical ? nflTeamMap.get(g.winnerCanonical) : null;

    if (!homeId || !awayId) {
      nflSkipped++;
      return null;
    }

    return {
      season: g.season,
      week: String(g.week),
      dayOfWeek: g.dayOfWeek || "Sun",
      gameDate: parseDate(g.gameDate),
      kickoffTime: g.kickoffTime || null,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: g.homeScore ?? null,
      awayScore: g.awayScore ?? null,
      scoreDifference: g.scoreDifference ?? null,
      winnerId: winnerId || null,
      isPrimetime: g.isPrimetime || false,
      primetimeSlot: g.primetimeSlot || null,
      temperature: g.temperature != null ? Number(g.temperature) : null,
      windMph: g.windMph != null ? Number(g.windMph) : null,
      weatherCategory: toWeatherCategory(g.weatherCategory),
      weatherRaw: g.weatherRaw || null,
      spread: g.spread != null ? Number(g.spread) : null,
      overUnder: g.overUnder != null ? Number(g.overUnder) : null,
      spreadResult: toSpreadResult(g.spreadResult),
      ouResult: toOUResult(g.ouResult),
      isPlayoff: g.isPlayoff || false,
      isNeutralSite: g.isNeutralSite || false,
      source: g.source || null,
    };
  }).filter(Boolean) as any[];

  await batchCreate("NFL games", nflRecords, async (batch) => {
    await prisma.nFLGame.createMany({ data: batch, skipDuplicates: true });
  });
  if (nflSkipped) console.log(`  ⚠ Skipped ${nflSkipped} NFL games (unknown team)`);

  // ─── Step 3: Import NCAAF Games ──────────────────────────────────
  console.log("Importing NCAAF games...");
  let ncaafSkipped = 0;

  const ncaafRecords = ncaafGames.map((g) => {
    const homeName = g.homeTeamCanonical || g.homeTeam;
    const awayName = g.awayTeamCanonical || g.awayTeam;
    const homeId = ncaafTeamMap.get(homeName);
    const awayId = ncaafTeamMap.get(awayName);
    const winnerId = g.winnerCanonical ? ncaafTeamMap.get(g.winnerCanonical) : null;

    if (!homeId || !awayId) {
      ncaafSkipped++;
      return null;
    }

    return {
      season: g.season,
      week: String(g.week),
      dayOfWeek: g.dayOfWeek || "Sat",
      gameDate: parseDate(g.gameDate),
      kickoffTime: g.kickoffTime || null,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: g.homeScore ?? null,
      awayScore: g.awayScore ?? null,
      scoreDifference: g.scoreDifference ?? null,
      winnerId: winnerId || null,
      homeRank: g.homeRank ?? null,
      awayRank: g.awayRank ?? null,
      isConferenceGame: g.isConferenceGame || false,
      isBowlGame: g.isBowlGame || false,
      bowlName: g.bowlName || null,
      isPrimetime: g.isPrimetime || false,
      primetimeSlot: g.primetimeSlot || null,
      temperature: g.temperature != null ? Number(g.temperature) : null,
      windMph: g.windMph != null ? Number(g.windMph) : null,
      weatherCategory: toWeatherCategory(g.weatherCategory),
      weatherRaw: g.weatherRaw || null,
      spread: g.spread != null ? Number(g.spread) : null,
      overUnder: g.overUnder != null ? Number(g.overUnder) : null,
      spreadResult: toSpreadResult(g.spreadResult),
      ouResult: toOUResult(g.ouResult),
      isPlayoff: g.isPlayoff || false,
      isNeutralSite: g.isNeutralSite || false,
      source: g.source || null,
    };
  }).filter(Boolean) as any[];

  await batchCreate("NCAAF games", ncaafRecords, async (batch) => {
    await prisma.nCAAFGame.createMany({ data: batch, skipDuplicates: true });
  });
  if (ncaafSkipped) console.log(`  ⚠ Skipped ${ncaafSkipped} NCAAF games (unknown team)`);

  // ─── Step 4: Import NCAAMB Games ─────────────────────────────────
  console.log("Importing NCAAMB games...");
  let ncaambSkipped = 0;

  const ncaambRecords = ncaambGames.map((g) => {
    const homeId = ncaambTeamMap.get(g.homeTeam);
    const awayId = ncaambTeamMap.get(g.awayTeam);
    const winnerId = g.winnerCanonical ? ncaambTeamMap.get(g.winnerCanonical) : null;

    if (!homeId || !awayId) {
      ncaambSkipped++;
      return null;
    }

    return {
      season: g.season,
      gameDate: parseDate(g.gameDate),
      tipoffTime: null,
      homeTeamId: homeId,
      awayTeamId: awayId,
      homeScore: g.homeScore ?? null,
      awayScore: g.awayScore ?? null,
      scoreDifference: g.scoreDifference ?? null,
      winnerId: winnerId || null,
      homeRank: g.homeRank ?? null,
      awayRank: g.awayRank ?? null,
      homeSeed: g.homeSeed ?? null,
      awaySeed: g.awaySeed ?? null,
      isConferenceGame: g.isConferenceGame || false,
      isNeutralSite: g.isNeutralSite || false,
      isTournament: g.isNCAAT || false,
      tournamentRound: g.tournamentRound || null,
      tournamentRegion: g.tournamentRegion || null,
      isNIT: g.isNIT || false,
      isConferenceTourney: g.isConfTourney || false,
      homeKenpomRank: g.homeKenpomRank ?? null,
      awayKenpomRank: g.awayKenpomRank ?? null,
      homeAdjEM: g.homeAdjEM != null ? Number(g.homeAdjEM) : null,
      awayAdjEM: g.awayAdjEM != null ? Number(g.awayAdjEM) : null,
      homeAdjOE: g.homeAdjOE != null ? Number(g.homeAdjOE) : null,
      awayAdjOE: g.awayAdjOE != null ? Number(g.awayAdjOE) : null,
      homeAdjDE: g.homeAdjDE != null ? Number(g.homeAdjDE) : null,
      awayAdjDE: g.awayAdjDE != null ? Number(g.awayAdjDE) : null,
      homeAdjTempo: g.homeAdjTempo != null ? Number(g.homeAdjTempo) : null,
      awayAdjTempo: g.awayAdjTempo != null ? Number(g.awayAdjTempo) : null,
      fmHomePred: g.fmHomePred != null ? Number(g.fmHomePred) : null,
      fmAwayPred: g.fmAwayPred != null ? Number(g.fmAwayPred) : null,
      fmHomeWinProb: g.fmHomeWinProb != null ? Number(g.fmHomeWinProb) : null,
      fmThrillScore: g.fmThrillScore != null ? Number(g.fmThrillScore) : null,
      spread: g.spread != null ? Number(g.spread) : null,
      overUnder: g.overUnder != null ? Number(g.overUnder) : null,
      spreadResult: toSpreadResult(g.spreadResult),
      ouResult: toOUResult(g.ouResult),
      overtimes: g.overtimes || 0,
      source: g.source || null,
    };
  }).filter(Boolean) as any[];

  await batchCreate("NCAAMB games", ncaambRecords, async (batch) => {
    await prisma.nCAAMBGame.createMany({ data: batch, skipDuplicates: true });
  });
  if (ncaambSkipped) console.log(`  ⚠ Skipped ${ncaambSkipped} NCAAMB games (unknown team)`);

  // ─── Summary ─────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  const [nflCount, ncaafCount, ncaambCount, teamCount] = await Promise.all([
    prisma.nFLGame.count(),
    prisma.nCAAFGame.count(),
    prisma.nCAAMBGame.count(),
    prisma.team.count(),
  ]);

  console.log("\n═══ Import Complete ═══");
  console.log(`  Teams:  ${teamCount.toLocaleString()}`);
  console.log(`  NFL:    ${nflCount.toLocaleString()} games`);
  console.log(`  NCAAF:  ${ncaafCount.toLocaleString()} games`);
  console.log(`  NCAAMB: ${ncaambCount.toLocaleString()} games`);
  console.log(`  Total:  ${(nflCount + ncaafCount + ncaambCount).toLocaleString()} games`);
  console.log(`  Time:   ${elapsed}s\n`);
}

main()
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
