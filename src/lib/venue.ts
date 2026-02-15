import "server-only";

/**
 * Static Venue Data & Travel/Fatigue Calculations
 *
 * Provides venue lookup for all 32 NFL stadiums and 30 NBA arenas,
 * haversine distance calculation, timezone change detection, and a
 * composite fatigue score (0-10) combining distance, timezone shift,
 * and back-to-back scheduling.
 */

import { prisma } from "./db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Timezone = "Eastern" | "Central" | "Mountain" | "Pacific";

export interface VenueInfo {
  name: string;
  city: string;
  state: string;
  sport: "NFL" | "NBA";
  teamName: string;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  isDome: boolean;
  surface: string | null;
  capacity: number;
  timezone: Timezone;
}

export interface TravelInfo {
  distanceMiles: number;
  timezoneChanges: number;
  fatigueScore: number;
}

// ─── Timezone Ordinal ───────────────────────────────────────────────────────

const TIMEZONE_ORDINAL: Record<Timezone, number> = {
  Eastern: 0,
  Central: 1,
  Mountain: 2,
  Pacific: 3,
};

// ─── Static Venue Data ──────────────────────────────────────────────────────

const STATIC_VENUES: VenueInfo[] = [
  // ─── NFL Venues (32 stadiums) ─────────────────────────────────────────────

  // AFC East
  {
    name: "Highmark Stadium",
    city: "Orchard Park",
    state: "NY",
    sport: "NFL",
    teamName: "Buffalo Bills",
    latitude: 42.7738,
    longitude: -78.787,
    altitudeFt: 597,
    isDome: false,
    surface: "Grass",
    capacity: 71608,
    timezone: "Eastern",
  },
  {
    name: "Gillette Stadium",
    city: "Foxborough",
    state: "MA",
    sport: "NFL",
    teamName: "New England Patriots",
    latitude: 42.0909,
    longitude: -71.2643,
    altitudeFt: 256,
    isDome: false,
    surface: "FieldTurf",
    capacity: 65878,
    timezone: "Eastern",
  },
  {
    name: "Hard Rock Stadium",
    city: "Miami Gardens",
    state: "FL",
    sport: "NFL",
    teamName: "Miami Dolphins",
    latitude: 25.958,
    longitude: -80.2389,
    altitudeFt: 7,
    isDome: false,
    surface: "Grass",
    capacity: 65326,
    timezone: "Eastern",
  },
  {
    name: "MetLife Stadium",
    city: "East Rutherford",
    state: "NJ",
    sport: "NFL",
    teamName: "New York Jets",
    latitude: 40.8135,
    longitude: -74.0745,
    altitudeFt: 30,
    isDome: false,
    surface: "FieldTurf",
    capacity: 82500,
    timezone: "Eastern",
  },
  // AFC North
  {
    name: "M&T Bank Stadium",
    city: "Baltimore",
    state: "MD",
    sport: "NFL",
    teamName: "Baltimore Ravens",
    latitude: 39.278,
    longitude: -76.6227,
    altitudeFt: 25,
    isDome: false,
    surface: "Grass",
    capacity: 71008,
    timezone: "Eastern",
  },
  {
    name: "Paycor Stadium",
    city: "Cincinnati",
    state: "OH",
    sport: "NFL",
    teamName: "Cincinnati Bengals",
    latitude: 39.0955,
    longitude: -84.5161,
    altitudeFt: 490,
    isDome: false,
    surface: "Grass",
    capacity: 65515,
    timezone: "Eastern",
  },
  {
    name: "Huntington Bank Field",
    city: "Cleveland",
    state: "OH",
    sport: "NFL",
    teamName: "Cleveland Browns",
    latitude: 41.5061,
    longitude: -81.6995,
    altitudeFt: 583,
    isDome: false,
    surface: "Grass",
    capacity: 67431,
    timezone: "Eastern",
  },
  {
    name: "Acrisure Stadium",
    city: "Pittsburgh",
    state: "PA",
    sport: "NFL",
    teamName: "Pittsburgh Steelers",
    latitude: 40.4468,
    longitude: -80.0158,
    altitudeFt: 730,
    isDome: false,
    surface: "Grass",
    capacity: 68400,
    timezone: "Eastern",
  },
  // AFC South
  {
    name: "NRG Stadium",
    city: "Houston",
    state: "TX",
    sport: "NFL",
    teamName: "Houston Texans",
    latitude: 29.6847,
    longitude: -95.4107,
    altitudeFt: 50,
    isDome: true,
    surface: "Grass",
    capacity: 72220,
    timezone: "Central",
  },
  {
    name: "Lucas Oil Stadium",
    city: "Indianapolis",
    state: "IN",
    sport: "NFL",
    teamName: "Indianapolis Colts",
    latitude: 39.7601,
    longitude: -86.1639,
    altitudeFt: 715,
    isDome: true,
    surface: "FieldTurf",
    capacity: 67000,
    timezone: "Eastern",
  },
  {
    name: "EverBank Stadium",
    city: "Jacksonville",
    state: "FL",
    sport: "NFL",
    teamName: "Jacksonville Jaguars",
    latitude: 30.3239,
    longitude: -81.6373,
    altitudeFt: 16,
    isDome: false,
    surface: "Grass",
    capacity: 67814,
    timezone: "Eastern",
  },
  {
    name: "Nissan Stadium",
    city: "Nashville",
    state: "TN",
    sport: "NFL",
    teamName: "Tennessee Titans",
    latitude: 36.1665,
    longitude: -86.7713,
    altitudeFt: 400,
    isDome: false,
    surface: "Grass",
    capacity: 69143,
    timezone: "Central",
  },
  // AFC West
  {
    name: "Empower Field at Mile High",
    city: "Denver",
    state: "CO",
    sport: "NFL",
    teamName: "Denver Broncos",
    latitude: 39.7439,
    longitude: -105.0201,
    altitudeFt: 5280,
    isDome: false,
    surface: "Grass",
    capacity: 76125,
    timezone: "Mountain",
  },
  {
    name: "GEHA Field at Arrowhead Stadium",
    city: "Kansas City",
    state: "MO",
    sport: "NFL",
    teamName: "Kansas City Chiefs",
    latitude: 39.0489,
    longitude: -94.4839,
    altitudeFt: 800,
    isDome: false,
    surface: "Grass",
    capacity: 76416,
    timezone: "Central",
  },
  {
    name: "Allegiant Stadium",
    city: "Las Vegas",
    state: "NV",
    sport: "NFL",
    teamName: "Las Vegas Raiders",
    latitude: 36.0909,
    longitude: -115.1833,
    altitudeFt: 2001,
    isDome: true,
    surface: "Grass",
    capacity: 65000,
    timezone: "Pacific",
  },
  {
    name: "SoFi Stadium",
    city: "Inglewood",
    state: "CA",
    sport: "NFL",
    teamName: "Los Angeles Chargers",
    latitude: 33.9535,
    longitude: -118.3392,
    altitudeFt: 131,
    isDome: true,
    surface: "FieldTurf",
    capacity: 70240,
    timezone: "Pacific",
  },
  // NFC East
  {
    name: "AT&T Stadium",
    city: "Arlington",
    state: "TX",
    sport: "NFL",
    teamName: "Dallas Cowboys",
    latitude: 32.7473,
    longitude: -97.0945,
    altitudeFt: 600,
    isDome: true,
    surface: "Hellas Matrix Turf",
    capacity: 80000,
    timezone: "Central",
  },
  {
    name: "MetLife Stadium",
    city: "East Rutherford",
    state: "NJ",
    sport: "NFL",
    teamName: "New York Giants",
    latitude: 40.8135,
    longitude: -74.0745,
    altitudeFt: 30,
    isDome: false,
    surface: "FieldTurf",
    capacity: 82500,
    timezone: "Eastern",
  },
  {
    name: "Lincoln Financial Field",
    city: "Philadelphia",
    state: "PA",
    sport: "NFL",
    teamName: "Philadelphia Eagles",
    latitude: 39.9008,
    longitude: -75.1675,
    altitudeFt: 40,
    isDome: false,
    surface: "Grass",
    capacity: 69796,
    timezone: "Eastern",
  },
  {
    name: "Northwest Stadium",
    city: "Landover",
    state: "MD",
    sport: "NFL",
    teamName: "Washington Commanders",
    latitude: 38.9076,
    longitude: -76.8645,
    altitudeFt: 180,
    isDome: false,
    surface: "Grass",
    capacity: 67617,
    timezone: "Eastern",
  },
  // NFC North
  {
    name: "Soldier Field",
    city: "Chicago",
    state: "IL",
    sport: "NFL",
    teamName: "Chicago Bears",
    latitude: 41.8623,
    longitude: -87.6167,
    altitudeFt: 595,
    isDome: false,
    surface: "Grass",
    capacity: 61500,
    timezone: "Central",
  },
  {
    name: "Ford Field",
    city: "Detroit",
    state: "MI",
    sport: "NFL",
    teamName: "Detroit Lions",
    latitude: 42.34,
    longitude: -83.0456,
    altitudeFt: 600,
    isDome: true,
    surface: "FieldTurf",
    capacity: 65000,
    timezone: "Eastern",
  },
  {
    name: "Lambeau Field",
    city: "Green Bay",
    state: "WI",
    sport: "NFL",
    teamName: "Green Bay Packers",
    latitude: 44.5013,
    longitude: -88.0622,
    altitudeFt: 640,
    isDome: false,
    surface: "Grass",
    capacity: 81441,
    timezone: "Central",
  },
  {
    name: "U.S. Bank Stadium",
    city: "Minneapolis",
    state: "MN",
    sport: "NFL",
    teamName: "Minnesota Vikings",
    latitude: 44.9736,
    longitude: -93.2575,
    altitudeFt: 830,
    isDome: true,
    surface: "FieldTurf",
    capacity: 66860,
    timezone: "Central",
  },
  // NFC South
  {
    name: "Bank of America Stadium",
    city: "Charlotte",
    state: "NC",
    sport: "NFL",
    teamName: "Carolina Panthers",
    latitude: 35.2258,
    longitude: -80.8528,
    altitudeFt: 751,
    isDome: false,
    surface: "Grass",
    capacity: 74867,
    timezone: "Eastern",
  },
  {
    name: "Mercedes-Benz Stadium",
    city: "Atlanta",
    state: "GA",
    sport: "NFL",
    teamName: "Atlanta Falcons",
    latitude: 33.7553,
    longitude: -84.4006,
    altitudeFt: 1050,
    isDome: true,
    surface: "FieldTurf",
    capacity: 71000,
    timezone: "Eastern",
  },
  {
    name: "Caesars Superdome",
    city: "New Orleans",
    state: "LA",
    sport: "NFL",
    teamName: "New Orleans Saints",
    latitude: 29.9511,
    longitude: -90.0812,
    altitudeFt: 3,
    isDome: true,
    surface: "FieldTurf",
    capacity: 73208,
    timezone: "Central",
  },
  {
    name: "Raymond James Stadium",
    city: "Tampa",
    state: "FL",
    sport: "NFL",
    teamName: "Tampa Bay Buccaneers",
    latitude: 27.9759,
    longitude: -82.5033,
    altitudeFt: 36,
    isDome: false,
    surface: "Grass",
    capacity: 65618,
    timezone: "Eastern",
  },
  // NFC West
  {
    name: "State Farm Stadium",
    city: "Glendale",
    state: "AZ",
    sport: "NFL",
    teamName: "Arizona Cardinals",
    latitude: 33.5276,
    longitude: -112.2626,
    altitudeFt: 1100,
    isDome: true,
    surface: "Grass",
    capacity: 63400,
    timezone: "Mountain",
  },
  {
    name: "SoFi Stadium",
    city: "Inglewood",
    state: "CA",
    sport: "NFL",
    teamName: "Los Angeles Rams",
    latitude: 33.9535,
    longitude: -118.3392,
    altitudeFt: 131,
    isDome: true,
    surface: "FieldTurf",
    capacity: 70240,
    timezone: "Pacific",
  },
  {
    name: "Levi's Stadium",
    city: "Santa Clara",
    state: "CA",
    sport: "NFL",
    teamName: "San Francisco 49ers",
    latitude: 37.4033,
    longitude: -121.9694,
    altitudeFt: 43,
    isDome: false,
    surface: "Grass",
    capacity: 68500,
    timezone: "Pacific",
  },
  {
    name: "Lumen Field",
    city: "Seattle",
    state: "WA",
    sport: "NFL",
    teamName: "Seattle Seahawks",
    latitude: 47.5952,
    longitude: -122.3316,
    altitudeFt: 12,
    isDome: false,
    surface: "FieldTurf",
    capacity: 68740,
    timezone: "Pacific",
  },

  // ─── NBA Venues (30 arenas) ─────────────────────────────────────────────────

  // Atlantic Division
  {
    name: "TD Garden",
    city: "Boston",
    state: "MA",
    sport: "NBA",
    teamName: "Boston Celtics",
    latitude: 42.3662,
    longitude: -71.0621,
    altitudeFt: 20,
    isDome: true,
    surface: null,
    capacity: 19156,
    timezone: "Eastern",
  },
  {
    name: "Barclays Center",
    city: "Brooklyn",
    state: "NY",
    sport: "NBA",
    teamName: "Brooklyn Nets",
    latitude: 40.6826,
    longitude: -73.9754,
    altitudeFt: 30,
    isDome: true,
    surface: null,
    capacity: 17732,
    timezone: "Eastern",
  },
  {
    name: "Madison Square Garden",
    city: "New York",
    state: "NY",
    sport: "NBA",
    teamName: "New York Knicks",
    latitude: 40.7505,
    longitude: -73.9934,
    altitudeFt: 33,
    isDome: true,
    surface: null,
    capacity: 19812,
    timezone: "Eastern",
  },
  {
    name: "Wells Fargo Center",
    city: "Philadelphia",
    state: "PA",
    sport: "NBA",
    teamName: "Philadelphia 76ers",
    latitude: 39.9012,
    longitude: -75.172,
    altitudeFt: 40,
    isDome: true,
    surface: null,
    capacity: 20478,
    timezone: "Eastern",
  },
  {
    name: "Scotiabank Arena",
    city: "Toronto",
    state: "ON",
    sport: "NBA",
    teamName: "Toronto Raptors",
    latitude: 43.6435,
    longitude: -79.3791,
    altitudeFt: 250,
    isDome: true,
    surface: null,
    capacity: 19800,
    timezone: "Eastern",
  },

  // Central Division
  {
    name: "United Center",
    city: "Chicago",
    state: "IL",
    sport: "NBA",
    teamName: "Chicago Bulls",
    latitude: 41.8807,
    longitude: -87.6742,
    altitudeFt: 595,
    isDome: true,
    surface: null,
    capacity: 20917,
    timezone: "Central",
  },
  {
    name: "Rocket Mortgage FieldHouse",
    city: "Cleveland",
    state: "OH",
    sport: "NBA",
    teamName: "Cleveland Cavaliers",
    latitude: 41.4965,
    longitude: -81.6882,
    altitudeFt: 653,
    isDome: true,
    surface: null,
    capacity: 19432,
    timezone: "Eastern",
  },
  {
    name: "Little Caesars Arena",
    city: "Detroit",
    state: "MI",
    sport: "NBA",
    teamName: "Detroit Pistons",
    latitude: 42.3411,
    longitude: -83.0553,
    altitudeFt: 600,
    isDome: true,
    surface: null,
    capacity: 20332,
    timezone: "Eastern",
  },
  {
    name: "Gainbridge Fieldhouse",
    city: "Indianapolis",
    state: "IN",
    sport: "NBA",
    teamName: "Indiana Pacers",
    latitude: 39.764,
    longitude: -86.1555,
    altitudeFt: 715,
    isDome: true,
    surface: null,
    capacity: 17923,
    timezone: "Eastern",
  },
  {
    name: "Fiserv Forum",
    city: "Milwaukee",
    state: "WI",
    sport: "NBA",
    teamName: "Milwaukee Bucks",
    latitude: 43.0451,
    longitude: -87.9174,
    altitudeFt: 617,
    isDome: true,
    surface: null,
    capacity: 17341,
    timezone: "Central",
  },

  // Southeast Division
  {
    name: "State Farm Arena",
    city: "Atlanta",
    state: "GA",
    sport: "NBA",
    teamName: "Atlanta Hawks",
    latitude: 33.7573,
    longitude: -84.3963,
    altitudeFt: 1050,
    isDome: true,
    surface: null,
    capacity: 18118,
    timezone: "Eastern",
  },
  {
    name: "Spectrum Center",
    city: "Charlotte",
    state: "NC",
    sport: "NBA",
    teamName: "Charlotte Hornets",
    latitude: 35.2251,
    longitude: -80.8392,
    altitudeFt: 751,
    isDome: true,
    surface: null,
    capacity: 19077,
    timezone: "Eastern",
  },
  {
    name: "Kaseya Center",
    city: "Miami",
    state: "FL",
    sport: "NBA",
    teamName: "Miami Heat",
    latitude: 25.7814,
    longitude: -80.187,
    altitudeFt: 7,
    isDome: true,
    surface: null,
    capacity: 19600,
    timezone: "Eastern",
  },
  {
    name: "Amway Center",
    city: "Orlando",
    state: "FL",
    sport: "NBA",
    teamName: "Orlando Magic",
    latitude: 28.5392,
    longitude: -81.3839,
    altitudeFt: 82,
    isDome: true,
    surface: null,
    capacity: 18846,
    timezone: "Eastern",
  },
  {
    name: "Capital One Arena",
    city: "Washington",
    state: "DC",
    sport: "NBA",
    teamName: "Washington Wizards",
    latitude: 38.8981,
    longitude: -77.0209,
    altitudeFt: 25,
    isDome: true,
    surface: null,
    capacity: 20356,
    timezone: "Eastern",
  },

  // Northwest Division
  {
    name: "Ball Arena",
    city: "Denver",
    state: "CO",
    sport: "NBA",
    teamName: "Denver Nuggets",
    latitude: 39.7487,
    longitude: -105.0077,
    altitudeFt: 5280,
    isDome: true,
    surface: null,
    capacity: 19520,
    timezone: "Mountain",
  },
  {
    name: "Target Center",
    city: "Minneapolis",
    state: "MN",
    sport: "NBA",
    teamName: "Minnesota Timberwolves",
    latitude: 44.9795,
    longitude: -93.2761,
    altitudeFt: 830,
    isDome: true,
    surface: null,
    capacity: 18978,
    timezone: "Central",
  },
  {
    name: "Paycom Center",
    city: "Oklahoma City",
    state: "OK",
    sport: "NBA",
    teamName: "Oklahoma City Thunder",
    latitude: 35.4634,
    longitude: -97.5151,
    altitudeFt: 1201,
    isDome: true,
    surface: null,
    capacity: 18203,
    timezone: "Central",
  },
  {
    name: "Moda Center",
    city: "Portland",
    state: "OR",
    sport: "NBA",
    teamName: "Portland Trail Blazers",
    latitude: 45.5316,
    longitude: -122.6668,
    altitudeFt: 50,
    isDome: true,
    surface: null,
    capacity: 19441,
    timezone: "Pacific",
  },
  {
    name: "Delta Center",
    city: "Salt Lake City",
    state: "UT",
    sport: "NBA",
    teamName: "Utah Jazz",
    latitude: 40.7683,
    longitude: -111.9011,
    altitudeFt: 4226,
    isDome: true,
    surface: null,
    capacity: 18306,
    timezone: "Mountain",
  },

  // Pacific Division
  {
    name: "Chase Center",
    city: "San Francisco",
    state: "CA",
    sport: "NBA",
    teamName: "Golden State Warriors",
    latitude: 37.768,
    longitude: -122.3877,
    altitudeFt: 7,
    isDome: true,
    surface: null,
    capacity: 18064,
    timezone: "Pacific",
  },
  {
    name: "Crypto.com Arena",
    city: "Los Angeles",
    state: "CA",
    sport: "NBA",
    teamName: "Los Angeles Clippers",
    latitude: 34.043,
    longitude: -118.2673,
    altitudeFt: 285,
    isDome: true,
    surface: null,
    capacity: 18997,
    timezone: "Pacific",
  },
  {
    name: "Crypto.com Arena",
    city: "Los Angeles",
    state: "CA",
    sport: "NBA",
    teamName: "Los Angeles Lakers",
    latitude: 34.043,
    longitude: -118.2673,
    altitudeFt: 285,
    isDome: true,
    surface: null,
    capacity: 18997,
    timezone: "Pacific",
  },
  {
    name: "Footprint Center",
    city: "Phoenix",
    state: "AZ",
    sport: "NBA",
    teamName: "Phoenix Suns",
    latitude: 33.4457,
    longitude: -112.0712,
    altitudeFt: 1086,
    isDome: true,
    surface: null,
    capacity: 18422,
    timezone: "Mountain",
  },
  {
    name: "Golden 1 Center",
    city: "Sacramento",
    state: "CA",
    sport: "NBA",
    teamName: "Sacramento Kings",
    latitude: 38.5802,
    longitude: -121.4997,
    altitudeFt: 26,
    isDome: true,
    surface: null,
    capacity: 17608,
    timezone: "Pacific",
  },

  // Southwest Division
  {
    name: "American Airlines Center",
    city: "Dallas",
    state: "TX",
    sport: "NBA",
    teamName: "Dallas Mavericks",
    latitude: 32.7905,
    longitude: -96.8103,
    altitudeFt: 430,
    isDome: true,
    surface: null,
    capacity: 19200,
    timezone: "Central",
  },
  {
    name: "Toyota Center",
    city: "Houston",
    state: "TX",
    sport: "NBA",
    teamName: "Houston Rockets",
    latitude: 29.7508,
    longitude: -95.3621,
    altitudeFt: 50,
    isDome: true,
    surface: null,
    capacity: 18055,
    timezone: "Central",
  },
  {
    name: "FedExForum",
    city: "Memphis",
    state: "TN",
    sport: "NBA",
    teamName: "Memphis Grizzlies",
    latitude: 35.1382,
    longitude: -90.0506,
    altitudeFt: 337,
    isDome: true,
    surface: null,
    capacity: 17794,
    timezone: "Central",
  },
  {
    name: "Smoothie King Center",
    city: "New Orleans",
    state: "LA",
    sport: "NBA",
    teamName: "New Orleans Pelicans",
    latitude: 29.949,
    longitude: -90.0821,
    altitudeFt: 3,
    isDome: true,
    surface: null,
    capacity: 16867,
    timezone: "Central",
  },
  {
    name: "Frost Bank Center",
    city: "San Antonio",
    state: "TX",
    sport: "NBA",
    teamName: "San Antonio Spurs",
    latitude: 29.427,
    longitude: -98.4375,
    altitudeFt: 650,
    isDome: true,
    surface: null,
    capacity: 18581,
    timezone: "Central",
  },
];

// ─── Venue Map (keyed by "sport:teamName") ──────────────────────────────────

const ALL_VENUES: VenueInfo[] = STATIC_VENUES;

const VENUE_MAP = new Map<string, VenueInfo>();
for (const v of ALL_VENUES) {
  VENUE_MAP.set(`${v.sport}:${v.teamName}`, v);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Look up a venue by team name and sport.
 */
export function getVenue(
  teamName: string,
  sport: string
): VenueInfo | undefined {
  return VENUE_MAP.get(`${sport}:${teamName}`);
}

/**
 * Get all venues, optionally filtered by sport.
 */
export function getAllVenues(sport?: string): VenueInfo[] {
  if (!sport) return ALL_VENUES;
  return ALL_VENUES.filter((v) => v.sport === sport);
}

/**
 * Haversine distance between two lat/lon points. Returns miles.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculate travel info and fatigue score for an away team traveling
 * to a home team's venue.
 *
 * Fatigue score (0-10) is a composite of:
 *  - Distance component: miles / 500 (capped at 5)
 *  - Timezone component: timezone changes * 1.5 (capped at 3)
 *  - Back-to-back component: +2 if isBackToBack is true
 *  - Total is capped at 10
 */
export function getTravelInfo(
  awayTeamName: string,
  homeTeamName: string,
  sport: string,
  isBackToBack: boolean = false
): TravelInfo {
  const awayVenue = getVenue(awayTeamName, sport);
  const homeVenue = getVenue(homeTeamName, sport);

  if (!awayVenue || !homeVenue) {
    console.log(
      `[venue] Missing venue data for ${awayTeamName} or ${homeTeamName} (${sport})`
    );
    return { distanceMiles: 0, timezoneChanges: 0, fatigueScore: 0 };
  }

  const distanceMiles = haversineDistance(
    awayVenue.latitude,
    awayVenue.longitude,
    homeVenue.latitude,
    homeVenue.longitude
  );

  const timezoneChanges = Math.abs(
    TIMEZONE_ORDINAL[awayVenue.timezone] - TIMEZONE_ORDINAL[homeVenue.timezone]
  );

  // Distance component: miles / 500, capped at 5
  const distanceComponent = Math.min(distanceMiles / 500, 5);

  // Timezone component: timezone changes * 1.5, capped at 3
  const timezoneComponent = Math.min(timezoneChanges * 1.5, 3);

  // Back-to-back component: +2 if back-to-back
  const b2bComponent = isBackToBack ? 2 : 0;

  // Total fatigue score, capped at 10
  const fatigueScore = Math.min(
    distanceComponent + timezoneComponent + b2bComponent,
    10
  );

  return {
    distanceMiles: Math.round(distanceMiles * 10) / 10,
    timezoneChanges,
    fatigueScore: Math.round(fatigueScore * 100) / 100,
  };
}

// ─── Seed Function ──────────────────────────────────────────────────────────

/**
 * Insert all static venue data into the Prisma Venue table.
 * Uses upsert keyed on (sport, teamName) to avoid duplicates.
 */
export async function seedVenues(): Promise<void> {
  console.log(`[venue] Seeding ${ALL_VENUES.length} venues...`);

  let upserted = 0;

  for (const v of ALL_VENUES) {
    await prisma.venue.upsert({
      where: {
        sport_teamName: {
          sport: v.sport as "NFL" | "NBA",
          teamName: v.teamName,
        },
      },
      update: {
        name: v.name,
        city: v.city,
        state: v.state,
        latitude: v.latitude,
        longitude: v.longitude,
        altitudeFt: v.altitudeFt,
        isDome: v.isDome,
        surface: v.surface,
        capacity: v.capacity,
      },
      create: {
        name: v.name,
        city: v.city,
        state: v.state,
        sport: v.sport as "NFL" | "NBA",
        teamName: v.teamName,
        latitude: v.latitude,
        longitude: v.longitude,
        altitudeFt: v.altitudeFt,
        isDome: v.isDome,
        surface: v.surface,
        capacity: v.capacity,
      },
    });
    upserted++;
  }

  console.log(`[venue] Seed complete: ${upserted} venues upserted`);
}
