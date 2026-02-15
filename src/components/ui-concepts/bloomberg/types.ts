// Shared types for Bloomberg UI concept

export type Sport = 'NBA' | 'NCAAMB' | 'NFL' | 'NCAAF' | 'MLB' | 'NHL';
export type ConfidenceTier = 1 | 2 | 3 | 4 | 5;
export type BetType = 'spread' | 'total' | 'moneyline';
export type PickResult = 'win' | 'loss' | 'push' | 'pending';

export interface SignalBreakdown {
  label: string;
  value: number; // -100 to 100
  weight: number;
}

export interface OddsTick {
  gameId: string;
  away: string;
  home: string;
  sport: Sport;
  spread: number;
  prevSpread: number;
  total: number;
  prevTotal: number;
  time: string;
}

export interface Pick {
  id: string;
  sport: Sport;
  away: string;
  home: string;
  betType: BetType;
  selection: string;
  line: number;
  modelPrediction: number;
  edge: number;
  confidence: ConfidenceTier;
  signals: SignalBreakdown[];
  result: PickResult;
  gameTime: string;
  odds: number;
  units: number;
}

export interface TrackRecordStats {
  wins: number;
  losses: number;
  pushes: number;
  winPct: number;
  roi: number;
  units: number;
  clv: number;
}

export interface MonthlyPerformance {
  month: string;
  wins: number;
  losses: number;
  roi: number;
  units: number;
}

export interface SportPerformance extends TrackRecordStats {
  sport: Sport;
  picks: number;
}

export interface TierPerformance {
  tier: ConfidenceTier;
  wins: number;
  losses: number;
  winPct: number;
  roi: number;
  avgEdge: number;
}
