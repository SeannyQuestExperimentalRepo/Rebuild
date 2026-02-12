/**
 * Pick Engine Model Health Report
 *
 * Quick diagnostic that checks:
 *   1. Live pick performance (DailyPick graded results by tier)
 *   2. O/U regression coefficient drift (deployed vs freshly-trained)
 *   3. Contextual override hit rates
 *   4. Actionable recommendations
 *
 * Usage: npx tsx scripts/backtest-report.ts [--season 2026]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Deployed v7 Coefficients ────────────────────────────────────────────────

const DEPLOYED_COEFFICIENTS = {
  intercept: -418.2117,
  sumAdjDE: 0.6390,
  sumAdjOE: 0.6115,
  avgTempo: 4.3646,
  tempoDiff: -0.0177,
  emAbsDiff: -0.0078,
  isConf: -1.4343,
  fmTotal: 0.0203,
};

const FEATURE_NAMES = [
  "intercept", "sumAdjDE", "sumAdjOE", "avgTempo",
  "tempoDiff", "emAbsDiff", "isConf", "fmTotal",
];

// ─── OLS Solver (minimal) ────────────────────────────────────────────────────

type Matrix = number[][];

function transpose(A: Matrix): Matrix {
  const rows = A.length, cols = A[0].length;
  const T: Matrix = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) T[j][i] = A[i][j];
  return T;
}

function multiply(A: Matrix, B: Matrix): Matrix {
  const rows = A.length, cols = B[0].length, inner = B.length;
  const C: Matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++)
    for (let k = 0; k < inner; k++) {
      const aik = A[i][k];
      for (let j = 0; j < cols; j++) C[i][j] += aik * B[k][j];
    }
  return C;
}

function invert(A: Matrix): Matrix | null {
  const n = A.length;
  const aug: Matrix = A.map((row, i) => {
    const ext = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) ext[j] = row[j];
    ext[n + i] = 1;
    return ext;
  });
  for (let col = 0; col < n; col++) {
    let maxRow = col, maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) { maxVal = Math.abs(aug[row][col]); maxRow = row; }
    }
    if (maxVal < 1e-12) return null;
    if (maxRow !== col) [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) aug[row][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

function olsSolve(X: Matrix, y: number[]): number[] | null {
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtXinv = invert(XtX);
  if (!XtXinv) return null;
  const Xty = multiply(Xt, y.map((v) => [v]));
  const beta = multiply(XtXinv, Xty);
  return beta.map((row) => row[0]);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtPct(n: number): string { return (n * 100).toFixed(1) + "%"; }
function fmtRoi(w: number, l: number): string {
  const d = w + l;
  return d > 0 ? ((((w * 100 / 110) - l) / d) * 100).toFixed(1) + "%" : "N/A";
}

interface WLP { w: number; l: number; p: number; }

function fmtRecord(r: WLP): string {
  const d = r.w + r.l;
  const pct = d > 0 ? ((r.w / d) * 100).toFixed(1) : "N/A";
  const roi = fmtRoi(r.w, r.l);
  return `${r.w}-${r.l}-${r.p}  (${pct}%, ROI: ${roi})`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const seasonIdx = args.indexOf("--season");
  const season = seasonIdx >= 0 ? parseInt(args[seasonIdx + 1]) : 2026;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PICK ENGINE v7 — MODEL HEALTH REPORT");
  console.log(`  Season: ${season}  |  Date: ${new Date().toISOString().slice(0, 10)}`);
  console.log("═══════════════════════════════════════════════════════════════\n");

  // ── Section 1: Live Pick Performance ──

  await reportLivePickPerformance(season);

  // ── Section 2: O/U Regression Validation ──

  await reportRegressionHealth(season);

  // ── Section 3: Contextual Override Hit Rates ──

  await reportContextualOverrides(season);

  // ── Section 4: Recommendations ──

  console.log("");

  await prisma.$disconnect();
}

// ─── Section 1: Live Pick Performance ────────────────────────────────────────

async function reportLivePickPerformance(season: number) {
  console.log("── LIVE PICK PERFORMANCE (DailyPick) ──────────────────────────\n");

  // Season date range: Nov of previous year to Apr of season year
  const startDate = new Date(`${season - 1}-11-01`);
  const endDate = new Date(`${season}-04-30`);

  const picks = await prisma.dailyPick.findMany({
    where: {
      sport: "NCAAMB",
      gameDate: { gte: startDate, lte: endDate },
      result: { not: "PENDING" },
    },
    select: {
      pickType: true,
      confidence: true,
      result: true,
      trendScore: true,
    },
  });

  if (picks.length === 0) {
    console.log("  No graded picks found for this season.\n");
    return;
  }

  const wlp = (arr: typeof picks): WLP => ({
    w: arr.filter(p => p.result === "WIN").length,
    l: arr.filter(p => p.result === "LOSS").length,
    p: arr.filter(p => p.result === "PUSH").length,
  });

  const spread = picks.filter(p => p.pickType === "SPREAD");
  const ou = picks.filter(p => p.pickType === "OVER_UNDER");
  const s4 = spread.filter(p => p.confidence === 4);
  const s5 = spread.filter(p => p.confidence === 5);
  const o4 = ou.filter(p => p.confidence === 4);
  const o5 = ou.filter(p => p.confidence === 5);

  const rows: [string, string][] = [
    ["SPREAD (all)", fmtRecord(wlp(spread))],
    ["  4★ SPREAD", fmtRecord(wlp(s4))],
    ["  5★ SPREAD", fmtRecord(wlp(s5))],
    ["", ""],
    ["O/U (all)", fmtRecord(wlp(ou))],
    ["  4★ O/U", fmtRecord(wlp(o4))],
    ["  5★ O/U", fmtRecord(wlp(o5))],
  ];

  for (const [label, value] of rows) {
    if (!label) { console.log(""); continue; }
    console.log(`  ${label.padEnd(18)} ${value}`);
  }

  // Score distribution
  console.log("\n  Score Distribution (graded picks):");
  const buckets = [
    { label: "90-100", min: 90, max: 100 },
    { label: "85-89", min: 85, max: 89 },
    { label: "80-84", min: 80, max: 84 },
    { label: "75-79", min: 75, max: 79 },
    { label: "70-74", min: 70, max: 74 },
  ];
  for (const b of buckets) {
    const inBucket = picks.filter(p => p.trendScore >= b.min && p.trendScore <= b.max);
    if (inBucket.length === 0) continue;
    const r = wlp(inBucket);
    const d = r.w + r.l;
    const pct = d > 0 ? ((r.w / d) * 100).toFixed(1) : "N/A";
    console.log(`    ${b.label}: ${r.w}-${r.l}-${r.p} (${pct}%)`);
  }
  console.log("");
}

// ─── Section 2: Regression Coefficient Drift ─────────────────────────────────

async function reportRegressionHealth(season: number) {
  console.log("── O/U REGRESSION HEALTH ───────────────────────────────────────\n");

  // Load games with KenPom data
  const games = await prisma.nCAAMBGame.findMany({
    where: {
      season,
      homeScore: { not: null },
      awayScore: { not: null },
      overUnder: { not: null },
      homeAdjDE: { not: null },
      awayAdjDE: { not: null },
      homeAdjOE: { not: null },
      awayAdjOE: { not: null },
      homeAdjTempo: { not: null },
      awayAdjTempo: { not: null },
    },
    select: {
      homeScore: true,
      awayScore: true,
      overUnder: true,
      homeAdjDE: true,
      awayAdjDE: true,
      homeAdjOE: true,
      awayAdjOE: true,
      homeAdjTempo: true,
      awayAdjTempo: true,
      homeAdjEM: true,
      awayAdjEM: true,
      isConferenceGame: true,
      fmHomePred: true,
      fmAwayPred: true,
      ouResult: true,
      homeKenpomRank: true,
      awayKenpomRank: true,
      gameDate: true,
    },
    orderBy: { gameDate: "asc" },
  });

  if (games.length < 100) {
    console.log(`  Only ${games.length} games with KenPom data. Need 100+ for analysis.`);
    console.log(`  (Check if KenPom stats are being denormalized onto NCAAMBGame rows)\n`);

    // Still run deployed model predictions if we have any data
    if (games.length > 0) {
      runDeployedPredictions(games);
    }
    return;
  }

  console.log(`  Games with KenPom data: ${games.length}\n`);

  // Build feature matrix and target vector
  const X: Matrix = [];
  const y: number[] = [];

  for (const g of games) {
    const sumAdjDE = g.homeAdjDE! + g.awayAdjDE!;
    const sumAdjOE = g.homeAdjOE! + g.awayAdjOE!;
    const avgTempo = (g.homeAdjTempo! + g.awayAdjTempo!) / 2;
    const tempoDiff = Math.abs(g.homeAdjTempo! - g.awayAdjTempo!);
    const emAbsDiff = Math.abs((g.homeAdjEM ?? 0) - (g.awayAdjEM ?? 0));
    const isConf = g.isConferenceGame ? 1 : 0;
    const fmTotal = (g.fmHomePred != null && g.fmAwayPred != null)
      ? g.fmHomePred + g.fmAwayPred : 0;
    const actualTotal = g.homeScore! + g.awayScore!;

    X.push([1, sumAdjDE, sumAdjOE, avgTempo, tempoDiff, emAbsDiff, isConf, fmTotal]);
    y.push(actualTotal);
  }

  // Detect zero-variance columns (e.g. fmTotal all zeros) and drop them
  // Always keep column 0 (intercept) — it's constant by design
  const numCols = X[0].length;
  const activeColIndices: number[] = [0]; // always keep intercept
  const droppedCols: number[] = [];
  for (let col = 1; col < numCols; col++) {
    const vals = X.map(row => row[col]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) {
      droppedCols.push(col);
    } else {
      activeColIndices.push(col);
    }
  }

  let beta: (number | null)[] = new Array(numCols).fill(null);
  if (droppedCols.length > 0) {
    console.log(`  Note: Dropped ${droppedCols.length} zero-variance column(s): ${droppedCols.map(i => FEATURE_NAMES[i]).join(", ")}`);
    const Xreduced = X.map(row => activeColIndices.map(i => row[i]));
    const betaReduced = olsSolve(Xreduced, y);
    if (!betaReduced) {
      console.log("  ERROR: OLS solve failed (singular matrix)\n");
      runDeployedPredictions(games);
      return;
    }
    for (let i = 0; i < activeColIndices.length; i++) {
      beta[activeColIndices[i]] = betaReduced[i];
    }
  } else {
    const betaFull = olsSolve(X, y);
    if (!betaFull) {
      console.log("  ERROR: OLS solve failed (singular matrix)\n");
      runDeployedPredictions(games);
      return;
    }
    beta = betaFull;
  }

  // Compare coefficients
  console.log("\n  Deployed vs Retrained Coefficients:");
  console.log("  " + "Feature".padEnd(14) + "Deployed".padStart(12) + "Retrained".padStart(12) + "Drift".padStart(10));
  console.log("  " + "─".repeat(48));

  const deployedValues = Object.values(DEPLOYED_COEFFICIENTS);
  let maxDrift = 0;
  let driftWarnings: string[] = [];

  for (let i = 0; i < FEATURE_NAMES.length; i++) {
    const deployed = deployedValues[i];
    const retrained = beta[i];
    if (retrained === null) {
      console.log(`  ${FEATURE_NAMES[i].padEnd(14)} ${deployed.toFixed(4).padStart(12)} ${"(dropped)".padStart(12)} ${"N/A".padStart(9)}`);
      continue;
    }
    const drift = deployed !== 0
      ? Math.abs((retrained - deployed) / deployed) * 100
      : Math.abs(retrained) * 100;
    maxDrift = Math.max(maxDrift, drift);

    const driftStr = drift.toFixed(1) + "%";
    const flag = drift > 15 ? " ⚠" : "";
    if (drift > 15) {
      driftWarnings.push(`${FEATURE_NAMES[i]}: ${drift.toFixed(1)}% drift (${deployed.toFixed(4)} → ${retrained.toFixed(4)})`);
    }

    console.log(`  ${FEATURE_NAMES[i].padEnd(14)} ${deployed.toFixed(4).padStart(12)} ${retrained.toFixed(4).padStart(12)} ${driftStr.padStart(9)}${flag}`);
  }

  if (driftWarnings.length > 0) {
    console.log("\n  ⚠ COEFFICIENT DRIFT WARNINGS (>15%):");
    for (const w of driftWarnings) console.log(`    ${w}`);
    console.log("    → Consider retraining: npx tsx scripts/regression-model.ts --season " + season);
  } else {
    console.log("\n  ✓ All coefficients within 15% of deployed values");
  }

  // Run deployed model predictions and compare
  console.log("");
  runDeployedPredictions(games);
}

function runDeployedPredictions(games: Array<{
  homeAdjDE: number | null; awayAdjDE: number | null;
  homeAdjOE: number | null; awayAdjOE: number | null;
  homeAdjTempo: number | null; awayAdjTempo: number | null;
  homeAdjEM: number | null; awayAdjEM: number | null;
  isConferenceGame: boolean;
  fmHomePred: number | null; fmAwayPred: number | null;
  overUnder: number | null; ouResult: string | null;
  homeKenpomRank: number | null; awayKenpomRank: number | null;
  gameDate: Date;
  homeScore: number | null; awayScore: number | null;
}>) {
  console.log("  O/U Prediction by Edge Bucket (deployed coefficients):");
  console.log("  " + "Edge Bucket".padEnd(16) + "Record".padStart(14) + "Win%".padStart(8) + "ROI".padStart(9));
  console.log("  " + "─".repeat(47));

  const buckets = [
    { label: "≥10", min: 10, max: Infinity },
    { label: "7–9.9", min: 7, max: 10 },
    { label: "5–6.9", min: 5, max: 7 },
    { label: "3–4.9", min: 3, max: 5 },
    { label: "1.5–2.9", min: 1.5, max: 3 },
  ];

  let totalW = 0, totalL = 0, totalP = 0;

  for (const bucket of buckets) {
    let w = 0, l = 0, p = 0;
    for (const g of games) {
      if (!g.overUnder || !g.ouResult || !g.homeAdjDE || !g.awayAdjDE) continue;
      const pred = predictTotal(g);
      const edge = Math.abs(pred - g.overUnder);
      if (edge < bucket.min || edge >= bucket.max) continue;
      const dir = pred > g.overUnder ? "OVER" : "UNDER";
      if (dir === g.ouResult) w++;
      else if (g.ouResult === "PUSH") p++;
      else l++;
    }
    totalW += w; totalL += l; totalP += p;
    const d = w + l;
    const pct = d > 0 ? ((w / d) * 100).toFixed(1) : "N/A";
    const roi = fmtRoi(w, l);
    console.log(`  ${bucket.label.padEnd(16)} ${`${w}-${l}-${p}`.padStart(14)} ${pct.padStart(7)}% ${roi.padStart(8)}`);
  }

  const totalD = totalW + totalL;
  const totalPct = totalD > 0 ? ((totalW / totalD) * 100).toFixed(1) : "N/A";
  console.log("  " + "─".repeat(47));
  console.log(`  ${"Total (≥1.5)".padEnd(16)} ${`${totalW}-${totalL}-${totalP}`.padStart(14)} ${totalPct.padStart(7)}% ${fmtRoi(totalW, totalL).padStart(8)}`);
  console.log("");
}

function predictTotal(g: {
  homeAdjDE: number | null; awayAdjDE: number | null;
  homeAdjOE: number | null; awayAdjOE: number | null;
  homeAdjTempo: number | null; awayAdjTempo: number | null;
  homeAdjEM: number | null; awayAdjEM: number | null;
  isConferenceGame: boolean;
  fmHomePred: number | null; fmAwayPred: number | null;
}): number {
  const sumAdjDE = (g.homeAdjDE ?? 0) + (g.awayAdjDE ?? 0);
  const sumAdjOE = (g.homeAdjOE ?? 0) + (g.awayAdjOE ?? 0);
  const avgTempo = ((g.homeAdjTempo ?? 67) + (g.awayAdjTempo ?? 67)) / 2;
  const tempoDiff = Math.abs((g.homeAdjTempo ?? 67) - (g.awayAdjTempo ?? 67));
  const emAbsDiff = Math.abs((g.homeAdjEM ?? 0) - (g.awayAdjEM ?? 0));
  const isConf = g.isConferenceGame ? 1 : 0;
  const fmTotal = (g.fmHomePred != null && g.fmAwayPred != null)
    ? g.fmHomePred + g.fmAwayPred : 0;

  return DEPLOYED_COEFFICIENTS.intercept
    + DEPLOYED_COEFFICIENTS.sumAdjDE * sumAdjDE
    + DEPLOYED_COEFFICIENTS.sumAdjOE * sumAdjOE
    + DEPLOYED_COEFFICIENTS.avgTempo * avgTempo
    + DEPLOYED_COEFFICIENTS.tempoDiff * tempoDiff
    + DEPLOYED_COEFFICIENTS.emAbsDiff * emAbsDiff
    + DEPLOYED_COEFFICIENTS.isConf * isConf
    + DEPLOYED_COEFFICIENTS.fmTotal * fmTotal;
}

// ─── Section 3: Contextual Override Hit Rates ────────────────────────────────

async function reportContextualOverrides(season: number) {
  console.log("── CONTEXTUAL OVERRIDE VALIDATION ──────────────────────────────\n");

  const games = await prisma.nCAAMBGame.findMany({
    where: {
      season,
      homeScore: { not: null },
      overUnder: { not: null },
      homeKenpomRank: { not: null },
      awayKenpomRank: { not: null },
      ouResult: { not: null },
    },
    select: {
      homeKenpomRank: true,
      awayKenpomRank: true,
      overUnder: true,
      ouResult: true,
      isConferenceGame: true,
      gameDate: true,
      homeAdjDE: true,
      awayAdjDE: true,
    },
  });

  if (games.length === 0) {
    console.log("  No games with KenPom rankings found for this season.\n");
    return;
  }

  const powerConfs = ["BE", "B12", "B10", "SEC", "ACC", "P12"];

  // Override checks
  const overrides: Array<{
    name: string;
    expected: string;
    direction: "UNDER" | "OVER";
    filter: (g: typeof games[0]) => boolean;
  }> = [
    {
      name: "Both top-50",
      expected: "78%",
      direction: "UNDER",
      filter: g => (g.homeKenpomRank ?? 999) <= 50 && (g.awayKenpomRank ?? 999) <= 50,
    },
    {
      name: "High line ≥155",
      expected: "68-70%",
      direction: "UNDER",
      filter: g => (g.overUnder ?? 0) >= 155,
    },
    {
      name: "Low line <135",
      expected: "57%",
      direction: "OVER",
      filter: g => (g.overUnder ?? 999) < 135,
    },
    {
      name: "March games",
      expected: "57%",
      direction: "UNDER",
      filter: g => (g.gameDate.getMonth() + 1) === 3,
    },
    {
      name: "Both 200+",
      expected: "69%",
      direction: "OVER",
      filter: g => (g.homeKenpomRank ?? 0) > 200 && (g.awayKenpomRank ?? 0) > 200,
    },
  ];

  console.log("  " + "Override".padEnd(20) + "Record".padStart(12) + "Actual".padStart(10) + "Expected".padStart(10) + "Status".padStart(8));
  console.log("  " + "─".repeat(60));

  for (const ovr of overrides) {
    const matching = games.filter(ovr.filter);
    if (matching.length === 0) {
      console.log(`  ${ovr.name.padEnd(20)} ${"(no data)".padStart(12)}`);
      continue;
    }

    const hits = matching.filter(g => g.ouResult === ovr.direction).length;
    const total = matching.length;
    const pct = (hits / total * 100).toFixed(1);
    const record = `${hits}-${total - hits}`;
    const status = parseFloat(pct) >= 52.4 ? "✓" : "⚠";

    console.log(`  ${ovr.name.padEnd(20)} ${record.padStart(12)} ${(pct + "%").padStart(9)} ${ovr.expected.padStart(9)} ${status.padStart(7)}`);
  }

  console.log("");
}

// ─── Run ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
