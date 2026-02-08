/**
 * NFL XLSX Importer
 *
 * Reads the existing Database.xlsx and maps rows to NFLGame records.
 * Outputs a staging CSV for review before database insertion.
 *
 * Implementation in Phase 1, Cycles 21-26.
 *
 * Expected columns in XLSX:
 * Season | Week | Day | Date | Time (ET) | Home Team | Away Team |
 * Home Score | Away Score | Score Difference | Winner | Primetime Slot |
 * Temperature | Wind | Conditions | Spread | Over/Under |
 * Spread Result | O/U Result
 */

import { createLogger } from "../utils/logger";

const log = createLogger("import-nfl-xlsx");

export interface RawXLSXRow {
  Season: number;
  Week: string;
  Day: string;
  Date: string;
  "Time (ET)": string | null;
  "Home Team": string;
  "Away Team": string;
  "Home Score": number;
  "Away Score": number;
  "Score Difference": number;
  Winner: string;
  "Primetime Slot": string | null;
  Temperature: number | null;
  Wind: string | null;
  Conditions: string | null;
  Spread: number | null;
  "Over/Under": string | null;
  "Spread Result": string | null;
  "O/U Result": string | null;
}

/**
 * Import NFL games from Database.xlsx.
 * Full implementation coming in Phase 1.
 */
export async function importNFLFromXLSX(filePath: string): Promise<void> {
  log.info(`XLSX import not yet implemented`, { filePath });
  // Phase 1 will implement:
  // 1. Read XLSX with xlsx library
  // 2. Map columns to RawXLSXRow
  // 3. Resolve team names to IDs
  // 4. Parse wind, O/U, weather
  // 5. Calculate primetime flags, playoff flags
  // 6. Write to staging CSV
}
