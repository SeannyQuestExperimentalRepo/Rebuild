/**
 * Phase 3: Validation & Stress Testing
 *
 * Tests on top model: Ridge λ=1000 on 7 features (O/U) + EM-diff (Spread)
 *
 * 1. Walk-forward monthly validation (2025)
 * 2. Noise stability test (perturb features ±10%)
 * 3. Subgroup analysis (conference, line range, month, ranking gap)
 * 4. Drawdown analysis (simulate $100/game bankroll)
 * 5. Volume vs accuracy tradeoff (edge thresholds)
 * 6. Confidence interval calculation
 */

import { PrismaClient, type NCAAMBGame } from "@prisma/client";

const prisma = new PrismaClient();

function fitOLS(X: number[][], y: number[], lambda = 0) {
  const n = X.length;
  const p = X[0].length;
  const Xa = X.map((row) => [1, ...row]);
  const pp = p + 1;
  const XtX: number[][] = Array.from({ length: pp }, () => Array(pp).fill(0));
  for (let i = 0; i < pp; i++)
    for (let j = 0; j < pp; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += Xa[k][i] * Xa[k][j];
      XtX[i][j] = s;
    }
  for (let i = 1; i < pp; i++) XtX[i][i] += lambda;
  const Xty: number[] = Array(pp).fill(0);
  for (let i = 0; i < pp; i++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += Xa[k][i] * y[k];
    Xty[i] = s;
  }
  const aug = XtX.map((row, i) => [...row, Xty[i]]);
  for (let col = 0; col < pp; col++) {
    let maxR = col;
    for (let r = col + 1; r < pp; r++)
      if (Math.abs(aug[r][col]) > Math.abs(aug[maxR][col])) maxR = r;
    [aug[col], aug[maxR]] = [aug[maxR], aug[col]];
    const piv = aug[col][col];
    if (Math.abs(piv) < 1e-12) continue;
    for (let j = col; j <= pp; j++) aug[col][j] /= piv;
    for (let r = 0; r < pp; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      for (let j = col; j <= pp; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  const beta = aug.map((row) => row[pp]);
  return { intercept: beta[0], coefficients: beta.slice(1) };
}

const OU_FEATURES = ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "fmTotal"];

interface GameData {
  game: NCAAMBGame;
  totalScore: number;
  features: Record<string, number>;
}

function prepareGame(g: NCAAMBGame): GameData | null {
  if (
    g.homeScore == null || g.awayScore == null || g.overUnder == null || g.spread == null ||
    g.homeAdjOE == null || g.awayAdjOE == null || g.homeAdjDE == null || g.awayAdjDE == null ||
    g.homeAdjTempo == null || g.awayAdjTempo == null || g.homeAdjEM == null || g.awayAdjEM == null
  ) return null;

  return {
    game: g,
    totalScore: g.homeScore + g.awayScore,
    features: {
      sumAdjDE: g.homeAdjDE + g.awayAdjDE,
      sumAdjOE: g.homeAdjOE + g.awayAdjOE,
      avgTempo: (g.homeAdjTempo + g.awayAdjTempo) / 2,
      tempoDiff: Math.abs(g.homeAdjTempo - g.awayAdjTempo),
      emAbsDiff: Math.abs(g.homeAdjEM - g.awayAdjEM),
      isConf: g.isConferenceGame ? 1 : 0,
      fmTotal: (g.fmHomePred ?? 0) + (g.fmAwayPred ?? 0),
    },
  };
}

function wilsonCI(p: number, n: number, z = 1.96): [number, number] {
  const denom = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denom;
  const spread = (z / denom) * Math.sqrt((p * (1 - p)) / n + z * z / (4 * n * n));
  return [center - spread, center + spread];
}

async function main() {
  console.log("=== Phase 3: Validation & Stress Testing ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  const rawGames2025 = await prisma.nCAAMBGame.findMany({
    where: { season: 2025, homeScore: { not: null }, spread: { not: null }, homeAdjEM: { not: null } },
    orderBy: { gameDate: "asc" },
  });
  const rawGames2026 = await prisma.nCAAMBGame.findMany({
    where: { season: 2026, homeScore: { not: null }, spread: { not: null }, homeAdjEM: { not: null } },
    orderBy: { gameDate: "asc" },
  });

  const data2025 = rawGames2025.map(prepareGame).filter(Boolean) as GameData[];
  const data2026 = rawGames2026.map(prepareGame).filter(Boolean) as GameData[];

  // Train Ridge λ=1000 on full 2025
  const X_train = data2025.map((d) => OU_FEATURES.map((f) => d.features[f]));
  const y_train = data2025.map((d) => d.totalScore);
  const model = fitOLS(X_train, y_train, 1000);

  console.log("Model: Ridge λ=1000 on 7 features");
  console.log(`Intercept: ${model.intercept.toFixed(4)}`);
  for (let i = 0; i < OU_FEATURES.length; i++) {
    console.log(`  ${OU_FEATURES[i]}: ${model.coefficients[i].toFixed(6)}`);
  }

  // Helper: predict and evaluate
  function evaluateOU(data: GameData[], minEdge: number, perturbPct = 0) {
    let correct = 0, total = 0, units = 0;
    const picks: { correct: boolean; edge: number }[] = [];

    for (const d of data) {
      if (d.game.ouResult == null || d.game.ouResult === "PUSH" || d.game.overUnder == null) continue;

      const feats = OU_FEATURES.map((f) => {
        let val = d.features[f];
        if (perturbPct > 0) val *= 1 + (Math.random() * 2 - 1) * perturbPct;
        return val;
      });

      let pred = model.intercept;
      for (let i = 0; i < feats.length; i++) pred += model.coefficients[i] * feats[i];
      const edge = pred - d.game.overUnder;

      if (Math.abs(edge) < minEdge) continue;

      const pick = edge > 0 ? "OVER" : "UNDER";
      const isCorrect = pick === d.game.ouResult;
      if (isCorrect) { correct++; units += 1; }
      else units -= 1.1;
      total++;
      picks.push({ correct: isCorrect, edge: Math.abs(edge) });
    }

    return {
      correct,
      total,
      pct: total > 0 ? (correct / total) * 100 : 0,
      roi: total > 0 ? (units / total) * 100 : 0,
      picks,
    };
  }

  // ── Test 1: Walk-Forward Monthly (2025) ────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 1: WALK-FORWARD MONTHLY VALIDATION (2025)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const getMonth = (d: GameData) => d.game.gameDate.getMonth() + 1;

  console.log("Month | Train Size | Test Picks | Accuracy | ROI");
  console.log("──────|────────────|────────────|──────────|──────");

  let wfCorrect = 0, wfTotal = 0;
  for (const testMonth of [12, 1, 2, 3]) {
    const train = data2025.filter((d) => {
      const m = getMonth(d);
      if (testMonth <= 4) return m >= 11 || m < testMonth;
      return m >= 11 && m < testMonth;
    });
    const test = data2025.filter((d) => getMonth(d) === testMonth);
    if (train.length < 100) continue;

    const Xw = train.map((d) => OU_FEATURES.map((f) => d.features[f]));
    const yw = train.map((d) => d.totalScore);
    const wModel = fitOLS(Xw, yw, 1000);

    let correct = 0, total = 0, units = 0;
    for (const d of test) {
      if (d.game.ouResult == null || d.game.ouResult === "PUSH" || d.game.overUnder == null) continue;
      const feats = OU_FEATURES.map((f) => d.features[f]);
      let pred = wModel.intercept;
      for (let i = 0; i < feats.length; i++) pred += wModel.coefficients[i] * feats[i];
      const edge = pred - d.game.overUnder;
      if (Math.abs(edge) < 1.5) continue;
      const pick = edge > 0 ? "OVER" : "UNDER";
      if (pick === d.game.ouResult) { correct++; units += 1; }
      else units -= 1.1;
      total++;
    }
    wfCorrect += correct;
    wfTotal += total;
    const roi = total > 0 ? (units / total) * 100 : 0;
    console.log(
      `${monthNames[testMonth].padEnd(5)} | ${String(train.length).padStart(10)} | ${String(total).padStart(10)} | ${(total > 0 ? ((correct / total) * 100).toFixed(1) : "N/A").padStart(7)}% | ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`,
    );
  }
  console.log(
    `Total |            | ${String(wfTotal).padStart(10)} | ${((wfCorrect / wfTotal) * 100).toFixed(1).padStart(7)}% |`,
  );

  // ── Test 2: Noise Stability ────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 2: NOISE STABILITY (Ridge λ=1000)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const baseAcc = evaluateOU(data2026, 1.5).pct;
  console.log(`Baseline (no noise): ${baseAcc.toFixed(1)}%`);

  for (const pct of [0.05, 0.10, 0.15, 0.20]) {
    const trials = 20;
    let sumAcc = 0;
    for (let t = 0; t < trials; t++) {
      sumAcc += evaluateOU(data2026, 1.5, pct).pct;
    }
    const avgAcc = sumAcc / trials;
    const drop = baseAcc - avgAcc;
    console.log(
      `Noise ±${(pct * 100).toFixed(0)}%: ${avgAcc.toFixed(1)}% (Δ=${drop >= 0 ? "-" : "+"}${Math.abs(drop).toFixed(1)}pp) ${drop > 5 ? "⚠️ FRAGILE" : "✓ STABLE"}`,
    );
  }

  // ── Test 3: Subgroup Analysis ──────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 3: SUBGROUP ANALYSIS (2026 data)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const r2026 = evaluateOU(data2026, 1.5);

  // By month
  console.log("--- By Month ---");
  for (const month of [11, 12, 1, 2]) {
    const subset = data2026.filter((d) => getMonth(d) === month);
    const r = evaluateOU(subset, 1.5);
    console.log(`  ${monthNames[month]}: ${r.pct.toFixed(1)}% (${r.correct}/${r.total})`);
  }

  // By O/U line range
  console.log("\n--- By O/U Line Range ---");
  const lineRanges = [
    { label: "< 130", min: 0, max: 130 },
    { label: "130-140", min: 130, max: 140 },
    { label: "140-150", min: 140, max: 150 },
    { label: "150-155", min: 150, max: 155 },
    { label: ">= 155", min: 155, max: 999 },
  ];
  for (const range of lineRanges) {
    const subset = data2026.filter(
      (d) => d.game.overUnder! >= range.min && d.game.overUnder! < range.max,
    );
    const r = evaluateOU(subset, 1.5);
    if (r.total > 0) console.log(`  ${range.label.padEnd(8)}: ${r.pct.toFixed(1)}% (${r.correct}/${r.total})`);
  }

  // By KenPom ranking gap
  console.log("\n--- By Ranking Gap ---");
  const rankGaps = [
    { label: "Both top-25", filter: (d: GameData) => (d.game.homeKenpomRank ?? 999) <= 25 && (d.game.awayKenpomRank ?? 999) <= 25 },
    { label: "Both top-50", filter: (d: GameData) => (d.game.homeKenpomRank ?? 999) <= 50 && (d.game.awayKenpomRank ?? 999) <= 50 },
    { label: "Both top-100", filter: (d: GameData) => (d.game.homeKenpomRank ?? 999) <= 100 && (d.game.awayKenpomRank ?? 999) <= 100 },
    { label: "One top-50, one 100+", filter: (d: GameData) => {
      const r1 = d.game.homeKenpomRank ?? 999;
      const r2 = d.game.awayKenpomRank ?? 999;
      return (r1 <= 50 && r2 > 100) || (r2 <= 50 && r1 > 100);
    }},
    { label: "Both 200+", filter: (d: GameData) => (d.game.homeKenpomRank ?? 999) > 200 && (d.game.awayKenpomRank ?? 999) > 200 },
  ];
  for (const rg of rankGaps) {
    const subset = data2026.filter(rg.filter);
    const r = evaluateOU(subset, 1.5);
    if (r.total > 0) console.log(`  ${rg.label.padEnd(25)}: ${r.pct.toFixed(1)}% (${r.correct}/${r.total})`);
  }

  // Conference vs non-conference
  console.log("\n--- Conference vs Non-Conference ---");
  const confSubset = data2026.filter((d) => d.game.isConferenceGame);
  const nonConfSubset = data2026.filter((d) => !d.game.isConferenceGame);
  const rConf = evaluateOU(confSubset, 1.5);
  const rNonConf = evaluateOU(nonConfSubset, 1.5);
  console.log(`  Conference:     ${rConf.pct.toFixed(1)}% (${rConf.correct}/${rConf.total})`);
  console.log(`  Non-conference: ${rNonConf.pct.toFixed(1)}% (${rNonConf.correct}/${rNonConf.total})`);

  // ── Test 4: Drawdown Analysis ──────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 4: DRAWDOWN ANALYSIS");
  console.log("═══════════════════════════════════════════════════════════\n");

  // Simulate $100/game flat betting on 2025 data (in chronological order)
  for (const [label, data] of [["2025", data2025] as const, ["2026", data2026] as const]) {
    let bankroll = 0;
    let peak = 0;
    let maxDrawdown = 0;
    let currentStreak = 0;
    let maxLossStreak = 0;
    let maxWinStreak = 0;
    let currentWinStreak = 0;

    for (const d of data) {
      if (d.game.ouResult == null || d.game.ouResult === "PUSH" || d.game.overUnder == null) continue;
      const feats = OU_FEATURES.map((f) => d.features[f]);
      let pred = model.intercept;
      for (let i = 0; i < feats.length; i++) pred += model.coefficients[i] * feats[i];
      const edge = pred - d.game.overUnder;
      if (Math.abs(edge) < 1.5) continue;

      const pick = edge > 0 ? "OVER" : "UNDER";
      if (pick === d.game.ouResult) {
        bankroll += 100;
        currentStreak = 0;
        currentWinStreak++;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;
      } else {
        bankroll -= 110;
        currentStreak++;
        currentWinStreak = 0;
        if (currentStreak > maxLossStreak) maxLossStreak = currentStreak;
      }
      if (bankroll > peak) peak = bankroll;
      const drawdown = peak - bankroll;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    console.log(`Season ${label}:`);
    console.log(`  Final P/L: $${bankroll.toFixed(0)}`);
    console.log(`  Peak bankroll: $${peak.toFixed(0)}`);
    console.log(`  Max drawdown: $${maxDrawdown.toFixed(0)} (${peak > 0 ? ((maxDrawdown / peak) * 100).toFixed(1) : 0}% of peak)`);
    console.log(`  Max loss streak: ${maxLossStreak}`);
    console.log(`  Max win streak: ${maxWinStreak}`);
    console.log();
  }

  // ── Test 5: Volume vs Accuracy Tradeoff ────────────────────────────

  console.log("═══════════════════════════════════════════════════════════");
  console.log("TEST 5: VOLUME vs ACCURACY TRADEOFF");
  console.log("═══════════════════════════════════════════════════════════\n");

  console.log("Edge Threshold | 2025 Acc (n, ROI)           | 2026 Acc (n, ROI)           | Gap");
  console.log("───────────────|─────────────────────────────|─────────────────────────────|──────");

  for (const minEdge of [1.0, 1.5, 2.0, 3.0, 5.0, 7.0, 10.0]) {
    const r25 = evaluateOU(data2025, minEdge);
    const r26 = evaluateOU(data2026, minEdge);
    console.log(
      `>= ${String(minEdge).padEnd(4)}         | ${r25.pct.toFixed(1).padStart(5)}% (${String(r25.total).padStart(4)}, ${r25.roi >= 0 ? "+" : ""}${r25.roi.toFixed(1)}% ROI) | ${r26.pct.toFixed(1).padStart(5)}% (${String(r26.total).padStart(4)}, ${r26.roi >= 0 ? "+" : ""}${r26.roi.toFixed(1)}% ROI) | ${(r25.pct - r26.pct).toFixed(1).padStart(4)}pp`,
    );
  }

  // ── Test 6: Confidence Intervals ───────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("TEST 6: CONFIDENCE INTERVALS (95%)");
  console.log("═══════════════════════════════════════════════════════════\n");

  const r25 = evaluateOU(data2025, 1.5);
  const r26 = evaluateOU(data2026, 1.5);

  const ci25 = wilsonCI(r25.pct / 100, r25.total);
  const ci26 = wilsonCI(r26.pct / 100, r26.total);

  console.log(`2025: ${r25.pct.toFixed(1)}% [${(ci25[0] * 100).toFixed(1)}%, ${(ci25[1] * 100).toFixed(1)}%] (n=${r25.total})`);
  console.log(`2026: ${r26.pct.toFixed(1)}% [${(ci26[0] * 100).toFixed(1)}%, ${(ci26[1] * 100).toFixed(1)}%] (n=${r26.total})`);

  // Statistical significance: is 2026 accuracy > 50%?
  const z26 = (r26.pct / 100 - 0.5) / Math.sqrt(0.25 / r26.total);
  console.log(`\n2026 vs coin flip: z=${z26.toFixed(2)}, p=${z26 > 0 ? (1 - normalCDF(z26)).toFixed(6) : "N/A"}`);
  console.log(`2026 vs break-even (52.4%): z=${((r26.pct / 100 - 0.524) / Math.sqrt(0.524 * 0.476 / r26.total)).toFixed(2)}`);
}

function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
