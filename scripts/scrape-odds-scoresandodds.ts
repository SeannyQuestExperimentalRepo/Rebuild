/**
 * Scrape NCAAMB closing spreads & O/U from ScoresAndOdds.com
 *
 * ScoresAndOdds serves server-side rendered HTML with well-structured
 * data attributes. No headless browser needed — just HTTP + HTML parsing.
 *
 * Each game card has:
 *   - data-field="live-spread" with data-value (e.g., "+6.5", "-3.5")
 *   - data-field="live-total" with data-value (e.g., "o149.5", "u149.5")
 *   - data-side="home"/"away" on rows
 *   - Team names in <a aria-label="TeamName">
 *   - Scores in .event-card-score cells
 *   - data-live="3" = FINAL
 *
 * Usage:
 *   npx tsx scripts/scrape-odds-scoresandodds.ts [--start 2025-11-04] [--end 2026-02-08] [--dry-run]
 *
 * Rate limit: 2 seconds between requests (be respectful)
 */

import { prisma } from "../src/lib/db";
import {
  calculateSpreadResult,
  calculateOUResult,
} from "../src/lib/espn-sync";

// ─── CLI Args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");

function getArg(flag: string, defaultVal: string): string {
  const idx = args.indexOf(flag);
  if (idx !== -1 && args[idx + 1]) return args[idx + 1];
  return defaultVal;
}

// Default: Nov 4, 2025 (NCAAMB season start) to yesterday
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);

const START_DATE = getArg("--start", "2025-11-04");
const END_DATE = getArg("--end", yesterday.toISOString().split("T")[0]);

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScrapedGame {
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  homeSpread: number | null;
  overUnder: number | null;
  isFinal: boolean;
}

// ─── HTML Parsing ──────────────────────────────────────────────────────────

function parseGamesFromHTML(html: string, dateStr: string): ScrapedGame[] {
  const games: ScrapedGame[] = [];

  // Find all event card IDs
  const cardIdRegex = /id="ncaab\.(\d+)"[^>]*class="event-card"[^>]*data-live="(\d+)"/g;
  let cardMatch;

  while ((cardMatch = cardIdRegex.exec(html)) !== null) {
    const eventId = cardMatch[1];
    const liveStatus = cardMatch[2];
    const isFinal = liveStatus === "3";

    if (!isFinal) continue; // Only process completed games

    // Extract the section of HTML for this card (up to next card or end)
    const cardStart = cardMatch.index;
    const nextCard = html.indexOf('class="event-card"', cardStart + 50);
    const cardHTML = html.substring(
      cardStart,
      nextCard > 0 ? nextCard : cardStart + 5000,
    );

    // Parse away row (data-side="away")
    const awayRow = extractRow(cardHTML, "away");
    // Parse home row (data-side="home")
    const homeRow = extractRow(cardHTML, "home");

    if (!awayRow || !homeRow) continue;

    games.push({
      date: dateStr,
      homeTeam: homeRow.teamName,
      awayTeam: awayRow.teamName,
      homeScore: homeRow.score,
      awayScore: awayRow.score,
      homeSpread: homeRow.spread, // Spread is from each team's perspective on the page, we want home
      overUnder: homeRow.total ?? awayRow.total,
      isFinal,
    });
  }

  return games;
}

function extractRow(
  cardHTML: string,
  side: "home" | "away",
): {
  teamName: string;
  score: number | null;
  spread: number | null;
  total: number | null;
} | null {
  // Find the row for this side
  const rowRegex = new RegExp(
    `<tr[^>]*class="event-card-row[^"]*"[^>]*data-side="${side}"[^>]*>([\\s\\S]*?)</tr>`,
  );
  const rowMatch = rowRegex.exec(cardHTML);
  if (!rowMatch) return null;
  const rowHTML = rowMatch[1];

  // Extract team name from aria-label
  const nameMatch = /aria-label="([^"]+)"/.exec(rowHTML);
  const teamName = nameMatch?.[1] ?? "";

  // Extract score
  const scoreMatch = /class="event-card-score[^"]*"[^>]*>\s*(\d+)\s*</.exec(
    rowHTML,
  );
  const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

  // Extract spread value
  const spreadMatch =
    /data-field="live-spread"[^>]*>[\s\S]*?<span[^>]*class="data-value"[^>]*>\s*([+-]?\d+\.?\d*)\s*</.exec(
      rowHTML,
    );
  const spread = spreadMatch ? parseFloat(spreadMatch[1]) : null;

  // Extract total value (over/under)
  const totalMatch =
    /data-field="live-total"[^>]*>[\s\S]*?<span[^>]*class="data-value"[^>]*>\s*[ou](\d+\.?\d*)\s*</.exec(
      rowHTML,
    );
  const total = totalMatch ? parseFloat(totalMatch[1]) : null;

  return { teamName, score, spread, total };
}

// ─── Team Name Matching ────────────────────────────────────────────────────

/**
 * Map ScoresAndOdds team names → DB canonical names.
 *
 * ScoresAndOdds uses "State" (full word) while our DB uses "St." (abbreviated).
 * They also use different names for many teams (UConn vs Connecticut, etc.).
 *
 * IMPORTANT: We use a strict map-first approach to avoid false positives.
 * "Alabama State" must NOT match "Alabama" — they are different schools.
 */
const SCRAPED_NAME_MAP: Record<string, string> = {
  // ── Completely different names ──
  UConn: "Connecticut",
  "Ole Miss": "Mississippi",
  UMass: "Massachusetts",
  UIC: "Illinois Chicago",
  FDU: "Fairleigh Dickinson",
  "Florida International": "FIU",

  // ── Abbreviation / format differences ──
  "Cal State Northridge": "CSUN",
  "California Baptist": "Cal Baptist",
  "North Carolina State": "N.C. State",
  Omaha: "Nebraska Omaha",
  "Southern University": "Southern",
  "Loyola Maryland": "Loyola MD",
  "Queens University": "Queens (NC)",
  "Sam Houston": "Sam Houston St.",
  "Nicholls State": "Nicholls",
  "University at Albany": "Albany",
  "SIU Edwardsville": "SIU Edwardsville",
  "Tarleton State": "Tarleton St.",

  // ── "St." vs "Saint" prefix ──
  "St. Bonaventure": "Saint Bonaventure",
  "St. Francis (PA)": "Saint Francis",

  // ── Hyphenated names ──
  "Arkansas-Pine Bluff": "Arkansas Pine Bluff",
  "Bethune-Cookman": "Bethune Cookman",
  "Gardner-Webb": "Gardner Webb",
  "Louisiana-Monroe": "Louisiana Monroe",
  "Maryland-Eastern Shore": "Maryland Eastern Shore",
  "Tennessee-Martin": "Tennessee Martin",
  "Texas A&M-Corpus Christi": "Texas A&M Corpus Chris",

  // ── "Cal State" vs "Cal St." ──
  "Cal State Bakersfield": "Cal St. Bakersfield",
  "Cal State Fullerton": "Cal St. Fullerton",

  // ── Hawaiian apostrophe ──
  "Hawai\u2019i": "Hawaii",

  // ── "X State" → "X St." (ScoresAndOdds uses full "State", DB uses "St.") ──
  "Alabama State": "Alabama St.",
  "Alcorn State": "Alcorn St.",
  "Appalachian State": "Appalachian St.",
  "Arizona State": "Arizona St.",
  "Arkansas State": "Arkansas St.",
  "Ball State": "Ball St.",
  "Boise State": "Boise St.",
  "Chicago State": "Chicago St.",
  "Cleveland State": "Cleveland St.",
  "Colorado State": "Colorado St.",
  "Coppin State": "Coppin St.",
  "Delaware State": "Delaware St.",
  "East Tennessee State": "East Tennessee St.",
  "Florida State": "Florida St.",
  "Fresno State": "Fresno St.",
  "Georgia State": "Georgia St.",
  "Grambling State": "Grambling St.",
  "Idaho State": "Idaho St.",
  "Illinois State": "Illinois St.",
  "Indiana State": "Indiana St.",
  "Iowa State": "Iowa St.",
  "Jackson State": "Jackson St.",
  "Jacksonville State": "Jacksonville St.",
  "Kansas State": "Kansas St.",
  "Kennesaw State": "Kennesaw St.",
  "Kent State": "Kent St.",
  "Long Beach State": "Long Beach St.",
  "Michigan State": "Michigan St.",
  "Mississippi State": "Mississippi St.",
  "Mississippi Valley State": "Mississippi Valley St.",
  "Missouri State": "Missouri St.",
  "Montana State": "Montana St.",
  "Morehead State": "Morehead St.",
  "Morgan State": "Morgan St.",
  "Murray State": "Murray St.",
  "New Mexico State": "New Mexico St.",
  "Norfolk State": "Norfolk St.",
  "North Dakota State": "North Dakota St.",
  "Northwestern State": "Northwestern St.",
  "Ohio State": "Ohio St.",
  "Oklahoma State": "Oklahoma St.",
  "Oregon State": "Oregon St.",
  "Penn State": "Penn St.",
  "Portland State": "Portland St.",
  "Sacramento State": "Sacramento St.",
  "San Diego State": "San Diego St.",
  "San Jose State": "San Jose St.",
  "South Carolina State": "South Carolina St.",
  "South Dakota State": "South Dakota St.",
  "Southeast Missouri State": "Southeast Missouri St.",
  "Tennessee State": "Tennessee St.",
  "Texas State": "Texas St.",
  "Utah State": "Utah St.",
  "Washington State": "Washington St.",
  "Weber State": "Weber St.",
  "Wichita State": "Wichita St.",
  "Winston-Salem State": "Winston Salem St.",
  "Wright State": "Wright St.",
  "Youngstown State": "Youngstown St.",
};

/**
 * Resolve a scraped team name to the DB canonical name.
 * Checks the explicit map first, then returns as-is.
 */
function resolveScrapedName(name: string): string {
  return SCRAPED_NAME_MAP[name] ?? name;
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'\u2019'()\-]/g, "") // Strip periods, quotes, parens, AND hyphens
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Match a single scraped team name against a DB team name.
 * Uses strict matching after SCRAPED_NAME_MAP resolution.
 *
 * IMPORTANT: No substring matching — that causes false positives
 * (e.g., "Alabama State" must NOT match "Alabama").
 */
function matchSingleTeam(scrapedName: string, dbName: string): boolean {
  const s = normalize(resolveScrapedName(scrapedName));
  const d = normalize(dbName);

  // Exact match after normalization
  if (s === d) return true;

  // "st" ↔ "state" expansion (end of string)
  const sExpanded = s.replace(/ st$/, " state");
  const dExpanded = d.replace(/ st$/, " state");
  if (sExpanded === dExpanded) return true;

  // "st" ↔ "state" expansion (mid-string)
  const sMid = s.replace(/ st /g, " state ");
  const dMid = d.replace(/ st /g, " state ");
  if (sMid === dMid) return true;

  // "saint" ↔ "st" prefix
  const sWithSaint = s.replace(/^st /, "saint ");
  const dWithSaint = d.replace(/^st /, "saint ");
  if (sWithSaint === dWithSaint) return true;

  // Remove all spaces (e.g., "nc state" → "ncstate")
  if (s.replace(/ /g, "") === d.replace(/ /g, "")) return true;

  return false;
}

/**
 * Try to match a scraped game to a DB game by team names.
 * Both home AND away must match for a valid match.
 */
function matchTeams(
  scrapedHome: string,
  scrapedAway: string,
  dbHome: string,
  dbAway: string,
): boolean {
  return (
    matchSingleTeam(scrapedHome, dbHome) &&
    matchSingleTeam(scrapedAway, dbAway)
  );
}

// ─── Fetching ──────────────────────────────────────────────────────────────

async function fetchPage(date: string): Promise<string> {
  const url = `https://www.scoresandodds.com/ncaab?date=${date}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== Scrape NCAAMB Odds from ScoresAndOdds.com ===`);
  console.log(`Date range: ${START_DATE} to ${END_DATE}`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // Load DB games needing odds
  const dbGames = await prisma.nCAAMBGame.findMany({
    where: {
      season: 2026,
      spread: null,
      homeScore: { not: null },
      awayScore: { not: null },
    },
    include: {
      homeTeam: { select: { name: true } },
      awayTeam: { select: { name: true } },
    },
  });

  console.log(`${dbGames.length} DB games need spread/O-U data\n`);

  // Index by date for fast lookup
  const dbByDate = new Map<
    string,
    typeof dbGames
  >();
  for (const g of dbGames) {
    if (!g.gameDate) continue;
    const d = g.gameDate.toISOString().split("T")[0];
    if (!dbByDate.has(d)) dbByDate.set(d, []);
    dbByDate.get(d)!.push(g);
  }

  let totalScraped = 0;
  let totalMatched = 0;
  let totalUpdated = 0;
  let totalNoMatch = 0;
  let daysProcessed = 0;
  let daysWithGames = 0;

  let currentDate = START_DATE;

  while (currentDate <= END_DATE) {
    // Check if we have any DB games on this date that need odds
    const dbGamesOnDate = dbByDate.get(currentDate);
    if (!dbGamesOnDate || dbGamesOnDate.length === 0) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    daysProcessed++;

    try {
      const html = await fetchPage(currentDate);
      const scraped = parseGamesFromHTML(html, currentDate);
      totalScraped += scraped.length;

      if (scraped.length > 0) {
        daysWithGames++;
      }

      // Match and update
      let dayMatched = 0;
      let dayUpdated = 0;

      for (const dbGame of dbGamesOnDate) {
        const home = dbGame.homeTeam.name;
        const away = dbGame.awayTeam.name;

        // Find matching scraped game
        const match = scraped.find((sg) =>
          matchTeams(sg.homeTeam, sg.awayTeam, home, away),
        );

        if (!match || (match.homeSpread === null && match.overUnder === null)) {
          totalNoMatch++;
          continue;
        }

        dayMatched++;
        totalMatched++;

        // The scraped spread is from the home team perspective
        const spread = match.homeSpread;
        const overUnder = match.overUnder;

        const spreadResult = calculateSpreadResult(
          dbGame.homeScore!,
          dbGame.awayScore!,
          spread,
        );
        const ouResult = calculateOUResult(
          dbGame.homeScore!,
          dbGame.awayScore!,
          overUnder,
        );

        if (DRY_RUN) {
          console.log(
            `  [DRY] ${away} @ ${home}: spread=${spread}, O/U=${overUnder} → ${spreadResult}/${ouResult}`,
          );
        } else {
          await prisma.nCAAMBGame.update({
            where: { id: dbGame.id },
            data: {
              spread,
              overUnder,
              spreadResult,
              ouResult,
            },
          });
        }
        dayUpdated++;
        totalUpdated++;
      }

      if (dayMatched > 0) {
        console.log(
          `${currentDate}: scraped ${scraped.length} games, matched ${dayMatched}, updated ${dayUpdated}`,
        );
      } else {
        process.stdout.write(".");
      }

      // Rate limit: 2 seconds between requests
      await sleep(2000);
    } catch (err) {
      console.error(`\n${currentDate}: ERROR -`, err);
      await sleep(3000);
    }

    currentDate = addDays(currentDate, 1);
  }

  console.log(`\n\n=== Scrape Complete ===`);
  console.log(`Days processed: ${daysProcessed}`);
  console.log(`Days with games: ${daysWithGames}`);
  console.log(`Total scraped from website: ${totalScraped}`);
  console.log(`Matched to DB games: ${totalMatched}`);
  console.log(`Updated with odds: ${totalUpdated}`);
  console.log(`No match found: ${totalNoMatch}`);
  console.log(
    `Remaining games without odds: ${dbGames.length - totalUpdated}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
