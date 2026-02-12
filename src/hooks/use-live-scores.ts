import { useMemo } from "react";
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
 * - Games in progress: polls every 15s
 * - Games scheduled (not started yet): polls every 60s to detect starts
 * - All games final: stops polling
 */
export function useLiveScores(sport: string, date: string) {
  const query = useQuery({
    queryKey: ["live-scores", sport, date],
    queryFn: () => fetchLiveScores(sport, date),
    staleTime: 5_000,
    refetchInterval: (query) => {
      const games = query.state.data;
      if (!games || games.length === 0) return 60_000;
      const hasLive = games.some((g) => g.status === "in_progress");
      if (hasLive) return 15_000; // Active games: poll fast
      const hasScheduled = games.some((g) => g.status === "scheduled");
      if (hasScheduled) return 60_000; // Waiting for tipoff: poll slow
      return false; // All final: stop
    },
    enabled: !!sport && !!date,
  });

  // Memoize the lookup map so consumers don't re-render needlessly
  const scoreMap = useMemo(() => {
    const map = new Map<string, LiveScore>();
    if (query.data) {
      for (const game of query.data) {
        map.set(`${game.awayTeam}@${game.homeTeam}`, game);
      }
    }
    return map;
  }, [query.data]);

  return {
    ...query,
    scoreMap,
    hasLiveGames: query.data?.some((g) => g.status === "in_progress") ?? false,
  };
}
