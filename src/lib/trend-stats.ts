/**
 * Statistical Significance & Trend Scoring Module
 *
 * Provides statistical tests to determine whether a betting trend is
 * meaningful or just noise. Used across all TrendLine features.
 *
 * Tests:
 * - Binomial test (is 60% win rate in 50 games significantly different from 50%?)
 * - Confidence intervals for rates (ATS%, O/U%)
 * - Trend strength scoring (combines sample size + deviation from expected)
 * - Effect size (how far from baseline, adjusted for sample)
 */

// ─── Binomial Test (Normal Approximation) ─────────────────────────────────────

/**
 * Calculate the z-score for a binomial proportion test.
 * H0: true proportion = p0 (e.g., 0.5 for ATS)
 * H1: true proportion ≠ p0
 *
 * @param successes - Number of successes (e.g., ATS covers)
 * @param trials - Total trials (excluding pushes)
 * @param p0 - Null hypothesis proportion (default 0.5 for ATS)
 */
export function binomialZScore(
  successes: number,
  trials: number,
  p0: number = 0.5,
): number {
  if (trials <= 0) return 0;
  const pHat = successes / trials;
  const se = Math.sqrt((p0 * (1 - p0)) / trials);
  if (se === 0) return 0;
  return (pHat - p0) / se;
}

/**
 * Convert a z-score to a two-tailed p-value using the standard normal CDF.
 * Uses a rational approximation (Abramowitz & Stegun).
 */
export function zToP(z: number): number {
  const absZ = Math.abs(z);
  // Approximation of the standard normal CDF
  const t = 1 / (1 + 0.2316419 * absZ);
  const d = 0.3989422804014327; // 1/sqrt(2*pi)
  const p =
    d *
    Math.exp((-absZ * absZ) / 2) *
    (t *
      (0.319381530 +
        t *
          (-0.356563782 +
            t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))));
  return 2 * p; // Two-tailed
}

/**
 * Determine if a trend is statistically significant.
 *
 * @param successes - Number of successes
 * @param trials - Total trials
 * @param p0 - Null hypothesis proportion (default 0.5)
 * @param alpha - Significance level (default 0.05)
 */
export function isSignificant(
  successes: number,
  trials: number,
  p0: number = 0.5,
  alpha: number = 0.05,
): boolean {
  if (trials < 10) return false; // Too small for meaningful test
  const z = binomialZScore(successes, trials, p0);
  const p = zToP(z);
  return p < alpha;
}

// ─── Confidence Intervals ──────────────────────────────────────────────────────

/**
 * Wilson score interval — better than Wald interval for small samples
 * and extreme proportions.
 *
 * Returns [lower, upper] bounds for the true proportion at the given
 * confidence level.
 */
export function wilsonInterval(
  successes: number,
  trials: number,
  confidence: number = 0.95,
): [number, number] {
  if (trials <= 0) return [0, 0];

  // Z-score for confidence level
  const zMap: Record<number, number> = {
    0.9: 1.645,
    0.95: 1.96,
    0.99: 2.576,
  };
  const z = zMap[confidence] ?? 1.96;
  const z2 = z * z;

  const pHat = successes / trials;
  const denominator = 1 + z2 / trials;
  const center = pHat + z2 / (2 * trials);
  const margin =
    z *
    Math.sqrt((pHat * (1 - pHat) + z2 / (4 * trials)) / trials);

  const lower = Math.max(0, (center - margin) / denominator);
  const upper = Math.min(1, (center + margin) / denominator);

  return [Math.round(lower * 1000) / 1000, Math.round(upper * 1000) / 1000];
}

// ─── Trend Strength Scoring ────────────────────────────────────────────────────

export type TrendStrength = "strong" | "moderate" | "weak" | "noise";

export interface TrendSignificance {
  /** Sample size */
  sampleSize: number;
  /** Observed rate (0-1) */
  observedRate: number;
  /** Expected baseline rate */
  baselineRate: number;
  /** Z-score from binomial test */
  zScore: number;
  /** Two-tailed p-value */
  pValue: number;
  /** Is this statistically significant at α=0.05? */
  isSignificant: boolean;
  /** 95% confidence interval for the true rate */
  confidenceInterval: [number, number];
  /** Overall strength classification */
  strength: TrendStrength;
  /** Human-readable explanation */
  label: string;
}

/**
 * Compute full significance analysis for a trend.
 *
 * @param successes - Number of successes (e.g., ATS covers)
 * @param trials - Total trials (e.g., games with spread data, excluding pushes)
 * @param baselineRate - Expected baseline rate (0.5 for ATS/OU, varies for win rate)
 */
export function analyzeTrendSignificance(
  successes: number,
  trials: number,
  baselineRate: number = 0.5,
): TrendSignificance {
  if (trials === 0) {
    return {
      sampleSize: 0,
      observedRate: 0,
      baselineRate,
      zScore: 0,
      pValue: 1,
      isSignificant: false,
      confidenceInterval: [0, 0],
      strength: "noise",
      label: "No data",
    };
  }

  const observedRate = successes / trials;
  const z = binomialZScore(successes, trials, baselineRate);
  const pVal = zToP(z);
  const sig = trials >= 10 && pVal < 0.05;
  const ci = wilsonInterval(successes, trials);

  // Strength classification considers both significance AND practical magnitude
  let strength: TrendStrength;
  let label: string;

  if (trials < 10) {
    strength = "noise";
    label = `Too small (n=${trials})`;
  } else if (!sig) {
    strength = trials < 30 ? "noise" : "weak";
    label =
      strength === "noise"
        ? `Not enough data (n=${trials})`
        : `Not statistically significant (p=${pVal.toFixed(3)})`;
  } else {
    // Significant — classify by effect size
    const effectSize = Math.abs(observedRate - baselineRate);
    if (effectSize >= 0.12 && trials >= 25) {
      strength = "strong";
      label = `Strong trend (${(observedRate * 100).toFixed(1)}% vs ${(baselineRate * 100).toFixed(1)}% baseline, p=${pVal.toFixed(3)}, n=${trials})`;
    } else if (effectSize >= 0.06 || trials >= 40) {
      strength = "moderate";
      label = `Moderate trend (${(observedRate * 100).toFixed(1)}% vs ${(baselineRate * 100).toFixed(1)}% baseline, p=${pVal.toFixed(3)}, n=${trials})`;
    } else {
      strength = "weak";
      label = `Weak trend (${(observedRate * 100).toFixed(1)}%, small effect size, n=${trials})`;
    }
  }

  return {
    sampleSize: trials,
    observedRate: Math.round(observedRate * 1000) / 1000,
    baselineRate,
    zScore: Math.round(z * 100) / 100,
    pValue: Math.round(pVal * 10000) / 10000,
    isSignificant: sig,
    confidenceInterval: ci,
    strength,
    label,
  };
}

// ─── Prop Hit Rate Analysis ────────────────────────────────────────────────────

export interface PropHitRate {
  /** The stat being analyzed (e.g., "passing_yards") */
  stat: string;
  /** The threshold (e.g., 275.5) */
  line: number;
  /** "over" or "under" */
  direction: "over" | "under";
  /** Number of times the prop hit */
  hits: number;
  /** Total games with data for this stat */
  total: number;
  /** Hit rate as percentage (0-100) */
  hitRate: number;
  /** Statistical significance of this hit rate */
  significance: TrendSignificance;
}

/**
 * Analyze a player prop hit rate.
 *
 * Given a set of stat values, determines how often the prop would have hit
 * and whether the rate is statistically significant.
 *
 * @param values - Array of stat values (null values are filtered out)
 * @param line - The prop line (e.g., 275.5)
 * @param direction - "over" or "under"
 * @param stat - Name of the stat (for labeling)
 */
export function analyzePlayerProp(
  values: (number | null)[],
  line: number,
  direction: "over" | "under",
  stat: string,
): PropHitRate {
  const validValues = values.filter((v): v is number => v !== null);
  const total = validValues.length;

  // Exclude exact-line pushes from the total
  const pushes = validValues.filter((v) => v === line).length;
  const totalExPush = total - pushes;

  let hits: number;
  if (direction === "over") {
    hits = validValues.filter((v) => v > line).length;
  } else {
    hits = validValues.filter((v) => v < line).length;
  }

  const hitRate = totalExPush > 0 ? Math.round((hits / totalExPush) * 1000) / 10 : 0;
  const significance = analyzeTrendSignificance(hits, totalExPush, 0.5);

  return {
    stat,
    line,
    direction,
    hits,
    total,
    hitRate,
    significance,
  };
}
