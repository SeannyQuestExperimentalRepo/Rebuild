/**
 * KenPom Historical Data Importer
 *
 * Pulls team ratings, four factors, and FanMatch data from the KenPom API
 * for all available seasons. Stores as raw JSON for later processing.
 *
 * KenPom API: https://kenpom.com/api.php
 * Auth: Bearer token in Authorization header
 * Rate limit: 1 second between requests (be polite)
 *
 * Usage:
 *   node scripts/scrapers/kenpom-import.js [--start YYYY] [--end YYYY] [--endpoint ratings|four-factors|fanmatch|all]
 *   Default: all endpoints, 2005-2025
 *
 * Note: KenPom year = ending year of season (2025 = 2024-25 season)
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.KENPOM_API_KEY || "";
const BASE_URL = "https://kenpom.com/api.php";
const RATE_LIMIT_MS = 1000; // 1 second between requests

if (!API_KEY) {
  console.error("Error: KENPOM_API_KEY required.");
  console.error("Set via environment variable or .env file.");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchKenPom(params) {
  const url = `${BASE_URL}?${params}`;
  console.log(`  Fetching: ${url}`);

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }

  const text = await res.text();
  if (!text.startsWith("[") && !text.startsWith("{")) {
    throw new Error(`Non-JSON response for ${url}`);
  }

  return JSON.parse(text);
}

// ─── Fetch ratings for all seasons ──────────────────────────────────────────

async function fetchRatings(startYear, endYear) {
  console.log(`\n═══ Fetching Ratings: ${startYear}-${endYear} ═══`);
  const allRatings = [];

  for (let year = startYear; year <= endYear; year++) {
    try {
      const data = await fetchKenPom(`endpoint=ratings&y=${year}`);
      allRatings.push(...data);
      console.log(`  ${year}: ${data.length} teams`);
    } catch (err) {
      console.error(`  ERROR ${year}: ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return allRatings;
}

// ─── Fetch four factors for all seasons ─────────────────────────────────────

async function fetchFourFactors(startYear, endYear) {
  console.log(`\n═══ Fetching Four Factors: ${startYear}-${endYear} ═══`);
  const allFF = [];

  for (let year = startYear; year <= endYear; year++) {
    try {
      const data = await fetchKenPom(`endpoint=four-factors&y=${year}`);
      allFF.push(...data);
      console.log(`  ${year}: ${data.length} teams`);
    } catch (err) {
      console.error(`  ERROR ${year}: ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return allFF;
}

// ─── Fetch misc stats for all seasons ───────────────────────────────────────

async function fetchMiscStats(startYear, endYear) {
  console.log(`\n═══ Fetching Misc Stats: ${startYear}-${endYear} ═══`);
  const allMisc = [];

  for (let year = startYear; year <= endYear; year++) {
    try {
      const data = await fetchKenPom(`endpoint=misc-stats&y=${year}`);
      allMisc.push(...data);
      console.log(`  ${year}: ${data.length} teams`);
    } catch (err) {
      console.error(`  ERROR ${year}: ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return allMisc;
}

// ─── Fetch teams for all seasons ────────────────────────────────────────────

async function fetchTeams(startYear, endYear) {
  console.log(`\n═══ Fetching Teams: ${startYear}-${endYear} ═══`);
  const allTeams = [];

  for (let year = startYear; year <= endYear; year++) {
    try {
      const data = await fetchKenPom(`endpoint=teams&y=${year}`);
      allTeams.push(...data);
      console.log(`  ${year}: ${data.length} teams`);
    } catch (err) {
      console.error(`  ERROR ${year}: ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return allTeams;
}

// ─── Fetch conferences for all seasons ──────────────────────────────────────

async function fetchConferences(startYear, endYear) {
  console.log(`\n═══ Fetching Conferences: ${startYear}-${endYear} ═══`);
  const allConfs = [];

  for (let year = startYear; year <= endYear; year++) {
    try {
      const data = await fetchKenPom(`endpoint=conferences&y=${year}`);
      allConfs.push(...data);
      console.log(`  ${year}: ${data.length} conferences`);
    } catch (err) {
      console.error(`  ERROR ${year}: ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return allConfs;
}

// ─── Fetch conference ratings for all seasons ───────────────────────────────

async function fetchConfRatings(startYear, endYear) {
  console.log(`\n═══ Fetching Conference Ratings: ${startYear}-${endYear} ═══`);
  const allCR = [];

  for (let year = startYear; year <= endYear; year++) {
    try {
      const data = await fetchKenPom(`endpoint=conf-ratings&y=${year}`);
      allCR.push(...data);
      console.log(`  ${year}: ${data.length} conferences`);
    } catch (err) {
      console.error(`  ERROR ${year}: ${err.message}`);
    }
    await sleep(RATE_LIMIT_MS);
  }

  return allCR;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const startIdx = args.indexOf("--start");
  const endIdx = args.indexOf("--end");
  const epIdx = args.indexOf("--endpoint");

  const startYear = startIdx >= 0 ? parseInt(args[startIdx + 1]) : 2005;
  const endYear = endIdx >= 0 ? parseInt(args[endIdx + 1]) : 2025;
  const endpoint = epIdx >= 0 ? args[epIdx + 1] : "all";

  console.log(`KenPom Data Import: ${startYear}-${endYear} (endpoint: ${endpoint})`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);

  // Ensure output directory
  const outputDir = path.join(__dirname, "../../data/raw/kenpom");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const allData = {};

  // ─── Teams & Conferences (reference data) ───────────────────────────
  if (endpoint === "all" || endpoint === "teams") {
    const teams = await fetchTeams(startYear, endYear);
    const teamsPath = path.join(outputDir, "kenpom-teams.json");
    fs.writeFileSync(teamsPath, JSON.stringify(teams, null, 2));
    console.log(`\n  Saved: ${teamsPath} (${teams.length} entries)`);
    allData.teams = teams.length;
  }

  if (endpoint === "all" || endpoint === "conferences") {
    const confs = await fetchConferences(startYear, endYear);
    const confsPath = path.join(outputDir, "kenpom-conferences.json");
    fs.writeFileSync(confsPath, JSON.stringify(confs, null, 2));
    console.log(`\n  Saved: ${confsPath} (${confs.length} entries)`);
    allData.conferences = confs.length;
  }

  // ─── Ratings (the core data) ────────────────────────────────────────
  if (endpoint === "all" || endpoint === "ratings") {
    const ratings = await fetchRatings(startYear, endYear);
    const ratingsPath = path.join(outputDir, "kenpom-ratings.json");
    fs.writeFileSync(ratingsPath, JSON.stringify(ratings, null, 2));
    console.log(`\n  Saved: ${ratingsPath} (${ratings.length} entries)`);
    allData.ratings = ratings.length;
  }

  // ─── Four Factors ───────────────────────────────────────────────────
  if (endpoint === "all" || endpoint === "four-factors") {
    const ff = await fetchFourFactors(startYear, endYear);
    const ffPath = path.join(outputDir, "kenpom-four-factors.json");
    fs.writeFileSync(ffPath, JSON.stringify(ff, null, 2));
    console.log(`\n  Saved: ${ffPath} (${ff.length} entries)`);
    allData.fourFactors = ff.length;
  }

  // ─── Misc Stats ─────────────────────────────────────────────────────
  if (endpoint === "all" || endpoint === "misc-stats") {
    const misc = await fetchMiscStats(startYear, endYear);
    const miscPath = path.join(outputDir, "kenpom-misc-stats.json");
    fs.writeFileSync(miscPath, JSON.stringify(misc, null, 2));
    console.log(`\n  Saved: ${miscPath} (${misc.length} entries)`);
    allData.miscStats = misc.length;
  }

  // ─── Conference Ratings ─────────────────────────────────────────────
  if (endpoint === "all" || endpoint === "conf-ratings") {
    const cr = await fetchConfRatings(startYear, endYear);
    const crPath = path.join(outputDir, "kenpom-conf-ratings.json");
    fs.writeFileSync(crPath, JSON.stringify(cr, null, 2));
    console.log(`\n  Saved: ${crPath} (${cr.length} entries)`);
    allData.confRatings = cr.length;
  }

  // ─── Summary ────────────────────────────────────────────────────────
  console.log("\n═══ KENPOM IMPORT COMPLETE ═══");
  console.log(`Seasons: ${startYear}-${endYear} (${endYear - startYear + 1} seasons)`);
  for (const [key, count] of Object.entries(allData)) {
    console.log(`  ${key}: ${count} entries`);
  }
  console.log(`\nData saved to: ${outputDir}`);
}

main().catch(console.error);
