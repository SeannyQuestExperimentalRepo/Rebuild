import { NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cwd: process.cwd(),
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "SET (hidden)" : "NOT SET",
      NODE_ENV: process.env.NODE_ENV,
    },
  };

  // Check filesystem
  try {
    const dataDir = path.resolve(process.cwd(), "data");
    diagnostics.dataDirExists = fs.existsSync(dataDir);
    if (fs.existsSync(dataDir)) {
      diagnostics.dataFiles = fs.readdirSync(dataDir).slice(0, 10);
    }
  } catch (err) {
    diagnostics.fsError = err instanceof Error ? err.message : String(err);
  }

  // Test Prisma import
  try {
    const { prisma } = await import("@/lib/db");
    diagnostics.prismaImport = "OK";
    const count = await prisma.team.count();
    diagnostics.teamCount = count;
    diagnostics.dbConnection = "OK";
  } catch (err) {
    diagnostics.prismaError = err instanceof Error ? err.message : String(err);
    diagnostics.prismaStack = err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined;
  }

  // Test significance-enrichment import (the suspected culprit)
  try {
    const mod = await import("@/lib/significance-enrichment");
    diagnostics.significanceImport = "OK";
    diagnostics.significanceExports = Object.keys(mod);
  } catch (err) {
    diagnostics.significanceError = err instanceof Error ? err.message : String(err);
    diagnostics.significanceStack = err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined;
  }

  // Test player-trend-engine import
  try {
    const mod = await import("@/lib/player-trend-engine");
    diagnostics.playerEngineImport = "OK";
    diagnostics.playerEngineExports = Object.keys(mod);
  } catch (err) {
    diagnostics.playerEngineError = err instanceof Error ? err.message : String(err);
    diagnostics.playerEngineStack = err instanceof Error ? err.stack?.split("\n").slice(0, 5) : undefined;
  }

  // Test executeTrendQueryCached
  try {
    const { executeTrendQueryCached, buildQuery } = await import("@/lib/trend-engine");
    const query = buildQuery("NFL", { team: "Chiefs", perspective: "team", filters: [] });
    const result = await executeTrendQueryCached(query);
    diagnostics.queryTest = {
      success: true,
      games: result.games.length,
      wins: result.summary.wins,
    };
  } catch (err) {
    diagnostics.queryError = err instanceof Error ? err.message : String(err);
    diagnostics.queryStack = err instanceof Error ? err.stack?.split("\n").slice(0, 8) : undefined;
  }

  return NextResponse.json(diagnostics);
}
