/**
 * Phase 1: Diagnose v7 O/U model failures
 *
 * Tests:
 * 1. Coefficient stability (first-half vs second-half of 2025)
 * 2. Feature ablation (remove each feature, measure accuracy change)
 * 3. Edge calibration (does edge → accuracy relationship hold OOS?)
 * 4. Contextual override checks on 2026
 * 5. FanMatch impact analysis (with vs without fmTotal)
 */

import { PrismaClient, type NCAAMBGame } from "@prisma/client";

const prisma = new PrismaClient();

// ── OLS Regression (from v7) ───────────────────────────────────────────────

interface OLSFeatures {
  sumAdjDE: number;
  sumAdjOE: number;
  avgTempo: number;
  tempoDiff: number;
  emAbsDiff: number;
  isConf: number;
  fmTotal: number;
}

function extractFeatures(g: NCAAMBGame): OLSFeatures | null {
  if (
    g.homeAdjOE == null ||
    g.awayAdjOE == null ||
    g.homeAdjDE == null ||
    g.awayAdjDE == null ||
    g.homeAdjTempo == null ||
    g.awayAdjTempo == null ||
    g.homeAdjEM == null ||
    g.awayAdjEM == null
  ) {
    return null;
  }
  return {
    sumAdjDE: g.homeAdjDE + g.awayAdjDE,
    sumAdjOE: g.homeAdjOE + g.awayAdjOE,
    avgTempo: (g.homeAdjTempo + g.awayAdjTempo) / 2,
    tempoDiff: Math.abs(g.homeAdjTempo - g.awayAdjTempo),
    emAbsDiff: Math.abs(g.homeAdjEM - g.awayAdjEM),
    isConf: g.isConferenceGame ? 1 : 0,
    fmTotal: (g.fmHomePred ?? 0) + (g.fmAwayPred ?? 0),
  };
}

// Simple OLS via normal equations: β = (XᵀX)⁻¹Xᵀy
function fitOLS(
  X: number[][],
  y: number[],
): { coefficients: number[]; intercept: number } {
  const n = X.length;
  const p = X[0].length;

  // Add intercept column
  const Xa = X.map((row) => [1, ...row]);
  const pp = p + 1;

  // XᵀX
  const XtX: number[][] = Array.from({ length: pp }, () =>
    Array(pp).fill(0),
  );
  for (let i = 0; i < pp; i++) {
    for (let j = 0; j < pp; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += Xa[k][i] * Xa[k][j];
      }
      XtX[i][j] = sum;
    }
  }

  // Xᵀy
  const Xty: number[] = Array(pp).fill(0);
  for (let i = 0; i < pp; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += Xa[k][i] * y[k];
    }
    Xty[i] = sum;
  }

  // Solve via Gaussian elimination
  const augmented = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < pp; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < pp; row++) {
      if (Math.abs(augmented[row][col]) > Math.abs(augmented[maxRow][col])) {
        maxRow = row;
      }
    }
    [augmented[col], augmented[maxRow]] = [augmented[maxRow], augmented[col]];

    const pivot = augmented[col][col];
    if (Math.abs(pivot) < 1e-12) continue;

    for (let j = col; j <= pp; j++) {
      augmented[col][j] /= pivot;
    }
    for (let row = 0; row < pp; row++) {
      if (row === col) continue;
      const factor = augmented[row][col];
      for (let j = col; j <= pp; j++) {
        augmented[row][j] -= factor * augmented[col][j];
      }
    }
  }

  const beta = augmented.map((row) => row[pp]);
  return { intercept: beta[0], coefficients: beta.slice(1) };
}

const FEATURE_NAMES = [
  "sumAdjDE",
  "sumAdjOE",
  "avgTempo",
  "tempoDiff",
  "emAbsDiff",
  "isConf",
  "fmTotal",
];

function featuresToArray(
  f: OLSFeatures,
  exclude?: string,
): number[] {
  const arr: number[] = [];
  for (const name of FEATURE_NAMES) {
    if (name === exclude) continue;
    arr.push(f[name as keyof OLSFeatures]);
  }
  return arr;
}

function predict(
  features: OLSFeatures,
  model: { intercept: number; coefficients: number[] },
  exclude?: string,
): number {
  const arr = featuresToArray(features, exclude);
  let pred = model.intercept;
  for (let i = 0; i < arr.length; i++) {
    pred += model.coefficients[i] * arr[i];
  }
  return pred;
}

interface GameData {
  game: NCAAMBGame;
  features: OLSFeatures;
  totalScore: number;
}

function evaluateOUAccuracy(
  data: GameData[],
  model: { intercept: number; coefficients: number[] },
  minEdge: number = 1.5,
  exclude?: string,
): { correct: number; total: number; pct: number } {
  let correct = 0;
  let total = 0;
  for (const d of data) {
    if (d.game.overUnder == null || d.game.ouResult == null || d.game.ouResult === "PUSH") continue;
    const pred = predict(d.features, model, exclude);
    const edge = pred - d.game.overUnder;
    if (Math.abs(edge) < minEdge) continue;
    const pick = edge > 0 ? "OVER" : "UNDER";
    if (pick === d.game.ouResult) correct++;
    total++;
  }
  return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0 };
}

async function main() {
  console.log("=== Phase 1: v7 O/U Model Diagnostics ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  // Load data
  const games2025 = await prisma.nCAAMBGame.findMany({
    where: {
      season: 2025,
      homeScore: { not: null },
      spread: { not: null },
      overUnder: { not: null },
      homeAdjEM: { not: null },
    },
    orderBy: { gameDate: "asc" },
  });
  const games2026 = await prisma.nCAAMBGame.findMany({
    where: {
      season: 2026,
      homeScore: { not: null },
      spread: { not: null },
      overUnder: { not: null },
      homeAdjEM: { not: null },
    },
    orderBy: { gameDate: "asc" },
  });

  console.log(`2025 games (with KenPom + lines): ${games2025.length}`);
  console.log(`2026 games (with KenPom + lines): ${games2026.length}\n`);

  // Prepare data
  const data2025: GameData[] = [];
  const data2026: GameData[] = [];

  for (const g of games2025) {
    const f = extractFeatures(g);
    if (f) data2025.push({ game: g, features: f, totalScore: g.homeScore! + g.awayScore! });
  }
  for (const g of games2026) {
    const f = extractFeatures(g);
    if (f) data2026.push({ game: g, features: f, totalScore: g.homeScore! + g.awayScore! });
  }

  // ── Test 1: Coefficient Stability ─────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════");
  console.log("TEST 1: COEFFICIENT STABILITY");
  console.log("═══════════════════════════════════════════════════════════\n");

  const mid = Math.floor(data2025.length / 2);
  const firstHalf = data2025.slice(0, mid);
  const secondHalf = data2025.slice(mid);

  const X_first = firstHalf.map((d) => featuresToArray(d.features));
  const y_first = firstHalf.map((d) => d.totalScore);
  const X_second = secondHalf.map((d) => featuresToArray(d.features));
  const y_second = secondHalf.map((d) => d.totalScore);
  const X_all = data2025.map((d) => featuresToArray(d.features));
  const y_all = data2025.map((d) => d.totalScore);

  const model_first = fitOLS(X_first, y_first);
  const model_second = fitOLS(X_second, y_second);
  const model_all = fitOLS(X_all, y_all);

  console.log("Feature          | First Half | Second Half | Full 2025  | Shift (1st vs 2nd)");
  console.log("─────────────────|────────────|─────────────|────────────|───────────────────");
  console.log(
    `intercept        | ${model_first.intercept.toFixed(4).padStart(10)} | ${model_second.intercept.toFixed(4).padStart(11)} | ${model_all.intercept.toFixed(4).padStart(10)} | ${(model_second.intercept - model_first.intercept).toFixed(4).padStart(10)}`,
  );
  for (let i = 0; i < FEATURE_NAMES.length; i++) {
    const shift = model_second.coefficients[i] - model_first.coefficients[i];
    const pctShift =
      model_first.coefficients[i] !== 0
        ? ((shift / Math.abs(model_first.coefficients[i])) * 100).toFixed(1)
        : "N/A";
    console.log(
      `${FEATURE_NAMES[i].padEnd(16)} | ${model_first.coefficients[i].toFixed(4).padStart(10)} | ${model_second.coefficients[i].toFixed(4).padStart(11)} | ${model_all.coefficients[i].toFixed(4).padStart(10)} | ${shift.toFixed(4).padStart(10)} (${pctShift}%)`,
    );
  }

  // Cross-evaluate: train on first half, test on second half and vice versa
  const acc_1on2 = evaluateOUAccuracy(secondHalf, model_first);
  const acc_2on1 = evaluateOUAccuracy(firstHalf, model_second);
  const acc_full_2025 = evaluateOUAccuracy(data2025, model_all);
  const acc_full_2026 = evaluateOUAccuracy(data2026, model_all);

  console.log(`\nCross-validation accuracy (edge >= 1.5):`);
  console.log(`  Train 1st half → Test 2nd half: ${acc_1on2.pct.toFixed(1)}% (${acc_1on2.correct}/${acc_1on2.total})`);
  console.log(`  Train 2nd half → Test 1st half: ${acc_2on1.pct.toFixed(1)}% (${acc_2on1.correct}/${acc_2on1.total})`);
  console.log(`  Train full 2025 → Test 2025:    ${acc_full_2025.pct.toFixed(1)}% (${acc_full_2025.correct}/${acc_full_2025.total})`);
  console.log(`  Train full 2025 → Test 2026:    ${acc_full_2026.pct.toFixed(1)}% (${acc_full_2026.correct}/${acc_full_2026.total})`);

  // ── Test 2: Feature Ablation ──────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 2: FEATURE ABLATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("Removing each feature, retraining, measuring accuracy change:\n");
  console.log("Feature Removed  | 2025 Acc | 2026 Acc | Δ2025   | Δ2026   | Verdict");
  console.log("─────────────────|──────────|──────────|─────────|─────────|────────");

  const baseAcc2025 = acc_full_2025.pct;
  const baseAcc2026 = acc_full_2026.pct;

  for (const exclude of FEATURE_NAMES) {
    const names = FEATURE_NAMES.filter((n) => n !== exclude);
    const Xr = data2025.map((d) => featuresToArray(d.features, exclude));
    const yr = data2025.map((d) => d.totalScore);
    const modelR = fitOLS(Xr, yr);

    const acc25 = evaluateOUAccuracy(data2025, modelR, 1.5, exclude);
    const acc26 = evaluateOUAccuracy(data2026, modelR, 1.5, exclude);

    const d25 = acc25.pct - baseAcc2025;
    const d26 = acc26.pct - baseAcc2026;
    let verdict = "";
    if (d26 > 0.5) verdict = "REMOVE (improves OOS)";
    else if (d26 < -1.0) verdict = "KEEP (hurts OOS)";
    else verdict = "NOISE (minimal impact)";

    console.log(
      `${exclude.padEnd(16)} | ${acc25.pct.toFixed(1).padStart(7)}% | ${acc26.pct.toFixed(1).padStart(7)}% | ${(d25 >= 0 ? "+" : "") + d25.toFixed(1).padStart(5)}pp | ${(d26 >= 0 ? "+" : "") + d26.toFixed(1).padStart(5)}pp | ${verdict}`,
    );
  }

  // ── Test 3: Edge Calibration ──────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 3: EDGE CALIBRATION");
  console.log("═══════════════════════════════════════════════════════════\n");

  const buckets = [
    { label: "1.5-2.9", min: 1.5, max: 3.0 },
    { label: "3.0-4.9", min: 3.0, max: 5.0 },
    { label: "5.0-6.9", min: 5.0, max: 7.0 },
    { label: "7.0-9.9", min: 7.0, max: 10.0 },
    { label: "10.0+", min: 10.0, max: 999 },
  ];

  console.log("Edge Bucket | 2025 Record    | 2025 Acc | 2026 Record    | 2026 Acc | Calibrated?");
  console.log("────────────|────────────────|──────────|────────────────|──────────|───────────");

  for (const bucket of buckets) {
    const evaluate = (data: GameData[]) => {
      let correct = 0;
      let total = 0;
      for (const d of data) {
        if (d.game.overUnder == null || d.game.ouResult == null || d.game.ouResult === "PUSH") continue;
        const pred = predict(d.features, model_all);
        const edge = Math.abs(pred - d.game.overUnder);
        if (edge < bucket.min || edge >= bucket.max) continue;
        const pick = pred > d.game.overUnder ? "OVER" : "UNDER";
        if (pick === d.game.ouResult) correct++;
        total++;
      }
      return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0 };
    };

    const r25 = evaluate(data2025);
    const r26 = evaluate(data2026);
    const gap = Math.abs(r25.pct - r26.pct);
    const calibrated = gap < 10 ? "YES" : "NO (>" + gap.toFixed(0) + "pp gap)";

    console.log(
      `${bucket.label.padEnd(11)} | ${r25.correct}/${r25.total}`.padEnd(39) +
        ` | ${r25.pct.toFixed(1).padStart(7)}% | ${r26.correct}/${r26.total}`.padEnd(21) +
        ` | ${r26.pct.toFixed(1).padStart(7)}% | ${calibrated}`,
    );
  }

  // ── Test 4: Contextual Override Checks on 2026 ────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 4: CONTEXTUAL OVERRIDE CHECKS (2026)");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Both top-50
  const bothTop50_2026 = data2026.filter(
    (d) =>
      d.game.homeKenpomRank != null &&
      d.game.awayKenpomRank != null &&
      d.game.homeKenpomRank <= 50 &&
      d.game.awayKenpomRank <= 50 &&
      d.game.ouResult != null &&
      d.game.ouResult !== "PUSH",
  );
  const bothTop50Under = bothTop50_2026.filter((d) => d.game.ouResult === "UNDER").length;
  console.log(
    `Both top-50 KenPom → UNDER: ${bothTop50Under}/${bothTop50_2026.length} (${((bothTop50Under / bothTop50_2026.length) * 100).toFixed(1)}%) [2025: 78.4%]`,
  );

  // High line >= 155
  const highLine2026 = data2026.filter(
    (d) =>
      d.game.overUnder != null &&
      d.game.overUnder >= 155 &&
      d.game.ouResult != null &&
      d.game.ouResult !== "PUSH",
  );
  const highLineUnder = highLine2026.filter((d) => d.game.ouResult === "UNDER").length;
  console.log(
    `High line >= 155 → UNDER: ${highLineUnder}/${highLine2026.length} (${highLine2026.length > 0 ? ((highLineUnder / highLine2026.length) * 100).toFixed(1) : "N/A"}%) [2025: 67.9%]`,
  );

  // Low line < 135
  const lowLine2026 = data2026.filter(
    (d) =>
      d.game.overUnder != null &&
      d.game.overUnder < 135 &&
      d.game.ouResult != null &&
      d.game.ouResult !== "PUSH",
  );
  const lowLineOver = lowLine2026.filter((d) => d.game.ouResult === "OVER").length;
  console.log(
    `Low line < 135 → OVER: ${lowLineOver}/${lowLine2026.length} (${lowLine2026.length > 0 ? ((lowLineOver / lowLine2026.length) * 100).toFixed(1) : "N/A"}%) [2025: 56.4%]`,
  );

  // March games (N/A for 2026 which only has Nov-Feb)
  const marchGames2026 = data2026.filter(
    (d) => d.game.gameDate.getMonth() === 2 && d.game.ouResult != null && d.game.ouResult !== "PUSH",
  );
  const marchUnder = marchGames2026.filter((d) => d.game.ouResult === "UNDER").length;
  console.log(
    `March games → UNDER: ${marchUnder}/${marchGames2026.length} (${marchGames2026.length > 0 ? ((marchUnder / marchGames2026.length) * 100).toFixed(1) : "N/A — no March data"}%)`,
  );

  // Conference games
  const confGames2026 = data2026.filter(
    (d) => d.game.isConferenceGame && d.game.ouResult != null && d.game.ouResult !== "PUSH",
  );
  const confUnder = confGames2026.filter((d) => d.game.ouResult === "UNDER").length;
  console.log(
    `Conference games → UNDER: ${confUnder}/${confGames2026.length} (${confGames2026.length > 0 ? ((confUnder / confGames2026.length) * 100).toFixed(1) : "N/A"}%)`,
  );

  // Both ranked 200+
  const both200Plus2026 = data2026.filter(
    (d) =>
      d.game.homeKenpomRank != null &&
      d.game.awayKenpomRank != null &&
      d.game.homeKenpomRank > 200 &&
      d.game.awayKenpomRank > 200 &&
      d.game.ouResult != null &&
      d.game.ouResult !== "PUSH",
  );
  const both200Over = both200Plus2026.filter((d) => d.game.ouResult === "OVER").length;
  console.log(
    `Both ranked 200+ → OVER: ${both200Over}/${both200Plus2026.length} (${both200Plus2026.length > 0 ? ((both200Over / both200Plus2026.length) * 100).toFixed(1) : "N/A"}%) [2025: 66.9%]`,
  );

  // ── Test 5: FanMatch Impact ───────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 5: FANMATCH IMPACT ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Model WITHOUT fmTotal
  const X_noFM = data2025.map((d) => featuresToArray(d.features, "fmTotal"));
  const model_noFM = fitOLS(X_noFM, y_all);

  const acc_noFM_2025 = evaluateOUAccuracy(data2025, model_noFM, 1.5, "fmTotal");
  const acc_noFM_2026 = evaluateOUAccuracy(data2026, model_noFM, 1.5, "fmTotal");

  console.log(`With fmTotal:    2025=${baseAcc2025.toFixed(1)}%, 2026=${baseAcc2026.toFixed(1)}%, gap=${(baseAcc2025 - baseAcc2026).toFixed(1)}pp`);
  console.log(`Without fmTotal: 2025=${acc_noFM_2025.pct.toFixed(1)}%, 2026=${acc_noFM_2026.pct.toFixed(1)}%, gap=${(acc_noFM_2025.pct - acc_noFM_2026.pct).toFixed(1)}pp`);
  console.log(`\nFanMatch on 2026: only ${data2026.filter((d) => d.features.fmTotal > 0).length}/${data2026.length} games have fmTotal > 0`);

  // ── Test 6: Residual Analysis ─────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 6: RESIDUAL ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Compute residuals for 2025 and 2026
  for (const [label, data] of [["2025", data2025] as const, ["2026", data2026] as const]) {
    const residuals: number[] = [];
    for (const d of data) {
      const pred = predict(d.features, model_all);
      residuals.push(d.totalScore - pred);
    }

    const mean = residuals.reduce((a, b) => a + b, 0) / residuals.length;
    const variance = residuals.reduce((a, b) => a + (b - mean) ** 2, 0) / residuals.length;
    const stdDev = Math.sqrt(variance);
    const median = [...residuals].sort((a, b) => a - b)[Math.floor(residuals.length / 2)];

    console.log(`Season ${label} residuals (actual - predicted):`);
    console.log(`  Mean: ${mean.toFixed(2)}, Median: ${median.toFixed(2)}, StdDev: ${stdDev.toFixed(2)}`);

    // Check bias: does model systematically predict too high or too low?
    const overPredict = residuals.filter((r) => r < 0).length;
    console.log(
      `  Over-predicts: ${overPredict}/${residuals.length} (${((overPredict / residuals.length) * 100).toFixed(1)}%)`,
    );

    // Residuals by month
    const monthResiduals = new Map<number, number[]>();
    for (const d of data) {
      const month = d.game.gameDate.getMonth() + 1;
      const pred = predict(d.features, model_all);
      const r = d.totalScore - pred;
      if (!monthResiduals.has(month)) monthResiduals.set(month, []);
      monthResiduals.get(month)!.push(r);
    }
    const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    for (const [month, rs] of [...monthResiduals.entries()].sort((a, b) => a[0] - b[0])) {
      const mMean = rs.reduce((a, b) => a + b, 0) / rs.length;
      console.log(`  ${monthNames[month]}: mean residual = ${mMean.toFixed(2)} (n=${rs.length})`);
    }
    console.log();
  }

  // ── Test 7: How much does the O/U line itself predict? ────────────────

  console.log("═══════════════════════════════════════════════════════════");
  console.log("TEST 7: VEGAS LINE AS PREDICTOR");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Simple test: how correlated is overUnder with totalScore?
  for (const [label, data] of [["2025", data2025] as const, ["2026", data2026] as const]) {
    const x = data.filter((d) => d.game.overUnder != null).map((d) => d.game.overUnder!);
    const y = data.filter((d) => d.game.overUnder != null).map((d) => d.totalScore);

    const n = x.length;
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;

    let sxy = 0,
      sxx = 0,
      syy = 0;
    for (let i = 0; i < n; i++) {
      sxy += (x[i] - mx) * (y[i] - my);
      sxx += (x[i] - mx) ** 2;
      syy += (y[i] - my) ** 2;
    }
    const r = sxy / Math.sqrt(sxx * syy);
    const r2 = r * r;

    // Simple model: predict totalScore = a + b * overUnder
    const b = sxy / sxx;
    const a = my - b * mx;

    console.log(`Season ${label}:`);
    console.log(`  Correlation(overUnder, totalScore): r=${r.toFixed(4)}, R²=${r2.toFixed(4)}`);
    console.log(`  Simple regression: total = ${a.toFixed(2)} + ${b.toFixed(4)} * overUnder`);

    // How much does our OLS model improve over just using overUnder?
    const ssResOLS = data
      .filter((d) => d.game.overUnder != null)
      .reduce((s, d) => {
        const pred = predict(d.features, model_all);
        return s + (d.totalScore - pred) ** 2;
      }, 0);
    const ssResVegas = data
      .filter((d) => d.game.overUnder != null)
      .reduce((s, d) => {
        const pred = a + b * d.game.overUnder!;
        return s + (d.totalScore - pred) ** 2;
      }, 0);

    const rmseOLS = Math.sqrt(ssResOLS / n);
    const rmseVegas = Math.sqrt(ssResVegas / n);

    console.log(`  RMSE (OLS model): ${rmseOLS.toFixed(2)}`);
    console.log(`  RMSE (Vegas line only): ${rmseVegas.toFixed(2)}`);
    console.log(`  OLS improvement: ${((1 - rmseOLS / rmseVegas) * 100).toFixed(1)}%\n`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
