"use client";

import Link from "next/link";
import { HeroSection } from "./hero-section";
import { SportCards } from "./sport-cards";
import { FeaturesGrid } from "./features-grid";

interface DatasetStats {
  nfl: { totalGames: number; seasons: [number, number] | null };
  ncaaf: { totalGames: number; seasons: [number, number] | null };
  ncaamb: { totalGames: number; seasons: [number, number] | null };
  total: number;
}

export function HomeContent({ stats }: { stats: DatasetStats | null }) {
  const sportCards = [
    {
      sport: "NFL",
      games: stats?.nfl.totalGames,
      years: stats?.nfl.seasons
        ? `${stats.nfl.seasons[0]} \u2013 ${stats.nfl.seasons[1]}`
        : "",
      href: "/search?q=NFL home favorites",
      available: true,
    },
    {
      sport: "NCAAF",
      games: stats?.ncaaf.totalGames,
      years: stats?.ncaaf.seasons
        ? `${stats.ncaaf.seasons[0]} \u2013 ${stats.ncaaf.seasons[1]}`
        : "",
      href: "/search?q=NCAAF ranked teams",
      available: (stats?.ncaaf.totalGames || 0) > 0,
    },
    {
      sport: "NCAAMB",
      games: stats?.ncaamb.totalGames,
      years: stats?.ncaamb.seasons
        ? `${stats.ncaamb.seasons[0]} \u2013 ${stats.ncaamb.seasons[1]}`
        : "",
      href: "/search?q=NCAAMB favorites",
      available: (stats?.ncaamb.totalGames || 0) > 0,
    },
  ];

  return (
    <div className="flex flex-col">
      <HeroSection totalGames={stats?.total ?? null} />
      <SportCards cards={sportCards} totalGames={stats?.total ?? null} />
      <FeaturesGrid />

      {/* Final CTA */}
      <section className="hero-mesh noise-overlay relative border-t border-border/40">
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/10">
            <svg
              className="h-5 w-5 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Start Finding Edges
          </h2>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            Search across decades of historical data with natural language
            queries. Uncover the trends that sharps rely on.
          </p>
          <Link
            href="/search"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110"
          >
            Search Trends
            <svg
              className="h-4 w-4"
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
        </div>
      </section>
    </div>
  );
}
