"use client";

import { useState, useCallback } from "react";
import {
  analyzeParlay,
  oddsToImpliedProb,
  type ParlayLeg,
  type ParlayAnalysis,
} from "@/lib/parlay-engine";

function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function LegInput({
  index,
  leg,
  onChange,
  onRemove,
}: {
  index: number;
  leg: Partial<ParlayLeg>;
  onChange: (index: number, field: string, value: string | number) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3">
      <span className="text-xs font-medium text-muted-foreground/60">
        #{index + 1}
      </span>
      <select
        value={leg.type || "SPREAD"}
        onChange={(e) => onChange(index, "type", e.target.value)}
        className="rounded border border-border/60 bg-background px-2 py-1 text-xs"
      >
        <option value="SPREAD">Spread</option>
        <option value="OVER_UNDER">Over/Under</option>
        <option value="MONEYLINE">Moneyline</option>
      </select>
      <input
        type="text"
        placeholder="Team / Pick"
        value={leg.pickSide || ""}
        onChange={(e) => onChange(index, "pickSide", e.target.value)}
        className="w-32 rounded border border-border/60 bg-background px-2 py-1 text-xs"
      />
      <input
        type="number"
        placeholder="Line"
        value={leg.line ?? ""}
        onChange={(e) =>
          onChange(index, "line", e.target.value ? parseFloat(e.target.value) : "")
        }
        className="w-20 rounded border border-border/60 bg-background px-2 py-1 text-xs font-mono tabular-nums"
      />
      <input
        type="number"
        placeholder="Odds (-110)"
        value={leg.odds ?? ""}
        onChange={(e) =>
          onChange(index, "odds", e.target.value ? parseInt(e.target.value) : "")
        }
        className="w-24 rounded border border-border/60 bg-background px-2 py-1 text-xs font-mono tabular-nums"
      />
      <input
        type="number"
        placeholder="Your prob %"
        value={leg.modelProb ? Math.round(leg.modelProb * 100) : ""}
        onChange={(e) =>
          onChange(
            index,
            "modelProb",
            e.target.value ? parseInt(e.target.value) / 100 : "",
          )
        }
        className="w-20 rounded border border-border/60 bg-background px-2 py-1 text-xs font-mono tabular-nums"
      />
      <button
        onClick={() => onRemove(index)}
        className="rounded p-1 text-muted-foreground/60 transition-colors hover:text-destructive"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function AnalysisResult({ analysis }: { analysis: ParlayAnalysis }) {
  const evColor =
    analysis.expectedValue > 0.05
      ? "text-emerald-400"
      : analysis.expectedValue > 0
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-6">
      <h3 className="text-sm font-semibold">Analysis</h3>

      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            Combined Odds
          </div>
          <div className="mt-0.5 font-mono text-lg font-bold tabular-nums">
            {formatOdds(analysis.parlayOdds)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            True Probability
          </div>
          <div className="mt-0.5 font-mono text-lg font-bold tabular-nums">
            {formatPercent(analysis.trueJointProb)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            Expected Value
          </div>
          <div className={`mt-0.5 font-mono text-lg font-bold tabular-nums ${evColor}`}>
            {analysis.expectedValue > 0 ? "+" : ""}
            {(analysis.expectedValue * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground/60">
            Suggested Stake
          </div>
          <div className="mt-0.5 font-mono text-lg font-bold tabular-nums">
            ${analysis.suggestedStake}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <div className="flex justify-between">
          <span>Book implied probability:</span>
          <span className="font-mono">{formatPercent(analysis.bookImpliedProb)}</span>
        </div>
        <div className="flex justify-between">
          <span>Kelly fraction (quarter):</span>
          <span className="font-mono">{formatPercent(analysis.kellyFraction * 0.25)}</span>
        </div>
        {analysis.isSameGame && (
          <div className="mt-2 rounded-full bg-primary/10 px-2 py-0.5 text-center text-primary">
            Same Game Parlay — legs are independent (r=0.005)
          </div>
        )}
      </div>

      {/* Teaser analysis */}
      {analysis.teaserAnalysis && (
        <div className="mt-4 border-t border-border/40 pt-4">
          <h4 className="text-xs font-semibold">
            Teaser Option (+{analysis.teaserAnalysis.teaserPoints} points)
          </h4>
          <div className="mt-2 space-y-1">
            {analysis.teaserAnalysis.adjustedLegs.map((leg, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  Leg {i + 1}: {leg.originalLine > 0 ? "+" : ""}{leg.originalLine} →{" "}
                  {leg.teasedLine > 0 ? "+" : ""}{leg.teasedLine}
                </span>
                <span className="font-mono">
                  {formatPercent(leg.originalProb)} → {formatPercent(leg.teasedProb)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                analysis.teaserAnalysis.recommendation === "strong"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : analysis.teaserAnalysis.recommendation === "moderate"
                    ? "bg-amber-500/15 text-amber-400"
                    : "bg-red-500/15 text-red-400"
              }`}
            >
              {analysis.teaserAnalysis.recommendation === "strong"
                ? "Strong Teaser"
                : analysis.teaserAnalysis.recommendation === "moderate"
                  ? "Marginal Teaser"
                  : "Avoid Teaser"}
            </span>
            <span className="text-xs text-muted-foreground">
              EV: {(analysis.teaserAnalysis.teaserEV * 100).toFixed(1)}% at{" "}
              {formatOdds(analysis.teaserAnalysis.teaserOdds)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParlaysPage() {
  const [legIdCounter, setLegIdCounter] = useState(2);
  const [legs, setLegs] = useState<(Partial<ParlayLeg> & { _id: number })[]>([
    { _id: 0, type: "SPREAD", odds: -110, modelProb: 0.52 },
    { _id: 1, type: "SPREAD", odds: -110, modelProb: 0.52 },
  ]);
  const [analysis, setAnalysis] = useState<ParlayAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addLeg = () => {
    setLegs([...legs, { _id: legIdCounter, type: "SPREAD", odds: -110, modelProb: 0.52 }]);
    setLegIdCounter((c) => c + 1);
  };

  const removeLeg = (index: number) => {
    if (legs.length <= 2) return;
    setLegs(legs.filter((_, i) => i !== index));
  };

  const updateLeg = useCallback(
    (index: number, field: string, value: string | number) => {
      setLegs((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: value };
        return next;
      });
    },
    [],
  );

  const runAnalysis = () => {
    setError(null);
    try {
      const fullLegs: ParlayLeg[] = legs.map((l, i) => ({
        id: `leg-${i}`,
        type: (l.type as ParlayLeg["type"]) || "SPREAD",
        homeTeam: "",
        awayTeam: "",
        pickSide: l.pickSide || `Leg ${i + 1}`,
        line: typeof l.line === "number" ? l.line : null,
        odds: typeof l.odds === "number" ? l.odds : -110,
        impliedProb: oddsToImpliedProb(typeof l.odds === "number" ? l.odds : -110),
        modelProb: typeof l.modelProb === "number" ? l.modelProb : 0.5,
        gameId: l.type === "OVER_UNDER" ? `game-${i}` : undefined,
      }));

      // Detect SGP: if any two legs share a gameId
      const gameMap = new Map<string, number>();
      for (const leg of fullLegs) {
        if (leg.gameId) {
          gameMap.set(leg.gameId, (gameMap.get(leg.gameId) || 0) + 1);
        }
      }

      const result = analyzeParlay(fullLegs);
      setAnalysis(result);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Parlay Builder</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Analyze parlays and teasers with true probability modeling.
          Based on KenPom independence analysis (r=0.005 ATS/O-U correlation).
        </p>
      </div>

      {/* Leg inputs */}
      <div className="space-y-2">
        {legs.map((leg, i) => (
          <LegInput
            key={leg._id}
            index={i}
            leg={leg}
            onChange={updateLeg}
            onRemove={removeLeg}
          />
        ))}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          onClick={addLeg}
          className="rounded-lg border border-border/60 bg-secondary/40 px-3 py-2 text-sm font-medium transition-colors hover:bg-secondary"
        >
          + Add Leg
        </button>
        <button
          onClick={runAnalysis}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Analyze
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {analysis && <AnalysisResult analysis={analysis} />}

      {/* Info section */}
      <div className="mt-8 rounded-xl border border-border/40 bg-card p-6">
        <h3 className="text-sm font-semibold">How it works</h3>
        <ul className="mt-3 space-y-2 text-xs text-muted-foreground">
          <li>
            <span className="font-medium text-foreground">Independence:</span>{" "}
            ATS and O/U outcomes are independent (r=0.005), so SGP joint probability = product of individual probs.
          </li>
          <li>
            <span className="font-medium text-foreground">Teasers:</span>{" "}
            +6 point teasers on games with |KenPom edge| &gt; 7 historically cover at 79.4% (ROI: +45.5%).
          </li>
          <li>
            <span className="font-medium text-foreground">Kelly Criterion:</span>{" "}
            Suggested stake uses quarter-Kelly (conservative) based on a $1,000 bankroll.
          </li>
          <li>
            <span className="font-medium text-foreground">Your prob %:</span>{" "}
            Enter your estimated true probability for each leg. Default 52% represents a marginal edge.
          </li>
        </ul>
      </div>
    </div>
  );
}
