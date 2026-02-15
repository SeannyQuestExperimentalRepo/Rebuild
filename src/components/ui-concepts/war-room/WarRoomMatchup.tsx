"use client";

import React, { useState } from "react";
import WarRoomNav from "./WarRoomNav";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Signal {
  name: string;
  rating: "strong" | "lean" | "neutral" | "against";
  direction: string;
  summary: string;
  detail: string;
}

interface StatRow {
  label: string;
  away: string;
  home: string;
  edge?: "away" | "home" | "neutral";
}

interface RelatedPick {
  id: string;
  matchup: string;
  pick: string;
  confidence: number;
  league: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const SIGNALS: Signal[] = [
  {
    name: "Defensive Efficiency",
    rating: "strong",
    direction: "Under",
    summary: "Michigan ranks 4th nationally in adjusted defensive efficiency (88.2)",
    detail:
      "The Wolverines have held 14 of their last 18 opponents below their season scoring average. Their perimeter defense forces opponents into long, contested two-point jumpers — the least efficient shot in basketball. Ohio State shoots just 29.4% from three on the road this season, and Michigan's closeout discipline should suppress that further. KenPom projects Michigan's defense to hold OSU to roughly 62 points, well below the 71 needed to push this over.",
  },
  {
    name: "Tempo & Pace",
    rating: "strong",
    direction: "Under",
    summary: "Both teams rank bottom-30 in adjusted tempo",
    detail:
      "Michigan plays at the 312th-fastest tempo in D1 (64.8 possessions/game), while Ohio State sits at 289th (65.4). In conference play, these numbers drop further — Michigan averages just 62.1 possessions in Big Ten games. Fewer possessions mean fewer scoring opportunities. The under has cashed in 71% of Michigan's Big Ten games this season.",
  },
  {
    name: "Offensive Trends",
    rating: "lean",
    direction: "Under",
    summary: "Ohio State's offense has regressed significantly in February",
    detail:
      "The Buckeyes are scoring just 64.2 PPG in their last 6 games, down from 72.8 in January. Their offensive rating has cratered to 98.3 in Big Ten play — ranking 11th in the conference. Key contributors are shooting a combined 38.2% from the field over this stretch. Without a reliable half-court creator, Ohio State struggles against set defenses.",
  },
  {
    name: "Sharp Money",
    rating: "strong",
    direction: "Under",
    summary: "Line movement from 143 to 141.5 despite balanced public action",
    detail:
      "The total opened at 143 and has been steamed down to 141.5 across major books. Public betting is roughly 52% on the over, yet the line keeps dropping — a classic indicator of sharp money on the under. At least two respected syndicate groups have been tracked on this under across multiple books.",
  },
  {
    name: "Injury Impact",
    rating: "neutral",
    direction: "Neutral",
    summary: "No significant injuries affecting the projection",
    detail:
      "Both teams are at full strength for this matchup. Ohio State's Meechie Johnson Jr. returned from a minor ankle sprain two games ago and has looked healthy. Michigan's full rotation is available. No lineup adjustments needed for our model.",
  },
  {
    name: "Venue & Travel",
    rating: "lean",
    direction: "Under",
    summary: "Value Coliseum ranks bottom-third in home-court offensive boost",
    detail:
      "Ohio State's home court advantage this season has been modest — visiting teams average 67.3 PPG at Value City Arena compared to their season average of 69.1. The building doesn't generate the hostile environment of Assembly Hall or Mackey Arena. Michigan has played well on the road (10-4 ATS), and their defensive identity travels.",
  },
  {
    name: "Historical Matchup",
    rating: "strong",
    direction: "Under",
    summary: "Under is 8-2 in the last 10 meetings between these teams",
    detail:
      "The under has dominated this series. In the last 10 Michigan-Ohio State games, the under has cashed 8 times with an average total of 127.6 points (against an average line of 139.2). These teams know each other well, game-plan conservatively, and grind possessions. The stylistic matchup overwhelmingly favors low scoring.",
  },
  {
    name: "Model Projection",
    rating: "strong",
    direction: "Under",
    summary: "Trendline model projects 133.7 total — 7.8 points below the line",
    detail:
      "Our composite model, which weights KenPom efficiency data, recent form, tempo adjustments, and venue factors, projects a final score of Michigan 68, Ohio State 65.7 — a combined 133.7. That's a full 7.8 points below the current line of 141.5, representing a significant edge. Any projection gap above 4 points historically cashes at a 67% rate.",
  },
  {
    name: "Public Perception",
    rating: "lean",
    direction: "Under",
    summary: "Rivalry game narrative inflates the total",
    detail:
      "Casual bettors often inflate totals in rivalry games, expecting high-emotion, fast-paced contests. But the data shows the opposite — coaches tighten rotations, play more conservatively, and emphasize defensive assignments in rivalry matchups. The public 'rivalry = high scoring' bias creates value on the under.",
  },
];

const STATS: StatRow[] = [
  { label: "Record", away: "22-5 (13-3)", home: "19-8 (9-7)", edge: "away" },
  { label: "ATS Record", away: "17-10", home: "12-14-1", edge: "away" },
  { label: "Adj. Off. Efficiency", away: "112.4 (28th)", home: "104.8 (78th)", edge: "away" },
  { label: "Adj. Def. Efficiency", away: "88.2 (4th)", home: "96.1 (52nd)", edge: "away" },
  { label: "Tempo (Poss/Game)", away: "64.8 (312th)", home: "65.4 (289th)", edge: "neutral" },
  { label: "3PT % (Season)", away: "35.2%", home: "33.1%", edge: "away" },
  { label: "3PT % (Road/Home)", away: "33.8%", home: "29.4%", edge: "away" },
  { label: "FT Rate", away: "32.1%", home: "28.7%", edge: "away" },
  { label: "Turnover %", away: "16.2%", home: "19.8%", edge: "away" },
  { label: "O-Reb %", away: "30.1%", home: "27.4%", edge: "away" },
];

const RELATED_PICKS: RelatedPick[] = [
  { id: "r1", matchup: "Duke at North Carolina", pick: "Duke -2.5", confidence: 4, league: "NCAAM" },
  { id: "r2", matchup: "Celtics at Knicks", pick: "Celtics -3.5", confidence: 4, league: "NBA" },
  { id: "r3", matchup: "Auburn at Alabama", pick: "Auburn -4", confidence: 5, league: "NCAAM" },
];

// ─── Signal Badge ────────────────────────────────────────────────────────────

function SignalBadge({ rating }: { rating: Signal["rating"] }) {
  const styles = {
    strong: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    lean: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    neutral: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    against: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded border ${styles[rating]}`}>
      {rating}
    </span>
  );
}

// ─── Stars ───────────────────────────────────────────────────────────────────

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} className={`w-4 h-4 ${i < count ? "text-amber-400" : "text-[#2a2a4a]"}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WarRoomMatchup() {
  const [expandedSignals, setExpandedSignals] = useState<Set<number>>(new Set());

  const toggleSignal = (index: number) => {
    setExpandedSignals((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-[#f5f0e8]">
      <WarRoomNav activeSection="Deep Dives" />

      {/* ── Hero Banner ── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #00274C 0%, #1a1a2e 50%, #BB0000 100%)",
            opacity: 0.3,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f1a] via-transparent to-transparent" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 font-medium bg-amber-400/10 px-2 py-1 rounded">
              NCAAM
            </span>
            <span className="text-[11px] text-[#a0a0b8]">February 14, 2026 • 7:00 PM ET</span>
          </div>

          <div className="flex items-center gap-6 sm:gap-10 mb-6">
            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center text-2xl font-bold" style={{ borderColor: "#00274C", backgroundColor: "#00274C33" }}>
                M
              </div>
              <div className="mt-2 font-semibold text-sm">Michigan</div>
              <div className="text-[11px] text-[#a0a0b8]">22-5 (13-3)</div>
            </div>

            <div className="text-center">
              <div className="text-[#a0a0b8] text-lg font-light" style={{ fontFamily: "Georgia, serif" }}>at</div>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border-2 flex items-center justify-center text-2xl font-bold" style={{ borderColor: "#BB0000", backgroundColor: "#BB000033" }}>
                OSU
              </div>
              <div className="mt-2 font-semibold text-sm">Ohio State</div>
              <div className="text-[11px] text-[#a0a0b8]">19-8 (9-7)</div>
            </div>
          </div>

          <h1
            className="text-3xl sm:text-4xl lg:text-5xl leading-tight max-w-3xl"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            Why Michigan&apos;s Defense Makes This Total a Lock
          </h1>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        {/* ── The Pick ── */}
        <div className="relative -mt-2 mb-12 p-6 rounded-xl bg-gradient-to-r from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-[11px] uppercase tracking-[0.15em] text-emerald-400 font-bold">The Pick</span>
            <Stars count={5} />
          </div>
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <span className="text-2xl font-bold" style={{ fontFamily: "Georgia, serif" }}>
              Under 141.5 (-110)
            </span>
            <div className="flex gap-6 text-sm">
              <span className="text-[#a0a0b8]">
                Confidence: <span className="text-emerald-400 font-semibold">92%</span>
              </span>
              <span className="text-[#a0a0b8]">
                Projected Total: <span className="text-[#f5f0e8] font-semibold">133.7</span>
              </span>
              <span className="text-[#a0a0b8]">
                Edge: <span className="text-emerald-400 font-semibold">+5.5%</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Narrative ── */}
        <section className="mb-14">
          <div className="prose prose-invert max-w-none">
            <p className="text-lg leading-relaxed text-[#d0d0e0]" style={{ fontFamily: "Georgia, serif" }}>
              There are games where the data whispers, and then there are games where it screams. Michigan at Ohio State on Valentine&apos;s Day is the latter — a confluence of defensive dominance, tempo suppression, and sharp money alignment that makes the under one of our strongest plays of the season.
            </p>
            <p className="text-[#c0c0d0] leading-relaxed mt-4" style={{ fontFamily: "Georgia, serif" }}>
              The Wolverines have been the most suffocating defensive team in the Big Ten since January, holding opponents to just 58.3 points per game in conference play. That number isn&apos;t a product of weak competition — it&apos;s a product of scheme. Michigan&apos;s pack-line defense forces teams into contested mid-range jumpers, the least efficient shot in basketball. Ohio State, a team already struggling offensively (64.2 PPG in their last six), walks directly into the buzzsaw.
            </p>
            <p className="text-[#c0c0d0] leading-relaxed mt-4" style={{ fontFamily: "Georgia, serif" }}>
              Then there&apos;s the tempo factor. Both teams rank in the bottom 30 nationally in pace of play, and in head-to-head matchups, that effect compounds. When two slow teams meet, possessions evaporate — and with them, scoring opportunities. Our model projects just 63.8 combined possessions in this game, which would make it the slowest game of the Big Ten season.
            </p>
          </div>
        </section>

        {/* ── The Case For / Against ── */}
        <section className="mb-14 grid md:grid-cols-2 gap-6">
          <div className="rounded-xl bg-emerald-900/10 border border-emerald-500/20 p-6">
            <h3
              className="text-xl mb-4 text-emerald-400"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The Case For the Under
            </h3>
            <ul className="space-y-3">
              {[
                "Michigan's defense holds opponents to 58.3 PPG in Big Ten play — best in the conference",
                "Both teams rank bottom-30 nationally in adjusted tempo",
                "The under is 8-2 in the last 10 head-to-head meetings",
                "Ohio State's offense has cratered in February: 64.2 PPG, 98.3 offensive rating",
                "Sharp money has steamed the line from 143 to 141.5",
                "Our model projects 133.7 — nearly 8 points below the line",
              ].map((point, i) => (
                <li key={i} className="flex gap-3 text-sm text-[#c0c0d0]">
                  <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl bg-red-900/10 border border-red-500/20 p-6">
            <h3
              className="text-xl mb-4 text-red-400"
              style={{ fontFamily: "Georgia, serif" }}
            >
              The Case Against
            </h3>
            <ul className="space-y-3">
              {[
                "Rivalry games can produce unpredictable scoring bursts and emotional runs",
                "Ohio State is 12-4 to the over at home this season",
                "Michigan's offense has shown flashes of efficiency (112.4 adj. offensive rating)",
                "Free throw attempts tend to spike in rivalry games, adding easy points",
                "The line has already been steamed — residual value may be limited",
              ].map((point, i) => (
                <li key={i} className="flex gap-3 text-sm text-[#c0c0d0]">
                  <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── Signal Breakdown ── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-block w-6 h-px bg-amber-400/60" />
            <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
              Signal Breakdown
            </h3>
          </div>

          <div className="space-y-2">
            {SIGNALS.map((signal, i) => (
              <div
                key={i}
                className="rounded-lg border border-[#2a2a4a] overflow-hidden bg-[#16162a] hover:border-[#3a3a5a] transition-colors"
              >
                <button
                  onClick={() => toggleSignal(i)}
                  className="w-full flex items-center justify-between p-4 text-left"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <SignalBadge rating={signal.rating} />
                    <span className="font-medium text-sm">{signal.name}</span>
                    <span className="hidden sm:inline text-[11px] text-[#a0a0b8] truncate">
                      — {signal.summary}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className="text-[11px] uppercase tracking-wider text-[#a0a0b8]">{signal.direction}</span>
                    <svg
                      className={`w-4 h-4 text-[#a0a0b8] transition-transform ${expandedSignals.has(i) ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedSignals.has(i) && (
                  <div className="px-4 pb-4 border-t border-[#2a2a4a]">
                    <p className="text-sm text-[#c0c0d0] leading-relaxed mt-3">{signal.detail}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Historical Parallels ── */}
        <section className="mb-14 p-6 rounded-xl bg-[#16162a] border border-[#2a2a4a]">
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block w-6 h-px bg-amber-400/60" />
            <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
              Historical Parallels
            </h3>
          </div>

          <p className="text-[#c0c0d0] leading-relaxed mb-6" style={{ fontFamily: "Georgia, serif" }}>
            We searched for conference games since 2015 where a top-15 defense (by adj. efficiency) faced a team scoring under 65 PPG in their last 6, with both teams ranking bottom-50 in tempo. Here&apos;s what we found:
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Record (Under)", value: "73-41", sub: "64.0%" },
              { label: "Avg. Total Scored", value: "128.4", sub: "vs 139.7 line" },
              { label: "Avg. Margin Under", value: "6.8 pts", sub: "below line" },
              { label: "ROI (Flat Betting)", value: "+14.2%", sub: "since 2015" },
            ].map((stat, i) => (
              <div key={i} className="text-center p-4 rounded-lg bg-[#1a1a2e] border border-[#2a2a4a]">
                <div className="text-2xl font-bold text-amber-400" style={{ fontFamily: "Georgia, serif" }}>
                  {stat.value}
                </div>
                <div className="text-[11px] text-[#a0a0b8] mt-1">{stat.label}</div>
                <div className="text-[10px] text-emerald-400 mt-0.5">{stat.sub}</div>
              </div>
            ))}
          </div>

          <p className="text-sm text-[#a0a0b8] italic">
            Sample includes 114 qualifying games across major conferences (Big Ten, Big 12, SEC, ACC, Big East).
          </p>
        </section>

        {/* ── Key Stats ── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-block w-6 h-px bg-amber-400/60" />
            <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
              Key Stats
            </h3>
          </div>

          <div className="rounded-xl overflow-hidden border border-[#2a2a4a]">
            <div className="grid grid-cols-3 bg-[#1a1a2e] text-[11px] uppercase tracking-wider text-[#a0a0b8] font-medium">
              <div className="p-3 text-center" style={{ color: "#00274C" }}>Michigan</div>
              <div className="p-3 text-center">Stat</div>
              <div className="p-3 text-center" style={{ color: "#BB0000" }}>Ohio State</div>
            </div>
            {STATS.map((row, i) => (
              <div
                key={i}
                className={`grid grid-cols-3 text-sm ${i % 2 === 0 ? "bg-[#16162a]" : "bg-[#13132a]"}`}
              >
                <div className={`p-3 text-center ${row.edge === "away" ? "text-emerald-400 font-semibold" : "text-[#c0c0d0]"}`}>
                  {row.away}
                </div>
                <div className="p-3 text-center text-[#a0a0b8] text-xs">{row.label}</div>
                <div className={`p-3 text-center ${row.edge === "home" ? "text-emerald-400 font-semibold" : "text-[#c0c0d0]"}`}>
                  {row.home}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Related Picks ── */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <span className="inline-block w-6 h-px bg-amber-400/60" />
            <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
              More From Today
            </h3>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {RELATED_PICKS.map((pick) => (
              <div
                key={pick.id}
                className="p-4 rounded-lg bg-[#16162a] border border-[#2a2a4a] hover:border-[#3a3a5a] transition-colors cursor-pointer"
              >
                <div className="text-[10px] uppercase tracking-wider text-amber-400/70 mb-1">{pick.league}</div>
                <div className="text-sm text-[#a0a0b8] mb-1">{pick.matchup}</div>
                <div className="text-sm font-semibold mb-2">{pick.pick}</div>
                <Stars count={pick.confidence} />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
