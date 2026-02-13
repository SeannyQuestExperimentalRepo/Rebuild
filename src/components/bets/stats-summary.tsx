"use client";

import type { BetStats } from "@/hooks/use-bets";

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function StatCard({
  label,
  value,
  subtext,
  colorClass,
}: {
  label: string;
  value: string;
  subtext?: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-4 py-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${colorClass || ""}`}>{value}</p>
      {subtext && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtext}</p>
      )}
    </div>
  );
}

export function StatsSummary({ stats }: { stats: BetStats }) {
  return (
    <>
      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <StatCard
          label="Record"
          value={`${stats.wins}-${stats.losses}-${stats.pushes}`}
          subtext={`${(stats.winRate * 100).toFixed(1)}% win rate`}
        />
        <StatCard
          label="ROI"
          value={`${(stats.roi * 100).toFixed(1)}%`}
          colorClass={stats.roi >= 0 ? "text-emerald-400" : "text-red-400"}
          subtext={`${formatCurrency(stats.totalStaked)} staked`}
        />
        <StatCard
          label="Profit"
          value={
            (stats.totalProfit >= 0 ? "+" : "") +
            formatCurrency(stats.totalProfit)
          }
          colorClass={
            stats.totalProfit >= 0 ? "text-emerald-400" : "text-red-400"
          }
        />
        <StatCard
          label="Streak"
          value={
            stats.currentStreak.type === "none"
              ? "—"
              : `${stats.currentStreak.count}${stats.currentStreak.type}`
          }
          colorClass={
            stats.currentStreak.type === "W"
              ? "text-emerald-400"
              : stats.currentStreak.type === "L"
                ? "text-red-400"
                : ""
          }
        />
        <StatCard
          label="Total Bets"
          value={stats.totalBets.toString()}
          subtext={`${stats.pendingBets} pending`}
        />
        <StatCard
          label="Best Day"
          value={
            stats.bestDay
              ? (stats.bestDay.profit >= 0 ? "+" : "") +
                formatCurrency(stats.bestDay.profit)
              : "—"
          }
          subtext={stats.bestDay?.date}
          colorClass="text-emerald-400"
        />
      </div>

      {/* By Sport Breakdown */}
      {Object.keys(stats.bySport).length > 1 && (
        <div className="mb-6 rounded-lg border border-border/60 bg-card p-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            By Sport
          </h3>
          <div className="flex flex-wrap gap-4">
            {Object.entries(stats.bySport).map(([sport, data]) => {
              const roi =
                data.staked > 0
                  ? ((data.profit / data.staked) * 100).toFixed(1)
                  : "0.0";
              return (
                <div key={sport} className="text-sm">
                  <span className="font-medium">{sport}</span>{" "}
                  <span className="text-muted-foreground">
                    {data.w}-{data.l}-{data.p}
                  </span>{" "}
                  <span
                    className={
                      data.profit >= 0 ? "text-emerald-400" : "text-red-400"
                    }
                  >
                    {data.profit >= 0 ? "+" : ""}
                    {formatCurrency(data.profit)} ({roi}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
