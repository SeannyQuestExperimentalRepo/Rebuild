"use client";

import { useState } from "react";
import { useCreateBet } from "@/hooks/use-bets";

interface TrackBetProps {
  sport: string;
  betType: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  pickSide: string;
  line: number | null;
  dailyPickId: number;
  playerName?: string | null;
  propStat?: string | null;
  propLine?: number | null;
}

export function TrackBetButton(props: TrackBetProps) {
  const [open, setOpen] = useState(false);
  const [stake, setStake] = useState("");
  const [odds, setOdds] = useState("-110");
  const [sportsbook, setSportsbook] = useState("");
  const [tracked, setTracked] = useState(false);

  const createBet = useCreateBet();

  if (tracked) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
        Tracked
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Track
      </button>
    );
  }

  const handleSubmit = async () => {
    const stakeNum = parseFloat(stake);
    if (!stakeNum || stakeNum <= 0) return;

    try {
      await createBet.mutateAsync({
        sport: props.sport,
        betType: props.betType,
        gameDate: props.gameDate,
        homeTeam: props.homeTeam,
        awayTeam: props.awayTeam,
        pickSide: props.pickSide,
        line: props.line ?? undefined,
        oddsValue: parseInt(odds) || -110,
        stake: stakeNum,
        sportsbook: sportsbook || undefined,
        playerName: props.playerName ?? undefined,
        propStat: props.propStat ?? undefined,
        propLine: props.propLine ?? undefined,
        dailyPickId: props.dailyPickId,
      });
      setTracked(true);
      setOpen(false);
    } catch {
      // error is in createBet.error
    }
  };

  return (
    <div
      className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2">
        <input
          type="number"
          placeholder="Stake"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          className="w-20 rounded border border-border/60 bg-background px-2 py-1 text-xs tabular-nums"
          autoFocus
        />
        <input
          type="number"
          placeholder="Odds"
          value={odds}
          onChange={(e) => setOdds(e.target.value)}
          className="w-20 rounded border border-border/60 bg-background px-2 py-1 text-xs tabular-nums"
        />
        <select
          value={sportsbook}
          onChange={(e) => setSportsbook(e.target.value)}
          className="rounded border border-border/60 bg-background px-1 py-1 text-xs"
        >
          <option value="">Book</option>
          <option value="FanDuel">FanDuel</option>
          <option value="DraftKings">DraftKings</option>
          <option value="BetMGM">BetMGM</option>
          <option value="Caesars">Caesars</option>
          <option value="ESPN BET">ESPN BET</option>
        </select>
        <button
          onClick={handleSubmit}
          disabled={createBet.isPending || !stake}
          className="rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {createBet.isPending ? "..." : "Add"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>
      {createBet.error && (
        <p className="mt-1 text-xs text-destructive">
          {(createBet.error as Error).message}
        </p>
      )}
    </div>
  );
}
