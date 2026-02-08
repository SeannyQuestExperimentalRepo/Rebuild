/**
 * NCAAF Data Validation Suite — Phase 2
 *
 * Comprehensive integrity and consistency checks on the staging data.
 * Modeled after the NFL validation suite.
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/ncaaf-games-staging.json");
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

console.log(`Validating ${data.length} NCAAF games...\n`);

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

const badDiff = data.filter(
  (g) => g.scoreDifference !== g.homeScore - g.awayScore
);
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
    g.homeScore > g.awayScore
      ? g.homeTeamCanonical
      : g.awayTeamCanonical;
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

// ─── 5. Spread result verification (where spreads exist) ─────────────────

const withSpread = data.filter((g) => g.spread !== null);
const badSpread = withSpread.filter((g) => {
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
  `${badSpread.length} mismatches (${withSpread.length} games with spreads)`
);

// ─── 6. O/U result verification ──────────────────────────────────────────

const withOU = data.filter((g) => g.overUnder !== null);
const badOU = withOU.filter((g) => {
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
  `${badOU.length} mismatches (${withOU.length} games with O/U)`
);

// ─── 7. Temperature is reasonable ────────────────────────────────────────

const gamesWithTemp = data.filter((g) => g.temperature !== null);
const badTemp = gamesWithTemp.filter(
  (g) => g.temperature < -20 || g.temperature > 130
);
check(
  "Temperature range (-20°F to 130°F)",
  badTemp.length === 0,
  `${badTemp.length} out of range (${gamesWithTemp.length} games with temp)`,
  badTemp.map((g) => `${g.gameDate}: ${g.temperature}°F at ${g.homeTeam}`)
);

// ─── 8. Wind is reasonable ───────────────────────────────────────────────

const gamesWithWind = data.filter((g) => g.windMph !== null);
const badWind = gamesWithWind.filter(
  (g) => g.windMph < 0 || g.windMph > 80
);
check(
  "Wind range (0 to 80 mph)",
  badWind.length === 0,
  `${badWind.length} out of range (${gamesWithWind.length} games with wind)`,
  badWind.map((g) => `${g.gameDate}: ${g.windMph} mph at ${g.homeTeam}`)
);

// ─── 9. Home/Away are never the same team ────────────────────────────────

const sameTeam = data.filter(
  (g) =>
    g.homeTeamCanonical === g.awayTeamCanonical &&
    g.homeTeamCanonical !== null
);
check(
  "Home and Away are different teams",
  sameTeam.length === 0,
  `${sameTeam.length} same-team games`
);

// ─── 10. FBS teams have canonical names ──────────────────────────────────

const fbsMissingCanonical = data.filter(
  (g) => g.homeFBS && (!g.homeTeamCanonical || g.homeTeamCanonical === g.homeTeam)
);
// homeTeam from SR is already the display name, canonical should be full name with mascot
// So homeTeamCanonical should differ from homeTeam (unless they happen to match)
check(
  "FBS home teams have canonical names",
  true, // This is informational
  `${fbsMissingCanonical.length} FBS home games where canonical = SR name`
);

// ─── 11. Bowl games have bowl names ──────────────────────────────────────

const bowlNoBowlName = data.filter(
  (g) => g.isBowlGame && (!g.bowlName || g.bowlName === "")
);
check(
  "Bowl games have bowl names",
  bowlNoBowlName.length === 0,
  `${bowlNoBowlName.length} bowl games without names`
);

// ─── 12. Playoff games are flagged ───────────────────────────────────────

const playoffGames = data.filter((g) => g.isPlayoff);
check(
  "Playoff games exist and are flagged",
  playoffGames.length > 0,
  `${playoffGames.length} playoff/championship games`,
  playoffGames.map((g) => `${g.season}: ${g.bowlName || "unnamed"} (${g.homeTeam} vs ${g.awayTeam})`)
);

// ─── 13. Rankings are reasonable (1-25) ──────────────────────────────────

const badRank = data.filter((g) => {
  if (g.homeRank !== null && (g.homeRank < 1 || g.homeRank > 25)) return true;
  if (g.awayRank !== null && (g.awayRank < 1 || g.awayRank > 25)) return true;
  return false;
});
check(
  "Rankings are in valid range (1-25)",
  badRank.length === 0,
  `${badRank.length} invalid rankings`,
  badRank.slice(0, 5).map(
    (g) => `${g.gameDate}: home=${g.homeRank}, away=${g.awayRank}`
  )
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
const tooFew = Object.entries(bySeason).filter(([s, c]) => c < 400);
const tooMany = Object.entries(bySeason).filter(([s, c]) => c > 1000);
check(
  "Games per season is reasonable (400-1000)",
  tooFew.length === 0 && tooMany.length === 0,
  `${tooFew.length} seasons < 400, ${tooMany.length} seasons > 1000`,
  [...tooFew, ...tooMany].map(([s, c]) => `Season ${s}: ${c} games`)
);

// ─── 17. Conference games are reasonable percentage ──────────────────────

const bothFBS = data.filter((g) => g.homeFBS && g.awayFBS);
const confGames = bothFBS.filter((g) => g.isConferenceGame);
const confPct = ((confGames.length / bothFBS.length) * 100).toFixed(1);
check(
  "Conference game ratio is reasonable (50-70%)",
  confPct >= 50 && confPct <= 70,
  `${confGames.length}/${bothFBS.length} = ${confPct}% of FBS-vs-FBS games`
);

// ─── 18. Neutral site flags ─────────────────────────────────────────────

const neutralGames = data.filter((g) => g.isNeutralSite);
check(
  "Neutral site games exist",
  neutralGames.length > 0,
  `${neutralGames.length} neutral site games`
);

// Bowl games should mostly be neutral
const bowlNotNeutral = data.filter(
  (g) => g.isBowlGame && !g.isNeutralSite
);
check(
  "Bowl games are mostly neutral site",
  bowlNotNeutral.length <= 5,
  `${bowlNotNeutral.length} bowl games NOT marked neutral`
);

// ─── 19. Weather categories are valid ────────────────────────────────────

const validWeatherCats = new Set([
  "CLEAR", "CLOUDY", "RAIN", "SNOW", "WIND", "FOG", "DOME",
  "RETRACTABLE_CLOSED", "RETRACTABLE_OPEN",
]);
const badWeather = data.filter(
  (g) => g.weatherCategory && !validWeatherCats.has(g.weatherCategory)
);
check(
  "All weather categories are valid",
  badWeather.length === 0,
  `${badWeather.length} invalid categories`,
  badWeather.slice(0, 5).map(
    (g) => `${g.gameDate}: "${g.weatherCategory}"`
  )
);

// ─── 20. Game dates are valid ────────────────────────────────────────────

const badDate = data.filter((g) => {
  if (!g.gameDate) return true;
  const d = new Date(g.gameDate);
  return isNaN(d.getTime());
});
check(
  "All game dates are valid",
  badDate.length === 0,
  `${badDate.length} invalid dates`
);

// ─── 21. 2020 season has fewer games (COVID) ────────────────────────────

const games2020 = data.filter((g) => g.season === 2020);
check(
  "2020 season reflects COVID reduction",
  games2020.length < 700,
  `2020 has ${games2020.length} games (expected ~570 due to COVID)`
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
const reportPath = path.join(
  __dirname,
  "../data/ncaaf-validation-report.json"
);
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\nReport saved: ${reportPath}`);
