/**
 * Normalize NCAAF Raw Data → Staging JSON
 *
 * Takes the raw scraped data from Sports Reference and produces a clean,
 * normalized staging JSON with canonical team names, conference game flags,
 * and consistent field structure matching the Prisma NCAAFGame model.
 *
 * Input:  data/raw/ncaaf/ncaaf-scores-raw.json
 * Output: data/ncaaf-games-staging.json
 */

const fs = require("fs");
const path = require("path");

// ─── Load raw data ──────────────────────────────────────────────────────────

const rawPath = path.join(__dirname, "../../data/raw/ncaaf/ncaaf-scores-raw.json");
const raw = JSON.parse(fs.readFileSync(rawPath, "utf8"));

console.log(`Loaded ${raw.length} raw NCAAF games\n`);

// ─── Load slug → canonical mapping ──────────────────────────────────────────

// Read the TypeScript file and parse the slug-to-canonical map
const mappingContent = fs.readFileSync(
  path.join(__dirname, "../../src/lib/ncaaf-team-name-mapping.ts"),
  "utf8"
);

// Extract the ncaafSlugToCanonical section
const slugMapSection = mappingContent.split("ncaafSlugToCanonical")[1];
const slugEntries = slugMapSection.match(
  /(?:"([^"]+)"|(\w[\w-]*))\s*:\s*"([^"]+)"/g
) || [];

const slugToCanonical = {};
for (const entry of slugEntries) {
  const match = entry.match(/(?:"([^"]+)"|(\w[\w-]*))\s*:\s*"([^"]+)"/);
  if (match) {
    const key = match[1] || match[2];
    const value = match[3];
    slugToCanonical[key] = value;
  }
}

console.log(`Loaded ${Object.keys(slugToCanonical).length} slug → canonical mappings`);

// ─── Load team seed data for conference/venue lookups ───────────────────────

const seedContent = fs.readFileSync(
  path.join(__dirname, "../../prisma/seed-data/ncaaf-teams.ts"),
  "utf8"
);

// Extract team data from the seed file
// Parse each team block
const teamBlocks = seedContent.match(/\{[^{}]*slug:\s*"[^"]+?"[^{}]*\}/gs) || [];
const teamData = {};

for (const block of teamBlocks) {
  const slug = (block.match(/slug:\s*"([^"]+)"/) || [])[1];
  const conference = (block.match(/conference2024:\s*"([^"]+)"/) || [])[1];
  const venueType = (block.match(/VenueType\.(\w+)/) || [])[1];
  const lat = parseFloat((block.match(/latitude:\s*([\d.-]+)/) || [])[1]);
  const lon = parseFloat((block.match(/longitude:\s*([\d.-]+)/) || [])[1]);

  if (slug) {
    teamData[slug] = { conference, venueType, lat, lon };
  }
}

console.log(`Loaded ${Object.keys(teamData).length} team venue/conference entries\n`);

// ─── Conference membership by year (for isConferenceGame detection) ──────────
// Conference realignment timeline (2005-2024):
// We track which conference each team was in for each year.
// This is complex due to realignment. We'll build a simplified version
// focusing on the major moves.

const conferenceHistory = buildConferenceHistory();

function buildConferenceHistory() {
  // Start with 2024 assignments and work backwards for key moves
  const history = {};

  // Initialize all years from seed data's 2024 conferences
  for (const [slug, data] of Object.entries(teamData)) {
    history[slug] = {};
    for (let y = 2005; y <= 2024; y++) {
      history[slug][y] = data.conference; // Default to 2024
    }
  }

  // ─── Major conference realignment moves ────────────────────────────────
  // Format: setConference(slug, startYear, endYear, conference)

  function setConf(slug, startYear, endYear, conf) {
    if (!history[slug]) return;
    for (let y = startYear; y <= endYear; y++) {
      history[slug][y] = conf;
    }
  }

  // 2024 realignment (Texas/Oklahoma to SEC, USC/UCLA/Oregon/Washington to Big Ten,
  // Colorado to Big 12, etc.)
  // These are already set as defaults from 2024 data

  // ─── Pre-2024 assignments ─────────────────────────────────────────────

  // Texas & Oklahoma were Big 12 until 2023
  setConf("texas", 2005, 2023, "Big 12");
  setConf("oklahoma", 2005, 2023, "Big 12");

  // USC & UCLA were Pac-12 until 2023
  setConf("southern-california", 2005, 2023, "Pac-12");
  setConf("ucla", 2005, 2023, "Pac-12");

  // Oregon & Washington were Pac-12 until 2023
  setConf("oregon", 2005, 2023, "Pac-12");
  setConf("washington", 2005, 2023, "Pac-12");

  // Colorado: Big 12 (2005-2010), Pac-12 (2011-2023), Big 12 (2024)
  setConf("colorado", 2005, 2010, "Big 12");
  setConf("colorado", 2011, 2023, "Pac-12");

  // Utah: Mountain West (2005-2010), Pac-12 (2011-2023), Big 12 (2024)
  setConf("utah", 2005, 2010, "Mountain West");
  setConf("utah", 2011, 2023, "Pac-12");

  // Arizona & Arizona State: Pac-12 (2005-2023), Big 12 (2024)
  setConf("arizona", 2005, 2023, "Pac-12");
  setConf("arizona-state", 2005, 2023, "Pac-12");

  // Cal & Stanford: Pac-12 (2005-2023), ACC (2024)
  setConf("california", 2005, 2023, "Pac-12");
  setConf("stanford", 2005, 2023, "Pac-12");

  // SMU: C-USA (2005-2012), AAC (2013-2023), ACC (2024)
  setConf("southern-methodist", 2005, 2012, "Conference USA");
  setConf("southern-methodist", 2013, 2023, "AAC");

  // Oregon State & Washington State stayed Pac-12
  setConf("oregon-state", 2005, 2024, "Pac-12");
  setConf("washington-state", 2005, 2024, "Pac-12");

  // Pac-12 teams that didn't move (were always Pac-12 2005-2023):
  // Already handled above individually

  // Missouri: Big 12 (2005-2011), SEC (2012-2024)
  setConf("missouri", 2005, 2011, "Big 12");

  // Texas A&M: Big 12 (2005-2011), SEC (2012-2024)
  setConf("texas-am", 2005, 2011, "Big 12");

  // Nebraska: Big 12 (2005-2010), Big Ten (2011-2024)
  setConf("nebraska", 2005, 2010, "Big 12");

  // Maryland: ACC (2005-2013), Big Ten (2014-2024)
  setConf("maryland", 2005, 2013, "ACC");

  // Rutgers: Big East (2005-2013), Big Ten (2014-2024)
  setConf("rutgers", 2005, 2013, "Big East");

  // Louisville: C-USA (2005), Big East (2005-2013), ACC (2014-2024)
  setConf("louisville", 2005, 2013, "Big East");

  // West Virginia: Big East (2005-2011), Big 12 (2012-2024)
  setConf("west-virginia", 2005, 2011, "Big East");

  // TCU: C-USA (2005), Mountain West (2005-2011), Big 12 (2012-2024)
  setConf("texas-christian", 2005, 2011, "Mountain West");

  // Cincinnati: C-USA (2005), Big East (2005-2012), AAC (2013-2022), Big 12 (2023-2024)
  setConf("cincinnati", 2005, 2012, "Big East");
  setConf("cincinnati", 2013, 2022, "AAC");

  // UCF: C-USA (2005-2012), AAC (2013-2022), Big 12 (2023-2024)
  setConf("central-florida", 2005, 2012, "Conference USA");
  setConf("central-florida", 2013, 2022, "AAC");

  // Houston: C-USA (2005-2012), AAC (2013-2022), Big 12 (2023-2024)
  setConf("houston", 2005, 2012, "Conference USA");
  setConf("houston", 2013, 2022, "AAC");

  // BYU: Mountain West (2005-2010), Independent (2011-2022), Big 12 (2023-2024)
  setConf("brigham-young", 2005, 2010, "Mountain West");
  setConf("brigham-young", 2011, 2022, "Independent");

  // Iowa State: Big 12 all years (already default)
  // Kansas: Big 12 all years
  // Kansas State: Big 12 all years
  // Oklahoma State: Big 12 all years
  // Texas Tech: Big 12 all years
  // Baylor: Big 12 all years

  // Pittsburgh: Big East (2005-2012), ACC (2013-2024)
  setConf("pittsburgh", 2005, 2012, "Big East");

  // Syracuse: Big East (2005-2012), ACC (2013-2024)
  setConf("syracuse", 2005, 2012, "Big East");

  // Notre Dame: Independent always
  setConf("notre-dame", 2005, 2024, "Independent");

  // UConn: Big East (2005-2012), AAC (2013-2019), Independent (2020-2024)
  setConf("connecticut", 2005, 2012, "Big East");
  setConf("connecticut", 2013, 2019, "AAC");
  setConf("connecticut", 2020, 2024, "Independent");

  // UMass: FCS (2005-2011), MAC (2012-2015), Independent (2016-2024)
  setConf("massachusetts", 2005, 2011, "FCS");
  setConf("massachusetts", 2012, 2015, "MAC");
  setConf("massachusetts", 2016, 2024, "Independent");

  // Army: C-USA (2005), Independent (2005-2023), AAC (2024)
  setConf("army", 2005, 2023, "Independent");

  // Navy: Independent (2005-2014 football), AAC (2015-2024)
  // Actually Navy joined AAC in 2015 for football
  setConf("navy", 2005, 2014, "Independent");
  setConf("navy", 2015, 2024, "AAC");

  // Memphis: C-USA (2005-2012), AAC (2013-2024)
  setConf("memphis", 2005, 2012, "Conference USA");

  // Temple: MAC (2005-2006), Independent (2007-2011), Big East (2012), AAC (2013-2024)
  setConf("temple", 2005, 2006, "MAC");
  setConf("temple", 2007, 2011, "Independent");
  setConf("temple", 2012, 2012, "Big East");

  // Tulane: C-USA (2005-2013), AAC (2014-2024)
  setConf("tulane", 2005, 2013, "Conference USA");

  // Tulsa: C-USA (2005-2013), AAC (2014-2024)
  setConf("tulsa", 2005, 2013, "Conference USA");

  // East Carolina: C-USA (2005-2013), AAC (2014-2024)
  setConf("east-carolina", 2005, 2013, "Conference USA");

  // Charlotte: FCS/none (2005-2014), C-USA (2015-2022), AAC (2023-2024)
  setConf("charlotte", 2005, 2014, "FCS");
  setConf("charlotte", 2015, 2022, "Conference USA");

  // FAU: Sun Belt (2005-2012), C-USA (2013-2022), AAC (2023-2024)
  setConf("florida-atlantic", 2005, 2012, "Sun Belt");
  setConf("florida-atlantic", 2013, 2022, "Conference USA");

  // North Texas: Sun Belt (2005-2012), C-USA (2013-2022), AAC (2023-2024)
  setConf("north-texas", 2005, 2012, "Sun Belt");
  setConf("north-texas", 2013, 2022, "Conference USA");

  // Rice: C-USA (2005-2022), AAC (2023-2024)
  setConf("rice", 2005, 2022, "Conference USA");

  // USF: Big East (2005-2012), AAC (2013-2024)
  setConf("south-florida", 2005, 2012, "Big East");

  // UTSA: WAC/C-USA (2012-2022), AAC (2023-2024)
  setConf("texas-san-antonio", 2005, 2011, "FCS");
  setConf("texas-san-antonio", 2012, 2012, "WAC");
  setConf("texas-san-antonio", 2013, 2022, "Conference USA");

  // UAB: C-USA (2005-2014), shutdown (2015), C-USA (2017-2022), AAC (2023-2024)
  setConf("alabama-birmingham", 2005, 2022, "Conference USA");

  // Appalachian State: FCS (2005-2013), Sun Belt (2014-2024)
  setConf("appalachian-state", 2005, 2013, "FCS");

  // Georgia Southern: FCS (2005-2013), Sun Belt (2014-2024)
  setConf("georgia-southern", 2005, 2013, "FCS");

  // Georgia State: FCS (2005-2012), Sun Belt (2013-2024)
  setConf("georgia-state", 2005, 2012, "FCS");

  // Coastal Carolina: FCS (2005-2016), Sun Belt (2017-2024)
  setConf("coastal-carolina", 2005, 2016, "FCS");

  // James Madison: FCS (2005-2021), Sun Belt (2022-2024)
  setConf("james-madison", 2005, 2021, "FCS");

  // Marshall: C-USA (2005-2004), C-USA (2005-2022), Sun Belt (2023-2024)
  setConf("marshall", 2005, 2022, "Conference USA");

  // Old Dominion: FCS (2005-2012), C-USA (2013-2022), Sun Belt (2023-2024)
  setConf("old-dominion", 2005, 2012, "FCS");
  setConf("old-dominion", 2013, 2022, "Conference USA");

  // Southern Miss: C-USA (2005-2012), C-USA (2013-2022), Sun Belt (2023-2024)
  setConf("southern-mississippi", 2005, 2022, "Conference USA");

  // South Alabama: FCS/Sun Belt from start
  setConf("south-alabama", 2005, 2011, "FCS");
  setConf("south-alabama", 2012, 2024, "Sun Belt");

  // Texas State: FCS (2005-2011), WAC (2012), Sun Belt (2013-2024)
  setConf("texas-state", 2005, 2011, "FCS");
  setConf("texas-state", 2012, 2012, "WAC");

  // Troy: Sun Belt all years
  // Arkansas State: Sun Belt all years
  // Louisiana: Sun Belt all years
  // Louisiana-Monroe: Sun Belt all years

  // Idaho: WAC (2005-2011), Sun Belt (2012-2013), Sun Belt (2014-2017), FCS (2018+)
  setConf("idaho", 2005, 2011, "WAC");
  setConf("idaho", 2012, 2013, "Sun Belt");
  setConf("idaho", 2014, 2017, "Sun Belt");
  setConf("idaho", 2018, 2024, "FCS");

  // Air Force: Mountain West all years

  // Boise State: WAC (2005-2010), Mountain West (2011-2024)
  setConf("boise-state", 2005, 2010, "WAC");

  // Fresno State: WAC (2005-2012), Mountain West (2013-2024)
  setConf("fresno-state", 2005, 2012, "WAC");

  // Hawaii: WAC (2005-2011), Mountain West (2012-2024)
  setConf("hawaii", 2005, 2011, "WAC");

  // Nevada: WAC (2005-2011), Mountain West (2012-2024)
  setConf("nevada", 2005, 2011, "WAC");

  // UNLV: Mountain West all years

  // San Diego State: Mountain West (2005-2010), Mountain West all years actually
  // SDSU briefly was in WAC-era but has been MW since at least 1999

  // San Jose State: WAC (2005-2012), Mountain West (2013-2024)
  setConf("san-jose-state", 2005, 2012, "WAC");

  // Utah State: WAC (2005-2012), Mountain West (2013-2024)
  setConf("utah-state", 2005, 2012, "WAC");

  // Colorado State: Mountain West all years
  // New Mexico: Mountain West all years
  // Wyoming: Mountain West all years

  // Liberty: FCS (2005-2017), Independent (2018-2022), C-USA (2023-2024)
  setConf("liberty", 2005, 2017, "FCS");
  setConf("liberty", 2018, 2022, "Independent");

  // Jacksonville State: FCS (2005-2022), C-USA (2023-2024)
  setConf("jacksonville-state", 2005, 2022, "FCS");

  // Kennesaw State: FCS (2005-2023), C-USA (2024)
  setConf("kennesaw-state", 2005, 2023, "FCS");

  // Sam Houston: FCS (2005-2022), C-USA (2023-2024)
  setConf("sam-houston-state", 2005, 2022, "FCS");

  // Louisiana Tech: WAC (2005-2012), C-USA (2013-2024)
  setConf("louisiana-tech", 2005, 2012, "WAC");

  // Middle Tennessee: Sun Belt (2005-2012), C-USA (2013-2024)
  setConf("middle-tennessee-state", 2005, 2012, "Sun Belt");

  // FIU: FCS (2005), Sun Belt (2005-2012), C-USA (2013-2024)
  setConf("florida-international", 2005, 2012, "Sun Belt");

  // UTEP: C-USA all years (2005-2024)
  // Western Kentucky: FCS (2005-2008), Sun Belt (2009-2013), C-USA (2014-2024)
  setConf("western-kentucky", 2005, 2008, "FCS");
  setConf("western-kentucky", 2009, 2013, "Sun Belt");

  // New Mexico State: WAC (2005-2012), Sun Belt (2013), Independent (2014-2017),
  //                   Independent (2018-2022), C-USA (2023-2024)
  setConf("new-mexico-state", 2005, 2012, "WAC");
  setConf("new-mexico-state", 2013, 2013, "Sun Belt");
  setConf("new-mexico-state", 2014, 2022, "Independent");

  return history;
}

// ─── Normalize games ────────────────────────────────────────────────────────

const staged = [];
let resolvedHome = 0;
let resolvedAway = 0;
let unresolvedHome = 0;
let unresolvedAway = 0;
let confGames = 0;

for (const g of raw) {
  // Resolve canonical team names
  const homeCanonical = g.homeSlug ? slugToCanonical[g.homeSlug] || null : null;
  const awayCanonical = g.awaySlug ? slugToCanonical[g.awaySlug] || null : null;

  if (homeCanonical) resolvedHome++;
  else unresolvedHome++;
  if (awayCanonical) resolvedAway++;
  else unresolvedAway++;

  // Determine winner
  let winnerCanonical = null;
  if (g.homeScore > g.awayScore) {
    winnerCanonical = homeCanonical;
  } else if (g.awayScore > g.homeScore) {
    winnerCanonical = awayCanonical;
  }

  // Conference game detection
  const homeConf = g.homeSlug && teamData[g.homeSlug]
    ? (conferenceHistory[g.homeSlug] || {})[g.season] || teamData[g.homeSlug].conference
    : null;
  const awayConf = g.awaySlug && teamData[g.awaySlug]
    ? (conferenceHistory[g.awaySlug] || {})[g.season] || teamData[g.awaySlug].conference
    : null;

  const isConferenceGame =
    homeConf !== null &&
    awayConf !== null &&
    homeConf === awayConf &&
    homeConf !== "Independent" &&
    homeConf !== "FCS";

  if (isConferenceGame) confGames++;

  // Venue type for weather purposes
  const homeVenueType = g.homeSlug && teamData[g.homeSlug]
    ? teamData[g.homeSlug].venueType
    : "OUTDOOR";

  // Score difference (signed, from home perspective)
  const scoreDifference = g.homeScore - g.awayScore;

  // Determine primetime (simplified for NCAAF)
  let isPrimetime = false;
  let primetimeSlot = null;

  if (g.kickoffTime) {
    const time = g.kickoffTime.toUpperCase();
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/);
    if (match) {
      let hour = parseInt(match[1]);
      const ampm = match[3];
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (hour >= 19) {
        isPrimetime = true;
        if (g.dayOfWeek === "Sat") primetimeSlot = "Saturday Night";
        else if (g.dayOfWeek === "Fri") primetimeSlot = "Friday Night";
        else if (g.dayOfWeek === "Thu") primetimeSlot = "Thursday Night";
        else primetimeSlot = "Weeknight";
      }
    }
  }

  staged.push({
    season: g.season,
    week: g.week,
    dayOfWeek: g.dayOfWeek,
    gameDate: g.gameDate,
    kickoffTime: g.kickoffTime,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeTeamCanonical: homeCanonical || g.homeTeam,
    awayTeamCanonical: awayCanonical || g.awayTeam,
    homeSlug: g.homeSlug,
    awaySlug: g.awaySlug,
    homeScore: g.homeScore,
    awayScore: g.awayScore,
    scoreDifference,
    winnerCanonical,
    homeRank: g.homeRank,
    awayRank: g.awayRank,
    homeFBS: g.homeFBS,
    awayFBS: g.awayFBS,
    homeConference: homeConf,
    awayConference: awayConf,
    isConferenceGame,
    isBowlGame: g.isBowlGame,
    bowlName: g.bowlName,
    isPlayoff: g.isPlayoff,
    isNeutralSite: g.isNeutralSite,
    isPrimetime,
    primetimeSlot,
    homeVenueType,
    temperature: null,
    windMph: null,
    weatherCategory: homeVenueType === "DOME" ? "DOME" : null,
    spread: null,
    overUnder: null,
    spreadResult: null,
    ouResult: null,
    source: "sports-reference.com",
  });
}

// ─── Save ─────────────────────────────────────────────────────────────────

const outputPath = path.join(__dirname, "../../data/ncaaf-games-staging.json");
fs.writeFileSync(outputPath, JSON.stringify(staged, null, 2));

console.log("\n═══ NORMALIZATION COMPLETE ═══");
console.log(`Total games: ${staged.length}`);
console.log(`Home names resolved: ${resolvedHome} (${unresolvedHome} unresolved)`);
console.log(`Away names resolved: ${resolvedAway} (${unresolvedAway} unresolved)`);
console.log(`Conference games: ${confGames}`);

// Filter to both-FBS games
const bothFBS = staged.filter((g) => g.homeFBS && g.awayFBS);
console.log(`\nBoth-FBS games: ${bothFBS.length}`);

// Conference breakdown
const confCount = {};
for (const g of bothFBS) {
  if (g.isConferenceGame && g.homeConference) {
    confCount[g.homeConference] = (confCount[g.homeConference] || 0) + 1;
  }
}
console.log("\nConference games by conference:");
Object.entries(confCount)
  .sort((a, b) => b[1] - a[1])
  .forEach(([c, n]) => console.log(`  ${c}: ${n}`));

// Bowl & Playoff
const bowls = staged.filter((g) => g.isBowlGame);
const playoffs = staged.filter((g) => g.isPlayoff);
console.log(`\nBowl games: ${bowls.length}`);
console.log(`Playoff/Championship games: ${playoffs.length}`);

// Ranked
const ranked = staged.filter((g) => g.homeRank || g.awayRank);
const bothRanked = staged.filter((g) => g.homeRank && g.awayRank);
console.log(`Games with ranked team: ${ranked.length}`);
console.log(`Ranked vs ranked: ${bothRanked.length}`);

// Dome games
const domes = staged.filter((g) => g.weatherCategory === "DOME");
console.log(`Dome games: ${domes.length}`);

// Primetime
const primetime = staged.filter((g) => g.isPrimetime);
console.log(`Primetime games: ${primetime.length}`);

// Games per season
console.log("\n─── Games per Season ───");
const bySeason = {};
for (const g of staged) {
  bySeason[g.season] = (bySeason[g.season] || 0) + 1;
}
Object.entries(bySeason)
  .sort(([a], [b]) => a - b)
  .forEach(([s, c]) => console.log(`  ${s}: ${c}`));

console.log(`\nSaved: ${outputPath}`);
