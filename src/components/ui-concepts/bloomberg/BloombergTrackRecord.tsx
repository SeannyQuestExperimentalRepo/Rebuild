'use client';

import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MONTHLY_PERFORMANCE, SPORT_PERFORMANCE, TIER_PERFORMANCE } from './mockData';
import type { ConfidenceTier } from './types';
import { Star, TrendingUp, Trophy, Target } from 'lucide-react';

const overall = {
  wins: 152, losses: 106, pushes: 6, winPct: 58.9, roi: 8.7, units: 59.2, clv: 1.9, streak: 'W3',
};

const StatBox = ({ label, value, sub, color = 'text-slate-100' }: { label: string; value: string; sub?: string; color?: string }) => (
  <div className="bg-slate-800/30 border border-slate-700/30 p-3 rounded">
    <div className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">{label}</div>
    <div className={`text-2xl font-mono font-bold ${color} mt-1`}>{value}</div>
    {sub && <div className="text-[10px] text-slate-500 font-mono mt-0.5">{sub}</div>}
  </div>
);

const tierStars = (t: ConfidenceTier) => (
  <div className="flex">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} size={10} className={i < t ? 'text-amber-400' : 'text-slate-700'} fill={i < t ? 'currentColor' : 'none'} />
    ))}
  </div>
);

export default function BloombergTrackRecord() {
  return (
    <div className="bg-[#080c18] text-slate-100 min-h-screen p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Trophy size={18} className="text-amber-400" />
        <h1 className="text-sm font-bold tracking-wide">TRACK RECORD</h1>
        <span className="text-[10px] text-slate-500 font-mono">2024-25 Season</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-slate-500">STREAK</span>
          <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{overall.streak}</span>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-6 gap-3">
        <StatBox label="Record" value={`${overall.wins}-${overall.losses}-${overall.pushes}`} sub={`${overall.wins + overall.losses + overall.pushes} total picks`} />
        <StatBox label="Win %" value={`${overall.winPct}%`} color="text-emerald-400" sub="vs 52.4% break-even" />
        <StatBox label="ROI" value={`+${overall.roi}%`} color="text-emerald-400" />
        <StatBox label="Units" value={`+${overall.units}`} color="text-cyan-400" sub="1u = $100 standard" />
        <StatBox label="Avg CLV" value={`+${overall.clv}¢`} color="text-amber-400" sub="closing line value" />
        <StatBox label="Edge" value="4.2%" color="text-emerald-400" sub="avg model edge" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Monthly chart */}
        <div className="bg-slate-900/40 border border-slate-700/30 rounded p-3">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-cyan-400" />
            <span className="text-xs font-bold tracking-wide">MONTHLY ROI %</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MONTHLY_PERFORMANCE} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} tickFormatter={v => `${v}%`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}
                labelStyle={{ color: '#94a3b8' }}
                formatter={(value: number) => [`${value}%`, 'ROI']}
              />
              <Bar dataKey="roi" radius={[2, 2, 0, 0]}>
                {MONTHLY_PERFORMANCE.map((entry, i) => (
                  <Cell key={i} fill={entry.roi > 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly units */}
        <div className="bg-slate-900/40 border border-slate-700/30 rounded p-3">
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} className="text-emerald-400" />
            <span className="text-xs font-bold tracking-wide">MONTHLY UNITS</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={MONTHLY_PERFORMANCE} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b', fontFamily: 'monospace' }} tickFormatter={v => `${v}u`} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}
                formatter={(value: number) => [`+${value}u`, 'Units']}
              />
              <Bar dataKey="units" radius={[2, 2, 0, 0]} fill="#06b6d4" fillOpacity={0.7} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sport breakdown */}
      <div className="bg-slate-900/40 border border-slate-700/30 rounded p-3">
        <div className="text-xs font-bold tracking-wide mb-3">PER-SPORT BREAKDOWN</div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700/30">
              <th className="text-left py-2 px-2">Sport</th>
              <th className="text-right py-2 px-2">Picks</th>
              <th className="text-right py-2 px-2">Record</th>
              <th className="text-right py-2 px-2">Win%</th>
              <th className="text-right py-2 px-2">ROI</th>
              <th className="text-right py-2 px-2">Units</th>
              <th className="text-right py-2 px-2">CLV</th>
            </tr>
          </thead>
          <tbody>
            {SPORT_PERFORMANCE.map(s => (
              <tr key={s.sport} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                <td className="py-2 px-2 text-slate-300 font-medium">{s.sport}</td>
                <td className="py-2 px-2 text-right text-slate-400">{s.picks}</td>
                <td className="py-2 px-2 text-right text-slate-300">{s.wins}-{s.losses}-{s.pushes}</td>
                <td className={`py-2 px-2 text-right font-bold ${s.winPct > 55 ? 'text-emerald-400' : 'text-amber-400'}`}>{s.winPct}%</td>
                <td className={`py-2 px-2 text-right font-bold ${s.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>+{s.roi}%</td>
                <td className="py-2 px-2 text-right text-cyan-400">+{s.units}</td>
                <td className="py-2 px-2 text-right text-amber-400">+{s.clv}¢</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tier accuracy */}
      <div className="bg-slate-900/40 border border-slate-700/30 rounded p-3">
        <div className="text-xs font-bold tracking-wide mb-3">CONFIDENCE TIER ACCURACY</div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-700/30">
              <th className="text-left py-2 px-2">Tier</th>
              <th className="text-right py-2 px-2">Record</th>
              <th className="text-right py-2 px-2">Win%</th>
              <th className="text-right py-2 px-2">ROI</th>
              <th className="text-right py-2 px-2">Avg Edge</th>
              <th className="text-left py-2 px-2 w-48">Performance</th>
            </tr>
          </thead>
          <tbody>
            {TIER_PERFORMANCE.map(t => (
              <tr key={t.tier} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                <td className="py-2 px-2">{tierStars(t.tier)}</td>
                <td className="py-2 px-2 text-right text-slate-300">{t.wins}-{t.losses}</td>
                <td className={`py-2 px-2 text-right font-bold ${t.winPct > 60 ? 'text-emerald-400' : t.winPct > 52 ? 'text-amber-400' : 'text-red-400'}`}>{t.winPct}%</td>
                <td className={`py-2 px-2 text-right font-bold ${t.roi > 0 ? 'text-emerald-400' : 'text-red-400'}`}>{t.roi > 0 ? '+' : ''}{t.roi}%</td>
                <td className="py-2 px-2 text-right text-cyan-400">{t.avgEdge}%</td>
                <td className="py-2 px-2">
                  <div className="w-full h-2 bg-slate-700/40 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${t.roi > 10 ? 'bg-emerald-500' : t.roi > 0 ? 'bg-emerald-500/70' : 'bg-red-500/70'}`}
                      style={{ width: `${Math.min(Math.max(t.winPct, 30), 80)}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
