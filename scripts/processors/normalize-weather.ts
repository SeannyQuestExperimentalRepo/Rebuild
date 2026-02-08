/**
 * Weather Normalization Processor
 *
 * Maps freeform weather description strings into WeatherCategory enum values.
 * Preserves original text in weatherRaw field.
 */

import { createLogger } from "../utils/logger";

const log = createLogger("normalize-weather");

type WeatherCategory =
  | "CLEAR"
  | "CLOUDY"
  | "RAIN"
  | "SNOW"
  | "WIND"
  | "FOG"
  | "DOME"
  | "RETRACTABLE_CLOSED"
  | "RETRACTABLE_OPEN";

// Ordered by specificity — more specific patterns first
const WEATHER_PATTERNS: [RegExp, WeatherCategory][] = [
  // Snow
  [/snow|flurr|blizzard|ice|sleet|wintry/i, "SNOW"],
  // Rain
  [/rain|shower|drizzle|thunderstorm|storm|precip|downpour|wet/i, "RAIN"],
  // Fog
  [/fog|mist|haz/i, "FOG"],
  // Wind (only if no precip — checked after rain/snow)
  [/wind|gust/i, "WIND"],
  // Cloudy
  [/cloud|overcast|mostly cloudy|partly cloudy|partly sunny/i, "CLOUDY"],
  // Clear
  [/clear|sunny|fair|bright|nice|warm|hot|cold|cool|mild/i, "CLEAR"],
];

/**
 * Normalize a freeform weather description into a WeatherCategory.
 * Returns null if the description is empty or unrecognizable.
 */
export function normalizeWeatherDescription(
  description: string | null | undefined
): WeatherCategory | null {
  if (!description || description.trim() === "") return null;

  const text = description.trim();

  for (const [pattern, category] of WEATHER_PATTERNS) {
    if (pattern.test(text)) {
      return category;
    }
  }

  log.debug(`Unrecognized weather: "${text}"`);
  return null;
}

/**
 * Parse wind string to numeric mph.
 * Examples: "8 mph" → 8, "Calm" → 0, "15-20 mph" → 17.5, "" → null
 */
export function parseWindMph(wind: string | null | undefined): number | null {
  if (!wind || wind.trim() === "") return null;

  const text = wind.trim().toLowerCase();

  if (text === "calm" || text === "none" || text === "0") return 0;

  // "8 mph" or "8mph"
  const singleMatch = text.match(/^(\d+)\s*mph?/i);
  if (singleMatch) return parseFloat(singleMatch[1]);

  // "15-20 mph" → average
  const rangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*mph?/i);
  if (rangeMatch) {
    return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;
  }

  // Just a number
  const numMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) return parseFloat(numMatch[1]);

  log.debug(`Unrecognized wind format: "${wind}"`);
  return null;
}
