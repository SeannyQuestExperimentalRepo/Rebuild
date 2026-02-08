/**
 * Export Finalized NFL Dataset — Phase 1, Cycles 56-60
 *
 * Reads the validated staging JSON and outputs:
 * 1. nfl-games-final.csv — the single source of truth for DB import
 * 2. Summary statistics
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/nfl-games-staging.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// ─── Export Final CSV ─────────────────────────────────────────────────────

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
  "isPrimetime",
  "primetimeSlot",
  "temperature",
  "windMph",
  "weatherCategory",
  "weatherRaw",
  "spread",
  "overUnder",
  "spreadResult",
  "ouResult",
  "isPlayoff",
  "isNeutralSite",
  "source",
];

const csvHeader = csvColumns.join(",");
const csvRows = data.map((g) =>
  csvColumns
    .map((col) => {
      const v = g[col];
      if (v === null || v === undefined) return "";
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    })
    .join(",")
);

const csvPath = path.join(__dirname, "../data/nfl-games-final.csv");
fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join("\n"));
console.log(`Final CSV: ${csvPath} (${data.length} games)\n`);

// ─── Summary Statistics ───────────────────────────────────────────────────

console.log("═══ NFL DATASET SUMMARY ═══\n");
console.log(`Total games: ${data.length}`);
console.log(`Seasons: ${Math.min(...data.map((g) => g.season))} - ${Math.max(...data.map((g) => g.season))}`);

// Games by season
console.log("\n─── Games per Season ───");
const bySeason = {};
for (const g of data) {
  bySeason[g.season] = (bySeason[g.season] || 0) + 1;
}
Object.entries(bySeason)
  .sort(([a], [b]) => a - b)
  .forEach(([s, c]) => console.log(`  ${s}: ${c}`));

// Spread coverage by era
console.log("\n─── Spread Coverage by Era ───");
const eras = [
  { name: "Pre-spread (1966-1978)", min: 1966, max: 1978 },
  { name: "Early spread (1979-1989)", min: 1979, max: 1989 },
  { name: "Modern (1990-2009)", min: 1990, max: 2009 },
  { name: "Recent (2010-2025)", min: 2010, max: 2025 },
];
for (const era of eras) {
  const games = data.filter((g) => g.season >= era.min && g.season <= era.max);
  const withSpread = games.filter((g) => g.spread !== null);
  const pct = games.length > 0 ? ((withSpread.length / games.length) * 100).toFixed(1) : "N/A";
  console.log(`  ${era.name}: ${withSpread.length}/${games.length} (${pct}%)`);
}

// Weather coverage
console.log("\n─── Weather Coverage ───");
const weatherCats = {};
for (const g of data) {
  const cat = g.weatherCategory || "MISSING";
  weatherCats[cat] = (weatherCats[cat] || 0) + 1;
}
Object.entries(weatherCats)
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => {
    const pct = ((n / data.length) * 100).toFixed(1);
    console.log(`  ${c}: ${n} (${pct}%)`);
  });

// Primetime games
console.log("\n─── Primetime Games ───");
const primetimeSlots = {};
const ptGames = data.filter((g) => g.isPrimetime);
for (const g of ptGames) {
  const slot = g.primetimeSlot || "Unknown";
  primetimeSlots[slot] = (primetimeSlots[slot] || 0) + 1;
}
console.log(`  Total: ${ptGames.length}`);
Object.entries(primetimeSlots)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`  ${s}: ${n}`));

// Playoff games
console.log("\n─── Playoff Games ───");
const playoffWeeks = {};
const plGames = data.filter((g) => g.isPlayoff);
for (const g of plGames) {
  playoffWeeks[g.week] = (playoffWeeks[g.week] || 0) + 1;
}
console.log(`  Total: ${plGames.length}`);
Object.entries(playoffWeeks)
  .sort((a, b) => b[1] - a[1])
  .forEach(([w, n]) => console.log(`  ${w}: ${n}`));

// ATS summary
console.log("\n─── ATS Summary (all games with spread) ───");
const withSpread = data.filter((g) => g.spreadResult);
const covered = withSpread.filter((g) => g.spreadResult === "COVERED").length;
const lost = withSpread.filter((g) => g.spreadResult === "LOST").length;
const push = withSpread.filter((g) => g.spreadResult === "PUSH").length;
console.log(`  Total: ${withSpread.length}`);
console.log(`  Covered: ${covered} (${((covered / withSpread.length) * 100).toFixed(1)}%)`);
console.log(`  Lost: ${lost} (${((lost / withSpread.length) * 100).toFixed(1)}%)`);
console.log(`  Push: ${push} (${((push / withSpread.length) * 100).toFixed(1)}%)`);

// O/U summary
console.log("\n─── O/U Summary (all games with O/U) ───");
const withOU = data.filter((g) => g.ouResult);
const over = withOU.filter((g) => g.ouResult === "OVER").length;
const under = withOU.filter((g) => g.ouResult === "UNDER").length;
const ouPush = withOU.filter((g) => g.ouResult === "PUSH").length;
console.log(`  Total: ${withOU.length}`);
console.log(`  Over: ${over} (${((over / withOU.length) * 100).toFixed(1)}%)`);
console.log(`  Under: ${under} (${((under / withOU.length) * 100).toFixed(1)}%)`);
console.log(`  Push: ${ouPush} (${((ouPush / withOU.length) * 100).toFixed(1)}%)`);

console.log("\nDone!");
