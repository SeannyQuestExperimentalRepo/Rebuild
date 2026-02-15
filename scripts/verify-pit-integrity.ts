/**
 * PIT Data Integrity Check
 *
 * For each NCAAMBGame in a given season, verifies that the stored KenPom
 * ratings (homeAdjEM, etc.) match the KenpomSnapshot for that team on that date.
 *
 * Reports mismatches with game ID, expected (snapshot) vs actual (game record).
 * Run after any data pipeline changes to detect regressions.
 *
 * Usage:
 *   NODE_OPTIONS="--require ./scripts/register.cjs" npx tsx scripts/verify-pit-integrity.ts [season]
 */

import { prisma } from "../src/lib/db";
import { normalizeToKenpom } from "../src/lib/kenpom";

const season = parseInt(process.argv[2] || "2026");
const TOLERANCE = 0.01; // Allow tiny float rounding differences

interface Mismatch {
  gameId: number;
  gameDate: string;
  team: string;
  field: string;
  gameValue: number;
  snapshotValue: number;
  delta: number;
}

async function main() {
  console.log(`\n=== PIT Integrity Check — Season ${season} ===\n`);

  // 1. Count available snapshots for this season
  const snapshotCount = await prisma.kenpomSnapshot.count({
    where: { season },
  });
  const snapshotDates = await prisma.kenpomSnapshot.groupBy({
    by: ["snapshotDate"],
    where: { season },
    _count: true,
  });
  console.log(
    `KenpomSnapshot: ${snapshotCount} rows across ${snapshotDates.length} dates`
  );

  // 2. Load all NCAAMB games with KenPom data for this season
  const games = await prisma.nCAAMBGame.findMany({
    where: {
      season,
      homeAdjEM: { not: null },
    },
    select: {
      id: true,
      gameDate: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
      homeAdjEM: true,
      awayAdjEM: true,
      homeAdjOE: true,
      awayAdjOE: true,
      homeAdjDE: true,
      awayAdjDE: true,
      homeAdjTempo: true,
      awayAdjTempo: true,
    },
  });

  console.log(`NCAAMBGames with KenPom data: ${games.length}\n`);

  if (games.length === 0) {
    console.log("No games to check.");
    await prisma.$disconnect();
    return;
  }

  const mismatches: Mismatch[] = [];
  let gamesChecked = 0;
  let gamesWithNoSnapshot = 0;
  let gamesMatched = 0;
  let gamesWithMismatch = 0;

  // 3. For each game, look up the PIT snapshot and compare
  for (const game of games) {
    const dateStr = game.gameDate.toISOString().slice(0, 10);
    const homeName = normalizeToKenpom(game.homeTeam.name);
    const awayName = normalizeToKenpom(game.awayTeam.name);

    // Find the most recent snapshot on or before the game date
    const [homeSnap, awaySnap] = await Promise.all([
      prisma.kenpomSnapshot.findFirst({
        where: {
          teamName: homeName,
          snapshotDate: { lte: game.gameDate },
          season,
        },
        orderBy: { snapshotDate: "desc" },
      }),
      prisma.kenpomSnapshot.findFirst({
        where: {
          teamName: awayName,
          snapshotDate: { lte: game.gameDate },
          season,
        },
        orderBy: { snapshotDate: "desc" },
      }),
    ]);

    gamesChecked++;

    if (!homeSnap || !awaySnap) {
      gamesWithNoSnapshot++;
      continue;
    }

    let gameHasMismatch = false;

    // Compare each field
    const checks: Array<{
      team: string;
      field: string;
      gameVal: number | null;
      snapVal: number;
    }> = [
      {
        team: game.homeTeam.name,
        field: "adjEM",
        gameVal: game.homeAdjEM,
        snapVal: homeSnap.adjEM,
      },
      {
        team: game.homeTeam.name,
        field: "adjOE",
        gameVal: game.homeAdjOE,
        snapVal: homeSnap.adjOE,
      },
      {
        team: game.homeTeam.name,
        field: "adjDE",
        gameVal: game.homeAdjDE,
        snapVal: homeSnap.adjDE,
      },
      {
        team: game.homeTeam.name,
        field: "adjTempo",
        gameVal: game.homeAdjTempo,
        snapVal: homeSnap.adjTempo,
      },
      {
        team: game.awayTeam.name,
        field: "adjEM",
        gameVal: game.awayAdjEM,
        snapVal: awaySnap.adjEM,
      },
      {
        team: game.awayTeam.name,
        field: "adjOE",
        gameVal: game.awayAdjOE,
        snapVal: awaySnap.adjOE,
      },
      {
        team: game.awayTeam.name,
        field: "adjDE",
        gameVal: game.awayAdjDE,
        snapVal: awaySnap.adjDE,
      },
      {
        team: game.awayTeam.name,
        field: "adjTempo",
        gameVal: game.awayAdjTempo,
        snapVal: awaySnap.adjTempo,
      },
    ];

    for (const c of checks) {
      if (c.gameVal == null) continue;
      const delta = Math.abs(c.gameVal - c.snapVal);
      if (delta > TOLERANCE) {
        gameHasMismatch = true;
        mismatches.push({
          gameId: game.id,
          gameDate: dateStr,
          team: c.team,
          field: c.field,
          gameValue: c.gameVal,
          snapshotValue: c.snapVal,
          delta,
        });
      }
    }

    if (gameHasMismatch) gamesWithMismatch++;
    else gamesMatched++;
  }

  // 4. Report results
  console.log("─── Summary ───────────────────────────────────────");
  console.log(`Games checked:           ${gamesChecked}`);
  console.log(`Games matched (PIT):     ${gamesMatched}`);
  console.log(`Games with mismatches:   ${gamesWithMismatch}`);
  console.log(`Games with no snapshot:  ${gamesWithNoSnapshot}`);
  console.log(`Total field mismatches:  ${mismatches.length}`);

  if (mismatches.length > 0) {
    console.log(
      "\n─── Mismatches (first 20) ──────────────────────────"
    );
    for (const m of mismatches.slice(0, 20)) {
      console.log(
        `  Game #${m.gameId} (${m.gameDate}) ${m.team} ${m.field}: ` +
          `game=${m.gameValue.toFixed(2)}, snapshot=${m.snapshotValue.toFixed(2)}, delta=${m.delta.toFixed(2)}`
      );
    }

    if (mismatches.length > 20) {
      console.log(`  ... and ${mismatches.length - 20} more`);
    }

    // Distribution of delta magnitudes
    const deltas = mismatches.map((m) => m.delta);
    const avgDelta =
      deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const maxDelta = Math.max(...deltas);
    console.log(
      `\n  Avg delta: ${avgDelta.toFixed(2)}, Max delta: ${maxDelta.toFixed(2)}`
    );
  }

  if (gamesWithNoSnapshot > 0) {
    console.log(
      `\nNote: ${gamesWithNoSnapshot} games had no KenpomSnapshot data. ` +
        `This is expected for dates before snapshot collection started.`
    );
  }

  console.log(
    `\nResult: ${mismatches.length === 0 ? "PASS" : "FAIL"} — ${mismatches.length} mismatches found`
  );

  await prisma.$disconnect();
  process.exit(mismatches.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(2);
});
