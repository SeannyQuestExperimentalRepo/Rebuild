/**
 * Export DailyPick training data to CSV for ML model training.
 *
 * Outputs: scripts/training-data.csv
 * Columns: date, sport, pickType, homeTeam, awayTeam, pickSide, line, trendScore,
 *          confidence, signal_modelEdge, signal_seasonATS, signal_trendAngles,
 *          signal_recentForm, signal_h2h, signal_situational, signal_restDays,
 *          signal_marketEdge, signal_seasonOU, signal_h2hWeather, signal_tempoDiff,
 *          result, actualMargin, correct
 *
 * Usage: NODE_OPTIONS="--require ./scripts/register.cjs" npx tsx scripts/export-training-data.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface ReasoningEntry {
  angle: string;
  weight: number;
  strength: string;
  record?: string;
  category?: string;
  magnitude?: number;
  confidence?: number;
  direction?: string;
}

// All known signal categories across spread and O/U pick types
const SIGNAL_COLUMNS = [
  "modelEdge",
  "seasonATS",
  "trendAngles",
  "recentForm",
  "h2h",
  "situational",
  "restDays",
  "marketEdge",
  "seasonOU",
  "h2hWeather",
  "tempoDiff",
];

function escapeCSV(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

async function main() {
  console.log("Exporting DailyPick training data...");

  // Get all graded picks
  const picks = await prisma.dailyPick.findMany({
    where: {
      result: { in: ["WIN", "LOSS", "PUSH"] },
    },
    orderBy: { date: "asc" },
  });

  console.log(`Found ${picks.length} graded picks`);

  if (picks.length === 0) {
    console.log("No graded picks found. Exiting.");
    process.exit(0);
  }

  // Build CSV header
  const headers = [
    "date",
    "sport",
    "pickType",
    "homeTeam",
    "awayTeam",
    "pickSide",
    "line",
    "trendScore",
    "confidence",
    ...SIGNAL_COLUMNS.map((s) => `signal_${s}`),
    "result",
    "correct",
  ];

  const rows: string[] = [headers.join(",")];

  for (const pick of picks) {
    const reasoning = (pick.reasoning as unknown as ReasoningEntry[]) || [];

    // Extract signal magnitudes from reasoning array
    const signalMap: Record<string, number> = {};
    for (const entry of reasoning) {
      // Match by category or angle name
      const key = entry.category || inferCategory(entry.angle);
      if (key && SIGNAL_COLUMNS.includes(key)) {
        signalMap[key] = entry.magnitude ?? entry.weight ?? 0;
      }
    }

    const row = [
      pick.date.toISOString().split("T")[0],
      pick.sport,
      pick.pickType,
      escapeCSV(pick.homeTeam),
      escapeCSV(pick.awayTeam),
      pick.pickSide,
      pick.line?.toString() ?? "",
      pick.trendScore.toString(),
      pick.confidence.toString(),
      ...SIGNAL_COLUMNS.map((s) => (signalMap[s] ?? 0).toString()),
      pick.result,
      pick.result === "WIN" ? "1" : pick.result === "LOSS" ? "0" : "",
    ];

    rows.push(row.join(","));
  }

  // Write to file
  const fs = await import("fs");
  const outputPath = "scripts/training-data.csv";
  fs.writeFileSync(outputPath, rows.join("\n") + "\n");
  console.log(`Exported ${picks.length} picks to ${outputPath}`);

  // Print summary stats
  const wins = picks.filter((p) => p.result === "WIN").length;
  const losses = picks.filter((p) => p.result === "LOSS").length;
  const pushes = picks.filter((p) => p.result === "PUSH").length;
  console.log(`  Wins: ${wins} (${((wins / picks.length) * 100).toFixed(1)}%)`);
  console.log(`  Losses: ${losses}`);
  console.log(`  Pushes: ${pushes}`);
  console.log(`  By sport: ${[...new Set(picks.map((p) => p.sport))].join(", ")}`);
  console.log(`  By type: ${[...new Set(picks.map((p) => p.pickType))].join(", ")}`);
  console.log(`  Date range: ${picks[0].date.toISOString().split("T")[0]} to ${picks[picks.length - 1].date.toISOString().split("T")[0]}`);

  await prisma.$disconnect();
}

/** Infer signal category from reasoning entry angle text */
function inferCategory(angle: string): string | null {
  const lower = angle.toLowerCase();
  if (lower.includes("model") || lower.includes("kenpom") || lower.includes("regression")) return "modelEdge";
  if (lower.includes("season ats") || lower.includes("ats record")) return "seasonATS";
  if (lower.includes("trend") || lower.includes("angle")) return "trendAngles";
  if (lower.includes("recent") || lower.includes("form") || lower.includes("last")) return "recentForm";
  if (lower.includes("h2h") || lower.includes("head-to-head")) return "h2h";
  if (lower.includes("situation") || lower.includes("primetime") || lower.includes("bye")) return "situational";
  if (lower.includes("rest") || lower.includes("days off")) return "restDays";
  if (lower.includes("market") || lower.includes("moneyline") || lower.includes("implied")) return "marketEdge";
  if (lower.includes("season o/u") || lower.includes("ou record")) return "seasonOU";
  if (lower.includes("weather") || lower.includes("h2h") && lower.includes("total")) return "h2hWeather";
  if (lower.includes("tempo") || lower.includes("pace")) return "tempoDiff";
  return null;
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
