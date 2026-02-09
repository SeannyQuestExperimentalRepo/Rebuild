/**
 * ESPN-specific team name overrides.
 *
 * Maps ESPN displayName/shortName/abbreviation to TrendLine canonical names
 * when the existing team-name-mapping files can't resolve them.
 *
 * Populated incrementally — run a sync, check logs for "Unresolved team" warnings,
 * then add mappings here.
 */

export const espnOverrides: Record<string, Record<string, string>> = {
  NFL: {
    // NFL names match well already; add exceptions here if needed
  },

  NCAAF: {
    // ESPN → TrendLine canonical
    "Hawai'i Rainbow Warriors": "Hawaii",
    "Hawai'i": "Hawaii",
    "HAW": "Hawaii",
    "Miami Hurricanes": "Miami",
    "Miami (OH) RedHawks": "Miami (OH)",
    "UConn Huskies": "Connecticut",
    "UCONN": "Connecticut",
    "UConn": "Connecticut",
    "SMU Mustangs": "SMU",
    "UCF Knights": "UCF",
    "UTSA Roadrunners": "UTSA",
    "UTEP Miners": "UTEP",
    "UAB Blazers": "UAB",
    "UL Monroe Warhawks": "Louisiana-Monroe",
    "ULM": "Louisiana-Monroe",
    "Louisiana Ragin' Cajuns": "Louisiana",
    "ULL": "Louisiana",
    "Appalachian State Mountaineers": "Appalachian State",
    "APP": "Appalachian State",
    "Middle Tennessee Blue Raiders": "Middle Tennessee",
    "MTSU": "Middle Tennessee",
    "FIU Panthers": "FIU",
    "FAU Owls": "FAU",
    "UNLV Rebels": "UNLV",
    "USC Trojans": "USC",
    "LSU Tigers": "LSU",
    "Ole Miss Rebels": "Ole Miss",
    "MISS": "Ole Miss",
  },

  NCAAMB: {
    // ESPN → TrendLine canonical (must match Team table name exactly)
    "UConn Huskies": "Connecticut",
    "UCONN": "Connecticut",
    "UConn": "Connecticut",
    "Hawai'i Rainbow Warriors": "Hawaii",
    "HAW": "Hawaii",

    // Miami: DB uses "Miami FL" and "Miami OH"
    "Miami Hurricanes": "Miami FL",
    "Miami": "Miami FL",
    "MIA": "Miami FL",
    "Miami (OH) RedHawks": "Miami OH",
    "M-OH": "Miami OH",

    "Saint Joseph's Hawks": "Saint Joseph's",
    "Saint Mary's Gaels": "Saint Mary's",
    "St. John's Red Storm": "St. John's",

    // DB uses "Saint Bonaventure" (not "St. Bonaventure")
    "St. Bonaventure Bonnies": "Saint Bonaventure",
    "St. Bonaventure": "Saint Bonaventure",
    "SBU": "Saint Bonaventure",

    "Loyola Chicago Ramblers": "Loyola Chicago",
    "UNC Tar Heels": "North Carolina",
    "North Carolina Tar Heels": "North Carolina",

    // DB uses "N.C. State" (not "NC State")
    "NC State Wolfpack": "N.C. State",
    "NC State": "N.C. State",
    "NCST": "N.C. State",

    // DB uses "Louisiana Monroe" (no hyphen)
    "UL Monroe Warhawks": "Louisiana Monroe",
    "Louisiana-Monroe Warhawks": "Louisiana Monroe",
    "Louisiana-Monroe": "Louisiana Monroe",
    "ULM": "Louisiana Monroe",

    "Louisiana Ragin' Cajuns": "Louisiana",
    "ULL": "Louisiana",
    "USC Trojans": "USC",
    "LSU Tigers": "LSU",
    "UNLV Rebels": "UNLV",

    // DB uses "Mississippi" (not "Ole Miss")
    "Ole Miss Rebels": "Mississippi",
    "Ole Miss": "Mississippi",
    "MISS": "Mississippi",

    "SMU Mustangs": "SMU",
    "UCF Knights": "UCF",
    "UTSA Roadrunners": "UTSA",
    "UTEP Miners": "UTEP",
    "UAB Blazers": "UAB",
    "FAU Owls": "FAU",
    "FIU Panthers": "FIU",
    "Middle Tennessee Blue Raiders": "Middle Tennessee",
    "MTSU": "Middle Tennessee",

    // DB uses "Appalachian St." (not "Appalachian State")
    "Appalachian State Mountaineers": "Appalachian St.",
    "Appalachian State": "Appalachian St.",
    "APP": "Appalachian St.",

    // DB uses "Arkansas Pine Bluff" (no hyphen)
    "AR-Pine Bluff": "Arkansas Pine Bluff",
    "Arkansas-Pine Bluff Golden Lions": "Arkansas Pine Bluff",
    "Arkansas-Pine Bluff": "Arkansas Pine Bluff",
    "UAPB": "Arkansas Pine Bluff",

    // DB uses "Chicago St."
    "Chicago St": "Chicago St.",
    "Chicago State Cougars": "Chicago St.",
    "Chicago State": "Chicago St.",
    "CHST": "Chicago St.",

    // DB uses "Jackson St."
    "Jackson St": "Jackson St.",
    "Jackson State Tigers": "Jackson St.",
    "Jackson State": "Jackson St.",
    "JKST": "Jackson St.",

    "UT Rio Grande Valley Vaqueros": "UT Rio Grande Valley",
    "RGV": "UT Rio Grande Valley",
    "East Texas A&M Lions": "East Texas A&M",
    "ETAM": "East Texas A&M",

    // DB uses "Texas A&M Corpus Chris" (no hyphen, truncated)
    "Texas A&M-Corpus Christi Islanders": "Texas A&M Corpus Chris",
    "Texas A&M-Corpus Christi": "Texas A&M Corpus Chris",
    "AMCC": "Texas A&M Corpus Chris",

    "Bethune-Cookman Wildcats": "Bethune Cookman",
    "BCU": "Bethune Cookman",

    // DB uses "Indiana St."
    "Indiana St": "Indiana St.",
    "Indiana State Sycamores": "Indiana St.",
    "Indiana State": "Indiana St.",
    "INST": "Indiana St.",

    "SE Louisiana": "Southeastern Louisiana",
    "SELA": "Southeastern Louisiana",
    "S Illinois": "Southern Illinois",
    "SIU": "Southern Illinois",

    // UC schools — DB uses full names with spaces
    "UC Davis Aggies": "UC Davis",
    "DAV": "UC Davis",
    "UC Irvine Anteaters": "UC Irvine",
    "UCI": "UC Irvine",
    "UC Riverside Highlanders": "UC Riverside",
    "UCR": "UC Riverside",
    "UC San Diego Tritons": "UC San Diego",
    "UCSD": "UC San Diego",

    // Queens — DB uses "Queens (NC)"
    "Queens Royals": "Queens (NC)",
    "Queens": "Queens (NC)",
    "QUNS": "Queens (NC)",

    // Seattle — DB uses "Seattle"
    "Seattle U Redhawks": "Seattle",
    "Seattle U": "Seattle",
    "SEA": "Seattle",

    // Merrimack — DB uses "Merrimack"
    "Merrimack Warriors": "Merrimack",
    "MRMK": "Merrimack",

    // West Georgia — DB uses "West Georgia"
    "West Georgia Wolves": "West Georgia",
    "WGA": "West Georgia",

    // Southern Indiana — DB uses "Southern Indiana"
    "Southern Indiana Screaming Eagles": "Southern Indiana",
    "USI": "Southern Indiana",

    // Purdue Fort Wayne — DB uses "Purdue Fort Wayne"
    "Purdue Fort Wayne Mastodons": "Purdue Fort Wayne",
    "PFW": "Purdue Fort Wayne",

    // UAlbany — DB uses "Albany"
    "UAlbany Great Danes": "Albany",
    "UAlbany": "Albany",
    "UALB": "Albany",

    // St. Thomas-Minnesota — DB uses "St. Thomas"
    "St. Thomas-Minnesota Tommies": "St. Thomas",
    "St. Thomas-Minnesota": "St. Thomas",
    "STMN": "St. Thomas",

    // New Haven — DB uses "New Haven" (if D2, will skip at team ID lookup)
    "New Haven Chargers": "New Haven",
    "NHVN": "New Haven",
  },
};
