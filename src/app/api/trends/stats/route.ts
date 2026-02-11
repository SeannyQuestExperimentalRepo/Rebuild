/**
 * Dataset Statistics API Route
 *
 * GET /api/trends/stats — Returns game counts, season ranges, and
 * feature flags for each sport in the TrendLine dataset.
 *
 * Uses direct Prisma aggregates instead of loading full game tables.
 */

import { NextRequest, NextResponse } from "next/server";
import { publicLimiter, applyRateLimit } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const limited = applyRateLimit(req, publicLimiter);
  if (limited) return limited;

  try {
    const start = performance.now();

    const [
      nflAgg,
      ncaafAgg,
      ncaambAgg,
      nflHasSpread,
      ncaafHasWeather,
      ncaambHasKenpom,
    ] = await Promise.all([
      prisma.nFLGame.aggregate({
        _count: true,
        _min: { season: true },
        _max: { season: true },
      }),
      prisma.nCAAFGame.aggregate({
        _count: true,
        _min: { season: true },
        _max: { season: true },
      }),
      prisma.nCAAMBGame.aggregate({
        _count: true,
        _min: { season: true },
        _max: { season: true },
      }),
      prisma.nFLGame.count({
        where: { spread: { not: null } },
        take: 1,
      }),
      prisma.nCAAFGame.count({
        where: { weatherCategory: { not: null } },
        take: 1,
      }),
      prisma.nCAAMBGame.count({
        where: { homeKenpomRank: { not: null } },
        take: 1,
      }),
    ]);

    const nflSeasons =
      nflAgg._min.season != null && nflAgg._max.season != null
        ? [nflAgg._min.season, nflAgg._max.season]
        : null;
    const ncaafSeasons =
      ncaafAgg._min.season != null && ncaafAgg._max.season != null
        ? [ncaafAgg._min.season, ncaafAgg._max.season]
        : null;
    const ncaambSeasons =
      ncaambAgg._min.season != null && ncaambAgg._max.season != null
        ? [ncaambAgg._min.season, ncaambAgg._max.season]
        : null;

    const durationMs = Math.round(performance.now() - start);

    const response = NextResponse.json({
      success: true,
      data: {
        nfl: {
          totalGames: nflAgg._count,
          seasons: nflSeasons,
          hasSpread: nflHasSpread > 0,
        },
        ncaaf: {
          totalGames: ncaafAgg._count,
          seasons: ncaafSeasons,
          hasWeather: ncaafHasWeather > 0,
        },
        ncaamb: {
          totalGames: ncaambAgg._count,
          seasons: ncaambSeasons,
          hasKenpom: ncaambHasKenpom > 0,
        },
        total: nflAgg._count + ncaafAgg._count + ncaambAgg._count,
      },
      meta: { durationMs },
    });
    response.headers.set(
      "Cache-Control",
      "s-maxage=3600, stale-while-revalidate=86400",
    );
    return response;
  } catch (err) {
    console.error("[GET /api/trends/stats] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
      },
      { status: 500 },
    );
  }
}
