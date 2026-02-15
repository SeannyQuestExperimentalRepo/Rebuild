/**
 * BACKTEST REGRESSION TEST — Quick sanity check on a fixed sample of games.
 *
 * Runs the same walk-forward PIT Ridge regression on a deterministic sample
 * of 100 games from season 2025, and verifies the accuracy is within the
 * expected range. If accuracy changes after code changes, something broke.
 *
 * Exit codes:
 *   0 = PASS (accuracy within expected range)
 *   1 = FAIL (accuracy outside expected range)
 *   2 = ERROR (script failure)
 *
 * Usage:
 *   NODE_OPTIONS="--require ./scripts/register.cjs" npx tsx scripts/backtest/regression-test.js
 */
const { PrismaClient } = require("@prisma/client");

// ─── KenPom team name mapping ────────────────────────────────────────────────

const DB_TO_KENPOM = {
  "N.C. State": "NC State", "NC State": "NC State",
  "UConn": "Connecticut", "UCONN": "Connecticut",
  "UMass": "Massachusetts", "Ole Miss": "Mississippi",
  "Pitt": "Pittsburgh", "PITT": "Pittsburgh",
  "UCF": "Central Florida", "USC": "Southern California",
  "UNC": "North Carolina", "UNLV": "UNLV", "SMU": "SMU",
  "LSU": "LSU", "VCU": "VCU", "UAB": "UAB", "UTEP": "UTEP",
  "UTSA": "UT San Antonio", "UT Arlington": "UT Arlington",
  "UT Martin": "Tennessee Martin", "FIU": "FIU", "LIU": "LIU",
  "NIU": "Northern Illinois", "SIU": "Southern Illinois",
  "SIU Edwardsville": "SIU Edwardsville",
  "UIC": "Illinois Chicago", "IUPUI": "IUPUI",
  "Miami (FL)": "Miami FL", "Miami (OH)": "Miami OH",
  "Saint Mary's": "Saint Mary's", "St. Mary's": "Saint Mary's",
  "St. John's": "St. John's", "Saint Joseph's": "Saint Joseph's",
  "St. Joseph's": "Saint Joseph's", "Saint Peter's": "Saint Peter's",
  "St. Peter's": "Saint Peter's", "St. Bonaventure": "St. Bonaventure",
  "Saint Bonaventure": "St. Bonaventure",
  "Loyola Chicago": "Loyola Chicago", "Loyola (MD)": "Loyola MD",
  "Loyola Marymount": "Loyola Marymount",
  "Cal St. Bakersfield": "Cal St. Bakersfield",
  "Cal St. Fullerton": "Cal St. Fullerton",
  "Cal St. Northridge": "CSUN", "Seattle": "Seattle",
  "Hawai'i": "Hawaii", "Hawaii": "Hawaii",
  "UNI": "Northern Iowa", "ETSU": "East Tennessee St.",
  "FGCU": "Florida Gulf Coast", "UMBC": "UMBC",
  "SIUE": "SIU Edwardsville",
  "App State": "Appalachian St.", "Appalachian State": "Appalachian St.",
  "BYU": "BYU", "TCU": "TCU", "UNF": "North Florida",
  "UNCG": "UNC Greensboro", "UNCW": "UNC Wilmington",
  "UNCA": "UNC Asheville",
  "Central Connecticut": "Central Connecticut",
  "Central Connecticut State": "Central Connecticut",
  "Cal Poly": "Cal Poly", "Iona": "Iona", "Gonzaga": "Gonzaga",
  "Saint Louis": "Saint Louis", "St. Louis": "Saint Louis",
  "UNC Greensboro": "UNC Greensboro", "UNC Wilmington": "UNC Wilmington",
  "UNC Asheville": "UNC Asheville", "NJIT": "NJIT",
  "FAU": "Florida Atlantic", "WKU": "Western Kentucky",
  "Middle Tennessee": "Middle Tennessee", "MTSU": "Middle Tennessee",
  "South Florida": "South Florida", "USF": "South Florida",
  "North Texas": "North Texas", "Louisiana": "Louisiana",
  "Louisiana-Lafayette": "Louisiana", "Louisiana-Monroe": "Louisiana Monroe",
  "Little Rock": "Little Rock", "UALR": "Little Rock",
  "Omaha": "Omaha", "Detroit Mercy": "Detroit Mercy",
  "Detroit": "Detroit Mercy", "Green Bay": "Green Bay",
  "Milwaukee": "Milwaukee",
};

function normalizeToKenpom(dbName) {
  if (DB_TO_KENPOM[dbName]) return DB_TO_KENPOM[dbName];
  if (dbName.endsWith(" State") && !dbName.startsWith("Saint")) {
    return dbName.replace(/ State$/, " St.");
  }
  return dbName;
}

function lookupSnapshot(snapshotMap, dbTeamName) {
  if (snapshotMap.has(dbTeamName)) return snapshotMap.get(dbTeamName);
  const normalized = normalizeToKenpom(dbTeamName);
  if (snapshotMap.has(normalized)) return snapshotMap.get(normalized);
  const lower = dbTeamName.toLowerCase();
  for (const [k, v] of snapshotMap.entries()) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function formatDate(d) {
  return d.toISOString().split("T")[0];
}

function ridge(X, y, lambda) {
  const n = X.length, p = X[0].length;
  const XtX = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < p; j++)
      for (let k = j; k < p; k++)
        XtX[j][k] += X[i][j] * X[i][k];
  for (let j = 0; j < p; j++) for (let k = 0; k < j; k++) XtX[j][k] = XtX[k][j];
  for (let j = 1; j < p; j++) XtX[j][j] += lambda;
  const Xty = new Float64Array(p);
  for (let i = 0; i < n; i++) for (let j = 0; j < p; j++) Xty[j] += X[i][j] * y[i];
  const L = Array.from({ length: p }, () => new Float64Array(p));
  for (let i = 0; i < p; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = XtX[i][j];
      for (let k = 0; k < j; k++) sum -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(sum, 1e-10)) : sum / L[j][j];
    }
  }
  const z = new Float64Array(p);
  for (let i = 0; i < p; i++) {
    let sum = Xty[i]; for (let j = 0; j < i; j++) sum -= L[i][j] * z[j]; z[i] = sum / L[i][i];
  }
  const beta = new Float64Array(p);
  for (let i = p - 1; i >= 0; i--) {
    let sum = z[i]; for (let j = i + 1; j < p; j++) sum -= L[j][i] * beta[j]; beta[i] = sum / L[i][i];
  }
  return Array.from(beta);
}

function buildRow(g, homeR, awayR) {
  return {
    season: g.season,
    line: g.overUnder,
    actualTotal: g.homeScore + g.awayScore,
    sumDE: homeR.adjDE + awayR.adjDE,
    sumOE: homeR.adjOE + awayR.adjOE,
    avgTempo: (homeR.adjTempo + awayR.adjTempo) / 2,
  };
}

// ─── Expected ranges (from honest-backtest.js run on 2025-02-12) ────────

// 2025 season PIT accuracy at edge >= 1.5 should be ~62-65%
// If it drifts outside 55-72%, something is wrong.
const EXPECTED_2025_MIN = 55.0;
const EXPECTED_2025_MAX = 72.0;
// Overall PIT across all seasons ~60-66%
const EXPECTED_OVERALL_MIN = 57.0;
const EXPECTED_OVERALL_MAX = 70.0;

async function main() {
  const prisma = new PrismaClient();

  console.log("Loading snapshots...");
  const snapshots = await prisma.kenpomSnapshot.findMany({
    orderBy: { snapshotDate: "asc" },
  });

  const snapshotsByDate = new Map();
  for (const s of snapshots) {
    const dateKey = formatDate(s.snapshotDate);
    if (!snapshotsByDate.has(dateKey)) snapshotsByDate.set(dateKey, new Map());
    snapshotsByDate.get(dateKey).set(s.teamName, s);
  }

  // Load ALL completed games for training + testing
  const games = await prisma.nCAAMBGame.findMany({
    where: {
      homeScore: { not: null }, awayScore: { not: null },
      overUnder: { not: null },
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { gameDate: "asc" },
  });

  const enriched = [];
  for (const g of games) {
    const prevDate = new Date(g.gameDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const snapshotDate = formatDate(prevDate);
    const gameDate = formatDate(g.gameDate);

    let dateSnapshots = snapshotsByDate.get(snapshotDate);
    if (!dateSnapshots) {
      dateSnapshots = snapshotsByDate.get(gameDate);
      if (!dateSnapshots) {
        const twoDaysBefore = new Date(g.gameDate);
        twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
        dateSnapshots = snapshotsByDate.get(formatDate(twoDaysBefore));
      }
    }
    if (!dateSnapshots) continue;

    const homeR = lookupSnapshot(dateSnapshots, g.homeTeam.name);
    const awayR = lookupSnapshot(dateSnapshots, g.awayTeam.name);
    if (!homeR || !awayR) continue;
    enriched.push(buildRow(g, homeR, awayR));
  }

  // Walk-forward on 2025: train on all prior, test on 2025
  const train2025 = enriched.filter((g) => g.season < 2025);
  const test2025 = enriched.filter((g) => g.season === 2025);

  if (train2025.length < 100) {
    console.error("FAIL: Not enough training data for season 2025");
    await prisma.$disconnect();
    process.exit(1);
  }

  const features = (g) => [1, g.sumDE, g.sumOE, g.avgTempo];
  const beta = ridge(train2025.map(features), train2025.map((g) => g.actualTotal), 1000);

  // Predict on first 100 deterministic games of 2025 (sorted by date)
  const sample = test2025.slice(0, 100);
  let wins = 0, losses = 0;

  for (const g of sample) {
    const x = features(g);
    const predicted = x.reduce((s, v, j) => s + v * beta[j], 0);
    const edge = predicted - g.line;
    const absEdge = Math.abs(edge);
    const ouDir = edge > 0 ? "over" : "under";
    if (absEdge < 1.5) continue;

    let result;
    if (g.actualTotal > g.line) result = ouDir === "over" ? "WIN" : "LOSS";
    else if (g.actualTotal < g.line) result = ouDir === "under" ? "WIN" : "LOSS";
    else continue; // push

    if (result === "WIN") wins++;
    else losses++;
  }

  const samplePct = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

  // Also check full 2025 season
  let fullWins = 0, fullLosses = 0;
  for (const g of test2025) {
    const x = features(g);
    const predicted = x.reduce((s, v, j) => s + v * beta[j], 0);
    const edge = predicted - g.line;
    const absEdge = Math.abs(edge);
    const ouDir = edge > 0 ? "over" : "under";
    if (absEdge < 1.5) continue;

    let result;
    if (g.actualTotal > g.line) result = ouDir === "over" ? "WIN" : "LOSS";
    else if (g.actualTotal < g.line) result = ouDir === "under" ? "WIN" : "LOSS";
    else continue;

    if (result === "WIN") fullWins++;
    else fullLosses++;
  }
  const fullPct = (fullWins + fullLosses) > 0 ? (fullWins / (fullWins + fullLosses)) * 100 : 0;

  // Report
  console.log("\n═══ BACKTEST REGRESSION TEST ═══════════════════════════════");
  console.log(`  Model: Ridge λ=1000, features=[intercept, sumDE, sumOE, avgTempo]`);
  console.log(`  Beta: [${beta.map((b) => b.toFixed(4)).join(", ")}]`);
  console.log();
  console.log(`  100-game sample (2025):  ${samplePct.toFixed(1)}% (${wins}W-${losses}L)`);
  console.log(`  Full 2025 season:        ${fullPct.toFixed(1)}% (${fullWins}W-${fullLosses}L)`);
  console.log();

  // Check ranges
  let pass = true;

  if (fullPct < EXPECTED_2025_MIN || fullPct > EXPECTED_2025_MAX) {
    console.log(`  FAIL: 2025 accuracy ${fullPct.toFixed(1)}% outside expected range [${EXPECTED_2025_MIN}-${EXPECTED_2025_MAX}]`);
    pass = false;
  } else {
    console.log(`  OK: 2025 accuracy ${fullPct.toFixed(1)}% within expected range [${EXPECTED_2025_MIN}-${EXPECTED_2025_MAX}]`);
  }

  // Quick overall check across all seasons
  const seasons = [...new Set(enriched.map((g) => g.season))].sort();
  let totalW = 0, totalL = 0;
  for (const testSeason of seasons.slice(1)) {
    const trainData = enriched.filter((g) => g.season < testSeason);
    const testData = enriched.filter((g) => g.season === testSeason);
    if (trainData.length < 100 || testData.length === 0) continue;
    const b = ridge(trainData.map(features), trainData.map((g) => g.actualTotal), 1000);
    for (const g of testData) {
      const x = features(g);
      const predicted = x.reduce((s, v, j) => s + v * b[j], 0);
      const edge = predicted - g.line;
      if (Math.abs(edge) < 1.5) continue;
      const ouDir = edge > 0 ? "over" : "under";
      let result;
      if (g.actualTotal > g.line) result = ouDir === "over" ? "WIN" : "LOSS";
      else if (g.actualTotal < g.line) result = ouDir === "under" ? "WIN" : "LOSS";
      else continue;
      if (result === "WIN") totalW++;
      else totalL++;
    }
  }

  const overallPct = (totalW + totalL) > 0 ? (totalW / (totalW + totalL)) * 100 : 0;
  if (overallPct < EXPECTED_OVERALL_MIN || overallPct > EXPECTED_OVERALL_MAX) {
    console.log(`  FAIL: Overall accuracy ${overallPct.toFixed(1)}% outside expected range [${EXPECTED_OVERALL_MIN}-${EXPECTED_OVERALL_MAX}]`);
    pass = false;
  } else {
    console.log(`  OK: Overall accuracy ${overallPct.toFixed(1)}% within expected range [${EXPECTED_OVERALL_MIN}-${EXPECTED_OVERALL_MAX}]`);
  }

  console.log();
  console.log(`  Result: ${pass ? "PASS" : "FAIL"}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(2);
});
