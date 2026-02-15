'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface SearchResult {
  type: 'team' | 'game' | 'player' | 'trend';
  label: string;
  meta: string;
  sport: string;
}

const SUGGESTIONS = [
  'NBA spreads today',
  'Duke -5.5 signals',
  'NCAAMB over/under trends',
  'Lakers vs Celtics history',
  'high confidence picks',
  'sharp money movement',
  'ROI by sport',
  'best CLV performers',
];

const MOCK_RESULTS: SearchResult[] = [
  { type: 'game', label: 'LAL @ BOS', meta: 'BOS -3.5 | O/U 224.5 | 7:00 PM', sport: 'NBA' },
  { type: 'game', label: 'MIL @ PHI', meta: 'PHI -1.5 | O/U 218 | 7:30 PM', sport: 'NBA' },
  { type: 'team', label: 'Boston Celtics', meta: '38-15 | ATS: 29-24 | O/U: 26-27', sport: 'NBA' },
  { type: 'team', label: 'Los Angeles Lakers', meta: '30-24 | ATS: 28-26 | O/U: 30-24', sport: 'NBA' },
  { type: 'trend', label: 'NBA Home Favorites -3 to -6', meta: '58.2% ATS L30 days', sport: 'NBA' },
  { type: 'player', label: 'Jayson Tatum', meta: '27.3 PPG | O/U Props available', sport: 'NBA' },
  { type: 'trend', label: 'NCAAMB Unders in rivalry games', meta: '62.1% hit rate this season', sport: 'NCAAMB' },
  { type: 'game', label: 'Duke @ UNC', meta: 'DUKE -5.5 | O/U 148 | 9:00 PM', sport: 'NCAAMB' },
];

const typeIcon = (t: SearchResult['type']) => {
  switch (t) {
    case 'game': return '⚡';
    case 'team': return '🏀';
    case 'player': return '👤';
    case 'trend': return '📈';
  }
};

interface BloombergSearchProps {
  open?: boolean;
  onClose?: () => void;
}

export default function BloombergSearch({ open = false, onClose }: BloombergSearchProps) {
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(open);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setVisible(open), [open]);
  useEffect(() => { if (visible) inputRef.current?.focus(); }, [visible]);

  const filtered = query.length > 0
    ? MOCK_RESULTS.filter(r => r.label.toLowerCase().includes(query.toLowerCase()) || r.meta.toLowerCase().includes(query.toLowerCase()))
    : MOCK_RESULTS;

  const suggestions = query.length === 0
    ? SUGGESTIONS
    : SUGGESTIONS.filter(s => s.toLowerCase().includes(query.toLowerCase()));

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose?.(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, -1)); }
  }, [filtered.length, onClose]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl bg-[#0c1020] border border-slate-700/60 rounded-lg shadow-2xl shadow-black/50" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700/40">
          <span className="text-cyan-500 font-mono text-sm">&gt;</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="Search teams, games, trends..."
            className="flex-1 bg-transparent text-sm font-mono text-slate-100 placeholder:text-slate-600 outline-none caret-cyan-400"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-slate-500 hover:text-slate-300">
              <X size={14} />
            </button>
          )}
          <kbd className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-500 font-mono">ESC</kbd>
        </div>

        {/* Suggestions */}
        {query.length === 0 && suggestions.length > 0 && (
          <div className="px-4 py-2 border-b border-slate-700/20">
            <div className="text-[10px] text-slate-600 font-mono uppercase tracking-wider mb-1.5">Suggestions</div>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  className="text-[11px] font-mono text-slate-400 bg-slate-800/60 px-2 py-1 rounded hover:bg-slate-700/60 hover:text-slate-200 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          <div className="text-[10px] text-slate-600 font-mono uppercase tracking-wider px-4 pt-2 pb-1">
            {query ? `Results (${filtered.length})` : 'All Games & Teams'}
          </div>
          {filtered.map((r, i) => (
            <button
              key={r.label + r.type}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                selectedIdx === i ? 'bg-cyan-500/10 border-l-2 border-cyan-400' : 'hover:bg-slate-800/40 border-l-2 border-transparent'
              }`}
            >
              <span className="text-sm">{typeIcon(r.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-200 font-medium">{r.label}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{r.meta}</div>
              </div>
              <span className="text-[10px] font-mono text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">{r.sport}</span>
              <span className="text-[10px] font-mono text-slate-600 capitalize">{r.type}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
