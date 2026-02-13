"use client";

import { useState } from "react";
import { useCreateBet } from "@/hooks/use-bets";
import type { CreateBetInput } from "@/hooks/use-bets";

const SPORTS = ["NFL", "NCAAF", "NCAAMB", "NBA"] as const;
const BET_TYPES = [
  "SPREAD",
  "OVER_UNDER",
  "MONEYLINE",
  "PLAYER_PROP",
  "PARLAY",
  "TEASER",
] as const;
const SPORTSBOOKS = [
  "DraftKings",
  "FanDuel",
  "BetMGM",
  "Caesars",
  "ESPN BET",
  "Other",
] as const;

export function AddBetForm({ onClose }: { onClose: () => void }) {
  const createBet = useCreateBet();
  const [form, setForm] = useState<Partial<CreateBetInput>>({
    sport: "NFL",
    betType: "SPREAD",
    oddsValue: -110,
    stake: 100,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.sport ||
      !form.betType ||
      !form.gameDate ||
      !form.homeTeam ||
      !form.awayTeam ||
      !form.pickSide ||
      !form.stake
    )
      return;

    await createBet.mutateAsync(form as CreateBetInput);
    onClose();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-border/60 bg-card p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Add Bet</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Sport
          </span>
          <select
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={form.sport}
            onChange={(e) => setForm({ ...form, sport: e.target.value })}
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Bet Type
          </span>
          <select
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={form.betType}
            onChange={(e) => setForm({ ...form, betType: e.target.value })}
          >
            {BET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Game Date
          </span>
          <input
            type="date"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={form.gameDate || ""}
            onChange={(e) => setForm({ ...form, gameDate: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Home Team
          </span>
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="e.g. Chiefs"
            value={form.homeTeam || ""}
            onChange={(e) => setForm({ ...form, homeTeam: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Away Team
          </span>
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="e.g. Bills"
            value={form.awayTeam || ""}
            onChange={(e) => setForm({ ...form, awayTeam: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Pick Side
          </span>
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="home / away / over / under"
            value={form.pickSide || ""}
            onChange={(e) => setForm({ ...form, pickSide: e.target.value })}
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Line</span>
          <input
            type="number"
            step="0.5"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={form.line ?? ""}
            onChange={(e) =>
              setForm({ ...form, line: e.target.value ? parseFloat(e.target.value) : undefined })
            }
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">Odds</span>
          <input
            type="number"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={form.oddsValue ?? -110}
            onChange={(e) =>
              setForm({ ...form, oddsValue: parseInt(e.target.value) || -110 })
            }
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Stake ($)
          </span>
          <input
            type="number"
            step="1"
            min="1"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={form.stake ?? 100}
            onChange={(e) =>
              setForm({ ...form, stake: parseFloat(e.target.value) || 0 })
            }
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-xs text-muted-foreground">
            Sportsbook
          </span>
          <select
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            value={form.sportsbook || ""}
            onChange={(e) =>
              setForm({ ...form, sportsbook: e.target.value || undefined })
            }
          >
            <option value="">Select...</option>
            {SPORTSBOOKS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="col-span-2 block sm:col-span-1">
          <span className="mb-1 block text-xs text-muted-foreground">
            Notes
          </span>
          <input
            type="text"
            className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm"
            placeholder="Optional notes"
            value={form.notes || ""}
            onChange={(e) =>
              setForm({ ...form, notes: e.target.value || undefined })
            }
          />
        </label>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={createBet.isPending}
          className="rounded bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {createBet.isPending ? "Saving..." : "Add Bet"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded border border-border px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancel
        </button>
      </div>

      {createBet.isError && (
        <p className="mt-2 text-sm text-red-400">
          {(createBet.error as Error).message}
        </p>
      )}
    </form>
  );
}
