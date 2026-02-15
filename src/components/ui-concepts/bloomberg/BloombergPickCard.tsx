'use client';

import React, { useState } from 'react';
import { ChevronRight, Star } from 'lucide-react';
import type { Pick, ConfidenceTier } from './types';

const tierColor = (t: ConfidenceTier) => {
  if (t >= 5) return { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', glow: 'shadow-[0_0_12px_rgba(16,185,129,0.25)]' };
  if (t >= 4) return { text: 'text-emerald-400/80', bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.15)]' };
  if (t >= 3) return { text: 'text-amber-400', bg: 'bg-amber-500/5', border: 'border-amber-500/20', glow: 'shadow-[0_0_6px_rgba(245,158,11,0.15)]' };
  if (t >= 2) return { text: 'text-slate-400', bg: 'bg-slate-500/5', border: 'border-slate-600/30', glow: '' };
  return { text: 'text-slate-500', bg: 'bg-slate-800/30', border: 'border-slate-700/30', glow: '' };
};

const resultBadge = (r: Pick['result']) => {
  switch (r) {
    case 'win': return <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">W</span>;
    case 'loss': return <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">L</span>;
    case 'push': return <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/15 px-1.5 py-0.5 rounded">P</span>;
    default: return <span className="text-[10px] font-mono text-slate-500">—</span>;
  }
};

const signalBar = (value: number) => {
  const pct = Math.abs(value);
  const color = value > 30 ? 'bg-emerald-500' : value > 0 ? 'bg-emerald-500/60' : value > -30 ? 'bg-red-500/60' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-mono w-8 text-right ${value > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
        {value > 0 ? '+' : ''}{value}
      </span>
    </div>
  );
};

interface BloombergPickCardProps {
  pick: Pick;
  selected?: boolean;
  onSelect?: (pick: Pick) => void;
}

export default function BloombergPickCard({ pick, selected, onSelect }: BloombergPickCardProps) {
  const [expanded, setExpanded] = useState(false);
  const colors = tierColor(pick.confidence);

  return (
    <div className={`border ${colors.border} ${colors.bg} ${selected ? 'ring-1 ring-cyan-500/40' : ''} ${colors.glow} transition-all`}>
      {/* Main row */}
      <button
        onClick={() => onSelect?.(pick)}
        className="w-full flex items-center gap-0 px-3 py-2 text-left hover:bg-white/[0.02] transition-colors"
      >
        {/* Sport badge */}
        <span className="text-[10px] font-mono font-bold text-slate-500 w-12 shrink-0">{pick.sport}</span>

        {/* Teams */}
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium text-slate-200 truncate">{pick.selection}</span>
          <span className="text-[10px] text-slate-500 ml-2">
            {pick.away} @ {pick.home}
          </span>
        </div>

        {/* Line */}
        <span className="text-xs font-mono text-slate-300 w-16 text-right shrink-0">
          {pick.betType === 'moneyline' ? (pick.line > 0 ? '+' : '') + pick.line : pick.line > 0 ? '+' + pick.line : pick.line}
        </span>

        {/* Model */}
        <span className="text-xs font-mono text-cyan-400/80 w-16 text-right shrink-0">
          {pick.modelPrediction > 0 ? '+' : ''}{pick.modelPrediction.toFixed(1)}
        </span>

        {/* Edge */}
        <span className={`text-xs font-mono font-bold w-14 text-right shrink-0 ${pick.edge > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {pick.edge > 0 ? '+' : ''}{pick.edge.toFixed(1)}%
        </span>

        {/* Stars */}
        <div className="flex items-center w-16 justify-center shrink-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={10}
              className={i < pick.confidence ? colors.text : 'text-slate-700'}
              fill={i < pick.confidence ? 'currentColor' : 'none'}
            />
          ))}
        </div>

        {/* Units */}
        <span className="text-xs font-mono text-slate-300 w-10 text-right shrink-0">{pick.units}u</span>

        {/* Result */}
        <div className="w-8 flex justify-center shrink-0">{resultBadge(pick.result)}</div>

        {/* Expand */}
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="ml-1 text-slate-600 hover:text-slate-300 transition-colors shrink-0"
        >
          <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </button>
      </button>

      {/* Expanded signals */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-700/30">
          <div className="grid grid-cols-3 gap-x-6 gap-y-1.5">
            {pick.signals.map((s) => (
              <div key={s.label} className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-500 truncate">{s.label}</span>
                {signalBar(s.value)}
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-700/20 flex gap-4 text-[10px] text-slate-500 font-mono">
            <span>Time: {pick.gameTime}</span>
            <span>Odds: {pick.odds > 0 ? '+' : ''}{pick.odds}</span>
            <span>Type: {pick.betType}</span>
          </div>
        </div>
      )}
    </div>
  );
}
