"use client";

import React, { useState } from "react";

const NAV_ITEMS = ["Today", "Deep Dives", "Trends", "The Record", "Subscribe"] as const;

type NavItem = (typeof NAV_ITEMS)[number];

interface WarRoomNavProps {
  activeSection?: NavItem;
  onNavigate?: (section: NavItem) => void;
}

export default function WarRoomNav({ activeSection = "Today", onNavigate }: WarRoomNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 bg-[#1a1a2e]/95 backdrop-blur-md border-b border-[#2a2a4a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl text-[#f5f0e8] tracking-tight"
              style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              Trendline
            </h1>
            <span className="hidden sm:inline-block text-[10px] uppercase tracking-[0.2em] text-amber-400/80 border border-amber-400/30 rounded px-1.5 py-0.5">
              War Room
            </span>
          </div>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => onNavigate?.(item)}
                className={`px-4 py-2 text-sm transition-colors rounded-md ${
                  activeSection === item
                    ? "text-amber-400 bg-amber-400/10"
                    : "text-[#a0a0b8] hover:text-[#f5f0e8] hover:bg-white/5"
                }`}
                style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
              >
                {item}
              </button>
            ))}
          </div>

          {/* Record badge */}
          <div className="hidden md:flex items-center gap-4">
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-[#a0a0b8]">Season Record</div>
              <div className="text-sm font-semibold text-emerald-400">247-189 (56.7%)</div>
            </div>
            <div className="w-px h-8 bg-[#2a2a4a]" />
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-wider text-[#a0a0b8]">ROI</div>
              <div className="text-sm font-semibold text-emerald-400">+8.3%</div>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden text-[#a0a0b8] hover:text-[#f5f0e8]"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#2a2a4a] bg-[#1a1a2e]">
          <div className="px-4 py-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item}
                onClick={() => { onNavigate?.(item); setMobileOpen(false); }}
                className={`block w-full text-left px-3 py-2 rounded-md text-sm ${
                  activeSection === item
                    ? "text-amber-400 bg-amber-400/10"
                    : "text-[#a0a0b8] hover:text-[#f5f0e8]"
                }`}
              >
                {item}
              </button>
            ))}
            <div className="flex gap-6 pt-3 mt-2 border-t border-[#2a2a4a]">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#a0a0b8]">Record</div>
                <div className="text-sm font-semibold text-emerald-400">247-189</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[#a0a0b8]">ROI</div>
                <div className="text-sm font-semibold text-emerald-400">+8.3%</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
