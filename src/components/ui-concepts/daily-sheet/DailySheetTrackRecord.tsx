"use client";

import React, { useState } from "react";
import { mockDayRecords, mockSportRecords, recentResults } from "./mockData";

type TimeRange = "7d" | "30d";

export default function DailySheetTrackRecord() {
  const [range, setRange] = useState<TimeRange>("7d");
  const [showTooltip, setShowTooltip] = useState(false);

  const totalWins = mockSportRecords.reduce((s, r) => s + r.wins, 0);
  const totalLosses = mockSportRecords.reduce((s, r) => s + r.losses, 0);
  const overallRate = ((totalWins / (totalWins + totalLosses)) * 100).toFixed(1);

  const records = range === "7d" ? mockDayRecords : [...mockDayRecords, ...mockDayRecords.map((d) => ({ ...d, date: d.date + "2" }))].slice(0, 14);
  const maxGames = Math.max(...records.map((r) => r.wins + r.losses));

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Hero stat */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-800 px-4 pt-6 pb-8 text-center">
        <p className="text-5xl font-extrabold text-white">{overallRate}%</p>
        <p className="mt-1 text-sm text-slate-400">Overall Win Rate</p>

        {/* Verified badge */}
        <div className="relative mt-4 inline-flex items-center gap-1.5">
          <button
            onClick={() => setShowTooltip(!showTooltip)}
            className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400"
          >
            <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.403 12.652a3 3 0 010-5.304 3 3 0 00-3.75-3.751 3 3 0 00-5.305 0 3 3 0 00-3.751 3.75 3 3 0 000 5.305 3 3 0 003.75 3.751 3 3 0 005.305 0 3 3 0 003.751-3.75zm-2.546-4.46a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            Verified Results
          </button>
          {showTooltip && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 rounded-lg bg-white p-3 text-xs text-slate-600 shadow-lg z-10">
              All picks are timestamped before game start and verified against final scores. No retroactive editing.
              <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 bg-white" />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4">
        {/* Sport pills */}
        <div className="mt-6 flex flex-wrap gap-2">
          {mockSportRecords.map((sr) => {
            const rate = ((sr.wins / (sr.wins + sr.losses)) * 100).toFixed(0);
            return (
              <div
                key={sr.sport}
                className="flex items-center gap-2 rounded-full bg-white px-3.5 py-2 shadow-sm border border-slate-100"
              >
                <span className="text-xs font-bold text-slate-700">{sr.sport}</span>
                <span className="text-xs font-semibold text-emerald-600">{rate}%</span>
                <span className="text-[10px] text-slate-400">{sr.wins}-{sr.losses}</span>
              </div>
            );
          })}
        </div>

        {/* Bar chart */}
        <div className="mt-6 rounded-2xl bg-white p-4 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Performance</h3>
            <div className="flex rounded-lg bg-slate-100 p-0.5">
              {(["7d", "30d"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${
                    range === r ? "bg-white text-slate-900 shadow-sm" : "text-slate-400"
                  }`}
                >
                  {r === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-end gap-1.5" style={{ height: 120 }}>
            {records.map((day, i) => {
              const total = day.wins + day.losses;
              const height = (total / maxGames) * 100;
              const winPct = total > 0 ? (day.wins / total) * 100 : 0;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="w-full relative rounded-t-md overflow-hidden" style={{ height: `${height}%` }}>
                    <div className="absolute bottom-0 w-full bg-emerald-400" style={{ height: `${winPct}%` }} />
                    <div className="absolute top-0 w-full bg-red-300" style={{ height: `${100 - winPct}%` }} />
                  </div>
                  <span className="text-[9px] text-slate-400">{day.date}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex gap-4 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              <span className="text-[10px] text-slate-400">Wins</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 rounded-sm bg-red-300" />
              <span className="text-[10px] text-slate-400">Losses</span>
            </div>
          </div>
        </div>

        {/* Recent picks */}
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Recent Picks</h3>
          <div className="space-y-2">
            {recentResults.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-xl bg-white px-4 py-3 shadow-sm border border-slate-100"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">
                    {r.result === "win" ? "✅" : r.result === "loss" ? "❌" : "➖"}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{r.pick}</p>
                    <p className="text-xs text-slate-400">
                      {r.awayTeam.abbreviation} @ {r.homeTeam.abbreviation}
                    </p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: r.confidence }).map((_, i) => (
                    <svg key={i} className="h-3.5 w-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
