"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SignificanceBadge } from "@/components/trends/significance-badge";
import { useAngles } from "@/hooks/use-angles";

interface DiscoveredAngle {
  id: string;
  label: string;
  headline: string;
  category: string;
  sport: string;
  record: {
    wins: number;
    losses: number;
    winPct: number;
    atsCovered: number;
    atsLost: number;
    atsPush: number;
    atsPct: number;
    atsRecord: string;
    overs: number;
    unders: number;
    overPct: number;
    ouRecord: string;
    avgMargin: number;
    avgSpread: number | null;
    avgTotalPoints: number;
    totalGames: number;
  };
  atsSignificance: {
    strength: "strong" | "moderate" | "weak" | "noise";
    pValue: number;
    zScore: number;
    observedRate: number;
    label: string;
    sampleSize: number;
    confidenceInterval: [number, number];
  };
  interestScore: number;
}

type SportFilter = "NFL" | "NCAAF" | "NCAAMB";
type StrengthFilter = "all" | "strong" | "moderate" | "weak";

export default function TrendsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-5xl px-4 py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <TrendsPageInner />
    </Suspense>
  );
}

function TrendsPageInner() {
  const searchParams = useSearchParams();
  const sportParam = searchParams.get("sport");
  const initialSport: SportFilter =
    sportParam === "NCAAF" || sportParam === "NCAAMB" ? sportParam : "NFL";

  const [sport, setSport] = useState<SportFilter>(initialSport);
  const [minStrength, setMinStrength] = useState<StrengthFilter>("all");
  const [team, setTeam] = useState("");
  const [submittedParams, setSubmittedParams] = useState({
    sport: initialSport as string,
    team: "",
    minStrength: undefined as string | undefined,
  });

  const { data, isLoading: loading, error: queryError, isFetched } = useAngles(submittedParams);
  const angles: DiscoveredAngle[] = data?.angles ?? [];
  const error = queryError ? (queryError as Error).message : null;

  const discover = () => {
    setSubmittedParams({
      sport,
      team: team.trim() || "",
      minStrength: minStrength !== "all" ? minStrength : undefined,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Discover Trends</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Auto-discover the most statistically significant betting angles across
          45+ templates
        </p>
      </div>

      {/* Filters */}
      <div className="mb-8 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Sport
          </label>
          <div className="flex rounded-lg border border-border/60 bg-card">
            {(["NFL", "NCAAF", "NCAAMB"] as SportFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setSport(s);
                  setSubmittedParams((prev) => ({ ...prev, sport: s }));
                }}
                className={`px-3.5 py-2 text-sm font-medium transition-all first:rounded-l-lg last:rounded-r-lg ${
                  sport === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Team (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Kansas City Chiefs"
            className="rounded-lg border border-border/60 bg-card px-3.5 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/50 transition-colors focus:border-primary/40"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && discover()}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            Min Strength
          </label>
          <select
            className="rounded-lg border border-border/60 bg-card px-3.5 py-2 text-sm text-foreground outline-none"
            value={minStrength}
            onChange={(e) =>
              setMinStrength(e.target.value as StrengthFilter)
            }
          >
            <option value="all">All</option>
            <option value="weak">Weak+</option>
            <option value="moderate">Moderate+</option>
            <option value="strong">Strong only</option>
          </select>
        </div>

        <button
          onClick={discover}
          disabled={loading}
          className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-40"
        >
          {loading ? "Scanning..." : "Discover"}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center gap-4 py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
          <p className="text-sm text-muted-foreground">
            Scanning 45+ angle templates for {sport}...
          </p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-5 py-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && angles.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found <span className="font-mono font-semibold text-foreground">{angles.length}</span> notable angles
          </p>
          <div className="stagger-in space-y-3">
            {angles.map((angle, i) => (
              <AngleCard key={i} angle={angle} rank={i + 1} />
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && isFetched && angles.length === 0 && !error && (
        <div className="rounded-xl border border-border/40 bg-card py-16 text-center">
          <p className="text-muted-foreground">
            No significant angles found. Try a different sport or team.
          </p>
        </div>
      )}
    </div>
  );
}

function AngleCard({
  angle,
  rank,
}: {
  angle: DiscoveredAngle;
  rank: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const { atsPct, atsRecord, totalGames, wins, losses, winPct, ouRecord, overPct, avgMargin } = angle.record;
  const pValue = angle.atsSignificance.pValue;
  const pDisplay = pValue < 0.001 ? "<0.001" : pValue.toFixed(3);
  const atsColor = atsPct >= 55 ? "text-emerald-400" : atsPct <= 45 ? "text-red-400" : "text-foreground";
  const barColor = atsPct >= 55 ? "bg-emerald-500" : atsPct <= 45 ? "bg-red-500" : "bg-muted-foreground";

  const whyItMatters = `${angle.headline} — covering at ${atsPct}% across ${totalGames} games. ${angle.atsSignificance.label}. Average margin of victory: ${avgMargin > 0 ? "+" : ""}${avgMargin.toFixed(1)} points.`;

  return (
    <div
      className="cursor-pointer rounded-xl border border-border/60 bg-card transition-all hover:border-primary/25 hover:shadow-[0_0_15px_hsl(168_80%_45%/0.05)]"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-start gap-4 px-5 py-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-sm font-bold text-primary">
          {rank}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-tight">{angle.headline}</h3>
            <SignificanceBadge strength={angle.atsSignificance.strength} />
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-bold font-mono ${atsColor}`}>{atsPct}%</span>
              <span className="text-sm font-medium text-muted-foreground">ATS</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2.5">
              <div className="h-1.5 flex-1 rounded-full bg-border/60 overflow-hidden max-w-[180px]">
                <div
                  className={`h-full rounded-full ${barColor} transition-all`}
                  style={{ width: `${Math.min(atsPct, 100)}%` }}
                />
              </div>
              <span className="font-mono text-xs text-muted-foreground">({atsRecord})</span>
            </div>
          </div>

          <p className="mt-2 text-xs text-muted-foreground/70">
            {totalGames} games · {angle.category}
          </p>
        </div>

        <svg
          className={`h-5 w-5 shrink-0 text-muted-foreground/50 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>

      {expanded && (
        <div className="border-t border-border/30 px-5 py-4 space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {whyItMatters}
          </p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              <span className="text-muted-foreground/70">Record </span>
              <span className="font-mono font-medium">{wins}-{losses} ({winPct}%)</span>
            </span>
            <span>
              <span className="text-muted-foreground/70">O/U </span>
              <span className="font-mono font-medium">{ouRecord} ({overPct}% over)</span>
            </span>
            <span>
              <span className="text-muted-foreground/70">Avg margin </span>
              <span className="font-mono font-medium">{avgMargin > 0 ? "+" : ""}{avgMargin.toFixed(1)}</span>
            </span>
          </div>

          <p className="text-xs text-muted-foreground/50 font-mono">
            {angle.atsSignificance.strength.charAt(0).toUpperCase() + angle.atsSignificance.strength.slice(1)} · n={totalGames} · p={pDisplay}
          </p>
        </div>
      )}
    </div>
  );
}
