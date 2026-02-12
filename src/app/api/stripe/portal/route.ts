/**
 * POST /api/stripe/portal
 *
 * Creates a Stripe Customer Portal session so users can manage their
 * subscription (upgrade, downgrade, cancel, update payment method).
 * Requires authentication + active Stripe customer.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { authLimiter, applyRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { success: false, error: "Billing is not configured" },
        { status: 503 },
      );
    }

    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Authentication required" },
        { status: 401 },
      );
    }

    const limited = applyRateLimit(req, authLimiter, session.user.id);
    if (limited) return limited;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { success: false, error: "No billing account found. Subscribe first." },
        { status: 400 },
      );
    }

    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/pricing`,
    });

    return NextResponse.json({
      success: true,
      url: portalSession.url,
    });
  } catch (error) {
    console.error("[POST /api/stripe/portal]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create portal session" },
      { status: 500 },
    );
  }
}
