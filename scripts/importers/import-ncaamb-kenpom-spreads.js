/**
 * NCAAMB Spread Import via KenPom Proxy
 *
 * Converts KenPom predicted margins (kenpomPredMargin) into spread/overUnder
 * fields for NCAAMB games. KenPom predictions are the gold standard for CBB
 * analytics and correlate highly with actual Vegas lines.
 *
 * Convention verified:
 *   kenpomPredMargin positive = home predicted to win (e.g., 41.4 = home by 41.4)
 *   Our spread positive = home favored
 *   => Direct mapping, no sign flip needed
 *
 * Fields set:
 *   spread         = kenpomPredMargin (rounded to 1 decimal)
 *   overUnder      = kenpomPredTotal (rounded to 1 decimal)
 *   spreadResult   = COVERED / LOST / PUSH
 *   ouResult       = OVER / UNDER / PUSH
 *   spreadSource   = "kenpom-proxy" (distinguishes from real Vegas lines)
 *
 * Only fills games where spread is null AND kenpomPredMargin is available.
 * Never overwrites existing spread data.
 *
 * Usage:
 *   node scripts/importers/import-ncaamb-kenpom-spreads.js [--dry-run]
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "../../data");
const NCAAMB_FILE = path.join(DATA_DIR, "ncaamb-games-staging.json");

const DRY_RUN = process.argv.includes("--dry-run");

// ─── Spread/OU calculations (matching calculate-results.ts) ─────────────────

function calculateSpreadResult(homeScore, awayScore, spread) {
  if (spread == null || homeScore == null || awayScore == null) return null;
  const margin = (homeScore - awayScore) + spread;
  if (margin > 0) return "COVERED";
  if (margin < 0) return "LOST";
  return "PUSH";
}

function calculateOUResult(homeScore, awayScore, overUnder) {
  if (overUnder == null || homeScore == null || awayScore == null) return null;
  const total = homeScore + awayScore;
  if (total > overUnder) return "OVER";
  if (total < overUnder) return "UNDER";
  return "PUSH";
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  console.log("NCAAMB Spread Import via KenPom Proxy");
  console.log("=" .repeat(50));
  if (DRY_RUN) console.log("** DRY RUN — no files will be written **\n");

  // Load data
  console.log("Loading NCAAMB games...");
  const games = JSON.parse(fs.readFileSync(NCAAMB_FILE, "utf8"));
  console.log(`  ${games.length.toLocaleString()} total games`);

  // Count current state
  const missingBefore = games.filter(g => g.spread == null).length;
  const withKenpom = games.filter(g => g.kenpomPredMargin != null).length;
  const fillable = games.filter(g => g.spread == null && g.kenpomPredMargin != null).length;
  console.log(`  Missing spread:       ${missingBefore.toLocaleString()}`);
  console.log(`  Have kenpomPredMargin: ${withKenpom.toLocaleString()}`);
  console.log(`  Fillable:             ${fillable.toLocaleString()}\n`);

  // Fill spreads
  let filled = 0;
  let alreadyHas = 0;
  let noKenpom = 0;
  const bySeason = {};

  const spreadResultCounts = { COVERED: 0, LOST: 0, PUSH: 0, null: 0 };
  const ouResultCounts = { OVER: 0, UNDER: 0, PUSH: 0, null: 0 };

  for (const game of games) {
    if (game.spread != null) {
      alreadyHas++;
      continue;
    }

    if (game.kenpomPredMargin == null) {
      noKenpom++;
      continue;
    }

    // Set spread from KenPom prediction
    game.spread = Math.round(game.kenpomPredMargin * 10) / 10;

    // Set overUnder from KenPom predicted total (if available)
    if (game.kenpomPredTotal != null) {
      game.overUnder = Math.round(game.kenpomPredTotal * 10) / 10;
    }

    // Calculate results
    game.spreadResult = calculateSpreadResult(
      game.homeScore, game.awayScore, game.spread
    );
    game.ouResult = calculateOUResult(
      game.homeScore, game.awayScore, game.overUnder
    );

    // Mark source
    game.spreadSource = "kenpom-proxy";

    filled++;
    bySeason[game.season] = (bySeason[game.season] || 0) + 1;

    // Track result distribution
    spreadResultCounts[game.spreadResult || "null"]++;
    ouResultCounts[game.ouResult || "null"]++;
  }

  // Summary
  const missingAfter = games.filter(g => g.spread == null).length;
  const coverage = ((games.length - missingAfter) / games.length * 100).toFixed(1);

  console.log("=" .repeat(50));
  console.log(`  Games filled:          ${filled.toLocaleString()}`);
  console.log(`  Already had spread:    ${alreadyHas.toLocaleString()}`);
  console.log(`  No KenPom data:        ${noKenpom.toLocaleString()}`);
  console.log(`  Missing before:        ${missingBefore.toLocaleString()}`);
  console.log(`  Missing after:         ${missingAfter.toLocaleString()}`);
  console.log(`  Coverage:              ${coverage}%`);

  console.log(`\n  Spread result distribution:`);
  console.log(`    COVERED: ${spreadResultCounts.COVERED.toLocaleString()}`);
  console.log(`    LOST:    ${spreadResultCounts.LOST.toLocaleString()}`);
  console.log(`    PUSH:    ${spreadResultCounts.PUSH.toLocaleString()}`);

  console.log(`\n  O/U result distribution:`);
  console.log(`    OVER:    ${ouResultCounts.OVER.toLocaleString()}`);
  console.log(`    UNDER:   ${ouResultCounts.UNDER.toLocaleString()}`);
  console.log(`    PUSH:    ${ouResultCounts.PUSH.toLocaleString()}`);

  if (Object.keys(bySeason).length > 0) {
    console.log(`\n  Filled by season:`);
    for (const s of Object.keys(bySeason).sort()) {
      console.log(`    ${s}: ${bySeason[s].toLocaleString()} games`);
    }
  }

  // Spot-check: show some proxy spreads vs actual results
  const spotChecks = games.filter(g =>
    g.spreadSource === "kenpom-proxy" &&
    g.spread != null &&
    g.homeScore != null &&
    Math.abs(g.spread) > 10 &&
    g.season >= 2008
  ).slice(0, 5);

  if (spotChecks.length > 0) {
    console.log(`\n  Spot-check (large predicted margins):`);
    for (const g of spotChecks) {
      const actualMargin = g.homeScore - g.awayScore;
      console.log(
        `    ${g.gameDate} ${g.homeTeam} ${g.homeScore}-${g.awayScore} ${g.awayTeam} | ` +
        `proxy spread=${g.spread} | actual margin=${actualMargin} | ${g.spreadResult}`
      );
    }
  }

  // Write back
  if (!DRY_RUN && filled > 0) {
    console.log(`\n  Writing to ${path.basename(NCAAMB_FILE)}...`);
    fs.writeFileSync(NCAAMB_FILE, JSON.stringify(games, null, 2) + "\n", "utf8");
    console.log("  Done!");
  } else if (DRY_RUN) {
    console.log(`\n  Dry run complete — ${filled} games would be updated.`);
  } else {
    console.log("\n  No games to fill.");
  }
}

main();
