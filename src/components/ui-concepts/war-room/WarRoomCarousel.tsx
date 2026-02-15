"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CarouselCard {
  id: string;
  awayTeam: string;
  homeTeam: string;
  awayColor: string;
  homeColor: string;
  awayRecord: string;
  homeRecord: string;
  spread: string;
  pick: string;
  pickSide: "away" | "home";
  confidence: number; // 1-5 stars
  hook: string;
  time: string;
  league: string;
}

interface WarRoomCarouselProps {
  cards: CarouselCard[];
  onCardClick?: (card: CarouselCard) => void;
}

// ─── Star Rating ─────────────────────────────────────────────────────────────

function Stars({ count, max = 5 }: { count: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i < count ? "text-amber-400" : "text-[#2a2a4a]"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WarRoomCarousel({ cards, onCardClick }: WarRoomCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [checkScroll]);

  const scroll = (dir: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: dir * 340, behavior: "smooth" });
  };

  return (
    <div className="relative group">
      {/* Arrows */}
      {canScrollLeft && (
        <button
          onClick={() => scroll(-1)}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a2e]/90 border border-[#2a2a4a] text-[#f5f0e8] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a2a4a]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
      )}
      {canScrollRight && (
        <button
          onClick={() => scroll(1)}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-[#1a1a2e]/90 border border-[#2a2a4a] text-[#f5f0e8] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#2a2a4a]"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {/* Scroll container */}
      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 px-1 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {cards.map((card) => (
          <div
            key={card.id}
            onClick={() => onCardClick?.(card)}
            className="snap-start shrink-0 w-[320px] rounded-xl overflow-hidden cursor-pointer group/card hover:scale-[1.02] transition-transform duration-200"
            style={{
              background: `linear-gradient(135deg, ${card.awayColor}22, ${card.homeColor}22)`,
            }}
          >
            {/* Top color bar */}
            <div
              className="h-1.5"
              style={{ background: `linear-gradient(to right, ${card.awayColor}, ${card.homeColor})` }}
            />

            <div className="p-5 bg-[#16162a]/80 backdrop-blur-sm border border-[#2a2a4a] border-t-0 rounded-b-xl">
              {/* League & time */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 font-medium">
                  {card.league}
                </span>
                <span className="text-[11px] text-[#a0a0b8]">{card.time}</span>
              </div>

              {/* Matchup */}
              <div className="space-y-1.5 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.awayColor }} />
                    <span className={`text-sm font-semibold ${card.pickSide === "away" ? "text-[#f5f0e8]" : "text-[#a0a0b8]"}`}>
                      {card.awayTeam}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#a0a0b8]">{card.awayRecord}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: card.homeColor }} />
                    <span className={`text-sm font-semibold ${card.pickSide === "home" ? "text-[#f5f0e8]" : "text-[#a0a0b8]"}`}>
                      {card.homeTeam}
                    </span>
                  </div>
                  <span className="text-[11px] text-[#a0a0b8]">{card.homeRecord}</span>
                </div>
              </div>

              {/* Pick */}
              <div className="bg-[#1a1a2e] rounded-lg p-3 mb-3 border border-[#2a2a4a]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">The Pick</span>
                  <Stars count={card.confidence} />
                </div>
                <div className="text-[#f5f0e8] font-semibold text-sm">{card.pick}</div>
              </div>

              {/* Hook */}
              <p
                className="text-[13px] text-[#c0c0d0] leading-relaxed italic"
                style={{ fontFamily: "Georgia, serif" }}
              >
                &ldquo;{card.hook}&rdquo;
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
