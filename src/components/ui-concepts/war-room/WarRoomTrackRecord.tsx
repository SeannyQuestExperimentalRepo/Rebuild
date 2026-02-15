"use client";

import React, { useState } from "react";
import WarRoomNav from "./WarRoomNav";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MonthRecord {
  month: string;
  wins: number;
  losses: number;
  pushes: number;
  units: number;
  roi: number;
  narrative: string;
}

interface RecentPick {
  id: string;
  date: string;
  matchup: string;
  pick: string;
  result: "win" | "loss" | "push";
  odds: string;
  league: string;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MONTHS: MonthRecord[] = [
  {
    month: "February 2026",
    wins: 28,
    losses: 18,
    pushes: 1,
    units: 12.4,
    roi: 11.2,
    narrative:
      "February has been our best month of the season. A 7-1 run on Big Ten unders anchored the month, and our NBA model finally started clicking after a sluggish January. The Super Bowl was kind to us too — we nailed the under and the right side.",
  },
  {
    month: "January 2026",
    wins: 52,
    losses: 44,
    pushes: 2,
    units: 4.8,
    roi: 3.1,
    narrative:
      "A grind-it-out month. Our NCAAM model carried the load (34-22) while NBA picks went through a rough 18-22 stretch. We identified a systematic error in how we were weighting back-to-back games and corrected mid-month. The last two weeks were 22-12.",
  },
  {
    month: "December 2025",
    wins: 58,
    losses: 49,
    pushes: 3,
    units: 6.2,
    roi: 3.8,
    narrative:
      "The holiday tournament season was good to us. Non-conference games provided exploitable mismatches, and our tempo-based model thrived. The bowl season opener (3-0) was a nice bonus heading into the new year.",
  },
  {
    month: "November 2025",
    wins: 47,
    losses: 38,
    pushes: 1,
    units: 8.1,
    roi: 6.4,
    narrative:
      "Season opener. We came out firing with a strong November, led by college basketball's early season where preseason rankings create the most mispricing. Early-season NFL picks (12-7) added cushion.",
  },
  {
    month: "October 2025",
    wins: 34,
    losses: 24,
    pushes: 0,
    units: 9.3,
    roi: 9.8,
    narrative:
      "NFL and college football dominated October. Our models found consistent edges in totals, particularly unders in Big Ten and SEC matchups. The World Series picks (4-1) were a cherry on top.",
  },
  {
    month: "September 2025",
    wins: 28,
    losses: 16,
    pushes: 1,
    units: 11.7,
    roi: 14.2,
    narrative:
      "The best month in Trendline history. NFL opening weeks are consistently our most profitable period — the market hasn't fully calibrated to roster changes, coaching adjustments, and scheme shifts. We caught several sharp moves early.",
  },
];

const RECENT_PICKS: RecentPick[] = [
  { id: "p1", date: "Feb 13", matchup: "Celtics at 76ers", pick: "Celtics -5.5", result: "win", odds: "-110", league: "NBA" },
  { id: "p2", date: "Feb 13", matchup: "Purdue at Illinois", pick: "Under 138", result: "win", odds: "-108", league: "NCAAM" },
  { id: "p3", date: "Feb 13", matchup: "Nuggets at Clippers", pick: "Nuggets -2", result: "loss", odds: "-112", league: "NBA" },
  { id: "p4", date: "Feb 13", matchup: "Gonzaga at Saint Mary's", pick: "Saint Mary's +4.5", result: "win", odds: "-110", league: "NCAAM" },
  { id: "p5", date: "Feb 12", matchup: "Bucks at Heat", pick: "Over 218.5", result: "loss", odds: "-110", league: "NBA" },
  { id: "p6", date: "Feb 12", matchup: "Kansas at Baylor", pick: "Kansas -3", result: "win", odds: "-108", league: "NCAAM" },
  { id: "p7", date: "Feb 12", matchup: "Suns at Mavericks", pick: "Mavericks -1.5", result: "win", odds: "-110", league: "NBA" },
  { id: "p8", date: "Feb 11", matchup: "Tennessee at Kentucky", pick: "Under 134.5", result: "win", odds: "-110", league: "NCAAM" },
  { id: "p9", date: "Feb 11", matchup: "Warriors at Lakers", pick: "Over 226", result: "win", odds: "-110", league: "NBA" },
  { id: "p10", date: "Feb 11", matchup: "UConn at Marquette", pick: "UConn -2", result: "push", odds: "-108", league: "NCAAM" },
  { id: "p11", date: "Feb 10", matchup: "Timberwolves at Thunder", pick: "Under 213.5", result: "win", odds: "-110", league: "NBA" },
  { id: "p12", date: "Feb 10", matchup: "Houston at Iowa St", pick: "Under 127", result: "win", odds: "-112", league: "NCAAM" },
];

// ─── Calendar Day ────────────────────────────────────────────────────────────

const CALENDAR_DAYS = Array.from({ length: 28 }, (_, i) => {
  const day = i + 1;
  const results: ("win" | "loss" | "push" | null)[] = [];
  // Simulate some results for the first 13 days
  if (day <= 13) {
    const count = Math.floor(Math.random() * 4) + 1;
    for (let j = 0; j < count; j++) {
      const r = Math.random();
      results.push(r < 0.6 ? "win" : r < 0.92 ? "loss" : "push");
    }
  }
  return { day, results };
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function WarRoomTrackRecord() {
  const [expandedMonth, setExpandedMonth] = useState<number>(0);

  const totalWins = MONTHS.reduce((s, m) => s + m.wins, 0);
  const totalLosses = MONTHS.reduce((s, m) => s + m.losses, 0);
  const totalUnits = MONTHS.reduce((s, m) => s + m.units, 0);

  return (
    <div className="min-h-screen bg-[#0f0f1a] text-[#f5f0e8]">
      <WarRoomNav activeSection="The Record" />

      {/* ── Hero ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-block w-8 h-px bg-amber-400" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-amber-400 font-medium">The Record</span>
        </div>

        <h2
          className="text-4xl sm:text-5xl leading-tight mb-6"
          style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
        >
          We publish every pick.
          <br />
          Here&apos;s how we&apos;ve done.
        </h2>

        <p className="text-lg text-[#c0c0d0] max-w-2xl leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
          Transparency is non-negotiable. Every pick we publish is tracked, timestamped, and graded against closing lines. No cherry-picking, no retroactive edits, no &ldquo;if you followed me on Snapchat&rdquo; nonsense. The numbers speak for themselves.
        </p>
      </section>

      {/* ── Big Stats ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {[
            { label: "Overall Record", value: `${totalWins}-${totalLosses}`, sub: `${((totalWins / (totalWins + totalLosses)) * 100).toFixed(1)}%` },
            { label: "Total Units", value: `+${totalUnits.toFixed(1)}`, sub: "flat betting" },
            { label: "Season ROI", value: "+8.3%", sub: "all picks" },
            { label: "Best Month", value: "+14.2%", sub: "September 2025" },
          ].map((stat, i) => (
            <div key={i} className="text-center p-6 rounded-xl bg-[#16162a] border border-[#2a2a4a]">
              <div
                className="text-3xl sm:text-4xl font-bold text-amber-400 mb-1"
                style={{ fontFamily: "Georgia, serif" }}
              >
                {stat.value}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-[#a0a0b8]">{stat.label}</div>
              <div className="text-xs text-emerald-400 mt-1">{stat.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── February Calendar ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-block w-6 h-px bg-amber-400/60" />
          <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
            February 2026
          </h3>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-[10px] uppercase tracking-wider text-[#a0a0b8] pb-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {/* Feb 2026 starts on Sunday */}
          {CALENDAR_DAYS.map(({ day, results }) => (
            <div
              key={day}
              className={`aspect-square rounded-lg p-1.5 sm:p-2 border text-center ${
                day <= 13
                  ? "bg-[#16162a] border-[#2a2a4a]"
                  : "bg-[#0f0f1a] border-[#1a1a2e] opacity-40"
              }`}
            >
              <div className="text-[11px] text-[#a0a0b8] mb-1">{day}</div>
              {results.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5">
                  {results.map((r, j) => (
                    <div
                      key={j}
                      className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                        r === "win"
                          ? "bg-emerald-400"
                          : r === "loss"
                          ? "bg-red-400"
                          : "bg-amber-400"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-4 mt-3 text-[11px] text-[#a0a0b8]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" /> Win
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" /> Loss
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-400" /> Push
          </div>
        </div>
      </section>

      {/* ── Recent Picks ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-block w-6 h-px bg-amber-400/60" />
          <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
            Recent Picks
          </h3>
        </div>

        <div className="rounded-xl overflow-hidden border border-[#2a2a4a]">
          {RECENT_PICKS.map((pick, i) => (
            <div
              key={pick.id}
              className={`flex items-center justify-between p-4 ${
                i % 2 === 0 ? "bg-[#16162a]" : "bg-[#13132a]"
              } ${i < RECENT_PICKS.length - 1 ? "border-b border-[#2a2a4a]" : ""}`}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    pick.result === "win"
                      ? "bg-emerald-400"
                      : pick.result === "loss"
                      ? "bg-red-400"
                      : "bg-amber-400"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] uppercase tracking-wider text-amber-400/70">{pick.league}</span>
                    <span className="text-sm text-[#a0a0b8] truncate">{pick.matchup}</span>
                  </div>
                  <div className="text-sm font-semibold mt-0.5">{pick.pick}</div>
                </div>
              </div>
              <div className="flex items-center gap-4 ml-4">
                <span className="text-[11px] text-[#a0a0b8]">{pick.date}</span>
                <span
                  className={`text-xs font-bold uppercase ${
                    pick.result === "win"
                      ? "text-emerald-400"
                      : pick.result === "loss"
                      ? "text-red-400"
                      : "text-amber-400"
                  }`}
                >
                  {pick.result}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Monthly Breakdown ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 border-t border-[#2a2a4a] pt-16">
        <div className="flex items-center gap-3 mb-8">
          <span className="inline-block w-6 h-px bg-amber-400/60" />
          <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
            Month by Month
          </h3>
        </div>

        <div className="space-y-3">
          {MONTHS.map((month, i) => {
            const winPct = ((month.wins / (month.wins + month.losses)) * 100).toFixed(1);
            return (
              <div key={i} className="rounded-lg border border-[#2a2a4a] overflow-hidden bg-[#16162a]">
                <button
                  onClick={() => setExpandedMonth(expandedMonth === i ? -1 : i)}
                  className="w-full flex items-center justify-between p-4 text-left hover:bg-[#1a1a2e] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="font-medium" style={{ fontFamily: "Georgia, serif" }}>
                      {month.month}
                    </span>
                    <span className="text-sm text-[#a0a0b8]">
                      {month.wins}-{month.losses}{month.pushes > 0 ? `-${month.pushes}` : ""} ({winPct}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-semibold ${month.units > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {month.units > 0 ? "+" : ""}{month.units}u
                    </span>
                    <svg
                      className={`w-4 h-4 text-[#a0a0b8] transition-transform ${expandedMonth === i ? "rotate-180" : ""}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {expandedMonth === i && (
                  <div className="px-4 pb-4 border-t border-[#2a2a4a]">
                    <p className="text-sm text-[#c0c0d0] leading-relaxed mt-3" style={{ fontFamily: "Georgia, serif" }}>
                      {month.narrative}
                    </p>
                    <div className="flex gap-6 mt-3">
                      <span className="text-xs text-[#a0a0b8]">ROI: <span className="text-emerald-400 font-semibold">{month.roi}%</span></span>
                      <span className="text-xs text-[#a0a0b8]">Win Rate: <span className="text-[#f5f0e8] font-semibold">{winPct}%</span></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Methodology ── */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-20 border-t border-[#2a2a4a] pt-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="inline-block w-6 h-px bg-amber-400/60" />
          <h3 className="text-xl text-[#f5f0e8]" style={{ fontFamily: "Georgia, serif" }}>
            Methodology
          </h3>
        </div>

        <div className="max-w-3xl space-y-5">
          <p className="text-[#c0c0d0] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
            Trendline&apos;s model is a composite system that synthesizes nine independent signal categories: team efficiency metrics (powered by KenPom and similar databases), tempo and pace projections, sharp money indicators, injury-adjusted ratings, venue factors, historical matchup patterns, public perception biases, model consensus, and live line movement analysis.
          </p>
          <p className="text-[#c0c0d0] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
            Each signal is independently weighted based on its historical predictive accuracy within the specific sport and bet type. For example, sharp money movement carries more weight in NFL sides than in college basketball totals, where our tempo-adjusted efficiency model has historically outperformed. These weights are recalibrated monthly using a rolling 3-year backtest window.
          </p>
          <p className="text-[#c0c0d0] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
            We only publish picks where our composite edge exceeds 1.5% — the threshold where, historically, our model has been profitable at a statistically significant level. Higher-confidence picks (4-5 stars) require a minimum 3.5% edge. This discipline means we pass on many games. We&apos;d rather publish 3 strong picks than 10 mediocre ones.
          </p>
          <p className="text-[#c0c0d0] leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
            Every pick is graded against the closing line at the time of publication. We use flat 1-unit betting for all record calculations — no variable sizing, no retroactive adjustments. What you see is what happened.
          </p>
        </div>
      </section>
    </div>
  );
}
