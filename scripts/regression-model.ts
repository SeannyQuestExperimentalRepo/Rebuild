/**
 * NCAAMB Regression Model Calibration
 *
 * Reverse-engineers optimal stat weights from historical game results.
 * Runs OLS regression on KenPom features to find which combination
 * of advanced stats best predicts actual margins and totals.
 *
 * Compares three approaches:
 *   - Regression Model (data-optimized weights)
 *   - Current Pick Engine v6 (hand-tuned KenPom signals)
 *   - Vegas Line (market baseline)
 *
 * Walk-forward validation: train on earlier games, test on later games.
 *
 * Usage: npx tsx scripts/regression-model.ts [--season 2025]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Types ──────────────────────────────────────────────────────────────────

interface GameRow {
  id: number;
  gameDate: Date;
  season: number;
  homeScore: number | null;
  awayScore: number | null;
  scoreDifference: number | null;
  spread: number | null;
  overUnder: number | null;
  moneylineHome: number | null;
  moneylineAway: number | null;
  spreadResult: string | null;
  ouResult: string | null;
  isConferenceGame: boolean;
  isNeutralSite: boolean;
  isTournament: boolean;
  overtimes: number;
  homeAdjEM: number | null;
  awayAdjEM: number | null;
  homeAdjOE: number | null;
  awayAdjOE: number | null;
  homeAdjDE: number | null;
  awayAdjDE: number | null;
  homeAdjTempo: number | null;
  awayAdjTempo: number | null;
  homeKenpomRank: number | null;
  awayKenpomRank: number | null;
  fmHomePred: number | null;
  fmAwayPred: number | null;
  fmHomeWinProb: number | null;
  homeTeam: { name: string };
  awayTeam: { name: string };
}

interface ModelMetrics {
  rmse: number;
  mae: number;
  r2: number;
  record: { w: number; l: number; p: number };
  winPct: number;
  roi: number;
  highConf: { record: { w: number; l: number; p: number }; winPct: number; roi: number; n: number };
  medConf: { record: { w: number; l: number; p: number }; winPct: number; roi: number; n: number };
}

interface FoldResult {
  trainSize: number;
  testSize: number;
  trainRange: string;
  testRange: string;
  beta: number[];
  featureNames: string[];
  metrics: ModelMetrics;
  trainX: Matrix; // Filtered training features for importance computation
}

type Matrix = number[][];

// ─── Matrix Math (OLS) ─────────────────────────────────────────────────────

function transpose(A: Matrix): Matrix {
  const rows = A.length;
  const cols = A[0].length;
  const T: Matrix = Array.from({ length: cols }, () => new Array(rows));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      T[j][i] = A[i][j];
    }
  }
  return T;
}

function multiply(A: Matrix, B: Matrix): Matrix {
  const rows = A.length;
  const cols = B[0].length;
  const inner = B.length;
  const C: Matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < inner; k++) {
      const aik = A[i][k];
      for (let j = 0; j < cols; j++) {
        C[i][j] += aik * B[k][j];
      }
    }
  }
  return C;
}

/** Gauss-Jordan elimination for matrix inversion */
function invert(A: Matrix): Matrix | null {
  const n = A.length;
  // Build augmented matrix [A | I]
  const aug: Matrix = A.map((row, i) => {
    const extended = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) extended[j] = row[j];
    extended[n + i] = 1;
    return extended;
  });

  for (let col = 0; col < n; col++) {
    // Partial pivoting
    let maxRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > maxVal) {
        maxVal = Math.abs(aug[row][col]);
        maxRow = row;
      }
    }
    if (maxVal < 1e-12) return null; // Singular matrix

    if (maxRow !== col) {
      [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];
    }

    // Scale pivot row
    const pivot = aug[col][col];
    for (let j = 0; j < 2 * n; j++) aug[col][j] /= pivot;

    // Eliminate column in all other rows
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = aug[row][col];
      for (let j = 0; j < 2 * n; j++) {
        aug[row][j] -= factor * aug[col][j];
      }
    }
  }

  // Extract inverse from right half
  return aug.map((row) => row.slice(n));
}

/** OLS: beta = (X'X)^(-1) X'y */
function olsSolve(
  X: Matrix,
  y: number[],
): { beta: number[]; residuals: number[]; rss: number; tss: number } | null {
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtXinv = invert(XtX);
  if (!XtXinv) return null;

  const yMat = y.map((v) => [v]);
  const Xty = multiply(Xt, yMat);
  const betaMat = multiply(XtXinv, Xty);
  const beta = betaMat.map((row) => row[0]);

  // Compute residuals
  const yMean = y.reduce((s, v) => s + v, 0) / y.length;
  const residuals = y.map((yi, i) => {
    const pred = X[i].reduce((s, xij, j) => s + xij * beta[j], 0);
    return yi - pred;
  });

  const rss = residuals.reduce((s, r) => s + r * r, 0);
  const tss = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);

  return { beta, residuals, rss, tss };
}

/** Compute standard errors for OLS coefficients */
function computeStdErrors(X: Matrix, rss: number, n: number, p: number): number[] | null {
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtXinv = invert(XtX);
  if (!XtXinv) return null;

  const sigma2 = rss / (n - p);
  return XtXinv.map((row, i) => Math.sqrt(sigma2 * row[i]));
}

function predict(X: Matrix, beta: number[]): number[] {
  return X.map((row) => row.reduce((s, xij, j) => s + xij * beta[j], 0));
}

// ─── Feature Engineering ────────────────────────────────────────────────────

// NOTE: AdjEM = AdjOE - AdjDE exactly, so never include all three.
// Also: fm_available is ~1 for 96% of games, so it's collinear with intercept.
// Each model variant avoids multicollinearity.

// Model A: Decomposed efficiency (OE + DE separately, no market line)
const SPREAD_A_NAMES = [
  "intercept", "adjOE_diff", "adjDE_diff", "adjTempo_diff",
  "kenpomRank_diff", "isNeutralSite", "isConferenceGame", "isTournament", "fm_margin",
];

// Model B: Aggregate efficiency + market line
const SPREAD_B_NAMES = [
  "intercept", "adjEM_diff", "adjTempo_diff", "kenpomRank_diff",
  "spread", "isNeutralSite", "isConferenceGame", "isTournament", "fm_margin",
];

// Model C: Kitchen sink — decomposed + market
const SPREAD_C_NAMES = [
  "intercept", "adjOE_diff", "adjDE_diff", "adjTempo_diff",
  "kenpomRank_diff", "spread", "isNeutralSite", "isConferenceGame", "isTournament", "fm_margin",
];

function hasKenPom(g: GameRow): boolean {
  return (
    g.homeAdjEM != null && g.awayAdjEM != null &&
    g.homeAdjOE != null && g.awayAdjOE != null &&
    g.homeAdjDE != null && g.awayAdjDE != null &&
    g.homeAdjTempo != null && g.awayAdjTempo != null &&
    g.homeKenpomRank != null && g.awayKenpomRank != null
  );
}

function computeSpreadA(g: GameRow): number[] | null {
  if (!hasKenPom(g) || g.spread == null) return null;
  const fm = g.fmHomePred != null && g.fmAwayPred != null ? g.fmHomePred! - g.fmAwayPred! : 0;
  return [
    1, g.homeAdjOE! - g.awayAdjOE!, g.homeAdjDE! - g.awayAdjDE!,
    g.homeAdjTempo! - g.awayAdjTempo!, g.awayKenpomRank! - g.homeKenpomRank!,
    g.isNeutralSite ? 1 : 0, g.isConferenceGame ? 1 : 0, g.isTournament ? 1 : 0, fm,
  ];
}

function computeSpreadB(g: GameRow): number[] | null {
  if (!hasKenPom(g) || g.spread == null) return null;
  const fm = g.fmHomePred != null && g.fmAwayPred != null ? g.fmHomePred! - g.fmAwayPred! : 0;
  return [
    1, g.homeAdjEM! - g.awayAdjEM!, g.homeAdjTempo! - g.awayAdjTempo!,
    g.awayKenpomRank! - g.homeKenpomRank!, g.spread,
    g.isNeutralSite ? 1 : 0, g.isConferenceGame ? 1 : 0, g.isTournament ? 1 : 0, fm,
  ];
}

function computeSpreadC(g: GameRow): number[] | null {
  if (!hasKenPom(g) || g.spread == null) return null;
  const fm = g.fmHomePred != null && g.fmAwayPred != null ? g.fmHomePred! - g.fmAwayPred! : 0;
  return [
    1, g.homeAdjOE! - g.awayAdjOE!, g.homeAdjDE! - g.awayAdjDE!,
    g.homeAdjTempo! - g.awayAdjTempo!, g.awayKenpomRank! - g.homeKenpomRank!,
    g.spread, g.isNeutralSite ? 1 : 0, g.isConferenceGame ? 1 : 0, g.isTournament ? 1 : 0, fm,
  ];
}

// O/U Model A: Stats only (no market line, no interaction)
const OU_A_NAMES = [
  "intercept", "adjDE_sum", "adjOE_sum", "adjTempo_avg",
  "adjTempo_diff", "adjEM_abs_diff", "isConferenceGame", "isTournament", "fm_total",
];

// O/U Model B: Stats + market line
const OU_B_NAMES = [
  "intercept", "adjDE_sum", "adjOE_sum", "adjTempo_avg",
  "adjTempo_diff", "adjEM_abs_diff", "overUnder",
  "isConferenceGame", "isTournament", "fm_total",
];

// O/U Model C: Stats + market + interaction
const OU_C_NAMES = [
  "intercept", "adjDE_sum", "adjOE_sum", "adjTempo_avg",
  "adjTempo_diff", "overUnder", "isConferenceGame", "isTournament", "fm_total", "tempo_x_DE",
];

function hasOUData(g: GameRow): boolean {
  return (
    g.homeAdjOE != null && g.awayAdjOE != null &&
    g.homeAdjDE != null && g.awayAdjDE != null &&
    g.homeAdjTempo != null && g.awayAdjTempo != null &&
    g.homeAdjEM != null && g.awayAdjEM != null
  );
}

function computeOUA(g: GameRow): number[] | null {
  if (!hasOUData(g) || g.overUnder == null) return null;
  const fm = g.fmHomePred != null && g.fmAwayPred != null ? g.fmHomePred! + g.fmAwayPred! : 0;
  return [
    1, g.homeAdjDE! + g.awayAdjDE!, g.homeAdjOE! + g.awayAdjOE!,
    (g.homeAdjTempo! + g.awayAdjTempo!) / 2, Math.abs(g.homeAdjTempo! - g.awayAdjTempo!),
    Math.abs(g.homeAdjEM! - g.awayAdjEM!), g.isConferenceGame ? 1 : 0, g.isTournament ? 1 : 0, fm,
  ];
}

function computeOUB(g: GameRow): number[] | null {
  if (!hasOUData(g) || g.overUnder == null) return null;
  const fm = g.fmHomePred != null && g.fmAwayPred != null ? g.fmHomePred! + g.fmAwayPred! : 0;
  return [
    1, g.homeAdjDE! + g.awayAdjDE!, g.homeAdjOE! + g.awayAdjOE!,
    (g.homeAdjTempo! + g.awayAdjTempo!) / 2, Math.abs(g.homeAdjTempo! - g.awayAdjTempo!),
    Math.abs(g.homeAdjEM! - g.awayAdjEM!), g.overUnder,
    g.isConferenceGame ? 1 : 0, g.isTournament ? 1 : 0, fm,
  ];
}

function computeOUC(g: GameRow): number[] | null {
  if (!hasOUData(g) || g.overUnder == null) return null;
  const fm = g.fmHomePred != null && g.fmAwayPred != null ? g.fmHomePred! + g.fmAwayPred! : 0;
  const tempoAvg = (g.homeAdjTempo! + g.awayAdjTempo!) / 2;
  const deSum = g.homeAdjDE! + g.awayAdjDE!;
  return [
    1, deSum, g.homeAdjOE! + g.awayAdjOE!, tempoAvg,
    Math.abs(g.homeAdjTempo! - g.awayAdjTempo!), g.overUnder,
    g.isConferenceGame ? 1 : 0, g.isTournament ? 1 : 0, fm, tempoAvg * deSum / 1000,
  ];
}

// ─── Current Engine v6 Simulator ────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

/** Replicate v6 KenPom spread prediction (AdjEM + HCA) */
function currentEngineSpreadPrediction(g: GameRow): number | null {
  if (g.homeAdjEM == null || g.awayAdjEM == null) return null;

  const gameMonth = g.gameDate.getMonth() + 1;
  let hca: number;
  if (g.isNeutralSite) {
    hca = 0;
  } else if (g.isConferenceGame) {
    hca = 2.5;
  } else if (gameMonth >= 11) {
    hca = 1.0; // Nov-Dec: MTE/exempt events
  } else if (gameMonth === 3 || gameMonth === 4) {
    hca = 0.5; // March: tournament/neutral
  } else {
    hca = 1.5; // Non-conference regular
  }

  return g.homeAdjEM - g.awayAdjEM + hca;
}

/** Replicate v6 KenPom O/U prediction (sumAdjDE thresholds → total estimate) */
function currentEngineOUPrediction(g: GameRow): number | null {
  if (
    g.homeAdjDE == null || g.awayAdjDE == null ||
    g.homeAdjOE == null || g.awayAdjOE == null ||
    g.homeAdjTempo == null || g.awayAdjTempo == null
  ) return null;

  // The current engine doesn't produce a point prediction for totals —
  // it classifies as over/under via thresholds. To compare RMSE fairly,
  // we estimate a total from efficiency × tempo:
  // possessions ≈ avgTempo * 0.94 (D1 pace factor)
  // total ≈ (OE_home + OE_away) / 100 * possessions
  const avgTempo = (g.homeAdjTempo + g.awayAdjTempo) / 2;
  const possessions = avgTempo * 0.94;
  const expectedTotal = (g.homeAdjOE + g.awayAdjOE) / 100 * possessions;

  return expectedTotal;
}

/** Replicate the current engine's O/U direction signal */
function currentEngineOUDirection(g: GameRow): "over" | "under" | "neutral" {
  if (g.homeAdjDE == null || g.awayAdjDE == null) return "neutral";

  const sumAdjDE = g.homeAdjDE + g.awayAdjDE;

  if (sumAdjDE > 215) return "over";
  if (sumAdjDE > 210) return "neutral";
  return "under"; // sumAdjDE <= 210
}

// ─── Metrics ────────────────────────────────────────────────────────────────

function computeMetrics(
  predictions: number[],
  actuals: number[],
  lines: number[],
  type: "spread" | "ou",
): ModelMetrics {
  const n = predictions.length;
  const mean = actuals.reduce((s, v) => s + v, 0) / n;

  let sse = 0;
  let sae = 0;
  let tss = 0;
  const record = { w: 0, l: 0, p: 0 };
  const highConf = { w: 0, l: 0, p: 0 };
  const medConf = { w: 0, l: 0, p: 0 };
  let highN = 0;
  let medN = 0;

  for (let i = 0; i < n; i++) {
    const error = actuals[i] - predictions[i];
    sse += error * error;
    sae += Math.abs(error);
    tss += (actuals[i] - mean) ** 2;

    // ATS / O/U accuracy
    const edge = type === "spread"
      ? predictions[i] + lines[i]       // predictedMargin + spread → pick side
      : predictions[i] - lines[i];      // predictedTotal - overUnder → over/under

    const actual = type === "spread"
      ? actuals[i] + lines[i]           // actual margin + spread → did it cover?
      : actuals[i] - lines[i];          // actual total - overUnder → over or under?

    if (Math.abs(actual) < 0.001) {
      record.p++;
    } else if ((edge > 0 && actual > 0) || (edge < 0 && actual < 0)) {
      record.w++;
    } else if (Math.abs(edge) < 0.001) {
      // Model has no opinion (edge ≈ 0), skip
      record.p++;
    } else {
      record.l++;
    }

    // Confidence buckets based on edge magnitude
    const absEdge = Math.abs(edge);
    if (absEdge >= 5) {
      highN++;
      if (Math.abs(actual) < 0.001) highConf.p++;
      else if ((edge > 0 && actual > 0) || (edge < 0 && actual < 0)) highConf.w++;
      else highConf.l++;
    } else if (absEdge >= 2) {
      medN++;
      if (Math.abs(actual) < 0.001) medConf.p++;
      else if ((edge > 0 && actual > 0) || (edge < 0 && actual < 0)) medConf.w++;
      else medConf.l++;
    }
  }

  const calcROI = (r: { w: number; l: number; p: number }) => {
    const total = r.w + r.l;
    return total > 0 ? ((r.w * (100 / 110) - r.l) / total) * 100 : 0;
  };
  const calcPct = (r: { w: number; l: number }) => {
    const total = r.w + r.l;
    return total > 0 ? (r.w / total) * 100 : 0;
  };

  return {
    rmse: Math.sqrt(sse / n),
    mae: sae / n,
    r2: tss > 0 ? 1 - sse / tss : 0,
    record,
    winPct: calcPct(record),
    roi: calcROI(record),
    highConf: { record: highConf, winPct: calcPct(highConf), roi: calcROI(highConf), n: highN },
    medConf: { record: medConf, winPct: calcPct(medConf), roi: calcROI(medConf), n: medN },
  };
}

// ─── Walk-Forward Engine ────────────────────────────────────────────────────

function runModelVariant(
  trainGames: GameRow[],
  testGames: GameRow[],
  featureFn: (g: GameRow) => number[] | null,
  targetFn: (g: GameRow) => number | null,
  lineFn: (g: GameRow) => number | null,
  featureNames: string[],
  type: "spread" | "ou",
): FoldResult | null {
  // Build training data
  const trainX: Matrix = [];
  const trainY: number[] = [];
  for (const g of trainGames) {
    const features = featureFn(g);
    const target = targetFn(g);
    if (features && target != null) {
      trainX.push(features);
      trainY.push(target);
    }
  }

  if (trainX.length < 50) return null; // Not enough training data

  // Auto-drop zero-variance features (except intercept at index 0)
  // and near-perfectly correlated features (keep first, drop second)
  const nCols = trainX[0].length;
  const keepCols: number[] = [0]; // Always keep intercept
  const droppedNames: string[] = [];

  for (let j = 1; j < nCols; j++) {
    const col = trainX.map((r) => r[j]);
    const min = Math.min(...col);
    const max = Math.max(...col);
    if (max - min < 1e-10) {
      droppedNames.push(featureNames[j]);
      continue; // Skip zero-variance
    }

    // Check for near-perfect correlation with already-kept columns
    let collinear = false;
    for (const kj of keepCols) {
      if (kj === 0) continue; // Skip intercept
      const kCol = trainX.map((r) => r[kj]);
      const m1 = col.reduce((s, v) => s + v, 0) / col.length;
      const m2 = kCol.reduce((s, v) => s + v, 0) / kCol.length;
      let cov = 0, v1 = 0, v2 = 0;
      for (let i = 0; i < col.length; i++) {
        const d1 = col[i] - m1;
        const d2 = kCol[i] - m2;
        cov += d1 * d2;
        v1 += d1 * d1;
        v2 += d2 * d2;
      }
      const corr = v1 > 0 && v2 > 0 ? cov / Math.sqrt(v1 * v2) : 0;
      if (Math.abs(corr) > 0.998) {
        droppedNames.push(featureNames[j]);
        collinear = true;
        break;
      }
    }
    if (!collinear) keepCols.push(j);
  }

  if (droppedNames.length > 0) {
    console.log(`    Dropped: ${droppedNames.join(", ")}`);
  }

  // Filter to kept columns
  const filteredX = trainX.map((row) => keepCols.map((j) => row[j]));
  const filteredNames = keepCols.map((j) => featureNames[j]);

  // Solve OLS
  const result = olsSolve(filteredX, trainY);
  if (!result) {
    console.log("  ⚠ OLS failed (singular matrix) — dropping variant");
    return null;
  }

  // Build test data (using same filtered columns)
  const testX: Matrix = [];
  const testActuals: number[] = [];
  const testLines: number[] = [];
  for (const g of testGames) {
    const features = featureFn(g);
    const target = targetFn(g);
    const line = lineFn(g);
    if (features && target != null && line != null) {
      testX.push(keepCols.map((j) => features[j]));
      testActuals.push(target);
      testLines.push(line);
    }
  }

  if (testX.length < 20) return null;

  const predictions = predict(testX, result.beta);
  const metrics = computeMetrics(predictions, testActuals, testLines, type);

  const trainDates = trainGames.map((g) => g.gameDate);
  const testDates = testGames.map((g) => g.gameDate);

  return {
    trainSize: filteredX.length,
    testSize: testX.length,
    trainRange: `${fmtDate(trainDates[0])} → ${fmtDate(trainDates[trainDates.length - 1])}`,
    testRange: `${fmtDate(testDates[0])} → ${fmtDate(testDates[testDates.length - 1])}`,
    beta: result.beta,
    featureNames: filteredNames,
    metrics,
    trainX: filteredX,
  };
}

function runCurrentEngineOnTestSet(
  testGames: GameRow[],
  type: "spread" | "ou",
): ModelMetrics {
  const predictions: number[] = [];
  const actuals: number[] = [];
  const lines: number[] = [];

  for (const g of testGames) {
    if (type === "spread") {
      const pred = currentEngineSpreadPrediction(g);
      if (pred == null || g.scoreDifference == null || g.spread == null) continue;
      predictions.push(pred);
      actuals.push(g.scoreDifference);
      lines.push(g.spread);
    } else {
      const pred = currentEngineOUPrediction(g);
      if (pred == null || g.homeScore == null || g.awayScore == null || g.overUnder == null) continue;
      predictions.push(pred);
      actuals.push(g.homeScore + g.awayScore);
      lines.push(g.overUnder);
    }
  }

  return computeMetrics(predictions, actuals, lines, type);
}

function runVegasBaseline(
  testGames: GameRow[],
  type: "spread" | "ou",
): ModelMetrics {
  const predictions: number[] = [];
  const actuals: number[] = [];
  const lines: number[] = [];

  for (const g of testGames) {
    if (type === "spread") {
      if (g.spread == null || g.scoreDifference == null) continue;
      // Vegas "prediction" is -spread (e.g., spread=-7 means home favored by 7)
      predictions.push(-g.spread);
      actuals.push(g.scoreDifference);
      lines.push(g.spread);
    } else {
      if (g.overUnder == null || g.homeScore == null || g.awayScore == null) continue;
      predictions.push(g.overUnder);
      actuals.push(g.homeScore + g.awayScore);
      lines.push(g.overUnder);
    }
  }

  return computeMetrics(predictions, actuals, lines, type);
}

// ─── Output Formatting ──────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function pad(s: string, w: number): string {
  return s.padEnd(w);
}

function rpad(s: string, w: number): string {
  return s.padStart(w);
}

function printCoefficients(beta: number[], featureNames: string[], stdErrors?: number[]) {
  console.log(`  ${"Feature".padEnd(22)} ${"Beta".padStart(10)} ${"Std Err".padStart(10)} ${"T-stat".padStart(10)}`);
  console.log("  " + "─".repeat(55));
  for (let i = 0; i < beta.length; i++) {
    const b = beta[i].toFixed(4);
    const se = stdErrors ? stdErrors[i].toFixed(4) : "—";
    const t = stdErrors && stdErrors[i] > 0 ? (beta[i] / stdErrors[i]).toFixed(2) : "—";
    console.log(`  ${featureNames[i].padEnd(22)} ${b.padStart(10)} ${se.padStart(10)} ${t.padStart(10)}`);
  }
}

function printMetricsRow(label: string, m: ModelMetrics) {
  const rec = `${m.record.w}-${m.record.l}-${m.record.p}`;
  console.log(
    `  ${pad(label, 24)} ${rpad(m.rmse.toFixed(2), 8)} ${rpad(m.mae.toFixed(2), 8)} ` +
    `${rpad(m.r2.toFixed(4), 8)} ${rpad(rec, 12)} ${rpad(m.winPct.toFixed(1) + "%", 8)} ` +
    `${rpad((m.roi >= 0 ? "+" : "") + m.roi.toFixed(1) + "%", 8)}`,
  );
}

function printFeatureImportance(fold: FoldResult) {
  const importance: { name: string; value: number }[] = [];
  for (let j = 0; j < fold.featureNames.length; j++) {
    if (fold.featureNames[j] === "intercept") continue;
    const col = fold.trainX.map((row) => row[j]);
    const mean = col.reduce((s, v) => s + v, 0) / col.length;
    const stdDev = Math.sqrt(col.reduce((s, v) => s + (v - mean) ** 2, 0) / col.length);
    importance.push({
      name: fold.featureNames[j],
      value: Math.abs(fold.beta[j]) * stdDev,
    });
  }
  importance.sort((a, b) => b.value - a.value);
  for (const imp of importance) {
    const bar = "█".repeat(Math.round(imp.value / (importance[0]?.value || 1) * 20));
    console.log(`    ${imp.name.padEnd(20)} ${imp.value.toFixed(3).padStart(8)}  ${bar}`);
  }
}

function printConfidenceBreakdown(label: string, m: ModelMetrics) {
  const fmtBucket = (b: typeof m.highConf) => {
    const rec = `${b.record.w}-${b.record.l}-${b.record.p}`;
    return `${rec.padStart(10)} ${(b.winPct.toFixed(1) + "%").padStart(7)} ${((b.roi >= 0 ? "+" : "") + b.roi.toFixed(1) + "%").padStart(8)} (N=${b.n})`;
  };
  console.log(`  ${pad(label, 24)} High: ${fmtBucket(m.highConf)}  Med: ${fmtBucket(m.medConf)}`);
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const seasonArg = process.argv.find((a) => a.startsWith("--season="));
  const season = seasonArg ? parseInt(seasonArg.split("=")[1]) : 2025;

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  NCAAMB Regression Model Calibration");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // 1. Load data
  console.log(`Loading NCAAMBGame data (season ${season})...`);
  const allGames = await prisma.nCAAMBGame.findMany({
    where: {
      season,
      homeScore: { not: null },
      awayScore: { not: null },
      spread: { not: null },
    },
    orderBy: { gameDate: "asc" },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  }) as unknown as GameRow[];

  console.log(`  Total games with results + spread: ${allGames.length}`);

  // Count KenPom coverage
  const withKenpom = allGames.filter(
    (g) => g.homeAdjEM != null && g.awayAdjEM != null,
  );
  const withFanMatch = allGames.filter(
    (g) => g.fmHomePred != null && g.fmAwayPred != null,
  );
  const withOU = allGames.filter((g) => g.overUnder != null);

  console.log(`  With KenPom:   ${withKenpom.length} (${((withKenpom.length / allGames.length) * 100).toFixed(1)}%)`);
  console.log(`  With FanMatch: ${withFanMatch.length} (${((withFanMatch.length / allGames.length) * 100).toFixed(1)}%)`);
  console.log(`  With O/U line: ${withOU.length} (${((withOU.length / allGames.length) * 100).toFixed(1)}%)`);
  console.log();

  if (withKenpom.length < 200) {
    console.log("  ⚠ Not enough games with KenPom data. Exiting.");
    await prisma.$disconnect();
    return;
  }

  // 2. Walk-forward folds (multi-fold within season)
  // Split by month: Nov, Dec, Jan, Feb, Mar, Apr
  const gamesByMonth = new Map<number, GameRow[]>();
  for (const g of allGames) {
    const m = g.gameDate.getMonth() + 1;
    if (!gamesByMonth.has(m)) gamesByMonth.set(m, []);
    gamesByMonth.get(m)!.push(g);
  }

  const monthOrder = [11, 12, 1, 2, 3, 4];
  const monthNames: Record<number, string> = {
    11: "Nov", 12: "Dec", 1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr",
  };

  console.log("Games by month:");
  for (const m of monthOrder) {
    const count = gamesByMonth.get(m)?.length ?? 0;
    if (count > 0) console.log(`  ${monthNames[m]}: ${count} games`);
  }
  console.log();

  // Build 3 folds:
  // Fold 1: train Nov → test Dec
  // Fold 2: train Nov+Dec → test Jan
  // Fold 3: train Nov+Dec+Jan → test Feb-Apr
  const folds: { train: GameRow[]; test: GameRow[]; label: string }[] = [];

  const novGames = gamesByMonth.get(11) ?? [];
  const decGames = gamesByMonth.get(12) ?? [];
  const janGames = gamesByMonth.get(1) ?? [];
  const febGames = gamesByMonth.get(2) ?? [];
  const marGames = gamesByMonth.get(3) ?? [];
  const aprGames = gamesByMonth.get(4) ?? [];

  if (novGames.length > 0 && decGames.length > 0) {
    folds.push({ train: novGames, test: decGames, label: "Fold 1: Nov → Dec" });
  }
  if (novGames.length + decGames.length > 0 && janGames.length > 0) {
    folds.push({ train: [...novGames, ...decGames], test: janGames, label: "Fold 2: Nov-Dec → Jan" });
  }
  const lateSeason = [...febGames, ...marGames, ...aprGames];
  if (novGames.length + decGames.length + janGames.length > 0 && lateSeason.length > 0) {
    folds.push({ train: [...novGames, ...decGames, ...janGames], test: lateSeason, label: "Fold 3: Nov-Jan → Feb-Apr" });
  }

  console.log(`Walk-forward folds: ${folds.length}\n`);

  // ─── SPREAD MODEL ───────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  SPREAD MODEL — Predicting scoreDifference (home - away)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const spreadTarget = (g: GameRow) => g.scoreDifference;
  const spreadLine = (g: GameRow) => g.spread;

  // Run 3 model variants on the final fold (largest training set)
  const finalFold = folds[folds.length - 1];
  if (!finalFold) {
    console.log("  ⚠ Not enough folds to run. Exiting.");
    await prisma.$disconnect();
    return;
  }

  console.log(`Training set: ${finalFold.label}\n`);

  const variants = [
    { name: "Model A (OE+DE, no mkt)", fn: computeSpreadA, names: SPREAD_A_NAMES },
    { name: "Model B (AdjEM + mkt)", fn: computeSpreadB, names: SPREAD_B_NAMES },
    { name: "Model C (OE+DE + mkt)", fn: computeSpreadC, names: SPREAD_C_NAMES },
  ];

  const spreadResults: { name: string; fold: FoldResult }[] = [];

  for (const variant of variants) {
    const fold = runModelVariant(
      finalFold.train, finalFold.test,
      variant.fn, spreadTarget, spreadLine, variant.names, "spread",
    );
    if (fold) {
      spreadResults.push({ name: variant.name, fold });
    }
  }

  // Current engine & Vegas on same test set
  const engineSpreadMetrics = runCurrentEngineOnTestSet(finalFold.test, "spread");
  const vegasSpreadMetrics = runVegasBaseline(finalFold.test, "spread");

  // Print coefficients for best model
  if (spreadResults.length > 0) {
    const best = spreadResults.reduce((a, b) => a.fold.metrics.winPct > b.fold.metrics.winPct ? a : b);

    console.log(`Best Spread Variant: ${best.name}`);
    console.log(`  Train: ${best.fold.trainSize} games | Test: ${best.fold.testSize} games\n`);

    console.log("Regression Coefficients:");
    printCoefficients(best.fold.beta, best.fold.featureNames);
    console.log();
  }

  // Print comparison table
  console.log("Model Comparison (test set):");
  console.log(`  ${"Model".padEnd(24)} ${"RMSE".padStart(8)} ${"MAE".padStart(8)} ${"R²".padStart(8)} ${"Record".padStart(12)} ${"Win%".padStart(8)} ${"ROI".padStart(8)}`);
  console.log("  " + "─".repeat(75));

  for (const sr of spreadResults) {
    printMetricsRow(sr.name, sr.fold.metrics);
  }
  printMetricsRow("Current Engine v6", engineSpreadMetrics);
  printMetricsRow("Vegas Line", vegasSpreadMetrics);
  console.log();

  // Confidence breakdown
  console.log("ATS by Confidence (edge magnitude):");
  for (const sr of spreadResults) {
    printConfidenceBreakdown(sr.name, sr.fold.metrics);
  }
  printConfidenceBreakdown("Current Engine v6", engineSpreadMetrics);
  console.log();

  // Feature importance for all variants
  console.log("Feature Importance (|beta × std(feature)| — standardized coefficients):");
  for (const sr of spreadResults) {
    console.log(`\n  ${sr.name}:`);
    printFeatureImportance(sr.fold);
  }

  // ─── O/U MODEL ──────────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  O/U MODEL — Predicting homeScore + awayScore (total points)");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  const ouTarget = (g: GameRow) =>
    g.homeScore != null && g.awayScore != null ? g.homeScore + g.awayScore : null;
  const ouLine = (g: GameRow) => g.overUnder;

  const ouVariants = [
    { name: "Model A (stats only)", fn: computeOUA, names: OU_A_NAMES },
    { name: "Model B (stats+market)", fn: computeOUB, names: OU_B_NAMES },
    { name: "Model C (stats+mkt+int)", fn: computeOUC, names: OU_C_NAMES },
  ];

  const ouResults: { name: string; fold: FoldResult }[] = [];

  for (const variant of ouVariants) {
    const fold = runModelVariant(
      finalFold.train, finalFold.test,
      variant.fn, ouTarget, ouLine, variant.names, "ou",
    );
    if (fold) {
      ouResults.push({ name: variant.name, fold });
    }
  }

  const engineOUMetrics = runCurrentEngineOnTestSet(finalFold.test, "ou");
  const vegasOUMetrics = runVegasBaseline(finalFold.test, "ou");

  // Print coefficients for ALL O/U variants
  for (const or of ouResults) {
    console.log(`${or.name}:`);
    console.log(`  Train: ${or.fold.trainSize} games | Test: ${or.fold.testSize} games\n`);
    console.log("Regression Coefficients:");
    printCoefficients(or.fold.beta, or.fold.featureNames);
    console.log();
  }

  // O/U comparison table
  console.log("Model Comparison (test set):");
  console.log(`  ${"Model".padEnd(24)} ${"RMSE".padStart(8)} ${"MAE".padStart(8)} ${"R²".padStart(8)} ${"Record".padStart(12)} ${"Win%".padStart(8)} ${"ROI".padStart(8)}`);
  console.log("  " + "─".repeat(75));

  for (const or of ouResults) {
    printMetricsRow(or.name, or.fold.metrics);
  }
  printMetricsRow("Current Engine v6", engineOUMetrics);
  printMetricsRow("Vegas Line", vegasOUMetrics);
  console.log();

  // O/U Confidence breakdown
  console.log("O/U by Confidence:");
  for (const or of ouResults) {
    printConfidenceBreakdown(or.name, or.fold.metrics);
  }
  printConfidenceBreakdown("Current Engine v6", engineOUMetrics);
  console.log();

  // O/U Feature importance
  console.log("Feature Importance (|beta × std(feature)| — standardized coefficients):");
  for (const or of ouResults) {
    console.log(`\n  ${or.name}:`);
    printFeatureImportance(or.fold);
  }

  // ─── CROSS-FOLD STABILITY CHECK ──────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  CROSS-FOLD STABILITY — Do coefficients hold across time?");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Run best spread variant on all 3 folds
  const bestSpreadVariant = spreadResults.length > 0
    ? variants[spreadResults.indexOf(spreadResults.reduce((a, b) => a.fold.metrics.winPct > b.fold.metrics.winPct ? a : b))]
    : variants[1]; // Default to Model B

  console.log(`Spread (${bestSpreadVariant.name}):`);
  console.log(`  ${"Fold".padEnd(28)} ${"Train".padStart(6)} ${"Test".padStart(6)} ${"RMSE".padStart(8)} ${"ATS%".padStart(8)} ${"ROI".padStart(8)}`);
  console.log("  " + "─".repeat(65));

  for (const fold of folds) {
    const result = runModelVariant(
      fold.train, fold.test,
      bestSpreadVariant.fn, spreadTarget, spreadLine, bestSpreadVariant.names, "spread",
    );
    if (result) {
      console.log(
        `  ${pad(fold.label, 28)} ${rpad(String(result.trainSize), 6)} ${rpad(String(result.testSize), 6)} ` +
        `${rpad(result.metrics.rmse.toFixed(2), 8)} ${rpad(result.metrics.winPct.toFixed(1) + "%", 8)} ` +
        `${rpad((result.metrics.roi >= 0 ? "+" : "") + result.metrics.roi.toFixed(1) + "%", 8)}`,
      );
    }
  }

  // Run best O/U variant on all 3 folds
  const bestOUVariant = ouResults.length > 0
    ? ouVariants[ouResults.indexOf(ouResults.reduce((a, b) => a.fold.metrics.winPct > b.fold.metrics.winPct ? a : b))]
    : ouVariants[1];

  console.log(`\nO/U (${bestOUVariant.name}):`);
  console.log(`  ${"Fold".padEnd(28)} ${"Train".padStart(6)} ${"Test".padStart(6)} ${"RMSE".padStart(8)} ${"O/U%".padStart(8)} ${"ROI".padStart(8)}`);
  console.log("  " + "─".repeat(65));

  for (const fold of folds) {
    const result = runModelVariant(
      fold.train, fold.test,
      bestOUVariant.fn, ouTarget, ouLine, bestOUVariant.names, "ou",
    );
    if (result) {
      console.log(
        `  ${pad(fold.label, 28)} ${rpad(String(result.trainSize), 6)} ${rpad(String(result.testSize), 6)} ` +
        `${rpad(result.metrics.rmse.toFixed(2), 8)} ${rpad(result.metrics.winPct.toFixed(1) + "%", 8)} ` +
        `${rpad((result.metrics.roi >= 0 ? "+" : "") + result.metrics.roi.toFixed(1) + "%", 8)}`,
      );
    }
  }

  // ─── KEY FINDINGS ───────────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  KEY FINDINGS");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  if (spreadResults.length > 0) {
    const bestSpread = spreadResults.reduce((a, b) =>
      a.fold.metrics.winPct > b.fold.metrics.winPct ? a : b,
    );
    const spreadBeta = bestSpread.fold.beta;
    const spreadNames = bestSpread.fold.featureNames;

    const getCoeff = (name: string) => {
      const idx = spreadNames.indexOf(name);
      return idx >= 0 ? spreadBeta[idx] : null;
    };

    const spreadCoeff = getCoeff("spread");
    if (spreadCoeff != null) {
      const marketEfficiency = Math.abs(spreadCoeff) * 100;
      console.log(`  • Market spread coefficient: ${spreadCoeff.toFixed(4)} (market is ~${marketEfficiency.toFixed(0)}% efficient)`);
    }

    const interceptCoeff = getCoeff("intercept");
    if (interceptCoeff != null) {
      console.log(`  • Home court advantage (intercept): ${interceptCoeff.toFixed(2)} points`);
    }

    const emCoeff = getCoeff("adjEM_diff");
    if (emCoeff != null) {
      console.log(`  • AdjEM differential coefficient: ${emCoeff.toFixed(4)} (each AdjEM point → ${emCoeff.toFixed(2)} margin points)`);
    }

    const oeCoeff = getCoeff("adjOE_diff");
    const deCoeff = getCoeff("adjDE_diff");
    if (oeCoeff != null && deCoeff != null) {
      console.log(`  • Offense vs Defense: AdjOE_diff=${oeCoeff.toFixed(4)}, AdjDE_diff=${deCoeff.toFixed(4)}`);
      if (Math.abs(deCoeff) > Math.abs(oeCoeff)) {
        console.log("    → Defensive efficiency gap is MORE predictive than offensive (defense wins games)");
      } else {
        console.log("    → Offensive efficiency gap is MORE predictive than defensive");
      }
    }

    const fmCoeff = getCoeff("fm_margin");
    if (fmCoeff != null) {
      console.log(`  • FanMatch margin coefficient: ${fmCoeff.toFixed(4)} (${Math.abs(fmCoeff) > 0.1 ? "significant" : "weak"} predictor)`);
    }

    console.log();
    console.log(`  Regression best ATS: ${bestSpread.fold.metrics.winPct.toFixed(1)}% (ROI ${bestSpread.fold.metrics.roi >= 0 ? "+" : ""}${bestSpread.fold.metrics.roi.toFixed(1)}%)`);
    console.log(`  Current engine ATS:  ${engineSpreadMetrics.winPct.toFixed(1)}% (ROI ${engineSpreadMetrics.roi >= 0 ? "+" : ""}${engineSpreadMetrics.roi.toFixed(1)}%)`);
    console.log(`  Vegas baseline:      ${vegasSpreadMetrics.winPct.toFixed(1)}% (ROI ${vegasSpreadMetrics.roi >= 0 ? "+" : ""}${vegasSpreadMetrics.roi.toFixed(1)}%)`);
  }

  if (ouResults.length > 0) {
    const bestOU = ouResults.reduce((a, b) =>
      a.fold.metrics.winPct > b.fold.metrics.winPct ? a : b,
    );

    console.log();
    console.log(`  Regression best O/U: ${bestOU.fold.metrics.winPct.toFixed(1)}% (ROI ${bestOU.fold.metrics.roi >= 0 ? "+" : ""}${bestOU.fold.metrics.roi.toFixed(1)}%)`);
    console.log(`  Current engine O/U:  ${engineOUMetrics.winPct.toFixed(1)}% (ROI ${engineOUMetrics.roi >= 0 ? "+" : ""}${engineOUMetrics.roi.toFixed(1)}%)`);
    console.log(`  Vegas baseline:      ${vegasOUMetrics.winPct.toFixed(1)}% (ROI ${vegasOUMetrics.roi >= 0 ? "+" : ""}${vegasOUMetrics.roi.toFixed(1)}%)`);
  }

  console.log("\n═══════════════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  prisma.$disconnect();
  process.exit(1);
});
