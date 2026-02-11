/**
 * Subscription tier definitions and access control helpers.
 *
 * Tier structure:
 *   FREE    — basic access: trends, upcoming games, today's picks (3★ only)
 *   PREMIUM — full access: all picks (4★/5★), bet tracking, props, advanced trends
 *   ADMIN   — everything + admin panel
 */

export type Tier = "FREE" | "PREMIUM" | "ADMIN";

export interface TierConfig {
  label: string;
  maxTrendsPerDay: number;
  maxPickStars: number;
  betTracking: boolean;
  playerProps: boolean;
  advancedTrends: boolean;
  liveOdds: boolean;
  csvExport: boolean;
  priceMonthly: number;
  priceAnnual: number;
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  FREE: {
    label: "Free",
    maxTrendsPerDay: 10,
    maxPickStars: 3,
    betTracking: false,
    playerProps: false,
    advancedTrends: false,
    liveOdds: false,
    csvExport: false,
    priceMonthly: 0,
    priceAnnual: 0,
  },
  PREMIUM: {
    label: "Premium",
    maxTrendsPerDay: 100,
    maxPickStars: 5,
    betTracking: true,
    playerProps: true,
    advancedTrends: true,
    liveOdds: true,
    csvExport: true,
    priceMonthly: 19,
    priceAnnual: 149,
  },
  ADMIN: {
    label: "Admin",
    maxTrendsPerDay: Infinity,
    maxPickStars: 5,
    betTracking: true,
    playerProps: true,
    advancedTrends: true,
    liveOdds: true,
    csvExport: true,
    priceMonthly: 0,
    priceAnnual: 0,
  },
};

/** Get tier config for a user role, defaulting to FREE */
export function getTierConfig(role?: string | null): TierConfig {
  if (role === "ADMIN") return TIER_CONFIG.ADMIN;
  if (role === "PREMIUM") return TIER_CONFIG.PREMIUM;
  return TIER_CONFIG.FREE;
}

/** Check if a user has access to a specific feature */
export function hasAccess(
  role: string | null | undefined,
  feature: keyof Omit<TierConfig, "label" | "priceMonthly" | "priceAnnual" | "maxTrendsPerDay" | "maxPickStars">,
): boolean {
  const config = getTierConfig(role);
  return config[feature] as boolean;
}

/** Check if the user can see picks at this confidence level */
export function canSeePick(role: string | null | undefined, confidence: number): boolean {
  const config = getTierConfig(role);
  return confidence <= config.maxPickStars;
}

/** Features list for pricing page display */
export const PRICING_FEATURES = [
  { key: "trends", free: "10/day", premium: "Unlimited", label: "Trend queries" },
  { key: "picks", free: "3★ picks only", premium: "All picks (3-5★)", label: "Daily picks" },
  { key: "betTracking", free: false, premium: true, label: "Bet tracking & P/L" },
  { key: "playerProps", free: false, premium: true, label: "Player prop analysis" },
  { key: "advancedTrends", free: false, premium: true, label: "Advanced trend filters" },
  { key: "liveOdds", free: false, premium: true, label: "Live odds comparison" },
  { key: "csvExport", free: false, premium: true, label: "CSV data export" },
] as const;
