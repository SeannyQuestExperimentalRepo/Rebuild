"""
NFL Player Game Data Normalization

Joins player weekly stats with existing game-level data to produce
the final nfl-player-games.json file. Each row is one player's
performance in one game, enriched with betting/weather/context from
the game-level data.

Usage:
    python scripts/player-data/normalize-player-games.py

Input:
    data/raw/nfl-players/player-weekly-stats.json
    data/raw/nfl-players/player-metadata.json
    data/raw/nfl-players/snap-counts.json
    data/nfl-games-staging.json

Output:
    data/nfl-player-games.json
"""

import json
import os
import sys
import time

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_DIR = os.path.join(os.path.dirname(__file__), "../..")
RAW_DIR = os.path.join(BASE_DIR, "data/raw/nfl-players")
GAME_FILE = os.path.join(BASE_DIR, "data/nfl-games-staging.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "data/nfl-player-games.json")

# ---------------------------------------------------------------------------
# nflverse team abbreviation -> canonical name mapping
# ---------------------------------------------------------------------------

TEAM_ABBREV_MAP = {
    "ARI": "Arizona Cardinals",
    "ATL": "Atlanta Falcons",
    "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills",
    "CAR": "Carolina Panthers",
    "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals",
    "CLE": "Cleveland Browns",
    "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos",
    "DET": "Detroit Lions",
    "GB": "Green Bay Packers",
    "HOU": "Houston Texans",
    "IND": "Indianapolis Colts",
    "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs",
    "LA": "Los Angeles Rams",
    "LAC": "Los Angeles Chargers",
    "LAR": "Los Angeles Rams",     # alternate abbreviation
    "LV": "Las Vegas Raiders",
    "MIA": "Miami Dolphins",
    "MIN": "Minnesota Vikings",
    "NE": "New England Patriots",
    "NO": "New Orleans Saints",
    "NYG": "New York Giants",
    "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles",
    "PIT": "Pittsburgh Steelers",
    "SEA": "Seattle Seahawks",
    "SF": "San Francisco 49ers",
    "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders",
    # Historical abbreviations (pre-relocation)
    "OAK": "Las Vegas Raiders",
    "SD": "Los Angeles Chargers",
    "STL": "Los Angeles Rams",
}

# nflverse playoff week -> existing data week string mapping
PLAYOFF_WEEK_MAP = {
    18: "WildCard",
    19: "Division",
    20: "ConfChamp",
    21: "SuperBowl",
    22: "SuperBowl",  # some years use 22
}

# Stat columns to keep (trimming the 114 columns down to essentials)
KEEP_STATS = [
    # Identity
    "player_id", "player_name", "player_display_name",
    "position", "position_group", "season", "week", "season_type",
    "team", "opponent_team",
    # Passing
    "completions", "attempts", "passing_yards", "passing_tds",
    "passing_interceptions", "sacks_suffered", "sack_yards_lost",
    "passing_air_yards", "passing_yards_after_catch",
    "passing_first_downs", "passing_epa", "passing_cpoe", "pacr",
    "passing_2pt_conversions",
    # Rushing
    "carries", "rushing_yards", "rushing_tds",
    "rushing_fumbles", "rushing_fumbles_lost",
    "rushing_first_downs", "rushing_epa", "rushing_2pt_conversions",
    # Receiving
    "targets", "receptions", "receiving_yards", "receiving_tds",
    "receiving_fumbles", "receiving_fumbles_lost",
    "receiving_air_yards", "receiving_yards_after_catch",
    "receiving_first_downs", "receiving_epa",
    "racr", "target_share", "air_yards_share", "wopr",
    "receiving_2pt_conversions",
    # Defense
    "def_tackles_solo", "def_tackles_with_assist",
    "def_tackles_for_loss", "def_fumbles_forced",
    "def_sacks", "def_qb_hits", "def_interceptions",
    "def_interception_yards", "def_pass_defended", "def_tds",
    # Special teams
    "special_teams_tds",
    # Kicking
    "fg_made", "fg_att", "fg_long", "fg_pct",
    "pat_made", "pat_att",
    # Fantasy
    "fantasy_points", "fantasy_points_ppr",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def load_json(path):
    """Load a JSON file."""
    print(f"  Loading {os.path.basename(path)}...", end="", flush=True)
    with open(path, "r") as f:
        data = json.load(f)
    print(f" {len(data)} records")
    return data


def trim_stat_row(row):
    """Keep only the columns in KEEP_STATS."""
    return {k: row.get(k) for k in KEEP_STATS}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    t0 = time.time()

    # --- Load data ---
    print("Loading data files...")
    stats = load_json(os.path.join(RAW_DIR, "player-weekly-stats.json"))
    metadata = load_json(os.path.join(RAW_DIR, "player-metadata.json"))
    snaps = load_json(os.path.join(RAW_DIR, "snap-counts.json"))
    games = load_json(GAME_FILE)

    # --- Build player metadata lookup ---
    print("\nBuilding player metadata index...")
    meta_by_id = {}
    for m in metadata:
        gsis_id = m.get("gsis_id")
        if gsis_id:
            meta_by_id[gsis_id] = m
    print(f"  {len(meta_by_id)} players indexed")

    # --- Build snap count lookup ---
    print("Building snap count index...")
    # Key: "{gsis_id}-{season}-{week}"
    snap_by_key = {}
    for s in snaps:
        gsis_id = s.get("gsis_id")
        season = s.get("season")
        week = s.get("week")
        if gsis_id and season is not None and week is not None:
            key = f"{gsis_id}-{season}-{week}"
            snap_by_key[key] = s
    print(f"  {len(snap_by_key)} snap entries indexed")

    # --- Build game lookup ---
    # Key: "{season}-{week_str}-{teamCanonical}" -> game object
    # We need to normalize week strings to match nflverse weeks
    print("Building game lookup index...")
    game_by_key = {}
    game_by_date_team = {}

    for g in games:
        season = g.get("season")
        week = g.get("week")
        home = g.get("homeTeamCanonical")
        away = g.get("awayTeamCanonical")
        game_date = g.get("gameDate")

        if not season or not home or not away:
            continue

        # Index by season-week-team (both home and away)
        key_home = f"{season}-{week}-{home}"
        key_away = f"{season}-{week}-{away}"
        game_by_key[key_home] = g
        game_by_key[key_away] = g

        # Also index by date-team for fallback
        if game_date:
            game_by_date_team[f"{game_date}-{home}"] = g
            game_by_date_team[f"{game_date}-{away}"] = g

    print(f"  {len(game_by_key)} game-team entries indexed")

    # --- Normalize player stats ---
    print(f"\nNormalizing {len(stats)} player-game rows...")

    results = []
    matched = 0
    unmatched = 0
    unmatched_examples = []

    for i, stat in enumerate(stats):
        if i % 20000 == 0 and i > 0:
            print(f"  Processed {i}/{len(stats)} ({matched} matched, {unmatched} unmatched)")

        player_id = stat.get("player_id")
        season = stat.get("season")
        week = stat.get("week")
        season_type = stat.get("season_type")
        team_abbrev = stat.get("team")
        opp_abbrev = stat.get("opponent_team")

        if not player_id or not season or week is None or not team_abbrev:
            unmatched += 1
            continue

        # Map team abbreviations to canonical names
        team_canonical = TEAM_ABBREV_MAP.get(team_abbrev)
        opp_canonical = TEAM_ABBREV_MAP.get(opp_abbrev, opp_abbrev)

        if not team_canonical:
            if unmatched < 5:
                print(f"  WARNING: Unknown team abbrev '{team_abbrev}'")
            unmatched += 1
            continue

        # Convert nflverse week to our week string for game lookup
        if season_type == "POST":
            week_str = PLAYOFF_WEEK_MAP.get(week, str(week))
        else:
            week_str = str(week)

        # Look up the game
        game_key = f"{season}-{week_str}-{team_canonical}"
        game = game_by_key.get(game_key)

        if not game:
            # Fallback: try opponent key (in case of team name mismatch)
            game_key_opp = f"{season}-{week_str}-{opp_canonical}"
            game = game_by_key.get(game_key_opp)

        # Determine home/away
        is_home = None
        if game:
            home_team = game.get("homeTeamCanonical", "")
            away_team = game.get("awayTeamCanonical", "")
            if team_canonical == home_team:
                is_home = True
            elif team_canonical == away_team:
                is_home = False
            else:
                # Fuzzy match: check if team_canonical is a substring
                if team_canonical.lower() in home_team.lower():
                    is_home = True
                elif team_canonical.lower() in away_team.lower():
                    is_home = False

        # Build the normalized record
        trimmed = trim_stat_row(stat)

        # Player metadata
        meta = meta_by_id.get(player_id, {})
        trimmed["birthDate"] = meta.get("birth_date")
        trimmed["college"] = meta.get("college")
        trimmed["draftYear"] = meta.get("entry_year")
        trimmed["draftRound"] = None  # nflverse roster doesn't have round
        trimmed["draftPick"] = meta.get("draft_number")
        trimmed["yearsExp"] = meta.get("years_exp")
        trimmed["jerseyNumber"] = meta.get("jersey_number")

        # Team name mappings
        trimmed["teamCanonical"] = team_canonical
        trimmed["opponentCanonical"] = opp_canonical

        # Snap counts
        snap_key = f"{player_id}-{season}-{week}"
        snap = snap_by_key.get(snap_key, {})
        trimmed["offensiveSnaps"] = snap.get("offense_snaps")
        trimmed["offensiveSnapPct"] = snap.get("offense_pct")
        trimmed["defensiveSnaps"] = snap.get("defense_snaps")
        trimmed["defensiveSnapPct"] = snap.get("defense_pct")
        trimmed["stSnaps"] = snap.get("st_snaps")
        trimmed["stSnapPct"] = snap.get("st_pct")

        # Game context (if matched)
        if game and is_home is not None:
            matched += 1

            trimmed["gameDate"] = game.get("gameDate")
            trimmed["dayOfWeek"] = game.get("dayOfWeek")
            trimmed["isHome"] = is_home

            if is_home:
                trimmed["teamScore"] = game.get("homeScore")
                trimmed["opponentScore"] = game.get("awayScore")
            else:
                trimmed["teamScore"] = game.get("awayScore")
                trimmed["opponentScore"] = game.get("homeScore")

            # Game result
            ts = trimmed["teamScore"]
            os_ = trimmed["opponentScore"]
            if ts is not None and os_ is not None:
                if ts > os_:
                    trimmed["gameResult"] = "W"
                elif ts < os_:
                    trimmed["gameResult"] = "L"
                else:
                    trimmed["gameResult"] = "T"
            else:
                trimmed["gameResult"] = None

            # Spread from player's team perspective
            raw_spread = game.get("spread")
            if raw_spread is not None:
                # Raw spread is from home perspective (negative = home favored)
                trimmed["spread"] = raw_spread if is_home else -raw_spread
            else:
                trimmed["spread"] = None

            trimmed["overUnder"] = game.get("overUnder")

            # Spread/OU results
            trimmed["spreadResult"] = game.get("spreadResult")
            trimmed["ouResult"] = game.get("ouResult")

            # Game context flags
            trimmed["isPlayoff"] = game.get("isPlayoff", False)
            trimmed["isPrimetime"] = game.get("isPrimetime", False)
            trimmed["primetimeSlot"] = game.get("primetimeSlot")
            trimmed["isNeutralSite"] = game.get("isNeutralSite", False)

            # Weather
            trimmed["temperature"] = game.get("temperature")
            trimmed["windMph"] = game.get("windMph")
            trimmed["weatherCategory"] = game.get("weatherCategory")

            # Rest days
            if is_home:
                trimmed["restDays"] = game.get("homeRestDays")
                trimmed["isByeWeek"] = game.get("homeIsByeWeek")
            else:
                trimmed["restDays"] = game.get("awayRestDays")
                trimmed["isByeWeek"] = game.get("awayIsByeWeek")
        else:
            unmatched += 1
            if len(unmatched_examples) < 10:
                unmatched_examples.append(
                    f"  {stat.get('player_display_name')} ({team_abbrev}) "
                    f"season={season} week={week} type={season_type}"
                )

            # Still include the row but without game context
            trimmed["gameDate"] = None
            trimmed["dayOfWeek"] = None
            trimmed["isHome"] = None
            trimmed["teamScore"] = None
            trimmed["opponentScore"] = None
            trimmed["gameResult"] = None
            trimmed["spread"] = None
            trimmed["overUnder"] = None
            trimmed["spreadResult"] = None
            trimmed["ouResult"] = None
            trimmed["isPlayoff"] = season_type == "POST"
            trimmed["isPrimetime"] = None
            trimmed["primetimeSlot"] = None
            trimmed["isNeutralSite"] = None
            trimmed["temperature"] = None
            trimmed["windMph"] = None
            trimmed["weatherCategory"] = None
            trimmed["restDays"] = None
            trimmed["isByeWeek"] = None

        results.append(trimmed)

    # --- Summary ---
    match_rate = matched / len(stats) * 100 if stats else 0
    print(f"\n  Total: {len(results)} player-game records")
    print(f"  Matched to game data: {matched} ({match_rate:.1f}%)")
    print(f"  Unmatched: {unmatched}")

    if unmatched_examples:
        print(f"\n  Unmatched examples:")
        for ex in unmatched_examples:
            print(ex)

    # --- Write output ---
    print(f"\nWriting {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, separators=(",", ":"), default=str)

    size_mb = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)
    print(f"  Output: {size_mb:.1f} MB")

    # --- Position stats ---
    pos_counts = {}
    for r in results:
        pg = r.get("position_group", "?")
        pos_counts[pg] = pos_counts.get(pg, 0) + 1
    print(f"\n  By position group:")
    for pg, count in sorted(pos_counts.items(), key=lambda x: -x[1]):
        print(f"    {pg}: {count}")

    total_elapsed = time.time() - t0
    print(f"\n  Completed in {total_elapsed:.1f}s")


if __name__ == "__main__":
    main()
