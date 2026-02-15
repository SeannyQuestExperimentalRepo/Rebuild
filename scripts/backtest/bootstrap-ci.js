/**
 * BOOTSTRAP CONFIDENCE INTERVALS — Walk-forward PIT backtest with CIs.
 *
 * Runs the same honest PIT backtest as honest-backtest.js, then calculates
 * 95% bootstrap confidence intervals for:
 *   - Overall accuracy
 *   - Each tier (5★, 4★, 3★)
 *   - UNDER vs OVER direction
 *   - ROI at -110
 *
 * Usage:
 *   NODE_OPTIONS="--require ./scripts/register.cjs" npx tsx scripts/backtest/bootstrap-ci.js
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

// ─── Ridge regression ──────────────────────────────────────────────────────

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
  const avgTempo = (homeR.adjTempo + awayR.adjTempo) / 2;
  return {
    season: g.season,
    gameDate: g.gameDate,
    line: g.overUnder,
    actualTotal: g.homeScore + g.awayScore,
    sumDE: homeR.adjDE + awayR.adjDE,
    sumOE: homeR.adjOE + awayR.adjOE,
    avgTempo,
  };
}

// ─── Bootstrap helpers ─────────────────────────────────────────────────────

const NBOOT = 10000;
const BREAK_EVEN = 0.524; // At -110 odds

/**
 * Resample an array of 0/1 results (1=WIN), return bootstrap 95% CI.
 */
function bootstrapCI(results, nBoot = NBOOT) {
  const n = results.length;
  if (n === 0) return { mean: null, lo: null, hi: null, n: 0 };

  const means = new Float64Array(nBoot);
  for (let b = 0; b < nBoot; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += results[Math.floor(Math.random() * n)];
    }
    means[b] = sum / n;
  }
  means.sort();

  const mean = results.reduce((a, b) => a + b, 0) / n;
  const lo = means[Math.floor(nBoot * 0.025)];
  const hi = means[Math.floor(nBoot * 0.975)];
  return { mean, lo, hi, n };
}

/**
 * Calculate ROI at -110 for an array of 0/1 results.
 */
function calcROI(results) {
  const n = results.length;
  if (n === 0) return null;
  const wins = results.reduce((a, b) => a + b, 0);
  const losses = n - wins;
  // Win pays 100/110, loss pays -1
  const profit = wins * (100 / 110) - losses;
  return profit / n;
}

function bootstrapROI(results, nBoot = NBOOT) {
  const n = results.length;
  if (n === 0) return { mean: null, lo: null, hi: null, n: 0 };

  const rois = new Float64Array(nBoot);
  for (let b = 0; b < nBoot; b++) {
    let wins = 0;
    for (let i = 0; i < n; i++) {
      wins += results[Math.floor(Math.random() * n)];
    }
    const losses = n - wins;
    rois[b] = (wins * (100 / 110) - losses) / n;
  }
  rois.sort();

  return {
    mean: calcROI(results),
    lo: rois[Math.floor(nBoot * 0.025)],
    hi: rois[Math.floor(nBoot * 0.975)],
    n,
  };
}

// ─── Main ──────────────────────────────────────────────────────────────────

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
  console.log(`Loaded ${snapshots.length} snapshots across ${snapshotsByDate.size} dates\n`);

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
  console.log(`Loaded ${games.length} completed games with lines\n`);

  // Match games to PIT snapshots
  const enriched = [];
  let matched = 0, unmatched = 0, noSnapshot = 0;

  for (const g of games) {
    const gameDate = formatDate(g.gameDate);
    const prevDate = new Date(g.gameDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const snapshotDate = formatDate(prevDate);

    const dateSnapshots = snapshotsByDate.get(snapshotDate);
    if (!dateSnapshots) {
      const sameDaySnapshots = snapshotsByDate.get(gameDate);
      const twoDaysBefore = new Date(g.gameDate);
      twoDaysBefore.setDate(twoDaysBefore.getDate() - 2);
      const fallbackSnapshots = snapshotsByDate.get(formatDate(twoDaysBefore));
      const usable = sameDaySnapshots || fallbackSnapshots;
      if (!usable) { noSnapshot++; continue; }
      const homeR = lookupSnapshot(usable, g.homeTeam.name);
      const awayR = lookupSnapshot(usable, g.awayTeam.name);
      if (!homeR || !awayR) { unmatched++; continue; }
      enriched.push(buildRow(g, homeR, awayR));
      matched++;
      continue;
    }

    const homeR = lookupSnapshot(dateSnapshots, g.homeTeam.name);
    const awayR = lookupSnapshot(dateSnapshots, g.awayTeam.name);
    if (!homeR || !awayR) { unmatched++; continue; }
    enriched.push(buildRow(g, homeR, awayR));
    matched++;
  }

  console.log(`Matched: ${matched}, Unmatched: ${unmatched}, No snapshot: ${noSnapshot}\n`);

  // Walk-forward predictions
  const seasons = [...new Set(enriched.map((g) => g.season))].sort();
  const testSeasons = seasons.slice(1);

  // Collect ALL walk-forward predictions across all test seasons
  const allPreds = [];

  for (const testSeason of testSeasons) {
    const train = enriched.filter((g) => g.season < testSeason);
    const test = enriched.filter((g) => g.season === testSeason);
    if (train.length < 100 || test.length === 0) continue;

    const features = (g) => [1, g.sumDE, g.sumOE, g.avgTempo];
    const Xtrain = train.map(features);
    const ytrain = train.map((g) => g.actualTotal);
    const beta = ridge(Xtrain, ytrain, 1000);

    for (const g of test) {
      const x = features(g);
      const predicted = x.reduce((s, v, j) => s + v * beta[j], 0);
      const edge = predicted - g.line;
      const absEdge = Math.abs(edge);
      const ouDir = edge > 0 ? "over" : edge < 0 ? "under" : null;
      if (!ouDir) continue;

      let result;
      if (g.actualTotal > g.line) result = ouDir === "over" ? "WIN" : "LOSS";
      else if (g.actualTotal < g.line) result = ouDir === "under" ? "WIN" : "LOSS";
      else result = "PUSH";
      if (result === "PUSH") continue;

      // Classify tier (config #26)
      let tier = 0;
      if (ouDir === "under" && absEdge >= 12 && g.avgTempo <= 64) tier = 5;
      else if (ouDir === "under" && absEdge >= 10) tier = 4;
      else if (absEdge >= 9) tier = 3;

      allPreds.push({
        season: g.season,
        absEdge,
        ouDir,
        result,
        tier,
        isWin: result === "WIN" ? 1 : 0,
      });
    }
  }

  console.log(`Total walk-forward predictions: ${allPreds.length}\n`);

  // ─── Bootstrap CI by category ──────────────────────────────────────────────

  console.log("═".repeat(80));
  console.log("  BOOTSTRAP CONFIDENCE INTERVALS — 10,000 resamples, 95% CI");
  console.log("  Model: Ridge λ=1000, walk-forward PIT, config #26 tiers");
  console.log("═".repeat(80));
  console.log();

  // Overall (all edge levels, excl. pushes)
  const overallResults = allPreds.map((p) => p.isWin);
  printCI("Overall (all picks)", bootstrapCI(overallResults), bootstrapROI(overallResults));

  // By minimum edge thresholds
  for (const minEdge of [1, 3, 5, 7, 9, 10, 12, 15]) {
    const filtered = allPreds.filter((p) => p.absEdge >= minEdge);
    const results = filtered.map((p) => p.isWin);
    printCI(`Edge >= ${minEdge}`, bootstrapCI(results), bootstrapROI(results));
  }

  console.log();

  // By direction
  const underResults = allPreds.filter((p) => p.ouDir === "under").map((p) => p.isWin);
  const overResults = allPreds.filter((p) => p.ouDir === "over").map((p) => p.isWin);
  printCI("UNDER (all)", bootstrapCI(underResults), bootstrapROI(underResults));
  printCI("OVER (all)", bootstrapCI(overResults), bootstrapROI(overResults));

  console.log();

  // By tier (config #26)
  const tier5 = allPreds.filter((p) => p.tier === 5).map((p) => p.isWin);
  const tier4 = allPreds.filter((p) => p.tier === 4).map((p) => p.isWin);
  const tier3 = allPreds.filter((p) => p.tier === 3).map((p) => p.isWin);
  const anyTier = allPreds.filter((p) => p.tier >= 3).map((p) => p.isWin);
  printCI("5★ (UNDER, edge>=12, tempo<=64)", bootstrapCI(tier5), bootstrapROI(tier5));
  printCI("4★ (UNDER, edge>=10)", bootstrapCI(tier4), bootstrapROI(tier4));
  printCI("3★ (edge>=9)", bootstrapCI(tier3), bootstrapROI(tier3));
  printCI("Any tier (3★+)", bootstrapCI(anyTier), bootstrapROI(anyTier));

  console.log();

  // By season (to check consistency)
  console.log("── Per-Season CIs ──────────────────────────────────────────");
  for (const s of testSeasons) {
    const seasonPreds = allPreds.filter((p) => p.season === s);
    if (seasonPreds.length === 0) continue;
    const results = seasonPreds.map((p) => p.isWin);
    const ci = bootstrapCI(results);
    console.log(`  ${s}: ${(ci.mean * 100).toFixed(1)}% [${(ci.lo * 100).toFixed(1)}, ${(ci.hi * 100).toFixed(1)}] n=${ci.n}`);
  }

  console.log();

  // Break-even analysis
  console.log("── Break-Even Analysis (52.4% at -110) ─────────────────────");
  const categories = [
    { name: "Overall", data: overallResults },
    { name: "5★", data: tier5 },
    { name: "4★", data: tier4 },
    { name: "3★", data: tier3 },
    { name: "UNDER", data: underResults },
    { name: "OVER", data: overResults },
  ];
  for (const { name, data } of categories) {
    const ci = bootstrapCI(data);
    if (ci.lo === null) { console.log(`  ${name}: N/A (no data)`); continue; }
    const aboveBreakEven = ci.lo > BREAK_EVEN;
    console.log(`  ${name}: 95% CI lower = ${(ci.lo * 100).toFixed(1)}% — ${aboveBreakEven ? "PROFITABLE" : ci.mean > BREAK_EVEN ? "MARGINAL (CI includes break-even)" : "NOT PROFITABLE"}`);
  }

  console.log();
  await prisma.$disconnect();
}

function printCI(label, accCI, roiCI) {
  if (accCI.mean === null) {
    console.log(`  ${label}: N/A (no data)`);
    return;
  }
  const pct = (v) => (v * 100).toFixed(1) + "%";
  const roiStr = (v) => (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
  console.log(
    `  ${label.padEnd(38)} ${pct(accCI.mean).padStart(6)} [${pct(accCI.lo)}, ${pct(accCI.hi)}]  ROI: ${roiStr(roiCI.mean).padStart(7)} [${roiStr(roiCI.lo)}, ${roiStr(roiCI.hi)}]  n=${accCI.n}`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
