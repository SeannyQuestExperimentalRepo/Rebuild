/**
 * NFL Data Validation Suite — Phase 1, Cycles 49-55
 *
 * Comprehensive integrity and consistency checks on the staging data.
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/nfl-games-staging.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

const results = [];

function check(name, passed, details, failures) {
  results.push({ name, passed, details, failures: failures || [] });
  const icon = passed ? "PASS" : "FAIL";
  console.log(`[${icon}] ${name}: ${details}`);
  if (failures && failures.length > 0 && failures.length <= 5) {
    failures.forEach((f) => console.log(`       ${f}`));
  } else if (failures && failures.length > 5) {
    failures.slice(0, 5).forEach((f) => console.log(`       ${f}`));
    console.log(`       ... and ${failures.length - 5} more`);
  }
}

// ─── 1. No duplicate games ────────────────────────────────────────────────

const seen = new Set();
const dupes = [];
for (const g of data) {
  const key = `${g.gameDate}|${g.homeTeamCanonical}|${g.awayTeamCanonical}`;
  if (seen.has(key)) {
    dupes.push(key);
  }
  seen.add(key);
}
check(
  "No duplicate games",
  dupes.length === 0,
  `${dupes.length} duplicates found`,
  dupes.slice(0, 10)
);

// ─── 2. Scores are non-negative ──────────────────────────────────────────

const negScores = data.filter((g) => g.homeScore < 0 || g.awayScore < 0);
check(
  "Scores are non-negative",
  negScores.length === 0,
  `${negScores.length} games with negative scores`
);

// ─── 3. Score difference = homeScore - awayScore ─────────────────────────

const badDiff = data.filter((g) => g.scoreDifference !== g.homeScore - g.awayScore);
check(
  "Score difference is correct (signed)",
  badDiff.length === 0,
  `${badDiff.length} mismatches`
);

// ─── 4. Winner matches higher score ──────────────────────────────────────

const badWinner = data.filter((g) => {
  if (g.homeScore === g.awayScore) {
    // Tie: winner should be null
    return g.winnerCanonical !== null;
  }
  const expectedWinner =
    g.homeScore > g.awayScore ? g.homeTeamCanonical : g.awayTeamCanonical;
  return g.winnerCanonical !== expectedWinner;
});
check(
  "Winner matches higher score",
  badWinner.length === 0,
  `${badWinner.length} mismatches`,
  badWinner.slice(0, 5).map(
    (g) =>
      `${g.gameDate}: ${g.homeTeamCanonical} ${g.homeScore}-${g.awayScore} ${g.awayTeamCanonical}, winner=${g.winnerCanonical}`
  )
);

// ─── 5. Spread result verification ───────────────────────────────────────

const badSpread = data.filter((g) => {
  if (g.spread === null) return false;
  const margin = g.scoreDifference + g.spread;
  let expected;
  if (margin > 0) expected = "COVERED";
  else if (margin < 0) expected = "LOST";
  else expected = "PUSH";
  return g.spreadResult !== expected;
});
check(
  "Spread results calculated correctly",
  badSpread.length === 0,
  `${badSpread.length} mismatches`
);

// ─── 6. O/U result verification ──────────────────────────────────────────

const badOU = data.filter((g) => {
  if (g.overUnder === null) return false;
  const total = g.homeScore + g.awayScore;
  let expected;
  if (total > g.overUnder) expected = "OVER";
  else if (total < g.overUnder) expected = "UNDER";
  else expected = "PUSH";
  return g.ouResult !== expected;
});
check(
  "O/U results calculated correctly",
  badOU.length === 0,
  `${badOU.length} mismatches`
);

// ─── 7. Temperature is reasonable ────────────────────────────────────────

const badTemp = data.filter(
  (g) => g.temperature !== null && (g.temperature < -20 || g.temperature > 120)
);
check(
  "Temperature range (-20°F to 120°F)",
  badTemp.length === 0,
  `${badTemp.length} out of range`,
  badTemp.map((g) => `${g.gameDate}: ${g.temperature}°F`)
);

// ─── 8. Wind is reasonable ───────────────────────────────────────────────

const badWind = data.filter(
  (g) => g.windMph !== null && (g.windMph < 0 || g.windMph > 60)
);
check(
  "Wind range (0 to 60 mph)",
  badWind.length === 0,
  `${badWind.length} out of range`,
  badWind.map((g) => `${g.gameDate}: ${g.windMph} mph`)
);

// ─── 9. Home/Away are never the same team ────────────────────────────────

const sameTeam = data.filter(
  (g) => g.homeTeamCanonical === g.awayTeamCanonical
);
check(
  "Home and Away are different teams",
  sameTeam.length === 0,
  `${sameTeam.length} same-team games`
);

// ─── 10. No team plays two games on the same date ────────────────────────

const teamDates = {};
const doubleHeaders = [];
for (const g of data) {
  for (const team of [g.homeTeamCanonical, g.awayTeamCanonical]) {
    const key = `${team}|${g.gameDate}`;
    if (teamDates[key]) {
      doubleHeaders.push(key);
    }
    teamDates[key] = true;
  }
}
check(
  "No team plays twice on same date",
  doubleHeaders.length === 0,
  `${doubleHeaders.length} double-headers`,
  doubleHeaders.slice(0, 5)
);

// ─── 11. Super Bowl is neutral site ──────────────────────────────────────

const sbNotNeutral = data.filter(
  (g) => g.week === "SuperBowl" && g.isNeutralSite === false
);
check(
  "Super Bowl is always neutral site",
  sbNotNeutral.length === 0,
  `${sbNotNeutral.length} non-neutral Super Bowls`
);

// ─── 12. Playoff games have correct week labels ─────────────────────────

const playoffWeeks = new Set([
  "WildCard",
  "Division",
  "ConfChamp",
  "SuperBowl",
  "Champ",
]);
const badPlayoff = data.filter(
  (g) => g.isPlayoff && !playoffWeeks.has(g.week)
);
check(
  "Playoff games have valid week labels",
  badPlayoff.length === 0,
  `${badPlayoff.length} invalid playoff weeks`
);

// ─── 13. Week values are valid ───────────────────────────────────────────

const validWeeks = new Set([
  "1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18",
  "WildCard","Division","ConfChamp","SuperBowl","Champ",
]);
const invalidWeeks = data.filter((g) => !validWeeks.has(g.week));
check(
  "All week values are valid",
  invalidWeeks.length === 0,
  `${invalidWeeks.length} invalid weeks`,
  invalidWeeks.slice(0, 5).map((g) => `${g.season} week="${g.week}"`)
);

// ─── 14. Every game has a weather category ───────────────────────────────

const noWeather = data.filter(
  (g) => g.weatherCategory === null || g.weatherCategory === undefined
);
check(
  "All games have weather category",
  noWeather.length === 0,
  `${noWeather.length} missing weather`
);

// ─── 15. Season range is contiguous ──────────────────────────────────────

const seasons = Array.from(new Set(data.map((g) => g.season))).sort(
  (a, b) => a - b
);
const minSeason = seasons[0];
const maxSeason = seasons[seasons.length - 1];
const expectedSeasons = maxSeason - minSeason + 1;
check(
  "Season range is contiguous",
  seasons.length === expectedSeasons,
  `${minSeason}-${maxSeason}, ${seasons.length} seasons (expected ${expectedSeasons})`
);

// ─── 16. Games per season is reasonable ──────────────────────────────────

const bySeason = {};
for (const g of data) {
  bySeason[g.season] = (bySeason[g.season] || 0) + 1;
}
const tooFew = Object.entries(bySeason).filter(
  ([s, c]) => c < 100
);
const tooMany = Object.entries(bySeason).filter(
  ([s, c]) => c > 300
);
check(
  "Games per season is reasonable (100-300)",
  tooFew.length === 0 && tooMany.length === 0,
  `${tooFew.length} seasons < 100, ${tooMany.length} seasons > 300`,
  [...tooFew, ...tooMany].map(([s, c]) => `Season ${s}: ${c} games`)
);

// ─── 17. All team names resolve to known canonical names ─────────────────

const knownTeams = new Set([
  "Arizona Cardinals","Atlanta Falcons","Baltimore Ravens","Buffalo Bills",
  "Carolina Panthers","Chicago Bears","Cincinnati Bengals","Cleveland Browns",
  "Dallas Cowboys","Denver Broncos","Detroit Lions","Green Bay Packers",
  "Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Kansas City Chiefs",
  "Las Vegas Raiders","Los Angeles Chargers","Los Angeles Rams","Miami Dolphins",
  "Minnesota Vikings","New England Patriots","New Orleans Saints","New York Giants",
  "New York Jets","Philadelphia Eagles","Pittsburgh Steelers","San Francisco 49ers",
  "Seattle Seahawks","Tampa Bay Buccaneers","Tennessee Titans","Washington Commanders",
]);

const unknownHome = data.filter((g) => !knownTeams.has(g.homeTeamCanonical));
const unknownAway = data.filter((g) => !knownTeams.has(g.awayTeamCanonical));
check(
  "All canonical team names are valid",
  unknownHome.length === 0 && unknownAway.length === 0,
  `${unknownHome.length} unknown home, ${unknownAway.length} unknown away`
);

// ─── 18. Spread values are reasonable ────────────────────────────────────

const badSpreads = data.filter(
  (g) => g.spread !== null && (g.spread < -30 || g.spread > 30)
);
check(
  "Spread range (-30 to 30)",
  badSpreads.length === 0,
  `${badSpreads.length} out of range`,
  badSpreads.map((g) => `${g.gameDate}: spread=${g.spread}`)
);

// ─── 19. Day of week values are valid ────────────────────────────────────

const validDays = new Set(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]);
const badDays = data.filter((g) => !validDays.has(g.dayOfWeek));
check(
  "All day values are valid",
  badDays.length === 0,
  `${badDays.length} invalid days`
);

// ─── 20. Enum values are valid ───────────────────────────────────────────

const validSpreadResults = new Set(["COVERED", "LOST", "PUSH"]);
const validOUResults = new Set(["OVER", "UNDER", "PUSH"]);
const validWeatherCats = new Set([
  "CLEAR","CLOUDY","RAIN","SNOW","WIND","FOG","DOME","RETRACTABLE_CLOSED","RETRACTABLE_OPEN",
]);

const badSpreadEnum = data.filter(
  (g) => g.spreadResult && !validSpreadResults.has(g.spreadResult)
);
const badOUEnum = data.filter(
  (g) => g.ouResult && !validOUResults.has(g.ouResult)
);
const badWeatherEnum = data.filter(
  (g) => g.weatherCategory && !validWeatherCats.has(g.weatherCategory)
);
check(
  "All enum values are valid",
  badSpreadEnum.length === 0 &&
    badOUEnum.length === 0 &&
    badWeatherEnum.length === 0,
  `SpreadResult: ${badSpreadEnum.length}, OUResult: ${badOUEnum.length}, Weather: ${badWeatherEnum.length}`
);

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n═══ VALIDATION SUMMARY ═══");
const passed = results.filter((r) => r.passed).length;
const failed = results.filter((r) => !r.passed).length;
console.log(`Total checks: ${results.length}`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  console.log("\nFailed checks:");
  results
    .filter((r) => !r.passed)
    .forEach((r) => console.log(`  - ${r.name}: ${r.details}`));
}

// Save report
const reportPath = path.join(__dirname, "../data/nfl-validation-report.json");
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\nReport saved: ${reportPath}`);
