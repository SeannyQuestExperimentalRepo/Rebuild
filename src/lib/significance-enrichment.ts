/**
 * Significance Enrichment Module
 *
 * Adds statistical significance analysis to existing TrendResult and
 * PlayerTrendResult objects. This is a post-processing step applied
 * in API routes — the core engines remain unchanged.
 *
 * Enriches:
 * - Win rate significance (is the win% significantly different from baseline?)
 * - ATS significance (is ATS% significantly different from 50%?)
 * - O/U significance (is over% significantly different from 50%?)
 * - Per-season significance (which seasons were statistically notable?)
 */

import {
  analyzeTrendSignificance,
  type TrendSignificance,
} from "./trend-stats";
import type { TrendSummary, SeasonBreakdown } from "./trend-engine";
import type { PlayerTrendSummary, PlayerSeasonBreakdown } from "./player-trend-engine";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SignificanceEnrichment {
  /** Is the win rate significantly different from the baseline? */
  winRate: TrendSignificance;
  /** Is the ATS rate significantly different from 50%? */
  ats: TrendSignificance;
  /** Is the over rate significantly different from 50%? */
  overUnder: TrendSignificance;
  /** Per-season significance (only seasons with notable deviations) */
  notableSeasons: {
    season: number;
    ats: TrendSignificance;
    winRate: TrendSignificance;
  }[];
  /** Quick summary: what's the single most notable finding? */
  topFinding: string;
}

// ─── Baseline Win Rates ──────────────────────────────────────────────────────────

/**
 * Estimate a reasonable baseline win rate based on perspective.
 *
 * The baseline depends on what we're measuring against:
 * - Home teams typically win ~57% in NFL, ~60% in NCAAF/NCAAMB
 * - Away teams win ~43%
 * - Favorites/underdogs: 50% ATS by definition
 * - Team-specific: use 50% (are they better than average?)
 */
export function getWinRateBaseline(
  perspective?: string,
  sport?: string,
): number {
  if (perspective === "favorite") return 0.66; // Favorites win ~66% straight up
  if (perspective === "underdog") return 0.34;

  if (perspective === "home") {
    if (sport === "NFL") return 0.57;
    if (sport === "NCAAF") return 0.60;
    if (sport === "NCAAMB") return 0.62;
    return 0.57;
  }
  if (perspective === "away") {
    if (sport === "NFL") return 0.43;
    if (sport === "NCAAF") return 0.40;
    if (sport === "NCAAMB") return 0.38;
    return 0.43;
  }

  return 0.50; // Default for "team" perspective
}

// ─── Enrichment Functions ────────────────────────────────────────────────────────

/**
 * Enrich a game trend summary with statistical significance.
 */
export function enrichGameSummary(
  summary: TrendSummary,
  perspective?: string,
  sport?: string,
): SignificanceEnrichment {
  const winBaseline = getWinRateBaseline(perspective, sport);

  // Win rate significance
  const winRate = analyzeTrendSignificance(
    summary.wins,
    summary.wins + summary.losses,
    winBaseline,
  );

  // ATS significance (baseline always 50%)
  const atsTotal = summary.atsCovered + summary.atsLost;
  const ats = analyzeTrendSignificance(
    summary.atsCovered,
    atsTotal,
    0.5,
  );

  // O/U significance (baseline always 50%)
  const ouTotal = summary.overs + summary.unders;
  const overUnder = analyzeTrendSignificance(
    summary.overs,
    ouTotal,
    0.5,
  );

  // Notable seasons
  const notableSeasons = findNotableSeasons(
    summary.bySeasonBreakdown,
    winBaseline,
  );

  // Top finding
  const topFinding = determineTopFinding(winRate, ats, overUnder, summary);

  return {
    winRate,
    ats,
    overUnder,
    notableSeasons,
    topFinding,
  };
}

/**
 * Enrich a player trend summary with statistical significance.
 */
export function enrichPlayerSummary(
  summary: PlayerTrendSummary,
): SignificanceEnrichment {
  // For player queries, win rate baseline is 50% (team is average)
  const winRate = analyzeTrendSignificance(
    summary.wins,
    summary.wins + summary.losses,
    0.5,
  );

  // ATS significance
  const atsTotal = summary.atsCovered + summary.atsLost;
  const ats = analyzeTrendSignificance(
    summary.atsCovered,
    atsTotal,
    0.5,
  );

  // O/U significance
  const ouTotal = summary.ouOver + summary.ouUnder;
  const overUnder = analyzeTrendSignificance(
    summary.ouOver,
    ouTotal,
    0.5,
  );

  // Notable seasons (player engine has different breakdown format)
  const notableSeasons = findNotablePlayerSeasons(
    summary.bySeasonBreakdown,
  );

  // Top finding
  const topFinding = determineTopFinding(winRate, ats, overUnder, {
    ...summary,
    overs: summary.ouOver,
    unders: summary.ouUnder,
  });

  return {
    winRate,
    ats,
    overUnder,
    notableSeasons,
    topFinding,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function findNotableSeasons(
  seasons: SeasonBreakdown[],
  winBaseline: number,
): SignificanceEnrichment["notableSeasons"] {
  const notable: SignificanceEnrichment["notableSeasons"] = [];

  for (const s of seasons) {
    if (s.games < 10) continue; // Need enough games for meaningful analysis

    const winSig = analyzeTrendSignificance(s.wins, s.wins + s.losses, winBaseline);
    const atsSig = analyzeTrendSignificance(
      s.atsCovered,
      s.atsCovered + s.atsLost,
      0.5,
    );

    if (winSig.strength !== "noise" || atsSig.strength !== "noise") {
      notable.push({
        season: s.season,
        ats: atsSig,
        winRate: winSig,
      });
    }
  }

  return notable.sort(
    (a, b) => Math.abs(b.ats.zScore) - Math.abs(a.ats.zScore),
  );
}

function findNotablePlayerSeasons(
  seasons: PlayerSeasonBreakdown[],
): SignificanceEnrichment["notableSeasons"] {
  const notable: SignificanceEnrichment["notableSeasons"] = [];

  for (const s of seasons) {
    if (s.games < 5) continue;

    const winSig = analyzeTrendSignificance(s.wins, s.wins + s.losses, 0.5);
    const atsSig = analyzeTrendSignificance(
      s.atsCovered,
      s.atsCovered + s.atsLost,
      0.5,
    );

    if (
      winSig.strength !== "noise" ||
      atsSig.strength !== "noise"
    ) {
      notable.push({
        season: s.season,
        ats: atsSig,
        winRate: winSig,
      });
    }
  }

  return notable.sort(
    (a, b) => Math.abs(b.ats.zScore) - Math.abs(a.ats.zScore),
  );
}

function determineTopFinding(
  winRate: TrendSignificance,
  ats: TrendSignificance,
  overUnder: TrendSignificance,
  summary: { wins?: number; losses?: number; winPct?: number; atsCovered?: number; atsLost?: number; atsPct?: number; overs?: number; unders?: number },
): string {
  // Rank findings by significance
  const findings: { label: string; sig: TrendSignificance }[] = [
    { label: "ATS", sig: ats },
    { label: "Win Rate", sig: winRate },
    { label: "O/U", sig: overUnder },
  ];

  // Sort by strength (strong > moderate > weak > noise), then by p-value
  const strengthRank: Record<string, number> = {
    strong: 0,
    moderate: 1,
    weak: 2,
    noise: 3,
  };

  findings.sort((a, b) => {
    const aRank = strengthRank[a.sig.strength] ?? 3;
    const bRank = strengthRank[b.sig.strength] ?? 3;
    if (aRank !== bRank) return aRank - bRank;
    return a.sig.pValue - b.sig.pValue;
  });

  const best = findings[0];
  if (best.sig.strength === "noise") {
    return "No statistically significant trends found";
  }

  if (best.label === "ATS") {
    const pct = summary.atsPct || (summary.atsCovered && summary.atsLost
      ? Math.round((summary.atsCovered / (summary.atsCovered + summary.atsLost)) * 1000) / 10
      : 0);
    return `${best.sig.strength === "strong" ? "Strong" : "Notable"} ATS trend: ${pct}% cover rate (${best.sig.label})`;
  }

  if (best.label === "Win Rate") {
    const pct = summary.winPct || 0;
    return `${best.sig.strength === "strong" ? "Strong" : "Notable"} win rate: ${pct}% (${best.sig.label})`;
  }

  if (best.label === "O/U") {
    const total = (summary.overs || 0) + (summary.unders || 0);
    const overPct = total > 0 ? Math.round(((summary.overs || 0) / total) * 1000) / 10 : 0;
    const direction = overPct > 50 ? "overs" : "unders";
    const pct = overPct > 50 ? overPct : Math.round((100 - overPct) * 10) / 10;
    return `${best.sig.strength === "strong" ? "Strong" : "Notable"} O/U trend: ${pct}% ${direction} (${best.sig.label})`;
  }

  return best.sig.label;
}
