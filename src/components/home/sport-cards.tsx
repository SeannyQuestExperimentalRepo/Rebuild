import Link from "next/link";

interface SportCardData {
  sport: string;
  games: number | undefined;
  years: string;
  href: string;
  available: boolean;
}

const SPORT_ICONS: Record<string, React.ReactNode> = {
  NFL: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 0 1 9 14.437V9.564Z" />
    </svg>
  ),
  NCAAF: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 0 0-.491 6.347A48.62 48.62 0 0 1 12 20.904a48.62 48.62 0 0 1 8.232-4.41 60.46 60.46 0 0 0-.491-6.347m-15.482 0a50.636 50.636 0 0 0-2.658-.813A59.906 59.906 0 0 1 12 3.493a59.903 59.903 0 0 1 10.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0 1 12 13.489a50.702 50.702 0 0 1 7.74-3.342" />
    </svg>
  ),
  NCAAMB: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 0 1-3.77 1.522m0 0a6.003 6.003 0 0 1-3.77-1.522" />
    </svg>
  ),
};

export function SportCards({ cards, totalGames }: { cards: SportCardData[]; totalGames: number | null }) {
  return (
    <section className="relative border-t border-border/40">
      <div className="mx-auto max-w-5xl px-4 py-14">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-gradient-to-r from-border/60 to-transparent" />
          <h2 className="font-mono text-[11px] uppercase tracking-[0.25em] text-muted-foreground">
            Coverage
          </h2>
          <div className="h-px flex-1 bg-gradient-to-l from-border/60 to-transparent" />
        </div>

        <div className="stagger-in grid grid-cols-1 gap-4 sm:grid-cols-3">
          {cards.map((item) => (
            <Link
              key={item.sport}
              href={item.available ? item.href : "#"}
              className={`gradient-border group relative rounded-xl border border-border/50 bg-card/80 p-6 backdrop-blur-sm transition-all duration-300 ${
                item.available
                  ? "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
                  : "pointer-events-none opacity-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    {SPORT_ICONS[item.sport]}
                  </div>
                  <h3 className="font-mono text-sm font-semibold tracking-wide text-foreground">
                    {item.sport}
                  </h3>
                </div>
                {item.available && (
                  <svg
                    className="h-4 w-4 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
                    />
                  </svg>
                )}
              </div>

              <p className="mt-4 font-mono text-3xl font-bold tabular-nums text-primary number-reveal">
                {item.games != null ? item.games.toLocaleString() : "\u2014"}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {item.games != null ? (
                  <>
                    games{" "}
                    <span className="mx-1 text-border">|</span>{" "}
                    <span className="font-mono text-[11px]">{item.years}</span>
                  </>
                ) : (
                  "Loading..."
                )}
              </p>

              {item.available && (
                <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-primary/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                  Explore trends
                </p>
              )}
            </Link>
          ))}
        </div>

        {totalGames != null && (
          <div className="mt-6 flex justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/30 bg-secondary/40 px-4 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
              <span className="font-mono text-xs text-muted-foreground">
                {totalGames.toLocaleString()} total games indexed
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
