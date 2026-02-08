/**
 * Quick smoke test for the player trend engine.
 */

import {
  loadPlayerGames,
  executePlayerTrendQuery,
  resolvePlayerName,
  type PlayerTrendQuery,
} from "../src/lib/player-trend-engine";

console.log("Loading player game data...");
const t0 = Date.now();
const games = loadPlayerGames();
console.log(`Loaded ${games.length} player-game records in ${Date.now() - t0}ms\n`);

// Count unique players
const playerIds = new Set(games.map((g) => g.player_id));
console.log(`Unique players: ${playerIds.size}\n`);

// --- Test 1: Mahomes career ---
console.log("=== Test 1: Patrick Mahomes career ===");
const resolved = resolvePlayerName("mahomes", games);
console.log(`Resolved: ${resolved?.displayName} (${resolved?.position})`);

const mahomesResult = executePlayerTrendQuery(
  { player: "Patrick Mahomes", filters: [] },
  games,
);
const ms = mahomesResult.summary;
console.log(`  Games: ${ms.totalGames}`);
console.log(`  Record: ${ms.wins}-${ms.losses} (${ms.winPct}%)`);
console.log(`  ATS: ${ms.atsRecord} (${ms.atsPct}%)`);
console.log(`  Stat averages:`, ms.statAverages);
console.log();

// --- Test 2: QBs in cold weather ---
console.log("=== Test 2: QBs in cold weather (<35°F) since 2020 ===");
const coldQBResult = executePlayerTrendQuery(
  {
    positionGroup: "QB",
    seasonRange: [2020, 2024],
    filters: [
      { field: "temperature", operator: "lt", value: 35 },
      { field: "attempts", operator: "gte", value: 10 }, // meaningful starts
    ],
  },
  games,
);
console.log(`  Games: ${coldQBResult.summary.totalGames}`);
console.log(`  Unique QBs: ${coldQBResult.summary.uniquePlayers}`);
console.log(`  Stat averages:`, coldQBResult.summary.statAverages);
console.log();

// --- Test 3: RBs with 100+ rushing yards ---
console.log("=== Test 3: RBs with 100+ rushing yards since 2020 ===");
const bigRushResult = executePlayerTrendQuery(
  {
    positionGroup: "RB",
    seasonRange: [2020, 2024],
    filters: [{ field: "rushing_yards", operator: "gte", value: 100 }],
  },
  games,
);
console.log(`  Games: ${bigRushResult.summary.totalGames}`);
console.log(`  Unique RBs: ${bigRushResult.summary.uniquePlayers}`);
console.log(`  Win rate: ${bigRushResult.summary.winPct}%`);
console.log(`  ATS: ${bigRushResult.summary.atsRecord}`);
console.log(`  Avg rushing yards: ${bigRushResult.summary.statAverages.rushing_yards}`);
console.log();

// --- Test 4: Derrick Henry career ---
console.log("=== Test 4: Derrick Henry career ===");
const henryResult = executePlayerTrendQuery(
  { player: "Derrick Henry", filters: [] },
  games,
);
const hs = henryResult.summary;
console.log(`  Games: ${hs.totalGames}`);
console.log(`  Record: ${hs.wins}-${hs.losses} (${hs.winPct}%)`);
console.log(`  ATS: ${hs.atsRecord} (${hs.atsPct}%)`);
console.log(`  Avg carries: ${hs.statAverages.carries}`);
console.log(`  Avg rushing yards: ${hs.statAverages.rushing_yards}`);
console.log(`  Avg rushing TDs: ${hs.statAverages.rushing_tds}`);
console.log();

// --- Test 5: WRs in primetime ---
console.log("=== Test 5: Top WR performances in primetime (since 2022) ===");
const primeWRResult = executePlayerTrendQuery(
  {
    positionGroup: "WR",
    seasonRange: [2022, 2024],
    filters: [
      { field: "isPrimetime", operator: "eq", value: true },
      { field: "receiving_yards", operator: "gte", value: 100 },
    ],
    orderBy: { field: "receiving_yards", direction: "desc" },
    limit: 10,
  },
  games,
);
console.log(`  Top 10 WR primetime 100+ yard games:`);
for (const g of primeWRResult.games) {
  console.log(
    `    ${g.player_display_name} | ${g.season} Wk${g.week} | ${g.receiving_yards} yds, ${g.receiving_tds} TDs | vs ${g.opponentCanonical}`
  );
}

console.log("\n=== All tests passed ===");
