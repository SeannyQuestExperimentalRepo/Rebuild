"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";

interface SystemStatus {
  date: string;
  picks: Record<string, number>;
  upcomingGames: Record<string, number>;
  totalUsers: number;
  totalBets: number;
}

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [actionResult, setActionResult] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Check session on load
  useEffect(() => {
    fetch("/api/admin/session")
      .then((r) => r.json())
      .then((d) => setAuthenticated(d.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        // Also sign into NextAuth for full app access
        await signIn("credentials", {
          email: "admin@trendline.app",
          password,
          redirect: false,
        });
        setAuthenticated(true);
        setPassword("");
      } else {
        setError(data.error || "Login failed");
      }
    } catch {
      setError("Network error");
    }
  };

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "system-status" }),
      });
      const data = await res.json();
      if (data.success) setStatus(data.status);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (authenticated) loadStatus();
  }, [authenticated, loadStatus]);

  const runAction = async (action: string, sport?: string) => {
    setLoading(action);
    setActionResult(null);
    try {
      const res = await fetch("/api/admin/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sport }),
      });
      const data = await res.json();
      setActionResult(data.message || JSON.stringify(data));
      loadStatus();
    } catch (err) {
      setActionResult(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setLoading(null);
    }
  };

  // Loading state
  if (authenticated === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
      </div>
    );
  }

  // Login form
  if (!authenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-lg border border-border/60 bg-card px-4 py-2.5 text-sm outline-none focus:border-primary/50"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <button
            type="submit"
            className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
          >
            Sign in
          </button>
        </form>
      </div>
    );
  }

  // Dashboard
  const SPORTS = ["NCAAMB", "NFL", "NCAAF"];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-bold tracking-tight">Admin Dashboard</h1>

      {/* System Status */}
      {status && (
        <div className="mb-8 rounded-xl border border-border/60 bg-card p-6">
          <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
            System Status &mdash; {status.date}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatusCard label="Users" value={status.totalUsers} />
            <StatusCard label="Bets" value={status.totalBets} />
            {SPORTS.map((s) => (
              <StatusCard
                key={s}
                label={`${s} Picks`}
                value={status.picks[s] ?? 0}
              />
            ))}
            {SPORTS.map((s) => (
              <StatusCard
                key={`ug-${s}`}
                label={`${s} Games`}
                value={status.upcomingGames[s] ?? 0}
              />
            ))}
          </div>
        </div>
      )}

      {/* Action Result */}
      {actionResult && (
        <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
          {actionResult}
        </div>
      )}

      {/* Quick Actions */}
      <div className="mb-8 rounded-xl border border-border/60 bg-card p-6">
        <h2 className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground/70">
          Quick Actions
        </h2>
        <div className="space-y-4">
          {/* Refresh Games */}
          <ActionRow
            label="Refresh Upcoming Games"
            description="Fetch latest odds from ESPN for all sports"
            buttonText="Refresh All"
            loading={loading === "refresh-games"}
            onClick={() => runAction("refresh-games")}
          />

          {/* Regenerate Picks */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-4">
            <div className="flex-1">
              <p className="text-sm font-medium">Regenerate Today&apos;s Picks</p>
              <p className="text-xs text-muted-foreground">
                Deletes existing picks and regenerates from scratch
              </p>
            </div>
            {SPORTS.map((s) => (
              <button
                key={s}
                disabled={loading !== null}
                onClick={() => runAction("trigger-picks", s)}
                className="rounded-lg border border-border/60 bg-card px-3 py-1.5 text-xs font-medium transition hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
              >
                {loading === "trigger-picks" ? "..." : s}
              </button>
            ))}
          </div>

          {/* Delete Today's Picks */}
          <ActionRow
            label="Delete Today's Picks"
            description="Remove all picks for today (all sports)"
            buttonText="Delete"
            loading={loading === "delete-picks-today"}
            onClick={() => runAction("delete-picks-today")}
            destructive
          />
        </div>
      </div>
    </div>
  );
}

function StatusCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function ActionRow({
  label,
  description,
  buttonText,
  loading,
  onClick,
  destructive,
}: {
  label: string;
  description: string;
  buttonText: string;
  loading: boolean;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <button
        disabled={loading}
        onClick={onClick}
        className={`shrink-0 rounded-lg px-4 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          destructive
            ? "border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
            : "bg-primary text-primary-foreground hover:brightness-110"
        }`}
      >
        {loading ? "Running..." : buttonText}
      </button>
    </div>
  );
}
