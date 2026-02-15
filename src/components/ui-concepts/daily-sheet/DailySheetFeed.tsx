"use client";

import React, { useState, useCallback } from "react";
import { Sport, NavTab } from "./types";
import { mockPicks } from "./mockData";
import DailySheetHeader from "./DailySheetHeader";
import DailySheetPickCard from "./DailySheetPickCard";
import DailySheetBottomNav from "./DailySheetBottomNav";
import DailySheetTrackRecord from "./DailySheetTrackRecord";

const sportFilters: Sport[] = ["ALL", "NFL", "NBA", "NCAAMB", "NCAAF"];

export default function DailySheetFeed() {
  const [activeSport, setActiveSport] = useState<Sport>("ALL");
  const [activeTab, setActiveTab] = useState<NavTab>("today");
  const [refreshing, setRefreshing] = useState(false);
  const [picks, setPicks] = useState(mockPicks);

  const filtered = activeSport === "ALL" ? picks : picks.filter((p) => p.sport === activeSport);
  const sorted = [...filtered].sort((a, b) => b.confidence - a.confidence);
  const fiveStarCount = picks.filter((p) => p.confidence === 5).length;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  }, []);

  const handleTrack = (id: string) => {
    setPicks((prev) => prev.map((p) => (p.id === id ? { ...p, tracked: !p.tracked } : p)));
  };

  const handleParlay = (id: string) => {
    setPicks((prev) => prev.map((p) => (p.id === id ? { ...p, inParlay: !p.inParlay } : p)));
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="min-h-screen bg-slate-50">
      <DailySheetHeader />

      {activeTab === "today" && (
        <main className="mx-auto max-w-lg pb-24">
          {/* Pull to refresh indicator */}
          {refreshing && (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
          )}

          {/* Date + Filter tabs */}
          <div className="sticky top-[52px] z-40 bg-slate-50/95 backdrop-blur-sm px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h1 className="text-lg font-bold text-slate-900">Today&apos;s Best Edges</h1>
                <p className="text-xs text-slate-400">{today}</p>
              </div>
              <button onClick={handleRefresh} className="rounded-full p-2 text-slate-400 hover:bg-slate-200 transition-colors">
                <svg className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
              </button>
            </div>

            {/* Sport filter tabs */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
              {sportFilters.map((sport) => (
                <button
                  key={sport}
                  onClick={() => setActiveSport(sport)}
                  className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    activeSport === sport
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  {sport}
                </button>
              ))}
            </div>
          </div>

          {/* Summary card */}
          <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-100 p-4">
            <div className="flex items-center gap-2 mb-1">
              <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-bold text-amber-900">Morning Brief</span>
            </div>
            <p className="text-sm text-amber-800">
              <span className="font-bold">{fiveStarCount} five-star picks</span>
              {" • "}
              <span>{picks.length} total picks</span>
              {" • "}
              <span className="font-semibold text-emerald-700">67% hit rate this week</span>
            </p>
          </div>

          {/* Pick cards */}
          <div className="space-y-3 px-4 mt-4">
            {sorted.map((pick) => (
              <DailySheetPickCard
                key={pick.id}
                pick={pick}
                onTrack={handleTrack}
                onParlay={handleParlay}
              />
            ))}
          </div>

          {sorted.length === 0 && (
            <div className="mt-12 text-center">
              <p className="text-slate-400 text-sm">No picks for this sport today</p>
            </div>
          )}
        </main>
      )}

      {activeTab === "record" && <DailySheetTrackRecord />}

      {activeTab !== "today" && activeTab !== "record" && (
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold text-slate-300 capitalize">{activeTab}</p>
            <p className="text-sm text-slate-400 mt-1">Coming soon</p>
          </div>
        </div>
      )}

      <DailySheetBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        pickCount={picks.length}
      />
    </div>
  );
}
