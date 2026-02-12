import { useQuery } from "@tanstack/react-query";

export interface LiveScore {
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: "scheduled" | "in_progress" | "final";
  statusDetail: string;
  gameDate: string;
}

interface LiveScoresResponse {
  success: boolean;
  games: LiveScore[];
}

async function fetchLiveScores(
  sport: string,
  date: string,
): Promise<LiveScore[]> {
  const params = new URLSearchParams({ sport, date });
  const res = await fetch(`/api/games/live-scores?${params}`);
  if (!res.ok) throw new Error(`Live scores request failed (${res.status})`);
  const data: LiveScoresResponse = await res.json();
  if (!data.success) throw new Error("Failed to fetch live scores");
  return data.games;
}

/**
 * Polls ESPN live scores. Returns a Map keyed by "awayTeam@homeTeam" for O(1) lookup.
 * Polling activates only when at least one game is in progress.
 */
export function useLiveScores(sport: string, date: string) {
  const query = useQuery({
    queryKey: ["live-scores", sport, date],
    queryFn: () => fetchLiveScores(sport, date),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: (query) => {
      const games = query.state.data;
      if (!games) return 30_000; // Default 30s until we have data
      const hasLive = games.some((g) => g.status === "in_progress");
      return hasLive ? 30_000 : false; // Poll only when games are live
    },
    enabled: !!sport && !!date,
  });

  // Build lookup map for O(1) access by matchup key
  const scoreMap = new Map<string, LiveScore>();
  if (query.data) {
    for (const game of query.data) {
      scoreMap.set(`${game.awayTeam}@${game.homeTeam}`, game);
    }
  }

  return {
    ...query,
    scoreMap,
    hasLiveGames: query.data?.some((g) => g.status === "in_progress") ?? false,
  };
}
