"use client";

import React from "react";
import WarRoomNav from "./WarRoomNav";
import WarRoomCarousel, { type CarouselCard } from "./WarRoomCarousel";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const FEATURED_CARDS: CarouselCard[] = [
  {
    id: "1",
    awayTeam: "Michigan",
    homeTeam: "Ohio State",
    awayColor: "#00274C",
    homeColor: "#BB0000",
    awayRecord: "22-5",
    homeRecord: "19-8",
    spread: "UNDER 141.5",
    pick: "Under 141.5 (-110)",
    pickSide: "away",
    confidence: 5,
    hook: "Michigan's defense makes this total a lock. The Wolverines hold opponents to 58.3 PPG in Big Ten play.",
    time: "7:00 PM ET",
    league: "NCAAM",
  },
  {
    id: "2",
    awayTeam: "Celtics",
    homeTeam: "Knicks",
    awayColor: "#007A33",
    homeColor: "#006BB6",
    awayRecord: "42-14",
    homeRecord: "36-20",
    spread: "BOS -3.5",
    pick: "Celtics -3.5 (-108)",
    pickSide: "away",
    confidence: 4,
    hook: "Boston is 14-3 ATS as a road favorite this season. The Knicks' pace plays right into their hands.",
    time: "7:30 PM ET",
    league: "NBA",
  },
  {
    id: "3",
    awayTeam: "Duke",
    homeTeam: "North Carolina",
    awayColor: "#003087",
    homeColor: "#7BAFD4",
    awayRecord: "24-3",
    homeRecord: "20-7",
    spread: "DUKE -2.5",
    pick: "Duke -2.5 (-112)",
    pickSide: "away",
    confidence: 4,
    hook: "Cooper Flagg is averaging 22.4 PPG in rivalry games. Duke's length suffocates UNC's transition game.",
    time: "9:00 PM ET",
    league: "NCAAM",
  },
  {
    id: "4",
    awayTeam: "Lakers",
    homeTeam: "Warriors",
    awayColor: "#552583",
    homeColor: "#1D428A",
    awayRecord: "30-26",
    homeRecord: "28-28",
    spread: "OVER 224.5",
    pick: "Over 224.5 (-110)",
    pickSide: "home",
    confidence: 3,
    hook: "These teams have gone over in 7 of their last 9 meetings. Combined pace ranks top 5 in the league.",
    time: "10:00 PM ET",
    league: "NBA",
  },
  {
    id: "5",
    awayTeam: "Auburn",
    homeTeam: "Alabama",
    awayColor: "#0C2340",
    homeColor: "#9E1B32",
    awayRecord: "25-2",
    homeRecord: "18-9",
    spread: "AUB -4",
    pick: "Auburn -4 (-110)",
    pickSide: "away",
    confidence: 5,
    hook: "The #1 team in the country is playing its best basketball of the season. Alabama's defense can't stop the post.",
    time: "6:00 PM ET",
    league: "NCAAM",
  },
];

interface DeepDive {
  id: string;
  headline: string;
  subhead: string;
  teams: string;
  league: string;
  readTime: string;
  gradient: string;
}

const DEEP_DIVES: DeepDive[] = [
  {
    id: "dd1",
    headline: "Why Michigan's Defense Makes This Total a Lock",
    subhead:
      "The Wolverines have held 8 straight opponents under their season scoring average. Our model sees a floor collapse in Columbus.",
    teams: "Michigan at Ohio State",
    league: "NCAAM",
    readTime: "6 min read",
    gradient: "from-[#00274C]/30 to-[#BB0000]/20",
  },
  {
    id: "dd2",
    headline: "The Cooper Flagg Effect: Duke's X-Factor in Rivalry Games",
    subhead:
      "When Flagg plays 35+ minutes, Duke is 11-1 ATS. His defensive versatility breaks UNC's offensive identity.",
    teams: "Duke at North Carolina",
    league: "NCAAM",
    readTime: "8 min read",
    gradient: "from-[#003087]/30 to-[#7BAFD4]/20",
  },
  {
    id: "dd3",
    headline: "Boston's Road Dominance Is No Fluke — And New York Is the Perfect Victim",
    subhead:
      "The Celtics' switching defense turns the Knicks' iso-heavy attack into a turnover machine. Here's the data.",
    teams: "Celtics at Knicks",
    league: "NBA",
    readTime: "5 min read",
    gradient: "from-[#007A33]/30 to-[#006BB6]/20",
  },
];

interface QuickHit {
  id: string;
  matchup: string;
  pick: string;
  confidence: number;
  edge: string;
  league: string;
}

const QUICK_HITS: QuickHit[] = [
  { id: "qh1", matchup: "Baylor at Kansas St", pick: "Baylor +5.5", confidence: 2, edge: "+2.1%", league: "NCAAM" },
  { id: "qh2", matchup: "Pacers at Hawks", pick: "Over 237", confidence: 2, edge: "+1.8%", league: "NBA" },
  { id: "qh3", matchup: "TCU at Texas Tech", pick: "Texas Tech -7", confidence: 3, edge: "+3.2%", league: "NCAAM" },
  { id: "qh4", matchup: "Nets at Pistons", pick: "Pistons -2", confidence: 2, edge: "+1.5%", league: "NBA" },
  { id: "qh5", matchup: "Iowa St at Houston", pick: "Under 128.5", confidence: 3, edge: "+2.9%", league: "NCAAM" },
  { id: "qh6", matchup: "Suns at Nuggets", pick: "Nuggets -4.5", confidence: 2, edge: "+1.7%", league: "NBA" },
];

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i < count ? "text-amber-400" : "text-[#2a2a4a]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WarRoomHome() {
  return (
    <div className="min-h-screen bg-[#0f0f1a] text-[#f5f0e8]">
      <WarRoomNav activeSection="Today" />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#00274C]/20 via-[#1a1a2e] to-[#BB0000]/10" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjAzKSIvPjwvc3ZnPg==')] opacity-50" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-block w-8 h-px bg-amber-400" />
            <span className="text-[11px] uppercase tracking-[0.2em] text-amber-400 font-medium">
              Today&apos;s War Room — February 14, 2026
            </span>
          </div>

          <h2
            className="text-4xl sm:text-5xl lg:text-6xl leading-[1.1] mb-6 max-w-3xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Michigan&apos;s Defense Makes This Total a Lock
          </h2>

          <p className="text-lg text-[#c0c0d0] max-w-2xl mb-8 leading-relaxed">
            Five picks today, including two five-star plays. The Wolverines&apos; suffocating defense meets Ohio
            State&apos;s stagnant offense in what our model calls the most lopsided total of the season.
          </p>

          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm text-[#a0a0b8]">5 picks today</span>
            </div>
            <div className="text-sm text-[#a0a0b8]">
              <span className="text-emerald-400 font-semibold">3-1</span> yesterday
            </div>
            <div className="text-sm text-[#a0a0b8]">
              <span className="text-amber-400 font-semibold">+12.4u</span> this week
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Carousel ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-block w-6 h-px bg-amber-400/60" />
          <h3
            className="text-xl text-[#f5f0e8]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Featured Matchups
          </h3>
        </div>
        <WarRoomCarousel cards={FEATURED_CARDS} />
      </section>

      {/* ── Deep Dives ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-[#2a2a4a]">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-block w-6 h-px bg-amber-400/60" />
          <h3
            className="text-xl text-[#f5f0e8]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Deep Dives
          </h3>
        </div>

        <div className="space-y-6">
          {DEEP_DIVES.map((dive) => (
            <article
              key={dive.id}
              className={`relative overflow-hidden rounded-xl bg-gradient-to-r ${dive.gradient} border border-[#2a2a4a] hover:border-[#3a3a5a] transition-colors cursor-pointer group`}
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 font-medium">
                    {dive.league}
                  </span>
                  <span className="text-[#2a2a4a]">•</span>
                  <span className="text-[11px] text-[#a0a0b8]">{dive.teams}</span>
                  <span className="text-[#2a2a4a]">•</span>
                  <span className="text-[11px] text-[#a0a0b8]">{dive.readTime}</span>
                </div>

                <h4
                  className="text-2xl sm:text-3xl mb-3 group-hover:text-amber-200 transition-colors"
                  style={{ fontFamily: "Georgia, serif" }}
                >
                  {dive.headline}
                </h4>

                <p className="text-[#c0c0d0] max-w-3xl leading-relaxed">{dive.subhead}</p>

                <div className="mt-4 flex items-center gap-2 text-amber-400 text-sm font-medium">
                  Read analysis
                  <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Quick Hits ── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-[#2a2a4a]">
        <div className="flex items-center gap-3 mb-2">
          <span className="inline-block w-6 h-px bg-amber-400/60" />
          <h3
            className="text-xl text-[#f5f0e8]"
            style={{ fontFamily: "Georgia, serif" }}
          >
            Quick Hits
          </h3>
        </div>
        <p className="text-sm text-[#a0a0b8] mb-6 ml-9">
          Lower-confidence leans. Smaller edges, but worth a look.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {QUICK_HITS.map((hit) => (
            <div
              key={hit.id}
              className="flex items-center justify-between p-4 rounded-lg bg-[#16162a] border border-[#2a2a4a] hover:border-[#3a3a5a] transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-amber-400/70">{hit.league}</span>
                </div>
                <div className="text-sm text-[#a0a0b8] truncate">{hit.matchup}</div>
                <div className="text-sm font-semibold text-[#f5f0e8] mt-0.5">{hit.pick}</div>
              </div>
              <div className="flex flex-col items-end gap-1 ml-3">
                <Stars count={hit.confidence} />
                <span className="text-xs text-emerald-400 font-medium">{hit.edge} edge</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-[#2a2a4a] py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h4 className="text-lg text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
                Trendline
              </h4>
              <p className="text-sm text-[#a0a0b8] mt-1">Data-driven sports analysis. Every pick published.</p>
            </div>
            <p className="text-xs text-[#a0a0b8]">
              For entertainment purposes only. Please gamble responsibly.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
