/**
 * Historical NFL team name → current team name mapping.
 * Resolves relocations, rebrands, and common abbreviation variants.
 *
 * Key: any historical or variant name (lowercased)
 * Value: current canonical team name (matches Team.name in DB)
 */
export const nflTeamNameMap: Record<string, string> = {
  // ─── Current names (canonical) ──────────────────────────────
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

  // ─── Relocations ────────────────────────────────────────────

  // Raiders: Oakland → Los Angeles → Oakland → Las Vegas
  "oakland raiders": "Las Vegas Raiders",
  "los angeles raiders": "Las Vegas Raiders",

  // Rams: Los Angeles → St. Louis → Los Angeles
  "st. louis rams": "Los Angeles Rams",
  "st louis rams": "Los Angeles Rams",

  // Chargers: San Diego → Los Angeles
  "san diego chargers": "Los Angeles Chargers",

  // Colts: Baltimore → Indianapolis
  "baltimore colts": "Indianapolis Colts",

  // Cardinals: St. Louis → Phoenix → Arizona
  "st. louis cardinals": "Arizona Cardinals",
  "st louis cardinals": "Arizona Cardinals",
  "phoenix cardinals": "Arizona Cardinals",

  // Titans: Houston Oilers → Tennessee Oilers → Tennessee Titans
  "houston oilers": "Tennessee Titans",
  "tennessee oilers": "Tennessee Titans",

  // Washington: Redskins → Football Team → Commanders
  "washington redskins": "Washington Commanders",
  "washington football team": "Washington Commanders",

  // Patriots rebrand
  "boston patriots": "New England Patriots",

  // ─── Abbreviations ──────────────────────────────────────────
  ari: "Arizona Cardinals",
  atl: "Atlanta Falcons",
  bal: "Baltimore Ravens",
  buf: "Buffalo Bills",
  car: "Carolina Panthers",
  chi: "Chicago Bears",
  cin: "Cincinnati Bengals",
  cle: "Cleveland Browns",
  dal: "Dallas Cowboys",
  den: "Denver Broncos",
  det: "Detroit Lions",
  gb: "Green Bay Packers",
  gnb: "Green Bay Packers",
  hou: "Houston Texans",
  htx: "Houston Texans",
  ind: "Indianapolis Colts",
  jax: "Jacksonville Jaguars",
  jac: "Jacksonville Jaguars",
  kc: "Kansas City Chiefs",
  kan: "Kansas City Chiefs",
  lv: "Las Vegas Raiders",
  lvr: "Las Vegas Raiders",
  lac: "Los Angeles Chargers",
  lar: "Los Angeles Rams",
  la: "Los Angeles Rams", // ambiguous but Rams are more common
  mia: "Miami Dolphins",
  min: "Minnesota Vikings",
  ne: "New England Patriots",
  nwe: "New England Patriots",
  no: "New Orleans Saints",
  nor: "New Orleans Saints",
  nyg: "New York Giants",
  nyj: "New York Jets",
  phi: "Philadelphia Eagles",
  pit: "Pittsburgh Steelers",
  sf: "San Francisco 49ers",
  sfo: "San Francisco 49ers",
  sea: "Seattle Seahawks",
  tb: "Tampa Bay Buccaneers",
  tam: "Tampa Bay Buccaneers",
  ten: "Tennessee Titans",
  oti: "Tennessee Titans",
  was: "Washington Commanders",
  wsh: "Washington Commanders",

  // Historical abbreviations
  oak: "Las Vegas Raiders",
  rai: "Las Vegas Raiders",
  sdg: "Los Angeles Chargers",
  sd: "Los Angeles Chargers",
  stl: "Los Angeles Rams",
  ram: "Los Angeles Rams",

  // ─── Common short names ─────────────────────────────────────
  cardinals: "Arizona Cardinals",
  falcons: "Atlanta Falcons",
  ravens: "Baltimore Ravens",
  bills: "Buffalo Bills",
  panthers: "Carolina Panthers",
  bears: "Chicago Bears",
  bengals: "Cincinnati Bengals",
  browns: "Cleveland Browns",
  cowboys: "Dallas Cowboys",
  broncos: "Denver Broncos",
  lions: "Detroit Lions",
  packers: "Green Bay Packers",
  texans: "Houston Texans",
  colts: "Indianapolis Colts",
  jaguars: "Jacksonville Jaguars",
  jags: "Jacksonville Jaguars",
  chiefs: "Kansas City Chiefs",
  raiders: "Las Vegas Raiders",
  chargers: "Los Angeles Chargers",
  rams: "Los Angeles Rams",
  dolphins: "Miami Dolphins",
  phins: "Miami Dolphins",
  vikings: "Minnesota Vikings",
  patriots: "New England Patriots",
  pats: "New England Patriots",
  saints: "New Orleans Saints",
  giants: "New York Giants",
  jets: "New York Jets",
  eagles: "Philadelphia Eagles",
  steelers: "Pittsburgh Steelers",
  niners: "San Francisco 49ers",
  "49ers": "San Francisco 49ers",
  seahawks: "Seattle Seahawks",
  hawks: "Seattle Seahawks",
  buccaneers: "Tampa Bay Buccaneers",
  bucs: "Tampa Bay Buccaneers",
  titans: "Tennessee Titans",
  commanders: "Washington Commanders",
  commies: "Washington Commanders",
  redskins: "Washington Commanders",
};

/**
 * Resolve any team name (historical, abbreviated, or current) to the canonical current name.
 * Case-insensitive.
 *
 * @returns The current canonical team name, or null if not found.
 */
export function resolveNFLTeamName(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  return nflTeamNameMap[normalized] ?? null;
}

/**
 * Build a reverse lookup: canonical name → all known aliases.
 * Useful for search/autocomplete.
 */
export function getTeamAliases(): Record<string, string[]> {
  const aliases: Record<string, string[]> = {};
  for (const [alias, canonical] of Object.entries(nflTeamNameMap)) {
    if (!aliases[canonical]) {
      aliases[canonical] = [];
    }
    aliases[canonical].push(alias);
  }
  return aliases;
}
