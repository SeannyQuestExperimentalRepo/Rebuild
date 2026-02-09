/**
 * POST /api/cron/daily-sync
 *
 * Daily cron job that:
 * 1. Syncs yesterday's completed games into the historical DB
 * 2. Refreshes upcoming games with current odds
 *
 * Protected by CRON_SECRET header (Vercel Cron sends this automatically).
 *
 * Schedule: 0 11 * * * (11:00 UTC = 6:00 AM ET)
 */

import { NextRequest, NextResponse } from "next/server";
import { syncCompletedGames, refreshUpcomingGames } from "@/lib/espn-sync";
import type { Sport } from "@/lib/espn-api";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SPORTS: Sport[] = ["NFL", "NCAAF", "NCAAMB"];

export async function POST(request: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }
  }

  const start = performance.now();
  const results: Record<string, unknown> = {};

  try {
    // 1. Sync yesterday's completed games
    for (const sport of SPORTS) {
      try {
        const syncResult = await syncCompletedGames(sport);
        results[`sync_${sport}`] = syncResult;
      } catch (err) {
        console.error(`[Cron] Sync failed for ${sport}:`, err);
        results[`sync_${sport}`] = {
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    // 2. Refresh upcoming games with odds
    for (const sport of SPORTS) {
      try {
        const refreshResult = await refreshUpcomingGames(sport);
        results[`refresh_${sport}`] = refreshResult;
      } catch (err) {
        console.error(`[Cron] Refresh failed for ${sport}:`, err);
        results[`refresh_${sport}`] = {
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    }

    const durationMs = Math.round(performance.now() - start);

    return NextResponse.json({
      success: true,
      data: results,
      meta: { durationMs },
    });
  } catch (err) {
    console.error("[Cron] Fatal error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

// Also support GET for Vercel Cron (which sends GET requests)
export async function GET(request: NextRequest) {
  return POST(request);
}
