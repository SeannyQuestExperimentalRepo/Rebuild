export type Sport = "ALL" | "NFL" | "NBA" | "NCAAMB" | "NCAAF";

export interface Team {
  name: string;
  abbreviation: string;
  color: string;
  logo?: string;
}

export interface Pick {
  id: string;
  sport: Sport;
  homeTeam: Team;
  awayTeam: Team;
  gameTime: string;
  pick: string;
  confidence: 1 | 2 | 3 | 4 | 5;
  reasoning: string;
  socialProof: number; // percentage of users who agree
  tracked: boolean;
  inParlay: boolean;
  signals: Signal[];
  result?: "win" | "loss" | "push" | "pending";
}

export interface Signal {
  label: string;
  value: number; // 0-100
  color: string;
}

export interface DayRecord {
  date: string;
  wins: number;
  losses: number;
}

export interface SportRecord {
  sport: Sport;
  wins: number;
  losses: number;
  pushes: number;
}

export type NavTab = "today" | "trends" | "parlays" | "record" | "profile";
