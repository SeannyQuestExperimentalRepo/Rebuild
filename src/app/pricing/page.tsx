"use client";

import { useState } from "react";
import Link from "next/link";
import { TIER_CONFIG, PRICING_FEATURES } from "@/lib/subscription";

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  const premium = TIER_CONFIG.PREMIUM;
  const monthlyPrice = annual
    ? Math.round(premium.priceAnnual / 12)
    : premium.priceMonthly;
  const savings = annual
    ? premium.priceMonthly * 12 - premium.priceAnnual
    : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          Upgrade to <span className="text-primary">Premium</span>
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Unlock every edge. Full access to picks, props, bet tracking, and live odds.
        </p>
      </div>

      {/* Billing toggle */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <span
          className={`text-sm font-medium ${!annual ? "text-foreground" : "text-muted-foreground"}`}
        >
          Monthly
        </span>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative h-6 w-11 rounded-full transition-colors ${
            annual ? "bg-primary" : "bg-border"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              annual ? "translate-x-[22px]" : "translate-x-0.5"
            }`}
          />
        </button>
        <span
          className={`text-sm font-medium ${annual ? "text-foreground" : "text-muted-foreground"}`}
        >
          Annual
          {annual && (
            <span className="ml-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-400">
              Save ${savings}
            </span>
          )}
        </span>
      </div>

      {/* Pricing cards */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {/* Free tier */}
        <div className="rounded-2xl border border-border/60 bg-card p-8">
          <h2 className="text-lg font-semibold">Free</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started with basic trend analysis
          </p>
          <div className="mt-6">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-sm text-muted-foreground">/mo</span>
          </div>
          <Link
            href="/login"
            className="mt-6 block rounded-lg border border-border/60 bg-secondary px-4 py-2.5 text-center text-sm font-medium transition-colors hover:bg-secondary/80"
          >
            Get Started
          </Link>
          <ul className="mt-8 space-y-3">
            {PRICING_FEATURES.map((f) => (
              <li key={f.key} className="flex items-center gap-3 text-sm">
                {f.free === false ? (
                  <svg className="h-4 w-4 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
                <span className={f.free === false ? "text-muted-foreground/60" : ""}>
                  {f.label}
                  {typeof f.free === "string" && (
                    <span className="ml-1 text-muted-foreground">({f.free})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Premium tier */}
        <div className="relative rounded-2xl border-2 border-primary/50 bg-card p-8">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-medium text-primary-foreground">
            Most Popular
          </div>
          <h2 className="text-lg font-semibold">Premium</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every edge, every angle, every game
          </p>
          <div className="mt-6">
            <span className="text-4xl font-bold">${monthlyPrice}</span>
            <span className="text-sm text-muted-foreground">/mo</span>
            {annual && (
              <span className="ml-2 text-sm text-muted-foreground">
                (${premium.priceAnnual}/yr)
              </span>
            )}
          </div>
          <button className="mt-6 w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
            Subscribe Now
          </button>
          <ul className="mt-8 space-y-3">
            {PRICING_FEATURES.map((f) => (
              <li key={f.key} className="flex items-center gap-3 text-sm">
                <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                <span>
                  {f.label}
                  {typeof f.premium === "string" && (
                    <span className="ml-1 text-muted-foreground">({f.premium})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* FAQ or trust signals */}
      <div className="mt-16 text-center">
        <p className="text-sm text-muted-foreground">
          Cancel anytime. No hidden fees. 7-day money-back guarantee.
        </p>
      </div>
    </div>
  );
}
