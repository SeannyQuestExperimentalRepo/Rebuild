"use client";

import Link from "next/link";

interface GameCardProps {
  homeTeam: string;
  awayTeam: string;
  gameDate: string; // ISO string
  spread: number | null;
  overUnder: number | null;
  moneylineHome: number | null;
  moneylineAway: number | null;
  sport: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSpread(spread: number | null): string {
  if (spread == null) return "—";
  if (spread > 0) return `+${spread}`;
  return `${spread}`;
}

function formatML(ml: number | null): string {
  if (ml == null) return "—";
  if (ml > 0) return `+${ml}`;
  return `${ml}`;
}

function teamSlug(name: string): string {
  return encodeURIComponent(name);
}

export default function GameCard({
  homeTeam,
  awayTeam,
  gameDate,
  spread,
  overUnder,
  moneylineHome,
  moneylineAway,
  sport,
}: GameCardProps) {
  const gameUrl = `/game/${sport.toLowerCase()}/${teamSlug(homeTeam)}/${teamSlug(awayTeam)}`;

  return (
    <Link
      href={gameUrl}
      className="block rounded-lg border border-border/60 bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm"
    >
      {/* Time */}
      <div className="mb-2 text-[11px] font-medium text-muted-foreground">
        {formatTime(gameDate)}
      </div>

      {/* Teams + Spread */}
      <div className="space-y-1">
        {/* Away team */}
        <div className="flex items-center justify-between text-sm">
          <span className="truncate font-medium">{awayTeam}</span>
          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
            {spread != null ? formatSpread(-spread) : ""}
          </span>
        </div>

        {/* Home team */}
        <div className="flex items-center justify-between text-sm">
          <span className="truncate font-medium">{homeTeam}</span>
          <span className="ml-2 shrink-0 text-xs text-muted-foreground">
            {spread != null ? formatSpread(spread) : ""}
          </span>
        </div>
      </div>

      {/* O/U and Moneylines */}
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        {overUnder != null && (
          <span>O/U {overUnder}</span>
        )}
        {moneylineHome != null && moneylineAway != null && (
          <span className="ml-auto">
            ML: {formatML(moneylineAway)}/{formatML(moneylineHome)}
          </span>
        )}
      </div>
    </Link>
  );
}
