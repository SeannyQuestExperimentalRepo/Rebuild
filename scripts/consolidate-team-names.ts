/**
 * Consolidation Script: Merge all 6+ team name mapping systems into one unified alias table.
 *
 * Reads from:
 *   - ncaamb-team-name-mapping.ts (1,142 + 220 slug entries)
 *   - ncaaf-team-name-mapping.ts (391 + 73 slug entries)
 *   - team-name-mapping.ts (47 NFL entries)
 *   - espn-team-mapping.ts (133 entries)
 *   - odds-api-team-mapping.ts (103 entries)
 *   - kenpom.ts DB_TO_KENPOM (~90 entries, reversed)
 *   - pick-engine.ts NAME_ALIASES (12 entries)
 *
 * Outputs: src/lib/team-aliases.generated.ts
 *
 * Usage: npx tsx scripts/consolidate-team-names.ts
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// Import exported mapping objects (none use server-only)
import { ncaambTeamNameMap, ncaambSlugToCanonical } from "../src/lib/ncaamb-team-name-mapping";
import { ncaafTeamNameMap, ncaafSlugToCanonical } from "../src/lib/ncaaf-team-name-mapping";
import { nflTeamNameMap } from "../src/lib/team-name-mapping";
import { espnOverrides } from "../src/lib/espn-team-mapping";
import { ODDS_API_NAME_MAP } from "../src/lib/odds-api-team-mapping";

// ─── Normalize ──────────────────────────────────────────────────────────────

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.'\u2019\u2018]/g, "") // Remove periods, apostrophes
    .replace(/[()]/g, " ") // Parentheses → space
    .replace(/-/g, " ") // Hyphens → space
    .replace(/&/g, "") // Remove ampersand (A&M → AM)
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Inlined non-exported constants ─────────────────────────────────────────

// From src/lib/kenpom.ts — maps DB/variant names → KenPom API names
// These get REVERSED in the alias table: KenPom name → DB canonical
const DB_TO_KENPOM: Record<string, string> = {
  "N.C. State": "NC State",
  "NC State": "NC State",
  UConn: "Connecticut",
  UCONN: "Connecticut",
  UMass: "Massachusetts",
  "Ole Miss": "Mississippi",
  Pitt: "Pittsburgh",
  PITT: "Pittsburgh",
  UCF: "Central Florida",
  USC: "Southern California",
  UNC: "North Carolina",
  UNLV: "UNLV",
  SMU: "SMU",
  LSU: "LSU",
  VCU: "VCU",
  UAB: "UAB",
  UTEP: "UTEP",
  UTSA: "UT San Antonio",
  "UT Arlington": "UT Arlington",
  "UT Martin": "Tennessee Martin",
  FIU: "FIU",
  LIU: "LIU Brooklyn",
  NIU: "Northern Illinois",
  SIU: "Southern Illinois",
  "SIU Edwardsville": "SIUE",
  UIC: "Illinois Chicago",
  IUPUI: "IUPUI",
  "Miami (FL)": "Miami FL",
  "Miami (OH)": "Miami OH",
  "Saint Mary's": "Saint Mary's",
  "St. Mary's": "Saint Mary's",
  "St. John's": "St. John's",
  "Saint Joseph's": "Saint Joseph's",
  "St. Joseph's": "Saint Joseph's",
  "Saint Peter's": "Saint Peter's",
  "St. Peter's": "Saint Peter's",
  "St. Bonaventure": "St. Bonaventure",
  "Saint Bonaventure": "St. Bonaventure",
  "Loyola Chicago": "Loyola Chicago",
  "Loyola (MD)": "Loyola MD",
  "Loyola Marymount": "Loyola Marymount",
  "Cal St. Bakersfield": "Cal St. Bakersfield",
  "Cal St. Fullerton": "Cal St. Fullerton",
  "Cal St. Northridge": "CSUN",
  Seattle: "Seattle",
  "Hawai'i": "Hawaii",
  Hawaii: "Hawaii",
  UNI: "Northern Iowa",
  ETSU: "East Tennessee St.",
  FGCU: "Florida Gulf Coast",
  UMBC: "UMBC",
  SIUE: "SIU Edwardsville",
  "App State": "Appalachian St.",
  "Appalachian State": "Appalachian St.",
  BYU: "BYU",
  TCU: "TCU",
  UNF: "North Florida",
  UNCG: "UNC Greensboro",
  UNCW: "UNC Wilmington",
  UNCA: "UNC Asheville",
  "Central Connecticut": "Central Connecticut",
  "Central Connecticut State": "Central Connecticut",
  "Cal Poly": "Cal Poly",
  Iona: "Iona",
  Gonzaga: "Gonzaga",
  "Saint Louis": "Saint Louis",
  "St. Louis": "Saint Louis",
  "UNC Greensboro": "UNC Greensboro",
  "UNC Wilmington": "UNC Wilmington",
  "UNC Asheville": "UNC Asheville",
  NJIT: "NJIT",
  FAU: "Florida Atlantic",
  WKU: "Western Kentucky",
  "Middle Tennessee": "Middle Tennessee",
  MTSU: "Middle Tennessee",
  "South Florida": "South Florida",
  USF: "South Florida",
  "North Texas": "North Texas",
  Louisiana: "Louisiana",
  "Louisiana-Lafayette": "Louisiana",
  "Louisiana-Monroe": "Louisiana Monroe",
  "Little Rock": "Little Rock",
  UALR: "Little Rock",
  Omaha: "Omaha",
  "Detroit Mercy": "Detroit Mercy",
  Detroit: "Detroit Mercy",
  "Green Bay": "Green Bay",
  Milwaukee: "Milwaukee",
  CSUN: "Cal St. Northridge",
  Indianapolis: "IUPUI",
  McNeese: "McNeese St.",
  Nicholls: "Nicholls St.",
  "Kansas City": "UMKC",
  "Saint Francis": "St. Francis PA",
  "Houston Christian": "Houston Baptist",
  Charleston: "College of Charleston",
  "Purdue Fort Wayne": "Fort Wayne",
  "UT Rio Grande Valley": "Texas Pan American",
  "Queens (NC)": "Queens",
  "East Texas A&M": "Texas A&M Commerce",
  "Utah Tech": "Dixie St.",
  "Southeast Missouri St.": "Southeast Missouri",
};

// From src/lib/pick-engine.ts
const NAME_ALIASES: Record<string, string> = {
  "NC State": "N.C. State",
  "Chicago State": "Chicago St.",
  "Jackson State": "Jackson St.",
  "Indiana State": "Indiana St.",
  "Arkansas-Pine Bluff": "Arkansas Pine Bluff",
  "Texas A&M-Corpus Christi": "Texas A&M Corpus Chris",
  "Appalachian State": "Appalachian St.",
  "Bethune-Cookman": "Bethune Cookman",
  "Louisiana-Monroe": "Louisiana Monroe",
  "Ole Miss": "Mississippi",
  UConn: "Connecticut",
  "Hawai'i": "Hawaii",
};

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const prisma = new PrismaClient();

  console.log("Loading canonical team names from DB...");
  const teams = await prisma.team.findMany({
    where: { sport: { in: ["NFL", "NCAAF", "NCAAMB", "NBA"] } },
    select: { name: true, sport: true },
  });

  // Build canonical name sets and normalized→original lookup
  const canonicalSets = new Map<string, Set<string>>();
  const canonicalByNorm = new Map<string, Map<string, string>>();

  for (const t of teams) {
    if (!canonicalSets.has(t.sport)) canonicalSets.set(t.sport, new Set());
    canonicalSets.get(t.sport)!.add(t.name);

    if (!canonicalByNorm.has(t.sport))
      canonicalByNorm.set(t.sport, new Map());
    canonicalByNorm.get(t.sport)!.set(normalize(t.name), t.name);
  }

  console.log(
    `  Loaded: ${[...canonicalSets.entries()].map(([s, set]) => `${s}=${set.size}`).join(", ")}`
  );

  // Alias collection: sport → normalized variant → { canonical, source }
  const aliases = new Map<
    string,
    Map<string, { canonical: string; source: string }>
  >();
  for (const sport of ["NFL", "NCAAF", "NCAAMB", "NBA"]) {
    aliases.set(sport, new Map());
  }

  let conflicts = 0;

  function add(
    sport: string,
    variant: string,
    canonical: string,
    source: string
  ) {
    const key = normalize(variant);
    const normCanonical = normalize(canonical);
    if (!key || key === normCanonical) return; // Skip identity after normalization

    const sportMap = aliases.get(sport);
    if (!sportMap) return;

    const existing = sportMap.get(key);
    if (existing) {
      if (existing.canonical !== canonical) {
        conflicts++;
        console.warn(
          `  CONFLICT [${sport}]: "${key}" → "${existing.canonical}" (${existing.source}) vs "${canonical}" (${source})`
        );
        return; // Keep higher-priority source (first wins)
      }
      return; // Same canonical, skip duplicate
    }

    sportMap.set(key, { canonical, source });
  }

  // ─── Process sources in priority order (first wins conflicts) ────────────

  console.log("\nProcessing sources...");

  // 1. ESPN overrides (highest: manually curated for exact DB match)
  let count = 0;
  for (const [sport, overrides] of Object.entries(espnOverrides)) {
    for (const [variant, canonical] of Object.entries(overrides)) {
      add(sport, variant, canonical, "espn-override");
      count++;
    }
  }
  console.log(`  ESPN overrides: ${count} entries processed`);

  // 2. NAME_ALIASES from pick-engine.ts
  count = 0;
  for (const [variant, canonical] of Object.entries(NAME_ALIASES)) {
    add("NCAAMB", variant, canonical, "pick-engine");
    count++;
  }
  console.log(`  NAME_ALIASES: ${count} entries processed`);

  // 3. Odds API mapping
  count = 0;
  for (const [variant, canonical] of Object.entries(ODDS_API_NAME_MAP)) {
    add("NCAAMB", variant, canonical, "odds-api");
    count++;
  }
  console.log(`  ODDS_API_NAME_MAP: ${count} entries processed`);

  // 4. Main mapping files
  count = 0;
  for (const [variant, canonical] of Object.entries(ncaambTeamNameMap)) {
    add("NCAAMB", variant, canonical, "ncaamb-map");
    count++;
  }
  console.log(`  ncaambTeamNameMap: ${count} entries processed`);

  count = 0;
  for (const [variant, canonical] of Object.entries(ncaambSlugToCanonical)) {
    add("NCAAMB", variant, canonical, "ncaamb-slug");
    count++;
  }
  console.log(`  ncaambSlugToCanonical: ${count} entries processed`);

  count = 0;
  for (const [variant, canonical] of Object.entries(ncaafTeamNameMap)) {
    add("NCAAF", variant, canonical, "ncaaf-map");
    count++;
  }
  console.log(`  ncaafTeamNameMap: ${count} entries processed`);

  count = 0;
  for (const [variant, canonical] of Object.entries(ncaafSlugToCanonical)) {
    add("NCAAF", variant, canonical, "ncaaf-slug");
    count++;
  }
  console.log(`  ncaafSlugToCanonical: ${count} entries processed`);

  count = 0;
  for (const [variant, canonical] of Object.entries(nflTeamNameMap)) {
    add("NFL", variant, canonical, "nfl-map");
    count++;
  }
  console.log(`  nflTeamNameMap: ${count} entries processed`);

  // 5. DB_TO_KENPOM reversed (lowest priority)
  const ncaambCanonical = canonicalSets.get("NCAAMB") || new Set<string>();
  const ncaambNormMap =
    canonicalByNorm.get("NCAAMB") || new Map<string, string>();

  // Group DB_TO_KENPOM by KenPom value (right side)
  const kenpomGroups = new Map<string, string[]>();
  for (const [key, val] of Object.entries(DB_TO_KENPOM)) {
    if (!kenpomGroups.has(val)) kenpomGroups.set(val, []);
    kenpomGroups.get(val)!.push(key);
  }

  count = 0;
  for (const [kenpomName, dbCandidates] of kenpomGroups) {
    // Find the actual DB canonical name
    let dbCanonical: string | undefined;

    // Check if any candidate is a known DB canonical
    for (const candidate of dbCandidates) {
      if (ncaambCanonical.has(candidate)) {
        dbCanonical = candidate;
        break;
      }
    }

    // Check if the KenPom name itself is a DB canonical
    if (!dbCanonical && ncaambCanonical.has(kenpomName)) {
      dbCanonical = kenpomName;
    }

    // Try normalized match as fallback
    if (!dbCanonical) {
      for (const candidate of [...dbCandidates, kenpomName]) {
        const resolved = ncaambNormMap.get(normalize(candidate));
        if (resolved) {
          dbCanonical = resolved;
          break;
        }
      }
    }

    if (!dbCanonical) continue;

    // Add KenPom name → DB canonical
    add("NCAAMB", kenpomName, dbCanonical, "kenpom-rev");
    count++;

    // Add all left-side variants → DB canonical
    for (const variant of dbCandidates) {
      add("NCAAMB", variant, dbCanonical, "kenpom-var");
      count++;
    }
  }
  console.log(`  DB_TO_KENPOM reversed: ${count} entries processed`);

  // ─── Validation ─────────────────────────────────────────────────────────

  console.log("\nValidating...");
  let invalid = 0;
  for (const [sport, sportMap] of aliases) {
    const canonical = canonicalSets.get(sport) || new Set<string>();
    for (const [key, entry] of sportMap) {
      if (!canonical.has(entry.canonical)) {
        invalid++;
        if (invalid <= 30) {
          console.warn(
            `  INVALID: "${entry.canonical}" not in ${sport} Team table (key: "${key}", source: ${entry.source})`
          );
        }
      }
    }
  }
  if (invalid > 30) {
    console.warn(`  ... and ${invalid - 30} more invalid entries`);
  }

  // ─── Canonical names with NO aliases (potential gaps) ───────────────────

  console.log("\nChecking coverage...");
  for (const sport of ["NCAAMB", "NCAAF", "NFL"]) {
    const canonical = canonicalSets.get(sport) || new Set<string>();
    const sportMap = aliases.get(sport)!;
    const aliasedCanonicals = new Set(
      [...sportMap.values()].map((e) => e.canonical)
    );
    const unaliased: string[] = [];
    for (const name of canonical) {
      if (!aliasedCanonicals.has(name)) {
        unaliased.push(name);
      }
    }
    if (unaliased.length > 0 && unaliased.length <= 20) {
      console.log(
        `  ${sport}: ${unaliased.length} canonical names with no aliases (resolved by normalization only)`
      );
    } else if (unaliased.length > 20) {
      console.log(
        `  ${sport}: ${unaliased.length} canonical names with no aliases`
      );
    } else {
      console.log(`  ${sport}: all canonical names have aliases ✓`);
    }
  }

  // ─── Generate output ──────────────────────────────────────────────────

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const outputPath = path.resolve(
    __dirname,
    "../src/lib/team-aliases.generated.ts"
  );

  const lines: string[] = [
    "// AUTO-GENERATED by scripts/consolidate-team-names.ts",
    "// Do not edit manually — re-run the consolidation script instead.",
    `// Generated: ${new Date().toISOString()}`,
    "//",
    "// Normalized keys: lowercase, periods/apostrophes removed,",
    "// hyphens/parentheses → spaces, ampersands removed, whitespace collapsed.",
    "",
    "export const TEAM_ALIASES: Record<string, Record<string, string>> = {",
  ];

  let totalAliases = 0;
  for (const sport of ["NCAAMB", "NCAAF", "NFL", "NBA"]) {
    const sportMap = aliases.get(sport)!;
    const entries = [...sportMap.entries()].sort(([a], [b]) =>
      a.localeCompare(b)
    );
    totalAliases += entries.length;
    lines.push(`  ${sport}: {`);
    for (const [key, entry] of entries) {
      lines.push(
        `    ${JSON.stringify(key)}: ${JSON.stringify(entry.canonical)},`
      );
    }
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");

  fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");

  // ─── Report ─────────────────────────────────────────────────────────────

  console.log("\n═══ CONSOLIDATION REPORT ═══════════════════════════════════");
  for (const sport of ["NCAAMB", "NCAAF", "NFL", "NBA"]) {
    console.log(`  ${sport}: ${aliases.get(sport)!.size} aliases`);
  }
  console.log(`  Total: ${totalAliases} aliases`);
  console.log(`  Conflicts: ${conflicts}`);
  console.log(`  Invalid canonicals: ${invalid}`);
  console.log(`  Output: ${outputPath}`);
  console.log("═══════════════════════════════════════════════════════════\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
