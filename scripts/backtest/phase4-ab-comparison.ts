/**
 * Phase 4: A/B Comparison — v7 vs v8 O/U Model
 *
 * v7: OLS regression + 5 contextual overrides
 * v8: Ridge (λ=1000) regression, no overrides
 *
 * Compares on 2025 (in-sample) and 2026 (out-of-sample) holdout.
 */

import { PrismaClient, type NCAAMBGame } from "@prisma/client";

const prisma = new PrismaClient();

function fitOLS(X: number[][], y: number[], lambda: number = 0) {
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
  features: number[]; // [sumAdjDE, sumAdjOE, avgTempo, tempoDiff, emAbsDiff, isConf, fmTotal]
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
    features: [
      g.homeAdjDE + g.awayAdjDE,       // sumAdjDE
      g.homeAdjOE + g.awayAdjOE,       // sumAdjOE
      (g.homeAdjTempo + g.awayAdjTempo) / 2, // avgTempo
      Math.abs(g.homeAdjTempo - g.awayAdjTempo), // tempoDiff
      Math.abs(g.homeAdjEM - g.awayAdjEM),   // emAbsDiff
      g.isConferenceGame ? 1 : 0,       // isConf
      0,                                 // fmTotal (not stored on completed games)
    ],
  };
}

// v7 contextual overrides (reproduces pick-engine v7 logic)
function applyV7Overrides(
  game: NCAAMBGame,
  ouDir: "over" | "under" | "neutral",
): "over" | "under" | "neutral" {
  const homeRank = game.homeKenpomRank ?? 999;
  const awayRank = game.awayKenpomRank ?? 999;
  const overUnder = game.overUnder!;
  const gameMonth = game.gameDate.getMonth() + 1;

  // Both top-50 → UNDER
  if (homeRank <= 50 && awayRank <= 50) return "under";

  // Both power conf (not already top-50) → UNDER
  // We don't have ConfShort on NCAAMBGame, so skip this override for fairness
  // (both v7 and v8 comparison should be apples-to-apples on available data)

  // Both 200+ → OVER
  if (homeRank > 200 && awayRank > 200) {
    if (ouDir === "over") return "over";
    if (ouDir === "neutral") return "over";
  }

  // March → UNDER
  if (gameMonth === 3) {
    if (ouDir === "under") return "under";
    if (ouDir === "neutral") return "under";
  }

  // High line → UNDER, Low line → OVER
  if (overUnder >= 155) return "under";
  if (overUnder < 135 && (ouDir === "over" || ouDir === "neutral")) return "over";

  return ouDir;
}

function evaluateModel(
  label: string,
  data: GameRow[],
  model: { intercept: number; coefficients: number[] },
  minEdge: number,
  useOverrides: boolean,
): { correct: number; total: number; pct: number; roi: number } {
  let correct = 0, total = 0, units = 0;
  for (const d of data) {
    let pred = model.intercept;
    for (let i = 0; i < d.features.length; i++) pred += model.coefficients[i] * d.features[i];

    const edge = pred - d.overUnder;
    if (Math.abs(edge) < minEdge) continue;

    let pick: "OVER" | "UNDER" = edge > 0 ? "OVER" : "UNDER";

    // Apply v7 overrides if requested
    if (useOverrides) {
      const regDir = edge > 0 ? "over" : "under";
      const overriddenDir = applyV7Overrides(d.game, regDir as "over" | "under");
      pick = overriddenDir === "over" ? "OVER" : "UNDER";
    }

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

async function main() {
  console.log("=== Phase 4: A/B Comparison — v7 vs v8 ===");
  console.log(`Date: ${new Date().toISOString()}\n`);

  const rawGames = await prisma.nCAAMBGame.findMany({
    where: { homeScore: { not: null }, overUnder: { not: null }, homeAdjEM: { not: null } },
    orderBy: { gameDate: "asc" },
  });

  const allGames = rawGames.map(prepareGame).filter(Boolean) as GameRow[];
  const data2025 = allGames.filter((g) => g.game.season === 2025);
  const data2026 = allGames.filter((g) => g.game.season === 2026);

  console.log(`Games: 2025=${data2025.length}, 2026=${data2026.length}\n`);

  // Train both models on 2025
  const X = data2025.map((d) => d.features);
  const y = data2025.map((d) => d.totalScore);

  const v7Model = fitOLS(X, y, 0);       // OLS (λ=0)
  const v8Model = fitOLS(X, y, 1000);    // Ridge (λ=1000)

  // ── HEAD-TO-HEAD ────────────────────────────────────────────────

  console.log("═══════════════════════════════════════════════════════════════════════════");
  console.log("O/U HEAD-TO-HEAD: v7 (OLS + overrides) vs v8 (Ridge, no overrides)");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");

  const minEdge = 1.5;

  const configs = [
    { label: "v7 OLS (no overrides)", model: v7Model, overrides: false },
    { label: "v7 OLS + overrides",    model: v7Model, overrides: true },
    { label: "v8 Ridge λ=1000",       model: v8Model, overrides: false },
  ];

  console.log("Model                    | 2025 Acc (n)       | 2026 Acc (n)       | Gap    | 2025 ROI | 2026 ROI");
  console.log("─────────────────────────|────────────────────|────────────────────|────────|──────────|─────────");

  for (const c of configs) {
    const r25 = evaluateModel(c.label, data2025, c.model, minEdge, c.overrides);
    const r26 = evaluateModel(c.label, data2026, c.model, minEdge, c.overrides);
    const gap = r25.pct - r26.pct;
    console.log(
      `${c.label.padEnd(24)} | ${r25.pct.toFixed(1).padStart(5)}% (${String(r25.total).padStart(4)}) | ` +
      `${r26.pct.toFixed(1).padStart(5)}% (${String(r26.total).padStart(4)}) | ${gap.toFixed(1).padStart(5)}pp | ` +
      `${(r25.roi >= 0 ? "+" : "") + r25.roi.toFixed(1).padStart(4)}%   | ${(r26.roi >= 0 ? "+" : "") + r26.roi.toFixed(1).padStart(4)}%`,
    );
  }

  // ── EDGE BUCKET BREAKDOWN ──────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log("EDGE BUCKET BREAKDOWN (2026 OOS)");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");

  const buckets = [
    { min: 1.5, max: 3, label: "1.5-2.9" },
    { min: 3, max: 5, label: "3.0-4.9" },
    { min: 5, max: 7, label: "5.0-6.9" },
    { min: 7, max: 10, label: "7.0-9.9" },
    { min: 10, max: 999, label: "10.0+" },
  ];

  console.log("Edge Bucket | v7 OLS 2026     | v7+Overrides 2026 | v8 Ridge 2026");
  console.log("────────────|─────────────────|───────────────────|────────────────");

  for (const b of buckets) {
    const results: string[] = [];
    for (const c of configs) {
      let correct = 0, total = 0;
      for (const d of data2026) {
        let pred = c.model.intercept;
        for (let i = 0; i < d.features.length; i++) pred += c.model.coefficients[i] * d.features[i];
        const edge = pred - d.overUnder;
        const absEdge = Math.abs(edge);
        if (absEdge < b.min || absEdge >= b.max) continue;
        let pick: string = edge > 0 ? "OVER" : "UNDER";
        if (c.overrides) {
          const dir = edge > 0 ? "over" : "under";
          const overridden = applyV7Overrides(d.game, dir as "over" | "under");
          pick = overridden === "over" ? "OVER" : "UNDER";
        }
        if (pick === d.ouResult) correct++;
        total++;
      }
      results.push(`${total > 0 ? ((correct / total) * 100).toFixed(1) : "N/A"}% (${String(total).padStart(3)})`);
    }
    console.log(`${b.label.padEnd(11)} | ${results[0].padEnd(15)} | ${results[1].padEnd(17)} | ${results[2]}`);
  }

  // ── DISAGREEMENT ANALYSIS ──────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log("DISAGREEMENT: Games where v7+overrides and v8 pick differently (2026)");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");

  let agree = 0, disagreeV8Wins = 0, disagreeV7Wins = 0, bothSkip = 0;
  for (const d of data2026) {
    // v7 + overrides pick
    let predV7 = v7Model.intercept;
    for (let i = 0; i < d.features.length; i++) predV7 += v7Model.coefficients[i] * d.features[i];
    const edgeV7 = predV7 - d.overUnder;
    const v7Skip = Math.abs(edgeV7) < minEdge;
    let pickV7 = edgeV7 > 0 ? "OVER" : "UNDER";
    if (!v7Skip) {
      const dir = edgeV7 > 0 ? "over" : "under";
      const overridden = applyV7Overrides(d.game, dir as "over" | "under");
      pickV7 = overridden === "over" ? "OVER" : "UNDER";
    }

    // v8 pick
    let predV8 = v8Model.intercept;
    for (let i = 0; i < d.features.length; i++) predV8 += v8Model.coefficients[i] * d.features[i];
    const edgeV8 = predV8 - d.overUnder;
    const v8Skip = Math.abs(edgeV8) < minEdge;
    let pickV8 = edgeV8 > 0 ? "OVER" : "UNDER";

    if (v7Skip && v8Skip) { bothSkip++; continue; }
    if (v7Skip || v8Skip) continue; // One skips, can't compare

    if (pickV7 === pickV8) {
      agree++;
    } else {
      const v8Correct = pickV8 === d.ouResult;
      if (v8Correct) disagreeV8Wins++;
      else disagreeV7Wins++;
    }
  }

  console.log(`Agreement: ${agree} games`);
  console.log(`Disagreement: ${disagreeV8Wins + disagreeV7Wins} games`);
  console.log(`  v8 correct: ${disagreeV8Wins} (${((disagreeV8Wins / (disagreeV8Wins + disagreeV7Wins)) * 100).toFixed(1)}%)`);
  console.log(`  v7 correct: ${disagreeV7Wins} (${((disagreeV7Wins / (disagreeV8Wins + disagreeV7Wins)) * 100).toFixed(1)}%)`);
  console.log(`Both skip: ${bothSkip}`);

  // ── COEFFICIENT COMPARISON ─────────────────────────────────────

  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log("COEFFICIENT COMPARISON");
  console.log("═══════════════════════════════════════════════════════════════════════════\n");

  const featureNames = ["sumAdjDE", "sumAdjOE", "avgTempo", "tempoDiff", "emAbsDiff", "isConf", "fmTotal"];
  console.log("Feature      | v7 OLS      | v8 Ridge    | Change");
  console.log("─────────────|─────────────|─────────────|────────");
  console.log(`intercept    | ${v7Model.intercept.toFixed(4).padStart(11)} | ${v8Model.intercept.toFixed(4).padStart(11)} | ${(v8Model.intercept - v7Model.intercept).toFixed(4)}`);
  for (let i = 0; i < featureNames.length; i++) {
    console.log(
      `${featureNames[i].padEnd(12)} | ${v7Model.coefficients[i].toFixed(6).padStart(11)} | ${v8Model.coefficients[i].toFixed(6).padStart(11)} | ${(v8Model.coefficients[i] - v7Model.coefficients[i]).toFixed(6)}`,
    );
  }

  console.log("\n✅ A/B comparison complete.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
