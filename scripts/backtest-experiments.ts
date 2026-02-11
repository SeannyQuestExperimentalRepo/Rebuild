/**
 * NCAAMB Pick Engine — Multi-Experiment Backtest
 *
 * Systematically tests different analysis angles and configurations
 * to find improvements over v4. Each experiment modifies one aspect
 * of the scoring engine and measures the impact.
 *
 * Experiments:
 *  1. ATS Fade (mean-reversion) — follow vs fade strong ATS records
 *  2. KenPom edge magnitude curves — different scaling for edge size
 *  3. Spread line ranges — fade big favorites, target mid-range lines
 *  4. Conference matchup effects — power-vs-power, cross-conference
 *  5. KenPom AdjO vs AdjD splits — offensive vs defensive mismatch
 *  6. Tempo differential as O/U signal
 *  7. Monthly weight shifts — different model weights by time of year
 *  8. ATS contrarian — explicitly fade teams with strong ATS records
 *  9. KenPom rank differential — gap between rankings as edge quality
 * 10. Market efficiency — which spread ranges have the most edge?
 * 11. O/U-only strategy — what if we never bet spreads?
 * 12. Signal count threshold — minimum active signals required
 * 13. Home court advantage by KenPom rank — does HCA matter more for bad teams?
 * 14. Pace-adjusted O/U — use tempo differential instead of raw tempo
 * 15. Recent form window — last 3, 5, 7, 10 games
 *
 * Usage: npx tsx scripts/backtest-experiments.ts
 */

import { prisma } from "../src/lib/db";
import { getKenpomRatings, lookupRating, type KenpomRating } from "../src/lib/kenpom";
import { wilsonInterval } from "../src/lib/trend-stats";

// ─── Types ──────────────────────────────────────────────────────────────────

interface GameRecord {
  id: number;
  gameDate: Date;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number;
  awayScore: number;
  scoreDifference: number;
  spread: number | null;
  overUnder: number | null;
  spreadResult: string | null;
  ouResult: string | null;
  homeTeam: { name: string; conference: string | null };
  awayTeam: { name: string; conference: string | null };
}

interface TeamStats {
  atsCovered: number;
  atsLost: number;
  atsPct: number;
  overs: number;
  unders: number;
  overPct: number;
  last5ATS: { covered: number; lost: number };
  last5OU: { overs: number; unders: number };
  lastNATS: Map<number, { covered: number; lost: number }>; // key = window size
  gamesPlayed: number;
}

interface SignalResult {
  category: string;
  direction: "home" | "away" | "over" | "under" | "neutral";
  magnitude: number;
  confidence: number;
  strength: "strong" | "moderate" | "weak" | "noise";
  label: string;
}

interface ExperimentResult {
  name: string;
  totalPicks: number;
  spreadPicks: number;
  ouPicks: number;
  spreadRecord: { w: number; l: number; p: number };
  ouRecord: { w: number; l: number; p: number };
  overallRecord: { w: number; l: number; p: number };
  star4: { w: number; l: number; p: number; total: number };
  star5: { w: number; l: number; p: number; total: number };
  star5OU: { w: number; l: number; p: number; total: number };
  star5Spread: { w: number; l: number; p: number; total: number };
}

// ─── Utility ────────────────────────────────────────────────────────────────

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}

function winPct(w: number, l: number): string {
  const d = w + l;
  if (d === 0) return "N/A";
  return ((w / d) * 100).toFixed(1) + "%";
}

function roi(w: number, l: number): string {
  const d = w + l;
  if (d === 0) return "N/A";
  return ((((w * 100 / 110) - l) / d) * 100).toFixed(1) + "%";
}

const POWER_CONFS = ["BE", "B12", "B10", "SEC", "ACC", "P12"];

// ─── Signal Factories ───────────────────────────────────────────────────────
// These are parameterized so each experiment can configure them differently.

interface ExperimentConfig {
  name: string;
  // Spread signal config
  spreadWeights: Record<string, number>;
  ouWeights: Record<string, number>;
  // KenPom spread
  homeFadeMultiplier: number;    // v4 default: 0.20
  homeFadeConf: number;          // v4 default: 0.30
  marchTop25Multiplier: number;  // v4 default: 0.25
  marchTop25Conf: number;        // v4 default: 0.35
  flipHomeToAway: boolean;       // flip home-edge direction instead of just dampening
  kenpomEdgeDivisor: number;     // v4 default: 0.7 (lower = more sensitive)
  // O/U config
  ouSumDEThresholds: "v4" | "v3" | "aggressive" | "conservative";
  highLineThreshold: number;     // v4 default: 155
  lowLineThreshold: number;      // v4 default: 135
  // ATS signal
  atsFade: boolean;              // flip ATS direction (contrarian)
  atsMinGames: number;           // min games to consider (default 5)
  // Convergence
  skipSpreadConvergence: boolean; // v4 default: true
  skipOUConvergence: boolean;    // v4 default: false
  // Confidence thresholds
  minConfidence: number;         // v4 default: 4 (skip 3★)
  // Signal count
  minActiveSignals: number;      // minimum non-neutral signals to generate a pick
  // Pick type filter
  spreadEnabled: boolean;
  ouEnabled: boolean;
  // Recent form window
  recentFormWindow: number;      // default 5
  // Spread range filter
  spreadRangeFilter: null | { min: number; max: number }; // only bet on games in this spread range
  // Conference filter
  confMatchupFilter: null | "power-power" | "power-mid" | "mid-mid";
  // KenPom rank filter
  rankDiffMin: null | number;    // minimum rank difference to bet
  // Tempo differential O/U signal
  useTempoSignal: boolean;
  // HCA by rank
  hcaByRank: boolean;
}

const V4_BASELINE: ExperimentConfig = {
  name: "v4-baseline",
  spreadWeights: { modelEdge: 0.30, seasonATS: 0.15, recentForm: 0.15, h2h: 0.10, restDays: 0.05 },
  ouWeights: { modelEdge: 0.40, seasonOU: 0.15, recentForm: 0.10, h2hWeather: 0.15 },
  homeFadeMultiplier: 0.20,
  homeFadeConf: 0.30,
  marchTop25Multiplier: 0.25,
  marchTop25Conf: 0.35,
  flipHomeToAway: false,
  kenpomEdgeDivisor: 0.7,
  ouSumDEThresholds: "v4",
  highLineThreshold: 155,
  lowLineThreshold: 135,
  atsFade: false,
  atsMinGames: 5,
  skipSpreadConvergence: true,
  skipOUConvergence: false,
  minConfidence: 4,
  minActiveSignals: 0,
  spreadEnabled: true,
  ouEnabled: true,
  recentFormWindow: 5,
  spreadRangeFilter: null,
  confMatchupFilter: null,
  rankDiffMin: null,
  useTempoSignal: false,
  hcaByRank: false,
};

function makeConfig(overrides: Partial<ExperimentConfig> & { name: string }): ExperimentConfig {
  return { ...V4_BASELINE, ...overrides };
}

// ─── KenPom Spread Signal (parameterized) ───────────────────────────────────

function computeKenPomSpreadSignal(
  cfg: ExperimentConfig,
  ratings: Map<string, KenpomRating> | null,
  homeTeam: string,
  awayTeam: string,
  spread: number,
  gameDate: Date,
): SignalResult {
  const neutral: SignalResult = {
    category: "modelEdge", direction: "neutral",
    magnitude: 0, confidence: 0, label: "No KenPom", strength: "noise",
  };
  if (!ratings) return neutral;

  const homeR = lookupRating(ratings, homeTeam);
  const awayR = lookupRating(ratings, awayTeam);
  if (!homeR || !awayR) return neutral;

  const hcaAdj = cfg.hcaByRank ? getHCAAdjustment(homeR, awayR) : 2.0;
  const predictedMargin = homeR.AdjEM - awayR.AdjEM + hcaAdj;
  const spreadEdge = predictedMargin + spread;
  let absMag = clamp(Math.abs(spreadEdge) / cfg.kenpomEdgeDivisor, 0, 10);
  let conf = 0.8;

  const gameMonth = gameDate.getMonth() + 1;
  const isEarlySeason = gameMonth >= 11;

  let direction: "home" | "away" | "neutral" = spreadEdge > 0.5 ? "home" : spreadEdge < -0.5 ? "away" : "neutral";

  if (spreadEdge > 0.5 && !isEarlySeason) {
    if (cfg.flipHomeToAway) {
      direction = "away";
      absMag *= cfg.homeFadeMultiplier;
      conf = cfg.homeFadeConf;
    } else {
      absMag *= cfg.homeFadeMultiplier;
      conf = cfg.homeFadeConf;
    }
  }

  if (gameMonth === 3 && spreadEdge > 0.5 && homeR.RankAdjEM <= 25) {
    absMag *= cfg.marchTop25Multiplier;
    conf = cfg.marchTop25Conf;
  }

  return {
    category: "modelEdge",
    direction,
    magnitude: absMag,
    confidence: conf,
    label: `KenPom edge ${spreadEdge.toFixed(1)}`,
    strength: absMag >= 7 ? "strong" : absMag >= 4 ? "moderate" : absMag >= 1.5 ? "weak" : "noise",
  };
}

function getHCAAdjustment(homeR: KenpomRating, awayR: KenpomRating): number {
  // Scale HCA by team quality — elite teams get less HCA boost
  // Data suggests HCA is more impactful for mid-tier teams
  const homeRank = homeR.RankAdjEM;
  if (homeRank <= 25) return 1.5;       // elite: lower HCA
  if (homeRank <= 75) return 2.0;       // good: standard
  if (homeRank <= 150) return 2.5;      // mid: slightly higher
  return 3.0;                           // bad: bigger HCA
}

// ─── KenPom O/U Signal (parameterized) ──────────────────────────────────────

function computeKenPomOUSignal(
  cfg: ExperimentConfig,
  ratings: Map<string, KenpomRating> | null,
  homeTeam: string,
  awayTeam: string,
  overUnder: number,
  gameDate: Date,
): SignalResult {
  const neutral: SignalResult = {
    category: "modelEdge", direction: "neutral",
    magnitude: 0, confidence: 0, label: "No KenPom", strength: "noise",
  };
  if (!ratings) return neutral;

  const homeR = lookupRating(ratings, homeTeam);
  const awayR = lookupRating(ratings, awayTeam);
  if (!homeR || !awayR) return neutral;

  const sumAdjDE = homeR.AdjDE + awayR.AdjDE;
  const avgTempo = (homeR.AdjTempo + awayR.AdjTempo) / 2;
  const gameMonth = gameDate.getMonth() + 1;

  let dir: "over" | "under" | "neutral" = "neutral";
  let mag = 0;
  let conf = 0;

  // Apply sumDE thresholds based on config
  if (cfg.ouSumDEThresholds === "v4") {
    if (sumAdjDE > 215) { dir = "over"; mag = 8; conf = 0.85; }
    else if (sumAdjDE > 210) { /* neutral */ }
    else if (sumAdjDE > 205) { dir = "under"; mag = 5; conf = 0.80; }
    else if (sumAdjDE > 200) { dir = "under"; mag = 6; conf = 0.85; }
    else if (sumAdjDE > 195) { dir = "under"; mag = 8; conf = 0.90; }
    else if (sumAdjDE > 190) { dir = "under"; mag = 8; conf = 0.92; }
    else if (sumAdjDE > 185) { dir = "under"; mag = 9; conf = 0.93; }
    else { dir = "under"; mag = 10; conf = 0.95; }
  } else if (cfg.ouSumDEThresholds === "aggressive") {
    // More aggressive UNDER — push thresholds higher
    if (sumAdjDE > 220) { dir = "over"; mag = 8; conf = 0.85; }
    else if (sumAdjDE > 215) { /* neutral */ }
    else if (sumAdjDE > 210) { dir = "under"; mag = 4; conf = 0.75; }
    else if (sumAdjDE > 205) { dir = "under"; mag = 6; conf = 0.82; }
    else if (sumAdjDE > 200) { dir = "under"; mag = 7; conf = 0.87; }
    else if (sumAdjDE > 195) { dir = "under"; mag = 8; conf = 0.90; }
    else if (sumAdjDE > 190) { dir = "under"; mag = 9; conf = 0.93; }
    else { dir = "under"; mag = 10; conf = 0.95; }
  } else if (cfg.ouSumDEThresholds === "conservative") {
    // Only bet UNDER when very confident
    if (sumAdjDE > 215) { dir = "over"; mag = 8; conf = 0.85; }
    else if (sumAdjDE > 195) { /* neutral — wide neutral band */ }
    else if (sumAdjDE > 190) { dir = "under"; mag = 7; conf = 0.88; }
    else if (sumAdjDE > 185) { dir = "under"; mag = 9; conf = 0.92; }
    else { dir = "under"; mag = 10; conf = 0.95; }
  } else {
    // v3 original
    if (sumAdjDE > 210) { dir = "over"; mag = 8; conf = 0.92; }
    else if (sumAdjDE > 205) { dir = "over"; mag = 6; conf = 0.85; }
    else if (sumAdjDE > 200) { dir = "over"; mag = 4; conf = 0.75; }
    else if (sumAdjDE < 185) { dir = "under"; mag = 10; conf = 0.95; }
    else if (sumAdjDE < 190) { dir = "under"; mag = 8; conf = 0.92; }
    else if (sumAdjDE < 195) { dir = "under"; mag = 5; conf = 0.80; }
  }

  // Tempo interaction (v4)
  if (dir === "over" && avgTempo > 70 && sumAdjDE > 215) {
    mag = Math.min(mag + 2, 10); conf = Math.min(conf + 0.05, 1.0);
  } else if (dir === "under" && avgTempo < 64 && sumAdjDE < 195) {
    mag = Math.min(mag + 2, 10); conf = Math.min(conf + 0.05, 1.0);
  }

  // Both top-50
  if (homeR.RankAdjEM <= 50 && awayR.RankAdjEM <= 50) {
    dir = "under"; mag = 10; conf = 0.95;
  }

  // Power conference matchup
  const homeIsPower = POWER_CONFS.includes(homeR.ConfShort ?? "");
  const awayIsPower = POWER_CONFS.includes(awayR.ConfShort ?? "");
  if (homeIsPower && awayIsPower && !(homeR.RankAdjEM <= 50 && awayR.RankAdjEM <= 50)) {
    if (dir === "under") { mag = Math.min(mag + 2, 10); }
    else if (dir === "neutral" || dir === "over") {
      dir = "under"; mag = Math.max(mag, 6); conf = Math.max(conf, 0.82);
    }
  }

  // Both 200+
  if (homeR.RankAdjEM > 200 && awayR.RankAdjEM > 200) {
    if (dir === "over") { mag = Math.min(mag + 1, 10); }
    else if (dir === "neutral") { dir = "over"; mag = Math.max(mag, 5); conf = Math.max(conf, 0.78); }
  }

  // March UNDER
  if (gameMonth === 3) {
    if (dir === "under") { mag = Math.min(mag + 1, 10); }
    else if (dir === "neutral") { dir = "under"; mag = 3; conf = Math.max(conf, 0.60); }
  }

  // High line UNDER
  if (overUnder >= 160) {
    dir = "under"; mag = Math.max(mag, 8); conf = Math.max(conf, 0.88);
  } else if (overUnder >= cfg.highLineThreshold) {
    dir = "under"; mag = Math.max(mag, 6); conf = Math.max(conf, 0.82);
  }

  // Low line OVER
  if (overUnder < cfg.lowLineThreshold) {
    if (dir === "over") { mag = Math.min(mag + 2, 10); conf = Math.min(conf + 0.05, 1.0); }
    else if (dir === "neutral") { dir = "over"; mag = 4; conf = Math.max(conf, 0.70); }
  }

  mag = clamp(mag, 0, 10);

  return {
    category: "modelEdge", direction: dir, magnitude: mag, confidence: conf,
    label: `KenPom O/U sumDE=${sumAdjDE.toFixed(1)}`,
    strength: mag >= 6 ? "strong" : mag >= 3 ? "moderate" : mag >= 1 ? "weak" : "noise",
  };
}

// ─── Tempo Differential Signal ──────────────────────────────────────────────

function signalTempoDiff(
  ratings: Map<string, KenpomRating> | null,
  homeTeam: string,
  awayTeam: string,
): SignalResult {
  const neutral: SignalResult = {
    category: "tempoDiff", direction: "neutral",
    magnitude: 0, confidence: 0, label: "N/A", strength: "noise",
  };
  if (!ratings) return neutral;

  const homeR = lookupRating(ratings, homeTeam);
  const awayR = lookupRating(ratings, awayTeam);
  if (!homeR || !awayR) return neutral;

  const tempoDiff = Math.abs(homeR.AdjTempo - awayR.AdjTempo);
  const avgTempo = (homeR.AdjTempo + awayR.AdjTempo) / 2;

  // Big tempo mismatch: slow team drags game under
  if (tempoDiff >= 8) {
    // When one team plays much slower, the game tends to go under
    const slowerTempo = Math.min(homeR.AdjTempo, awayR.AdjTempo);
    if (slowerTempo < 66) {
      return {
        category: "tempoDiff", direction: "under",
        magnitude: 6, confidence: 0.72,
        label: `Tempo mismatch ${tempoDiff.toFixed(1)}`, strength: "moderate",
      };
    }
    return {
      category: "tempoDiff", direction: "under",
      magnitude: 4, confidence: 0.62,
      label: `Tempo mismatch ${tempoDiff.toFixed(1)}`, strength: "moderate",
    };
  }

  // Both fast teams: over
  if (avgTempo > 70 && tempoDiff < 4) {
    return {
      category: "tempoDiff", direction: "over",
      magnitude: 5, confidence: 0.65,
      label: `Both fast tempo ${avgTempo.toFixed(1)}`, strength: "moderate",
    };
  }

  // Both slow teams: under
  if (avgTempo < 63 && tempoDiff < 4) {
    return {
      category: "tempoDiff", direction: "under",
      magnitude: 5, confidence: 0.68,
      label: `Both slow tempo ${avgTempo.toFixed(1)}`, strength: "moderate",
    };
  }

  return neutral;
}

// ─── ATS Signal (parameterized: follow vs fade) ─────────────────────────────

function signalSeasonATS(
  cfg: ExperimentConfig,
  homeStats: TeamStats,
  awayStats: TeamStats,
): SignalResult {
  const homeTotal = homeStats.atsCovered + homeStats.atsLost;
  const awayTotal = awayStats.atsCovered + awayStats.atsLost;

  const homeEdge = homeTotal >= cfg.atsMinGames ? wilsonInterval(homeStats.atsCovered, homeTotal)[0] - 0.5 : 0;
  const awayEdge = awayTotal >= cfg.atsMinGames ? wilsonInterval(awayStats.atsCovered, awayTotal)[0] - 0.5 : 0;

  let netEdge = homeEdge - awayEdge;

  // Contrarian: fade strong ATS records (mean reversion)
  if (cfg.atsFade) netEdge = -netEdge;

  const absMag = clamp(Math.abs(netEdge) * 50, 0, 10);
  const minGames = Math.min(homeTotal, awayTotal);
  const conf = clamp(0.3 + minGames * 0.02, 0.3, 0.8);

  if (absMag < 0.5) {
    return { category: "seasonATS", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  return {
    category: "seasonATS",
    direction: netEdge > 0 ? "home" : "away",
    magnitude: absMag,
    confidence: conf,
    label: cfg.atsFade ? "ATS Fade" : "Season ATS",
    strength: absMag >= 7 ? "strong" : absMag >= 3.5 ? "moderate" : "weak",
  };
}

// ─── Recent Form Signal (parameterized window) ─────────────────────────────

function signalRecentForm(homeStats: TeamStats, awayStats: TeamStats, window: number = 5): SignalResult {
  const homeData = homeStats.lastNATS.get(window) ?? homeStats.last5ATS;
  const awayData = awayStats.lastNATS.get(window) ?? awayStats.last5ATS;

  const homeL = homeData.covered + homeData.lost;
  const awayL = awayData.covered + awayData.lost;

  if (homeL < 3 && awayL < 3) {
    return { category: "recentForm", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  const homeRate = homeL > 0 ? homeData.covered / homeL : 0.5;
  const awayRate = awayL > 0 ? awayData.covered / awayL : 0.5;
  const netMomentum = homeRate - awayRate;

  let magnitude = clamp(Math.abs(netMomentum) * 10, 0, 10);
  if (homeData.covered >= window) magnitude = Math.min(magnitude + 2, 10);
  else if (homeData.covered >= window - 1) magnitude = Math.min(magnitude + 1, 10);
  if (awayData.covered >= window) magnitude = Math.min(magnitude + 2, 10);
  else if (awayData.covered >= window - 1) magnitude = Math.min(magnitude + 1, 10);

  const conf = clamp(0.4 + Math.min(homeL, awayL) * 0.08, 0.4, 0.7);

  if (magnitude < 1) {
    return { category: "recentForm", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  return {
    category: "recentForm",
    direction: netMomentum > 0 ? "home" : "away",
    magnitude,
    confidence: conf,
    label: `L${window} form`,
    strength: magnitude >= 7 ? "strong" : magnitude >= 4 ? "moderate" : "weak",
  };
}

// ─── H2H Signals (unchanged from v4) ───────────────────────────────────────

function signalH2H(
  pastGames: GameRecord[],
  homeTeamName: string,
  awayTeamName: string,
): SignalResult {
  const matchups = pastGames.filter(
    (g) =>
      (g.homeTeam.name === homeTeamName && g.awayTeam.name === awayTeamName) ||
      (g.homeTeam.name === awayTeamName && g.awayTeam.name === homeTeamName),
  );

  if (matchups.length < 3) {
    return { category: "h2h", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  let homeAtsCov = 0, homeAtsLost = 0;
  for (const g of matchups) {
    if (g.homeTeam.name === homeTeamName) {
      if (g.spreadResult === "COVERED") homeAtsCov++;
      else if (g.spreadResult === "LOST") homeAtsLost++;
    } else {
      if (g.spreadResult === "COVERED") homeAtsLost++;
      else if (g.spreadResult === "LOST") homeAtsCov++;
    }
  }

  const h2hTotal = homeAtsCov + homeAtsLost;
  if (h2hTotal < 3) {
    return { category: "h2h", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  const [lower] = wilsonInterval(homeAtsCov, h2hTotal);
  const edge = lower - 0.5;
  const magnitude = clamp(Math.abs(edge) * 40, 0, 10);
  const conf = clamp(0.3 + h2hTotal * 0.03, 0.3, 0.7);

  if (magnitude < 0.5) {
    return { category: "h2h", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  return {
    category: "h2h",
    direction: edge > 0 ? "home" : "away",
    magnitude,
    confidence: conf,
    label: "H2H",
    strength: magnitude >= 6 ? "strong" : magnitude >= 3 ? "moderate" : "weak",
  };
}

function signalSeasonOU(homeStats: TeamStats, awayStats: TeamStats): SignalResult {
  const homeTotal = homeStats.overs + homeStats.unders;
  const awayTotal = awayStats.overs + awayStats.unders;

  const homeOverEdge = homeTotal >= 8 ? wilsonInterval(homeStats.overs, homeTotal)[0] - 0.5 : 0;
  const awayOverEdge = awayTotal >= 8 ? wilsonInterval(awayStats.overs, awayTotal)[0] - 0.5 : 0;

  const avgOverLean = (homeOverEdge + awayOverEdge) / 2;
  const absMag = clamp(Math.abs(avgOverLean) * 50, 0, 10);
  const conf = clamp(0.3 + Math.min(homeTotal, awayTotal) * 0.015, 0.3, 0.75);

  if (absMag < 0.5) {
    return { category: "seasonOU", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  return {
    category: "seasonOU",
    direction: avgOverLean > 0 ? "over" : "under",
    magnitude: absMag,
    confidence: conf,
    label: "Season O/U",
    strength: absMag >= 6 ? "strong" : absMag >= 3 ? "moderate" : "weak",
  };
}

function signalRecentFormOU(homeStats: TeamStats, awayStats: TeamStats): SignalResult {
  const homeL5 = homeStats.last5OU.overs + homeStats.last5OU.unders;
  const awayL5 = awayStats.last5OU.overs + awayStats.last5OU.unders;

  if (homeL5 < 3 && awayL5 < 3) {
    return { category: "recentForm", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  const homeOverRate = homeL5 > 0 ? homeStats.last5OU.overs / homeL5 : 0.5;
  const awayOverRate = awayL5 > 0 ? awayStats.last5OU.overs / awayL5 : 0.5;
  const avgOverLean = (homeOverRate + awayOverRate) / 2 - 0.5;

  const magnitude = clamp(Math.abs(avgOverLean) * 20, 0, 10);

  if (magnitude < 1) {
    return { category: "recentForm", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  return {
    category: "recentForm",
    direction: avgOverLean > 0 ? "over" : "under",
    magnitude,
    confidence: 0.5,
    label: "Recent O/U",
    strength: magnitude >= 6 ? "strong" : magnitude >= 3 ? "moderate" : "weak",
  };
}

function signalH2HOU(
  pastGames: GameRecord[],
  homeTeamName: string,
  awayTeamName: string,
  overUnder: number,
): SignalResult {
  const matchups = pastGames.filter(
    (g) =>
      (g.homeTeam.name === homeTeamName && g.awayTeam.name === awayTeamName) ||
      (g.homeTeam.name === awayTeamName && g.awayTeam.name === homeTeamName),
  );

  if (matchups.length < 3) {
    return { category: "h2hWeather", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  let totalPts = 0, overs = 0, unders = 0;
  for (const g of matchups) {
    totalPts += g.homeScore + g.awayScore;
    if (g.ouResult === "OVER") overs++;
    else if (g.ouResult === "UNDER") unders++;
  }
  const avgTotal = totalPts / matchups.length;

  let magnitude = 0;
  let direction: "over" | "under" | "neutral" = "neutral";
  let conf = 0.4;

  const diff = avgTotal - overUnder;
  if (Math.abs(diff) >= 3) {
    magnitude += clamp(Math.abs(diff) / 2, 0, 6);
    direction = diff > 0 ? "over" : "under";
    conf = Math.min(conf + 0.1, 0.7);
  }

  const h2hOUTotal = overs + unders;
  if (h2hOUTotal >= 5) {
    const overPct = overs / h2hOUTotal;
    if (Math.abs(overPct - 0.5) > 0.15) {
      magnitude += 2;
      if (direction === "neutral") direction = overPct > 0.5 ? "over" : "under";
    }
  }

  magnitude = clamp(magnitude, 0, 10);

  if (magnitude < 0.5) {
    return { category: "h2hWeather", direction: "neutral", magnitude: 0, confidence: 0, label: "", strength: "noise" };
  }

  return {
    category: "h2hWeather",
    direction,
    magnitude,
    confidence: conf,
    label: "H2H O/U",
    strength: magnitude >= 6 ? "strong" : magnitude >= 3 ? "moderate" : "weak",
  };
}

// ─── Rest/B2B Signal ────────────────────────────────────────────────────────

function signalRestDays(
  tracker: TeamStatsTracker,
  homeTeam: string,
  awayTeam: string,
  gameDate: Date,
): SignalResult {
  const neutral: SignalResult = {
    category: "restDays", direction: "neutral",
    magnitude: 0, confidence: 0, label: "Normal rest", strength: "noise",
  };

  const homeGames = tracker.getRecentGames(homeTeam, 1);
  const awayGames = tracker.getRecentGames(awayTeam, 1);

  if (homeGames.length === 0 && awayGames.length === 0) return neutral;

  const oneDayMs = 36 * 60 * 60 * 1000;
  const gameDateMs = gameDate.getTime();

  const homeOnB2B = homeGames.length > 0 &&
    (gameDateMs - homeGames[0].gameDate.getTime()) <= oneDayMs;
  const awayOnB2B = awayGames.length > 0 &&
    (gameDateMs - awayGames[0].gameDate.getTime()) <= oneDayMs;

  if (homeOnB2B && !awayOnB2B) {
    return {
      category: "restDays", direction: "away",
      magnitude: 5, confidence: 0.65,
      label: `${homeTeam} on B2B`, strength: "moderate",
    };
  } else if (awayOnB2B && !homeOnB2B) {
    return {
      category: "restDays", direction: "home",
      magnitude: 3, confidence: 0.55,
      label: `${awayTeam} on B2B`, strength: "weak",
    };
  }

  return neutral;
}

// ─── Convergence Scoring ────────────────────────────────────────────────────

function computeConvergenceScore(
  signals: SignalResult[],
  weights: Record<string, number>,
  skipConvergenceBonus: boolean,
  minActiveSignals: number,
): { score: number; direction: string } | null {
  const activeSignals = signals.filter((s) => s.direction !== "neutral" && s.magnitude > 0);

  if (activeSignals.length < minActiveSignals) return null;
  if (activeSignals.length === 0) return { score: 50, direction: "home" };

  const directionSums: Record<string, number> = {};
  let totalPossibleWeight = 0;

  for (const signal of signals) {
    const w = weights[signal.category] || 0.1;
    totalPossibleWeight += w * 10;
    if (signal.direction === "neutral" || signal.magnitude <= 0) continue;
    const effectiveWeight = w * signal.magnitude * signal.confidence;
    directionSums[signal.direction] = (directionSums[signal.direction] || 0) + effectiveWeight;
  }

  let bestDir = "home";
  let bestSum = 0;
  let totalWeight = 0;

  for (const [dir, sum] of Object.entries(directionSums)) {
    totalWeight += sum;
    if (sum > bestSum) { bestSum = sum; bestDir = dir; }
  }

  const oppositeSum = totalWeight - bestSum;
  const rawStrength = totalPossibleWeight > 0 ? (bestSum - oppositeSum) / totalPossibleWeight : 0;
  let score = 50 + rawStrength * 80;

  const nonNeutralCount = activeSignals.length;
  const agreeingCount = activeSignals.filter((s) => s.direction === bestDir).length;
  const agreeRatio = nonNeutralCount > 0 ? agreeingCount / nonNeutralCount : 0;

  if (!skipConvergenceBonus) {
    if (agreeRatio >= 0.8 && nonNeutralCount >= 3) score += 8;
    else if (agreeRatio >= 0.6 && nonNeutralCount >= 3) score += 4;
  }

  const strongDisagreeing = activeSignals.filter(
    (s) => s.direction !== bestDir && (s.strength === "strong" || s.strength === "moderate"),
  ).length;
  if (strongDisagreeing >= 2) score -= 10;
  else if (strongDisagreeing === 1) score -= 5;

  if (!skipConvergenceBonus) {
    const strongModerateAgreeing = activeSignals.filter(
      (s) => s.direction === bestDir && (s.strength === "strong" || s.strength === "moderate"),
    ).length;
    if (strongModerateAgreeing >= 3) score += 6;
    else if (strongModerateAgreeing >= 2) score += 3;
  }

  score = clamp(Math.round(score), 0, 100);

  return { score, direction: bestDir };
}

// ─── Team Stats Tracker ─────────────────────────────────────────────────────

class TeamStatsTracker {
  private teamGames: Map<string, GameRecord[]> = new Map();

  addGame(game: GameRecord): void {
    const home = game.homeTeam.name;
    const away = game.awayTeam.name;

    if (!this.teamGames.has(home)) this.teamGames.set(home, []);
    if (!this.teamGames.has(away)) this.teamGames.set(away, []);

    this.teamGames.get(home)!.push(game);
    this.teamGames.get(away)!.push(game);
  }

  getStats(team: string): TeamStats {
    const games = this.teamGames.get(team) || [];
    let atsCov = 0, atsLost = 0, overs = 0, unders = 0;

    for (const g of games) {
      const isHome = g.homeTeam.name === team;
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

    const last5 = games.slice(-5);
    let l5AtsCov = 0, l5AtsLost = 0, l5OUOver = 0, l5OUUnder = 0;
    for (const g of last5) {
      const isHome = g.homeTeam.name === team;
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

    // Compute lastN for different windows
    const lastNATS = new Map<number, { covered: number; lost: number }>();
    for (const windowSize of [3, 5, 7, 10]) {
      const lastN = games.slice(-windowSize);
      let cov = 0, lost = 0;
      for (const g of lastN) {
        const isHome = g.homeTeam.name === team;
        if (isHome) {
          if (g.spreadResult === "COVERED") cov++;
          else if (g.spreadResult === "LOST") lost++;
        } else {
          if (g.spreadResult === "COVERED") lost++;
          else if (g.spreadResult === "LOST") cov++;
        }
      }
      lastNATS.set(windowSize, { covered: cov, lost });
    }

    const atsTotal = atsCov + atsLost;
    const ouTotal = overs + unders;

    return {
      atsCovered: atsCov,
      atsLost,
      atsPct: atsTotal > 0 ? Math.round((atsCov / atsTotal) * 1000) / 10 : 50,
      overs,
      unders,
      overPct: ouTotal > 0 ? Math.round((overs / ouTotal) * 1000) / 10 : 50,
      last5ATS: { covered: l5AtsCov, lost: l5AtsLost },
      last5OU: { overs: l5OUOver, unders: l5OUUnder },
      lastNATS,
      gamesPlayed: games.length,
    };
  }

  getRecentGames(team: string, count: number): GameRecord[] {
    const games = this.teamGames.get(team) || [];
    return games.slice(-count);
  }
}

// ─── Run Single Experiment ──────────────────────────────────────────────────

function runExperiment(
  cfg: ExperimentConfig,
  allGames: GameRecord[],
  priorGames: GameRecord[],
  kenpomRatings: Map<string, KenpomRating>,
  gamesByDate: Map<string, GameRecord[]>,
  dates: string[],
  minDateStr: string,
): ExperimentResult {
  const tracker = new TeamStatsTracker();
  const allHistoricalGames: GameRecord[] = [...priorGames];

  const result: ExperimentResult = {
    name: cfg.name,
    totalPicks: 0,
    spreadPicks: 0,
    ouPicks: 0,
    spreadRecord: { w: 0, l: 0, p: 0 },
    ouRecord: { w: 0, l: 0, p: 0 },
    overallRecord: { w: 0, l: 0, p: 0 },
    star4: { w: 0, l: 0, p: 0, total: 0 },
    star5: { w: 0, l: 0, p: 0, total: 0 },
    star5OU: { w: 0, l: 0, p: 0, total: 0 },
    star5Spread: { w: 0, l: 0, p: 0, total: 0 },
  };

  for (const dateStr of dates) {
    const dayGames = gamesByDate.get(dateStr)!;

    if (dateStr >= minDateStr) {
      for (const game of dayGames) {
        if (game.spread === null) continue;

        const homeTeamName = game.homeTeam.name;
        const awayTeamName = game.awayTeam.name;
        const homeStats = tracker.getStats(homeTeamName);
        const awayStats = tracker.getStats(awayTeamName);

        // Conference filter
        if (cfg.confMatchupFilter) {
          const homeConf = game.homeTeam.conference;
          const awayConf = game.awayTeam.conference;
          const homeIsPower = homeConf ? POWER_CONFS.includes(homeConf) : false;
          const awayIsPower = awayConf ? POWER_CONFS.includes(awayConf) : false;

          if (cfg.confMatchupFilter === "power-power" && !(homeIsPower && awayIsPower)) continue;
          if (cfg.confMatchupFilter === "power-mid" && !((homeIsPower && !awayIsPower) || (!homeIsPower && awayIsPower))) continue;
          if (cfg.confMatchupFilter === "mid-mid" && (homeIsPower || awayIsPower)) continue;
        }

        // Spread range filter
        if (cfg.spreadRangeFilter && game.spread !== null) {
          const absSpread = Math.abs(game.spread);
          if (absSpread < cfg.spreadRangeFilter.min || absSpread > cfg.spreadRangeFilter.max) {
            // Still need to do O/U check below
            if (!cfg.ouEnabled) continue;
          }
        }

        // KenPom rank diff filter
        const homeR = lookupRating(kenpomRatings, homeTeamName);
        const awayR = lookupRating(kenpomRatings, awayTeamName);
        if (cfg.rankDiffMin !== null && homeR && awayR) {
          const rankDiff = Math.abs(homeR.RankAdjEM - awayR.RankAdjEM);
          if (rankDiff < cfg.rankDiffMin) {
            // Skip this game entirely for spreads
          }
        }

        // ── Spread Pick ──
        const spreadRangeOk = !cfg.spreadRangeFilter || (game.spread !== null &&
          Math.abs(game.spread) >= cfg.spreadRangeFilter.min &&
          Math.abs(game.spread) <= cfg.spreadRangeFilter.max);
        const rankDiffOk = cfg.rankDiffMin === null || !homeR || !awayR ||
          Math.abs(homeR.RankAdjEM - awayR.RankAdjEM) >= cfg.rankDiffMin;

        if (cfg.spreadEnabled && spreadRangeOk && rankDiffOk) {
          const spreadSignals: SignalResult[] = [
            computeKenPomSpreadSignal(cfg, kenpomRatings, homeTeamName, awayTeamName, game.spread, game.gameDate),
            signalSeasonATS(cfg, homeStats, awayStats),
            signalRecentForm(homeStats, awayStats, cfg.recentFormWindow),
            signalH2H(allHistoricalGames, homeTeamName, awayTeamName),
            signalRestDays(tracker, homeTeamName, awayTeamName, game.gameDate),
          ];

          const spreadResult = computeConvergenceScore(
            spreadSignals, cfg.spreadWeights, cfg.skipSpreadConvergence, cfg.minActiveSignals,
          );

          if (spreadResult) {
            const spreadConf = spreadResult.score >= 85 ? 5 : spreadResult.score >= 70 ? 4 : 0;

            if (spreadConf >= cfg.minConfidence && game.spreadResult) {
              let actualResult: "WIN" | "LOSS" | "PUSH";
              if (spreadResult.direction === "home") {
                actualResult = game.spreadResult === "COVERED" ? "WIN" : game.spreadResult === "LOST" ? "LOSS" : "PUSH";
              } else {
                actualResult = game.spreadResult === "COVERED" ? "LOSS" : game.spreadResult === "LOST" ? "WIN" : "PUSH";
              }

              result.totalPicks++;
              result.spreadPicks++;

              if (actualResult === "WIN") { result.spreadRecord.w++; result.overallRecord.w++; }
              else if (actualResult === "LOSS") { result.spreadRecord.l++; result.overallRecord.l++; }
              else { result.spreadRecord.p++; result.overallRecord.p++; }

              if (spreadConf === 4) {
                result.star4.total++;
                if (actualResult === "WIN") result.star4.w++;
                else if (actualResult === "LOSS") result.star4.l++;
                else result.star4.p++;
              } else if (spreadConf === 5) {
                result.star5.total++;
                result.star5Spread.total++;
                if (actualResult === "WIN") { result.star5.w++; result.star5Spread.w++; }
                else if (actualResult === "LOSS") { result.star5.l++; result.star5Spread.l++; }
                else { result.star5.p++; result.star5Spread.p++; }
              }
            }
          }
        }

        // ── O/U Pick ──
        if (cfg.ouEnabled && game.overUnder !== null && game.ouResult) {
          const ouSignals: SignalResult[] = [
            computeKenPomOUSignal(cfg, kenpomRatings, homeTeamName, awayTeamName, game.overUnder, game.gameDate),
            signalSeasonOU(homeStats, awayStats),
            signalRecentFormOU(homeStats, awayStats),
            signalH2HOU(allHistoricalGames, homeTeamName, awayTeamName, game.overUnder),
          ];

          // Add tempo signal if configured
          if (cfg.useTempoSignal) {
            ouSignals.push(signalTempoDiff(kenpomRatings, homeTeamName, awayTeamName));
          }

          const ouResult = computeConvergenceScore(
            ouSignals, cfg.ouWeights, cfg.skipOUConvergence, cfg.minActiveSignals,
          );

          if (ouResult) {
            const ouConf = ouResult.score >= 85 ? 5 : ouResult.score >= 70 ? 4 : 0;

            if (ouConf >= cfg.minConfidence) {
              let actualOUResult: "WIN" | "LOSS" | "PUSH";
              if (ouResult.direction === "over") {
                actualOUResult = game.ouResult === "OVER" ? "WIN" : game.ouResult === "UNDER" ? "LOSS" : "PUSH";
              } else {
                actualOUResult = game.ouResult === "UNDER" ? "WIN" : game.ouResult === "OVER" ? "LOSS" : "PUSH";
              }

              result.totalPicks++;
              result.ouPicks++;

              if (actualOUResult === "WIN") { result.ouRecord.w++; result.overallRecord.w++; }
              else if (actualOUResult === "LOSS") { result.ouRecord.l++; result.overallRecord.l++; }
              else { result.ouRecord.p++; result.overallRecord.p++; }

              if (ouConf === 4) {
                result.star4.total++;
                if (actualOUResult === "WIN") result.star4.w++;
                else if (actualOUResult === "LOSS") result.star4.l++;
                else result.star4.p++;
              } else if (ouConf === 5) {
                result.star5.total++;
                result.star5OU.total++;
                if (actualOUResult === "WIN") { result.star5.w++; result.star5OU.w++; }
                else if (actualOUResult === "LOSS") { result.star5.l++; result.star5OU.l++; }
                else { result.star5.p++; result.star5OU.p++; }
              }
            }
          }
        }
      }
    }

    // Walk-forward: add today's games after processing
    for (const game of dayGames) {
      tracker.addGame(game);
      allHistoricalGames.push(game);
    }
  }

  return result;
}

// ─── Define All Experiments ─────────────────────────────────────────────────

function defineExperiments(): ExperimentConfig[] {
  return [
    // Baseline
    V4_BASELINE,

    // ═══ SPREAD EXPERIMENTS ═══

    // 1. ATS Fade (contrarian)
    makeConfig({ name: "ats-fade", atsFade: true }),

    // 2. Flip home edge to away (actual contrarian bet)
    makeConfig({ name: "flip-home-to-away", flipHomeToAway: true }),

    // 3. Stronger home fade
    makeConfig({ name: "home-fade-extreme", homeFadeMultiplier: 0.10, homeFadeConf: 0.20 }),

    // 4. Kill home edge entirely (zero it out)
    makeConfig({ name: "zero-home-edge", homeFadeMultiplier: 0.0, homeFadeConf: 0.0 }),

    // 5. Larger KenPom edge divisor (less sensitive to small edges)
    makeConfig({ name: "kenpom-less-sensitive", kenpomEdgeDivisor: 1.2 }),

    // 6. Smaller KenPom edge divisor (more sensitive)
    makeConfig({ name: "kenpom-more-sensitive", kenpomEdgeDivisor: 0.5 }),

    // 7. ATS Fade + Flip home edge
    makeConfig({ name: "ats-fade+flip-home", atsFade: true, flipHomeToAway: true }),

    // 8. Only bet mid-range spreads (3-10 points)
    makeConfig({ name: "spread-range-3to10", spreadRangeFilter: { min: 3, max: 10 } }),

    // 9. Only bet small spreads (0-5 points)
    makeConfig({ name: "spread-range-0to5", spreadRangeFilter: { min: 0, max: 5 } }),

    // 10. Only bet large spreads (10+ points)
    makeConfig({ name: "spread-range-10plus", spreadRangeFilter: { min: 10, max: 50 } }),

    // 11. Recent form window = 3
    makeConfig({ name: "recent-form-L3", recentFormWindow: 3 }),

    // 12. Recent form window = 7
    makeConfig({ name: "recent-form-L7", recentFormWindow: 7 }),

    // 13. Recent form window = 10
    makeConfig({ name: "recent-form-L10", recentFormWindow: 10 }),

    // 14. Power conference only
    makeConfig({ name: "power-conf-only", confMatchupFilter: "power-power" }),

    // 15. Cross-conference only
    makeConfig({ name: "cross-conf-only", confMatchupFilter: "power-mid" }),

    // 16. Min 2 active spread signals
    makeConfig({ name: "min-2-signals", minActiveSignals: 2 }),

    // 17. Min 3 active spread signals
    makeConfig({ name: "min-3-signals", minActiveSignals: 3 }),

    // 18. Higher spread ATS weight
    makeConfig({
      name: "higher-ats-weight",
      spreadWeights: { modelEdge: 0.25, seasonATS: 0.25, recentForm: 0.15, h2h: 0.10, restDays: 0.05 },
    }),

    // 19. Kill ATS signal entirely
    makeConfig({
      name: "no-ats-signal",
      spreadWeights: { modelEdge: 0.40, seasonATS: 0.00, recentForm: 0.15, h2h: 0.10, restDays: 0.05 },
    }),

    // 20. Rank diff >= 50
    makeConfig({ name: "rank-diff-50plus", rankDiffMin: 50 }),

    // 21. Rank diff >= 100
    makeConfig({ name: "rank-diff-100plus", rankDiffMin: 100 }),

    // 22. HCA by KenPom rank
    makeConfig({ name: "hca-by-rank", hcaByRank: true }),

    // ═══ O/U EXPERIMENTS ═══

    // 23. O/U only (no spreads)
    makeConfig({ name: "ou-only", spreadEnabled: false }),

    // 24. Aggressive UNDER thresholds
    makeConfig({ name: "ou-aggressive-under", ouSumDEThresholds: "aggressive" }),

    // 25. Conservative (wider neutral band)
    makeConfig({ name: "ou-conservative", ouSumDEThresholds: "conservative" }),

    // 26. Lower high-line threshold (150)
    makeConfig({ name: "ou-highline-150", highLineThreshold: 150 }),

    // 27. Higher high-line threshold (160)
    makeConfig({ name: "ou-highline-160", highLineThreshold: 160 }),

    // 28. Lower low-line threshold (130)
    makeConfig({ name: "ou-lowline-130", lowLineThreshold: 130 }),

    // 29. Higher low-line threshold (140)
    makeConfig({ name: "ou-lowline-140", lowLineThreshold: 140 }),

    // 30. Add tempo differential signal
    makeConfig({
      name: "ou-with-tempo-signal",
      useTempoSignal: true,
      ouWeights: { modelEdge: 0.35, seasonOU: 0.12, recentForm: 0.08, h2hWeather: 0.12, tempoDiff: 0.13 },
    }),

    // 31. Higher model edge weight for O/U
    makeConfig({
      name: "ou-higher-model-weight",
      ouWeights: { modelEdge: 0.55, seasonOU: 0.10, recentForm: 0.08, h2hWeather: 0.12 },
    }),

    // 32. O/U convergence bonus disabled
    makeConfig({ name: "ou-no-convergence", skipOUConvergence: true }),

    // ═══ COMBO EXPERIMENTS ═══

    // 33. Best spread combo: fade ATS + flip home + mid-range lines
    makeConfig({
      name: "combo-spread-best",
      atsFade: true,
      flipHomeToAway: true,
      spreadRangeFilter: { min: 3, max: 10 },
    }),

    // 34. O/U best combo: aggressive + tempo + higher model weight
    makeConfig({
      name: "combo-ou-best",
      ouSumDEThresholds: "aggressive",
      useTempoSignal: true,
      ouWeights: { modelEdge: 0.45, seasonOU: 0.10, recentForm: 0.08, h2hWeather: 0.10, tempoDiff: 0.12 },
    }),

    // 35. Spreads off, O/U aggressive
    makeConfig({
      name: "pure-ou-aggressive",
      spreadEnabled: false,
      ouSumDEThresholds: "aggressive",
      useTempoSignal: true,
      ouWeights: { modelEdge: 0.45, seasonOU: 0.10, recentForm: 0.08, h2hWeather: 0.10, tempoDiff: 0.12 },
    }),

    // 36. 5★ only (higher bar)
    makeConfig({ name: "5star-only", minConfidence: 5 }),

    // 37. ATS min games = 8 (more data before betting)
    makeConfig({ name: "ats-min-8-games", atsMinGames: 8 }),

    // 38. ATS min games = 10
    makeConfig({ name: "ats-min-10-games", atsMinGames: 10 }),

    // 39. Kill H2H signal
    makeConfig({
      name: "no-h2h",
      spreadWeights: { modelEdge: 0.35, seasonATS: 0.15, recentForm: 0.15, h2h: 0.00, restDays: 0.05 },
    }),

    // 40. Rest signal higher weight
    makeConfig({
      name: "rest-higher-weight",
      spreadWeights: { modelEdge: 0.25, seasonATS: 0.15, recentForm: 0.15, h2h: 0.05, restDays: 0.10 },
    }),
  ];
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("  NCAAMB PICK ENGINE — MULTI-EXPERIMENT BACKTEST");
  console.log("═══════════════════════════════════════════════════════════════════\n");

  // Load data
  console.log("Loading games...");
  const allGames = await prisma.nCAAMBGame.findMany({
    where: { season: 2025, spread: { not: null } },
    orderBy: { gameDate: "asc" },
    include: {
      homeTeam: { select: { name: true, conference: true } },
      awayTeam: { select: { name: true, conference: true } },
    },
  }) as unknown as GameRecord[];
  console.log(`Loaded ${allGames.length} games with spreads`);

  const priorGames = await prisma.nCAAMBGame.findMany({
    where: { season: { lt: 2025 }, spread: { not: null } },
    orderBy: { gameDate: "asc" },
    include: {
      homeTeam: { select: { name: true, conference: true } },
      awayTeam: { select: { name: true, conference: true } },
    },
  }) as unknown as GameRecord[];
  console.log(`Loaded ${priorGames.length} prior season games for H2H`);

  let kenpomRatings: Map<string, KenpomRating>;
  try {
    kenpomRatings = await getKenpomRatings();
    console.log(`Loaded ${kenpomRatings.size} KenPom ratings`);
  } catch {
    console.error("KenPom unavailable — aborting.");
    process.exit(1);
  }

  // Group games by date
  const gamesByDate = new Map<string, GameRecord[]>();
  for (const game of allGames) {
    const d = game.gameDate.toISOString().split("T")[0];
    if (!gamesByDate.has(d)) gamesByDate.set(d, []);
    gamesByDate.get(d)!.push(game);
  }

  const dates = [...gamesByDate.keys()].sort();
  const minDate = new Date(dates[0]);
  minDate.setDate(minDate.getDate() + 14);
  const minDateStr = minDate.toISOString().split("T")[0];

  console.log(`\nDate range: ${dates[0]} to ${dates[dates.length - 1]}`);
  console.log(`Scoring starts: ${minDateStr} (after 14-day warmup)\n`);

  // Run experiments
  const experiments = defineExperiments();
  console.log(`Running ${experiments.length} experiments...\n`);

  const results: ExperimentResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < experiments.length; i++) {
    const cfg = experiments[i];
    const expStart = Date.now();
    const r = runExperiment(cfg, allGames, priorGames, kenpomRatings, gamesByDate, dates, minDateStr);
    results.push(r);
    const elapsed = ((Date.now() - expStart) / 1000).toFixed(1);
    console.log(`  [${i + 1}/${experiments.length}] ${cfg.name}: ${r.totalPicks} picks, ${winPct(r.overallRecord.w, r.overallRecord.l)} win%, ${roi(r.overallRecord.w, r.overallRecord.l)} ROI (${elapsed}s)`);
  }

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nAll experiments completed in ${totalElapsed}s\n`);

  // ═══ RESULTS TABLE ═══
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("  EXPERIMENT RESULTS — SORTED BY OVERALL ROI");
  console.log("═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════");
  console.log("");
  console.log(padRight("Experiment", 30) +
    padRight("Picks", 7) +
    padRight("Win%", 8) +
    padRight("ROI", 9) +
    padRight("Sprd W%", 9) +
    padRight("Sprd ROI", 10) +
    padRight("O/U W%", 9) +
    padRight("O/U ROI", 9) +
    padRight("5★ W%", 9) +
    padRight("5★ ROI", 9) +
    padRight("5★OU W%", 10) +
    padRight("5★OU ROI", 10)
  );
  console.log("─".repeat(129));

  // Sort by overall ROI (descending)
  const sorted = [...results].sort((a, b) => {
    const roiA = (a.overallRecord.w + a.overallRecord.l) > 0
      ? ((a.overallRecord.w * 100 / 110 - a.overallRecord.l) / (a.overallRecord.w + a.overallRecord.l))
      : -999;
    const roiB = (b.overallRecord.w + b.overallRecord.l) > 0
      ? ((b.overallRecord.w * 100 / 110 - b.overallRecord.l) / (b.overallRecord.w + b.overallRecord.l))
      : -999;
    return roiB - roiA;
  });

  for (const r of sorted) {
    const isBaseline = r.name === "v4-baseline";
    const marker = isBaseline ? " ◀" : "";

    console.log(
      padRight(r.name + marker, 30) +
      padRight(String(r.totalPicks), 7) +
      padRight(winPct(r.overallRecord.w, r.overallRecord.l), 8) +
      padRight(roi(r.overallRecord.w, r.overallRecord.l), 9) +
      padRight(winPct(r.spreadRecord.w, r.spreadRecord.l), 9) +
      padRight(roi(r.spreadRecord.w, r.spreadRecord.l), 10) +
      padRight(winPct(r.ouRecord.w, r.ouRecord.l), 9) +
      padRight(roi(r.ouRecord.w, r.ouRecord.l), 9) +
      padRight(winPct(r.star5.w, r.star5.l), 9) +
      padRight(roi(r.star5.w, r.star5.l), 9) +
      padRight(winPct(r.star5OU.w, r.star5OU.l), 10) +
      padRight(roi(r.star5OU.w, r.star5OU.l), 10)
    );
  }

  console.log("\n═══ TOP 10 BY 5★ O/U ROI ═══\n");
  const sortedBy5StarOU = [...results]
    .filter(r => r.star5OU.total >= 50)
    .sort((a, b) => {
      const roiA = (a.star5OU.w + a.star5OU.l) > 0
        ? ((a.star5OU.w * 100 / 110 - a.star5OU.l) / (a.star5OU.w + a.star5OU.l))
        : -999;
      const roiB = (b.star5OU.w + b.star5OU.l) > 0
        ? ((b.star5OU.w * 100 / 110 - b.star5OU.l) / (b.star5OU.w + b.star5OU.l))
        : -999;
      return roiB - roiA;
    });

  for (const r of sortedBy5StarOU.slice(0, 10)) {
    console.log(`  ${padRight(r.name, 30)} ${r.star5OU.total} picks  ${winPct(r.star5OU.w, r.star5OU.l)}  ROI: ${roi(r.star5OU.w, r.star5OU.l)}`);
  }

  console.log("\n═══ TOP 10 BY SPREAD WIN% (min 100 spread picks) ═══\n");
  const sortedBySpread = [...results]
    .filter(r => r.spreadPicks >= 100)
    .sort((a, b) => {
      const wA = (a.spreadRecord.w + a.spreadRecord.l) > 0 ? a.spreadRecord.w / (a.spreadRecord.w + a.spreadRecord.l) : 0;
      const wB = (b.spreadRecord.w + b.spreadRecord.l) > 0 ? b.spreadRecord.w / (b.spreadRecord.w + b.spreadRecord.l) : 0;
      return wB - wA;
    });

  for (const r of sortedBySpread.slice(0, 10)) {
    console.log(`  ${padRight(r.name, 30)} ${r.spreadPicks} picks  ${winPct(r.spreadRecord.w, r.spreadRecord.l)}  ROI: ${roi(r.spreadRecord.w, r.spreadRecord.l)}`);
  }

  console.log("\n═══ IMPROVEMENT VS BASELINE ═══\n");
  const baseline = results.find(r => r.name === "v4-baseline")!;
  const baselineROI = (baseline.overallRecord.w * 100 / 110 - baseline.overallRecord.l) / (baseline.overallRecord.w + baseline.overallRecord.l);

  const improvements = sorted
    .filter(r => r.name !== "v4-baseline" && r.totalPicks >= 200)
    .map(r => {
      const rROI = (r.overallRecord.w * 100 / 110 - r.overallRecord.l) / (r.overallRecord.w + r.overallRecord.l);
      return { name: r.name, delta: (rROI - baselineROI) * 100, picks: r.totalPicks, roi: rROI * 100 };
    })
    .filter(r => r.delta > 0)
    .sort((a, b) => b.delta - a.delta);

  for (const imp of improvements.slice(0, 15)) {
    console.log(`  ${padRight(imp.name, 30)} +${imp.delta.toFixed(1)}% ROI  (${imp.picks} picks, ${imp.roi.toFixed(1)}% ROI)`);
  }

  if (improvements.length === 0) {
    console.log("  No experiments beat baseline with 200+ picks.");
  }

  console.log("\n═══════════════════════════════════════════════════════════════════");
  console.log("  NOTES");
  console.log("═══════════════════════════════════════════════════════════════════");
  console.log("• KenPom ratings are current (end-of-season) — look-ahead bias present.");
  console.log("• Trend Angles signal excluded (too expensive for 5500+ games).");
  console.log("• Walk-forward: season ATS/form stats use only pre-game data.");
  console.log("• -110 odds assumed for all picks. Break-even = 52.4%.");
  console.log("• Experiments sorted by overall ROI. Check specific categories for nuance.");
  console.log("");

  await prisma.$disconnect();
}

function padRight(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

main().catch(console.error);
