"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const EXAMPLE_QUERIES = [
  { label: "Home underdogs primetime NFL", icon: "\ud83c\udfc8" },
  { label: "Chiefs as favorites since 2020", icon: "\ud83d\udcc8" },
  { label: "Away teams after bye week NFL", icon: "\u23f0" },
  { label: "Ranked vs unranked NCAAF", icon: "\ud83c\udfc6" },
];

export function HeroSection({ totalGames }: { totalGames: number | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <section className="hero-mesh noise-overlay relative overflow-hidden">
      <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 pb-20 pt-24 text-center">
        {/* Decorative top line */}
        <div className="mb-8 flex items-center gap-3">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-primary/40" />
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
            Sports Betting Intelligence
          </span>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-primary/40" />
        </div>

        {/* Headline */}
        <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
          <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            Trend
          </span>
          <span className="text-foreground">Line</span>
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Find statistically significant betting trends across NFL, NCAAF, and
          NCAAMB. Powered by{" "}
          <span className="font-mono text-sm font-medium text-foreground">
            {totalGames
              ? `${totalGames.toLocaleString()} games`
              : "149,000+ games"}
          </span>{" "}
          of historical data.
        </p>

        {/* Search Bar */}
        <div className="mt-10 w-full max-w-xl">
          <div className="group relative rounded-xl border border-border/60 bg-card/80 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-300 focus-within:border-primary/40 focus-within:glow-primary">
            <div className="flex items-center gap-2">
              <svg
                className="ml-4 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
              <input
                type="text"
                placeholder='Try: "Home underdogs in primetime NFL"'
                className="flex-1 bg-transparent px-2 py-4 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
              <button
                onClick={handleSearch}
                disabled={!query.trim()}
                className="mr-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
              >
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Example Query Chips */}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {EXAMPLE_QUERIES.map((eq) => (
            <Link
              key={eq.label}
              href={`/search?q=${encodeURIComponent(eq.label)}`}
              className="gradient-border rounded-full border border-border/40 bg-secondary/60 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:bg-secondary hover:text-foreground"
            >
              <span className="mr-1.5">{eq.icon}</span>
              {eq.label}
            </Link>
          ))}
        </div>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/today"
            className="group/cta relative inline-flex items-center gap-2.5 overflow-hidden rounded-xl border border-accent/25 bg-accent/[0.07] px-6 py-3 text-sm font-semibold text-accent transition-all duration-300 hover:border-accent/40 hover:bg-accent/[0.12] hover:shadow-lg hover:shadow-accent/10"
          >
            <span className="text-base transition-transform duration-300 group-hover/cta:scale-110">
              &#9733;
            </span>
            <span>Today&apos;s Sheet</span>
            <span className="hidden text-xs font-normal text-accent/50 sm:inline">
              &mdash; AI-powered daily picks
            </span>
            <svg
              className="h-4 w-4 text-accent/40 transition-transform duration-300 group-hover/cta:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
          <Link
            href="/odds"
            className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-secondary/60 px-5 py-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:border-primary/30 hover:text-foreground"
          >
            Live Odds
          </Link>
          <Link
            href="/parlays"
            className="inline-flex items-center gap-2 rounded-xl border border-border/40 bg-secondary/60 px-5 py-3 text-sm font-medium text-muted-foreground transition-all duration-300 hover:border-primary/30 hover:text-foreground"
          >
            Parlay Builder
          </Link>
        </div>
      </div>
    </section>
  );
}
