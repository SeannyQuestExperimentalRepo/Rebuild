/**
 * POST /api/stripe/checkout
 *
 * Creates a Stripe Checkout Session for Premium subscription.
 * Requires authentication. Accepts { plan: "monthly" | "annual" }.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/../../auth";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured, STRIPE_PRICES } from "@/lib/stripe";
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

    const body = (await req.json()) as { plan?: string };
    const plan = body.plan === "annual" ? "annual" : "monthly";
    const priceId = plan === "annual" ? STRIPE_PRICES.annual : STRIPE_PRICES.monthly;

    if (!priceId) {
      return NextResponse.json(
        { success: false, error: "Price not configured for this plan" },
        { status: 500 },
      );
    }

    // Look up user to get or create Stripe customer
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true, stripeCustomerId: true, role: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 },
      );
    }

    if (user.role === "PREMIUM" || user.role === "ADMIN") {
      return NextResponse.json(
        { success: false, error: "You already have an active subscription" },
        { status: 400 },
      );
    }

    // Get or create Stripe customer
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    // Create Checkout Session
    const origin = req.headers.get("origin") || process.env.NEXTAUTH_URL || "http://localhost:3000";
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/pricing?success=true`,
      cancel_url: `${origin}/pricing?canceled=true`,
      metadata: { userId: user.id },
    });

    return NextResponse.json({
      success: true,
      url: checkoutSession.url,
    });
  } catch (error) {
    console.error("[POST /api/stripe/checkout]", error);
    return NextResponse.json(
      { success: false, error: "Failed to create checkout session" },
      { status: 500 },
    );
  }
}
