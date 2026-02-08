/**
 * NCAAF Conference History (2005-2024)
 *
 * Maps each FBS team to their conference for each season, accounting for:
 * - Major conference realignment (Big 12 → SEC, Pac-12 dissolution, etc.)
 * - Teams transitioning from FCS to FBS
 * - Independent status changes
 *
 * Used for determining conference game status and conference filtering in queries.
 */

export type Conference =
  | "SEC"
  | "Big Ten"
  | "Big 12"
  | "ACC"
  | "Pac-12"
  | "AAC"
  | "Mountain West"
  | "MAC"
  | "Conference USA"
  | "Sun Belt"
  | "Big East"
  | "WAC"
  | "Independent"
  | "FCS";

interface ConferenceMove {
  slug: string;
  startYear: number;
  endYear: number;
  conference: Conference;
}

/**
 * All conference membership changes for FBS teams (2005-2024).
 * Only teams that changed conferences are listed; teams that stayed
 * in one conference the entire period use the fallback in getConference().
 */
const CONFERENCE_MOVES: ConferenceMove[] = [
  // ─── SEC additions ─────────────────────────────────────────────
  { slug: "texas", startYear: 2005, endYear: 2023, conference: "Big 12" },
  { slug: "oklahoma", startYear: 2005, endYear: 2023, conference: "Big 12" },
  { slug: "missouri", startYear: 2005, endYear: 2011, conference: "Big 12" },
  { slug: "texas-am", startYear: 2005, endYear: 2011, conference: "Big 12" },

  // ─── Big Ten additions ─────────────────────────────────────────
  { slug: "southern-california", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "ucla", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "oregon", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "washington", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "nebraska", startYear: 2005, endYear: 2010, conference: "Big 12" },
  { slug: "maryland", startYear: 2005, endYear: 2013, conference: "ACC" },
  { slug: "rutgers", startYear: 2005, endYear: 2013, conference: "Big East" },

  // ─── Big 12 changes ────────────────────────────────────────────
  { slug: "colorado", startYear: 2005, endYear: 2010, conference: "Big 12" },
  { slug: "colorado", startYear: 2011, endYear: 2023, conference: "Pac-12" },
  { slug: "utah", startYear: 2005, endYear: 2010, conference: "Mountain West" },
  { slug: "utah", startYear: 2011, endYear: 2023, conference: "Pac-12" },
  { slug: "arizona", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "arizona-state", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "west-virginia", startYear: 2005, endYear: 2011, conference: "Big East" },
  { slug: "texas-christian", startYear: 2005, endYear: 2011, conference: "Mountain West" },
  { slug: "cincinnati", startYear: 2005, endYear: 2012, conference: "Big East" },
  { slug: "cincinnati", startYear: 2013, endYear: 2022, conference: "AAC" },
  { slug: "central-florida", startYear: 2005, endYear: 2012, conference: "Conference USA" },
  { slug: "central-florida", startYear: 2013, endYear: 2022, conference: "AAC" },
  { slug: "houston", startYear: 2005, endYear: 2012, conference: "Conference USA" },
  { slug: "houston", startYear: 2013, endYear: 2022, conference: "AAC" },
  { slug: "brigham-young", startYear: 2005, endYear: 2010, conference: "Mountain West" },
  { slug: "brigham-young", startYear: 2011, endYear: 2022, conference: "Independent" },

  // ─── ACC changes ───────────────────────────────────────────────
  { slug: "california", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "stanford", startYear: 2005, endYear: 2023, conference: "Pac-12" },
  { slug: "southern-methodist", startYear: 2005, endYear: 2012, conference: "Conference USA" },
  { slug: "southern-methodist", startYear: 2013, endYear: 2023, conference: "AAC" },
  { slug: "pittsburgh", startYear: 2005, endYear: 2012, conference: "Big East" },
  { slug: "syracuse", startYear: 2005, endYear: 2012, conference: "Big East" },
  { slug: "louisville", startYear: 2005, endYear: 2013, conference: "Big East" },

  // ─── Pac-12 (remaining) ────────────────────────────────────────
  { slug: "oregon-state", startYear: 2005, endYear: 2024, conference: "Pac-12" },
  { slug: "washington-state", startYear: 2005, endYear: 2024, conference: "Pac-12" },

  // ─── Independents ──────────────────────────────────────────────
  { slug: "notre-dame", startYear: 2005, endYear: 2024, conference: "Independent" },
  { slug: "connecticut", startYear: 2005, endYear: 2012, conference: "Big East" },
  { slug: "connecticut", startYear: 2013, endYear: 2019, conference: "AAC" },
  { slug: "connecticut", startYear: 2020, endYear: 2024, conference: "Independent" },
  { slug: "massachusetts", startYear: 2005, endYear: 2011, conference: "FCS" },
  { slug: "massachusetts", startYear: 2012, endYear: 2015, conference: "MAC" },
  { slug: "massachusetts", startYear: 2016, endYear: 2024, conference: "Independent" },
  { slug: "army", startYear: 2005, endYear: 2023, conference: "Independent" },

  // ─── AAC changes ───────────────────────────────────────────────
  { slug: "navy", startYear: 2005, endYear: 2014, conference: "Independent" },
  { slug: "memphis", startYear: 2005, endYear: 2012, conference: "Conference USA" },
  { slug: "temple", startYear: 2005, endYear: 2006, conference: "MAC" },
  { slug: "temple", startYear: 2007, endYear: 2011, conference: "Independent" },
  { slug: "temple", startYear: 2012, endYear: 2012, conference: "Big East" },
  { slug: "tulane", startYear: 2005, endYear: 2013, conference: "Conference USA" },
  { slug: "tulsa", startYear: 2005, endYear: 2013, conference: "Conference USA" },
  { slug: "east-carolina", startYear: 2005, endYear: 2013, conference: "Conference USA" },
  { slug: "south-florida", startYear: 2005, endYear: 2012, conference: "Big East" },
  { slug: "charlotte", startYear: 2005, endYear: 2014, conference: "FCS" },
  { slug: "charlotte", startYear: 2015, endYear: 2022, conference: "Conference USA" },
  { slug: "florida-atlantic", startYear: 2005, endYear: 2012, conference: "Sun Belt" },
  { slug: "florida-atlantic", startYear: 2013, endYear: 2022, conference: "Conference USA" },
  { slug: "north-texas", startYear: 2005, endYear: 2012, conference: "Sun Belt" },
  { slug: "north-texas", startYear: 2013, endYear: 2022, conference: "Conference USA" },
  { slug: "rice", startYear: 2005, endYear: 2022, conference: "Conference USA" },
  { slug: "texas-san-antonio", startYear: 2005, endYear: 2011, conference: "FCS" },
  { slug: "texas-san-antonio", startYear: 2012, endYear: 2012, conference: "WAC" },
  { slug: "texas-san-antonio", startYear: 2013, endYear: 2022, conference: "Conference USA" },
  { slug: "alabama-birmingham", startYear: 2005, endYear: 2022, conference: "Conference USA" },

  // ─── Sun Belt changes ──────────────────────────────────────────
  { slug: "appalachian-state", startYear: 2005, endYear: 2013, conference: "FCS" },
  { slug: "georgia-southern", startYear: 2005, endYear: 2013, conference: "FCS" },
  { slug: "georgia-state", startYear: 2005, endYear: 2012, conference: "FCS" },
  { slug: "coastal-carolina", startYear: 2005, endYear: 2016, conference: "FCS" },
  { slug: "james-madison", startYear: 2005, endYear: 2021, conference: "FCS" },
  { slug: "marshall", startYear: 2005, endYear: 2022, conference: "Conference USA" },
  { slug: "old-dominion", startYear: 2005, endYear: 2012, conference: "FCS" },
  { slug: "old-dominion", startYear: 2013, endYear: 2022, conference: "Conference USA" },
  { slug: "southern-mississippi", startYear: 2005, endYear: 2022, conference: "Conference USA" },
  { slug: "south-alabama", startYear: 2005, endYear: 2011, conference: "FCS" },
  { slug: "texas-state", startYear: 2005, endYear: 2011, conference: "FCS" },
  { slug: "texas-state", startYear: 2012, endYear: 2012, conference: "WAC" },
  { slug: "middle-tennessee-state", startYear: 2005, endYear: 2012, conference: "Sun Belt" },

  // ─── Mountain West changes ─────────────────────────────────────
  { slug: "boise-state", startYear: 2005, endYear: 2010, conference: "WAC" },
  { slug: "fresno-state", startYear: 2005, endYear: 2012, conference: "WAC" },
  { slug: "hawaii", startYear: 2005, endYear: 2011, conference: "WAC" },
  { slug: "nevada", startYear: 2005, endYear: 2011, conference: "WAC" },
  { slug: "san-jose-state", startYear: 2005, endYear: 2012, conference: "WAC" },
  { slug: "utah-state", startYear: 2005, endYear: 2012, conference: "WAC" },

  // ─── Conference USA changes ────────────────────────────────────
  { slug: "liberty", startYear: 2005, endYear: 2017, conference: "FCS" },
  { slug: "liberty", startYear: 2018, endYear: 2022, conference: "Independent" },
  { slug: "jacksonville-state", startYear: 2005, endYear: 2022, conference: "FCS" },
  { slug: "kennesaw-state", startYear: 2005, endYear: 2023, conference: "FCS" },
  { slug: "sam-houston-state", startYear: 2005, endYear: 2022, conference: "FCS" },
  { slug: "louisiana-tech", startYear: 2005, endYear: 2012, conference: "WAC" },
  { slug: "florida-international", startYear: 2005, endYear: 2012, conference: "Sun Belt" },
  { slug: "western-kentucky", startYear: 2005, endYear: 2008, conference: "FCS" },
  { slug: "western-kentucky", startYear: 2009, endYear: 2013, conference: "Sun Belt" },
  { slug: "new-mexico-state", startYear: 2005, endYear: 2012, conference: "WAC" },
  { slug: "new-mexico-state", startYear: 2013, endYear: 2013, conference: "Sun Belt" },
  { slug: "new-mexico-state", startYear: 2014, endYear: 2022, conference: "Independent" },

  // ─── Idaho (dropped to FCS) ────────────────────────────────────
  { slug: "idaho", startYear: 2005, endYear: 2011, conference: "WAC" },
  { slug: "idaho", startYear: 2012, endYear: 2017, conference: "Sun Belt" },
  { slug: "idaho", startYear: 2018, endYear: 2024, conference: "FCS" },
];

// Build lookup index for fast access
const moveIndex: Map<string, ConferenceMove[]> = new Map();
for (const move of CONFERENCE_MOVES) {
  if (!moveIndex.has(move.slug)) {
    moveIndex.set(move.slug, []);
  }
  moveIndex.get(move.slug)!.push(move);
}

// Default 2024 conferences (for teams that didn't move)
const DEFAULT_CONFERENCES: Record<string, Conference> = {
  // SEC
  alabama: "SEC", arkansas: "SEC", auburn: "SEC", florida: "SEC",
  georgia: "SEC", kentucky: "SEC", "louisiana-state": "SEC",
  mississippi: "SEC", "mississippi-state": "SEC", missouri: "SEC",
  oklahoma: "SEC", "south-carolina": "SEC", tennessee: "SEC",
  texas: "SEC", "texas-am": "SEC", vanderbilt: "SEC",

  // Big Ten
  illinois: "Big Ten", indiana: "Big Ten", iowa: "Big Ten",
  maryland: "Big Ten", michigan: "Big Ten", "michigan-state": "Big Ten",
  minnesota: "Big Ten", nebraska: "Big Ten", northwestern: "Big Ten",
  "ohio-state": "Big Ten", oregon: "Big Ten", "penn-state": "Big Ten",
  purdue: "Big Ten", rutgers: "Big Ten", ucla: "Big Ten",
  "southern-california": "Big Ten", washington: "Big Ten", wisconsin: "Big Ten",

  // Big 12
  arizona: "Big 12", "arizona-state": "Big 12", baylor: "Big 12",
  "brigham-young": "Big 12", "central-florida": "Big 12",
  cincinnati: "Big 12", colorado: "Big 12", houston: "Big 12",
  "iowa-state": "Big 12", kansas: "Big 12", "kansas-state": "Big 12",
  "oklahoma-state": "Big 12", "texas-christian": "Big 12",
  "texas-tech": "Big 12", utah: "Big 12", "west-virginia": "Big 12",

  // ACC
  "boston-college": "ACC", california: "ACC", clemson: "ACC", duke: "ACC",
  "florida-state": "ACC", "georgia-tech": "ACC", louisville: "ACC",
  "miami-fl": "ACC", "north-carolina": "ACC", "north-carolina-state": "ACC",
  pittsburgh: "ACC", "southern-methodist": "ACC", stanford: "ACC",
  syracuse: "ACC", virginia: "ACC", "virginia-tech": "ACC",
  "wake-forest": "ACC",

  // AAC
  army: "AAC", charlotte: "AAC", "east-carolina": "AAC",
  "florida-atlantic": "AAC", memphis: "AAC", navy: "AAC",
  "north-texas": "AAC", rice: "AAC", "south-florida": "AAC",
  temple: "AAC", tulane: "AAC", tulsa: "AAC",
  "texas-san-antonio": "AAC", "alabama-birmingham": "AAC",

  // Sun Belt
  "appalachian-state": "Sun Belt", "arkansas-state": "Sun Belt",
  "coastal-carolina": "Sun Belt", "georgia-southern": "Sun Belt",
  "georgia-state": "Sun Belt", "james-madison": "Sun Belt",
  "louisiana-lafayette": "Sun Belt", "louisiana-monroe": "Sun Belt",
  marshall: "Sun Belt", "old-dominion": "Sun Belt",
  "south-alabama": "Sun Belt", "southern-mississippi": "Sun Belt",
  "texas-state": "Sun Belt", troy: "Sun Belt",

  // Mountain West
  "air-force": "Mountain West", "boise-state": "Mountain West",
  "colorado-state": "Mountain West", "fresno-state": "Mountain West",
  hawaii: "Mountain West", nevada: "Mountain West",
  "nevada-las-vegas": "Mountain West", "new-mexico": "Mountain West",
  "san-diego-state": "Mountain West", "san-jose-state": "Mountain West",
  "utah-state": "Mountain West", wyoming: "Mountain West",

  // MAC
  akron: "MAC", "ball-state": "MAC", "bowling-green-state": "MAC",
  buffalo: "MAC", "central-michigan": "MAC", "eastern-michigan": "MAC",
  "kent-state": "MAC", "miami-oh": "MAC", "northern-illinois": "MAC",
  ohio: "MAC", toledo: "MAC", "western-michigan": "MAC",

  // Conference USA
  "florida-international": "Conference USA", "jacksonville-state": "Conference USA",
  "kennesaw-state": "Conference USA", liberty: "Conference USA",
  "louisiana-tech": "Conference USA", "middle-tennessee-state": "Conference USA",
  "new-mexico-state": "Conference USA", "sam-houston-state": "Conference USA",
  "texas-el-paso": "Conference USA", "western-kentucky": "Conference USA",

  // Pac-12
  "oregon-state": "Pac-12", "washington-state": "Pac-12",

  // Independents
  "notre-dame": "Independent", connecticut: "Independent",
  massachusetts: "Independent",

  // FCS
  idaho: "FCS",
};

/**
 * Get the conference for a team in a given season.
 *
 * @param slug - Sports Reference team slug
 * @param season - The season year (e.g., 2023)
 * @returns The conference name, or null if unknown
 */
export function getConference(slug: string, season: number): Conference | null {
  // Check for specific moves first
  const moves = moveIndex.get(slug);
  if (moves) {
    for (const move of moves) {
      if (season >= move.startYear && season <= move.endYear) {
        return move.conference;
      }
    }
  }

  // Fall back to default 2024 conference
  return DEFAULT_CONFERENCES[slug] || null;
}

/**
 * Check if two teams are in the same conference for a given season.
 */
export function isConferenceGame(
  homeSlug: string,
  awaySlug: string,
  season: number
): boolean {
  const homeConf = getConference(homeSlug, season);
  const awayConf = getConference(awaySlug, season);

  if (!homeConf || !awayConf) return false;
  if (homeConf === "Independent" || awayConf === "Independent") return false;
  if (homeConf === "FCS" || awayConf === "FCS") return false;

  return homeConf === awayConf;
}

/**
 * Get all teams in a conference for a given season.
 */
export function getConferenceTeams(
  conference: Conference,
  season: number
): string[] {
  const teams: string[] = [];
  for (const slug of Object.keys(DEFAULT_CONFERENCES)) {
    if (getConference(slug, season) === conference) {
      teams.push(slug);
    }
  }
  return teams;
}

/**
 * Get all conferences active in a given season.
 */
export function getActiveConferences(season: number): Conference[] {
  const confs = new Set<Conference>();
  for (const slug of Object.keys(DEFAULT_CONFERENCES)) {
    const conf = getConference(slug, season);
    if (conf && conf !== "FCS") {
      confs.add(conf);
    }
  }
  return Array.from(confs).sort();
}
