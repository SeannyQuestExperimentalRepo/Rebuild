import { OddsTick, Pick, MonthlyPerformance, SportPerformance, TierPerformance } from './types';

export const ODDS_TICKER: OddsTick[] = [
  { gameId: '1', away: 'LAL', home: 'BOS', sport: 'NBA', spread: -3.5, prevSpread: -3, total: 224.5, prevTotal: 223, time: '7:00 PM' },
  { gameId: '2', away: 'MIL', home: 'PHI', sport: 'NBA', spread: 1.5, prevSpread: 2, total: 218, prevTotal: 218, time: '7:30 PM' },
  { gameId: '3', away: 'DEN', home: 'GSW', sport: 'NBA', spread: -2, prevSpread: -1.5, total: 231, prevTotal: 230.5, time: '10:00 PM' },
  { gameId: '4', away: 'DAL', home: 'MIA', sport: 'NBA', spread: 4.5, prevSpread: 5, total: 211.5, prevTotal: 212, time: '7:30 PM' },
  { gameId: '5', away: 'Duke', home: 'UNC', sport: 'NCAAMB', spread: -5.5, prevSpread: -5, total: 148, prevTotal: 147, time: '9:00 PM' },
  { gameId: '6', away: 'Purdue', home: 'IU', sport: 'NCAAMB', spread: -7, prevSpread: -7, total: 142.5, prevTotal: 143, time: '8:00 PM' },
  { gameId: '7', away: 'NYR', home: 'TOR', sport: 'NHL', spread: -1.5, prevSpread: -1.5, total: 6, prevTotal: 5.5, time: '7:00 PM' },
  { gameId: '8', away: 'OKC', home: 'MIN', sport: 'NBA', spread: -4, prevSpread: -3.5, total: 219, prevTotal: 219.5, time: '8:00 PM' },
];

const signals = (vals: number[]) => {
  const labels = ['Power Rating', 'Pace & Tempo', 'Efficiency', 'Recent Form', 'H2H History', 'Injury Impact', 'Rest Advantage', 'Public %', 'Sharp Money'];
  return labels.map((label, i) => ({ label, value: vals[i], weight: [0.18, 0.12, 0.15, 0.1, 0.08, 0.1, 0.07, 0.1, 0.1][i] }));
};

export const TODAYS_PICKS: Pick[] = [
  {
    id: '1', sport: 'NBA', away: 'Los Angeles Lakers', home: 'Boston Celtics', betType: 'spread',
    selection: 'BOS -3.5', line: -3.5, modelPrediction: -6.2, edge: 7.1, confidence: 5,
    signals: signals([82, 65, 78, 71, 45, 12, 30, -25, 68]),
    result: 'pending', gameTime: '7:00 PM ET', odds: -110, units: 2.5,
  },
  {
    id: '2', sport: 'NBA', away: 'Milwaukee Bucks', home: 'Philadelphia 76ers', betType: 'total',
    selection: 'OVER 218', line: 218, modelPrediction: 224.3, edge: 2.9, confidence: 3,
    signals: signals([40, 72, 55, 38, 20, -15, 10, 42, 31]),
    result: 'pending', gameTime: '7:30 PM ET', odds: -108, units: 1.0,
  },
  {
    id: '3', sport: 'NBA', away: 'Denver Nuggets', home: 'Golden State Warriors', betType: 'spread',
    selection: 'DEN -2', line: -2, modelPrediction: -5.8, edge: 5.3, confidence: 4,
    signals: signals([75, 58, 70, 62, 50, 8, -5, -30, 55]),
    result: 'pending', gameTime: '10:00 PM ET', odds: -110, units: 1.5,
  },
  {
    id: '4', sport: 'NCAAMB', away: 'Duke Blue Devils', home: 'North Carolina', betType: 'spread',
    selection: 'DUKE -5.5', line: -5.5, modelPrediction: -9.1, edge: 6.4, confidence: 5,
    signals: signals([88, 60, 82, 75, 55, 5, 20, -40, 72]),
    result: 'pending', gameTime: '9:00 PM ET', odds: -110, units: 2.0,
  },
  {
    id: '5', sport: 'NBA', away: 'Dallas Mavericks', home: 'Miami Heat', betType: 'moneyline',
    selection: 'MIA ML', line: 175, modelPrediction: 60.2, edge: 3.8, confidence: 3,
    signals: signals([35, 45, 40, 55, 30, -20, 15, 50, 25]),
    result: 'pending', gameTime: '7:30 PM ET', odds: 175, units: 0.8,
  },
  {
    id: '6', sport: 'NCAAMB', away: 'Purdue', home: 'Indiana', betType: 'total',
    selection: 'UNDER 142.5', line: 142.5, modelPrediction: 136.8, edge: 4.1, confidence: 4,
    signals: signals([50, -45, 65, 42, 35, 10, 0, -18, 48]),
    result: 'pending', gameTime: '8:00 PM ET', odds: -105, units: 1.5,
  },
  {
    id: '7', sport: 'NBA', away: 'OKC Thunder', home: 'Minnesota T-Wolves', betType: 'spread',
    selection: 'OKC -4', line: -4, modelPrediction: -3.1, edge: -1.2, confidence: 1,
    signals: signals([20, 15, 10, -5, 12, -8, 5, 35, -10]),
    result: 'pending', gameTime: '8:00 PM ET', odds: -110, units: 0.5,
  },
];

export const RECENT_RESULTS: Pick[] = [
  { id: 'r1', sport: 'NBA', away: 'CLE', home: 'NYK', betType: 'spread', selection: 'CLE +2.5', line: 2.5, modelPrediction: 1.2, edge: 3.7, confidence: 4, signals: signals([60, 55, 50, 48, 40, 0, 10, -20, 45]), result: 'win', gameTime: 'Yesterday', odds: -110, units: 1.5 },
  { id: 'r2', sport: 'NBA', away: 'PHX', home: 'SAC', betType: 'total', selection: 'OVER 228', line: 228, modelPrediction: 234.1, edge: 2.7, confidence: 3, signals: signals([45, 68, 52, 40, 30, -5, 15, 30, 28]), result: 'win', gameTime: 'Yesterday', odds: -110, units: 1.0 },
  { id: 'r3', sport: 'NCAAMB', away: 'Kansas', home: 'Baylor', betType: 'spread', selection: 'KU -3', line: -3, modelPrediction: -6.5, edge: 5.8, confidence: 5, signals: signals([80, 55, 75, 70, 48, 10, 25, -35, 62]), result: 'loss', gameTime: 'Yesterday', odds: -110, units: 2.0 },
  { id: 'r4', sport: 'NBA', away: 'BKN', home: 'CHI', betType: 'spread', selection: 'CHI -5', line: -5, modelPrediction: -7.2, edge: 4.1, confidence: 4, signals: signals([55, 42, 60, 50, 35, 15, 5, -15, 50]), result: 'win', gameTime: '2 days ago', odds: -110, units: 1.5 },
  { id: 'r5', sport: 'NCAAMB', away: 'UConn', home: 'Villanova', betType: 'total', selection: 'UNDER 135', line: 135, modelPrediction: 130.2, edge: 3.6, confidence: 3, signals: signals([42, -38, 58, 35, 28, 0, 8, -22, 40]), result: 'win', gameTime: '2 days ago', odds: -110, units: 1.0 },
];

export const MONTHLY_PERFORMANCE: MonthlyPerformance[] = [
  { month: 'Sep', wins: 18, losses: 12, roi: 8.2, units: 4.9 },
  { month: 'Oct', wins: 25, losses: 19, roi: 5.1, units: 6.1 },
  { month: 'Nov', wins: 32, losses: 22, roi: 9.8, units: 14.7 },
  { month: 'Dec', wins: 28, losses: 24, roi: 3.2, units: 4.8 },
  { month: 'Jan', wins: 35, losses: 21, roi: 12.4, units: 19.8 },
  { month: 'Feb', wins: 14, losses: 8, roi: 11.1, units: 8.9 },
];

export const SPORT_PERFORMANCE: SportPerformance[] = [
  { sport: 'NBA', picks: 98, wins: 58, losses: 37, pushes: 3, winPct: 61.1, roi: 9.4, units: 22.1, clv: 1.8 },
  { sport: 'NCAAMB', picks: 72, wins: 42, losses: 28, pushes: 2, winPct: 60.0, roi: 8.1, units: 15.2, clv: 2.1 },
  { sport: 'NFL', picks: 34, wins: 20, losses: 13, pushes: 1, winPct: 60.6, roi: 7.5, units: 8.4, clv: 1.5 },
  { sport: 'NCAAF', picks: 22, wins: 14, losses: 8, pushes: 0, winPct: 63.6, roi: 12.8, units: 9.2, clv: 2.4 },
  { sport: 'NHL', picks: 15, wins: 8, losses: 7, pushes: 0, winPct: 53.3, roi: 2.1, units: 1.2, clv: 0.8 },
];

export const TIER_PERFORMANCE: TierPerformance[] = [
  { tier: 5, wins: 32, losses: 12, winPct: 72.7, roi: 18.4, avgEdge: 6.8 },
  { tier: 4, wins: 38, losses: 22, winPct: 63.3, roi: 10.2, avgEdge: 4.5 },
  { tier: 3, wins: 42, losses: 32, winPct: 56.8, roi: 5.1, avgEdge: 2.9 },
  { tier: 2, wins: 22, losses: 20, winPct: 52.4, roi: 1.8, avgEdge: 1.5 },
  { tier: 1, wins: 8, losses: 10, winPct: 44.4, roi: -4.2, avgEdge: 0.6 },
];
