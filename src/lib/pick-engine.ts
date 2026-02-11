/**
 * Daily Pick Engine
 *
 * Generates explicit betting picks for today's games by scoring
 * each side against historical trend data. Also grades past picks
 * after games complete.
 *
 * Reuses existing infrastructure:
 *   - loadGamesBySportCached / executeTrendQuery (trend-engine)
 *   - analyzeTrendSignificance (trend-stats)
 *   - executePlayerPropQueryFromDB (prop-trend-engine)
 */

import { prisma } from "./db";
import {
  loadGamesBySportCached,
  executeTrendQuery,
  type TrendGame,
  type TrendQuery,
} from "./trend-engine";
import {
  analyzeTrendSignificance,
  type TrendSignificance,
} from "./trend-stats";
import { executePlayerPropQueryFromDB } from "./prop-trend-engine";
import type { Sport } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ReasoningEntry {
  angle: string;
  weight: number;
  strength: "strong" | "moderate" | "weak" | "noise";
  record?: string;
}

export interface GeneratedPick {
  sport: Sport;
  pickType: "SPREAD" | "OVER_UNDER" | "PLAYER_PROP";
  homeTeam: string;
  awayTeam: string;
  gameDate: Date;
  pickSide: string;
  line: number | null;
  pickLabel: string;
  playerName: string | null;
  propStat: string | null;
  propLine: number | null;
  trendScore: number;
  confidence: number;
  headline: string;
  reasoning: ReasoningEntry[];
}

interface SideScore {
  home: number;
  away: number;
  homeReasons: ReasoningEntry[];
  awayReasons: ReasoningEntry[];
}

interface OUSideScore {
  over: number;
  under: number;
  overReasons: ReasoningEntry[];
  underReasons: ReasoningEntry[];
}

// ─── Team Name Resolution ────────────────────────────────────────────────────

const NAME_ALIASES: Record<string, string> = {
  "NC State": "N.C. State",
  "Chicago State": "Chicago St.",
  "Jackson State": "Jackson St.",
  "Indiana State": "Indiana St.",
  "Arkansas-Pine Bluff": "Arkansas Pine Bluff",
  "Texas A&M-Corpus Christi": "Texas A&M Corpus Chris",
  "Appalachian State": "Appalachian St.",
  "Bethune-Cookman": "Bethune Cookman",
  "Louisiana-Monroe": "Louisiana Monroe",
  "Ole Miss": "Mississippi",
  "UConn": "Connecticut",
  "Hawai'i": "Hawaii",
};

async function resolveCanonicalName(
  name: string,
  sport: string,
): Promise<string> {
  const exact = await prisma.team.findFirst({
    where: { sport: sport as Sport, name },
    select: { name: true },
  });
  if (exact) return exact.name;

  if (NAME_ALIASES[name]) return NAME_ALIASES[name];

  const variants = [
    name.replace(/ State$/, " St."),
    name.replace(/-/g, " "),
    name.replace(/ State$/, " St.").replace(/-/g, " "),
  ];
  for (const v of variants) {
    const match = await prisma.team.findFirst({
      where: { sport: sport as Sport, name: v },
      select: { name: true },
    });
    if (match) return match.name;
  }

  return name;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentSeason(sport: string, date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  if (sport === "NCAAMB") {
    return month >= 10 ? year + 1 : year;
  }
  // NFL/NCAAF: season = start year (Aug-Feb)
  return month <= 2 ? year - 1 : year;
}

function strengthToWeight(strength: string): number {
  switch (strength) {
    case "strong": return 8;
    case "moderate": return 5;
    case "weak": return 2;
    default: return 0;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

// ─── Season Stats ────────────────────────────────────────────────────────────

interface TeamStats {
  wins: number;
  losses: number;
  atsCovered: number;
  atsLost: number;
  atsPct: number;
  overs: number;
  unders: number;
  overPct: number;
  last5AtsCov: number;
  last5AtsLost: number;
  last5OUOvers: number;
  last5OUUnders: number;
}

function buildTeamStats(
  allGames: TrendGame[],
  team: string,
  sport: string,
  season: number,
): TeamStats {
  const teamGames = allGames
    .filter(
      (g) =>
        g.sport === sport &&
        g.season === season &&
        (g.homeTeam === team || g.awayTeam === team),
    )
    .sort((a, b) => (a.gameDate || "").localeCompare(b.gameDate || ""));

  let wins = 0, losses = 0, atsCov = 0, atsLost = 0, overs = 0, unders = 0;

  for (const g of teamGames) {
    const isHome = g.homeTeam === team;
    const won = isHome ? g.scoreDifference > 0 : g.scoreDifference < 0;
    if (won) wins++;
    else if (g.scoreDifference !== 0) losses++;

    if (isHome) {
      if (g.spreadResult === "COVERED") atsCov++;
      else if (g.spreadResult === "LOST") atsLost++;
    } else {
      if (g.spreadResult === "COVERED") atsLost++;
      else if (g.spreadResult === "LOST") atsCov++;
    }

    if (g.ouResult === "OVER") overs++;
    else if (g.ouResult === "UNDER") unders++;
  }

  const last5 = teamGames.slice(-5);
  let l5AtsCov = 0, l5AtsLost = 0, l5OUOver = 0, l5OUUnder = 0;
  for (const g of last5) {
    const isHome = g.homeTeam === team;
    if (isHome) {
      if (g.spreadResult === "COVERED") l5AtsCov++;
      else if (g.spreadResult === "LOST") l5AtsLost++;
    } else {
      if (g.spreadResult === "COVERED") l5AtsLost++;
      else if (g.spreadResult === "LOST") l5AtsCov++;
    }
    if (g.ouResult === "OVER") l5OUOver++;
    else if (g.ouResult === "UNDER") l5OUUnder++;
  }

  const atsTotal = atsCov + atsLost;
  const ouTotal = overs + unders;

  return {
    wins,
    losses,
    atsCovered: atsCov,
    atsLost,
    atsPct: atsTotal > 0 ? Math.round((atsCov / atsTotal) * 1000) / 10 : 50,
    overs,
    unders,
    overPct: ouTotal > 0 ? Math.round((overs / ouTotal) * 1000) / 10 : 50,
    last5AtsCov: l5AtsCov,
    last5AtsLost: l5AtsLost,
    last5OUOvers: l5OUOver,
    last5OUUnders: l5OUUnder,
  };
}

// ─── H2H Stats ───────────────────────────────────────────────────────────────

interface H2HStats {
  totalGames: number;
  homeAtsCov: number;
  homeAtsLost: number;
  avgTotalPoints: number;
  overs: number;
  unders: number;
}

function buildH2H(
  allGames: TrendGame[],
  homeTeam: string,
  awayTeam: string,
  sport: string,
): H2HStats {
  const matchups = allGames.filter(
    (g) =>
      g.sport === sport &&
      ((g.homeTeam === homeTeam && g.awayTeam === awayTeam) ||
        (g.homeTeam === awayTeam && g.awayTeam === homeTeam)),
  );

  let homeAtsCov = 0, homeAtsLost = 0, totalPts = 0, overs = 0, unders = 0;

  for (const g of matchups) {
    totalPts += (g.homeScore || 0) + (g.awayScore || 0);
    if (g.homeTeam === homeTeam) {
      if (g.spreadResult === "COVERED") homeAtsCov++;
      else if (g.spreadResult === "LOST") homeAtsLost++;
    } else {
      if (g.spreadResult === "COVERED") homeAtsLost++;
      else if (g.spreadResult === "LOST") homeAtsCov++;
    }
    if (g.ouResult === "OVER") overs++;
    else if (g.ouResult === "UNDER") unders++;
  }

  return {
    totalGames: matchups.length,
    homeAtsCov,
    homeAtsLost,
    avgTotalPoints: matchups.length > 0 ? Math.round((totalPts / matchups.length) * 10) / 10 : 0,
    overs,
    unders,
  };
}

// ─── Additional Trend Queries ────────────────────────────────────────────────

interface TrendSignal {
  label: string;
  record: string;
  rate: number;
  favors: "home" | "away";
  significance: TrendSignificance;
}

function runAdditionalTrends(
  sport: Sport,
  homeTeam: string,
  awayTeam: string,
  currentSeason: number,
  allGames: TrendGame[],
): TrendSignal[] {
  const signals: TrendSignal[] = [];

  const queries: {
    label: string;
    query: TrendQuery;
    favorsSide: "home" | "away";
  }[] = [
    {
      label: `${homeTeam} as Favorite`,
      query: {
        sport,
        team: homeTeam,
        perspective: "team",
        seasonRange: [currentSeason - 2, currentSeason],
        filters: [{ field: "spread", operator: "lt", value: 0 }],
      } as TrendQuery,
      favorsSide: "home",
    },
    {
      label: `${awayTeam} as Underdog`,
      query: {
        sport,
        team: awayTeam,
        perspective: "team",
        seasonRange: [currentSeason - 2, currentSeason],
        filters: [{ field: "spread", operator: "gt", value: 0 }],
      } as TrendQuery,
      favorsSide: "away",
    },
    {
      label: `${homeTeam} at Home`,
      query: {
        sport,
        team: homeTeam,
        perspective: "team",
        seasonRange: [currentSeason - 2, currentSeason],
        filters: [{ field: "isHome", operator: "eq", value: true }],
      } as TrendQuery,
      favorsSide: "home",
    },
    {
      label: `${awayTeam} on Road`,
      query: {
        sport,
        team: awayTeam,
        perspective: "team",
        seasonRange: [currentSeason - 2, currentSeason],
        filters: [{ field: "isHome", operator: "eq", value: false }],
      } as TrendQuery,
      favorsSide: "away",
    },
  ];

  for (const { label, query, favorsSide } of queries) {
    try {
      const result = executeTrendQuery(query, allGames);
      const atsTotal = result.summary.atsCovered + result.summary.atsLost;
      if (atsTotal < 5) continue;

      const sig = analyzeTrendSignificance(result.summary.atsCovered, atsTotal, 0.5);
      if (sig.strength === "noise") continue;

      signals.push({
        label,
        record: result.summary.atsRecord,
        rate: result.summary.atsPct,
        favors: sig.observedRate > 0.5 ? favorsSide : (favorsSide === "home" ? "away" : "home"),
        significance: sig,
      });
    } catch {
      // skip
    }
  }

  return signals;
}

// ─── Spread Scoring ──────────────────────────────────────────────────────────

function scoreSpread(
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HStats,
  trendSignals: TrendSignal[],
): SideScore {
  let home = 50, away = 50;
  const homeReasons: ReasoningEntry[] = [];
  const awayReasons: ReasoningEntry[] = [];

  // Source 1: Season ATS records
  const homeAtsSig = analyzeTrendSignificance(
    homeStats.atsCovered,
    homeStats.atsCovered + homeStats.atsLost,
    0.5,
  );
  if (homeAtsSig.strength !== "noise") {
    const w = strengthToWeight(homeAtsSig.strength);
    const effect = Math.round((homeStats.atsPct - 50) * 0.3);
    if (homeStats.atsPct > 50) {
      home += w + effect;
      homeReasons.push({
        angle: `${homeStats.atsCovered}-${homeStats.atsLost} ATS this season (${homeStats.atsPct}%)`,
        weight: w + effect,
        strength: homeAtsSig.strength as ReasoningEntry["strength"],
        record: `${homeStats.atsCovered}-${homeStats.atsLost}`,
      });
    } else {
      away += w + Math.abs(effect);
      awayReasons.push({
        angle: `Opponent ${homeStats.atsCovered}-${homeStats.atsLost} ATS this season (${homeStats.atsPct}%)`,
        weight: w + Math.abs(effect),
        strength: homeAtsSig.strength as ReasoningEntry["strength"],
      });
    }
  }

  const awayAtsSig = analyzeTrendSignificance(
    awayStats.atsCovered,
    awayStats.atsCovered + awayStats.atsLost,
    0.5,
  );
  if (awayAtsSig.strength !== "noise") {
    const w = strengthToWeight(awayAtsSig.strength);
    const effect = Math.round((awayStats.atsPct - 50) * 0.3);
    if (awayStats.atsPct > 50) {
      away += w + effect;
      awayReasons.push({
        angle: `${awayStats.atsCovered}-${awayStats.atsLost} ATS this season (${awayStats.atsPct}%)`,
        weight: w + effect,
        strength: awayAtsSig.strength as ReasoningEntry["strength"],
        record: `${awayStats.atsCovered}-${awayStats.atsLost}`,
      });
    } else {
      home += w + Math.abs(effect);
      homeReasons.push({
        angle: `Opponent ${awayStats.atsCovered}-${awayStats.atsLost} ATS this season (${awayStats.atsPct}%)`,
        weight: w + Math.abs(effect),
        strength: awayAtsSig.strength as ReasoningEntry["strength"],
      });
    }
  }

  // Source 2: H2H ATS
  if (h2h.totalGames >= 5) {
    const h2hTotal = h2h.homeAtsCov + h2h.homeAtsLost;
    if (h2hTotal >= 3) {
      const h2hSig = analyzeTrendSignificance(h2h.homeAtsCov, h2hTotal, 0.5);
      if (h2hSig.strength !== "noise") {
        const w = strengthToWeight(h2hSig.strength);
        const h2hPct = Math.round((h2h.homeAtsCov / h2hTotal) * 1000) / 10;
        if (h2hPct > 50) {
          home += w;
          homeReasons.push({
            angle: `H2H ATS: ${h2h.homeAtsCov}-${h2h.homeAtsLost} (${h2hPct}%)`,
            weight: w,
            strength: h2hSig.strength as ReasoningEntry["strength"],
            record: `${h2h.homeAtsCov}-${h2h.homeAtsLost}`,
          });
        } else {
          away += w;
          awayReasons.push({
            angle: `H2H ATS: ${h2h.homeAtsLost}-${h2h.homeAtsCov} (${Math.round((h2h.homeAtsLost / h2hTotal) * 1000) / 10}%)`,
            weight: w,
            strength: h2hSig.strength as ReasoningEntry["strength"],
            record: `${h2h.homeAtsLost}-${h2h.homeAtsCov}`,
          });
        }
      }
    }
  }

  // Source 3: Additional trend signals
  for (const signal of trendSignals) {
    const w = strengthToWeight(signal.significance.strength);
    const effect = Math.round((signal.rate - 50) * 0.3);
    const totalW = w + Math.abs(effect);
    const reason: ReasoningEntry = {
      angle: `${signal.label}: ${signal.record} (${signal.rate}%)`,
      weight: totalW,
      strength: signal.significance.strength as ReasoningEntry["strength"],
      record: signal.record,
    };
    if (signal.favors === "home") {
      home += totalW;
      homeReasons.push(reason);
    } else {
      away += totalW;
      awayReasons.push(reason);
    }
  }

  // Source 4: Recent form (last 5 ATS)
  const homeLast5Total = homeStats.last5AtsCov + homeStats.last5AtsLost;
  if (homeLast5Total >= 4) {
    if (homeStats.last5AtsCov >= 4) {
      home += 3;
      homeReasons.push({ angle: `Hot streak: ${homeStats.last5AtsCov}-${homeStats.last5AtsLost} ATS last 5`, weight: 3, strength: "weak" });
    } else if (homeStats.last5AtsLost >= 4) {
      away += 3;
      awayReasons.push({ angle: `Opponent cold: ${homeStats.last5AtsCov}-${homeStats.last5AtsLost} ATS last 5`, weight: 3, strength: "weak" });
    }
  }

  const awayLast5Total = awayStats.last5AtsCov + awayStats.last5AtsLost;
  if (awayLast5Total >= 4) {
    if (awayStats.last5AtsCov >= 4) {
      away += 3;
      awayReasons.push({ angle: `Hot streak: ${awayStats.last5AtsCov}-${awayStats.last5AtsLost} ATS last 5`, weight: 3, strength: "weak" });
    } else if (awayStats.last5AtsLost >= 4) {
      home += 3;
      homeReasons.push({ angle: `Opponent cold: ${awayStats.last5AtsCov}-${awayStats.last5AtsLost} ATS last 5`, weight: 3, strength: "weak" });
    }
  }

  return {
    home: clamp(home, 0, 100),
    away: clamp(away, 0, 100),
    homeReasons: homeReasons.sort((a, b) => b.weight - a.weight),
    awayReasons: awayReasons.sort((a, b) => b.weight - a.weight),
  };
}

// ─── O/U Scoring ─────────────────────────────────────────────────────────────

function scoreOverUnder(
  homeStats: TeamStats,
  awayStats: TeamStats,
  h2h: H2HStats,
  currentOU: number | null,
): OUSideScore {
  let over = 50, under = 50;
  const overReasons: ReasoningEntry[] = [];
  const underReasons: ReasoningEntry[] = [];

  // Source 1: Home team O/U trend
  const homeOUTotal = homeStats.overs + homeStats.unders;
  if (homeOUTotal >= 8) {
    const sig = analyzeTrendSignificance(homeStats.overs, homeOUTotal, 0.5);
    if (sig.strength !== "noise") {
      const w = strengthToWeight(sig.strength);
      if (homeStats.overPct > 50) {
        over += w;
        overReasons.push({
          angle: `Home team O/U: ${homeStats.overs}-${homeStats.unders} (${homeStats.overPct}% over)`,
          weight: w,
          strength: sig.strength as ReasoningEntry["strength"],
        });
      } else {
        under += w;
        underReasons.push({
          angle: `Home team O/U: ${homeStats.unders}-${homeStats.overs} (${(100 - homeStats.overPct).toFixed(1)}% under)`,
          weight: w,
          strength: sig.strength as ReasoningEntry["strength"],
        });
      }
    }
  }

  // Source 2: Away team O/U trend
  const awayOUTotal = awayStats.overs + awayStats.unders;
  if (awayOUTotal >= 8) {
    const sig = analyzeTrendSignificance(awayStats.overs, awayOUTotal, 0.5);
    if (sig.strength !== "noise") {
      const w = strengthToWeight(sig.strength);
      if (awayStats.overPct > 50) {
        over += w;
        overReasons.push({
          angle: `Away team O/U: ${awayStats.overs}-${awayStats.unders} (${awayStats.overPct}% over)`,
          weight: w,
          strength: sig.strength as ReasoningEntry["strength"],
        });
      } else {
        under += w;
        underReasons.push({
          angle: `Away team O/U: ${awayStats.unders}-${awayStats.overs} (${(100 - awayStats.overPct).toFixed(1)}% under)`,
          weight: w,
          strength: sig.strength as ReasoningEntry["strength"],
        });
      }
    }
  }

  // Source 3: H2H average total vs current line
  if (h2h.totalGames >= 5 && currentOU !== null && h2h.avgTotalPoints > 0) {
    const diff = h2h.avgTotalPoints - currentOU;
    if (Math.abs(diff) >= 3) {
      const w = Math.abs(diff) >= 7 ? 5 : 3;
      if (diff > 0) {
        over += w;
        overReasons.push({
          angle: `H2H avg total ${h2h.avgTotalPoints} vs line ${currentOU} (+${diff.toFixed(1)})`,
          weight: w,
          strength: Math.abs(diff) >= 7 ? "moderate" : "weak",
        });
      } else {
        under += w;
        underReasons.push({
          angle: `H2H avg total ${h2h.avgTotalPoints} vs line ${currentOU} (${diff.toFixed(1)})`,
          weight: w,
          strength: Math.abs(diff) >= 7 ? "moderate" : "weak",
        });
      }
    }

    // H2H O/U trend
    const h2hOUTotal = h2h.overs + h2h.unders;
    if (h2hOUTotal >= 5) {
      const h2hSig = analyzeTrendSignificance(h2h.overs, h2hOUTotal, 0.5);
      if (h2hSig.strength !== "noise") {
        const w2 = strengthToWeight(h2hSig.strength);
        const overPct = Math.round((h2h.overs / h2hOUTotal) * 1000) / 10;
        if (overPct > 50) {
          over += w2;
          overReasons.push({ angle: `H2H O/U: ${h2h.overs}-${h2h.unders} (${overPct}% over)`, weight: w2, strength: h2hSig.strength as ReasoningEntry["strength"] });
        } else {
          under += w2;
          underReasons.push({ angle: `H2H O/U: ${h2h.unders}-${h2h.overs} (${(100 - overPct).toFixed(1)}% under)`, weight: w2, strength: h2hSig.strength as ReasoningEntry["strength"] });
        }
      }
    }
  }

  // Source 4: Recent form (last 5 O/U)
  if (homeStats.last5OUOvers + homeStats.last5OUUnders >= 4) {
    if (homeStats.last5OUOvers >= 4) {
      over += 3;
      overReasons.push({ angle: `Home team: ${homeStats.last5OUOvers} overs in last 5`, weight: 3, strength: "weak" });
    } else if (homeStats.last5OUUnders >= 4) {
      under += 3;
      underReasons.push({ angle: `Home team: ${homeStats.last5OUUnders} unders in last 5`, weight: 3, strength: "weak" });
    }
  }
  if (awayStats.last5OUOvers + awayStats.last5OUUnders >= 4) {
    if (awayStats.last5OUOvers >= 4) {
      over += 3;
      overReasons.push({ angle: `Away team: ${awayStats.last5OUOvers} overs in last 5`, weight: 3, strength: "weak" });
    } else if (awayStats.last5OUUnders >= 4) {
      under += 3;
      underReasons.push({ angle: `Away team: ${awayStats.last5OUUnders} unders in last 5`, weight: 3, strength: "weak" });
    }
  }

  return {
    over: clamp(over, 0, 100),
    under: clamp(under, 0, 100),
    overReasons: overReasons.sort((a, b) => b.weight - a.weight),
    underReasons: underReasons.sort((a, b) => b.weight - a.weight),
  };
}

// ─── Prop Auto-Discovery ─────────────────────────────────────────────────────

const POSITION_PROPS: Record<string, string[]> = {
  QB: ["passing_yards", "passing_tds"],
  RB: ["rushing_yards"],
  WR: ["receiving_yards", "receptions"],
  TE: ["receiving_yards", "receptions"],
};

const PROP_LABELS: Record<string, string> = {
  passing_yards: "Pass Yds",
  passing_tds: "Pass TDs",
  rushing_yards: "Rush Yds",
  receiving_yards: "Rec Yds",
  receptions: "Receptions",
};

async function discoverProps(
  sport: Sport,
  homeTeam: string,
  awayTeam: string,
  gameDate: Date,
  currentSeason: number,
): Promise<GeneratedPick[]> {
  if (sport !== "NFL") return [];

  const picks: GeneratedPick[] = [];

  for (const [team, isHome] of [[homeTeam, true], [awayTeam, false]] as [string, boolean][]) {
    // Resolve canonical name to abbreviation
    const teamRecord = await prisma.team.findFirst({
      where: { sport: "NFL", name: team },
      select: { abbreviation: true },
    });
    if (!teamRecord) continue;

    const abbrev = teamRecord.abbreviation;

    // Find key players on this team this season
    const playerGroups = await prisma.playerGameLog.groupBy({
      by: ["playerId", "playerName", "position", "positionGroup"],
      where: {
        team: abbrev,
        season: currentSeason,
        positionGroup: { in: ["QB", "RB", "WR", "TE"] },
      },
      _count: { id: true },
      having: { id: { _count: { gte: 8 } } },
      orderBy: { _count: { id: "desc" } },
      take: 6,
    });

    for (const player of playerGroups) {
      const statKeys = POSITION_PROPS[player.positionGroup] || [];

      for (const stat of statKeys) {
        try {
          // Get season average to use as the prop line
          const playerGames = await prisma.playerGameLog.findMany({
            where: { playerId: player.playerId, season: currentSeason },
            select: { stats: true },
          });

          let sum = 0, count = 0;
          for (const g of playerGames) {
            const stats = g.stats as Record<string, unknown>;
            const val = stats[stat];
            if (typeof val === "number" && val > 0) {
              sum += val;
              count++;
            }
          }

          if (count < 8) continue;
          const avg = sum / count;
          // Round to nearest 0.5
          const propLine = Math.round(avg * 2) / 2;
          if (propLine <= 0) continue;

          // Run prop analysis
          const result = await executePlayerPropQueryFromDB({
            player: player.playerName,
            stat,
            line: propLine,
            direction: "over",
            homeAway: isHome ? "home" : "away",
            filters: [],
          });

          if (
            result.overall.total < 8 ||
            result.overall.hitRate < 60 ||
            result.overall.significance.strength === "noise"
          ) {
            continue;
          }

          // Score the prop
          let score = 50;
          score += (result.overall.hitRate - 50) * 1.5;
          score += result.overall.significance.strength === "strong" ? 15
            : result.overall.significance.strength === "moderate" ? 10 : 5;

          // Recent bonus
          if (result.recentTrend.last5.total >= 4 && result.recentTrend.last5.hitRate >= 80) score += 8;
          else if (result.recentTrend.last5.total >= 4 && result.recentTrend.last5.hitRate >= 60) score += 4;

          // Streak bonus
          if (result.currentStreak >= 4) score += 5;
          else if (result.currentStreak >= 2) score += 2;

          score = clamp(Math.round(score), 0, 100);
          const confidence = score >= 85 ? 5 : score >= 70 ? 4 : score >= 55 ? 3 : 0;
          if (confidence === 0) continue;

          const label = PROP_LABELS[stat] || stat.replace(/_/g, " ");
          const opponent = isHome ? awayTeam : homeTeam;

          picks.push({
            sport,
            pickType: "PLAYER_PROP",
            homeTeam,
            awayTeam,
            gameDate,
            pickSide: "over",
            line: null,
            pickLabel: `${player.playerName} Over ${propLine} ${label}`,
            playerName: player.playerName,
            propStat: stat,
            propLine,
            trendScore: score,
            confidence,
            headline: `${result.overall.hitRate}% hit rate (${result.overall.hits}/${result.overall.total}) vs ${opponent}`,
            reasoning: [
              {
                angle: `Overall: ${result.overall.hits}/${result.overall.total} (${result.overall.hitRate}%)`,
                weight: 10,
                strength: result.overall.significance.strength as ReasoningEntry["strength"],
                record: `${result.overall.hits}-${result.overall.total - result.overall.hits}`,
              },
              {
                angle: `Last 5: ${result.recentTrend.last5.hits}/${result.recentTrend.last5.total} (${result.recentTrend.last5.hitRate}%)`,
                weight: 5,
                strength: result.recentTrend.last5.hitRate >= 80 ? "strong" : result.recentTrend.last5.hitRate >= 60 ? "moderate" : "weak",
              },
              {
                angle: `Avg: ${result.avgValue} | Median: ${result.medianValue} | Line: ${propLine}`,
                weight: 3,
                strength: result.avgValue > propLine * 1.05 ? "moderate" : "weak",
              },
            ],
          });
        } catch {
          // skip individual prop failures
        }
      }
    }
  }

  // Sort by score, cap at 5 per game
  return picks.sort((a, b) => b.trendScore - a.trendScore).slice(0, 5);
}

// ─── Main: Generate Daily Picks ──────────────────────────────────────────────

export async function generateDailyPicks(
  dateStr: string,
  sport: Sport,
): Promise<GeneratedPick[]> {
  // 1. Get today's upcoming games
  const dateStart = new Date(dateStr + "T00:00:00Z");
  const dateEnd = new Date(dateStr + "T23:59:59Z");

  const upcomingGames = await prisma.upcomingGame.findMany({
    where: {
      sport,
      gameDate: { gte: dateStart, lte: dateEnd },
    },
    orderBy: { gameDate: "asc" },
  });

  if (upcomingGames.length === 0) return [];

  // 2. Load historical games for this sport
  const allGames = await loadGamesBySportCached(sport);
  const currentSeason = getCurrentSeason(sport, dateStart);

  // 3. Process games in batches of 4 for performance
  const allPicks: GeneratedPick[] = [];
  const batchSize = 4;

  for (let i = 0; i < upcomingGames.length; i += batchSize) {
    const batch = upcomingGames.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (game) => {
        const picks: GeneratedPick[] = [];

        try {
          // Resolve team names
          const [canonHome, canonAway] = await Promise.all([
            resolveCanonicalName(game.homeTeam, sport),
            resolveCanonicalName(game.awayTeam, sport),
          ]);

          // Build stats
          const homeStats = buildTeamStats(allGames, canonHome, sport, currentSeason);
          const awayStats = buildTeamStats(allGames, canonAway, sport, currentSeason);
          const h2h = buildH2H(allGames, canonHome, canonAway, sport);
          const trendSignals = runAdditionalTrends(sport, canonHome, canonAway, currentSeason, allGames);

          // Score spread
          if (game.spread !== null) {
            const spreadScore = scoreSpread(homeStats, awayStats, h2h, trendSignals);
            const bestSide = spreadScore.home >= spreadScore.away ? "home" : "away";
            const bestScore = Math.max(spreadScore.home, spreadScore.away);
            const confidence = bestScore >= 85 ? 5 : bestScore >= 70 ? 4 : bestScore >= 55 ? 3 : 0;

            if (confidence > 0) {
              const reasons = bestSide === "home" ? spreadScore.homeReasons : spreadScore.awayReasons;
              const teamName = bestSide === "home" ? canonHome : canonAway;
              const spreadVal = bestSide === "home" ? game.spread : -(game.spread);

              picks.push({
                sport,
                pickType: "SPREAD",
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                gameDate: game.gameDate,
                pickSide: bestSide,
                line: game.spread,
                pickLabel: `${teamName} ${spreadVal > 0 ? "+" : ""}${spreadVal}`,
                playerName: null,
                propStat: null,
                propLine: null,
                trendScore: bestScore,
                confidence,
                headline: `${reasons.length} trend${reasons.length !== 1 ? "s" : ""} favor ${teamName} ${spreadVal > 0 ? "+" : ""}${spreadVal}`,
                reasoning: reasons,
              });
            }
          }

          // Score O/U
          if (game.overUnder !== null) {
            const ouScore = scoreOverUnder(homeStats, awayStats, h2h, game.overUnder);
            const bestSide = ouScore.over >= ouScore.under ? "over" : "under";
            const bestScore = Math.max(ouScore.over, ouScore.under);
            const confidence = bestScore >= 85 ? 5 : bestScore >= 70 ? 4 : bestScore >= 55 ? 3 : 0;

            if (confidence > 0) {
              const reasons = bestSide === "over" ? ouScore.overReasons : ouScore.underReasons;
              const label = bestSide === "over" ? "Over" : "Under";

              picks.push({
                sport,
                pickType: "OVER_UNDER",
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
                gameDate: game.gameDate,
                pickSide: bestSide,
                line: game.overUnder,
                pickLabel: `${label} ${game.overUnder}`,
                playerName: null,
                propStat: null,
                propLine: null,
                trendScore: bestScore,
                confidence,
                headline: `${reasons.length} trend${reasons.length !== 1 ? "s" : ""} favor the ${label.toLowerCase()}`,
                reasoning: reasons,
              });
            }
          }

          // Discover props (NFL only)
          const propPicks = await discoverProps(
            sport,
            canonHome,
            canonAway,
            game.gameDate,
            currentSeason,
          );
          picks.push(...propPicks);
        } catch (err) {
          console.error(`[pick-engine] Error processing ${game.homeTeam} vs ${game.awayTeam}:`, err);
        }

        return picks;
      }),
    );

    allPicks.push(...batchResults.flat());
  }

  return allPicks.sort((a, b) => b.trendScore - a.trendScore);
}

// ─── Grade Yesterday's Picks ─────────────────────────────────────────────────

export async function gradeYesterdaysPicks(): Promise<{
  graded: number;
  errors: number;
}> {
  const pendingPicks = await prisma.dailyPick.findMany({
    where: {
      result: "PENDING",
      gameDate: { lt: new Date() },
    },
  });

  let graded = 0, errors = 0;

  for (const pick of pendingPicks) {
    try {
      if (pick.pickType === "SPREAD" || pick.pickType === "OVER_UNDER") {
        const result = await gradeGamePick(pick);
        if (result) {
          await prisma.dailyPick.update({
            where: { id: pick.id },
            data: { result: result.result, actualValue: result.actualValue, gradedAt: new Date() },
          });
          graded++;
        }
      } else if (pick.pickType === "PLAYER_PROP") {
        const result = await gradePropPick(pick);
        if (result) {
          await prisma.dailyPick.update({
            where: { id: pick.id },
            data: { result: result.result, actualValue: result.actualValue, gradedAt: new Date() },
          });
          graded++;
        }
      }
    } catch (err) {
      console.error(`[grade] Failed to grade pick ${pick.id}:`, err);
      errors++;
    }
  }

  return { graded, errors };
}

async function gradeGamePick(
  pick: { sport: Sport; homeTeam: string; awayTeam: string; gameDate: Date; pickType: string; pickSide: string; line: number | null },
): Promise<{ result: string; actualValue: number | null } | null> {
  // Resolve team names to find the game
  const [canonHome, canonAway] = await Promise.all([
    resolveCanonicalName(pick.homeTeam, pick.sport),
    resolveCanonicalName(pick.awayTeam, pick.sport),
  ]);

  const homeTeamRecord = await prisma.team.findFirst({
    where: { sport: pick.sport, name: canonHome },
    select: { id: true },
  });
  const awayTeamRecord = await prisma.team.findFirst({
    where: { sport: pick.sport, name: canonAway },
    select: { id: true },
  });

  if (!homeTeamRecord || !awayTeamRecord) return null;

  // Find the completed game (±1 day window)
  const dayBefore = new Date(pick.gameDate.getTime() - 86400000);
  const dayAfter = new Date(pick.gameDate.getTime() + 86400000);

  const table = pick.sport === "NFL" ? "NFLGame" : pick.sport === "NCAAF" ? "NCAAFGame" : "NCAAMBGame";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const games = await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].findMany({
    where: {
      homeTeamId: homeTeamRecord.id,
      awayTeamId: awayTeamRecord.id,
      gameDate: { gte: dayBefore, lte: dayAfter },
    },
    take: 1,
  });

  if (games.length === 0) return null;

  const game = games[0];

  if (pick.pickType === "SPREAD") {
    // spreadResult is from home perspective
    const homeResult = game.spreadResult; // COVERED, LOST, PUSH
    if (!homeResult) return null;

    if (pick.pickSide === "home") {
      return {
        result: homeResult === "COVERED" ? "WIN" : homeResult === "LOST" ? "LOSS" : "PUSH",
        actualValue: game.scoreDifference != null ? game.scoreDifference : null,
      };
    } else {
      return {
        result: homeResult === "COVERED" ? "LOSS" : homeResult === "LOST" ? "WIN" : "PUSH",
        actualValue: game.scoreDifference != null ? -game.scoreDifference : null,
      };
    }
  }

  if (pick.pickType === "OVER_UNDER") {
    const ouResult = game.ouResult; // OVER, UNDER, PUSH
    if (!ouResult) return null;

    const totalPts = (game.homeScore || 0) + (game.awayScore || 0);

    if (pick.pickSide === "over") {
      return {
        result: ouResult === "OVER" ? "WIN" : ouResult === "UNDER" ? "LOSS" : "PUSH",
        actualValue: totalPts,
      };
    } else {
      return {
        result: ouResult === "UNDER" ? "WIN" : ouResult === "OVER" ? "LOSS" : "PUSH",
        actualValue: totalPts,
      };
    }
  }

  return null;
}

async function gradePropPick(
  pick: { playerName: string | null; propStat: string | null; propLine: number | null; gameDate: Date },
): Promise<{ result: string; actualValue: number | null } | null> {
  if (!pick.playerName || !pick.propStat || pick.propLine == null) return null;

  // Find player game log for this date
  const dayBefore = new Date(pick.gameDate.getTime() - 86400000);
  const dayAfter = new Date(pick.gameDate.getTime() + 86400000);

  const logs = await prisma.playerGameLog.findMany({
    where: {
      playerName: { contains: pick.playerName, mode: "insensitive" },
      gameDate: { gte: dayBefore, lte: dayAfter },
    },
    take: 1,
  });

  if (logs.length === 0) return null;

  const stats = logs[0].stats as Record<string, unknown>;
  const actual = stats[pick.propStat];

  if (typeof actual !== "number") return null;

  // Over is always the direction for our prop picks
  const hit = actual > pick.propLine;

  return {
    result: hit ? "WIN" : "LOSS",
    actualValue: actual,
  };
}
