/**
 * Iteration Batch 4 — Combining Best Strategies & Rescuing OVER
 *
 * Based on batch 3 discoveries:
 *   1. UNDER-only at e>=2 is 70.2% (3.0pp gap) — best pure strategy
 *   2. Low-line subgroup model: 70.3% — trains on <140 subset
 *   3. Asymmetric Under=2/Over=7: 69.8% (4.6pp gap) — best balanced strategy
 *   4. OVER predictions are weak at low edges but catch up at edge>=5
 *
 * Experiments:
 *   1. Combined: UNDER-only + subgroup filters (the ultimate cherry-pick)
 *   2. OVER rescue: different features/lambda for OVER predictions
 *   3. Ensemble voting: top-N models vote, require majority
 *   4. Asymmetric edge + subgroup combinations
 *   5. Monthly retraining simulation (expanding window)
 *   6. Hybrid UNDER-focus + selective OVER
 *   7. Subgroup-trained models with asymmetric edges
 *   8. Volume-optimized strategies
 *   9. Line-as-feature models
 *   10. Monthly stability of top strategies
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

function computeGrade(acc2026: number, gap: number, roi2026: number, n2026: number): number {
  if (acc2026 < 55 || gap > 8 || n2026 < 100) return 0;
  const accScore = Math.min(100, Math.max(0, (acc2026 - 55) / 15 * 100));
  const gapScore = Math.min(100, Math.max(0, (8 - gap) / 8 * 100));
  const roiScore = Math.min(100, Math.max(0, roi2026 / 40 * 100));
  const volScore = Math.min(100, Math.max(0, (n2026 - 200) / 1200 * 100));
  return accScore * 0.4 + gapScore * 0.25 + roiScore * 0.2 + volScore * 0.15;
}

interface Result {
  name: string;
  category: string;
  acc2025: number;
  acc2026: number;
  gap: number;
  roi2026: number;
  n2026: number;
  grade: number;
  extra?: string;
}

const results: Result[] = [];

function addResult(cat: string, name: string, acc25: number, _n25: number, acc26: number, n26: number, roi26: number, extra?: string) {
  const gap = acc25 - acc26;
  const g = computeGrade(acc26, gap, roi26, n26);
  results.push({ name, category: cat, acc2025: acc25, acc2026: acc26, gap, roi2026: roi26, n2026: n26, grade: g, extra });
}

function runModel(
  data: GameRow[],
  model: { intercept: number; coefficients: number[] },
  getF: (g: GameRow) => number[],
  minEdge: number,
  filter?: (g: GameRow, edge: number) => boolean,
) {
  let correct = 0, total = 0, units = 0;
  for (const d of data) {
    const feats = getF(d);
    const pred = predict(model, feats);
    const edge = pred - d.overUnder;
    if (Math.abs(edge) < minEdge) continue;
    if (filter && !filter(d, edge)) continue;
    const pick = edge > 0 ? "OVER" : "UNDER";
    if (pick === d.ouResult) { correct++; units += 1; }
    else units -= 1.1;
    total++;
  }
  return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0, roi: total > 0 ? (units / total) * 100 : 0 };
}

function runAsym(
  data: GameRow[],
  model: { intercept: number; coefficients: number[] },
  getF: (g: GameRow) => number[],
  underEdge: number,
  overEdge: number,
  filter?: (g: GameRow, edge: number) => boolean,
) {
  let correct = 0, total = 0, units = 0;
  for (const d of data) {
    const feats = getF(d);
    const pred = predict(model, feats);
    const edge = pred - d.overUnder;
    if (edge < 0 && Math.abs(edge) < underEdge) continue;
    if (edge > 0 && edge < overEdge) continue;
    if (filter && !filter(d, edge)) continue;
    const pick = edge > 0 ? "OVER" : "UNDER";
    if (pick === d.ouResult) { correct++; units += 1; }
    else units -= 1.1;
    total++;
  }
  return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0, roi: total > 0 ? (units / total) * 100 : 0 };
}

async function main() {
  console.log("=== Iteration Batch 4 — Combining Best Strategies & Rescuing OVER ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  const rawGames = await prisma.nCAAMBGame.findMany({
    where: { homeScore: { not: null }, overUnder: { not: null }, homeAdjEM: { not: null } },
    orderBy: { gameDate: "asc" },
  });

  const allGames = rawGames.map(prepareGame).filter(Boolean) as GameRow[];
  const data2025 = allGames.filter((g) => g.game.season === 2025);
  const data2026 = allGames.filter((g) => g.game.season === 2026);

  console.log(`Games: 2025=${data2025.length}, 2026=${data2026.length}\n`);

  // Base model (Ridge lambda=1000)
  const X = data2025.map(getFeatures);
  const y = data2025.map((d) => d.totalScore);
  const baseModel = fitOLS(X, y, 1000);

  // ═══ Experiment 1: UNDER-only + subgroup filters ═══
  console.log("═══ Experiment 1: UNDER-Only + Subgroup Filters ═══\n");

  const subgroupFilters: { name: string; filter: (g: GameRow) => boolean }[] = [
    { name: "All games", filter: () => true },
    { name: "Low-line (<140)", filter: (g) => g.overUnder < 140 },
    { name: "Low-line (<145)", filter: (g) => g.overUnder < 145 },
    { name: "Slow-tempo (<=66)", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 },
    { name: "Slow-tempo (<=67)", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 67 },
    { name: "Rank gap >= 80", filter: (g) => Math.abs(g.homeRank - g.awayRank) >= 80 },
    { name: "Rank gap >= 100", filter: (g) => Math.abs(g.homeRank - g.awayRank) >= 100 },
    { name: "Conference games", filter: (g) => g.isConf === 1 },
    { name: "Non-conference", filter: (g) => g.isConf === 0 },
    { name: "Low-line + slow-tempo", filter: (g) => g.overUnder < 140 && (g.homeTempo + g.awayTempo) / 2 <= 66 },
    { name: "Low-line + rank gap>=80", filter: (g) => g.overUnder < 140 && Math.abs(g.homeRank - g.awayRank) >= 80 },
    { name: "Slow-tempo + conference", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 && g.isConf === 1 },
  ];

  const underEdges = [1.0, 1.5, 2.0, 3.0];

  for (const sf of subgroupFilters) {
    for (const ue of underEdges) {
      const r25 = runModel(data2025, baseModel, getFeatures, ue, (g, edge) => edge < 0 && sf.filter(g));
      const r26 = runModel(data2026, baseModel, getFeatures, ue, (g, edge) => edge < 0 && sf.filter(g));
      if (r26.total < 30) continue;
      const label = `UNDER-only e>=${ue} + ${sf.name}`;
      console.log(`  ${label.padEnd(50)} | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp | ROI=${(r26.roi >= 0 ? "+" : "") + r26.roi.toFixed(1)}%`);
      addResult("under-subgroup", label, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
    }
  }

  // ═══ Experiment 2: OVER Rescue — different lambdas/features ═══
  console.log("\n═══ Experiment 2: OVER Rescue — Different Lambdas/Features ═══\n");

  const overLambdas = [0, 100, 500, 1000, 5000, 10000];
  for (const lam of overLambdas) {
    const model = fitOLS(X, y, lam);
    for (const minE of [3.0, 5.0, 7.0]) {
      const r25 = runModel(data2025, model, getFeatures, minE, (_g, edge) => edge > 0);
      const r26 = runModel(data2026, model, getFeatures, minE, (_g, edge) => edge > 0);
      if (r26.total < 50) continue;
        const label = `OVER lambda=${lam} e>=${minE}`;
      console.log(`  ${label.padEnd(30)} | 2025: ${r25.pct.toFixed(1)}% (${r25.total}) | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp`);
      addResult("over-rescue", label, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
    }
  }

  // Try OVER with different feature sets
  const overFeatureSets: { name: string; getF: (g: GameRow) => number[] }[] = [
    { name: "Core-3", getF: (g) => [g.homeAdjDE + g.awayAdjDE, g.homeAdjOE + g.awayAdjOE, (g.homeTempo + g.awayTempo) / 2] },
    { name: "OE-only", getF: (g) => [g.homeAdjOE + g.awayAdjOE, (g.homeTempo + g.awayTempo) / 2] },
    { name: "OE+DE+Tempo+RankGap", getF: (g) => [
      g.homeAdjDE + g.awayAdjDE, g.homeAdjOE + g.awayAdjOE,
      (g.homeTempo + g.awayTempo) / 2, Math.abs(g.homeRank - g.awayRank)
    ]},
    { name: "Full+Line", getF: (g) => [...getFeatures(g), g.overUnder] },
    { name: "Full+LineSq", getF: (g) => [...getFeatures(g), g.overUnder, g.overUnder * g.overUnder / 1000] },
  ];

  for (const fs of overFeatureSets) {
    const Xo = data2025.map(fs.getF);
    const model = fitOLS(Xo, y, 1000);
    for (const minE of [3.0, 5.0]) {
      const r25 = runModel(data2025, model, fs.getF, minE, (_g, edge) => edge > 0);
      const r26 = runModel(data2026, model, fs.getF, minE, (_g, edge) => edge > 0);
      if (r26.total < 50) continue;
      const label = `OVER ${fs.name} e>=${minE}`;
      console.log(`  ${label.padEnd(35)} | 2025: ${r25.pct.toFixed(1)}% (${r25.total}) | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp`);
      addResult("over-rescue", label, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
    }
  }

  // ═══ Experiment 3: Ensemble Voting — Top Models Vote ═══
  console.log("\n═══ Experiment 3: Ensemble Voting ═══\n");

  // Build several diverse models
  const core3F = (g: GameRow): number[] => [g.homeAdjDE + g.awayAdjDE, g.homeAdjOE + g.awayAdjOE, (g.homeTempo + g.awayTempo) / 2];
  const fullF = getFeatures;
  const extF = (g: GameRow): number[] => [...getFeatures(g), Math.abs(g.homeRank - g.awayRank)];

  const ensembleModels = [
    { name: "Ridge-1000 full", model: fitOLS(data2025.map(fullF), y, 1000), getF: fullF },
    { name: "Ridge-100 full", model: fitOLS(data2025.map(fullF), y, 100), getF: fullF },
    { name: "Ridge-5000 full", model: fitOLS(data2025.map(fullF), y, 5000), getF: fullF },
    { name: "Ridge-1000 core3", model: fitOLS(data2025.map(core3F), y, 1000), getF: core3F },
    { name: "OLS full", model: fitOLS(data2025.map(fullF), y, 0), getF: fullF },
    { name: "Ridge-1000 ext", model: fitOLS(data2025.map(extF), y, 1000), getF: extF },
  ];

  // Majority voting ensembles
  const ensembleCombos: { name: string; indices: number[]; minVotes: number }[] = [
    { name: "Top-3 (Ridge 100/1000/5000) majority", indices: [0, 1, 2], minVotes: 2 },
    { name: "Top-3 unanimous", indices: [0, 1, 2], minVotes: 3 },
    { name: "All-5 majority (3/5)", indices: [0, 1, 2, 3, 4], minVotes: 3 },
    { name: "All-5 supermajority (4/5)", indices: [0, 1, 2, 3, 4], minVotes: 4 },
    { name: "All-6 majority (4/6)", indices: [0, 1, 2, 3, 4, 5], minVotes: 4 },
    { name: "All-6 supermajority (5/6)", indices: [0, 1, 2, 3, 4, 5], minVotes: 5 },
    { name: "Diverse-4 majority", indices: [0, 3, 4, 5], minVotes: 3 },
    { name: "Diverse-4 unanimous", indices: [0, 3, 4, 5], minVotes: 4 },
  ];

  for (const ec of ensembleCombos) {
    for (const minE of [1.5, 3.0, 5.0]) {
      const runEnsemble = (data: GameRow[]) => {
        let correct = 0, total = 0, units = 0;
        for (const d of data) {
          let overVotes = 0, underVotes = 0;
          let anyQualifies = false;
          for (const idx of ec.indices) {
            const em = ensembleModels[idx];
            const pred = predict(em.model, em.getF(d));
            const edge = pred - d.overUnder;
            if (Math.abs(edge) >= minE) {
              anyQualifies = true;
              if (edge > 0) overVotes++;
              else underVotes++;
            }
          }
          if (!anyQualifies) continue;
          const totalVotes = overVotes + underVotes;
          if (totalVotes < ec.minVotes) continue;
          const pick = overVotes >= ec.minVotes ? "OVER" : underVotes >= ec.minVotes ? "UNDER" : null;
          if (!pick) continue;
          if (pick === d.ouResult) { correct++; units += 1; }
          else units -= 1.1;
          total++;
        }
        return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0, roi: total > 0 ? (units / total) * 100 : 0 };
      };

      const r25 = runEnsemble(data2025);
      const r26 = runEnsemble(data2026);
      if (r26.total < 50) continue;

      const label = `Ens: ${ec.name} e>=${minE}`;
      console.log(`  ${label.padEnd(55)} | 2025: ${r25.pct.toFixed(1)}% (${r25.total}) | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp`);
      addResult("ensemble-voting", label, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
    }
  }

  // ═══ Experiment 4: Asymmetric Edge + Subgroup Combination ═══
  console.log("\n═══ Experiment 4: Asymmetric Edge + Subgroup Combinations ═══\n");

  const asymConfigs = [
    { uEdge: 1.5, oEdge: 5.0 },
    { uEdge: 2.0, oEdge: 5.0 },
    { uEdge: 2.0, oEdge: 7.0 },
    { uEdge: 1.0, oEdge: 5.0 },
  ];

  const subgroupsForAsym: { name: string; filter: (g: GameRow) => boolean }[] = [
    { name: "Low-line (<140)", filter: (g) => g.overUnder < 140 },
    { name: "Low-line (<145)", filter: (g) => g.overUnder < 145 },
    { name: "Slow-tempo (<=66)", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 },
    { name: "Slow-tempo (<=67)", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 67 },
    { name: "Rank gap>=80", filter: (g) => Math.abs(g.homeRank - g.awayRank) >= 80 },
    { name: "Low-line OR slow", filter: (g) => g.overUnder < 140 || (g.homeTempo + g.awayTempo) / 2 <= 66 },
    { name: "Low-line AND slow", filter: (g) => g.overUnder < 140 && (g.homeTempo + g.awayTempo) / 2 <= 66 },
  ];

  for (const ac of asymConfigs) {
    for (const sg of subgroupsForAsym) {
      const r25 = runAsym(data2025, baseModel, getFeatures, ac.uEdge, ac.oEdge, (g) => sg.filter(g));
      const r26 = runAsym(data2026, baseModel, getFeatures, ac.uEdge, ac.oEdge, (g) => sg.filter(g));
      if (r26.total < 40) continue;
      const label = `Asym U${ac.uEdge}/O${ac.oEdge} + ${sg.name}`;
      console.log(`  ${label.padEnd(50)} | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp | ROI=${(r26.roi >= 0 ? "+" : "") + r26.roi.toFixed(1)}%`);
      addResult("asym-subgroup", label, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
    }
  }

  // ═══ Experiment 5: Expanding Window Training ═══
  console.log("\n═══ Experiment 5: Expanding Window Training (2026 by Month) ═══\n");

  const months2026 = [11, 12, 1, 2];
  const monthData2026: Record<number, GameRow[]> = {};
  for (const m of months2026) {
    monthData2026[m] = data2026.filter((g) => g.gameMonth === m);
  }

  // Baseline: static v8 model on each month
  console.log("  Static v8 (no retraining):");
  for (const m of months2026) {
    const md = monthData2026[m];
    const r = runModel(md, baseModel, getFeatures, 1.5);
    console.log(`    Month ${String(m).padStart(2)}: ${r.pct.toFixed(1)}% (${r.total})`);
  }

  // Expanding window: train on 2025, then 2025+Nov, then 2025+Nov+Dec, etc.
  console.log("  Expanding window (retrain monthly):");
  let expandedData = [...data2025];
  let expandedCorrect = 0, expandedTotal = 0, expandedUnits = 0;

  for (const m of months2026) {
    const model = fitOLS(expandedData.map(getFeatures), expandedData.map((d) => d.totalScore), 1000);
    const md = monthData2026[m];
    const r = runModel(md, model, getFeatures, 1.5);
    expandedCorrect += r.correct;
    expandedTotal += r.total;
    expandedUnits += r.correct - (r.total - r.correct) * 1.1;
    console.log(`    Month ${String(m).padStart(2)}: ${r.pct.toFixed(1)}% (${r.total})`);
    expandedData = [...expandedData, ...md];
  }

  const expandAcc = expandedTotal > 0 ? (expandedCorrect / expandedTotal) * 100 : 0;
  const expandRoi = expandedTotal > 0 ? (expandedUnits / expandedTotal) * 100 : 0;
  console.log(`  Expanding total: ${expandAcc.toFixed(1)}% (${expandedTotal}) | ROI=${(expandRoi >= 0 ? "+" : "") + expandRoi.toFixed(1)}%`);

  const staticR25 = runModel(data2025, baseModel, getFeatures, 1.5);
  const staticR26 = runModel(data2026, baseModel, getFeatures, 1.5);
  addResult("expanding-window", "Static v8 (no retrain)", staticR25.pct, staticR25.total, staticR26.pct, staticR26.total, staticR26.roi);
  addResult("expanding-window", "Expanding window monthly", staticR25.pct, staticR25.total, expandAcc, expandedTotal, expandRoi);

  // Expanding + UNDER-only
  console.log("  Expanding window + UNDER-only (e>=2):");
  expandedData = [...data2025];
  expandedCorrect = 0; expandedTotal = 0; expandedUnits = 0;
  for (const m of months2026) {
    const model = fitOLS(expandedData.map(getFeatures), expandedData.map((d) => d.totalScore), 1000);
    const md = monthData2026[m];
    const r = runModel(md, model, getFeatures, 2.0, (_g, edge) => edge < 0);
    expandedCorrect += r.correct;
    expandedTotal += r.total;
    expandedUnits += r.correct - (r.total - r.correct) * 1.1;
    console.log(`    Month ${String(m).padStart(2)}: ${r.pct.toFixed(1)}% (${r.total})`);
    expandedData = [...expandedData, ...md];
  }
  const expandUnderAcc = expandedTotal > 0 ? (expandedCorrect / expandedTotal) * 100 : 0;
  const expandUnderRoi = expandedTotal > 0 ? (expandedUnits / expandedTotal) * 100 : 0;
  console.log(`  Expanding+UNDER total: ${expandUnderAcc.toFixed(1)}% (${expandedTotal}) | ROI=${(expandUnderRoi >= 0 ? "+" : "") + expandUnderRoi.toFixed(1)}%`);
  const staticUnderR25 = runModel(data2025, baseModel, getFeatures, 2.0, (_g, e) => e < 0);
  addResult("expanding-window", "Expanding + UNDER-only e>=2", staticUnderR25.pct, staticUnderR25.total, expandUnderAcc, expandedTotal, expandUnderRoi);

  // ═══ Experiment 6: Hybrid UNDER-focus + selective OVER ═══
  console.log("\n═══ Experiment 6: Hybrid UNDER + Selective OVER ═══\n");

  const hybridConfigs: { name: string; uEdge: number; oEdge: number; overFilter: (g: GameRow) => boolean; underFilter?: (g: GameRow) => boolean }[] = [
    { name: "UNDER e>=1.5, OVER e>=5 + low-line", uEdge: 1.5, oEdge: 5.0, overFilter: (g) => g.overUnder < 140 },
    { name: "UNDER e>=1.5, OVER e>=5 + slow-tempo", uEdge: 1.5, oEdge: 5.0, overFilter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 },
    { name: "UNDER e>=1.5, OVER e>=7", uEdge: 1.5, oEdge: 7.0, overFilter: () => true },
    { name: "UNDER e>=1.5, OVER e>=5 + rank-gap>=100", uEdge: 1.5, oEdge: 5.0, overFilter: (g) => Math.abs(g.homeRank - g.awayRank) >= 100 },
    { name: "UNDER e>=2, OVER e>=5 + low-line", uEdge: 2.0, oEdge: 5.0, overFilter: (g) => g.overUnder < 140 },
    { name: "UNDER e>=2, OVER e>=7", uEdge: 2.0, oEdge: 7.0, overFilter: () => true },
    { name: "UNDER e>=2, OVER e>=5 + slow-tempo", uEdge: 2.0, oEdge: 5.0, overFilter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 },
    { name: "UNDER e>=2, OVER e>=7 + low-line", uEdge: 2.0, oEdge: 7.0, overFilter: (g) => g.overUnder < 140 },
    { name: "UNDER e>=1, OVER e>=5", uEdge: 1.0, oEdge: 5.0, overFilter: () => true },
    { name: "UNDER e>=1, OVER e>=7", uEdge: 1.0, oEdge: 7.0, overFilter: () => true },
    { name: "UNDER e>=1.5 slow, OVER e>=5 low-line", uEdge: 1.5, oEdge: 5.0,
      overFilter: (g) => g.overUnder < 140,
      underFilter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66 },
    { name: "UNDER e>=1 (any), OVER e>=5 (any)", uEdge: 1.0, oEdge: 5.0, overFilter: () => true },
  ];

  for (const hc of hybridConfigs) {
    const runHybrid = (data: GameRow[]) => {
      let correct = 0, total = 0, units = 0;
      for (const d of data) {
        const feats = getFeatures(d);
        const pred = predict(baseModel, feats);
        const edge = pred - d.overUnder;

        let pick: string | null = null;
        if (edge < 0 && Math.abs(edge) >= hc.uEdge) {
          if (!hc.underFilter || hc.underFilter(d)) pick = "UNDER";
        } else if (edge > 0 && edge >= hc.oEdge) {
          if (hc.overFilter(d)) pick = "OVER";
        }

        if (!pick) continue;
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }
      return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0, roi: total > 0 ? (units / total) * 100 : 0 };
    };

    const r25 = runHybrid(data2025);
    const r26 = runHybrid(data2026);
    if (r26.total < 50) continue;
    console.log(`  ${hc.name.padEnd(55)} | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp | ROI=${(r26.roi >= 0 ? "+" : "") + r26.roi.toFixed(1)}%`);
    addResult("hybrid-under-over", hc.name, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
  }

  // ═══ Experiment 7: Subgroup-Trained Models with Asymmetric Edges ═══
  console.log("\n═══ Experiment 7: Subgroup-Trained + Asymmetric Edges ═══\n");

  const subTrainConfigs: { name: string; filter: (g: GameRow) => boolean; useFilter: (g: GameRow, edge: number) => boolean; minEdge: number }[] = [
    { name: "Low-line trained, UNDER e>=1.5", filter: (g) => g.overUnder < 140,
      useFilter: (g, edge) => edge < 0 && g.overUnder < 140, minEdge: 1.5 },
    { name: "Low-line trained, UNDER e>=1", filter: (g) => g.overUnder < 140,
      useFilter: (g, edge) => edge < 0 && g.overUnder < 140, minEdge: 1.0 },
    { name: "Low-line trained, asym U1/O5", filter: (g) => g.overUnder < 140,
      useFilter: (g, edge) => g.overUnder < 140 && (edge < 0 ? Math.abs(edge) >= 1 : edge >= 5), minEdge: 0 },
    { name: "Slow-tempo trained, UNDER e>=1.5", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66,
      useFilter: (g, edge) => edge < 0 && (g.homeTempo + g.awayTempo) / 2 <= 66, minEdge: 1.5 },
    { name: "Slow-tempo trained, UNDER e>=1", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66,
      useFilter: (g, edge) => edge < 0 && (g.homeTempo + g.awayTempo) / 2 <= 66, minEdge: 1.0 },
    { name: "Low-line trained, all dir e>=1", filter: (g) => g.overUnder < 140,
      useFilter: (g) => g.overUnder < 140, minEdge: 1.0 },
    { name: "Slow-tempo trained, all dir e>=1", filter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66,
      useFilter: (g) => (g.homeTempo + g.awayTempo) / 2 <= 66, minEdge: 1.0 },
  ];

  for (const stc of subTrainConfigs) {
    const trainData = data2025.filter(stc.filter);
    if (trainData.length < 200) continue;
    const Xsub = trainData.map(getFeatures);
    const ySub = trainData.map((d) => d.totalScore);
    const subModel = fitOLS(Xsub, ySub, 1000);

    const r25 = runModel(data2025, subModel, getFeatures, stc.minEdge, (g, edge) => stc.useFilter(g, edge));
    const r26 = runModel(data2026, subModel, getFeatures, stc.minEdge, (g, edge) => stc.useFilter(g, edge));
    if (r26.total < 30) continue;
    console.log(`  ${stc.name.padEnd(45)} | train=${trainData.length} | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp | ROI=${(r26.roi >= 0 ? "+" : "") + r26.roi.toFixed(1)}%`);
    addResult("subgroup-trained-asym", stc.name, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
  }

  // ═══ Experiment 8: Volume-Optimized Strategies ═══
  console.log("\n═══ Experiment 8: Volume-Optimized (n>=500 target) ═══\n");

  const volumeStrategies: { name: string; run: (data: GameRow[]) => { correct: number; total: number; pct: number; roi: number } }[] = [
    { name: "Asym U1.5/O3 (volume focus)", run: (data) => runAsym(data, baseModel, getFeatures, 1.5, 3.0) },
    { name: "UNDER e>=1.5 + OVER e>=3", run: (data) => {
      let correct = 0, total = 0, units = 0;
      for (const d of data) {
        const pred = predict(baseModel, getFeatures(d));
        const edge = pred - d.overUnder;
        if (edge < 0 && Math.abs(edge) >= 1.5) { /* UNDER pick */ }
        else if (edge > 0 && edge >= 3.0) { /* OVER pick */ }
        else continue;
        const pick = edge > 0 ? "OVER" : "UNDER";
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }
      return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0, roi: total > 0 ? (units / total) * 100 : 0 };
    }},
    { name: "UNDER e>=1 + OVER e>=3", run: (data) => {
      let correct = 0, total = 0, units = 0;
      for (const d of data) {
        const pred = predict(baseModel, getFeatures(d));
        const edge = pred - d.overUnder;
        if (edge < 0 && Math.abs(edge) >= 1.0) { /* UNDER */ }
        else if (edge > 0 && edge >= 3.0) { /* OVER */ }
        else continue;
        const pick = edge > 0 ? "OVER" : "UNDER";
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }
      return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0, roi: total > 0 ? (units / total) * 100 : 0 };
    }},
    { name: "Ensemble 3/3 agree at e>=1.5", run: (data) => {
      let correct = 0, total = 0, units = 0;
      const models = [
        { m: fitOLS(data2025.map(fullF), y, 1000), f: fullF },
        { m: fitOLS(data2025.map(core3F), y, 1000), f: core3F },
        { m: fitOLS(data2025.map(fullF), y, 0), f: fullF },
      ];
      for (const d of data) {
        let allAgree = true;
        let pick: string | null = null;
        for (const md of models) {
          const pred = predict(md.m, md.f(d));
          const edge = pred - d.overUnder;
          if (Math.abs(edge) < 1.5) { allAgree = false; break; }
          const dir = edge > 0 ? "OVER" : "UNDER";
          if (!pick) pick = dir;
          else if (pick !== dir) { allAgree = false; break; }
        }
        if (!allAgree || !pick) continue;
        if (pick === d.ouResult) { correct++; units += 1; }
        else units -= 1.1;
        total++;
      }
      return { correct, total, pct: total > 0 ? (correct / total) * 100 : 0, roi: total > 0 ? (units / total) * 100 : 0 };
    }},
  ];

  for (const vs of volumeStrategies) {
    const r25 = vs.run(data2025);
    const r26 = vs.run(data2026);
    console.log(`  ${vs.name.padEnd(45)} | 2025: ${r25.pct.toFixed(1)}% (${r25.total}) | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp | ROI=${(r26.roi >= 0 ? "+" : "") + r26.roi.toFixed(1)}%`);
    addResult("volume-optimized", vs.name, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
  }

  // ═══ Experiment 9: Line-as-Feature Models ═══
  console.log("\n═══ Experiment 9: Line-as-Feature (Partial Pooling) ═══\n");

  const lineFeatureSets: { name: string; getF: (g: GameRow) => number[] }[] = [
    { name: "Core3 + line", getF: (g) => [
      g.homeAdjDE + g.awayAdjDE, g.homeAdjOE + g.awayAdjOE,
      (g.homeTempo + g.awayTempo) / 2, g.overUnder,
    ]},
    { name: "Full + line", getF: (g) => [...getFeatures(g), g.overUnder] },
    { name: "Full + line + lineSq", getF: (g) => [...getFeatures(g), g.overUnder, g.overUnder * g.overUnder / 10000] },
    { name: "Core3 + line + line*tempo", getF: (g) => {
      const avgT = (g.homeTempo + g.awayTempo) / 2;
      return [
        g.homeAdjDE + g.awayAdjDE, g.homeAdjOE + g.awayAdjOE, avgT,
        g.overUnder, g.overUnder * avgT / 10000,
      ];
    }},
    { name: "Line-residual (no line feat)", getF: (g) => [
      g.homeAdjDE + g.awayAdjDE, g.homeAdjOE + g.awayAdjOE,
      (g.homeTempo + g.awayTempo) / 2, Math.abs(g.homeEM - g.awayEM), g.isConf,
    ]},
  ];

  for (const lfs of lineFeatureSets) {
    const Xl = data2025.map(lfs.getF);
    for (const lam of [0, 1000, 5000]) {
      const model = fitOLS(Xl, y, lam);
      for (const minE of [1.5, 3.0]) {
        const r25 = runModel(data2025, model, lfs.getF, minE);
        const r26 = runModel(data2026, model, lfs.getF, minE);
        if (r26.total < 100) continue;
        const label = `${lfs.name} lam=${lam} e>=${minE}`;
        console.log(`  ${label.padEnd(45)} | 2025: ${r25.pct.toFixed(1)}% (${r25.total}) | 2026: ${r26.pct.toFixed(1)}% (${r26.total}) | gap=${(r25.pct - r26.pct).toFixed(1)}pp`);
        addResult("line-feature", label, r25.pct, r25.total, r26.pct, r26.total, r26.roi);
      }
    }
  }

  // ═══ Experiment 10: Monthly Stability of Top Strategies ═══
  console.log("\n═══ Experiment 10: Monthly Stability of Top Strategies ═══\n");

  const topStrategies: { name: string; run: (data: GameRow[]) => { pct: number; total: number } }[] = [
    { name: "UNDER e>=2 (base)", run: (data) => runModel(data, baseModel, getFeatures, 2.0, (_g, e) => e < 0) },
    { name: "Asym U2/O7", run: (data) => runAsym(data, baseModel, getFeatures, 2.0, 7.0) },
    { name: "UNDER e>=1.5 + OVER e>=5", run: (data) => {
      let correct = 0, total = 0;
      for (const d of data) {
        const pred = predict(baseModel, getFeatures(d));
        const edge = pred - d.overUnder;
        if (edge < 0 && Math.abs(edge) >= 1.5) { /* ok */ }
        else if (edge > 0 && edge >= 5.0) { /* ok */ }
        else continue;
        const pick = edge > 0 ? "OVER" : "UNDER";
        if (pick === d.ouResult) correct++;
        total++;
      }
      return { pct: total > 0 ? (correct / total) * 100 : 0, total };
    }},
  ];

  for (const ts of topStrategies) {
    console.log(`  ${ts.name}:`);
    for (const m of months2026) {
      const md = monthData2026[m];
      const r = ts.run(md);
      console.log(`    Month ${String(m).padStart(2)}: ${r.pct.toFixed(1)}% (${r.total})`);
    }
  }

  // ═══ LEADERBOARD ═══
  console.log("\n═══════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("BATCH 4 LEADERBOARD — TOP 30");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════\n");

  results.sort((a, b) => b.grade - a.grade);
  console.log("#  | Grade | Category            | Name                                        | 2025 Acc | 2026 Acc | Gap    | 2026 ROI | n(2026)");
  console.log("---|-------|---------------------|---------------------------------------------|----------|----------|--------|----------|--------");
  for (let i = 0; i < Math.min(30, results.length); i++) {
    const r = results[i];
    console.log(
      `${String(i + 1).padStart(2)} | ${r.grade.toFixed(1).padStart(5)} | ${r.category.padEnd(19)} | ${r.name.padEnd(43)} | ${r.acc2025.toFixed(1).padStart(6)}% | ${r.acc2026.toFixed(1).padStart(6)}% | ${r.gap.toFixed(1).padStart(5)}pp | ${(r.roi2026 >= 0 ? "+" : "") + r.roi2026.toFixed(1).padStart(5)}% | ${String(r.n2026).padStart(6)}`
    );
  }

  // Category summary
  console.log("\n─── Category Summary ───");
  const categories = [...new Set(results.map((r) => r.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    catResults.sort((a, b) => b.grade - a.grade);
    const best = catResults[0];
    const passing = catResults.filter((r) => r.grade > 0).length;
    console.log(`${cat.padEnd(25)} | best: ${best.name.padEnd(45)} | grade=${best.grade.toFixed(1)} | 2026: ${best.acc2026.toFixed(1)}% | gap=${best.gap.toFixed(1)}pp | ${passing}/${catResults.length} pass`);
  }

  console.log(`\nv8 baseline grade: 68.4`);
  console.log(`Beat v8: ${results.filter((r) => r.grade > 68.4).length}/${results.length}`);
  console.log(`\n✅ Batch 4 complete.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
