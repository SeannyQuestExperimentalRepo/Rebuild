/**
 * POST /api/stripe/webhook
 *
 * Handles Stripe webhook events for subscription lifecycle:
 *   - checkout.session.completed → Activate subscription (FREE → PREMIUM)
 *   - customer.subscription.updated → Sync subscription status
 *   - customer.subscription.deleted → Deactivate (PREMIUM → FREE)
 *
 * This route does NOT use auth() — it verifies the Stripe signature instead.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { stripe, isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing is not configured" },
      { status: 503 },
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 },
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Stripe webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdated(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionDeleted(subscription);
        break;
      }
      default:
        // Unhandled event type — acknowledge it
        console.log(`[Stripe webhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[Stripe webhook] Error handling ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

// ─── Event handlers ──────────────────────────────────────────────────────────

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  const subscriptionId = session.subscription as string;

  if (!customerId || !subscriptionId) {
    console.warn("[Stripe webhook] checkout.session.completed missing customer or subscription");
    return;
  }

  // Find user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (!user) {
    // Fallback: check metadata for userId
    const userId = session.metadata?.userId;
    if (userId) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: customerId,
          subscriptionId,
          subscriptionStatus: "active",
          role: "PREMIUM",
        },
      });
      console.log(`[Stripe webhook] Activated subscription for user ${userId} (via metadata)`);
      return;
    }
    console.error("[Stripe webhook] No user found for customer:", customerId);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionId,
      subscriptionStatus: "active",
      role: "PREMIUM",
    },
  });
  console.log(`[Stripe webhook] Activated subscription for user ${user.id}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const status = subscription.status; // active, past_due, canceled, unpaid, etc.

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true, role: true },
  });

  if (!user) {
    console.error("[Stripe webhook] subscription.updated — no user for customer:", customerId);
    return;
  }

  const isActive = status === "active" || status === "trialing";
  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: status,
      role: isActive ? "PREMIUM" : "FREE",
    },
  });
  console.log(`[Stripe webhook] Updated subscription for user ${user.id}: ${status} → role=${isActive ? "PREMIUM" : "FREE"}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  if (!user) {
    console.error("[Stripe webhook] subscription.deleted — no user for customer:", customerId);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionId: null,
      subscriptionStatus: "canceled",
      role: "FREE",
    },
  });
  console.log(`[Stripe webhook] Canceled subscription for user ${user.id}`);
}
