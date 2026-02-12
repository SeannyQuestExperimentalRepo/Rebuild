/**
 * GET /api/games/live-scores?sport=NCAAMB&date=2026-02-11
 *
 * Returns live scores for today's games via ESPN scoreboard.
 * Used by the Today's Sheet to show in-progress and final scores.
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchScoreboard, mapTeamToCanonical } from "@/lib/espn-api";
import type { Sport } from "@/lib/espn-api";
import { publicLimiter, applyRateLimit } from "@/lib/rate-limit";
import { VALID_SPORTS } from "@/lib/trend-engine";

export const dynamic = "force-dynamic";

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export async function GET(req: NextRequest) {
  const limited = applyRateLimit(req, publicLimiter);
  if (limited) return limited;

  const sport = req.nextUrl.searchParams.get("sport")?.toUpperCase();
  const date = req.nextUrl.searchParams.get("date") || todayET();

  if (!sport || !VALID_SPORTS.includes(sport)) {
    return NextResponse.json(
      { success: false, error: "sport is required (NFL, NCAAF, NCAAMB)" },
      { status: 400 },
    );
  }

  try {
    const games = await fetchScoreboard(sport as Sport, date);

    const sportKey = sport as Sport;
    const scores = games.map((g) => ({
      homeTeam: mapTeamToCanonical(g.homeTeam, sportKey) ?? g.homeTeam.displayName,
      awayTeam: mapTeamToCanonical(g.awayTeam, sportKey) ?? g.awayTeam.displayName,
      homeScore: g.homeTeam.score,
      awayScore: g.awayTeam.score,
      status: g.status,
      statusDetail: g.statusDetail,
      gameDate: g.date,
    }));

    return NextResponse.json(
      { success: true, sport, date, games: scores },
      {
        headers: {
          "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
        },
      },
    );
  } catch (err) {
    console.error("[GET /api/games/live-scores]", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch live scores" },
      { status: 500 },
    );
  }
}
