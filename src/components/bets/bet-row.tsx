"use client";

import type { Bet } from "@/hooks/use-bets";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatOdds(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function resultColor(result: string): string {
  if (result === "WIN") return "text-emerald-400";
  if (result === "LOSS") return "text-red-400";
  if (result === "PUSH") return "text-yellow-400";
  return "text-muted-foreground";
}

function profitColor(profit: number | null): string {
  if (profit === null) return "text-muted-foreground";
  if (profit > 0) return "text-emerald-400";
  if (profit < 0) return "text-red-400";
  return "text-muted-foreground";
}

export function BetRow({
  bet,
  onGrade,
  onDelete,
}: {
  bet: Bet;
  onGrade: (id: string, result: string) => void;
  onDelete: (id: string) => void;
}) {
  const matchup = `${bet.awayTeam} @ ${bet.homeTeam}`;
  const lineLabel =
    bet.betType === "OVER_UNDER"
      ? `${bet.pickSide === "over" ? "Over" : "Under"} ${bet.line}`
      : bet.betType === "MONEYLINE"
        ? `${bet.pickSide} ML`
        : `${bet.pickSide} ${bet.line != null ? (bet.line > 0 ? "+" : "") + bet.line : ""}`;

  return (
    <tr className="border-b border-border/30 hover:bg-muted/20">
      <td className="px-3 py-2 text-sm">{formatDate(bet.gameDate)}</td>
      <td className="px-3 py-2 text-sm">
        <span className="text-xs text-muted-foreground">{bet.sport}</span>
        <br />
        {matchup}
      </td>
      <td className="px-3 py-2 text-sm">
        <span className="text-xs text-muted-foreground">
          {bet.betType.replace("_", " ")}
        </span>
        <br />
        {lineLabel}
      </td>
      <td className="px-3 py-2 text-sm text-right">
        {formatOdds(bet.oddsValue)}
      </td>
      <td className="px-3 py-2 text-sm text-right">
        {formatCurrency(bet.stake)}
      </td>
      <td className={`px-3 py-2 text-sm font-medium ${resultColor(bet.result)}`}>
        {bet.result === "PENDING" ? (
          <div className="flex gap-1">
            <button
              onClick={() => onGrade(bet.id, "WIN")}
              className="rounded bg-emerald-700/30 px-1.5 py-0.5 text-xs text-emerald-400 hover:bg-emerald-700/50"
            >
              W
            </button>
            <button
              onClick={() => onGrade(bet.id, "LOSS")}
              className="rounded bg-red-700/30 px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-700/50"
            >
              L
            </button>
            <button
              onClick={() => onGrade(bet.id, "PUSH")}
              className="rounded bg-yellow-700/30 px-1.5 py-0.5 text-xs text-yellow-400 hover:bg-yellow-700/50"
            >
              P
            </button>
          </div>
        ) : (
          bet.result
        )}
      </td>
      <td className={`px-3 py-2 text-sm text-right font-mono ${profitColor(bet.profit)}`}>
        {bet.profit != null
          ? (bet.profit >= 0 ? "+" : "") + formatCurrency(bet.profit)
          : "—"}
      </td>
      <td className="px-3 py-2 text-sm">
        <button
          onClick={() => onDelete(bet.id)}
          className="text-muted-foreground/50 hover:text-red-400"
          title="Delete bet"
        >
          ×
        </button>
      </td>
    </tr>
  );
}
