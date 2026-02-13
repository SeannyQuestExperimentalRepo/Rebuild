"use client";

import { useState } from "react";
import {
  useBets,
  useBetStats,
  useGradeBet,
  useDeleteBet,
} from "@/hooks/use-bets";
import { StatsSummary } from "@/components/bets/stats-summary";
import { AddBetForm } from "@/components/bets/add-bet-form";
import { BetRow } from "@/components/bets/bet-row";
import { BetFilters } from "@/components/bets/bet-filters";

export default function BetsPage() {
  const [showForm, setShowForm] = useState(false);
  const [sportFilter, setSportFilter] = useState<string>("");
  const [resultFilter, setResultFilter] = useState<string>("");

  const { data: betsData, isLoading: betsLoading } = useBets({
    sport: sportFilter || undefined,
    result: resultFilter || undefined,
    limit: 100,
  });
  const { data: stats, isLoading: statsLoading } = useBetStats({
    sport: sportFilter || undefined,
  });
  const gradeBet = useGradeBet();
  const deleteBet = useDeleteBet();

  const bets = betsData?.bets || [];

  const handleGrade = (id: string, result: string) => {
    gradeBet.mutate({ id, result });
  };

  const handleDelete = (id: string) => {
    deleteBet.mutate(id);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bet Tracker</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track, grade, and analyze your bets
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + Add Bet
        </button>
      </div>

      {/* Add Bet Form */}
      {showForm && (
        <div className="mb-6">
          <AddBetForm onClose={() => setShowForm(false)} />
        </div>
      )}

      {/* Stats Summary */}
      {stats && !statsLoading && <StatsSummary stats={stats} />}

      {/* Filters */}
      <BetFilters
        sportFilter={sportFilter}
        resultFilter={resultFilter}
        onSportChange={setSportFilter}
        onResultChange={setResultFilter}
      />

      {/* Bets Table */}
      {betsLoading ? (
        <div className="py-12 text-center text-muted-foreground">
          Loading bets...
        </div>
      ) : bets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/60 py-12 text-center">
          <p className="text-muted-foreground">No bets yet</p>
          <p className="mt-1 text-sm text-muted-foreground/60">
            Click &quot;+ Add Bet&quot; to start tracking
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Matchup</th>
                <th className="px-3 py-2">Pick</th>
                <th className="px-3 py-2 text-right">Odds</th>
                <th className="px-3 py-2 text-right">Stake</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2 text-right">Profit</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => (
                <BetRow
                  key={bet.id}
                  bet={bet}
                  onGrade={handleGrade}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
