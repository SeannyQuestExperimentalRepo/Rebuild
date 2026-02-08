/**
 * Fill NCAAF Weather Gaps — Phase 2
 *
 * Strategy:
 * 1. Dome games → already marked "DOME" in staging
 * 2. Outdoor games → fetch from Open-Meteo Historical Weather API
 * 3. Save updated staging JSON
 *
 * Open-Meteo: Free, no API key, generous rate limits
 * Rate limit: 500ms between requests
 *
 * Usage:
 *   node scripts/fill-ncaaf-weather.js [--start YYYY] [--end YYYY]
 *   Default: all seasons in staging data
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/ncaaf-games-staging.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// ─── Load team venue coordinates from seed data ─────────────────────────────

const seedContent = fs.readFileSync(
  path.join(__dirname, "../prisma/seed-data/ncaaf-teams.ts"),
  "utf8"
);

const teamBlocks = seedContent.match(/\{[^{}]*slug:\s*"[^"]+?"[^{}]*\}/gs) || [];
const TEAM_COORDS = {};

for (const block of teamBlocks) {
  const slug = (block.match(/slug:\s*"([^"]+)"/) || [])[1];
  const lat = parseFloat((block.match(/latitude:\s*([\d.-]+)/) || [])[1]);
  const lon = parseFloat((block.match(/longitude:\s*([\d.-]+)/) || [])[1]);
  const venueType = (block.match(/VenueType\.(\w+)/) || [])[1];

  if (slug && !isNaN(lat) && !isNaN(lon)) {
    TEAM_COORDS[slug] = { lat, lon, venueType };
  }
}

console.log(`Loaded ${Object.keys(TEAM_COORDS).length} team venue coordinates\n`);

// ─── WMO Weather Code → Category ───────────────────────────────────────────

function mapWeatherCode(code) {
  if (code === 0 || code === 1) return "CLEAR";
  if (code === 2 || code === 3) return "CLOUDY";
  if (code >= 45 && code <= 48) return "FOG";
  if (code >= 51 && code <= 67) return "RAIN";
  if (code >= 71 && code <= 77) return "SNOW";
  if (code >= 80 && code <= 82) return "RAIN";
  if (code >= 85 && code <= 86) return "SNOW";
  if (code >= 95 && code <= 99) return "RAIN";
  return "CLEAR";
}

// ─── Open-Meteo Fetch ───────────────────────────────────────────────────────

async function fetchWeather(lat, lon, date, kickoffHour) {
  const url =
    `https://archive-api.open-meteo.com/v1/archive?` +
    `latitude=${lat}&longitude=${lon}` +
    `&start_date=${date}&end_date=${date}` +
    `&hourly=temperature_2m,windspeed_10m,weathercode` +
    `&temperature_unit=fahrenheit&windspeed_unit=mph` +
    `&timezone=America/New_York`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 429) {
        // Rate limited — wait and retry
        console.log("    Rate limited, waiting 5s...");
        await sleep(5000);
        return fetchWeather(lat, lon, date, kickoffHour);
      }
      return null;
    }
    const json = await res.json();

    const hour = Math.min(kickoffHour || 13, 23);
    const temp = json.hourly?.temperature_2m?.[hour];
    const wind = json.hourly?.windspeed_10m?.[hour];
    const code = json.hourly?.weathercode?.[hour];

    if (temp == null) return null;

    return {
      temperature: Math.round(temp * 10) / 10,
      windMph: Math.round(wind * 10) / 10,
      weatherCategory: mapWeatherCode(code),
    };
  } catch (err) {
    return null;
  }
}

function parseKickoffHour(timeStr) {
  if (!timeStr) return 15; // Default 3 PM for college football (most Saturday games)
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 15;
  let hour = parseInt(match[1]);
  const ampm = match[3];
  if (ampm && ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm && ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
  return hour;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Batch Open-Meteo requests (up to 10 locations at once) ─────────────────
// Actually Open-Meteo only supports one location per request for the archive API
// So we'll stick with sequential requests with rate limiting

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  // Parse args
  const args = process.argv.slice(2);
  const startIdx = args.indexOf("--start");
  const endIdx = args.indexOf("--end");
  const startYear = startIdx >= 0 ? parseInt(args[startIdx + 1]) : 0;
  const endYear = endIdx >= 0 ? parseInt(args[endIdx + 1]) : 9999;

  console.log("Filling NCAAF weather gaps...\n");

  // Categorize games
  let alreadyDome = 0;
  let alreadyHasWeather = 0;
  let needsWeather = [];
  let noCoords = 0;
  let nonFBSHome = 0;

  for (let i = 0; i < data.length; i++) {
    const g = data[i];

    // Apply year filter
    if (g.season < startYear || g.season > endYear) continue;

    // Already has weather
    if (g.weatherCategory === "DOME") {
      alreadyDome++;
      continue;
    }
    if (g.weatherCategory && g.weatherCategory !== "DOME") {
      alreadyHasWeather++;
      continue;
    }

    // Need weather — check if we have coords
    if (!g.homeSlug) {
      nonFBSHome++;
      // Non-FBS home teams — use away team coords if available, else default to CLEAR
      if (g.awaySlug && TEAM_COORDS[g.awaySlug]) {
        needsWeather.push({ index: i, slug: g.awaySlug });
      } else {
        data[i].weatherCategory = "CLEAR";
        data[i].temperature = null;
        data[i].windMph = null;
      }
      continue;
    }

    if (!TEAM_COORDS[g.homeSlug]) {
      noCoords++;
      data[i].weatherCategory = "CLEAR";
      continue;
    }

    needsWeather.push({ index: i, slug: g.homeSlug });
  }

  console.log(`Already DOME: ${alreadyDome}`);
  console.log(`Already has weather: ${alreadyHasWeather}`);
  console.log(`Non-FBS home (using away coords): ${nonFBSHome}`);
  console.log(`No coordinates available: ${noCoords}`);
  console.log(`Need Open-Meteo fetch: ${needsWeather.length}\n`);

  if (needsWeather.length === 0) {
    console.log("No weather gaps to fill.");
    return;
  }

  // Estimate time
  const estMinutes = Math.ceil((needsWeather.length * 0.2) / 60);
  console.log(`Estimated time: ~${estMinutes} minutes (200ms between requests)\n`);

  let fetched = 0;
  let failed = 0;
  const startTime = Date.now();

  // Save progress every 500 games
  const SAVE_INTERVAL = 500;

  for (let i = 0; i < needsWeather.length; i++) {
    const { index, slug } = needsWeather[i];
    const game = data[index];
    const coords = TEAM_COORDS[slug];

    const kickoffHour = parseKickoffHour(game.kickoffTime);
    const weather = await fetchWeather(
      coords.lat,
      coords.lon,
      game.gameDate,
      kickoffHour
    );

    if (weather) {
      data[index].temperature = weather.temperature;
      data[index].windMph = weather.windMph;
      data[index].weatherCategory = weather.weatherCategory;

      // Add wind-based override: if wind > 20 mph and not rain/snow, mark as WIND
      if (weather.windMph > 20 && weather.weatherCategory === "CLEAR") {
        data[index].weatherCategory = "WIND";
      }
      if (weather.windMph > 20 && weather.weatherCategory === "CLOUDY") {
        data[index].weatherCategory = "WIND";
      }

      fetched++;
    } else {
      failed++;
      data[index].weatherCategory = "CLEAR"; // Fallback
    }

    // Progress logging
    if ((i + 1) % 100 === 0 || i === needsWeather.length - 1) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = (needsWeather.length - i - 1) / rate;
      console.log(
        `  Progress: ${i + 1}/${needsWeather.length} ` +
        `(${fetched} OK, ${failed} failed) ` +
        `ETA: ${Math.ceil(remaining / 60)}min`
      );
    }

    // Save progress periodically
    if ((i + 1) % SAVE_INTERVAL === 0) {
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      console.log(`  [Checkpoint saved at ${i + 1} games]\n`);
    }

    // Rate limit — Open-Meteo archive is generous, 200ms is safe
    await sleep(200);
  }

  // Final save
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

  console.log("\n═══ WEATHER FILL COMPLETE ═══");
  console.log(`Fetched from API: ${fetched}`);
  console.log(`Failed (defaulted to CLEAR): ${failed}`);

  // Weather category distribution
  const byCat = {};
  for (const g of data) {
    const cat = g.weatherCategory || "MISSING";
    byCat[cat] = (byCat[cat] || 0) + 1;
  }
  console.log("\nWeather category distribution:");
  Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${c}: ${n}`));

  // Check for remaining gaps
  const noWeather = data.filter(
    (g) => g.weatherCategory === null || g.weatherCategory === undefined
  );
  console.log(`\nGames still missing weather: ${noWeather.length}`);

  console.log(`\nUpdated: ${dataPath}`);
}

main().catch(console.error);
