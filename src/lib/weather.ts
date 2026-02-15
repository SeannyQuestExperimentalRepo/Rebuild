import "server-only";

import { prisma } from "./db";
import type { Sport } from "@prisma/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WeatherData {
  temperatureF: number | null;
  windSpeedMph: number | null;
  windGustMph: number | null;
  precipitationIn: number | null;
  humidityPct: number | null;
  conditions: string | null;
}

export interface SignalResult {
  category: string;
  direction: "home" | "away" | "over" | "under" | "neutral";
  magnitude: number; // 0-10
  confidence: number; // 0-1
  label: string;
  strength: "strong" | "moderate" | "weak" | "noise";
}

interface FetchResult {
  fetched: number;
  skipped: number;
  errors: number;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FORECAST_BASE = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE_BASE = "https://archive-api.open-meteo.com/v1/archive";

const HOURLY_PARAMS = [
  "temperature_2m",
  "wind_speed_10m",
  "wind_gusts_10m",
  "precipitation",
  "relative_humidity_2m",
].join(",");

const UNIT_PARAMS =
  "temperature_unit=fahrenheit&wind_speed_unit=mph&precipitation_unit=inch&timezone=America/New_York";

/** Default kickoff hour (1 PM ET) when not specified */
const DEFAULT_KICKOFF_HOUR = 13;

// ─── Helpers ────────────────────────────────────────────────────────────────

function deriveConditions(
  temperatureF: number | null,
  precipitationIn: number | null,
  windSpeedMph: number | null,
): string {
  if (
    temperatureF !== null &&
    temperatureF < 35 &&
    precipitationIn !== null &&
    precipitationIn > 0
  ) {
    return "Snow";
  }
  if (precipitationIn !== null && precipitationIn > 0.1) {
    return "Rain";
  }
  if (windSpeedMph !== null && windSpeedMph > 20) {
    return "Windy";
  }
  return "Clear";
}

/**
 * Determine whether a date is in the past (needs archive API) or future (forecast API).
 * Dates more than 7 days in the future are also handled by the forecast API.
 */
function isPastDate(dateStr: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  return target < today;
}

/**
 * Extract the value at a given hour index from the Open-Meteo hourly arrays.
 * Falls back to null if the index is out of range or data is missing.
 */
function extractHourlyValue(
  hourlyData: Record<string, number[]> | undefined,
  field: string,
  hourIndex: number,
): number | null {
  if (!hourlyData || !hourlyData[field]) return null;
  const arr = hourlyData[field];
  if (hourIndex < 0 || hourIndex >= arr.length) return null;
  const val = arr[hourIndex];
  return val !== undefined && val !== null ? val : null;
}

// ─── Core: Fetch weather for a single game ──────────────────────────────────

/**
 * Fetch weather data for a specific game location and time from Open-Meteo.
 *
 * @param sport - Sport identifier (used for logging)
 * @param gameDate - Date string in YYYY-MM-DD format
 * @param homeTeam - Home team name (used for logging)
 * @param lat - Venue latitude
 * @param lon - Venue longitude
 * @param kickoffHour - Hour of kickoff in ET (0-23), defaults to 13 (1 PM)
 */
export async function getGameWeather(
  sport: string,
  gameDate: string,
  homeTeam: string,
  lat: number,
  lon: number,
  kickoffHour?: number,
): Promise<WeatherData> {
  const hour = kickoffHour ?? DEFAULT_KICKOFF_HOUR;
  const usePast = isPastDate(gameDate);
  const baseUrl = usePast ? ARCHIVE_BASE : FORECAST_BASE;

  // Build URL
  const dateParams = usePast
    ? `start_date=${gameDate}&end_date=${gameDate}`
    : "";
  const url = [
    `${baseUrl}?latitude=${lat}&longitude=${lon}`,
    `hourly=${HOURLY_PARAMS}`,
    UNIT_PARAMS,
    dateParams,
  ]
    .filter(Boolean)
    .join("&");

  console.log(
    `[weather] Fetching ${usePast ? "archive" : "forecast"} for ${sport} ${homeTeam} on ${gameDate} (hour=${hour})`,
  );

  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    console.log(
      `[weather] Open-Meteo API error ${res.status}: ${text.slice(0, 200)}`,
    );
    return {
      temperatureF: null,
      windSpeedMph: null,
      windGustMph: null,
      precipitationIn: null,
      humidityPct: null,
      conditions: null,
    };
  }

  const data = await res.json();
  const hourly = data.hourly as Record<string, number[]> | undefined;

  const temperatureF = extractHourlyValue(hourly, "temperature_2m", hour);
  const windSpeedMph = extractHourlyValue(hourly, "wind_speed_10m", hour);
  const windGustMph = extractHourlyValue(hourly, "wind_gusts_10m", hour);
  const precipitationIn = extractHourlyValue(hourly, "precipitation", hour);
  const humidityRaw = extractHourlyValue(hourly, "relative_humidity_2m", hour);
  const humidityPct =
    humidityRaw !== null ? Math.round(humidityRaw) : null;

  const conditions = deriveConditions(temperatureF, precipitationIn, windSpeedMph);

  console.log(
    `[weather] ${homeTeam}: ${temperatureF}°F, wind ${windSpeedMph}mph (gusts ${windGustMph}), precip ${precipitationIn}in, ${conditions}`,
  );

  return {
    temperatureF,
    windSpeedMph,
    windGustMph,
    precipitationIn,
    humidityPct,
    conditions,
  };
}

// ─── Batch: Fetch weather for all upcoming NFL/NCAAF outdoor games ──────────

/**
 * Fetches weather for all upcoming NFL and NCAAF outdoor games.
 *
 * Queries the UpcomingGame table, looks up venue coordinates and dome status
 * from the Team table, skips dome venues, fetches weather from Open-Meteo,
 * and upserts results into the GameWeather table.
 */
export async function fetchWeatherForUpcomingGames(): Promise<FetchResult> {
  const result: FetchResult = { fetched: 0, skipped: 0, errors: 0 };

  // Get upcoming NFL/NCAAF games
  const upcomingGames = await prisma.upcomingGame.findMany({
    where: {
      sport: { in: ["NFL", "NCAAF"] },
      gameDate: { gte: new Date() },
    },
    orderBy: { gameDate: "asc" },
  });

  console.log(
    `[weather] Found ${upcomingGames.length} upcoming NFL/NCAAF games`,
  );

  for (const game of upcomingGames) {
    try {
      // Look up home team for venue info
      const team = await prisma.team.findFirst({
        where: {
          sport: game.sport,
          name: game.homeTeam,
        },
        select: {
          name: true,
          venueType: true,
          latitude: true,
          longitude: true,
        },
      });

      if (!team) {
        console.log(
          `[weather] Team not found: ${game.sport} ${game.homeTeam}, skipping`,
        );
        result.skipped++;
        continue;
      }

      // Skip dome venues
      if (team.venueType === "DOME") {
        console.log(`[weather] Dome venue for ${team.name}, recording as dome`);
        await prisma.gameWeather.upsert({
          where: {
            sport_gameDate_homeTeam_awayTeam: {
              sport: game.sport,
              gameDate: game.gameDate,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
            },
          },
          create: {
            sport: game.sport,
            gameDate: game.gameDate,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            isDome: true,
            conditions: "Dome",
          },
          update: {
            isDome: true,
            conditions: "Dome",
            fetchedAt: new Date(),
          },
        });
        result.skipped++;
        continue;
      }

      // Skip retractable roofs (treat as dome for weather purposes)
      if (team.venueType === "RETRACTABLE") {
        console.log(
          `[weather] Retractable roof for ${team.name}, recording as dome`,
        );
        await prisma.gameWeather.upsert({
          where: {
            sport_gameDate_homeTeam_awayTeam: {
              sport: game.sport,
              gameDate: game.gameDate,
              homeTeam: game.homeTeam,
              awayTeam: game.awayTeam,
            },
          },
          create: {
            sport: game.sport,
            gameDate: game.gameDate,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            isDome: true,
            conditions: "Retractable Roof",
          },
          update: {
            isDome: true,
            conditions: "Retractable Roof",
            fetchedAt: new Date(),
          },
        });
        result.skipped++;
        continue;
      }

      // Need coordinates to fetch weather
      if (team.latitude === null || team.longitude === null) {
        console.log(
          `[weather] No coordinates for ${team.name}, skipping`,
        );
        result.skipped++;
        continue;
      }

      // Format game date as YYYY-MM-DD
      const dateStr = game.gameDate.toISOString().slice(0, 10);

      // Parse kickoff hour from game time if available
      // UpcomingGame doesn't have a kickoffTime field, so use default
      const kickoffHour = DEFAULT_KICKOFF_HOUR;

      const weather = await getGameWeather(
        game.sport,
        dateStr,
        game.homeTeam,
        team.latitude,
        team.longitude,
        kickoffHour,
      );

      // Upsert into GameWeather
      await prisma.gameWeather.upsert({
        where: {
          sport_gameDate_homeTeam_awayTeam: {
            sport: game.sport,
            gameDate: game.gameDate,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
          },
        },
        create: {
          sport: game.sport,
          gameDate: game.gameDate,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          temperatureF: weather.temperatureF,
          windSpeedMph: weather.windSpeedMph,
          windGustMph: weather.windGustMph,
          precipitationIn: weather.precipitationIn,
          humidityPct: weather.humidityPct,
          conditions: weather.conditions,
          isDome: false,
        },
        update: {
          temperatureF: weather.temperatureF,
          windSpeedMph: weather.windSpeedMph,
          windGustMph: weather.windGustMph,
          precipitationIn: weather.precipitationIn,
          humidityPct: weather.humidityPct,
          conditions: weather.conditions,
          isDome: false,
          fetchedAt: new Date(),
        },
      });

      result.fetched++;

      // Brief delay to respect rate limits (~100 req/min)
      await new Promise((r) => setTimeout(r, 650));
    } catch (err) {
      console.log(
        `[weather] Error fetching weather for ${game.sport} ${game.homeTeam} vs ${game.awayTeam}: ${err}`,
      );
      result.errors++;
    }
  }

  console.log(
    `[weather] Done: ${result.fetched} fetched, ${result.skipped} skipped, ${result.errors} errors`,
  );
  return result;
}

// ─── Pick Engine Signal ─────────────────────────────────────────────────────

/**
 * Weather impact signal for the pick engine.
 *
 * Looks up stored GameWeather data and returns a signal indicating how
 * weather conditions are expected to affect scoring.
 *
 * Weather impact rules:
 * - Wind > 30mph: magnitude 8-10, direction "under"
 * - Wind > 20mph: magnitude 5-8, direction "under"
 * - Temp < 20°F: magnitude 4-6, direction "under"
 * - Precip > 0.2in: magnitude 3-5, direction "under"
 * - Snow (temp < 35 + precip): magnitude 6-8, direction "under"
 * - Clear/mild: neutral, magnitude 0-1
 */
export async function signalWeather(
  sport: string,
  gameDate: string,
  homeTeam: string,
  awayTeam: string,
): Promise<SignalResult> {
  const neutral: SignalResult = {
    category: "weather",
    direction: "neutral",
    magnitude: 0,
    confidence: 0,
    label: "No weather data",
    strength: "noise",
  };

  // Look up weather record
  const gw = await prisma.gameWeather.findUnique({
    where: {
      sport_gameDate_homeTeam_awayTeam: {
        sport: sport as Sport,
        gameDate: new Date(gameDate),
        homeTeam,
        awayTeam,
      },
    },
  });

  if (!gw) {
    return neutral;
  }

  // Dome games have no weather impact
  if (gw.isDome) {
    return {
      category: "weather",
      direction: "neutral",
      magnitude: 0,
      confidence: 1,
      label: "Dome/indoor — no weather impact",
      strength: "noise",
    };
  }

  const temp = gw.temperatureF;
  const wind = gw.windSpeedMph;
  const gust = gw.windGustMph;
  const precip = gw.precipitationIn;
  const conditions = gw.conditions;

  // Accumulate the worst weather factor
  let magnitude = 0;
  let confidence = 0;
  let label = "Clear/mild conditions";
  let direction: SignalResult["direction"] = "neutral";
  let strength: SignalResult["strength"] = "noise";

  // Snow (most impactful — combine cold + precip)
  if (
    conditions === "Snow" ||
    (temp !== null && temp < 35 && precip !== null && precip > 0)
  ) {
    const snowMag = Math.min(8, 6 + (precip ?? 0) * 4);
    if (snowMag > magnitude) {
      magnitude = snowMag;
      confidence = 0.8;
      direction = "under";
      label = `Snow expected (${temp !== null ? Math.round(temp) + "°F" : "cold"}, ${precip !== null ? precip.toFixed(2) + "in precip" : "precip"})`;
      strength = snowMag >= 7 ? "strong" : "moderate";
    }
  }

  // Extreme wind (> 30mph)
  if (wind !== null && wind > 30) {
    const windMag = Math.min(10, 8 + (wind - 30) / 10);
    if (windMag > magnitude) {
      magnitude = windMag;
      confidence = 0.85;
      direction = "under";
      label = `Extreme wind: ${Math.round(wind)}mph${gust !== null ? ` (gusts ${Math.round(gust)}mph)` : ""}`;
      strength = "strong";
    }
  }
  // Strong wind (> 20mph)
  else if (wind !== null && wind > 20) {
    const windMag = Math.min(8, 5 + (wind - 20) / 5);
    if (windMag > magnitude) {
      magnitude = windMag;
      confidence = 0.7;
      direction = "under";
      label = `Strong wind: ${Math.round(wind)}mph${gust !== null ? ` (gusts ${Math.round(gust)}mph)` : ""}`;
      strength = windMag >= 7 ? "strong" : "moderate";
    }
  }

  // Extreme cold (< 20°F)
  if (temp !== null && temp < 20) {
    const coldMag = Math.min(6, 4 + (20 - temp) / 10);
    if (coldMag > magnitude) {
      magnitude = coldMag;
      confidence = 0.65;
      direction = "under";
      label = `Extreme cold: ${Math.round(temp)}°F`;
      strength = coldMag >= 5 ? "moderate" : "weak";
    }
  }

  // Rain / significant precipitation (> 0.2in)
  if (
    precip !== null &&
    precip > 0.2 &&
    conditions !== "Snow"
  ) {
    const rainMag = Math.min(5, 3 + precip * 4);
    if (rainMag > magnitude) {
      magnitude = rainMag;
      confidence = 0.6;
      direction = "under";
      label = `Rain expected: ${precip.toFixed(2)}in precipitation`;
      strength = rainMag >= 4 ? "moderate" : "weak";
    }
  }

  // If no significant weather factor was found, return mild/clear
  if (magnitude <= 1) {
    const mildLabel =
      temp !== null && wind !== null
        ? `Clear conditions: ${Math.round(temp)}°F, ${Math.round(wind)}mph wind`
        : "Clear/mild conditions";
    return {
      category: "weather",
      direction: "neutral",
      magnitude: magnitude > 0 ? 1 : 0,
      confidence: 0.5,
      label: mildLabel,
      strength: "noise",
    };
  }

  // Round magnitude to one decimal
  magnitude = Math.round(magnitude * 10) / 10;

  return {
    category: "weather",
    direction,
    magnitude,
    confidence,
    label,
    strength,
  };
}

// ─── Cache Management ───────────────────────────────────────────────────────

/**
 * No-op for now. Weather data is stored in the database (GameWeather table),
 * not cached in memory. This function exists as a placeholder for future
 * in-memory caching if needed.
 */
export function clearWeatherCache(): void {
  // No-op — weather is persisted in DB, not cached in memory
  console.log("[weather] clearWeatherCache called (no-op)");
}
