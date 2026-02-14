#!/usr/bin/env node

/**
 * Backfill isNeutralSite for NCAAMB games from ESPN scoreboard API.
 *
 * Strategy:
 *  1. Get all unique game dates from NCAAMBGame
 *  2. For each date, fetch ESPN scoreboard (includes neutralSite flag)
 *  3. Match ESPN games to DB games by team names + date
 *  4. Batch update isNeutralSite
 *
 * Usage:
 *   node scripts/backfill-neutral-site.js                  # all dates
 *   node scripts/backfill-neutral-site.js --since=2024     # only 2024+ seasons
 *   node scripts/backfill-neutral-site.js --dry-run        # preview without updating
 *
 * Rate limiting: 300ms between ESPN calls (public API, no auth needed).
 * ~3,100 unique dates → ~16 minutes total.
 */

require("dotenv/config");
const { PrismaClient } = require("@prisma/client");

const SCOREBOARD_URL =
  "https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard";
const DELAY_MS = 300;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatDateESPN(d) {
  // ESPN wants YYYYMMDD
  return d.toISOString().split("T")[0].replace(/-/g, "");
}

function formatDateISO(d) {
  return d.toISOString().split("T")[0];
}

async function fetchScoreboard(dateStr) {
  const url = `${SCOREBOARD_URL}?dates=${dateStr}&groups=50&limit=200`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) {
    if (res.status === 429) throw new Error("429");
    throw new Error(`ESPN ${res.status}`);
  }
  return res.json();
}

/**
 * Normalize team name for fuzzy matching.
 * Strips common suffixes, lowercases, removes punctuation.
 */
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[.']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function main() {
  const prisma = new PrismaClient();
  const dryRun = process.argv.includes("--dry-run");
  const sinceArg = process.argv.find((a) => a.startsWith("--since="));
  const sinceSeason = sinceArg ? parseInt(sinceArg.split("=")[1]) : null;

  console.log(`Backfilling isNeutralSite for NCAAMB games${dryRun ? " (DRY RUN)" : ""}`);
  if (sinceSeason) console.log(`Filtering to seasons >= ${sinceSeason}`);

  // Get all unique game dates
  const where = sinceSeason ? { season: { gte: sinceSeason } } : {};
  const games = await prisma.nCAAMBGame.findMany({
    where,
    select: {
      id: true,
      gameDate: true,
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
    orderBy: { gameDate: "asc" },
  });

  // Group games by date
  const gamesByDate = new Map();
  for (const g of games) {
    const dateKey = formatDateISO(g.gameDate);
    if (!gamesByDate.has(dateKey)) gamesByDate.set(dateKey, []);
    gamesByDate.get(dateKey).push(g);
  }

  const dates = [...gamesByDate.keys()].sort();
  console.log(`${games.length} games across ${dates.length} unique dates\n`);

  let totalUpdated = 0;
  let totalNeutral = 0;
  let errors = 0;

  for (let i = 0; i < dates.length; i++) {
    const dateKey = dates[i];
    const dbGames = gamesByDate.get(dateKey);
    const espnDate = dateKey.replace(/-/g, "");

    try {
      const data = await fetchScoreboard(espnDate);
      const events = data.events ?? [];

      // Build lookup: normalized home+away → neutralSite
      const espnMap = new Map();
      for (const event of events) {
        const comp = event.competitions?.[0];
        if (!comp) continue;
        const home = comp.competitors?.find((c) => c.homeAway === "home");
        const away = comp.competitors?.find((c) => c.homeAway === "away");
        if (!home || !away) continue;

        const key = `${normalize(home.team.displayName)}|${normalize(away.team.displayName)}`;
        espnMap.set(key, {
          neutralSite: comp.neutralSite ?? false,
          conferenceGame: comp.conferenceCompetition ?? false,
        });
        // Also store with shortDisplayName for matching
        const key2 = `${normalize(home.team.shortDisplayName)}|${normalize(away.team.shortDisplayName)}`;
        espnMap.set(key2, {
          neutralSite: comp.neutralSite ?? false,
          conferenceGame: comp.conferenceCompetition ?? false,
        });
      }

      // Match DB games to ESPN data
      const updates = [];
      for (const g of dbGames) {
        const homeNorm = normalize(g.homeTeam.name);
        const awayNorm = normalize(g.awayTeam.name);
        const key = `${homeNorm}|${awayNorm}`;

        const match = espnMap.get(key);
        if (match && match.neutralSite) {
          updates.push(g.id);
        }
      }

      if (updates.length > 0 && !dryRun) {
        await prisma.nCAAMBGame.updateMany({
          where: { id: { in: updates } },
          data: { isNeutralSite: true },
        });
      }

      totalUpdated += dbGames.length;
      totalNeutral += updates.length;

      if (updates.length > 0 || (i + 1) % 100 === 0) {
        console.log(
          `  ${dateKey}: ${updates.length} neutral / ${dbGames.length} games (ESPN: ${events.length}) [${i + 1}/${dates.length}]`,
        );
      }
    } catch (err) {
      errors++;
      if (err.message === "429") {
        console.log(`  ${dateKey}: Rate limited, waiting 10s...`);
        await sleep(10000);
        i--; // retry
        continue;
      }
      console.error(`  ${dateKey}: ERROR — ${err.message}`);
    }

    await sleep(DELAY_MS);
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done! Processed ${totalUpdated} games across ${dates.length} dates`);
  console.log(`Neutral site games found: ${totalNeutral}`);
  console.log(`Errors: ${errors}`);

  if (!dryRun) {
    const neutralCount = await prisma.nCAAMBGame.count({ where: { isNeutralSite: true } });
    console.log(`\nDB total isNeutralSite=true: ${neutralCount}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
