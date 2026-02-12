import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import type { Sport } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const VALID_SPORTS: Sport[] = ["NFL", "NCAAF", "NCAAMB", "NBA"];

function todayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

export async function POST(req: NextRequest) {
  if (!isAdminAuthenticated(req)) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const body = await req.json();
  const { action, sport } = body as { action: string; sport?: string };

  try {
    switch (action) {
      case "delete-picks-today": {
        const dateStr = todayET();
        const dateKey = new Date(dateStr + "T00:00:00Z");
        const where: Record<string, unknown> = { date: dateKey };
        if (sport && VALID_SPORTS.includes(sport as Sport)) {
          where.sport = sport;
        }
        const { count } = await prisma.dailyPick.deleteMany({ where });
        return NextResponse.json({
          success: true,
          message: `Deleted ${count} picks for ${dateStr}${sport ? ` (${sport})` : ""}`,
        });
      }

      case "refresh-games": {
        const { refreshUpcomingGames } = await import("@/lib/espn-sync");
        const sports = sport && VALID_SPORTS.includes(sport as Sport)
          ? [sport as Sport]
          : (["NFL", "NCAAF", "NCAAMB"] as Sport[]);
        const results: Record<string, unknown> = {};
        for (const s of sports) {
          const result = await refreshUpcomingGames(s);
          results[s] = result;
        }
        return NextResponse.json({ success: true, results });
      }

      case "trigger-picks": {
        const { generateDailyPicks } = await import("@/lib/pick-engine");
        const dateStr = todayET();
        const dateKey = new Date(dateStr + "T00:00:00Z");
        const targetSport = sport && VALID_SPORTS.includes(sport as Sport)
          ? sport as Sport
          : "NCAAMB" as Sport;

        // Delete existing picks first
        await prisma.dailyPick.deleteMany({
          where: { date: dateKey, sport: targetSport },
        });

        const picks = await generateDailyPicks(dateStr, targetSport);
        if (picks.length > 0) {
          await prisma.dailyPick.createMany({
            data: picks.map((p) => ({
              date: dateKey,
              sport: p.sport,
              pickType: p.pickType,
              homeTeam: p.homeTeam,
              awayTeam: p.awayTeam,
              gameDate: p.gameDate,
              pickSide: p.pickSide,
              line: p.line,
              pickLabel: p.pickLabel,
              playerName: p.playerName,
              propStat: p.propStat,
              propLine: p.propLine,
              trendScore: p.trendScore,
              confidence: p.confidence,
              headline: p.headline,
              reasoning: p.reasoning as unknown as import("@prisma/client").Prisma.InputJsonValue,
            })),
            skipDuplicates: true,
          });
        }

        return NextResponse.json({
          success: true,
          message: `Generated ${picks.length} picks for ${targetSport} on ${dateStr}`,
        });
      }

      case "system-status": {
        const dateStr = todayET();
        const dateKey = new Date(dateStr + "T00:00:00Z");
        const dateStartET = new Date(dateStr + "T05:00:00Z");

        const [pickCounts, upcomingCounts, userCount, betCount] = await Promise.all([
          prisma.dailyPick.groupBy({
            by: ["sport"],
            where: { date: dateKey },
            _count: true,
          }),
          prisma.upcomingGame.groupBy({
            by: ["sport"],
            where: { gameDate: { gte: dateStartET } },
            _count: true,
          }),
          prisma.user.count(),
          prisma.bet.count(),
        ]);

        return NextResponse.json({
          success: true,
          status: {
            date: dateStr,
            picks: Object.fromEntries(pickCounts.map((r) => [r.sport, r._count])),
            upcomingGames: Object.fromEntries(upcomingCounts.map((r) => [r.sport, r._count])),
            totalUsers: userCount,
            totalBets: betCount,
          },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error("[admin/actions]", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
