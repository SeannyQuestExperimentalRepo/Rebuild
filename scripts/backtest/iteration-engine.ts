/**
 * Iteration Engine — Automated model variant testing
 *
 * Tests hundreds of O/U and spread model variants, grades against v8 baseline,
 * and outputs a ranked leaderboard.
 *
 * Grading criteria (weighted score):
 *   - OOS accuracy (40%): higher is better, minimum 55%
 *   - Overfitting gap (25%): lower is better, maximum 5pp
 *   - OOS ROI (20%): higher is better (at -110 odds)
 *   - Volume (15%): more picks is better (minimum 200)
 *
 * Each variant gets a composite grade 0-100.
 */

import { PrismaClient, type NCAAMBGame } from "@prisma/client";

const prisma = new PrismaClient();

// ─── OLS / Ridge solver ──────────────────────────────────────────────────

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

// ─── Data types ──────────────────────────────────────────────────────────

interface GameRow {
  game: NCAAMBGame;
  totalScore: number;
  scoreDiff: number;
  overUnder: number;
  spread: number | null;
  ouResult: string;
  spreadResult: string | null;
  // Raw features (compute derived features from these)
  homeAdjDE: number;
  awayAdjDE: number;
  homeAdjOE: number;
  awayAdjOE: number;
  homeTempo: number;
  awayTempo: number;
  homeEM: number;
  awayEM: number;
  homeRank: number;
  awayRank: number;
  isConf: number;
  gameMonth: number;
  overUnderVal: number;
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
    scoreDiff: g.homeScore - g.awayScore,
    overUnder: g.overUnder,
    spread: g.spread,
    ouResult: g.ouResult,
    spreadResult: g.spreadResult,
    homeAdjDE: g.homeAdjDE,
    awayAdjDE: g.awayAdjDE,
    homeAdjOE: g.homeAdjOE,
    awayAdjOE: g.awayAdjOE,
    homeTempo: g.homeAdjTempo,
    awayTempo: g.awayAdjTempo,
    homeEM: g.homeAdjEM,
    awayEM: g.awayAdjEM,
    homeRank: g.homeKenpomRank ?? 200,
    awayRank: g.awayKenpomRank ?? 200,
    isConf: g.isConferenceGame ? 1 : 0,
    gameMonth: g.gameDate.getMonth() + 1,
    overUnderVal: g.overUnder,
  };
}

// ─── Feature registry ────────────────────────────────────────────────────
// Each feature is a function: GameRow → number

type FeatureFn = (g: GameRow) => number;

const FEATURES: Record<string, FeatureFn> = {
  // Core features (v8 baseline)
  sumAdjDE: (g) => g.homeAdjDE + g.awayAdjDE,
  sumAdjOE: (g) => g.homeAdjOE + g.awayAdjOE,
  avgTempo: (g) => (g.homeTempo + g.awayTempo) / 2,
  tempoDiff: (g) => Math.abs(g.homeTempo - g.awayTempo),
  emAbsDiff: (g) => Math.abs(g.homeEM - g.awayEM),
  isConf: (g) => g.isConf,
  fmTotal: (_g) => 0, // Not available on completed games

  // Individual component features
  homeAdjDE: (g) => g.homeAdjDE,
  awayAdjDE: (g) => g.awayAdjDE,
  homeAdjOE: (g) => g.homeAdjOE,
  awayAdjOE: (g) => g.awayAdjOE,
  homeTempo: (g) => g.homeTempo,
  awayTempo: (g) => g.awayTempo,
  homeEM: (g) => g.homeEM,
  awayEM: (g) => g.awayEM,

  // Derived features - sums and diffs
  emDiff: (g) => g.homeEM - g.awayEM,
  sumEM: (g) => g.homeEM + g.awayEM,
  deDiff: (g) => g.homeAdjDE - g.awayAdjDE,
  oeDiff: (g) => g.homeAdjOE - g.awayAdjOE,
  tempoSum: (g) => g.homeTempo + g.awayTempo,

  // Rank features
  homeRank: (g) => g.homeRank,
  awayRank: (g) => g.awayRank,
  rankDiff: (g) => g.homeRank - g.awayRank,
  avgRank: (g) => (g.homeRank + g.awayRank) / 2,
  rankMin: (g) => Math.min(g.homeRank, g.awayRank),
  rankMax: (g) => Math.max(g.homeRank, g.awayRank),

  // Interaction features
  "de*tempo": (g) => (g.homeAdjDE + g.awayAdjDE) * ((g.homeTempo + g.awayTempo) / 2),
  "oe*tempo": (g) => (g.homeAdjOE + g.awayAdjOE) * ((g.homeTempo + g.awayTempo) / 2),
  "em*tempo": (g) => Math.abs(g.homeEM - g.awayEM) * ((g.homeTempo + g.awayTempo) / 2),
  "de*oe": (g) => (g.homeAdjDE + g.awayAdjDE) * (g.homeAdjOE + g.awayAdjOE),
  "tempo²": (g) => ((g.homeTempo + g.awayTempo) / 2) ** 2,
  "de²": (g) => (g.homeAdjDE + g.awayAdjDE) ** 2,
  "oe²": (g) => (g.homeAdjOE + g.awayAdjOE) ** 2,
  "emDiff²": (g) => (g.homeEM - g.awayEM) ** 2,
  "tempoDiff²": (g) => (g.homeTempo - g.awayTempo) ** 2,

  // Efficiency gap features
  homeNetEff: (g) => g.homeAdjOE - g.homeAdjDE,
  awayNetEff: (g) => g.awayAdjOE - g.awayAdjDE,
  netEffDiff: (g) => (g.homeAdjOE - g.homeAdjDE) - (g.awayAdjOE - g.awayAdjDE),
  netEffSum: (g) => (g.homeAdjOE - g.homeAdjDE) + (g.awayAdjOE - g.awayAdjDE),

  // Contextual (as features, not overrides)
  bothTop50: (g) => (g.homeRank <= 50 && g.awayRank <= 50) ? 1 : 0,
  bothTop100: (g) => (g.homeRank <= 100 && g.awayRank <= 100) ? 1 : 0,
  bothBottom200: (g) => (g.homeRank > 200 && g.awayRank > 200) ? 1 : 0,
  highLine: (g) => g.overUnderVal >= 155 ? 1 : 0,
  lowLine: (g) => g.overUnderVal < 135 ? 1 : 0,
  lineVal: (g) => g.overUnderVal,

  // Month indicators
  isNovember: (g) => g.gameMonth === 11 ? 1 : 0,
  isDecember: (g) => g.gameMonth === 12 ? 1 : 0,
  isJanuary: (g) => g.gameMonth === 1 ? 1 : 0,
  isFebruary: (g) => g.gameMonth === 2 ? 1 : 0,
  isMarch: (g) => g.gameMonth === 3 ? 1 : 0,

  // Normalized features (z-score-ish, centered on typical values)
  normDE: (g) => ((g.homeAdjDE + g.awayAdjDE) - 200) / 10,
  normOE: (g) => ((g.homeAdjOE + g.awayAdjOE) - 210) / 10,
  normTempo: (g) => ((g.homeTempo + g.awayTempo) / 2 - 67) / 3,

  // Pace-adjusted efficiency
  paceAdjDE: (g) => (g.homeAdjDE + g.awayAdjDE) * ((g.homeTempo + g.awayTempo) / 2) / 67,
  paceAdjOE: (g) => (g.homeAdjOE + g.awayAdjOE) * ((g.homeTempo + g.awayTempo) / 2) / 67,
};

// ─── Model variant specification ─────────────────────────────────────────

interface ModelVariant {
  id: string;
  name: string;
  features: string[];
  lambda: number;
  minEdge: number;
  target: "totalScore" | "deviation"; // deviation = totalScore - overUnder
  category: string;
}

// ─── Evaluation ──────────────────────────────────────────────────────────

interface EvalResult {
  correct: number;
  total: number;
  pct: number;
  roi: number;
}

function evaluate(
  data: GameRow[],
  model: { intercept: number; coefficients: number[] },
  featureNames: string[],
  minEdge: number,
  target: "totalScore" | "deviation",
): EvalResult {
  let correct = 0, total = 0, units = 0;
  for (const d of data) {
    const feats = featureNames.map((f) => FEATURES[f](d));
    let pred = model.intercept;
    for (let i = 0; i < feats.length; i++) pred += model.coefficients[i] * feats[i];

    let edge: number;
    if (target === "deviation") {
      edge = pred; // positive = model says OVER
    } else {
      edge = pred - d.overUnder;
    }

    if (Math.abs(edge) < minEdge) continue;
    const pick = edge > 0 ? "OVER" : "UNDER";
    if (pick === d.ouResult) { correct++; units += 1; }
    else units -= 1.1;
    total++;
  }
  return {
    correct,
    total,
    pct: total > 0 ? (correct / total) * 100 : 0,
    roi: total > 0 ? (units / total) * 100 : 0,
  };
}

// ─── Grading ─────────────────────────────────────────────────────────────

interface GradedResult {
  variant: ModelVariant;
  acc2025: number;
  acc2026: number;
  gap: number;
  n2025: number;
  n2026: number;
  roi2025: number;
  roi2026: number;
  grade: number;
  passesGates: boolean;
}

function grade(acc2026: number, gap: number, roi2026: number, n2026: number): number {
  // Gate checks
  if (acc2026 < 55) return 0;
  if (gap > 8) return 0;
  if (n2026 < 100) return 0;

  // Accuracy score (40%): 55% = 0, 70% = 100
  const accScore = Math.min(100, Math.max(0, (acc2026 - 55) / 15 * 100));

  // Gap score (25%): 0pp = 100, 5pp = 50, 8pp = 0
  const gapScore = Math.min(100, Math.max(0, (8 - gap) / 8 * 100));

  // ROI score (20%): 0% = 0, 40% = 100
  const roiScore = Math.min(100, Math.max(0, roi2026 / 40 * 100));

  // Volume score (15%): 200 = 0, 1400 = 100
  const volScore = Math.min(100, Math.max(0, (n2026 - 200) / 1200 * 100));

  return 0.40 * accScore + 0.25 * gapScore + 0.20 * roiScore + 0.15 * volScore;
}

// ─── Walk-forward validation ─────────────────────────────────────────────

function walkForward(
  data2025: GameRow[],
  featureNames: string[],
  lambda: number,
  minEdge: number,
  target: "totalScore" | "deviation",
): { minAcc: number; maxAcc: number; avgAcc: number } {
  const months = [11, 12, 1, 2, 3, 4];
  const accs: number[] = [];

  for (const holdoutMonth of months) {
    const train = data2025.filter((g) => g.gameMonth !== holdoutMonth);
    const test = data2025.filter((g) => g.gameMonth === holdoutMonth);
    if (test.length < 20) continue;

    const X = train.map((d) => featureNames.map((f) => FEATURES[f](d)));
    const y = train.map((d) => target === "deviation" ? d.totalScore - d.overUnder : d.totalScore);
    const model = fitOLS(X, y, lambda);
    const result = evaluate(test, model, featureNames, minEdge, target);
    if (result.total > 0) accs.push(result.pct);
  }

  return {
    minAcc: accs.length > 0 ? Math.min(...accs) : 0,
    maxAcc: accs.length > 0 ? Math.max(...accs) : 0,
    avgAcc: accs.length > 0 ? accs.reduce((a, b) => a + b, 0) / accs.length : 0,
  };
}

// ─── Spread evaluation ───────────────────────────────────────────────────

function evaluateSpread(
  data: GameRow[],
  model: { intercept: number; coefficients: number[] },
  featureNames: string[],
  minEdge: number,
  target: "scoreDiff" | "deviation",
): EvalResult {
  let correct = 0, total = 0, units = 0;
  for (const d of data) {
    if (d.spread == null || d.spreadResult == null || d.spreadResult === "PUSH") continue;
    const feats = featureNames.map((f) => FEATURES[f](d));
    let pred = model.intercept;
    for (let i = 0; i < feats.length; i++) pred += model.coefficients[i] * feats[i];

    let edge: number;
    if (target === "deviation") {
      edge = pred;
    } else {
      edge = pred + d.spread;
    }

    if (Math.abs(edge) < minEdge) continue;
    const pick = edge > 0 ? "COVERED" : "LOST";
    if (pick === d.spreadResult) { correct++; units += 1; }
    else units -= 1.1;
    total++;
  }
  return {
    correct,
    total,
    pct: total > 0 ? (correct / total) * 100 : 0,
    roi: total > 0 ? (units / total) * 100 : 0,
  };
}

// ─── Generate variant catalog ────────────────────────────────────────────

function generateVariants(): ModelVariant[] {
  const variants: ModelVariant[] = [];
  let id = 0;

  // ── Category 1: Feature subsets with Ridge λ=1000 ──────────────────

  const coreSets: [string, string[]][] = [
    ["Core-3", ["sumAdjDE", "sumAdjOE", "avgTempo"]],
    ["Core-3+conf", ["sumAdjDE", "sumAdjOE", "avgTempo", "isConf"]],
    ["Core-3+tempoDiff", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff"]],
    ["Core-5", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "isConf"]],
    ["Core-6", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf"]],
    ["v8-baseline", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "fmTotal"]],
  ];

  for (const [name, feats] of coreSets) {
    variants.push({ id: `feat-${id++}`, name: `${name} Ridge-1000`, features: feats, lambda: 1000, minEdge: 1.5, target: "totalScore", category: "feature-subsets" });
  }

  // ── Category 2: Regularization sweep ───────────────────────────────

  const lambdas = [0, 1, 10, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 50000];
  const baseFeats = ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf"];

  for (const lam of lambdas) {
    variants.push({ id: `lam-${id++}`, name: `Core-6 λ=${lam}`, features: baseFeats, lambda: lam, minEdge: 1.5, target: "totalScore", category: "regularization" });
  }

  // ── Category 3: Edge threshold sweep ───────────────────────────────

  const edges = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 7.0, 10.0];
  for (const e of edges) {
    variants.push({ id: `edge-${id++}`, name: `v8-base edge>=${e}`, features: baseFeats, lambda: 1000, minEdge: e, target: "totalScore", category: "edge-thresholds" });
  }

  // ── Category 4: Individual component features ──────────────────────

  const individualSets: [string, string[]][] = [
    ["4-way components", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE"]],
    ["4-way + tempo", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE", "avgTempo"]],
    ["4-way + all tempo", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE", "homeTempo", "awayTempo"]],
    ["6-way components", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE", "homeTempo", "awayTempo"]],
    ["6-way + conf", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE", "homeTempo", "awayTempo", "isConf"]],
    ["EM pair", ["homeEM", "awayEM"]],
    ["EM pair + tempo", ["homeEM", "awayEM", "avgTempo"]],
    ["EM pair + all", ["homeEM", "awayEM", "avgTempo", "tempoDiff", "isConf"]],
  ];

  for (const [name, feats] of individualSets) {
    variants.push({ id: `indiv-${id++}`, name, features: feats, lambda: 1000, minEdge: 1.5, target: "totalScore", category: "individual-components" });
  }

  // ── Category 5: Interaction features ───────────────────────────────

  const interactionSets: [string, string[]][] = [
    ["Core-3 + de*tempo", ["sumAdjDE", "sumAdjOE", "avgTempo", "de*tempo"]],
    ["Core-3 + oe*tempo", ["sumAdjDE", "sumAdjOE", "avgTempo", "oe*tempo"]],
    ["Core-3 + de*oe", ["sumAdjDE", "sumAdjOE", "avgTempo", "de*oe"]],
    ["Core-3 + tempo²", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempo²"]],
    ["Core-3 + de² + oe²", ["sumAdjDE", "sumAdjOE", "avgTempo", "de²", "oe²"]],
    ["Core-3 + all quad", ["sumAdjDE", "sumAdjOE", "avgTempo", "de²", "oe²", "tempo²"]],
    ["Core-6 + de*tempo", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "de*tempo"]],
    ["Core-6 + all interact", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "de*tempo", "oe*tempo", "de*oe"]],
    ["Core-6 + all quad", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "de²", "oe²", "tempo²"]],
    ["Kitchen sink (all interact+quad)", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "de*tempo", "oe*tempo", "de*oe", "de²", "oe²", "tempo²", "emDiff²", "tempoDiff²"]],
  ];

  for (const [name, feats] of interactionSets) {
    variants.push({ id: `inter-${id++}`, name, features: feats, lambda: 1000, minEdge: 1.5, target: "totalScore", category: "interactions" });
    // Also test with higher regularization for bigger feature sets
    if (feats.length > 6) {
      variants.push({ id: `inter-${id++}`, name: `${name} λ=5000`, features: feats, lambda: 5000, minEdge: 1.5, target: "totalScore", category: "interactions" });
      variants.push({ id: `inter-${id++}`, name: `${name} λ=10000`, features: feats, lambda: 10000, minEdge: 1.5, target: "totalScore", category: "interactions" });
    }
  }

  // ── Category 6: Efficiency-based features ──────────────────────────

  const effSets: [string, string[]][] = [
    ["NetEff pair", ["homeNetEff", "awayNetEff"]],
    ["NetEff + tempo", ["homeNetEff", "awayNetEff", "avgTempo"]],
    ["NetEff sum+diff", ["netEffSum", "netEffDiff", "avgTempo"]],
    ["NetEff + core", ["sumAdjDE", "sumAdjOE", "avgTempo", "netEffDiff"]],
    ["Pace-adj DE+OE", ["paceAdjDE", "paceAdjOE"]],
    ["Pace-adj + tempo", ["paceAdjDE", "paceAdjOE", "avgTempo"]],
    ["Pace-adj + all", ["paceAdjDE", "paceAdjOE", "avgTempo", "tempoDiff", "isConf"]],
  ];

  for (const [name, feats] of effSets) {
    variants.push({ id: `eff-${id++}`, name, features: feats, lambda: 1000, minEdge: 1.5, target: "totalScore", category: "efficiency" });
  }

  // ── Category 7: Rank-enhanced features ─────────────────────────────

  const rankSets: [string, string[]][] = [
    ["Core-3 + avgRank", ["sumAdjDE", "sumAdjOE", "avgTempo", "avgRank"]],
    ["Core-3 + rankDiff", ["sumAdjDE", "sumAdjOE", "avgTempo", "rankDiff"]],
    ["Core-3 + both rank indicators", ["sumAdjDE", "sumAdjOE", "avgTempo", "bothTop50", "bothBottom200"]],
    ["Core-6 + rank feats", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "avgRank", "rankDiff"]],
    ["Core-6 + rank indicators", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "bothTop50", "bothTop100", "bothBottom200"]],
    ["Core-6 + line feats", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "highLine", "lowLine"]],
    ["Core-6 + lineVal", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "lineVal"]],
  ];

  for (const [name, feats] of rankSets) {
    variants.push({ id: `rank-${id++}`, name, features: feats, lambda: 1000, minEdge: 1.5, target: "totalScore", category: "rank-enhanced" });
  }

  // ── Category 8: Month indicators ───────────────────────────────────

  const monthSets: [string, string[]][] = [
    ["Core-3 + months", ["sumAdjDE", "sumAdjOE", "avgTempo", "isNovember", "isDecember", "isJanuary", "isFebruary", "isMarch"]],
    ["Core-6 + months", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "isNovember", "isDecember", "isJanuary", "isFebruary", "isMarch"]],
  ];

  for (const [name, feats] of monthSets) {
    variants.push({ id: `month-${id++}`, name, features: feats, lambda: 1000, minEdge: 1.5, target: "totalScore", category: "monthly" });
    variants.push({ id: `month-${id++}`, name: `${name} λ=5000`, features: feats, lambda: 5000, minEdge: 1.5, target: "totalScore", category: "monthly" });
  }

  // ── Category 9: Market-relative (predict deviation from line) ──────

  const devSets: [string, string[]][] = [
    ["Dev: Core-3", ["sumAdjDE", "sumAdjOE", "avgTempo"]],
    ["Dev: Core-6", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf"]],
    ["Dev: Core-6 + interactions", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "de*tempo"]],
    ["Dev: 4-way", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE"]],
    ["Dev: 4-way + tempo", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE", "avgTempo"]],
  ];

  for (const [name, feats] of devSets) {
    for (const lam of [100, 1000, 5000]) {
      variants.push({ id: `dev-${id++}`, name: `${name} λ=${lam}`, features: feats, lambda: lam, minEdge: 1.5, target: "deviation", category: "market-relative" });
    }
  }

  // ── Category 10: Normalized features ───────────────────────────────

  const normSets: [string, string[]][] = [
    ["Norm-3", ["normDE", "normOE", "normTempo"]],
    ["Norm-3 + tempoDiff", ["normDE", "normOE", "normTempo", "tempoDiff"]],
    ["Norm-3 + conf", ["normDE", "normOE", "normTempo", "isConf"]],
    ["Norm-5", ["normDE", "normOE", "normTempo", "tempoDiff", "isConf"]],
  ];

  for (const [name, feats] of normSets) {
    variants.push({ id: `norm-${id++}`, name, features: feats, lambda: 1000, minEdge: 1.5, target: "totalScore", category: "normalized" });
    // Normalized features need less regularization
    variants.push({ id: `norm-${id++}`, name: `${name} λ=100`, features: feats, lambda: 100, minEdge: 1.5, target: "totalScore", category: "normalized" });
  }

  // ── Category 11: Elastic Net approximation (vary L1 via feature dropping) ──
  // We can't do true elastic net with our solver, but we can simulate by
  // testing all 2^n subsets of features (for small n) with Ridge

  const core3 = ["sumAdjDE", "sumAdjOE", "avgTempo"];
  const extras = ["tempoDiff", "emAbsDiff", "isConf", "de*tempo", "avgRank", "lineVal"];

  // All combinations of 1-3 extras added to Core-3
  for (let i = 0; i < extras.length; i++) {
    variants.push({ id: `combo-${id++}`, name: `Core-3+${extras[i]}`, features: [...core3, extras[i]], lambda: 1000, minEdge: 1.5, target: "totalScore", category: "combos" });
    for (let j = i + 1; j < extras.length; j++) {
      variants.push({ id: `combo-${id++}`, name: `Core-3+${extras[i]}+${extras[j]}`, features: [...core3, extras[i], extras[j]], lambda: 1000, minEdge: 1.5, target: "totalScore", category: "combos" });
      for (let k = j + 1; k < extras.length; k++) {
        variants.push({ id: `combo-${id++}`, name: `Core-3+${extras[i]}+${extras[j]}+${extras[k]}`, features: [...core3, extras[i], extras[j], extras[k]], lambda: 1000, minEdge: 1.5, target: "totalScore", category: "combos" });
      }
    }
  }

  // ── Category 12: Best model × edge threshold matrix ────────────────
  // For top feature sets, test all edge thresholds
  const topSets: [string, string[]][] = [
    ["Core-3", ["sumAdjDE", "sumAdjOE", "avgTempo"]],
    ["Core-6", ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf"]],
    ["4-way+tempo", ["homeAdjDE", "awayAdjDE", "homeAdjOE", "awayAdjOE", "avgTempo"]],
  ];

  for (const [name, feats] of topSets) {
    for (const e of [1.0, 2.0, 3.0, 5.0]) {
      for (const lam of [500, 1000, 2000]) {
        variants.push({ id: `matrix-${id++}`, name: `${name} λ=${lam} e>=${e}`, features: feats, lambda: lam, minEdge: e, target: "totalScore", category: "matrix" });
      }
    }
  }

  console.log(`Generated ${variants.length} variants across ${new Set(variants.map(v => v.category)).size} categories`);
  return variants;
}

// ─── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Iteration Engine — Automated Model Variant Testing ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  const rawGames = await prisma.nCAAMBGame.findMany({
    where: { homeScore: { not: null }, overUnder: { not: null }, homeAdjEM: { not: null } },
    orderBy: { gameDate: "asc" },
  });

  const allGames = rawGames.map(prepareGame).filter(Boolean) as GameRow[];
  const data2025 = allGames.filter((g) => g.game.season === 2025);
  const data2026 = allGames.filter((g) => g.game.season === 2026);

  console.log(`Games: 2025=${data2025.length}, 2026=${data2026.length}\n`);

  const variants = generateVariants();
  const results: GradedResult[] = [];

  // v8 baseline for reference
  const v8Grade = grade(65.7, 4.3, 28.0, 1345);
  console.log(`v8 baseline grade: ${v8Grade.toFixed(1)}\n`);

  console.log("Running variants...\n");

  let completed = 0;
  for (const v of variants) {
    try {
      const X = data2025.map((d) => v.features.map((f) => FEATURES[f](d)));
      const y = data2025.map((d) => v.target === "deviation" ? d.totalScore - d.overUnder : d.totalScore);
      const model = fitOLS(X, y, v.lambda);

      const r25 = evaluate(data2025, model, v.features, v.minEdge, v.target);
      const r26 = evaluate(data2026, model, v.features, v.minEdge, v.target);
      const gap = r25.pct - r26.pct;
      const g = grade(r26.pct, gap, r26.roi, r26.total);

      results.push({
        variant: v,
        acc2025: r25.pct,
        acc2026: r26.pct,
        gap,
        n2025: r25.total,
        n2026: r26.total,
        roi2025: r25.roi,
        roi2026: r26.roi,
        grade: g,
        passesGates: r26.pct >= 55 && gap <= 5 && r26.total >= 200,
      });
    } catch (e) {
      // Skip variants that fail (e.g., singular matrices)
    }

    completed++;
    if (completed % 50 === 0) {
      process.stdout.write(`  ${completed}/${variants.length} variants tested\r`);
    }
  }

  console.log(`\nCompleted ${results.length} variants\n`);

  // Sort by grade
  results.sort((a, b) => b.grade - a.grade);

  // ── LEADERBOARD ────────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("TOP 30 VARIANTS (by composite grade)");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════\n");

  console.log(
    "#  | Grade | Category            | Name                                     | 2025 Acc | 2026 Acc | Gap    | 2026 ROI | n(2026) | Gates",
  );
  console.log(
    "---|-------|---------------------|------------------------------------------|----------|----------|--------|----------|---------|------",
  );

  for (let i = 0; i < Math.min(30, results.length); i++) {
    const r = results[i];
    const gateStr = r.passesGates ? "PASS" : "fail";
    console.log(
      `${String(i + 1).padStart(2)} | ${r.grade.toFixed(1).padStart(5)} | ${r.variant.category.padEnd(19)} | ${r.variant.name.padEnd(40)} | ${r.acc2025.toFixed(1).padStart(6)}% | ${r.acc2026.toFixed(1).padStart(6)}% | ${r.gap.toFixed(1).padStart(5)}pp | ${(r.roi2026 >= 0 ? "+" : "") + r.roi2026.toFixed(1).padStart(5)}% | ${String(r.n2026).padStart(7)} | ${gateStr}`,
    );
  }

  // ── CATEGORY ANALYSIS ──────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("CATEGORY SUMMARY (best per category)");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════\n");

  const categories = [...new Set(results.map((r) => r.variant.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.variant.category === cat);
    const best = catResults[0]; // Already sorted by grade
    const passing = catResults.filter((r) => r.passesGates).length;
    console.log(
      `${cat.padEnd(22)} | best: ${best.variant.name.padEnd(35)} | grade=${best.grade.toFixed(1)} | 2026: ${best.acc2026.toFixed(1)}% (${best.n2026}) | gap=${best.gap.toFixed(1)}pp | ${passing}/${catResults.length} pass gates`,
    );
  }

  // ── PASS GATE COUNT ────────────────────────────────────────────────

  const passing = results.filter((r) => r.passesGates);
  const beatsV8 = results.filter((r) => r.grade > v8Grade);

  console.log(`\n─── Summary ───`);
  console.log(`Total variants: ${results.length}`);
  console.log(`Pass gates (≥55% OOS, ≤5pp gap, ≥200 picks): ${passing.length}`);
  console.log(`Beat v8 grade (${v8Grade.toFixed(1)}): ${beatsV8.length}`);

  // ── WALK-FORWARD on top 5 ──────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("WALK-FORWARD VALIDATION (top 5 variants)");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════\n");

  for (let i = 0; i < Math.min(5, results.length); i++) {
    const r = results[i];
    const wf = walkForward(data2025, r.variant.features, r.variant.lambda, r.variant.minEdge, r.variant.target);
    console.log(
      `#${i + 1} ${r.variant.name.padEnd(40)} | WF: ${wf.minAcc.toFixed(1)}-${wf.maxAcc.toFixed(1)}% (avg ${wf.avgAcc.toFixed(1)}%)`,
    );
  }

  // ── SPREAD VARIANTS ────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("SPREAD MODEL VARIANTS");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════\n");

  const spreadFeatureSets: [string, string[], number, number, "scoreDiff" | "deviation"][] = [
    ["EM-diff e>=1", ["emDiff"], 0, 1, "scoreDiff"],
    ["EM-diff e>=2", ["emDiff"], 0, 2, "scoreDiff"],
    ["EM-diff e>=3", ["emDiff"], 0, 3, "scoreDiff"],
    ["EM-diff Ridge-100", ["emDiff"], 100, 1, "scoreDiff"],
    ["EM-diff + neutral", ["emDiff", "isConf"], 100, 1, "scoreDiff"],
    ["EM-diff + tempo", ["emDiff", "avgTempo"], 100, 1, "scoreDiff"],
    ["EM-diff + tempo + conf", ["emDiff", "avgTempo", "isConf"], 100, 1, "scoreDiff"],
    ["4-feat KP", ["emDiff", "avgTempo", "isConf", "tempoDiff"], 100, 1, "scoreDiff"],
    ["4-feat KP Ridge-1000", ["emDiff", "avgTempo", "isConf", "tempoDiff"], 1000, 1, "scoreDiff"],
    ["Full EM+OE+DE", ["emDiff", "oeDiff", "deDiff", "avgTempo"], 1000, 1, "scoreDiff"],
    ["Market-Rel EM", ["emDiff"], 100, 1, "deviation"],
    ["Market-Rel EM+tempo", ["emDiff", "avgTempo"], 100, 1, "deviation"],
    ["Market-Rel EM+tempo+conf", ["emDiff", "avgTempo", "isConf"], 100, 1, "deviation"],
    ["Market-Rel 4-feat", ["emDiff", "avgTempo", "isConf", "tempoDiff"], 1000, 1, "deviation"],
    ["NetEff spread", ["netEffDiff", "avgTempo"], 100, 1, "scoreDiff"],
    ["NetEff + conf", ["netEffDiff", "avgTempo", "isConf"], 100, 1, "scoreDiff"],
    ["EM pair spread", ["homeEM", "awayEM"], 100, 1, "scoreDiff"],
    ["EM pair + tempo", ["homeEM", "awayEM", "avgTempo"], 100, 1, "scoreDiff"],
    ["Rank-based", ["rankDiff", "avgRank"], 100, 1, "scoreDiff"],
    ["EM + rank", ["emDiff", "rankDiff", "avgTempo"], 100, 1, "scoreDiff"],
  ];

  console.log(
    "Model                          | 2025 Acc (n)       | 2026 Acc (n)       | Gap    | 2025 ROI | 2026 ROI",
  );
  console.log(
    "───────────────────────────────|────────────────────|────────────────────|────────|──────────|─────────",
  );

  for (const [name, feats, lam, minE, target] of spreadFeatureSets) {
    const spreadData2025 = data2025.filter((d) => d.spread != null);
    const spreadData2026 = data2026.filter((d) => d.spread != null);

    const X = spreadData2025.map((d) => feats.map((f) => FEATURES[f](d)));
    const y = spreadData2025.map((d) => target === "deviation" ? d.scoreDiff + d.spread! : d.scoreDiff);
    const model = fitOLS(X, y, lam);

    const r25 = evaluateSpread(spreadData2025, model, feats, minE, target);
    const r26 = evaluateSpread(spreadData2026, model, feats, minE, target);
    const gap = r25.pct - r26.pct;

    console.log(
      `${name.padEnd(30)} | ${r25.pct.toFixed(1).padStart(5)}% (${String(r25.total).padStart(4)}) | ${r26.pct.toFixed(1).padStart(5)}% (${String(r26.total).padStart(4)}) | ${gap.toFixed(1).padStart(5)}pp | ${(r25.roi >= 0 ? "+" : "") + r25.roi.toFixed(1).padStart(4)}%   | ${(r26.roi >= 0 ? "+" : "") + r26.roi.toFixed(1).padStart(4)}%`,
    );
  }

  // ── ENSEMBLE TEST ──────────────────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("ENSEMBLE: Average top-3 model predictions");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════\n");

  // Train top 3 models
  const top3 = results.slice(0, 3);
  const models = top3.map((r) => {
    const X = data2025.map((d) => r.variant.features.map((f) => FEATURES[f](d)));
    const y = data2025.map((d) => r.variant.target === "deviation" ? d.totalScore - d.overUnder : d.totalScore);
    return { model: fitOLS(X, y, r.variant.lambda), variant: r.variant };
  });

  // Ensemble evaluation
  for (const season of [2025, 2026] as const) {
    const data = season === 2025 ? data2025 : data2026;
    let correct = 0, total = 0, units = 0;

    for (const d of data) {
      // Average edge from all models
      let totalEdge = 0;
      let modelCount = 0;

      for (const { model, variant } of models) {
        const feats = variant.features.map((f) => FEATURES[f](d));
        let pred = model.intercept;
        for (let i = 0; i < feats.length; i++) pred += model.coefficients[i] * feats[i];

        let edge: number;
        if (variant.target === "deviation") {
          edge = pred;
        } else {
          edge = pred - d.overUnder;
        }
        totalEdge += edge;
        modelCount++;
      }

      const avgEdge = totalEdge / modelCount;
      if (Math.abs(avgEdge) < 1.5) continue;

      const pick = avgEdge > 0 ? "OVER" : "UNDER";
      if (pick === d.ouResult) { correct++; units += 1; }
      else units -= 1.1;
      total++;
    }

    const pct = total > 0 ? (correct / total) * 100 : 0;
    const roi = total > 0 ? (units / total) * 100 : 0;
    console.log(`${season}: ${pct.toFixed(1)}% (${total} picks), ROI: ${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`);
  }

  console.log("\n✅ Iteration engine complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
