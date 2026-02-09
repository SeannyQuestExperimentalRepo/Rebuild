"""
NFL Spread Fill-In via nflreadpy

Fills missing spread and over/under data in nfl-games-staging.json
using nflverse schedule data (load_schedules). Coverage: 1999-present,
100% of games.

Convention: positive spread = home team favored (verified: matches existing data).

Only fills null values — never overwrites existing Database.xlsx data.

Usage:
    python scripts/importers/import-nfl-spreads.py [--dry-run]
"""

import json
import os
import sys

import nflreadpy as nfl

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "../../data")
NFL_FILE = os.path.join(DATA_DIR, "nfl-games-staging.json")

DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------------------
# nflverse team abbreviation -> canonical name mapping
# (reused from normalize-player-games.py)
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
    "LAR": "Los Angeles Rams",
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
    # Historical abbreviations
    "OAK": "Las Vegas Raiders",
    "SD": "Los Angeles Chargers",
    "STL": "Los Angeles Rams",
}

# nflverse game_type -> our week string
GAME_TYPE_MAP = {
    "WC": "WildCard",
    "DIV": "Division",
    "CON": "ConfChamp",
    "SB": "SuperBowl",
}


# ---------------------------------------------------------------------------
# Spread result calculations (matching calculate-results.ts)
# ---------------------------------------------------------------------------

def calculate_spread_result(home_score, away_score, spread):
    """margin = (homeScore - awayScore) + spread"""
    if spread is None or home_score is None or away_score is None:
        return None
    margin = (home_score - away_score) + spread
    if margin > 0:
        return "COVERED"
    elif margin < 0:
        return "LOST"
    return "PUSH"


def calculate_ou_result(home_score, away_score, over_under):
    if over_under is None or home_score is None or away_score is None:
        return None
    total = home_score + away_score
    if total > over_under:
        return "OVER"
    elif total < over_under:
        return "UNDER"
    return "PUSH"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("NFL Spread Fill-In via nflreadpy")
    print("=" * 50)
    if DRY_RUN:
        print("** DRY RUN — no files will be written **\n")

    # Load existing NFL game data
    print("Loading NFL games...")
    with open(NFL_FILE, "r") as f:
        games = json.load(f)
    print(f"  {len(games):,} total games")

    # Count current missing
    missing_before = sum(1 for g in games if g.get("spread") is None)
    print(f"  {missing_before:,} games missing spread data\n")

    # Load nflverse schedules (1999-2025)
    print("Loading nflverse schedules (1999-2025)...")
    seasons = list(range(1999, 2026))
    sched = nfl.load_schedules(seasons)
    print(f"  {sched.height:,} schedule rows loaded\n")

    # Build lookup index: (season, week_str, homeTeamCanonical) -> row
    # For regular season: week_str = str(week)
    # For playoffs: use game_type mapping
    nflverse_index = {}

    for row in sched.iter_rows(named=True):
        season = row["season"]
        game_type = row["game_type"]
        week = row["week"]
        home_team_abbrev = row["home_team"]
        spread_line = row["spread_line"]
        total_line = row["total_line"]

        # Map home team abbreviation to canonical name
        home_canonical = TEAM_ABBREV_MAP.get(home_team_abbrev)
        if not home_canonical:
            continue

        # Determine our week string
        if game_type == "REG":
            week_str = str(week)
        elif game_type in GAME_TYPE_MAP:
            week_str = GAME_TYPE_MAP[game_type]
        else:
            continue

        key = (season, week_str, home_canonical)
        nflverse_index[key] = {
            "spread_line": spread_line,
            "total_line": total_line,
        }

    print(f"  Built index with {len(nflverse_index):,} entries\n")

    # Fill missing spreads
    filled = 0
    not_found = 0
    already_has = 0
    by_season = {}

    for game in games:
        if game.get("spread") is not None:
            already_has += 1
            continue

        season = game.get("season")
        week = str(game.get("week", ""))
        home = game.get("homeTeamCanonical", "")

        if not season or not week or not home:
            continue

        key = (season, week, home)
        match = nflverse_index.get(key)

        if match and match["spread_line"] is not None:
            game["spread"] = match["spread_line"]
            game["overUnder"] = match["total_line"]
            game["spreadResult"] = calculate_spread_result(
                game.get("homeScore"), game.get("awayScore"), match["spread_line"]
            )
            game["ouResult"] = calculate_ou_result(
                game.get("homeScore"), game.get("awayScore"), match["total_line"]
            )
            filled += 1
            by_season[season] = by_season.get(season, 0) + 1
        else:
            not_found += 1

    # Summary
    missing_after = sum(1 for g in games if g.get("spread") is None)
    print("=" * 50)
    print(f"  Games filled:         {filled:,}")
    print(f"  Already had spread:   {already_has:,}")
    print(f"  Not found in nflverse: {not_found:,}")
    print(f"  Missing before:       {missing_before:,}")
    print(f"  Missing after:        {missing_after:,}")
    print(f"  Coverage:             {(len(games) - missing_after) / len(games) * 100:.1f}%")

    if by_season:
        print(f"\n  Filled by season:")
        for s in sorted(by_season.keys()):
            print(f"    {s}: {by_season[s]} games")

    # Spot-check: show a few filled games
    filled_games = [g for g in games if g.get("season") == 2025 and g.get("spread") is not None]
    if filled_games:
        print(f"\n  Sample filled 2025 games:")
        for g in filled_games[:3]:
            print(f"    {g['gameDate']} {g['awayTeamCanonical']} @ {g['homeTeamCanonical']}: "
                  f"spread={g['spread']}, ou={g['overUnder']}")

    # Write back
    if not DRY_RUN and filled > 0:
        print(f"\n  Writing to {os.path.basename(NFL_FILE)}...")
        with open(NFL_FILE, "w") as f:
            json.dump(games, f, indent=2)
            f.write("\n")
        print("  Done!")
    elif DRY_RUN:
        print(f"\n  Dry run complete — {filled} games would be updated.")
    else:
        print("\n  No games to fill.")


if __name__ == "__main__":
    main()
