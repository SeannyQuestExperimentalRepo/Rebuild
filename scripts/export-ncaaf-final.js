/**
 * Export NCAAF Final Dataset — Phase 2
 *
 * Exports the staging JSON to:
 * 1. ncaaf-games-final.csv (for analysis/import)
 * 2. Summary statistics
 *
 * Filters to both-FBS games only for the final dataset.
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/ncaaf-games-staging.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// ─── Filter to both-FBS games ───────────────────────────────────────────────

const fbsGames = data.filter((g) => g.homeFBS && g.awayFBS);
console.log(`Total staging games: ${data.length}`);
console.log(`Both-FBS games (final): ${fbsGames.length}`);
console.log(
  `Excluded (FBS vs non-FBS): ${data.length - fbsGames.length}`
);

// ─── CSV Export ─────────────────────────────────────────────────────────────

const csvColumns = [
  "season",
  "week",
  "dayOfWeek",
  "gameDate",
  "kickoffTime",
  "homeTeamCanonical",
  "awayTeamCanonical",
  "homeScore",
  "awayScore",
  "scoreDifference",
  "winnerCanonical",
  "homeRank",
  "awayRank",
  "homeConference",
  "awayConference",
  "isConferenceGame",
  "isBowlGame",
  "bowlName",
  "isPlayoff",
  "isNeutralSite",
  "isPrimetime",
  "primetimeSlot",
  "temperature",
  "windMph",
  "weatherCategory",
  "spread",
  "overUnder",
  "spreadResult",
  "ouResult",
  "source",
];

function escapeCSV(val) {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

const csvHeader = csvColumns.join(",");
const csvRows = fbsGames.map((g) =>
  csvColumns.map((col) => escapeCSV(g[col])).join(",")
);

const csvContent = [csvHeader, ...csvRows].join("\n");
const csvPath = path.join(__dirname, "../data/ncaaf-games-final.csv");
fs.writeFileSync(csvPath, csvContent);
console.log(`\nCSV exported: ${csvPath}`);
console.log(`  Columns: ${csvColumns.length}`);
console.log(`  Rows: ${fbsGames.length}`);

// ─── Also save final JSON (both-FBS only) ───────────────────────────────────

const jsonPath = path.join(__dirname, "../data/ncaaf-games-final.json");
fs.writeFileSync(jsonPath, JSON.stringify(fbsGames, null, 2));
console.log(`\nJSON exported: ${jsonPath}`);

// ─── Summary Statistics ─────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════════════════════");
console.log("═══ NCAAF FINAL DATASET SUMMARY ═══");
console.log("═══════════════════════════════════════════════════════════");

console.log(`\nTotal FBS-vs-FBS games: ${fbsGames.length}`);

// Per season
console.log("\n─── Games per Season ───");
const bySeason = {};
for (const g of fbsGames) {
  bySeason[g.season] = (bySeason[g.season] || 0) + 1;
}
Object.entries(bySeason)
  .sort(([a], [b]) => a - b)
  .forEach(([s, c]) => console.log(`  ${s}: ${c}`));

// Conference games
const confGames = fbsGames.filter((g) => g.isConferenceGame);
console.log(`\nConference games: ${confGames.length}`);
const byConf = {};
for (const g of confGames) {
  const c = g.homeConference;
  byConf[c] = (byConf[c] || 0) + 1;
}
console.log("\n─── Conference Games by Conference ───");
Object.entries(byConf)
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => console.log(`  ${c}: ${n}`));

// Rankings
const ranked = fbsGames.filter((g) => g.homeRank || g.awayRank);
const bothRanked = fbsGames.filter((g) => g.homeRank && g.awayRank);
console.log(`\nGames with ranked team: ${ranked.length}`);
console.log(`Ranked vs ranked: ${bothRanked.length}`);

// Bowl / Playoff
const bowls = fbsGames.filter((g) => g.isBowlGame);
const playoffs = fbsGames.filter((g) => g.isPlayoff);
console.log(`\nBowl games: ${bowls.length}`);
console.log(`Playoff/Championship games: ${playoffs.length}`);

// Weather
console.log("\n─── Weather Distribution ───");
const byCat = {};
for (const g of fbsGames) {
  const cat = g.weatherCategory || "MISSING";
  byCat[cat] = (byCat[cat] || 0) + 1;
}
Object.entries(byCat)
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => {
    const pct = ((n / fbsGames.length) * 100).toFixed(1);
    console.log(`  ${c}: ${n} (${pct}%)`);
  });

// Primetime
const primetime = fbsGames.filter((g) => g.isPrimetime);
console.log(`\nPrimetime games: ${primetime.length}`);
const bySlot = {};
for (const g of primetime) {
  const s = g.primetimeSlot || "Unknown";
  bySlot[s] = (bySlot[s] || 0) + 1;
}
Object.entries(bySlot)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`  ${s}: ${n}`));

// Neutral site
const neutral = fbsGames.filter((g) => g.isNeutralSite);
console.log(`\nNeutral site games: ${neutral.length}`);

// Spread data coverage
const withSpread = fbsGames.filter((g) => g.spread !== null);
const withOU = fbsGames.filter((g) => g.overUnder !== null);
console.log(`\n─── Spread/O/U Coverage ───`);
console.log(`  Games with spread: ${withSpread.length}/${fbsGames.length}`);
console.log(`  Games with O/U: ${withOU.length}/${fbsGames.length}`);

// Day of week distribution
console.log("\n─── Day of Week ───");
const byDay = {};
for (const g of fbsGames) {
  byDay[g.dayOfWeek] = (byDay[g.dayOfWeek] || 0) + 1;
}
Object.entries(byDay)
  .sort((a, b) => b[1] - a[1])
  .forEach(([d, n]) => {
    const pct = ((n / fbsGames.length) * 100).toFixed(1);
    console.log(`  ${d}: ${n} (${pct}%)`);
  });

console.log("\n═══════════════════════════════════════════════════════════");
console.log("Export complete.");
