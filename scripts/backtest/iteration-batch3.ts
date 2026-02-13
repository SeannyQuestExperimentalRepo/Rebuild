/**
 * Iteration Batch 3 — Exploiting Discovered Edges
 *
 * Based on batch 2 discoveries:
 *   1. Edge asymmetry: UNDER predictions are far more accurate than OVER
 *   2. Subgroup routing: low-line, slow-tempo games are most predictable
 *   3. Rank gap >= 100 games have tighter gap
 *
 * Experiments:
 *   1. Direction-asymmetric edge thresholds (lower bar for UNDER, higher for OVER)
 *   2. UNDER-only strategies
 *   3. Subgroup routing: different models/thresholds per game type
 *   4. Meta-strategy: combine best subgroup filters
 *   5. Line-aware models (line as feature with asymmetric treatment)
 *   6. Separate OVER and UNDER models
 *   7. Cross-validated subgroup stability
 *   8. Kelly sizing with direction-aware calibration
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

interface GameRow {
  game: NCAAMBGame;
  totalScore: number;
  overUnder: number;
  ouResult: string;
  homeAdjDE: number; awayAdjDE: number;
  homeAdjOE: number; awayAdjOE: number;
  homeTempo: number; awayTempo: number;
  homeEM: number; awayEM: number;
  homeRank: number; awayRank: number;
  isConf: number; gameMonth: number;
}

function prepareGame(g: NCAAMBGame): GameRow | null {
  if (
    g.homeScore == null || g.awayScore == null ||
    g.overUnder == null || g.ouResult == null || g.ouResult === "PUSH" ||
    g.homeAdjOE == null || g.awayAdjOE == null ||
    g.homeAdjDE == null || g.awayAdjDE == null ||
    g.homeAdjTempo == null || g.awayAdjTempo == null ||
    g.homeAdjEM == null || g.awayAdjEM == null
  ) return null;
  return {
    game: g,
    totalScore: g.homeScore + g.awayScore,
    overUnder: g.overUnder,
    ouResult: g.ouResult,
    homeAdjDE: g.homeAdjDE, awayAdjDE: g.awayAdjDE,
    homeAdjOE: g.homeAdjOE, awayAdjOE: g.awayAdjOE,
    homeTempo: g.homeAdjTempo, awayTempo: g.awayAdjTempo,
    homeEM: g.homeAdjEM, awayEM: g.awayAdjEM,
    homeRank: g.homeKenpomRank ?? 200,
    awayRank: g.awayKenpomRank ?? 200,
    isConf: g.isConferenceGame ? 1 : 0,
    gameMonth: g.gameDate.getMonth() + 1,
  };
}

function getFeatures(g: GameRow): number[] {
  return [
    g.homeAdjDE + g.awayAdjDE,
    g.homeAdjOE + g.awayAdjOE,
    (g.homeTempo + g.awayTempo) / 2,
    Math.abs(g.homeTempo - g.awayTempo),
    Math.abs(g.homeEM - g.awayEM),
    g.isConf,
  ];
}

function predict(model: { intercept: number; coefficients: number[] }, feats: number[]): number {
  let pred = model.intercept;
  for (let i = 0; i < feats.length; i++) pred += model.coefficients[i] * feats[i];
  return pred;
}

function grade(acc2026: number, gap: number, roi2026: number, n2026: number): number {
  if (acc2026 < 55 || gap > 8 || n2026 < 100) return 0;
  const accScore = Math.min(100, Math.max(0, (acc2026 - 55) / 15 * 100));
  const gapScore = Math.min(100, Math.max(0, (8 - gap) / 8 * 100));
  const roiScore = Math.min(100, Math.max(0, roi2026 / 40 * 100));
  const volScore = Math.min(100, Math.max(0, (n2026 - 200) / 1200 * 100));
  return 0.40 * accScore + 0.25 * gapScore + 0.20 * roiScore + 0.15 * volScore;
}

interface ExperimentResult {
  name: string;
  category: string;
  acc2025: number; acc2026: number; gap: number;
  n2025: number; n2026: number;
  roi2025: number; roi2026: number;
  grade: number;
}

async function main() {
  console.log("=== Iteration Batch 3 — Exploiting Discovered Edges ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  const rawGames = await prisma.nCAAMBGame.findMany({
    where: { homeScore: { not: null }, overUnder: { not: null }, homeAdjEM: { not: null } },
    orderBy: { gameDate: "asc" },
  });

  const allGames = rawGames.map(prepareGame).filter(Boolean) as GameRow[];
  const data2025 = allGames.filter((g) => g.game.season === 2025);
  const data2026 = allGames.filter((g) => g.game.season === 2026);

  console.log(`Games: 2025=${data2025.length}, 2026=${data2026.length}\n`);

  const results: ExperimentResult[] = [];

  // Train base model
  const X6 = data2025.map(getFeatures);
  const y6 = data2025.map((d) => d.totalScore);
  const baseModel = fitOLS(X6, y6, 1000);

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENT 1: Direction-Asymmetric Edge Thresholds
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("═══ Experiment 1: Direction-Asymmetric Edge Thresholds ═══\n");

  // UNDER predictions are more reliable → lower threshold
  // OVER predictions are less reliable → higher threshold
  const asymConfigs = [
    { name: "Under=1.0 Over=3.0", underMin: 1.0, overMin: 3.0 },
    { name: "Under=1.0 Over=5.0", underMin: 1.0, overMin: 5.0 },
    { name: "Under=1.5 Over=3.0", underMin: 1.5, overMin: 3.0 },
    { name: "Under=1.5 Over=5.0", underMin: 1.5, overMin: 5.0 },
    { name: "Under=1.5 Over=7.0", underMin: 1.5, overMin: 7.0 },
    { name: "Under=2.0 Over=3.0", underMin: 2.0, overMin: 3.0 },
    { name: "Under=2.0 Over=5.0", underMin: 2.0, overMin: 5.0 },
    { name: "Under=2.0 Over=7.0", underMin: 2.0, overMin: 7.0 },
    { name: "Under=3.0 Over=5.0", underMin: 3.0, overMin: 5.0 },
    { name: "Under=3.0 Over=7.0", underMin: 3.0, overMin: 7.0 },
    { name: "Under=1.0 Over=1.0 (sym)", underMin: 1.0, overMin: 1.0 },
    { name: "Under=1.5 Over=1.5 (v8)", underMin: 1.5, overMin: 1.5 },
    // Reverse asymmetry (control — should be worse)
    { name: "Under=5.0 Over=1.5 (rev)", underMin: 5.0, overMin: 1.5 },
    { name: "Under=7.0 Over=1.5 (rev)", underMin: 7.0, overMin: 1.5 },
    // UNDER-only
    { name: "UNDER only e>=1.0", underMin: 1.0, overMin: 999 },
    { name: "UNDER only e>=1.5", underMin: 1.5, overMin: 999 },
    { name: "UNDER only e>=2.0", underMin: 2.0, overMin: 999 },
    { name: "UNDER only e>=3.0", underMin: 3.0, overMin: 999 },
    { name: "UNDER only e>=5.0", underMin: 5.0, overMin: 999 },
    // OVER-only (control)
    { name: "OVER only e>=1.5", underMin: 999, overMin: 1.5 },
    { name: "OVER only e>=3.0", underMin: 999, overMin: 3.0 },
    { name: "OVER only e>=5.0", underMin: 999, overMin: 5.0 },
  ];

  for (const ac of asymConfigs) {
    for (const season of [2025, 2026]) {
      const data = season === 2025 ? data2025 : data2026;
      let correct = 0, total = 0, units = 0;
      let underPicks = 0, overPicks = 0, underCorrect = 0, overCorrect = 0;

      for (const d of data) {
        const feats = getFeatures(d);
        const pred = predict(baseModel, feats);
        const edge = pred - d.overUnder;

        let pick: "OVER" | "UNDER" | null = null;
        if (edge < 0 && Math.abs(edge) >= ac.underMin) {
          pick = "UNDER";
        } else if (edge > 0 && edge >= ac.overMin) {
          pick = "OVER";
        }
        if (!pick) continue;

        const isCorrect = pick === d.ouResult;
        if (pick === "UNDER") { underPicks++; if (isCorrect) underCorrect++; }
        else { overPicks++; if (isCorrect) overCorrect++; }

        if (isCorrect) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }

      const pct = total > 0 ? (correct / total) * 100 : 0;
      const roi = total > 0 ? (units / total) * 100 : 0;

      if (season === 2025) {
        (ac as any)._r25 = { pct, total, roi, underPicks, overPicks, underCorrect, overCorrect };
      } else {
        const r25 = (ac as any)._r25;
        const gap = r25.pct - pct;
        const g = grade(pct, gap, roi, total);
        results.push({ name: `Asym: ${ac.name}`, category: "asymmetric-edge", acc2025: r25.pct, acc2026: pct, gap, n2025: r25.total, n2026: total, roi2025: r25.roi, roi2026: roi, grade: g });

        const uPct = underPicks > 0 ? ((underCorrect / underPicks) * 100).toFixed(1) : "N/A";
        const oPct = overPicks > 0 ? ((overCorrect / overPicks) * 100).toFixed(1) : "N/A";
        console.log(`  ${ac.name.padEnd(30)} | 2026: ${pct.toFixed(1)}% (${total}) | U: ${uPct}% (${underPicks}) O: ${oPct}% (${overPicks}) | gap=${gap.toFixed(1)}pp | grade=${g.toFixed(1)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENT 2: Subgroup Routing — Best model per game type
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n═══ Experiment 2: Subgroup Routing Meta-Strategies ═══\n");

  // Define routing rules: which games to pick and with what threshold
  interface RoutingRule {
    name: string;
    routes: Array<{
      filter: (g: GameRow) => boolean;
      minEdge: number;
      label: string;
    }>;
  }

  const routingStrategies: RoutingRule[] = [
    {
      name: "Line-routed (< 140: e1, else e1.5)",
      routes: [
        { filter: (g) => g.overUnder < 140, minEdge: 1.0, label: "low-line" },
        { filter: (g) => g.overUnder >= 140, minEdge: 1.5, label: "other" },
      ],
    },
    {
      name: "Line-routed (< 140: e1, else e3)",
      routes: [
        { filter: (g) => g.overUnder < 140, minEdge: 1.0, label: "low-line" },
        { filter: (g) => g.overUnder >= 140, minEdge: 3.0, label: "other" },
      ],
    },
    {
      name: "Tempo-routed (slow: e1, fast: e3)",
      routes: [
        { filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66, minEdge: 1.0, label: "slow" },
        { filter: (g) => (g.homeTempo + g.awayTempo) / 2 > 66 && (g.homeTempo + g.awayTempo) / 2 <= 69, minEdge: 1.5, label: "normal" },
        { filter: (g) => (g.homeTempo + g.awayTempo) / 2 > 69, minEdge: 3.0, label: "fast" },
      ],
    },
    {
      name: "Rank-routed (mismatch: e1, close: e3)",
      routes: [
        { filter: (g) => Math.abs(g.homeRank - g.awayRank) >= 100, minEdge: 1.0, label: "mismatch" },
        { filter: (g) => Math.abs(g.homeRank - g.awayRank) < 100, minEdge: 3.0, label: "close" },
      ],
    },
    {
      name: "Combined (slow+low: e0.5, else e2)",
      routes: [
        { filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 || g.overUnder < 140, minEdge: 0.5, label: "easy" },
        { filter: (g) => !((g.homeTempo + g.awayTempo) / 2 <= 66 || g.overUnder < 140), minEdge: 2.0, label: "hard" },
      ],
    },
    {
      name: "Combined (slow+low: e1, else e3)",
      routes: [
        { filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 || g.overUnder < 140, minEdge: 1.0, label: "easy" },
        { filter: (g) => !((g.homeTempo + g.awayTempo) / 2 <= 66 || g.overUnder < 140), minEdge: 3.0, label: "hard" },
      ],
    },
    {
      name: "Direction+rank (U: mismatch e1, else e2)",
      routes: [
        { filter: (_g) => true, minEdge: 0, label: "all" }, // handled specially
      ],
    },
    {
      name: "3-tier line (<135: e1, 135-155: e2, 155+: e3)",
      routes: [
        { filter: (g) => g.overUnder < 135, minEdge: 1.0, label: "low" },
        { filter: (g) => g.overUnder >= 135 && g.overUnder < 155, minEdge: 2.0, label: "mid" },
        { filter: (g) => g.overUnder >= 155, minEdge: 3.0, label: "high" },
      ],
    },
  ];

  for (const rs of routingStrategies) {
    for (const season of [2025, 2026]) {
      const data = season === 2025 ? data2025 : data2026;
      let correct = 0, total = 0, units = 0;

      for (const d of data) {
        const feats = getFeatures(d);
        const pred = predict(baseModel, feats);
        const edge = pred - d.overUnder;

        // Special handling for direction+rank strategy
        if (rs.name.startsWith("Direction+rank")) {
          const isMismatch = Math.abs(d.homeRank - d.awayRank) >= 100;
          const isUnder = edge < 0;
          let minEdge: number;
          if (isUnder && isMismatch) minEdge = 1.0;
          else if (isUnder) minEdge = 1.5;
          else if (isMismatch) minEdge = 2.0;
          else minEdge = 3.0;

          if (Math.abs(edge) < minEdge) continue;
        } else {
          // Find matching route
          const route = rs.routes.find((r) => r.filter(d));
          if (!route || Math.abs(edge) < route.minEdge) continue;
        }

        const pick = edge > 0 ? "OVER" : "UNDER";
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }

      const pct = total > 0 ? (correct / total) * 100 : 0;
      const roi = total > 0 ? (units / total) * 100 : 0;

      if (season === 2025) {
        (rs as any)._r25 = { pct, total, roi };
      } else {
        const r25 = (rs as any)._r25;
        const gap = r25.pct - pct;
        const g = grade(pct, gap, roi, total);
        results.push({ name: `Route: ${rs.name}`, category: "subgroup-routing", acc2025: r25.pct, acc2026: pct, gap, n2025: r25.total, n2026: total, roi2025: r25.roi, roi2026: roi, grade: g });
        console.log(`  ${rs.name.padEnd(45)} | 2026: ${pct.toFixed(1)}% (${total}) | gap=${gap.toFixed(1)}pp | ROI=${roi >= 0 ? "+" : ""}${roi.toFixed(1)}% | grade=${g.toFixed(1)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENT 3: Separate OVER and UNDER models
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n═══ Experiment 3: Separate OVER/UNDER Models ═══\n");

  // Train on OVER-result games only, then on UNDER-result games only
  const overGames2025 = data2025.filter((d) => d.ouResult === "OVER");
  const underGames2025 = data2025.filter((d) => d.ouResult === "UNDER");

  console.log(`  Training split: OVER games=${overGames2025.length}, UNDER games=${underGames2025.length}`);

  // Train separate models
  const overModel = fitOLS(overGames2025.map(getFeatures), overGames2025.map((d) => d.totalScore), 1000);
  const underModel = fitOLS(underGames2025.map(getFeatures), underGames2025.map((d) => d.totalScore), 1000);

  // Strategy: use UNDER model for all predictions, use OVER model for all, or route
  const ouModelConfigs = [
    { name: "Base model (control)", getModel: () => baseModel },
    { name: "UNDER-trained model", getModel: () => underModel },
    { name: "OVER-trained model", getModel: () => overModel },
    {
      name: "Route: UNDER model if pred<line, OVER if pred>line",
      getModel: (edge: number) => edge < 0 ? underModel : overModel,
    },
    {
      name: "Route: OVER model if pred<line, UNDER if pred>line",
      getModel: (edge: number) => edge < 0 ? overModel : underModel,
    },
    {
      name: "Average both models",
      getModel: () => null, // special handling
    },
  ];

  for (const omc of ouModelConfigs) {
    for (const season of [2025, 2026]) {
      const data = season === 2025 ? data2025 : data2026;
      let correct = 0, total = 0, units = 0;

      for (const d of data) {
        const feats = getFeatures(d);

        let edge: number;
        if (omc.name === "Average both models") {
          const predOver = predict(overModel, feats);
          const predUnder = predict(underModel, feats);
          const avgPred = (predOver + predUnder) / 2;
          edge = avgPred - d.overUnder;
        } else {
          // First compute edge with base model to determine routing
          const baseEdge = predict(baseModel, feats) - d.overUnder;
          const model = omc.getModel(baseEdge);
          if (!model) continue;
          const pred = predict(model, feats);
          edge = pred - d.overUnder;
        }

        if (Math.abs(edge) < 1.5) continue;
        const pick = edge > 0 ? "OVER" : "UNDER";
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }

      const pct = total > 0 ? (correct / total) * 100 : 0;
      const roi = total > 0 ? (units / total) * 100 : 0;

      if (season === 2025) {
        (omc as any)._r25 = { pct, total, roi };
      } else {
        const r25 = (omc as any)._r25;
        const gap = r25.pct - pct;
        const g = grade(pct, gap, roi, total);
        results.push({ name: `OUModel: ${omc.name}`, category: "separate-ou-models", acc2025: r25.pct, acc2026: pct, gap, n2025: r25.total, n2026: total, roi2025: r25.roi, roi2026: roi, grade: g });
        console.log(`  ${omc.name.padEnd(50)} | 2026: ${pct.toFixed(1)}% (${total}) | gap=${gap.toFixed(1)}pp | grade=${g.toFixed(1)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENT 4: Deep dive on edge asymmetry
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n═══ Experiment 4: Edge Asymmetry Deep Dive ═══\n");

  // Detailed OVER vs UNDER accuracy by edge bucket (on both seasons)
  const edgeBuckets = [
    { min: 0.5, max: 1.5 },
    { min: 1.5, max: 2.5 },
    { min: 2.5, max: 3.5 },
    { min: 3.5, max: 5.0 },
    { min: 5.0, max: 7.0 },
    { min: 7.0, max: 10.0 },
    { min: 10.0, max: 999 },
  ];

  console.log("  Edge Bucket | 2025 UNDER | 2025 OVER  | 2026 UNDER | 2026 OVER");
  console.log("  ------------|------------|------------|------------|----------");

  for (const b of edgeBuckets) {
    const row: string[] = [];
    for (const season of [2025, 2026]) {
      const data = season === 2025 ? data2025 : data2026;

      for (const dir of ["UNDER", "OVER"]) {
        let correct = 0, total = 0;
        for (const d of data) {
          const feats = getFeatures(d);
          const pred = predict(baseModel, feats);
          const edge = pred - d.overUnder;
          const absEdge = Math.abs(edge);
          if (absEdge < b.min || absEdge >= b.max) continue;

          const pick = edge > 0 ? "OVER" : "UNDER";
          if (pick !== dir) continue;

          if (pick === d.ouResult) correct++;
          total++;
        }
        row.push(`${total > 0 ? ((correct / total) * 100).toFixed(1) : "N/A"}% (${String(total).padStart(3)})`);
      }
    }
    const label = b.max === 999 ? `${b.min}+` : `${b.min}-${b.max}`;
    console.log(`  ${label.padEnd(11)} | ${row[0].padEnd(10)} | ${row[1].padEnd(10)} | ${row[2].padEnd(10)} | ${row[3]}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENT 5: Train-on-subgroup models
  // Instead of filtering test data, train specialized models per subgroup
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n═══ Experiment 5: Specialized Subgroup Models ═══\n");

  // Train different models for different line ranges and use each model
  // only for games matching its training range
  const subgroupModels: Array<{
    name: string;
    trainFilter: (g: GameRow) => boolean;
    testFilter: (g: GameRow) => boolean;
    lambda: number;
    minEdge: number;
  }> = [
    { name: "Low-line model (train+test <140)", trainFilter: (g) => g.overUnder < 140, testFilter: (g) => g.overUnder < 140, lambda: 1000, minEdge: 1.0 },
    { name: "Mid-line model (train+test 140-155)", trainFilter: (g) => g.overUnder >= 140 && g.overUnder < 155, testFilter: (g) => g.overUnder >= 140 && g.overUnder < 155, lambda: 1000, minEdge: 1.5 },
    { name: "High-line model (train+test >=155)", trainFilter: (g) => g.overUnder >= 155, testFilter: (g) => g.overUnder >= 155, lambda: 1000, minEdge: 2.0 },
    { name: "Slow-tempo model (train+test <=66)", trainFilter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66, testFilter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66, lambda: 1000, minEdge: 1.0 },
    { name: "Normal-tempo model (66-69)", trainFilter: (g) => { const t = (g.homeTempo + g.awayTempo) / 2; return t > 66 && t <= 69; }, testFilter: (g) => { const t = (g.homeTempo + g.awayTempo) / 2; return t > 66 && t <= 69; }, lambda: 1000, minEdge: 1.5 },
    { name: "Fast-tempo model (>69)", trainFilter: (g) => (g.homeTempo + g.awayTempo) / 2 > 69, testFilter: (g) => (g.homeTempo + g.awayTempo) / 2 > 69, lambda: 1000, minEdge: 2.0 },
    { name: "Mismatch model (rank gap >=100)", trainFilter: (g) => Math.abs(g.homeRank - g.awayRank) >= 100, testFilter: (g) => Math.abs(g.homeRank - g.awayRank) >= 100, lambda: 1000, minEdge: 1.0 },
    { name: "Competitive model (rank gap <100)", trainFilter: (g) => Math.abs(g.homeRank - g.awayRank) < 100, testFilter: (g) => Math.abs(g.homeRank - g.awayRank) < 100, lambda: 1000, minEdge: 2.0 },
  ];

  for (const sm of subgroupModels) {
    const trainFiltered = data2025.filter(sm.trainFilter);
    if (trainFiltered.length < 200) {
      console.log(`  ${sm.name.padEnd(45)} | SKIP (train=${trainFiltered.length})`);
      continue;
    }

    const model = fitOLS(trainFiltered.map(getFeatures), trainFiltered.map((d) => d.totalScore), sm.lambda);

    for (const season of [2025, 2026]) {
      const data = (season === 2025 ? data2025 : data2026).filter(sm.testFilter);
      let correct = 0, total = 0, units = 0;

      for (const d of data) {
        const feats = getFeatures(d);
        const pred = predict(model, feats);
        const edge = pred - d.overUnder;
        if (Math.abs(edge) < sm.minEdge) continue;

        const pick = edge > 0 ? "OVER" : "UNDER";
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }

      const pct = total > 0 ? (correct / total) * 100 : 0;
      const roi = total > 0 ? (units / total) * 100 : 0;

      if (season === 2025) {
        (sm as any)._r25 = { pct, total, roi, trainN: trainFiltered.length };
      } else {
        const r25 = (sm as any)._r25;
        const gap = r25.pct - pct;
        const g = grade(pct, gap, roi, total);
        results.push({ name: `SubM: ${sm.name}`, category: "subgroup-model", acc2025: r25.pct, acc2026: pct, gap, n2025: r25.total, n2026: total, roi2025: r25.roi, roi2026: roi, grade: g });
        console.log(`  ${sm.name.padEnd(45)} | train=${r25.trainN} | 2026: ${pct.toFixed(1)}% (${total}) | gap=${gap.toFixed(1)}pp | grade=${g.toFixed(1)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENT 6: Meta-routing — combine best subgroup models
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n═══ Experiment 6: Meta-Routing (Best Subgroup Models Combined) ═══\n");

  // Train models for each line tier
  const lowLineModel = fitOLS(data2025.filter((g) => g.overUnder < 140).map(getFeatures), data2025.filter((g) => g.overUnder < 140).map((d) => d.totalScore), 1000);
  const midLineModel = fitOLS(data2025.filter((g) => g.overUnder >= 140 && g.overUnder < 155).map(getFeatures), data2025.filter((g) => g.overUnder >= 140 && g.overUnder < 155).map((d) => d.totalScore), 1000);
  const highLineModel = fitOLS(data2025.filter((g) => g.overUnder >= 155).map(getFeatures), data2025.filter((g) => g.overUnder >= 155).map((d) => d.totalScore), 1000);

  // Meta-routing configs
  const metaConfigs = [
    {
      name: "Line-tier models (e: 1/1.5/2)",
      getModel: (g: GameRow) => g.overUnder < 140 ? lowLineModel : g.overUnder < 155 ? midLineModel : highLineModel,
      getMinEdge: (g: GameRow) => g.overUnder < 140 ? 1.0 : g.overUnder < 155 ? 1.5 : 2.0,
    },
    {
      name: "Line-tier models (e: 1/2/3)",
      getModel: (g: GameRow) => g.overUnder < 140 ? lowLineModel : g.overUnder < 155 ? midLineModel : highLineModel,
      getMinEdge: (g: GameRow) => g.overUnder < 140 ? 1.0 : g.overUnder < 155 ? 2.0 : 3.0,
    },
    {
      name: "Low-line model + base (e: 1/1.5)",
      getModel: (g: GameRow) => g.overUnder < 140 ? lowLineModel : baseModel,
      getMinEdge: (g: GameRow) => g.overUnder < 140 ? 1.0 : 1.5,
    },
    {
      name: "Low-line model + base (e: 0.5/2)",
      getModel: (g: GameRow) => g.overUnder < 140 ? lowLineModel : baseModel,
      getMinEdge: (g: GameRow) => g.overUnder < 140 ? 0.5 : 2.0,
    },
    {
      name: "Asym-line: low=Under1/Over3, else=1.5",
      getModel: (_g: GameRow) => baseModel,
      getMinEdge: (g: GameRow, edge: number) => {
        if (g.overUnder < 140) return edge < 0 ? 1.0 : 3.0;
        return 1.5;
      },
    },
  ];

  for (const mc of metaConfigs) {
    for (const season of [2025, 2026]) {
      const data = season === 2025 ? data2025 : data2026;
      let correct = 0, total = 0, units = 0;

      for (const d of data) {
        const feats = getFeatures(d);
        const model = mc.getModel(d);
        const pred = predict(model, feats);
        const edge = pred - d.overUnder;
        const minEdge = mc.getMinEdge(d, edge);
        if (Math.abs(edge) < minEdge) continue;

        const pick = edge > 0 ? "OVER" : "UNDER";
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }

      const pct = total > 0 ? (correct / total) * 100 : 0;
      const roi = total > 0 ? (units / total) * 100 : 0;

      if (season === 2025) {
        (mc as any)._r25 = { pct, total, roi };
      } else {
        const r25 = (mc as any)._r25;
        const gap = r25.pct - pct;
        const g = grade(pct, gap, roi, total);
        results.push({ name: `Meta: ${mc.name}`, category: "meta-routing", acc2025: r25.pct, acc2026: pct, gap, n2025: r25.total, n2026: total, roi2025: r25.roi, roi2026: roi, grade: g });
        console.log(`  ${mc.name.padEnd(45)} | 2026: ${pct.toFixed(1)}% (${total}) | gap=${gap.toFixed(1)}pp | ROI=${roi >= 0 ? "+" : ""}${roi.toFixed(1)}% | grade=${g.toFixed(1)}`);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXPERIMENT 7: Cross-validation of top strategies
  // Use leave-one-month-out on BOTH 2025 and 2026
  // ═══════════════════════════════════════════════════════════════════════════

  console.log("\n═══ Experiment 7: Cross-Validation Stability ═══\n");

  // Top strategies to validate
  const cvStrategies = [
    { name: "v8 baseline (e>=1.5)", minEdge: 1.5, filter: (_g: GameRow) => true },
    { name: "UNDER only (e>=1.5)", minEdge: 1.5, filter: (_g: GameRow) => true, underOnly: true },
    { name: "Asym Under=1 Over=5", underMin: 1.0, overMin: 5.0, filter: (_g: GameRow) => true },
    { name: "Low-line filter (e>=1)", minEdge: 1.0, filter: (g: GameRow) => g.overUnder < 140 },
    { name: "Slow-tempo filter (e>=1)", minEdge: 1.0, filter: (g: GameRow) => (g.homeTempo + g.awayTempo) / 2 <= 66 },
  ];

  const allMonths = [11, 12, 1, 2, 3, 4];

  for (const cs of cvStrategies) {
    console.log(`  ${cs.name}:`);

    for (const season of [2025, 2026]) {
      const data = season === 2025 ? data2025 : data2026;
      const accs: number[] = [];

      for (const holdoutMonth of allMonths) {
        const testData = data.filter((d) => d.gameMonth === holdoutMonth && cs.filter(d));
        if (testData.length < 10) continue;

        // Train on everything except holdout month
        const trainData = data.filter((d) => d.gameMonth !== holdoutMonth);
        const model = fitOLS(trainData.map(getFeatures), trainData.map((d) => d.totalScore), 1000);

        let correct = 0, total = 0;
        for (const d of testData) {
          const feats = getFeatures(d);
          const pred = predict(model, feats);
          const edge = pred - d.overUnder;

          let pick: "OVER" | "UNDER" | null = null;
          if ((cs as any).underOnly) {
            if (edge < 0 && Math.abs(edge) >= cs.minEdge) pick = "UNDER";
          } else if ((cs as any).underMin !== undefined) {
            if (edge < 0 && Math.abs(edge) >= (cs as any).underMin) pick = "UNDER";
            else if (edge > 0 && edge >= (cs as any).overMin) pick = "OVER";
          } else {
            if (Math.abs(edge) >= cs.minEdge) pick = edge > 0 ? "OVER" : "UNDER";
          }
          if (!pick) continue;

          if (pick === d.ouResult) correct++;
          total++;
        }
        if (total > 0) accs.push((correct / total) * 100);
      }

      const avg = accs.length > 0 ? accs.reduce((a, b) => a + b, 0) / accs.length : 0;
      const min = accs.length > 0 ? Math.min(...accs) : 0;
      const max = accs.length > 0 ? Math.max(...accs) : 0;
      console.log(`    ${season}: ${min.toFixed(1)}-${max.toFixed(1)}% (avg ${avg.toFixed(1)}%) across ${accs.length} months`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL LEADERBOARD
  // ═══════════════════════════════════════════════════════════════════════════

  results.sort((a, b) => b.grade - a.grade);

  console.log("\n═══════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("BATCH 3 LEADERBOARD — TOP 30");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════\n");

  console.log(
    "#  | Grade | Category            | Name                                        | 2025 Acc | 2026 Acc | Gap    | 2026 ROI | n(2026)",
  );
  console.log(
    "---|-------|---------------------|---------------------------------------------|----------|----------|--------|----------|--------",
  );

  for (let i = 0; i < Math.min(30, results.length); i++) {
    const r = results[i];
    console.log(
      `${String(i + 1).padStart(2)} | ${r.grade.toFixed(1).padStart(5)} | ${r.category.padEnd(19)} | ${r.name.padEnd(43)} | ${r.acc2025.toFixed(1).padStart(6)}% | ${r.acc2026.toFixed(1).padStart(6)}% | ${r.gap.toFixed(1).padStart(5)}pp | ${(r.roi2026 >= 0 ? "+" : "") + r.roi2026.toFixed(1).padStart(5)}% | ${String(r.n2026).padStart(6)}`,
    );
  }

  // Category summary
  console.log("\n─── Category Summary ───");
  const categories = [...new Set(results.map((r) => r.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const best = catResults[0];
    const passing = catResults.filter((r) => r.acc2026 >= 55 && r.gap <= 5 && r.n2026 >= 200).length;
    console.log(
      `${cat.padEnd(22)} | best: ${best.name.padEnd(40)} | grade=${best.grade.toFixed(1)} | 2026: ${best.acc2026.toFixed(1)}% | gap=${best.gap.toFixed(1)}pp | ${passing}/${catResults.length} pass`,
    );
  }

  const v8Grade = grade(65.7, 4.3, 28.0, 1345);
  const beatsV8 = results.filter((r) => r.grade > v8Grade).length;
  console.log(`\nv8 baseline grade: ${v8Grade.toFixed(1)}`);
  console.log(`Beat v8: ${beatsV8}/${results.length}`);

  console.log("\n✅ Batch 3 complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
