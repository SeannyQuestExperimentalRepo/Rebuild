"use client";

const SPORTS = ["NFL", "NCAAF", "NCAAMB", "NBA"] as const;

export function BetFilters({
  sportFilter,
  resultFilter,
  onSportChange,
  onResultChange,
}: {
  sportFilter: string;
  resultFilter: string;
  onSportChange: (value: string) => void;
  onResultChange: (value: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <select
        className="rounded border border-border bg-card px-2 py-1 text-sm"
        value={sportFilter}
        onChange={(e) => onSportChange(e.target.value)}
      >
        <option value="">All Sports</option>
        {SPORTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <select
        className="rounded border border-border bg-card px-2 py-1 text-sm"
        value={resultFilter}
        onChange={(e) => onResultChange(e.target.value)}
      >
        <option value="">All Results</option>
        <option value="PENDING">Pending</option>
        <option value="WIN">Win</option>
        <option value="LOSS">Loss</option>
        <option value="PUSH">Push</option>
      </select>
    </div>
  );
}
