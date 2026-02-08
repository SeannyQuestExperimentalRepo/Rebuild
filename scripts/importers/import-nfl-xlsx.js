/**
 * NFL XLSX Importer — Phase 1, Cycles 21-26
 *
 * Reads Database.xlsx → parses, normalizes, resolves team names →
 * outputs staging JSON + CSV for review before database insertion.
 *
 * Usage: node scripts/importers/import-nfl-xlsx.js [path-to-xlsx]
 */

const XLSX = require("xlsx");
const fs = require("fs");
const path = require("path");

// ─── Team Name Mapping (extracted from src/lib/team-name-mapping.ts) ────────
const nflTeamNameMap = {
  // Current names
  "arizona cardinals": "Arizona Cardinals",
  "atlanta falcons": "Atlanta Falcons",
  "baltimore ravens": "Baltimore Ravens",
  "buffalo bills": "Buffalo Bills",
  "carolina panthers": "Carolina Panthers",
  "chicago bears": "Chicago Bears",
  "cincinnati bengals": "Cincinnati Bengals",
  "cleveland browns": "Cleveland Browns",
  "dallas cowboys": "Dallas Cowboys",
  "denver broncos": "Denver Broncos",
  "detroit lions": "Detroit Lions",
  "green bay packers": "Green Bay Packers",
  "houston texans": "Houston Texans",
  "indianapolis colts": "Indianapolis Colts",
  "jacksonville jaguars": "Jacksonville Jaguars",
  "kansas city chiefs": "Kansas City Chiefs",
  "las vegas raiders": "Las Vegas Raiders",
  "los angeles chargers": "Los Angeles Chargers",
  "los angeles rams": "Los Angeles Rams",
  "miami dolphins": "Miami Dolphins",
  "minnesota vikings": "Minnesota Vikings",
  "new england patriots": "New England Patriots",
  "new orleans saints": "New Orleans Saints",
  "new york giants": "New York Giants",
  "new york jets": "New York Jets",
  "philadelphia eagles": "Philadelphia Eagles",
  "pittsburgh steelers": "Pittsburgh Steelers",
  "san francisco 49ers": "San Francisco 49ers",
  "seattle seahawks": "Seattle Seahawks",
  "tampa bay buccaneers": "Tampa Bay Buccaneers",
  "tennessee titans": "Tennessee Titans",
  "washington commanders": "Washington Commanders",
  // Relocations / historical
  "oakland raiders": "Las Vegas Raiders",
  "los angeles raiders": "Las Vegas Raiders",
  "st. louis rams": "Los Angeles Rams",
  "st louis rams": "Los Angeles Rams",
  "san diego chargers": "Los Angeles Chargers",
  "baltimore colts": "Indianapolis Colts",
  "st. louis cardinals": "Arizona Cardinals",
  "st louis cardinals": "Arizona Cardinals",
  "phoenix cardinals": "Arizona Cardinals",
  "houston oilers": "Tennessee Titans",
  "tennessee oilers": "Tennessee Titans",
  "washington redskins": "Washington Commanders",
  "washington football team": "Washington Commanders",
  "boston patriots": "New England Patriots",
};

function resolveTeamName(name) {
  if (!name) return null;
  return nflTeamNameMap[name.trim().toLowerCase()] || null;
}

// ─── Weather Normalization ──────────────────────────────────────────────────

const WEATHER_PATTERNS = [
  [/snow|flurr|blizzard|ice|sleet|wintry/i, "SNOW"],
  [/rain|shower|drizzle|thunderstorm|storm|precip|downpour|wet/i, "RAIN"],
  [/fog|mist|haz/i, "FOG"],
  [/cloud|overcast|partly cloudy|partly sunny|mostly cloudy|clou[ldn]|clouidy|coudy/i, "CLOUDY"],
  [/clear|sunny|sunshine|fair|bright|nice|warm|hot|cold|cool|mild|beautiful|pleasant|chilly|frigid|dry|temps|temperature|heat index|blustery|upper|dropping/i, "CLEAR"],
  [/wind|gust/i, "WIND"],
];

// Dome/indoor patterns
const DOME_PATTERNS = /dome|indoor|indoors|retractable|controlled|n\/a.*indoor|closed roof/i;

function normalizeWeather(conditions, venueType) {
  // Dome venues → always DOME regardless of conditions field
  if (venueType === "DOME") return "DOME";
  if (venueType === "RETRACTABLE") return "RETRACTABLE_CLOSED";

  if (!conditions || conditions.trim() === "") return null;
  const text = conditions.trim();

  // Check if conditions text indicates dome/indoor
  if (DOME_PATTERNS.test(text)) return "DOME";

  // Check if it's just a number (temperature entered in wrong column)
  if (/^\d+$/.test(text)) return null;

  for (const [pattern, category] of WEATHER_PATTERNS) {
    if (pattern.test(text)) return category;
  }

  return null;
}

// ─── Wind Parsing ───────────────────────────────────────────────────────────

function parseWindMph(wind) {
  if (!wind || wind.trim() === "") return null;
  const text = wind.trim().toLowerCase();
  if (text === "calm" || text === "none" || text === "0" || text === "0 mph") return 0;

  // "8 mph" or "8mph"
  const singleMatch = text.match(/(\d+)\s*mph/i);
  if (singleMatch) return parseFloat(singleMatch[1]);

  // "15-20 mph" → average
  const rangeMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*mph/i);
  if (rangeMatch) return (parseFloat(rangeMatch[1]) + parseFloat(rangeMatch[2])) / 2;

  // Direction format: "NNW 20 mph" or "20 mph SW"
  const dirMatch = text.match(/(\d+)\s*mph/i);
  if (dirMatch) return parseFloat(dirMatch[1]);

  // Just a number
  const numMatch = text.match(/^(\d+(?:\.\d+)?)$/);
  if (numMatch) return parseFloat(numMatch[1]);

  return null;
}

// ─── Over/Under Parsing ─────────────────────────────────────────────────────

function parseOverUnder(ou) {
  if (ou == null || ou === undefined) return null;
  const text = String(ou).trim();
  if (text === "" || text === "null" || text === "undefined") return null;
  const num = parseFloat(text);
  return isNaN(num) ? null : num;
}

// ─── Venue Type Lookup (for dome/retractable detection) ─────────────────────

const DOME_TEAMS = new Set([
  "Detroit Lions",
  "Minnesota Vikings",
  "New Orleans Saints",
  "Las Vegas Raiders",
]);

const RETRACTABLE_TEAMS = new Set([
  "Houston Texans",
  "Indianapolis Colts",
  "Dallas Cowboys",
  "Atlanta Falcons",
  "Arizona Cardinals",
]);

// Historical dome teams (teams that played in domes in the past)
const HISTORICAL_DOME_TEAMS = {
  "Indianapolis Colts": { start: 1984, end: 2007, type: "DOME" }, // RCA Dome
  "Minnesota Vikings": { start: 1982, end: 2013, type: "DOME" }, // Metrodome
  "Houston Oilers": { start: 1968, end: 1996, type: "DOME" }, // Astrodome
  "Seattle Seahawks": { start: 1976, end: 1999, type: "DOME" }, // Kingdome
  "St. Louis Rams": { start: 1995, end: 2015, type: "DOME" }, // Edward Jones Dome
};

function getVenueType(teamName, season) {
  const canonical = resolveTeamName(teamName) || teamName;

  // Check current dome teams
  if (DOME_TEAMS.has(canonical)) return "DOME";
  if (RETRACTABLE_TEAMS.has(canonical)) return "RETRACTABLE";

  // Check historical dome usage
  for (const [histName, info] of Object.entries(HISTORICAL_DOME_TEAMS)) {
    const resolved = resolveTeamName(histName) || histName;
    if (canonical === resolved && season >= info.start && season <= info.end) {
      return info.type;
    }
    // Also check raw name for historical teams
    if (teamName === histName && season >= info.start && season <= info.end) {
      return info.type;
    }
  }

  return "OUTDOOR";
}

// ─── Primetime & Playoff Logic ──────────────────────────────────────────────

const PLAYOFF_WEEKS = new Set(["WildCard", "Division", "ConfChamp", "SuperBowl", "Champ"]);

function isPlayoff(week) {
  return PLAYOFF_WEEKS.has(week);
}

function isPrimetime(primetimeSlot, dayOfWeek, kickoffTime) {
  if (primetimeSlot && primetimeSlot.trim() !== "") return true;

  // Infer primetime from day/time if slot is missing
  if (dayOfWeek === "Mon") return true; // All Monday games are MNF
  if (kickoffTime) {
    const timeStr = kickoffTime.trim().toUpperCase();
    // Evening games (8:00+ PM) on Sunday are SNF
    if (dayOfWeek === "Sun" && /^8:|^9:|^10:/i.test(timeStr) && timeStr.includes("PM")) {
      return true;
    }
  }
  return false;
}

function inferPrimetimeSlot(primetimeSlot, dayOfWeek, kickoffTime) {
  if (primetimeSlot && primetimeSlot.trim() !== "") return primetimeSlot.trim();

  if (dayOfWeek === "Mon") return "MNF";
  if (dayOfWeek === "Thu") {
    // TNF started ~2006 as a regular thing
    return "TNF";
  }
  if (kickoffTime) {
    const timeStr = kickoffTime.trim().toUpperCase();
    if (dayOfWeek === "Sun" && /^8:|^9:/i.test(timeStr) && timeStr.includes("PM")) {
      return "SNF";
    }
    if (dayOfWeek === "Sat" && /^8:|^9:/i.test(timeStr) && timeStr.includes("PM")) {
      return "Saturday Primetime";
    }
  }

  return null;
}

// ─── Spread Result Calculation ──────────────────────────────────────────────

function calculateSpreadResult(homeScore, awayScore, spread) {
  if (spread == null) return null;
  const margin = (homeScore - awayScore) + spread;
  if (margin > 0) return "COVERED";
  if (margin < 0) return "LOST";
  return "PUSH";
}

function calculateOUResult(homeScore, awayScore, overUnder) {
  if (overUnder == null) return null;
  const total = homeScore + awayScore;
  if (total > overUnder) return "OVER";
  if (total < overUnder) return "UNDER";
  return "PUSH";
}

// ─── Neutral Site Detection ─────────────────────────────────────────────────

function isNeutralSite(week, season) {
  // Super Bowl is always neutral site
  if (week === "SuperBowl") return true;
  // Pre-Super Bowl championship games varied — mark as neutral to be safe
  if (week === "Champ") return true;
  return false;
}

// ─── Date Parsing ───────────────────────────────────────────────────────────

function parseDate(dateValue) {
  if (!dateValue) return null;
  // Handle Excel serial date numbers
  if (typeof dateValue === "number") {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + dateValue * 86400000);
    return date.toISOString().split("T")[0];
  }
  // Already a string in YYYY-MM-DD format
  const str = String(dateValue).trim();
  // Validate format
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  // Try parsing other formats
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  return str;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN IMPORT
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  const xlsxPath =
    process.argv[2] ||
    "/Users/seancasey/Desktop/Github/Football Searchable database/Database.xlsx";

  console.log(`\nReading XLSX: ${xlsxPath}\n`);

  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);

  console.log(`Total rows: ${rows.length}\n`);

  const games = [];
  const errors = [];
  const stats = {
    total: rows.length,
    processed: 0,
    skipped: 0,
    teamResolutionFailures: [],
    windParsed: 0,
    windFailed: 0,
    weatherNormalized: 0,
    weatherFailed: 0,
    ouParsed: 0,
    ouFailed: 0,
    spreadRecalcMismatch: 0,
    ouRecalcMismatch: 0,
    domeGames: 0,
    primetimeGames: 0,
    playoffGames: 0,
    neutralSiteGames: 0,
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Skip placeholder/future games (scores both 0 and winner = Tie)
    if (
      row["Home Score"] === 0 &&
      row["Away Score"] === 0 &&
      row["Winner"] === "Tie"
    ) {
      stats.skipped++;
      continue;
    }

    const season = row["Season"];
    const week = String(row["Week"]).trim();
    const dayOfWeek = String(row["Day"]).trim();
    const dateStr = parseDate(row["Date"]);
    const kickoffTime = row["Time (ET)"] ? String(row["Time (ET)"]).trim() : null;

    // Resolve team names
    const homeTeamRaw = String(row["Home Team"]).trim();
    const awayTeamRaw = String(row["Away Team"]).trim();
    const homeTeamCanonical = resolveTeamName(homeTeamRaw);
    const awayTeamCanonical = resolveTeamName(awayTeamRaw);

    if (!homeTeamCanonical) {
      stats.teamResolutionFailures.push(homeTeamRaw);
      errors.push({ row: i + 2, field: "Home Team", value: homeTeamRaw, error: "Unresolved" });
    }
    if (!awayTeamCanonical) {
      stats.teamResolutionFailures.push(awayTeamRaw);
      errors.push({ row: i + 2, field: "Away Team", value: awayTeamRaw, error: "Unresolved" });
    }

    const homeScore = Number(row["Home Score"]);
    const awayScore = Number(row["Away Score"]);
    const scoreDifference = homeScore - awayScore; // SIGNED: positive = home win

    // Winner resolution
    const winnerRaw = String(row["Winner"]).trim();
    let winnerCanonical = null;
    if (winnerRaw === "Tie") {
      winnerCanonical = null; // Tie game
    } else {
      winnerCanonical = resolveTeamName(winnerRaw);
    }

    // Venue type (for weather normalization)
    const homeVenueType = getVenueType(homeTeamRaw, season);

    // Parse fields
    const windMph = parseWindMph(row["Wind"] ? String(row["Wind"]) : null);
    if (row["Wind"] && windMph !== null) stats.windParsed++;
    else if (row["Wind"]) stats.windFailed++;

    const overUnder = parseOverUnder(row["Over/Under"]);
    if (row["Over/Under"] && overUnder !== null) stats.ouParsed++;
    else if (row["Over/Under"] && String(row["Over/Under"]).trim() !== "") stats.ouFailed++;

    const spread = row["Spread"] != null ? Number(row["Spread"]) : null;

    // Weather normalization
    const conditionsRaw = row["Conditions"] ? String(row["Conditions"]).trim() : null;
    const weatherCategory = normalizeWeather(conditionsRaw, homeVenueType);
    if (conditionsRaw && weatherCategory) stats.weatherNormalized++;
    else if (conditionsRaw) stats.weatherFailed++;
    if (weatherCategory === "DOME" || weatherCategory === "RETRACTABLE_CLOSED") stats.domeGames++;

    // Temperature
    const temperature = row["Temperature"] != null ? Number(row["Temperature"]) : null;

    // For dome games with no temperature, set default
    const finalTemp =
      temperature != null
        ? temperature
        : homeVenueType === "DOME" || homeVenueType === "RETRACTABLE"
          ? 72
          : null;

    // For dome games with no wind, set 0
    const finalWind =
      windMph != null
        ? windMph
        : homeVenueType === "DOME" || homeVenueType === "RETRACTABLE"
          ? 0
          : null;

    // Final weather category (auto-fill domes)
    const finalWeather = weatherCategory || (homeVenueType === "DOME" ? "DOME" : homeVenueType === "RETRACTABLE" ? "RETRACTABLE_CLOSED" : null);

    // Primetime
    const rawPrimetimeSlot = row["Primetime Slot"]
      ? String(row["Primetime Slot"]).trim()
      : null;
    const primetimeFlag = isPrimetime(rawPrimetimeSlot, dayOfWeek, kickoffTime);
    const primetimeSlot = inferPrimetimeSlot(rawPrimetimeSlot, dayOfWeek, kickoffTime);
    if (primetimeFlag) stats.primetimeGames++;

    // Playoff
    const playoffFlag = isPlayoff(week);
    if (playoffFlag) stats.playoffGames++;

    // Neutral site
    const neutralSite = isNeutralSite(week, season);
    if (neutralSite) stats.neutralSiteGames++;

    // Spread result — use original if available, recalculate to verify
    const originalSpreadResult = row["Spread Result"]
      ? String(row["Spread Result"]).trim()
      : null;
    const calculatedSpreadResult = calculateSpreadResult(homeScore, awayScore, spread);

    if (
      originalSpreadResult &&
      calculatedSpreadResult &&
      originalSpreadResult.toUpperCase() !== calculatedSpreadResult
    ) {
      stats.spreadRecalcMismatch++;
      errors.push({
        row: i + 2,
        field: "Spread Result",
        value: `original=${originalSpreadResult}, calculated=${calculatedSpreadResult}`,
        error: "Mismatch",
        context: `${homeTeamRaw} vs ${awayTeamRaw}, ${homeScore}-${awayScore}, spread=${spread}`,
      });
    }

    // O/U result — use original if available, recalculate to verify
    const originalOUResult = row["O/U Result"]
      ? String(row["O/U Result"]).trim()
      : null;
    const calculatedOUResult = calculateOUResult(homeScore, awayScore, overUnder);

    if (
      originalOUResult &&
      calculatedOUResult &&
      originalOUResult.toUpperCase() !== calculatedOUResult
    ) {
      stats.ouRecalcMismatch++;
      errors.push({
        row: i + 2,
        field: "O/U Result",
        value: `original=${originalOUResult}, calculated=${calculatedOUResult}`,
        error: "Mismatch",
        context: `${homeTeamRaw} vs ${awayTeamRaw}, total=${homeScore + awayScore}, ou=${overUnder}`,
      });
    }

    // Use the CALCULATED result (more trustworthy than the original)
    const finalSpreadResult = calculatedSpreadResult || (originalSpreadResult ? originalSpreadResult.toUpperCase() : null);
    const finalOUResult = calculatedOUResult || (originalOUResult ? originalOUResult.toUpperCase() : null);

    // Normalize spread result values
    const normalizedSpreadResult =
      finalSpreadResult === "COVERED" || finalSpreadResult === "LOST" || finalSpreadResult === "PUSH"
        ? finalSpreadResult
        : null;
    const normalizedOUResult =
      finalOUResult === "OVER" || finalOUResult === "UNDER" || finalOUResult === "PUSH"
        ? finalOUResult
        : null;

    games.push({
      season,
      week,
      dayOfWeek,
      gameDate: dateStr,
      kickoffTime: kickoffTime || null,
      homeTeamOriginal: homeTeamRaw,
      homeTeamCanonical: homeTeamCanonical || homeTeamRaw,
      awayTeamOriginal: awayTeamRaw,
      awayTeamCanonical: awayTeamCanonical || awayTeamRaw,
      homeScore,
      awayScore,
      scoreDifference,
      winnerOriginal: winnerRaw,
      winnerCanonical,
      isPrimetime: primetimeFlag,
      primetimeSlot,
      temperature: finalTemp,
      windMph: finalWind,
      weatherCategory: finalWeather,
      weatherRaw: conditionsRaw,
      spread: isNaN(spread) ? null : spread,
      overUnder,
      spreadResult: normalizedSpreadResult,
      ouResult: normalizedOUResult,
      isPlayoff: playoffFlag,
      isNeutralSite: neutralSite,
      source: "Database.xlsx",
    });

    stats.processed++;
  }

  // ─── Output ─────────────────────────────────────────────────────────────

  const outputDir = path.join(__dirname, "../../data");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Write staging JSON
  const jsonPath = path.join(outputDir, "nfl-games-staging.json");
  fs.writeFileSync(jsonPath, JSON.stringify(games, null, 2));
  console.log(`Staging JSON written: ${jsonPath} (${games.length} games)`);

  // Write staging CSV
  const csvPath = path.join(outputDir, "nfl-games-staging.csv");
  const csvHeaders = Object.keys(games[0]).join(",");
  const csvRows = games.map((g) =>
    Object.values(g)
      .map((v) => {
        if (v === null || v === undefined) return "";
        const s = String(v);
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(",")
  );
  fs.writeFileSync(csvPath, [csvHeaders, ...csvRows].join("\n"));
  console.log(`Staging CSV written: ${csvPath}`);

  // Write errors
  if (errors.length > 0) {
    const errPath = path.join(outputDir, "nfl-import-errors.json");
    fs.writeFileSync(errPath, JSON.stringify(errors, null, 2));
    console.log(`Errors written: ${errPath} (${errors.length} errors)`);
  }

  // ─── Stats Report ───────────────────────────────────────────────────────
  console.log("\n═══ IMPORT STATS ═══");
  console.log(`Total rows:              ${stats.total}`);
  console.log(`Processed:               ${stats.processed}`);
  console.log(`Skipped (future games):  ${stats.skipped}`);
  console.log(`Team resolution fails:   ${stats.teamResolutionFailures.length}`);
  console.log(`Wind parsed:             ${stats.windParsed}`);
  console.log(`Wind parse failures:     ${stats.windFailed}`);
  console.log(`Weather normalized:      ${stats.weatherNormalized}`);
  console.log(`Weather norm failures:   ${stats.weatherFailed}`);
  console.log(`O/U parsed:              ${stats.ouParsed}`);
  console.log(`O/U parse failures:      ${stats.ouFailed}`);
  console.log(`Spread result mismatches:${stats.spreadRecalcMismatch}`);
  console.log(`O/U result mismatches:   ${stats.ouRecalcMismatch}`);
  console.log(`Dome/indoor games:       ${stats.domeGames}`);
  console.log(`Primetime games:         ${stats.primetimeGames}`);
  console.log(`Playoff games:           ${stats.playoffGames}`);
  console.log(`Neutral site games:      ${stats.neutralSiteGames}`);

  if (stats.teamResolutionFailures.length > 0) {
    const unique = Array.from(new Set(stats.teamResolutionFailures));
    console.log(`\nUnresolved teams: ${unique.join(", ")}`);
  }

  if (errors.length > 0) {
    console.log(`\n${errors.length} total errors — see nfl-import-errors.json`);
  }

  // ─── Coverage by Decade ─────────────────────────────────────────────────
  console.log("\n═══ COVERAGE BY DECADE ═══");
  const decades = {};
  for (const g of games) {
    const decade = Math.floor(g.season / 10) * 10;
    if (!decades[decade]) {
      decades[decade] = { total: 0, spread: 0, weather: 0, temp: 0, wind: 0 };
    }
    decades[decade].total++;
    if (g.spread != null) decades[decade].spread++;
    if (g.weatherCategory) decades[decade].weather++;
    if (g.temperature != null) decades[decade].temp++;
    if (g.windMph != null) decades[decade].wind++;
  }
  console.log("Decade | Games | Spread% | Weather% | Temp% | Wind%");
  for (const [decade, d] of Object.entries(decades).sort()) {
    const sp = ((d.spread / d.total) * 100).toFixed(1);
    const wt = ((d.weather / d.total) * 100).toFixed(1);
    const tp = ((d.temp / d.total) * 100).toFixed(1);
    const wp = ((d.wind / d.total) * 100).toFixed(1);
    console.log(`${decade}s | ${d.total.toString().padStart(5)} | ${sp.padStart(5)}% | ${wt.padStart(6)}% | ${tp.padStart(4)}% | ${wp.padStart(4)}%`);
  }

  console.log("\nDone!\n");
}

main();
