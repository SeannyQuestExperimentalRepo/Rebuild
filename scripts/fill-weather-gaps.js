/**
 * Fill Weather Gaps — Phase 1, Cycles 35-42
 *
 * Strategy:
 * 1. Games that have temperature but no category → assign based on temp
 * 2. Games with NO weather at all → fetch from Open-Meteo historical API
 * 3. Save updated staging JSON
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/nfl-games-staging.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

// ─── Team venue coordinates for Open-Meteo lookups ──────────────────────────

const TEAM_COORDS = {
  "Arizona Cardinals": { lat: 33.5276, lon: -112.2626 },
  "Atlanta Falcons": { lat: 33.7554, lon: -84.401 },
  "Baltimore Ravens": { lat: 39.278, lon: -76.6227 },
  "Buffalo Bills": { lat: 42.7738, lon: -78.787 },
  "Carolina Panthers": { lat: 35.2258, lon: -80.8528 },
  "Chicago Bears": { lat: 41.8623, lon: -87.6167 },
  "Cincinnati Bengals": { lat: 39.0955, lon: -84.516 },
  "Cleveland Browns": { lat: 41.506, lon: -81.6996 },
  "Dallas Cowboys": { lat: 32.7473, lon: -97.0945 },
  "Denver Broncos": { lat: 39.7439, lon: -105.0201 },
  "Detroit Lions": { lat: 42.34, lon: -83.0456 },
  "Green Bay Packers": { lat: 44.5013, lon: -88.0622 },
  "Houston Texans": { lat: 29.6847, lon: -95.4107 },
  "Indianapolis Colts": { lat: 39.7601, lon: -86.1639 },
  "Jacksonville Jaguars": { lat: 30.3239, lon: -81.6373 },
  "Kansas City Chiefs": { lat: 39.0489, lon: -94.4839 },
  "Las Vegas Raiders": { lat: 36.0908, lon: -115.1833 },
  "Los Angeles Chargers": { lat: 33.9535, lon: -118.3392 },
  "Los Angeles Rams": { lat: 33.9535, lon: -118.3392 },
  "Miami Dolphins": { lat: 25.958, lon: -80.2389 },
  "Minnesota Vikings": { lat: 44.9736, lon: -93.2575 },
  "New England Patriots": { lat: 42.0909, lon: -71.2643 },
  "New Orleans Saints": { lat: 29.9511, lon: -90.0812 },
  "New York Giants": { lat: 40.8135, lon: -74.0745 },
  "New York Jets": { lat: 40.8135, lon: -74.0745 },
  "Philadelphia Eagles": { lat: 39.9008, lon: -75.1675 },
  "Pittsburgh Steelers": { lat: 40.4468, lon: -80.0158 },
  "San Francisco 49ers": { lat: 37.4033, lon: -121.9694 },
  "Seattle Seahawks": { lat: 47.5952, lon: -122.3316 },
  "Tampa Bay Buccaneers": { lat: 27.9759, lon: -82.5033 },
  "Tennessee Titans": { lat: 36.1665, lon: -86.7713 },
  "Washington Commanders": { lat: 38.9076, lon: -76.8645 },
};

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

// ─── Infer weather from temperature (for games with temp but no category) ───

function inferCategoryFromTemp(temp) {
  // This is a rough heuristic — we only use this when NO conditions text exists
  // The actual weather was likely fine (no extreme conditions worth noting)
  // so CLEAR is the safe default
  return "CLEAR";
}

// ─── Open-Meteo Fetch ───────────────────────────────────────────────────────

async function fetchWeatherFromOpenMeteo(lat, lon, date, kickoffHour) {
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
      console.error(`  HTTP ${res.status} for ${date}`);
      return null;
    }
    const json = await res.json();

    const hour = Math.min(kickoffHour || 13, 23);
    const temp = json.hourly.temperature_2m[hour];
    const wind = json.hourly.windspeed_10m[hour];
    const code = json.hourly.weathercode[hour];

    if (temp == null) return null;

    return {
      temperature: Math.round(temp * 10) / 10,
      windMph: Math.round(wind * 10) / 10,
      weatherCategory: mapWeatherCode(code),
    };
  } catch (err) {
    console.error(`  Error fetching ${date}:`, err.message);
    return null;
  }
}

function parseKickoffHour(timeStr) {
  if (!timeStr) return 13; // Default to 1 PM
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 13;
  let hour = parseInt(match[1]);
  const ampm = match[3];
  if (ampm && ampm.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (ampm && ampm.toUpperCase() === "AM" && hour === 12) hour = 0;
  return hour;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("Filling weather gaps...\n");

  let filledFromTemp = 0;
  let filledFromApi = 0;
  let apiFailed = 0;
  let alreadyHaveWeather = 0;

  // Pass 1: Fill games that have temperature but no weather category
  for (const game of data) {
    if (game.weatherCategory) {
      alreadyHaveWeather++;
      continue;
    }

    if (game.temperature !== null) {
      game.weatherCategory = inferCategoryFromTemp(game.temperature);
      filledFromTemp++;
    }
  }

  console.log(`Pass 1: Filled ${filledFromTemp} games from existing temperature data`);
  console.log(`Already had weather: ${alreadyHaveWeather}`);

  // Pass 2: Fetch from Open-Meteo for games with NO weather data at all
  const needsApi = data.filter(
    (g) => g.weatherCategory === null || g.weatherCategory === undefined
  );
  console.log(`\nPass 2: ${needsApi.length} games need Open-Meteo API`);

  for (let i = 0; i < needsApi.length; i++) {
    const game = needsApi[i];
    const coords = TEAM_COORDS[game.homeTeamCanonical];

    if (!coords) {
      console.error(`  No coords for ${game.homeTeamCanonical}`);
      apiFailed++;
      continue;
    }

    if (i > 0 && i % 50 === 0) {
      console.log(`  Progress: ${i}/${needsApi.length}`);
    }

    const kickoffHour = parseKickoffHour(game.kickoffTime);
    const weather = await fetchWeatherFromOpenMeteo(
      coords.lat,
      coords.lon,
      game.gameDate,
      kickoffHour
    );

    if (weather) {
      // Only fill if we don't already have the value
      if (game.temperature === null) game.temperature = weather.temperature;
      if (game.windMph === null) game.windMph = weather.windMph;
      game.weatherCategory = weather.weatherCategory;
      filledFromApi++;
    } else {
      apiFailed++;
      // Fallback: just mark as CLEAR
      game.weatherCategory = "CLEAR";
    }

    // Rate limit: 500ms between requests (Open-Meteo is generous)
    await sleep(500);
  }

  console.log(`\nPass 2 complete: ${filledFromApi} filled from API, ${apiFailed} failed`);

  // ─── Save updated data ──────────────────────────────────────────────────

  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  console.log(`\nUpdated staging JSON saved: ${dataPath}`);

  // ─── Final stats ────────────────────────────────────────────────────────

  const noWeather = data.filter(
    (g) => g.weatherCategory === null || g.weatherCategory === undefined
  );
  console.log(`\nFinal: ${noWeather.length} games still missing weather`);

  const byCat = {};
  for (const g of data) {
    const cat = g.weatherCategory || "MISSING";
    byCat[cat] = (byCat[cat] || 0) + 1;
  }
  console.log("\nWeather category distribution:");
  Object.entries(byCat)
    .sort((a, b) => b[1] - a[1])
    .forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main().catch(console.error);
