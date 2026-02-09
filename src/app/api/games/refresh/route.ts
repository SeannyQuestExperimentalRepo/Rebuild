/**
 * POST /api/games/refresh?sport=NFL
 *
 * Fetches fresh odds from ESPN and upserts into the UpcomingGame table.
 * Called by: manual refresh button in sidebar, cron job.
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshUpcomingGames } from "@/lib/espn-sync";
import type { Sport } from "@/lib/espn-api";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const VALID_SPORTS: Sport[] = ["NFL", "NCAAF", "NCAAMB"];

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sport = searchParams.get("sport")?.toUpperCase() as Sport | undefined;

  if (!sport || !VALID_SPORTS.includes(sport)) {
    return NextResponse.json(
      { success: false, error: "sport must be NFL, NCAAF, or NCAAMB" },
      { status: 400 },
    );
  }

  try {
    const result = await refreshUpcomingGames(sport);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error(`[POST /api/games/refresh] Error for ${sport}:`, err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to refresh games",
      },
      { status: 500 },
    );
  }
}
