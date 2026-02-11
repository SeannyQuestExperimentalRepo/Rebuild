/**
 * GET    /api/bets/:id — Get a single bet
 * PATCH  /api/bets/:id — Update a bet (result, notes, stake, odds, etc.)
 * DELETE /api/bets/:id — Delete a bet
 */

import { NextRequest, NextResponse } from "next/server";
import { authLimiter, applyRateLimit } from "@/lib/rate-limit";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/db";
import type { BetResult } from "@prisma/client";

export const dynamic = "force-dynamic";

const VALID_RESULTS: BetResult[] = ["WIN", "LOSS", "PUSH", "PENDING"];

function oddsToPayoutMultiplier(odds: number): number {
  if (odds >= 100) return odds / 100;
  if (odds <= -100) return 100 / Math.abs(odds);
  return 0;
}

function calculateProfit(
  stake: number,
  odds: number,
  result: BetResult,
): number | null {
  if (result === "PENDING") return null;
  if (result === "PUSH") return 0;
  if (result === "WIN") return stake * oddsToPayoutMultiplier(odds);
  return -stake;
}

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET ─────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const limited = applyRateLimit(_req, authLimiter, session.user.id);
    if (limited) return limited;

    const { id } = await context.params;
    const bet = await prisma.bet.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!bet) {
      return NextResponse.json(
        { success: false, error: "Bet not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, bet });
  } catch (error) {
    console.error("[GET /api/bets/:id]", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch bet" },
      { status: 500 },
    );
  }
}

// ─── PATCH ───────────────────────────────────────────────────────────────

interface PatchBody {
  result?: BetResult;
  notes?: string;
  stake?: number;
  oddsValue?: number;
  sportsbook?: string;
  line?: number;
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const limited = applyRateLimit(req, authLimiter, session.user.id);
    if (limited) return limited;

    const { id } = await context.params;
    const existing = await prisma.bet.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Bet not found" },
        { status: 404 },
      );
    }

    const body = (await req.json()) as PatchBody;
    const updateData: Record<string, unknown> = {};

    if (body.result && VALID_RESULTS.includes(body.result)) {
      updateData.result = body.result;
      const stake = body.stake ?? existing.stake;
      const odds = body.oddsValue ?? existing.oddsValue;
      updateData.profit = calculateProfit(stake, odds, body.result);
      updateData.gradedAt = body.result !== "PENDING" ? new Date() : null;
    }
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.stake !== undefined && body.stake > 0) {
      updateData.stake = body.stake;
      const odds = body.oddsValue ?? existing.oddsValue;
      updateData.toWin =
        Math.round(body.stake * oddsToPayoutMultiplier(odds) * 100) / 100;
    }
    if (body.oddsValue !== undefined) {
      updateData.oddsValue = body.oddsValue;
      const stake = body.stake ?? existing.stake;
      updateData.toWin =
        Math.round(stake * oddsToPayoutMultiplier(body.oddsValue) * 100) / 100;
    }
    if (body.sportsbook !== undefined) updateData.sportsbook = body.sportsbook;
    if (body.line !== undefined) updateData.line = body.line;

    // Recalculate profit if stake/odds changed on an already-graded bet
    const effectiveResult = (updateData.result as BetResult) ?? existing.result;
    if (
      effectiveResult !== "PENDING" &&
      !updateData.profit &&
      (body.stake !== undefined || body.oddsValue !== undefined)
    ) {
      const stake = (updateData.stake as number) ?? existing.stake;
      const odds = (updateData.oddsValue as number) ?? existing.oddsValue;
      updateData.profit = calculateProfit(stake, odds, effectiveResult);
    }

    const updated = await prisma.bet.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, bet: updated });
  } catch (error) {
    console.error("[PATCH /api/bets/:id]", error);
    return NextResponse.json(
      { success: false, error: "Failed to update bet" },
      { status: 500 },
    );
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, context: RouteContext) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const limited = applyRateLimit(_req, authLimiter, session.user.id);
    if (limited) return limited;

    const { id } = await context.params;
    const existing = await prisma.bet.findFirst({
      where: { id, userId: session.user.id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Bet not found" },
        { status: 404 },
      );
    }

    await prisma.bet.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("[DELETE /api/bets/:id]", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete bet" },
      { status: 500 },
    );
  }
}
