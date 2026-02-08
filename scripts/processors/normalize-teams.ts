/**
 * Team Name Normalization Processor
 *
 * Resolves historical, variant, and abbreviated team names
 * to canonical current team names for database foreign key lookup.
 */

import { resolveNFLTeamName } from "../../src/lib/team-name-mapping";
import { createLogger } from "../utils/logger";

const log = createLogger("normalize-teams");

/**
 * Resolve an NFL team name from raw data to the canonical name.
 * Logs a warning if resolution fails.
 */
export function resolveNFLTeam(rawName: string): string | null {
  const resolved = resolveNFLTeamName(rawName);
  if (!resolved) {
    log.warn(`Could not resolve NFL team name: "${rawName}"`);
  }
  return resolved;
}

/**
 * Batch resolve team names and report failures.
 */
export function batchResolveNFLTeams(
  names: string[]
): { resolved: Map<string, string>; failures: string[] } {
  const resolved = new Map<string, string>();
  const failures: string[] = [];

  const unique = Array.from(new Set(names));
  for (const name of unique) {
    const result = resolveNFLTeamName(name);
    if (result) {
      resolved.set(name, result);
    } else {
      failures.push(name);
    }
  }

  if (failures.length > 0) {
    log.warn(`Failed to resolve ${failures.length} team names`, {
      failures,
    });
  } else {
    log.info(`All ${unique.length} team names resolved successfully`);
  }

  return { resolved, failures };
}
