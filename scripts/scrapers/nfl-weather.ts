/**
 * NFL Weather Data Scraper
 *
 * Sources:
 * - Open-Meteo Historical Weather API (free, no key needed)
 *   https://archive-api.open-meteo.com/v1/archive
 * - Dome/retractable roof detection from team venue data
 *
 * Strategy:
 * 1. Dome games → auto-fill (72°F, 0 wind, DOME)
 * 2. Outdoor games → query Open-Meteo by venue lat/long + game date
 */

import { createLogger } from "../utils/logger";
import { RateLimiter } from "../utils/rate-limiter";
import { withRetry } from "../utils/retry";

const log = createLogger("nfl-weather");

const OPEN_METEO_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const rateLimiter = new RateLimiter(1000); // Open-Meteo allows faster requests

export interface WeatherData {
  temperature: number; // °F
  windMph: number;
  weatherCode: number; // WMO weather code
  weatherCategory: string; // Mapped from weather code
}

/**
 * Map WMO weather codes to our WeatherCategory enum values.
 * Reference: https://open-meteo.com/en/docs#weathervariables
 */
function mapWeatherCode(code: number): string {
  if (code === 0 || code === 1) return "CLEAR";
  if (code === 2 || code === 3) return "CLOUDY";
  if (code >= 45 && code <= 48) return "FOG";
  if (code >= 51 && code <= 67) return "RAIN";
  if (code >= 71 && code <= 77) return "SNOW";
  if (code >= 80 && code <= 82) return "RAIN";
  if (code >= 85 && code <= 86) return "SNOW";
  if (code >= 95 && code <= 99) return "RAIN"; // Thunderstorm
  return "CLEAR";
}

/**
 * Fetch historical weather for a specific location and date/time.
 */
export async function fetchHistoricalWeather(
  latitude: number,
  longitude: number,
  date: string, // YYYY-MM-DD
  hour: number // 0-23, approximate kickoff hour in local time
): Promise<WeatherData | null> {
  await rateLimiter.wait();

  const url =
    `${OPEN_METEO_ARCHIVE}?latitude=${latitude}&longitude=${longitude}` +
    `&start_date=${date}&end_date=${date}` +
    `&hourly=temperature_2m,windspeed_10m,weathercode` +
    `&temperature_unit=fahrenheit&windspeed_unit=mph` +
    `&timezone=America/New_York`;

  try {
    const data = await withRetry(
      async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{
          hourly: {
            temperature_2m: number[];
            windspeed_10m: number[];
            weathercode: number[];
          };
        }>;
      },
      `weather ${date}`,
      { maxRetries: 2 }
    );

    const hourIndex = Math.min(hour, 23);
    const temp = data.hourly.temperature_2m[hourIndex];
    const wind = data.hourly.windspeed_10m[hourIndex];
    const code = data.hourly.weathercode[hourIndex];

    if (temp == null || wind == null) {
      log.warn(`No weather data for ${date} hour ${hour}`, { latitude, longitude });
      return null;
    }

    return {
      temperature: Math.round(temp * 10) / 10,
      windMph: Math.round(wind * 10) / 10,
      weatherCode: code,
      weatherCategory: mapWeatherCode(code),
    };
  } catch (error) {
    log.error(`Failed to fetch weather for ${date}`, {
      latitude,
      longitude,
      error: String(error),
    });
    return null;
  }
}
