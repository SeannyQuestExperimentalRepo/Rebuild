"use client";

interface RecordBucket {
  wins: number;
  losses: number;
  pushes: number;
  total: number;
  winPct: number;
}

interface TrackRecordBarProps {
  overall: RecordBucket;
  byType: Record<string, RecordBucket>;
  byConfidence: Record<string, RecordBucket>;
}

function StatBox({ label, bucket }: { label: string; bucket: RecordBucket }) {
  const pctColor =
    bucket.total === 0
      ? "text-muted-foreground"
      : bucket.winPct >= 55
        ? "text-emerald-400"
        : bucket.winPct < 50
          ? "text-red-400"
          : "text-foreground";

  return (
    <div className="rounded-lg border border-border bg-card/50 px-3 py-2 text-center">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${pctColor}`}>
        {bucket.total > 0 ? `${bucket.winPct}%` : "—"}
      </div>
      <div className="text-xs tabular-nums text-muted-foreground">
        {bucket.wins}-{bucket.losses}
        {bucket.pushes > 0 ? `-${bucket.pushes}` : ""}
      </div>
    </div>
  );
}

export function TrackRecordBar({ overall, byType, byConfidence }: TrackRecordBarProps) {
  if (overall.total === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/50 px-4 py-3 text-center text-sm text-muted-foreground">
        Track record builds as games are played and graded
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <StatBox label="Overall" bucket={overall} />
      {byType.SPREAD && <StatBox label="Spreads" bucket={byType.SPREAD} />}
      {byType.OVER_UNDER && <StatBox label="O/U" bucket={byType.OVER_UNDER} />}
      {byType.PLAYER_PROP && <StatBox label="Props" bucket={byType.PLAYER_PROP} />}
      {byConfidence["5_star"] && <StatBox label="5-Star" bucket={byConfidence["5_star"]} />}
      {byConfidence["4_star"] && <StatBox label="4-Star" bucket={byConfidence["4_star"]} />}
    </div>
  );
}
