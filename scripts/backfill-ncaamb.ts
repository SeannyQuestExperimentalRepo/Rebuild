/**
 * Backfill NCAAMB games for the current season (2025-26)
 *
 * Loops through each day from Nov 1, 2025 to yesterday,
 * calling syncCompletedGames for each date.
 *
 * Usage: npx tsx scripts/backfill-ncaamb.ts [--start YYYY-MM-DD] [--end YYYY-MM-DD] [--sport NFL|NCAAF|NCAAMB]
 */

import { syncCompletedGames, type SyncResult } from "../src/lib/espn-sync";

const args = process.argv.slice(2);

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultVal;
}

// Defaults: current NCAAMB season
const sport = getArg("--sport", "NCAAMB") as "NFL" | "NCAAF" | "NCAAMB";

// Default date range based on sport
let defaultStart: string;
let defaultEnd: string;

const now = new Date();
const yesterday = new Date(now);
yesterday.setDate(yesterday.getDate() - 1);
defaultEnd = yesterday.toISOString().split("T")[0];

if (sport === "NCAAMB") {
  // NCAAMB season: Nov 1 -> April 15
  defaultStart = "2025-11-01";
} else if (sport === "NCAAF") {
  // NCAAF season: Aug 24 -> Jan 15
  defaultStart = "2025-08-24";
} else {
  // NFL season: Sep 4 -> Feb 10
  defaultStart = "2025-09-04";
}

const startDate = getArg("--start", defaultStart);
const endDate = getArg("--end", defaultEnd);

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z"); // noon UTC to avoid timezone issues
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfill() {
  console.log(`\n=== Backfill ${sport} ===`);
  console.log(`Date range: ${startDate} to ${endDate}\n`);

  let currentDate = startDate;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalFetched = 0;
  let daysProcessed = 0;
  let daysWithGames = 0;

  while (currentDate <= endDate) {
    try {
      const result: SyncResult = await syncCompletedGames(sport, currentDate);

      totalFetched += result.fetched;
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
      daysProcessed++;

      if (result.inserted > 0) {
        daysWithGames++;
        console.log(
          `${currentDate}: +${result.inserted} games (${result.fetched} fetched, ${result.skipped} skipped)`
        );
      } else if (result.fetched > 0) {
        // Games found but all skipped (duplicates)
        process.stdout.write("s");
      } else {
        // No games on this date
        process.stdout.write(".");
      }

      // Rate limit: 500ms between ESPN API calls
      await sleep(500);
    } catch (err) {
      console.error(`\n${currentDate}: ERROR -`, err);
      // Continue despite errors
      await sleep(1000);
    }

    currentDate = addDays(currentDate, 1);
  }

  console.log(`\n\n=== Backfill Complete ===`);
  console.log(`Days processed: ${daysProcessed}`);
  console.log(`Days with new games: ${daysWithGames}`);
  console.log(`Total fetched: ${totalFetched}`);
  console.log(`Total inserted: ${totalInserted}`);
  console.log(`Total skipped (duplicates): ${totalSkipped}`);
}

backfill()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
