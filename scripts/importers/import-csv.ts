/**
 * Generic CSV Importer
 *
 * Reads a finalized CSV and bulk inserts into the database.
 * Supports NFL, NCAAF, and NCAAMB game data.
 *
 * Implementation in Phase 4, Cycles 181-190.
 */

import { createLogger } from "../utils/logger";

const log = createLogger("import-csv");

export type ImportSport = "NFL" | "NCAAF" | "NCAAMB";

export interface ImportStats {
  totalRows: number;
  inserted: number;
  skipped: number;
  errors: number;
}

/**
 * Import games from a finalized CSV into the database.
 */
export async function importCSV(
  filePath: string,
  sport: ImportSport
): Promise<ImportStats> {
  log.info(`CSV import not yet implemented`, { filePath, sport });
  return { totalRows: 0, inserted: 0, skipped: 0, errors: 0 };
}
