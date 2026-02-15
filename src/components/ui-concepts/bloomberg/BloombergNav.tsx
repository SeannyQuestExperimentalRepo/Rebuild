'use client';

import React, { useState } from 'react';
import { Settings, User, Bell, ChevronDown } from 'lucide-react';

const TABS = ['Dashboard', 'Picks', 'Trends', 'Parlays', 'Record', 'API'] as const;
type Tab = (typeof TABS)[number];

interface BloombergNavProps {
  activeTab?: Tab;
  onTabChange?: (tab: Tab) => void;
  onSearchFocus?: () => void;
}

export default function BloombergNav({ activeTab = 'Dashboard', onTabChange, onSearchFocus }: BloombergNavProps) {
  const [tab, setTab] = useState<Tab>(activeTab);

  const handleTab = (t: Tab) => {
    setTab(t);
    onTabChange?.(t);
  };

  return (
    <nav className="flex flex-col border-b border-slate-700/60 bg-[#0a0e1a]">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-emerald-500 flex items-center justify-center">
            <span className="text-[10px] font-black text-black tracking-tighter">TL</span>
          </div>
          <span className="text-sm font-bold tracking-wide text-slate-100">TRENDLINE</span>
          <span className="text-[10px] text-slate-500 font-mono ml-1">v2.4.1</span>
        </div>

        {/* Search */}
        <button
          onClick={onSearchFocus}
          className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/80 border border-slate-600/40 rounded text-slate-400 text-xs font-mono hover:border-cyan-500/50 hover:text-slate-300 transition-colors min-w-[280px]"
        >
          <span className="text-cyan-500">&gt;</span>
          <span>Search teams, games, props...</span>
          <kbd className="ml-auto text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400">⌘K</kbd>
        </button>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button className="text-slate-500 hover:text-slate-300 transition-colors">
            <Bell size={16} />
          </button>
          <button className="text-slate-500 hover:text-slate-300 transition-colors">
            <Settings size={16} />
          </button>
          <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors">
            <div className="h-6 w-6 rounded-full bg-slate-700 flex items-center justify-center">
              <User size={12} />
            </div>
            <ChevronDown size={12} />
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex px-4 gap-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => handleTab(t)}
            className={`px-4 py-2 text-xs font-medium tracking-wide border-b-2 transition-colors ${
              tab === t
                ? 'border-cyan-400 text-cyan-400 bg-cyan-400/5'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/40'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>
    </nav>
  );
}
