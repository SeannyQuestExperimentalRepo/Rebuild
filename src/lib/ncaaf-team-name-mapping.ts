/**
 * NCAAF (FBS) team name → canonical team name mapping.
 * Resolves abbreviations, alternate names, mascots, and Sports Reference slugs.
 *
 * Key: any variant name (lowercased)
 * Value: canonical team name (matches Team.name in DB from ncaaf-teams.ts)
 */
export const ncaafTeamNameMap: Record<string, string> = {
  // ─── SEC (16 teams) ───────────────────────────────

  // Alabama Crimson Tide
  "alabama crimson tide": "Alabama Crimson Tide",
  alabama: "Alabama Crimson Tide",
  bama: "Alabama Crimson Tide",
  ala: "Alabama Crimson Tide",
  "crimson tide": "Alabama Crimson Tide",
  "roll tide": "Alabama Crimson Tide",

  // Arkansas Razorbacks
  "arkansas razorbacks": "Arkansas Razorbacks",
  arkansas: "Arkansas Razorbacks",
  ark: "Arkansas Razorbacks",
  razorbacks: "Arkansas Razorbacks",
  hogs: "Arkansas Razorbacks",

  // Auburn Tigers
  "auburn tigers": "Auburn Tigers",
  auburn: "Auburn Tigers",
  aub: "Auburn Tigers",
  "war eagle": "Auburn Tigers",

  // Florida Gators
  "florida gators": "Florida Gators",
  florida: "Florida Gators",
  fla: "Florida Gators",
  gators: "Florida Gators",
  uf: "Florida Gators",

  // Georgia Bulldogs
  "georgia bulldogs": "Georgia Bulldogs",
  georgia: "Georgia Bulldogs",
  uga: "Georgia Bulldogs",
  dawgs: "Georgia Bulldogs",

  // Kentucky Wildcats
  "kentucky wildcats": "Kentucky Wildcats",
  kentucky: "Kentucky Wildcats",
  uk: "Kentucky Wildcats",

  // LSU Tigers
  "lsu tigers": "LSU Tigers",
  lsu: "LSU Tigers",
  "louisiana state": "LSU Tigers",
  "louisiana state tigers": "LSU Tigers",
  "bayou bengals": "LSU Tigers",

  // Ole Miss Rebels
  "ole miss rebels": "Ole Miss Rebels",
  "ole miss": "Ole Miss Rebels",
  miss: "Ole Miss Rebels",
  mississippi: "Ole Miss Rebels",
  "mississippi rebels": "Ole Miss Rebels",

  // Mississippi State Bulldogs
  "mississippi state bulldogs": "Mississippi State Bulldogs",
  "mississippi state": "Mississippi State Bulldogs",
  "miss state": "Mississippi State Bulldogs",
  "miss st": "Mississippi State Bulldogs",
  msst: "Mississippi State Bulldogs",

  // Missouri Tigers
  "missouri tigers": "Missouri Tigers",
  missouri: "Missouri Tigers",
  miz: "Missouri Tigers",
  mizzou: "Missouri Tigers",

  // Oklahoma Sooners
  "oklahoma sooners": "Oklahoma Sooners",
  oklahoma: "Oklahoma Sooners",
  ou: "Oklahoma Sooners",
  sooners: "Oklahoma Sooners",

  // South Carolina Gamecocks
  "south carolina gamecocks": "South Carolina Gamecocks",
  "south carolina": "South Carolina Gamecocks",
  sc: "South Carolina Gamecocks",
  gamecocks: "South Carolina Gamecocks",
  "s carolina": "South Carolina Gamecocks",

  // Tennessee Volunteers
  "tennessee volunteers": "Tennessee Volunteers",
  tennessee: "Tennessee Volunteers",
  tenn: "Tennessee Volunteers",
  vols: "Tennessee Volunteers",
  volunteers: "Tennessee Volunteers",

  // Texas Longhorns
  "texas longhorns": "Texas Longhorns",
  texas: "Texas Longhorns",
  tex: "Texas Longhorns",
  longhorns: "Texas Longhorns",
  "hook em": "Texas Longhorns",

  // Texas A&M Aggies
  "texas a&m aggies": "Texas A&M Aggies",
  "texas a&m": "Texas A&M Aggies",
  "texas am": "Texas A&M Aggies",
  "texas a and m": "Texas A&M Aggies",
  tamu: "Texas A&M Aggies",
  aggies: "Texas A&M Aggies",
  "a&m": "Texas A&M Aggies",

  // Vanderbilt Commodores
  "vanderbilt commodores": "Vanderbilt Commodores",
  vanderbilt: "Vanderbilt Commodores",
  van: "Vanderbilt Commodores",
  vandy: "Vanderbilt Commodores",
  commodores: "Vanderbilt Commodores",

  // ─── BIG TEN (18 teams) ──────────────────────────

  // Illinois Fighting Illini
  "illinois fighting illini": "Illinois Fighting Illini",
  illinois: "Illinois Fighting Illini",
  ill: "Illinois Fighting Illini",
  illini: "Illinois Fighting Illini",
  "fighting illini": "Illinois Fighting Illini",

  // Indiana Hoosiers
  "indiana hoosiers": "Indiana Hoosiers",
  indiana: "Indiana Hoosiers",
  ind: "Indiana Hoosiers",
  hoosiers: "Indiana Hoosiers",
  iu: "Indiana Hoosiers",

  // Iowa Hawkeyes
  "iowa hawkeyes": "Iowa Hawkeyes",
  iowa: "Iowa Hawkeyes",
  hawkeyes: "Iowa Hawkeyes",

  // Maryland Terrapins
  "maryland terrapins": "Maryland Terrapins",
  maryland: "Maryland Terrapins",
  md: "Maryland Terrapins",
  terps: "Maryland Terrapins",
  terrapins: "Maryland Terrapins",

  // Michigan Wolverines
  "michigan wolverines": "Michigan Wolverines",
  michigan: "Michigan Wolverines",
  mich: "Michigan Wolverines",
  wolverines: "Michigan Wolverines",
  "go blue": "Michigan Wolverines",

  // Michigan State Spartans
  "michigan state spartans": "Michigan State Spartans",
  "michigan state": "Michigan State Spartans",
  "michigan st": "Michigan State Spartans",
  msu: "Michigan State Spartans",

  // Minnesota Golden Gophers
  "minnesota golden gophers": "Minnesota Golden Gophers",
  minnesota: "Minnesota Golden Gophers",
  minn: "Minnesota Golden Gophers",
  gophers: "Minnesota Golden Gophers",
  "golden gophers": "Minnesota Golden Gophers",

  // Nebraska Cornhuskers
  "nebraska cornhuskers": "Nebraska Cornhuskers",
  nebraska: "Nebraska Cornhuskers",
  neb: "Nebraska Cornhuskers",
  cornhuskers: "Nebraska Cornhuskers",
  huskers: "Nebraska Cornhuskers",

  // Northwestern Wildcats
  "northwestern wildcats": "Northwestern Wildcats",
  northwestern: "Northwestern Wildcats",
  nw: "Northwestern Wildcats",
  nwu: "Northwestern Wildcats",

  // Ohio State Buckeyes
  "ohio state buckeyes": "Ohio State Buckeyes",
  "ohio state": "Ohio State Buckeyes",
  "ohio st": "Ohio State Buckeyes",
  osu: "Ohio State Buckeyes",
  tosu: "Ohio State Buckeyes",
  buckeyes: "Ohio State Buckeyes",

  // Oregon Ducks
  "oregon ducks": "Oregon Ducks",
  oregon: "Oregon Ducks",
  ore: "Oregon Ducks",
  ducks: "Oregon Ducks",

  // Penn State Nittany Lions
  "penn state nittany lions": "Penn State Nittany Lions",
  "penn state": "Penn State Nittany Lions",
  "penn st": "Penn State Nittany Lions",
  psu: "Penn State Nittany Lions",
  "nittany lions": "Penn State Nittany Lions",

  // Purdue Boilermakers
  "purdue boilermakers": "Purdue Boilermakers",
  purdue: "Purdue Boilermakers",
  pur: "Purdue Boilermakers",
  boilermakers: "Purdue Boilermakers",

  // Rutgers Scarlet Knights
  "rutgers scarlet knights": "Rutgers Scarlet Knights",
  rutgers: "Rutgers Scarlet Knights",
  rut: "Rutgers Scarlet Knights",
  "scarlet knights": "Rutgers Scarlet Knights",

  // UCLA Bruins
  "ucla bruins": "UCLA Bruins",
  ucla: "UCLA Bruins",
  bruins: "UCLA Bruins",

  // USC Trojans
  "usc trojans": "USC Trojans",
  usc: "USC Trojans",
  trojans: "USC Trojans",
  "southern california": "USC Trojans",
  "southern cal": "USC Trojans",
  "so cal": "USC Trojans",

  // Washington Huskies
  "washington huskies": "Washington Huskies",
  washington: "Washington Huskies",
  wash: "Washington Huskies",
  udub: "Washington Huskies",

  // Wisconsin Badgers
  "wisconsin badgers": "Wisconsin Badgers",
  wisconsin: "Wisconsin Badgers",
  wis: "Wisconsin Badgers",
  wisc: "Wisconsin Badgers",
  badgers: "Wisconsin Badgers",

  // ─── BIG 12 (16 teams) ───────────────────────────

  // Arizona Wildcats
  "arizona wildcats": "Arizona Wildcats",
  arizona: "Arizona Wildcats",
  ariz: "Arizona Wildcats",

  // Arizona State Sun Devils
  "arizona state sun devils": "Arizona State Sun Devils",
  "arizona state": "Arizona State Sun Devils",
  "arizona st": "Arizona State Sun Devils",
  asu: "Arizona State Sun Devils",
  "sun devils": "Arizona State Sun Devils",

  // Baylor Bears
  "baylor bears": "Baylor Bears",
  baylor: "Baylor Bears",
  bay: "Baylor Bears",

  // BYU Cougars
  "byu cougars": "BYU Cougars",
  byu: "BYU Cougars",
  "brigham young": "BYU Cougars",
  "brigham young cougars": "BYU Cougars",

  // UCF Knights
  "ucf knights": "UCF Knights",
  ucf: "UCF Knights",
  "central florida": "UCF Knights",
  "central florida knights": "UCF Knights",
  knights: "UCF Knights",

  // Cincinnati Bearcats
  "cincinnati bearcats": "Cincinnati Bearcats",
  cincinnati: "Cincinnati Bearcats",
  cin: "Cincinnati Bearcats",
  cincy: "Cincinnati Bearcats",
  bearcats: "Cincinnati Bearcats",

  // Colorado Buffaloes
  "colorado buffaloes": "Colorado Buffaloes",
  colorado: "Colorado Buffaloes",
  col: "Colorado Buffaloes",
  colo: "Colorado Buffaloes",
  cu: "Colorado Buffaloes",
  buffaloes: "Colorado Buffaloes",
  buffs: "Colorado Buffaloes",

  // Houston Cougars
  "houston cougars": "Houston Cougars",
  houston: "Houston Cougars",
  hou: "Houston Cougars",
  coogs: "Houston Cougars",

  // Iowa State Cyclones
  "iowa state cyclones": "Iowa State Cyclones",
  "iowa state": "Iowa State Cyclones",
  "iowa st": "Iowa State Cyclones",
  isu: "Iowa State Cyclones",
  cyclones: "Iowa State Cyclones",

  // Kansas Jayhawks
  "kansas jayhawks": "Kansas Jayhawks",
  kansas: "Kansas Jayhawks",
  ku: "Kansas Jayhawks",
  jayhawks: "Kansas Jayhawks",

  // Kansas State Wildcats
  "kansas state wildcats": "Kansas State Wildcats",
  "kansas state": "Kansas State Wildcats",
  "kansas st": "Kansas State Wildcats",
  ksu: "Kansas State Wildcats",
  "k-state": "Kansas State Wildcats",

  // Oklahoma State Cowboys
  "oklahoma state cowboys": "Oklahoma State Cowboys",
  "oklahoma state": "Oklahoma State Cowboys",
  "oklahoma st": "Oklahoma State Cowboys",
  okst: "Oklahoma State Cowboys",
  "ok state": "Oklahoma State Cowboys",
  "okla state": "Oklahoma State Cowboys",
  "okla st": "Oklahoma State Cowboys",

  // TCU Horned Frogs
  "tcu horned frogs": "TCU Horned Frogs",
  tcu: "TCU Horned Frogs",
  "texas christian": "TCU Horned Frogs",
  "texas christian horned frogs": "TCU Horned Frogs",
  "horned frogs": "TCU Horned Frogs",

  // Texas Tech Red Raiders
  "texas tech red raiders": "Texas Tech Red Raiders",
  "texas tech": "Texas Tech Red Raiders",
  ttu: "Texas Tech Red Raiders",
  "red raiders": "Texas Tech Red Raiders",

  // Utah Utes
  "utah utes": "Utah Utes",
  utah: "Utah Utes",
  utes: "Utah Utes",

  // West Virginia Mountaineers
  "west virginia mountaineers": "West Virginia Mountaineers",
  "west virginia": "West Virginia Mountaineers",
  "west va": "West Virginia Mountaineers",
  wvu: "West Virginia Mountaineers",
  mountaineers: "West Virginia Mountaineers",

  // ─── ACC (17 teams) ──────────────────────────────

  // Boston College Eagles
  "boston college eagles": "Boston College Eagles",
  "boston college": "Boston College Eagles",
  bc: "Boston College Eagles",

  // California Golden Bears
  "california golden bears": "California Golden Bears",
  california: "California Golden Bears",
  cal: "California Golden Bears",
  "golden bears": "California Golden Bears",
  "cal bears": "California Golden Bears",

  // Clemson Tigers
  "clemson tigers": "Clemson Tigers",
  clemson: "Clemson Tigers",
  clem: "Clemson Tigers",

  // Duke Blue Devils
  "duke blue devils": "Duke Blue Devils",
  duke: "Duke Blue Devils",
  "blue devils": "Duke Blue Devils",

  // Florida State Seminoles
  "florida state seminoles": "Florida State Seminoles",
  "florida state": "Florida State Seminoles",
  "florida st": "Florida State Seminoles",
  fsu: "Florida State Seminoles",
  seminoles: "Florida State Seminoles",
  noles: "Florida State Seminoles",

  // Georgia Tech Yellow Jackets
  "georgia tech yellow jackets": "Georgia Tech Yellow Jackets",
  "georgia tech": "Georgia Tech Yellow Jackets",
  gt: "Georgia Tech Yellow Jackets",
  "yellow jackets": "Georgia Tech Yellow Jackets",
  "rambling wreck": "Georgia Tech Yellow Jackets",

  // Louisville Cardinals
  "louisville cardinals": "Louisville Cardinals",
  louisville: "Louisville Cardinals",
  lou: "Louisville Cardinals",
  "l'ville": "Louisville Cardinals",

  // Miami Hurricanes
  "miami hurricanes": "Miami Hurricanes",
  miami: "Miami Hurricanes",
  "miami (fl)": "Miami Hurricanes",
  "miami fl": "Miami Hurricanes",
  mia: "Miami Hurricanes",
  hurricanes: "Miami Hurricanes",
  canes: "Miami Hurricanes",
  "the u": "Miami Hurricanes",

  // North Carolina Tar Heels
  "north carolina tar heels": "North Carolina Tar Heels",
  "north carolina": "North Carolina Tar Heels",
  unc: "North Carolina Tar Heels",
  "tar heels": "North Carolina Tar Heels",

  // NC State Wolfpack
  "nc state wolfpack": "NC State Wolfpack",
  "nc state": "NC State Wolfpack",
  "n.c. state": "NC State Wolfpack",
  ncst: "NC State Wolfpack",
  "north carolina state": "NC State Wolfpack",
  "north carolina state wolfpack": "NC State Wolfpack",
  wolfpack: "NC State Wolfpack",

  // Pittsburgh Panthers
  "pittsburgh panthers": "Pittsburgh Panthers",
  pittsburgh: "Pittsburgh Panthers",
  pitt: "Pittsburgh Panthers",

  // SMU Mustangs
  "smu mustangs": "SMU Mustangs",
  smu: "SMU Mustangs",
  "southern methodist": "SMU Mustangs",
  "southern methodist mustangs": "SMU Mustangs",
  mustangs: "SMU Mustangs",

  // Stanford Cardinal
  "stanford cardinal": "Stanford Cardinal",
  stanford: "Stanford Cardinal",
  stan: "Stanford Cardinal",
  cardinal: "Stanford Cardinal",

  // Syracuse Orange
  "syracuse orange": "Syracuse Orange",
  syracuse: "Syracuse Orange",
  syr: "Syracuse Orange",
  cuse: "Syracuse Orange",
  orange: "Syracuse Orange",

  // Virginia Cavaliers
  "virginia cavaliers": "Virginia Cavaliers",
  virginia: "Virginia Cavaliers",
  uva: "Virginia Cavaliers",
  cavaliers: "Virginia Cavaliers",
  wahoos: "Virginia Cavaliers",

  // Virginia Tech Hokies
  "virginia tech hokies": "Virginia Tech Hokies",
  "virginia tech": "Virginia Tech Hokies",
  vt: "Virginia Tech Hokies",
  hokies: "Virginia Tech Hokies",

  // Wake Forest Demon Deacons
  "wake forest demon deacons": "Wake Forest Demon Deacons",
  "wake forest": "Wake Forest Demon Deacons",
  wake: "Wake Forest Demon Deacons",
  "demon deacons": "Wake Forest Demon Deacons",

  // ─── PAC-12 (2 remaining teams) ──────────────────

  // Oregon State Beavers
  "oregon state beavers": "Oregon State Beavers",
  "oregon state": "Oregon State Beavers",
  "oregon st": "Oregon State Beavers",
  orst: "Oregon State Beavers",
  beavers: "Oregon State Beavers",

  // Washington State Cougars
  "washington state cougars": "Washington State Cougars",
  "washington state": "Washington State Cougars",
  "washington st": "Washington State Cougars",
  wsu: "Washington State Cougars",
  "wazzu": "Washington State Cougars",
  cougs: "Washington State Cougars",

  // ─── INDEPENDENTS ─────────────────────────────────

  // Notre Dame Fighting Irish
  "notre dame fighting irish": "Notre Dame Fighting Irish",
  "notre dame": "Notre Dame Fighting Irish",
  nd: "Notre Dame Fighting Irish",
  "fighting irish": "Notre Dame Fighting Irish",

  // UConn Huskies
  "uconn huskies": "UConn Huskies",
  uconn: "UConn Huskies",
  connecticut: "UConn Huskies",
  conn: "UConn Huskies",

  // UMass Minutemen
  "umass minutemen": "UMass Minutemen",
  umass: "UMass Minutemen",
  massachusetts: "UMass Minutemen",
  minutemen: "UMass Minutemen",

  // ─── AAC (14 teams) ──────────────────────────────

  // Army Black Knights
  "army black knights": "Army Black Knights",
  army: "Army Black Knights",
  "black knights": "Army Black Knights",

  // Charlotte 49ers
  "charlotte 49ers": "Charlotte 49ers",
  charlotte: "Charlotte 49ers",
  clt: "Charlotte 49ers",

  // East Carolina Pirates
  "east carolina pirates": "East Carolina Pirates",
  "east carolina": "East Carolina Pirates",
  ecu: "East Carolina Pirates",
  pirates: "East Carolina Pirates",

  // FAU Owls
  "fau owls": "FAU Owls",
  fau: "FAU Owls",
  "florida atlantic": "FAU Owls",
  "florida atlantic owls": "FAU Owls",

  // Memphis Tigers
  "memphis tigers": "Memphis Tigers",
  memphis: "Memphis Tigers",
  mem: "Memphis Tigers",

  // Navy Midshipmen
  "navy midshipmen": "Navy Midshipmen",
  navy: "Navy Midshipmen",
  midshipmen: "Navy Midshipmen",

  // North Texas Mean Green
  "north texas mean green": "North Texas Mean Green",
  "north texas": "North Texas Mean Green",
  unt: "North Texas Mean Green",
  "mean green": "North Texas Mean Green",

  // Rice Owls
  "rice owls": "Rice Owls",
  rice: "Rice Owls",

  // South Florida Bulls
  "south florida bulls": "South Florida Bulls",
  "south florida": "South Florida Bulls",
  usf: "South Florida Bulls",
  bulls: "South Florida Bulls",

  // Temple Owls
  "temple owls": "Temple Owls",
  temple: "Temple Owls",
  tem: "Temple Owls",

  // Tulane Green Wave
  "tulane green wave": "Tulane Green Wave",
  tulane: "Tulane Green Wave",
  tul: "Tulane Green Wave",
  "green wave": "Tulane Green Wave",

  // Tulsa Golden Hurricane
  "tulsa golden hurricane": "Tulsa Golden Hurricane",
  tulsa: "Tulsa Golden Hurricane",
  tlsa: "Tulsa Golden Hurricane",
  "golden hurricane": "Tulsa Golden Hurricane",

  // UTSA Roadrunners
  "utsa roadrunners": "UTSA Roadrunners",
  utsa: "UTSA Roadrunners",
  "texas-san antonio": "UTSA Roadrunners",
  "texas san antonio": "UTSA Roadrunners",
  roadrunners: "UTSA Roadrunners",

  // UAB Blazers
  "uab blazers": "UAB Blazers",
  uab: "UAB Blazers",
  "alabama-birmingham": "UAB Blazers",
  "alabama birmingham": "UAB Blazers",
  blazers: "UAB Blazers",

  // ─── SUN BELT (14 teams) ─────────────────────────

  // Appalachian State Mountaineers
  "appalachian state mountaineers": "Appalachian State Mountaineers",
  "appalachian state": "Appalachian State Mountaineers",
  "appalachian st": "Appalachian State Mountaineers",
  "app state": "Appalachian State Mountaineers",
  app: "Appalachian State Mountaineers",

  // Arkansas State Red Wolves
  "arkansas state red wolves": "Arkansas State Red Wolves",
  "arkansas state": "Arkansas State Red Wolves",
  "arkansas st": "Arkansas State Red Wolves",
  arst: "Arkansas State Red Wolves",
  "red wolves": "Arkansas State Red Wolves",

  // Coastal Carolina Chanticleers
  "coastal carolina chanticleers": "Coastal Carolina Chanticleers",
  "coastal carolina": "Coastal Carolina Chanticleers",
  ccu: "Coastal Carolina Chanticleers",
  coastal: "Coastal Carolina Chanticleers",
  chanticleers: "Coastal Carolina Chanticleers",

  // Georgia Southern Eagles
  "georgia southern eagles": "Georgia Southern Eagles",
  "georgia southern": "Georgia Southern Eagles",
  gaso: "Georgia Southern Eagles",

  // Georgia State Panthers
  "georgia state panthers": "Georgia State Panthers",
  "georgia state": "Georgia State Panthers",
  gast: "Georgia State Panthers",

  // James Madison Dukes
  "james madison dukes": "James Madison Dukes",
  "james madison": "James Madison Dukes",
  jmu: "James Madison Dukes",
  dukes: "James Madison Dukes",

  // Louisiana Ragin' Cajuns
  "louisiana ragin' cajuns": "Louisiana Ragin' Cajuns",
  "louisiana ragin cajuns": "Louisiana Ragin' Cajuns",
  "louisiana-lafayette": "Louisiana Ragin' Cajuns",
  "louisiana lafayette": "Louisiana Ragin' Cajuns",
  louisiana: "Louisiana Ragin' Cajuns",
  ull: "Louisiana Ragin' Cajuns",
  "ul-lafayette": "Louisiana Ragin' Cajuns",
  "ul lafayette": "Louisiana Ragin' Cajuns",
  "ragin' cajuns": "Louisiana Ragin' Cajuns",
  "ragin cajuns": "Louisiana Ragin' Cajuns",
  cajuns: "Louisiana Ragin' Cajuns",

  // Louisiana-Monroe Warhawks
  "louisiana-monroe warhawks": "Louisiana-Monroe Warhawks",
  "louisiana-monroe": "Louisiana-Monroe Warhawks",
  "louisiana monroe": "Louisiana-Monroe Warhawks",
  ulm: "Louisiana-Monroe Warhawks",
  warhawks: "Louisiana-Monroe Warhawks",

  // Marshall Thundering Herd
  "marshall thundering herd": "Marshall Thundering Herd",
  marshall: "Marshall Thundering Herd",
  mrsh: "Marshall Thundering Herd",
  "thundering herd": "Marshall Thundering Herd",

  // Old Dominion Monarchs
  "old dominion monarchs": "Old Dominion Monarchs",
  "old dominion": "Old Dominion Monarchs",
  odu: "Old Dominion Monarchs",
  monarchs: "Old Dominion Monarchs",

  // South Alabama Jaguars
  "south alabama jaguars": "South Alabama Jaguars",
  "south alabama": "South Alabama Jaguars",
  usa: "South Alabama Jaguars",
  "s alabama": "South Alabama Jaguars",

  // Southern Miss Golden Eagles
  "southern miss golden eagles": "Southern Miss Golden Eagles",
  "southern miss": "Southern Miss Golden Eagles",
  "southern mississippi": "Southern Miss Golden Eagles",
  usm: "Southern Miss Golden Eagles",
  "golden eagles": "Southern Miss Golden Eagles",

  // Texas State Bobcats
  "texas state bobcats": "Texas State Bobcats",
  "texas state": "Texas State Bobcats",
  txst: "Texas State Bobcats",
  bobcats: "Texas State Bobcats",

  // Troy Trojans
  "troy trojans": "Troy Trojans",
  troy: "Troy Trojans",

  // ─── MOUNTAIN WEST (12 teams) ────────────────────

  // Air Force Falcons
  "air force falcons": "Air Force Falcons",
  "air force": "Air Force Falcons",
  af: "Air Force Falcons",
  "usafa": "Air Force Falcons",

  // Boise State Broncos
  "boise state broncos": "Boise State Broncos",
  "boise state": "Boise State Broncos",
  "boise st": "Boise State Broncos",
  bsu: "Boise State Broncos",
  boise: "Boise State Broncos",
  broncos: "Boise State Broncos",

  // Colorado State Rams
  "colorado state rams": "Colorado State Rams",
  "colorado state": "Colorado State Rams",
  "colorado st": "Colorado State Rams",
  csu: "Colorado State Rams",

  // Fresno State Bulldogs
  "fresno state bulldogs": "Fresno State Bulldogs",
  "fresno state": "Fresno State Bulldogs",
  "fresno st": "Fresno State Bulldogs",
  fres: "Fresno State Bulldogs",
  fresno: "Fresno State Bulldogs",

  // Hawaii Rainbow Warriors
  "hawaii rainbow warriors": "Hawaii Rainbow Warriors",
  hawaii: "Hawaii Rainbow Warriors",
  haw: "Hawaii Rainbow Warriors",
  "rainbow warriors": "Hawaii Rainbow Warriors",

  // Nevada Wolf Pack
  "nevada wolf pack": "Nevada Wolf Pack",
  nevada: "Nevada Wolf Pack",
  nev: "Nevada Wolf Pack",
  "wolf pack": "Nevada Wolf Pack",

  // UNLV Rebels
  "unlv rebels": "UNLV Rebels",
  unlv: "UNLV Rebels",
  "nevada-las vegas": "UNLV Rebels",
  "nevada las vegas": "UNLV Rebels",

  // New Mexico Lobos
  "new mexico lobos": "New Mexico Lobos",
  "new mexico": "New Mexico Lobos",
  unm: "New Mexico Lobos",
  lobos: "New Mexico Lobos",

  // San Diego State Aztecs
  "san diego state aztecs": "San Diego State Aztecs",
  "san diego state": "San Diego State Aztecs",
  "san diego st": "San Diego State Aztecs",
  sdsu: "San Diego State Aztecs",
  aztecs: "San Diego State Aztecs",

  // San Jose State Spartans
  "san jose state spartans": "San Jose State Spartans",
  "san jose state": "San Jose State Spartans",
  "san jose st": "San Jose State Spartans",
  sjsu: "San Jose State Spartans",

  // Utah State Aggies
  "utah state aggies": "Utah State Aggies",
  "utah state": "Utah State Aggies",
  "utah st": "Utah State Aggies",
  usu: "Utah State Aggies",

  // Wyoming Cowboys
  "wyoming cowboys": "Wyoming Cowboys",
  wyoming: "Wyoming Cowboys",
  wyo: "Wyoming Cowboys",
  cowboys: "Wyoming Cowboys",

  // ─── MAC (12 teams) ──────────────────────────────

  // Akron Zips
  "akron zips": "Akron Zips",
  akron: "Akron Zips",
  akr: "Akron Zips",
  zips: "Akron Zips",

  // Ball State Cardinals
  "ball state cardinals": "Ball State Cardinals",
  "ball state": "Ball State Cardinals",
  "ball st": "Ball State Cardinals",
  ball: "Ball State Cardinals",

  // Bowling Green Falcons
  "bowling green falcons": "Bowling Green Falcons",
  "bowling green": "Bowling Green Falcons",
  "bowling green state": "Bowling Green Falcons",
  bgsu: "Bowling Green Falcons",

  // Buffalo Bulls
  "buffalo bulls": "Buffalo Bulls",
  buffalo: "Buffalo Bulls",
  buff: "Buffalo Bulls",

  // Central Michigan Chippewas
  "central michigan chippewas": "Central Michigan Chippewas",
  "central michigan": "Central Michigan Chippewas",
  cmu: "Central Michigan Chippewas",
  chippewas: "Central Michigan Chippewas",
  chips: "Central Michigan Chippewas",

  // Eastern Michigan Eagles
  "eastern michigan eagles": "Eastern Michigan Eagles",
  "eastern michigan": "Eastern Michigan Eagles",
  emu: "Eastern Michigan Eagles",

  // Kent State Golden Flashes
  "kent state golden flashes": "Kent State Golden Flashes",
  "kent state": "Kent State Golden Flashes",
  "kent st": "Kent State Golden Flashes",
  kent: "Kent State Golden Flashes",
  "golden flashes": "Kent State Golden Flashes",

  // Miami (OH) RedHawks
  "miami (oh) redhawks": "Miami (OH) RedHawks",
  "miami (oh)": "Miami (OH) RedHawks",
  "miami oh": "Miami (OH) RedHawks",
  "miami ohio": "Miami (OH) RedHawks",
  "m-oh": "Miami (OH) RedHawks",
  redhawks: "Miami (OH) RedHawks",

  // Northern Illinois Huskies
  "northern illinois huskies": "Northern Illinois Huskies",
  "northern illinois": "Northern Illinois Huskies",
  niu: "Northern Illinois Huskies",

  // Ohio Bobcats
  "ohio bobcats": "Ohio Bobcats",
  ohio: "Ohio Bobcats",
  // Note: "bobcats" omitted — ambiguous with Texas State Bobcats

  // Toledo Rockets
  "toledo rockets": "Toledo Rockets",
  toledo: "Toledo Rockets",
  tol: "Toledo Rockets",
  rockets: "Toledo Rockets",

  // Western Michigan Broncos
  "western michigan broncos": "Western Michigan Broncos",
  "western michigan": "Western Michigan Broncos",
  wmu: "Western Michigan Broncos",

  // ─── CONFERENCE USA (10 teams) ────────────────────

  // FIU Panthers
  "fiu panthers": "FIU Panthers",
  fiu: "FIU Panthers",
  "florida international": "FIU Panthers",
  "florida international panthers": "FIU Panthers",

  // Jacksonville State Gamecocks
  "jacksonville state gamecocks": "Jacksonville State Gamecocks",
  "jacksonville state": "Jacksonville State Gamecocks",
  "jacksonville st": "Jacksonville State Gamecocks",
  jvst: "Jacksonville State Gamecocks",
  "jax state": "Jacksonville State Gamecocks",

  // Kennesaw State Owls
  "kennesaw state owls": "Kennesaw State Owls",
  "kennesaw state": "Kennesaw State Owls",
  "kennesaw st": "Kennesaw State Owls",
  kenn: "Kennesaw State Owls",
  kennesaw: "Kennesaw State Owls",

  // Liberty Flames
  "liberty flames": "Liberty Flames",
  liberty: "Liberty Flames",
  lib: "Liberty Flames",
  flames: "Liberty Flames",

  // Louisiana Tech Bulldogs
  "louisiana tech bulldogs": "Louisiana Tech Bulldogs",
  "louisiana tech": "Louisiana Tech Bulldogs",
  "la tech": "Louisiana Tech Bulldogs",
  lt: "Louisiana Tech Bulldogs",

  // Middle Tennessee Blue Raiders
  "middle tennessee blue raiders": "Middle Tennessee Blue Raiders",
  "middle tennessee": "Middle Tennessee Blue Raiders",
  "middle tennessee state": "Middle Tennessee Blue Raiders",
  "middle tenn": "Middle Tennessee Blue Raiders",
  mtsu: "Middle Tennessee Blue Raiders",
  "blue raiders": "Middle Tennessee Blue Raiders",

  // New Mexico State Aggies
  "new mexico state aggies": "New Mexico State Aggies",
  "new mexico state": "New Mexico State Aggies",
  "new mexico st": "New Mexico State Aggies",
  nmsu: "New Mexico State Aggies",

  // Sam Houston Bearkats
  "sam houston bearkats": "Sam Houston Bearkats",
  "sam houston": "Sam Houston Bearkats",
  "sam houston state": "Sam Houston Bearkats",
  "sam houston st": "Sam Houston Bearkats",
  shsu: "Sam Houston Bearkats",
  bearkats: "Sam Houston Bearkats",

  // UTEP Miners
  "utep miners": "UTEP Miners",
  utep: "UTEP Miners",
  "texas-el paso": "UTEP Miners",
  "texas el paso": "UTEP Miners",
  miners: "UTEP Miners",

  // Western Kentucky Hilltoppers
  "western kentucky hilltoppers": "Western Kentucky Hilltoppers",
  "western kentucky": "Western Kentucky Hilltoppers",
  "western ky": "Western Kentucky Hilltoppers",
  wku: "Western Kentucky Hilltoppers",
  hilltoppers: "Western Kentucky Hilltoppers",

  // ─── FCS (formerly FBS) ──────────────────────────

  // Idaho Vandals
  "idaho vandals": "Idaho Vandals",
  idaho: "Idaho Vandals",
  idho: "Idaho Vandals",
  vandals: "Idaho Vandals",
};

/**
 * Sports Reference slug → canonical team name.
 * Slugs match the URL format: https://www.sports-reference.com/cfb/schools/{slug}/
 */
export const ncaafSlugToCanonical: Record<string, string> = {
  // SEC
  alabama: "Alabama Crimson Tide",
  arkansas: "Arkansas Razorbacks",
  auburn: "Auburn Tigers",
  florida: "Florida Gators",
  georgia: "Georgia Bulldogs",
  kentucky: "Kentucky Wildcats",
  "louisiana-state": "LSU Tigers",
  mississippi: "Ole Miss Rebels",
  "mississippi-state": "Mississippi State Bulldogs",
  missouri: "Missouri Tigers",
  oklahoma: "Oklahoma Sooners",
  "south-carolina": "South Carolina Gamecocks",
  tennessee: "Tennessee Volunteers",
  texas: "Texas Longhorns",
  "texas-am": "Texas A&M Aggies",
  vanderbilt: "Vanderbilt Commodores",

  // Big Ten
  illinois: "Illinois Fighting Illini",
  indiana: "Indiana Hoosiers",
  iowa: "Iowa Hawkeyes",
  maryland: "Maryland Terrapins",
  michigan: "Michigan Wolverines",
  "michigan-state": "Michigan State Spartans",
  minnesota: "Minnesota Golden Gophers",
  nebraska: "Nebraska Cornhuskers",
  northwestern: "Northwestern Wildcats",
  "ohio-state": "Ohio State Buckeyes",
  oregon: "Oregon Ducks",
  "penn-state": "Penn State Nittany Lions",
  purdue: "Purdue Boilermakers",
  rutgers: "Rutgers Scarlet Knights",
  ucla: "UCLA Bruins",
  "southern-california": "USC Trojans",
  washington: "Washington Huskies",
  wisconsin: "Wisconsin Badgers",

  // Big 12
  arizona: "Arizona Wildcats",
  "arizona-state": "Arizona State Sun Devils",
  baylor: "Baylor Bears",
  "brigham-young": "BYU Cougars",
  "central-florida": "UCF Knights",
  cincinnati: "Cincinnati Bearcats",
  colorado: "Colorado Buffaloes",
  houston: "Houston Cougars",
  "iowa-state": "Iowa State Cyclones",
  kansas: "Kansas Jayhawks",
  "kansas-state": "Kansas State Wildcats",
  "oklahoma-state": "Oklahoma State Cowboys",
  "texas-christian": "TCU Horned Frogs",
  "texas-tech": "Texas Tech Red Raiders",
  utah: "Utah Utes",
  "west-virginia": "West Virginia Mountaineers",

  // ACC
  "boston-college": "Boston College Eagles",
  california: "California Golden Bears",
  clemson: "Clemson Tigers",
  duke: "Duke Blue Devils",
  "florida-state": "Florida State Seminoles",
  "georgia-tech": "Georgia Tech Yellow Jackets",
  louisville: "Louisville Cardinals",
  "miami-fl": "Miami Hurricanes",
  "north-carolina": "North Carolina Tar Heels",
  "north-carolina-state": "NC State Wolfpack",
  pittsburgh: "Pittsburgh Panthers",
  "southern-methodist": "SMU Mustangs",
  stanford: "Stanford Cardinal",
  syracuse: "Syracuse Orange",
  virginia: "Virginia Cavaliers",
  "virginia-tech": "Virginia Tech Hokies",
  "wake-forest": "Wake Forest Demon Deacons",

  // Pac-12
  "oregon-state": "Oregon State Beavers",
  "washington-state": "Washington State Cougars",

  // Independents
  "notre-dame": "Notre Dame Fighting Irish",
  connecticut: "UConn Huskies",
  massachusetts: "UMass Minutemen",

  // AAC
  army: "Army Black Knights",
  charlotte: "Charlotte 49ers",
  "east-carolina": "East Carolina Pirates",
  "florida-atlantic": "FAU Owls",
  memphis: "Memphis Tigers",
  navy: "Navy Midshipmen",
  "north-texas": "North Texas Mean Green",
  rice: "Rice Owls",
  "south-florida": "South Florida Bulls",
  temple: "Temple Owls",
  tulane: "Tulane Green Wave",
  tulsa: "Tulsa Golden Hurricane",
  "texas-san-antonio": "UTSA Roadrunners",
  "alabama-birmingham": "UAB Blazers",

  // Sun Belt
  "appalachian-state": "Appalachian State Mountaineers",
  "arkansas-state": "Arkansas State Red Wolves",
  "coastal-carolina": "Coastal Carolina Chanticleers",
  "georgia-southern": "Georgia Southern Eagles",
  "georgia-state": "Georgia State Panthers",
  "james-madison": "James Madison Dukes",
  "louisiana-lafayette": "Louisiana Ragin' Cajuns",
  "louisiana-monroe": "Louisiana-Monroe Warhawks",
  marshall: "Marshall Thundering Herd",
  "old-dominion": "Old Dominion Monarchs",
  "south-alabama": "South Alabama Jaguars",
  "southern-mississippi": "Southern Miss Golden Eagles",
  "texas-state": "Texas State Bobcats",
  troy: "Troy Trojans",

  // Mountain West
  "air-force": "Air Force Falcons",
  "boise-state": "Boise State Broncos",
  "colorado-state": "Colorado State Rams",
  "fresno-state": "Fresno State Bulldogs",
  hawaii: "Hawaii Rainbow Warriors",
  nevada: "Nevada Wolf Pack",
  "nevada-las-vegas": "UNLV Rebels",
  "new-mexico": "New Mexico Lobos",
  "san-diego-state": "San Diego State Aztecs",
  "san-jose-state": "San Jose State Spartans",
  "utah-state": "Utah State Aggies",
  wyoming: "Wyoming Cowboys",

  // MAC
  akron: "Akron Zips",
  "ball-state": "Ball State Cardinals",
  "bowling-green-state": "Bowling Green Falcons",
  buffalo: "Buffalo Bulls",
  "central-michigan": "Central Michigan Chippewas",
  "eastern-michigan": "Eastern Michigan Eagles",
  "kent-state": "Kent State Golden Flashes",
  "miami-oh": "Miami (OH) RedHawks",
  "northern-illinois": "Northern Illinois Huskies",
  ohio: "Ohio Bobcats",
  toledo: "Toledo Rockets",
  "western-michigan": "Western Michigan Broncos",

  // Conference USA
  "florida-international": "FIU Panthers",
  "jacksonville-state": "Jacksonville State Gamecocks",
  "kennesaw-state": "Kennesaw State Owls",
  liberty: "Liberty Flames",
  "louisiana-tech": "Louisiana Tech Bulldogs",
  "middle-tennessee-state": "Middle Tennessee Blue Raiders",
  "new-mexico-state": "New Mexico State Aggies",
  "sam-houston-state": "Sam Houston Bearkats",
  "texas-el-paso": "UTEP Miners",
  "western-kentucky": "Western Kentucky Hilltoppers",

  // FCS (formerly FBS)
  idaho: "Idaho Vandals",
};

/**
 * Resolve any NCAAF team name (abbreviated, alternate, or canonical) to the canonical name.
 * Case-insensitive.
 *
 * @returns The canonical team name, or null if not found.
 */
export function resolveNCAAFTeamName(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  return ncaafTeamNameMap[normalized] ?? null;
}

/**
 * Build a reverse lookup: canonical name → all known aliases.
 * Useful for search/autocomplete.
 */
export function getNCAAFTeamAliases(): Record<string, string[]> {
  const aliases: Record<string, string[]> = {};
  for (const [alias, canonical] of Object.entries(ncaafTeamNameMap)) {
    if (!aliases[canonical]) {
      aliases[canonical] = [];
    }
    aliases[canonical].push(alias);
  }
  return aliases;
}
