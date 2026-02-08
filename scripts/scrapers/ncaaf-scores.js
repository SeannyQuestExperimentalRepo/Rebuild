/**
 * NCAAF Score Scraper — Phase 2
 *
 * Source: Sports-Reference.com College Football
 * URL: https://www.sports-reference.com/cfb/years/{year}-schedule.html
 *
 * Scrapes FBS game scores, rankings, bowl names, neutral site flags.
 * Rate limit: 3.5 seconds between requests.
 *
 * Usage:
 *   node scripts/scrapers/ncaaf-scores.js [startYear] [endYear]
 *   Default: 2005-2024
 */

const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

const BASE_URL = "https://www.sports-reference.com/cfb/years";
const USER_AGENT = "TrendLine/1.0 (Sports research project)";
const RATE_LIMIT_MS = 3500;

let lastRequestTime = 0;

async function rateLimitedFetch(url) {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();

  console.log(`  Fetching: ${url}`);
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  return res.text();
}

/**
 * Parse a team cell to extract name, rank, school slug, and FBS status.
 *
 * Patterns:
 * - "(13)&nbsp;<a href='/cfb/schools/notre-dame/2023.html'>Notre Dame</a>"
 * - "<strong>(1)</strong>&nbsp;<a href='...'>Alabama</a>"  (older seasons)
 * - "North Carolina A&T" (non-FBS, no link)
 */
function parseTeamCell($, td) {
  const html = $(td).html() || "";
  const text = $(td).text().trim();

  // Extract rank: (N) pattern
  const rankMatch = html.match(/\((\d+)\)/);
  const rank = rankMatch ? parseInt(rankMatch[1]) : null;

  // Extract school link
  const link = $(td).find("a");
  let name, slug, isFBS;

  if (link.length > 0) {
    name = link.text().trim();
    const href = link.attr("href") || "";
    const slugMatch = href.match(/\/cfb\/schools\/([^/]+)\//);
    slug = slugMatch ? slugMatch[1] : null;
    isFBS = true;
  } else {
    // No link = non-FBS team
    name = text.replace(/\(\d+\)\s*/, "").trim();
    slug = null;
    isFBS = false;
  }

  return { name, rank, slug, isFBS };
}

/**
 * Scrape a single season's schedule page.
 */
async function scrapeSeason(year) {
  const url = `${BASE_URL}/${year}-schedule.html`;
  const html = await rateLimitedFetch(url);
  const $ = cheerio.load(html);

  const games = [];
  const table = $("table#schedule");

  if (table.length === 0) {
    console.error(`  No schedule table found for ${year}`);
    return games;
  }

  // Check if time_game column exists
  const headers = [];
  table.find("thead th").each((i, th) => {
    headers.push($(th).attr("data-stat"));
  });
  const hasTime = headers.includes("time_game");

  // Parse rows
  table.find("tbody tr").each((i, tr) => {
    // Skip repeating header rows
    const firstChild = $(tr).children().first();
    if (firstChild.prop("tagName") === "TH" && firstChild.attr("scope") === "col") {
      return;
    }

    // Extract cells by data-stat
    const getCell = (stat) => $(tr).find(`[data-stat="${stat}"]`);

    const weekCell = getCell("week_number");
    const dateCell = getCell("date_game");
    const timeCell = hasTime ? getCell("time_game") : null;
    const dayCell = getCell("day_name");
    const winnerCell = getCell("winner_school_name");
    const winnerPtsCell = getCell("winner_points");
    const locationCell = getCell("game_location");
    const loserCell = getCell("loser_school_name");
    const loserPtsCell = getCell("loser_points");
    const notesCell = getCell("notes");

    // Parse date — get from csk attribute (ISO format)
    const dateCsk = dateCell.attr("csk") || "";
    const dateStr = dateCsk.match(/\d{4}-\d{2}-\d{2}/) ? dateCsk : null;

    if (!dateStr) return; // Skip if no valid date

    const week = weekCell.text().trim();
    const day = dayCell ? dayCell.text().trim() : "";
    const time = timeCell ? timeCell.text().trim() || null : null;

    // Parse teams
    const winner = parseTeamCell($, winnerCell);
    const loser = parseTeamCell($, loserCell);

    // Scores
    const winnerPts = parseInt(winnerPtsCell.text().trim()) || 0;
    const loserPts = parseInt(loserPtsCell.text().trim()) || 0;

    // Location: empty = winner is home, @ = winner is away, N = neutral
    const location = locationCell.text().trim();
    const isNeutralSite = location === "N";

    // Determine home/away
    let homeTeam, awayTeam, homeScore, awayScore, homeRank, awayRank;
    let homeSlug, awaySlug, homeFBS, awayFBS;

    if (location === "@") {
      // Winner was away team
      homeTeam = loser.name;
      awayTeam = winner.name;
      homeScore = loserPts;
      awayScore = winnerPts;
      homeRank = loser.rank;
      awayRank = winner.rank;
      homeSlug = loser.slug;
      awaySlug = winner.slug;
      homeFBS = loser.isFBS;
      awayFBS = winner.isFBS;
    } else {
      // Winner is home (or neutral — use winner as "home" designation)
      homeTeam = winner.name;
      awayTeam = loser.name;
      homeScore = winnerPts;
      awayScore = loserPts;
      homeRank = winner.rank;
      awayRank = loser.rank;
      homeSlug = winner.slug;
      awaySlug = loser.slug;
      homeFBS = winner.isFBS;
      awayFBS = loser.isFBS;
    }

    // Notes (bowl name)
    // Some seasons (2016-2019) put stadium info in notes instead of bowl names.
    // Real bowl names contain "Bowl", "Championship", "Classic", "Fiesta", etc.
    // Stadium info contains " - " with city/state after the dash.
    const notesText = notesCell.text().trim();
    const isBowlName = notesText !== "" &&
      !notesText.includes(" - ") && // Stadium format: "Name - City, State"
      (
        /bowl|championship|classic|fiesta|sugar|rose|orange|cotton|peach|playoff/i.test(notesText) ||
        /holiday|alamo|gator|liberty|sun |citrus|music city|pinstripe|fenway/i.test(notesText) ||
        /armed forces|military|hawaii|potato|camellia|vegas|ventures/i.test(notesText) ||
        /gasparilla|boca raton|frisco|cure|toastery|la bowl|reliaquest|arizona/i.test(notesText) ||
        /quick lane|responder|texas bowl|mayo|pop-tarts|myrtle|independence/i.test(notesText) ||
        /birmingham|humanitarian|insight|champs|emerald|motor city|outback/i.test(notesText) ||
        /belk|russell|compass|papajohns|international|bahamas|new mexico/i.test(notesText) ||
        /new orleans|godaddy|poinsettia|magicjack|beef o brady/i.test(notesText)
      );
    const isBowlGame = isBowlName;
    const bowlName = isBowlGame ? notesText : null;

    games.push({
      season: year,
      week,
      dayOfWeek: day,
      gameDate: dateStr,
      kickoffTime: time,
      homeTeam,
      awayTeam,
      homeScore,
      awayScore,
      scoreDifference: homeScore - awayScore,
      homeRank,
      awayRank,
      homeSlug,
      awaySlug,
      homeFBS,
      awayFBS,
      isNeutralSite,
      isBowlGame,
      bowlName,
      isPlayoff: false, // Will be set below
      source: "sports-reference.com",
    });
  });

  // ─── Mark CFP / BCS games ────────────────────────────────────────────────
  for (const game of games) {
    if (game.bowlName) {
      const bn = game.bowlName.toLowerCase();
      if (
        bn.includes("college football playoff") ||
        bn.includes("cfp") ||
        bn.includes("national championship") ||
        bn.includes("bcs championship") ||
        bn.includes("bcs national")
      ) {
        game.isPlayoff = true;
      }
    }
  }

  return games;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const startYear = parseInt(process.argv[2]) || 2005;
  const endYear = parseInt(process.argv[3]) || 2024;

  console.log(`\nScraping NCAAF scores: ${startYear}-${endYear}\n`);

  const allGames = [];

  for (let year = startYear; year <= endYear; year++) {
    try {
      const games = await scrapeSeason(year);
      allGames.push(...games);
      console.log(`  Season ${year}: ${games.length} games (total: ${allGames.length})\n`);
    } catch (err) {
      console.error(`  ERROR season ${year}: ${err.message}`);
    }
  }

  // ─── Filter to FBS-only games (at least one FBS team) ─────────────────

  const fbsGames = allGames.filter((g) => g.homeFBS || g.awayFBS);
  const bothFBS = allGames.filter((g) => g.homeFBS && g.awayFBS);
  console.log(`\n═══ SCRAPE COMPLETE ═══`);
  console.log(`Total games scraped: ${allGames.length}`);
  console.log(`Games with at least 1 FBS team: ${fbsGames.length}`);
  console.log(`Games with both FBS teams: ${bothFBS.length}`);

  // ─── Save ─────────────────────────────────────────────────────────────

  const outputDir = path.join(__dirname, "../../data/raw/ncaaf");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, "ncaaf-scores-raw.json");
  fs.writeFileSync(outputPath, JSON.stringify(fbsGames, null, 2));
  console.log(`\nSaved: ${outputPath} (${fbsGames.length} games)`);

  // ─── Stats by season ──────────────────────────────────────────────────

  console.log("\n─── Games per Season ───");
  const bySeason = {};
  for (const g of fbsGames) {
    bySeason[g.season] = (bySeason[g.season] || 0) + 1;
  }
  Object.entries(bySeason)
    .sort(([a], [b]) => a - b)
    .forEach(([s, c]) => console.log(`  ${s}: ${c}`));

  // Bowl games count
  const bowls = fbsGames.filter((g) => g.isBowlGame);
  console.log(`\nBowl games: ${bowls.length}`);
  const playoffs = fbsGames.filter((g) => g.isPlayoff);
  console.log(`Playoff/Championship games: ${playoffs.length}`);

  // Ranked matchups
  const ranked = fbsGames.filter((g) => g.homeRank || g.awayRank);
  const bothRanked = fbsGames.filter((g) => g.homeRank && g.awayRank);
  console.log(`Games with ranked team: ${ranked.length}`);
  console.log(`Ranked vs ranked: ${bothRanked.length}`);
}

main().catch(console.error);
