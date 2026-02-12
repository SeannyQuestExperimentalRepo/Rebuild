"use client";

import { useState } from "react";
import { ConfidenceStars } from "./confidence-stars";
import { SignificanceBadge } from "@/components/trends/significance-badge";
import { TrackBetButton } from "./track-bet-button";
import type { LiveScore } from "@/hooks/use-live-scores";

interface ReasoningEntry {
  angle: string;
  weight: number;
  strength: "strong" | "moderate" | "weak" | "noise";
  record?: string;
}

interface Pick {
  id: number;
  sport: string;
  pickType: string;
  homeTeam: string;
  awayTeam: string;
  homeRank?: number | null;
  awayRank?: number | null;
  gameDate: string;
  pickSide: string;
  line: number | null;
  pickLabel: string;
  trendScore: number;
  confidence: number;
  headline: string;
  reasoning: ReasoningEntry[];
  result: string;
}

interface GamePickCardProps {
  spreadPick?: Pick;
  ouPick?: Pick;
  liveScore?: LiveScore;
}

function PickBox({ pick }: { pick: Pick }) {
  const [expanded, setExpanded] = useState(false);

  const resultBadge =
    pick.result === "WIN"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : pick.result === "LOSS"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : pick.result === "PUSH"
          ? "bg-amber-500/15 text-amber-400 border-amber-500/30"
          : "";

  return (
    <div className="flex-1 rounded-xl border border-border/60 bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{pick.pickLabel}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{pick.headline}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <ConfidenceStars confidence={pick.confidence} />
          <span className="font-mono text-xs tabular-nums text-muted-foreground/70">
            Score: {pick.trendScore}
          </span>
        </div>
      </div>

      {pick.result !== "PENDING" && (
        <div className="mt-2">
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${resultBadge}`}>
            {pick.result}
          </span>
        </div>
      )}

      <button
        onClick={() => setExpanded(!expanded)}
        className="mt-2 text-xs text-muted-foreground/70 transition-colors hover:text-foreground"
      >
        {expanded ? "Hide reasoning ▴" : "Show reasoning ▾"}
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
          {pick.reasoning.map((r, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-xs"
            >
              <SignificanceBadge strength={r.strength} size="sm" />
              <span className="text-muted-foreground">{r.angle}</span>
            </div>
          ))}
        </div>
      )}

      {pick.result === "PENDING" && (
        <div className="mt-2">
          <TrackBetButton
            sport={pick.sport}
            betType={pick.pickType === "OVER_UNDER" ? "OVER_UNDER" : "SPREAD"}
            homeTeam={pick.homeTeam}
            awayTeam={pick.awayTeam}
            gameDate={pick.gameDate}
            pickSide={pick.pickSide}
            line={pick.line}
            dailyPickId={pick.id}
          />
        </div>
      )}
    </div>
  );
}

function GameStatus({ liveScore, gameDate }: { liveScore?: LiveScore; gameDate: string }) {
  if (!liveScore || liveScore.status === "scheduled") {
    const gameTime = new Date(gameDate).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: "America/New_York",
    });
    return <span>{gameTime} ET</span>;
  }

  if (liveScore.status === "in_progress") {
    return (
      <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
        </span>
        <span className="font-mono tabular-nums">
          {liveScore.awayScore} - {liveScore.homeScore}
        </span>
        <span className="font-normal text-muted-foreground/70">{liveScore.statusDetail}</span>
      </span>
    );
  }

  // Final
  return (
    <span className="flex items-center gap-1.5 text-muted-foreground">
      <span className="font-mono font-semibold tabular-nums text-foreground/80">
        {liveScore.awayScore} - {liveScore.homeScore}
      </span>
      <span>Final</span>
    </span>
  );
}

export function GamePickCard({ spreadPick, ouPick, liveScore }: GamePickCardProps) {
  const pick = spreadPick || ouPick;
  if (!pick) return null;

  const isLive = liveScore?.status === "in_progress";
  const isFinal = liveScore?.status === "final";

  return (
    <div className={`rounded-xl border bg-card p-4 transition-colors ${
      isLive
        ? "border-emerald-500/30 hover:border-emerald-500/50"
        : isFinal
          ? "border-border/40"
          : "border-border/60 hover:border-primary/25"
    }`}>
      {/* Header */}
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="text-sm font-medium">
          {pick.awayRank && pick.awayRank <= 25 ? <span className="text-primary/80">#{pick.awayRank} </span> : null}
          {pick.awayTeam} <span className="text-muted-foreground">@</span>{" "}
          {pick.homeRank && pick.homeRank <= 25 ? <span className="text-primary/80">#{pick.homeRank} </span> : null}
          {pick.homeTeam}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground/70">
          {spreadPick?.line != null && (
            <span className="font-mono">Spread: {spreadPick.line > 0 ? "+" : ""}{spreadPick.line}</span>
          )}
          {ouPick?.line != null && <span className="font-mono">O/U: {ouPick.line}</span>}
          <GameStatus liveScore={liveScore} gameDate={pick.gameDate} />
        </div>
      </div>

      {/* Pick boxes */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {spreadPick && <PickBox pick={spreadPick} />}
        {ouPick && <PickBox pick={ouPick} />}
      </div>
    </div>
  );
}
