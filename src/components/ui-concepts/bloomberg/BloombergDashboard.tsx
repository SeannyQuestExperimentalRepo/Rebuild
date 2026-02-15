'use client';

import React, { useState, useEffect } from 'react';
import { Star, TrendingUp, TrendingDown, Activity, Zap, BarChart3, Clock } from 'lucide-react';
import BloombergNav from './BloombergNav';
import BloombergPickCard from './BloombergPickCard';
import BloombergSearch from './BloombergSearch';
import type { Pick, OddsTick } from './types';
import { ODDS_TICKER, TODAYS_PICKS, RECENT_RESULTS } from './mockData';

// --- Odds Ticker ---
function OddsTickerBar() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setOffset(o => o - 1), 30);
    return () => clearInterval(id);
  }, []);

  const TickItem = ({ tick }: { tick: OddsTick }) => {
    const spreadDelta = tick.spread - tick.prevSpread;
    const totalDelta = tick.total - tick.prevTotal;
    return (
      <div className="inline-flex items-center gap-3 px-4 py-1.5 border-r border-slate-700/30 whitespace-nowrap">
        <span className="text-[10px] font-mono text-slate-500">{tick.sport}</span>
        <span className="text-xs font-medium text-slate-300">{tick.away}@{tick.home}</span>
        <div className="flex items-center gap-1">
          <span className="text-xs font-mono text-slate-300">{tick.spread > 0 ? '+' : ''}{tick.spread}</span>
          {spreadDelta !== 0 && (
            <span className={`text-[10px] font-mono ${spreadDelta < 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {spreadDelta < 0 ? '↓' : '↑'}{Math.abs(spreadDelta).toFixed(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">O/U</span>
          <span className="text-xs font-mono text-slate-300">{tick.total}</span>
          {totalDelta !== 0 && (
            <span className={`text-[10px] font-mono ${totalDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {totalDelta > 0 ? '↑' : '↓'}{Math.abs(totalDelta).toFixed(1)}
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-600 font-mono">{tick.time}</span>
      </div>
    );
  };

  const doubled = [...ODDS_TICKER, ...ODDS_TICKER];

  return (
    <div className="bg-[#060a14] border-b border-slate-700/40 overflow-hidden">
      <div className="flex items-center">
        <div className="shrink-0 bg-cyan-500/10 border-r border-cyan-500/20 px-3 py-1.5 flex items-center gap-1.5 z-10">
          <Activity size={12} className="text-cyan-400" />
          <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase">LIVE</span>
        </div>
        <div className="overflow-hidden flex-1">
          <div className="flex" style={{ transform: `translateX(${offset}px)` }}>
            {doubled.map((t, i) => <TickItem key={i} tick={t} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Signal Radar (right panel) ---
function SignalRadar({ pick }: { pick: Pick }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold text-slate-100">{pick.selection}</div>
          <div className="text-[10px] text-slate-500 font-mono">{pick.away} @ {pick.home} • {pick.gameTime}</div>
        </div>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={12} className={i < pick.confidence ? 'text-amber-400' : 'text-slate-700'} fill={i < pick.confidence ? 'currentColor' : 'none'} />
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-800/30 border border-slate-700/30 p-2 rounded text-center">
          <div className="text-[10px] text-slate-500 font-mono">LINE</div>
          <div className="text-sm font-mono font-bold text-slate-200">{pick.line > 0 ? '+' : ''}{pick.line}</div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/30 p-2 rounded text-center">
          <div className="text-[10px] text-slate-500 font-mono">MODEL</div>
          <div className="text-sm font-mono font-bold text-cyan-400">{pick.modelPrediction > 0 ? '+' : ''}{pick.modelPrediction.toFixed(1)}</div>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded text-center">
          <div className="text-[10px] text-emerald-400/70 font-mono">EDGE</div>
          <div className="text-sm font-mono font-bold text-emerald-400">+{pick.edge.toFixed(1)}%</div>
        </div>
      </div>

      {/* All 9 signals */}
      <div className="space-y-1.5">
        <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Signal Breakdown</div>
        {pick.signals.map(s => {
          const pct = Math.abs(s.value);
          const positive = s.value > 0;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 w-24 truncate">{s.label}</span>
              <div className="flex-1 h-3 bg-slate-800/50 rounded-sm overflow-hidden relative">
                {/* Center line */}
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-600/40" />
                {/* Bar */}
                <div
                  className={`absolute top-0 bottom-0 ${positive ? 'bg-emerald-500/70' : 'bg-red-500/70'} rounded-sm`}
                  style={{
                    left: positive ? '50%' : `${50 - pct / 2}%`,
                    width: `${pct / 2}%`,
                  }}
                />
              </div>
              <span className={`text-[10px] font-mono w-8 text-right ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {positive ? '+' : ''}{s.value}
              </span>
              <span className="text-[10px] text-slate-600 font-mono w-6 text-right">{(s.weight * 100).toFixed(0)}%</span>
            </div>
          );
        })}
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/30">
        <div className="text-[10px] font-mono"><span className="text-slate-500">Odds:</span> <span className="text-slate-300">{pick.odds > 0 ? '+' : ''}{pick.odds}</span></div>
        <div className="text-[10px] font-mono"><span className="text-slate-500">Units:</span> <span className="text-slate-300">{pick.units}u</span></div>
        <div className="text-[10px] font-mono"><span className="text-slate-500">Type:</span> <span className="text-slate-300 capitalize">{pick.betType}</span></div>
        <div className="text-[10px] font-mono"><span className="text-slate-500">Sport:</span> <span className="text-slate-300">{pick.sport}</span></div>
      </div>
    </div>
  );
}

// --- Main Dashboard ---
export default function BloombergDashboard() {
  const [selectedPick, setSelectedPick] = useState<Pick>(TODAYS_PICKS[0]);
  const [searchOpen, setSearchOpen] = useState(false);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const recentWins = RECENT_RESULTS.filter(r => r.result === 'win').length;
  const recentTotal = RECENT_RESULTS.length;

  return (
    <div className="h-screen flex flex-col bg-[#080c18] text-slate-100 font-sans">
      <BloombergNav onSearchFocus={() => setSearchOpen(true)} />
      <OddsTickerBar />

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-[1fr_340px] grid-rows-[1fr_auto] min-h-0">
        {/* Left: Picks grid */}
        <div className="border-r border-slate-700/30 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700/30">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-amber-400" />
              <span className="text-xs font-bold tracking-wide">TODAY&apos;S PICKS</span>
              <span className="text-[10px] font-mono text-slate-500">{TODAYS_PICKS.length} picks</span>
            </div>
            <div className="flex gap-2 text-[10px] font-mono">
              <button className="text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">ALL</button>
              <button className="text-slate-500 hover:text-slate-300 px-2 py-0.5">NBA</button>
              <button className="text-slate-500 hover:text-slate-300 px-2 py-0.5">NCAAMB</button>
              <button className="text-slate-500 hover:text-slate-300 px-2 py-0.5">5★</button>
            </div>
          </div>

          {/* Column headers */}
          <div className="flex items-center gap-0 px-3 py-1.5 text-[10px] font-mono text-slate-600 uppercase tracking-wider border-b border-slate-800/50">
            <span className="w-12">Sport</span>
            <span className="flex-1">Selection</span>
            <span className="w-16 text-right">Line</span>
            <span className="w-16 text-right">Model</span>
            <span className="w-14 text-right">Edge</span>
            <span className="w-16 text-center">Conf</span>
            <span className="w-10 text-right">Size</span>
            <span className="w-8 text-center">Res</span>
            <span className="w-5" />
          </div>

          {/* Picks list */}
          <div className="flex-1 overflow-y-auto space-y-0">
            {TODAYS_PICKS.map(p => (
              <BloombergPickCard
                key={p.id}
                pick={p}
                selected={selectedPick?.id === p.id}
                onSelect={setSelectedPick}
              />
            ))}
          </div>
        </div>

        {/* Right: Game deep-dive */}
        <div className="flex flex-col min-h-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/30">
            <BarChart3 size={14} className="text-cyan-400" />
            <span className="text-xs font-bold tracking-wide">SIGNAL ANALYSIS</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {selectedPick ? <SignalRadar pick={selectedPick} /> : (
              <div className="flex items-center justify-center h-full text-slate-600 text-xs font-mono">
                Select a pick to analyze
              </div>
            )}
          </div>
        </div>

        {/* Bottom: Recent results */}
        <div className="col-span-2 border-t border-slate-700/30 bg-[#060a14]">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-800/50">
            <Clock size={14} className="text-slate-400" />
            <span className="text-xs font-bold tracking-wide">RECENT RESULTS</span>
            <span className="text-[10px] font-mono text-emerald-400 ml-2">{recentWins}-{recentTotal - recentWins} ({((recentWins / recentTotal) * 100).toFixed(0)}%)</span>
            <div className="ml-auto flex items-center gap-3 text-[10px] font-mono text-slate-500">
              <span>Season: <span className="text-emerald-400">152-106-6</span></span>
              <span>ROI: <span className="text-emerald-400">+8.7%</span></span>
              <span>Units: <span className="text-cyan-400">+59.2u</span></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex gap-0">
              {RECENT_RESULTS.map(r => (
                <div key={r.id} className="flex items-center gap-2 px-3 py-2 border-r border-slate-800/30 text-xs whitespace-nowrap">
                  <span className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
                    r.result === 'win' ? 'text-emerald-400 bg-emerald-500/15' : 'text-red-400 bg-red-500/15'
                  }`}>{r.result === 'win' ? 'W' : 'L'}</span>
                  <span className="text-slate-400 font-mono text-[10px]">{r.sport}</span>
                  <span className="text-slate-200">{r.selection}</span>
                  <span className="text-slate-500 font-mono">{r.edge > 0 ? '+' : ''}{r.edge}%</span>
                  <span className="text-slate-600 font-mono text-[10px]">{r.gameTime}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Search modal */}
      <BloombergSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
