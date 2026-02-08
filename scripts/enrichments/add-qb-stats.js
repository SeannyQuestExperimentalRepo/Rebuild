/**
 * Enrich NFL game data with starting QB stats.
 *
 * Reads nfl-player-games.json, identifies the starting QB for each
 * team in each game (max passing attempts), and writes QB performance
 * fields into nfl-games-staging.json.
 *
 * Added fields:
 *   homeQB, awayQB — starting QB names
 *   homeQBPassYds, awayQBPassYds — passing yards
 *   homeQBPassTDs, awayQBPassTDs — passing TDs
 *   homeQBINTs, awayQBINTs — interceptions
 *   homeQBRating, awayQBRating — passer rating (approximated)
 *   homeQBEpa, awayQBEpa — passing EPA
 *   homeQBRushYds, awayQBRushYds — QB rushing yards
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data");
const PLAYER_FILE = path.join(DATA_DIR, "nfl-player-games.json");
const GAME_FILE = path.join(DATA_DIR, "nfl-games-staging.json");

console.log("Loading player game data...");
const playerGames = JSON.parse(fs.readFileSync(PLAYER_FILE, "utf-8"));
console.log(`  ${playerGames.length} player-game records`);

console.log("Loading game data...");
const games = JSON.parse(fs.readFileSync(GAME_FILE, "utf-8"));
console.log(`  ${games.length} games`);

// --- Build QB lookup ---
// Key: "${season}-${week}-${teamAbbrev}" -> QB stats (player with most pass attempts)
console.log("\nBuilding QB lookup...");
const qbLookup = new Map();

for (const pg of playerGames) {
  const posGroup = pg.position_group || pg.position;
  if (posGroup !== "QB") continue;
  // Only consider QBs with meaningful attempts
  const attempts = pg.attempts || 0;
  if (attempts < 5) continue;

  const key = `${pg.season}-${pg.week}-${pg.team}`;
  const existing = qbLookup.get(key);

  if (!existing || attempts > (existing.attempts || 0)) {
    qbLookup.set(key, {
      name: pg.player_display_name || pg.player_name,
      passYds: pg.passing_yards || 0,
      passTDs: pg.passing_tds || 0,
      ints: pg.passing_interceptions || 0,
      epa: pg.passing_epa || null,
      rushYds: pg.rushing_yards || 0,
      completions: pg.completions || 0,
      attempts: attempts,
      teamAbbrev: pg.team,
    });
  }
}

console.log(`  ${qbLookup.size} team-game QB entries`);

// --- nflverse team abbrev to canonical name (for reverse lookup) ---
const CANONICAL_TO_ABBREV = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LA",
  "Las Vegas Raiders": "LV",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WAS",
  // Historical
  "Oakland Raiders": "OAK",
  "San Diego Chargers": "SD",
  "St. Louis Rams": "STL",
  "Washington Redskins": "WAS",
  "Washington Football Team": "WAS",
};

// --- Map playoff week strings to nflverse week numbers ---
const WEEK_TO_NFLVERSE = {
  WildCard: 18,
  Division: 19,
  ConfChamp: 20,
  SuperBowl: 21,
};

// --- Enrich games ---
console.log("\nEnriching games with QB stats...");
let enriched = 0;
let noQB = 0;

for (const game of games) {
  const season = game.season;
  const weekRaw = game.week;
  const homeTeam = game.homeTeamCanonical;
  const awayTeam = game.awayTeamCanonical;

  if (!season || !homeTeam || !awayTeam) continue;

  // Convert week to nflverse format
  const week = WEEK_TO_NFLVERSE[weekRaw] || parseInt(weekRaw, 10);
  if (isNaN(week)) continue;

  const homeAbbrev = CANONICAL_TO_ABBREV[homeTeam];
  const awayAbbrev = CANONICAL_TO_ABBREV[awayTeam];

  const homeQB = homeAbbrev ? qbLookup.get(`${season}-${week}-${homeAbbrev}`) : null;
  const awayQB = awayAbbrev ? qbLookup.get(`${season}-${week}-${awayAbbrev}`) : null;

  if (homeQB) {
    game.homeQB = homeQB.name;
    game.homeQBPassYds = homeQB.passYds;
    game.homeQBPassTDs = homeQB.passTDs;
    game.homeQBINTs = homeQB.ints;
    game.homeQBEpa = homeQB.epa;
    game.homeQBRushYds = homeQB.rushYds;
    game.homeQBComp = homeQB.completions;
    game.homeQBAtt = homeQB.attempts;
    enriched++;
  }

  if (awayQB) {
    game.awayQB = awayQB.name;
    game.awayQBPassYds = awayQB.passYds;
    game.awayQBPassTDs = awayQB.passTDs;
    game.awayQBINTs = awayQB.ints;
    game.awayQBEpa = awayQB.epa;
    game.awayQBRushYds = awayQB.rushYds;
    game.awayQBComp = awayQB.completions;
    game.awayQBAtt = awayQB.attempts;
    enriched++;
  }

  if (!homeQB && !awayQB) noQB++;
}

// --- Save ---
console.log(`\nEnriched ${enriched} team-game entries with QB stats`);
console.log(`Games without any QB data: ${noQB}`);

fs.writeFileSync(GAME_FILE, JSON.stringify(games, null, 2));
console.log(`Saved to ${GAME_FILE}`);

// --- Verify ---
const withHomeQB = games.filter((g) => g.homeQB).length;
const withAwayQB = games.filter((g) => g.awayQB).length;
console.log(`\nVerification:`);
console.log(`  Games with homeQB: ${withHomeQB} / ${games.length} (${(withHomeQB / games.length * 100).toFixed(1)}%)`);
console.log(`  Games with awayQB: ${withAwayQB} / ${games.length} (${(withAwayQB / games.length * 100).toFixed(1)}%)`);

// Show a sample
const sample = games.find((g) => g.homeQB && g.season >= 2023);
if (sample) {
  console.log(`\n  Sample: ${sample.season} Week ${sample.week}`);
  console.log(`    Home: ${sample.homeTeamCanonical} — ${sample.homeQB} (${sample.homeQBComp}/${sample.homeQBAtt}, ${sample.homeQBPassYds} yds, ${sample.homeQBPassTDs} TDs, ${sample.homeQBINTs} INTs)`);
  console.log(`    Away: ${sample.awayTeamCanonical} — ${sample.awayQB} (${sample.awayQBComp}/${sample.awayQBAtt}, ${sample.awayQBPassYds} yds, ${sample.awayQBPassTDs} TDs, ${sample.awayQBINTs} INTs)`);
}
