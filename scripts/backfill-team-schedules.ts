/**
 * Backfill NCAAMB games using ESPN's team schedule endpoint.
 *
 * Unlike the scoreboard (which returns ~10-40 featured games/day),
 * the team schedule endpoint returns ALL games for a specific team.
 *
 * This script fetches schedules for all NCAAMB teams that have
 * upcoming games in the sidebar, ensuring their season records
 * are complete.
 *
 * Usage: npx tsx scripts/backfill-team-schedules.ts
 */

import { syncTeamSeason, type SyncResult } from "../src/lib/espn-sync";
import { prisma } from "../src/lib/db";

const SEASON = 2026;
const SPORT = "NCAAMB" as const;

// ESPN team IDs for major NCAAMB programs
// Source: https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=500
// We'll fetch team IDs dynamically from ESPN
async function getESPNTeamIds(): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  // Fetch all ESPN teams (paginated)
  for (let page = 1; page <= 8; page++) {
    try {
      const res = await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams?limit=50&page=${page}`,
        { headers: { "User-Agent": "TrendLine/1.0" } }
      );
      if (!res.ok) break;
      const data = await res.json();
      const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? [];
      if (teams.length === 0) break;

      for (const t of teams) {
        const team = t.team;
        map.set(team.displayName, team.id);
        map.set(team.shortDisplayName, team.id);
      }

      console.log(`  Fetched ESPN page ${page}: ${teams.length} teams`);
      await sleep(300);
    } catch {
      break;
    }
  }

  return map;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`\n=== Backfill NCAAMB Team Schedules (Season ${SEASON}) ===\n`);

  // 1. Get all unique NCAAMB teams from upcoming games + existing season games
  const upcoming = await prisma.upcomingGame.findMany({
    where: { sport: SPORT },
    select: { homeTeam: true, awayTeam: true },
  });

  const teamNames = new Set<string>();
  for (const g of upcoming) {
    teamNames.add(g.homeTeam);
    teamNames.add(g.awayTeam);
  }

  // Also add teams from existing 2026 season games to fill gaps
  const seasonTeams = await prisma.nCAAMBGame.findMany({
    where: { season: SEASON },
    select: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    distinct: ["homeTeamId", "awayTeamId"],
  });
  for (const g of seasonTeams) {
    teamNames.add(g.homeTeam.name);
    teamNames.add(g.awayTeam.name);
  }

  console.log(`Found ${teamNames.size} unique teams to sync`);

  // 2. Get ESPN team IDs
  console.log("\nFetching ESPN team directory...");
  const espnIds = await getESPNTeamIds();
  console.log(`  ESPN directory: ${espnIds.size} team names mapped\n`);

  // 3. Match our team names to ESPN IDs
  // Also need the Team table names to ESPN display names
  const dbTeams = await prisma.team.findMany({
    where: { sport: SPORT },
    select: { name: true },
  });

  // Build mapping: our canonical name → ESPN team ID
  const teamToEspnId = new Map<string, string>();

  // Direct matches
  for (const name of teamNames) {
    if (espnIds.has(name)) {
      teamToEspnId.set(name, espnIds.get(name)!);
    }
  }

  // Try with common suffixes/variants
  const SUFFIXES = ["Wildcats", "Tigers", "Bulldogs", "Eagles", "Bears", "Red Storm",
    "Huskies", "Musketeers", "Hoyas", "Blue Demons", "Friars", "Golden Eagles",
    "Pirates", "Bluejays", "Cardinals", "Cyclones", "Crimson Tide"];

  for (const name of teamNames) {
    if (teamToEspnId.has(name)) continue;

    // Try "Name Mascot" pattern
    for (const [espnName, id] of espnIds) {
      if (espnName.startsWith(name + " ") || espnName === name) {
        teamToEspnId.set(name, id);
        break;
      }
    }
  }

  const matched = teamToEspnId.size;
  const unmatched = [...teamNames].filter(n => !teamToEspnId.has(n));
  console.log(`Matched ${matched}/${teamNames.size} teams to ESPN IDs`);
  if (unmatched.length > 0 && unmatched.length <= 20) {
    console.log(`  Unmatched: ${unmatched.join(", ")}`);
  }

  // 4. Sync each team's schedule
  let totalInserted = 0;
  let totalSkipped = 0;
  let teamsProcessed = 0;

  // Deduplicate ESPN IDs (many teams share games)
  const processedIds = new Set<string>();

  for (const [teamName, espnId] of teamToEspnId) {
    if (processedIds.has(espnId)) continue;
    processedIds.add(espnId);

    try {
      const result: SyncResult = await syncTeamSeason(SPORT, espnId, SEASON);
      teamsProcessed++;
      totalInserted += result.inserted;
      totalSkipped += result.skipped;

      if (result.inserted > 0) {
        console.log(`  ${teamName}: +${result.inserted} new games`);
      }

      // Rate limit
      await sleep(400);
    } catch (err) {
      console.error(`  ${teamName}: ERROR -`, err);
    }
  }

  console.log(`\n=== Complete ===`);
  console.log(`Teams processed: ${teamsProcessed}`);
  console.log(`Games inserted: ${totalInserted}`);
  console.log(`Games skipped (dupes): ${totalSkipped}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
