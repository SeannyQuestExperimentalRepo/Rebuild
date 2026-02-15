"use client";

import React, { useState } from "react";
import { Pick } from "./types";

interface DailySheetPickCardProps {
  pick: Pick;
  onTrack?: (id: string) => void;
  onParlay?: (id: string) => void;
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg
          key={i}
          className={`h-5 w-5 ${i < count ? "text-amber-400" : "text-slate-200"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function SignalBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-slate-600 w-8 text-right">{value}</span>
    </div>
  );
}

export default function DailySheetPickCard({ pick, onTrack, onParlay }: DailySheetPickCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [tracked, setTracked] = useState(pick.tracked);
  const [inParlay, setInParlay] = useState(pick.inParlay);

  const handleTrack = () => {
    setTracked(!tracked);
    onTrack?.(pick.id);
  };

  const handleParlay = () => {
    setInParlay(!inParlay);
    onParlay?.(pick.id);
  };

  const sportBadgeColor: Record<string, string> = {
    NFL: "bg-green-100 text-green-700",
    NBA: "bg-orange-100 text-orange-700",
    NCAAMB: "bg-blue-100 text-blue-700",
    NCAAF: "bg-red-100 text-red-700",
  };

  return (
    <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden transition-shadow hover:shadow-md">
      {/* Top accent bar using home team color */}
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${pick.awayTeam.color}, ${pick.homeTeam.color})` }} />

      <div className="p-4">
        {/* Sport badge + game time */}
        <div className="flex items-center justify-between mb-3">
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${sportBadgeColor[pick.sport] || "bg-slate-100 text-slate-600"}`}>
            {pick.sport}
          </span>
          <span className="text-xs text-slate-400">{pick.gameTime}</span>
        </div>

        {/* Matchup */}
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-white text-xs font-bold" style={{ backgroundColor: pick.awayTeam.color }}>
              {pick.awayTeam.abbreviation}
            </div>
            <span className="text-sm font-semibold text-slate-700">{pick.awayTeam.name}</span>
          </div>
          <span className="text-xs font-medium text-slate-300">@</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-700">{pick.homeTeam.name}</span>
            <div className="flex h-10 w-10 items-center justify-center rounded-full text-white text-xs font-bold" style={{ backgroundColor: pick.homeTeam.color }}>
              {pick.homeTeam.abbreviation}
            </div>
          </div>
        </div>

        {/* The Pick */}
        <div className="text-center mb-3">
          <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{pick.pick}</p>
          <div className="mt-1.5 flex justify-center">
            <Stars count={pick.confidence} />
          </div>
        </div>

        {/* Reasoning */}
        <p className="text-sm text-slate-500 text-center mb-3 leading-relaxed">
          {pick.reasoning}
        </p>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <div className="flex -space-x-1.5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-5 w-5 rounded-full border-2 border-white bg-slate-300" />
            ))}
          </div>
          <span className="text-xs text-slate-400">
            <span className="font-semibold text-slate-600">{pick.socialProof}%</span> of Trendline users agree
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={handleTrack}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              tracked
                ? "bg-amber-400 text-slate-900 shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tracked ? "✓ Tracking" : "Track This Pick"}
          </button>
          <button
            onClick={handleParlay}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              inParlay
                ? "bg-indigo-500 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {inParlay ? "✓ In Parlay" : "Add to Parlay"}
          </button>
        </div>

        {/* Expandable signals */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 py-1 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          {expanded ? "Hide Details" : "See Why"}
          <svg
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {expanded && (
          <div className="mt-2 space-y-2.5 rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Signal Breakdown</p>
            {pick.signals.map((signal) => (
              <SignalBar key={signal.label} {...signal} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
