"""
NFL Historical Spread Fill-In via Spreadspoke (Kaggle)

Fills missing spread and over/under data in nfl-games-staging.json
using the Spreadspoke CSV dataset (originally from Kaggle tobycrabtree).
Coverage: 1979-2017 with 100% spread data.

Convention: positive spread = home team favored.

Spreadspoke format:
  - team_favorite_id: abbreviation of favored team (e.g., "MIA", "PICK")
  - spread_favorite: always negative or 0 (e.g., -3 means favorite by 3)
  - over_under_line: total points line

Conversion to our convention:
  - If home is favorite: spread = -spread_favorite (e.g., -3 → +3, home favored)
  - If away is favorite: spread = spread_favorite (e.g., -3, away favored)
  - If PICK: spread = 0

Only fills null values — never overwrites existing data.

Usage:
    python scripts/importers/import-nfl-spreadspoke.py [--dry-run]
"""

import csv
import json
import os
import sys
from datetime import datetime

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

DATA_DIR = os.path.join(os.path.dirname(__file__), "../../data")
NFL_FILE = os.path.join(DATA_DIR, "nfl-games-staging.json")
SPREADSPOKE_FILE = "/tmp/spreadspoke_clean.csv"

DRY_RUN = "--dry-run" in sys.argv

# ---------------------------------------------------------------------------
# Spreadspoke abbreviation -> canonical name mapping
# Covers historical team names (1979-1998)
# ---------------------------------------------------------------------------

SPREADSPOKE_ABBREV_MAP = {
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
    "IND": "Indianapolis Colts",
    "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs",
    "LAC": "Los Angeles Chargers",
    "LAR": "Los Angeles Rams",
    "MIA": "Miami Dolphins",
    "MIN": "Minnesota Vikings",
    "NE": "New England Patriots",
    "NO": "New Orleans Saints",
    "NYG": "New York Giants",
    "NYJ": "New York Jets",
    "OAK": "Las Vegas Raiders",
    "PHI": "Philadelphia Eagles",
    "PIT": "Pittsburgh Steelers",
    "SD": "Los Angeles Chargers",
    "SEA": "Seattle Seahawks",
    "SF": "San Francisco 49ers",
    "STL": "Los Angeles Rams",
    "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders",
}

# Spreadspoke uses FULL team names (including historical) as team_home/team_away
SPREADSPOKE_NAME_TO_CANONICAL = {
    # Current names
    "Arizona Cardinals": "Arizona Cardinals",
    "Atlanta Falcons": "Atlanta Falcons",
    "Baltimore Ravens": "Baltimore Ravens",
    "Buffalo Bills": "Buffalo Bills",
    "Carolina Panthers": "Carolina Panthers",
    "Chicago Bears": "Chicago Bears",
    "Cincinnati Bengals": "Cincinnati Bengals",
    "Cleveland Browns": "Cleveland Browns",
    "Dallas Cowboys": "Dallas Cowboys",
    "Denver Broncos": "Denver Broncos",
    "Detroit Lions": "Detroit Lions",
    "Green Bay Packers": "Green Bay Packers",
    "Houston Texans": "Houston Texans",
    "Indianapolis Colts": "Indianapolis Colts",
    "Jacksonville Jaguars": "Jacksonville Jaguars",
    "Kansas City Chiefs": "Kansas City Chiefs",
    "Los Angeles Rams": "Los Angeles Rams",
    "Los Angeles Chargers": "Los Angeles Chargers",
    "Las Vegas Raiders": "Las Vegas Raiders",
    "Miami Dolphins": "Miami Dolphins",
    "Minnesota Vikings": "Minnesota Vikings",
    "New England Patriots": "New England Patriots",
    "New Orleans Saints": "New Orleans Saints",
    "New York Giants": "New York Giants",
    "New York Jets": "New York Jets",
    "Philadelphia Eagles": "Philadelphia Eagles",
    "Pittsburgh Steelers": "Pittsburgh Steelers",
    "San Francisco 49ers": "San Francisco 49ers",
    "Seattle Seahawks": "Seattle Seahawks",
    "Tampa Bay Buccaneers": "Tampa Bay Buccaneers",
    "Tennessee Titans": "Tennessee Titans",
    "Washington Commanders": "Washington Commanders",
    # Historical names -> canonical (modern) name
    "Baltimore Colts": "Indianapolis Colts",
    "Houston Oilers": "Tennessee Titans",
    "Los Angeles Raiders": "Las Vegas Raiders",
    "Oakland Raiders": "Las Vegas Raiders",
    "Phoenix Cardinals": "Arizona Cardinals",
    "San Diego Chargers": "Los Angeles Chargers",
    "St. Louis Cardinals": "Arizona Cardinals",
    "St. Louis Rams": "Los Angeles Rams",
    "Tennessee Oilers": "Tennessee Titans",
    "Washington Redskins": "Washington Commanders",
}


# ---------------------------------------------------------------------------
# Spread result calculations (matching calculate-results.ts)
# ---------------------------------------------------------------------------

def calculate_spread_result(home_score, away_score, spread):
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
    print("NFL Historical Spread Fill-In via Spreadspoke")
    print("=" * 50)
    if DRY_RUN:
        print("** DRY RUN — no files will be written **\n")

    # Load existing NFL game data
    print("Loading NFL games...")
    with open(NFL_FILE, "r") as f:
        games = json.load(f)
    print(f"  {len(games):,} total games")

    missing_before = sum(1 for g in games if g.get("spread") is None)
    print(f"  {missing_before:,} games missing spread data\n")

    # Load Spreadspoke CSV
    print(f"Loading Spreadspoke data from {SPREADSPOKE_FILE}...")
    with open(SPREADSPOKE_FILE, "r") as f:
        reader = csv.DictReader(f)
        ss_rows = list(reader)
    print(f"  {len(ss_rows):,} total rows")

    # Filter to rows with spread data (1979+)
    ss_with_spread = [
        r for r in ss_rows
        if r.get("spread_favorite", "").strip()
    ]
    print(f"  {len(ss_with_spread):,} rows with spread data\n")

    # Build Spreadspoke lookup: (season, homeTeamCanonical, week) -> spread info
    # Date is MM/DD/YYYY, convert to match our data's gameDate YYYY-MM-DD
    ss_index = {}

    for row in ss_with_spread:
        season = int(row["schedule_season"])
        home_name = row["team_home"]
        home_canonical = SPREADSPOKE_NAME_TO_CANONICAL.get(home_name)
        if not home_canonical:
            continue

        # Parse date from MM/DD/YYYY to YYYY-MM-DD
        try:
            dt = datetime.strptime(row["schedule_date"], "%m/%d/%Y")
            date_str = dt.strftime("%Y-%m-%d")
        except ValueError:
            continue

        # Determine spread from our home team's perspective
        fav_id = row.get("team_favorite_id", "").strip()
        spread_fav = float(row["spread_favorite"])
        ou_line = float(row["over_under_line"]) if row.get("over_under_line", "").strip() else None

        if fav_id == "PICK" or fav_id == "":
            home_spread = 0.0
        else:
            # Map favorite abbreviation to canonical name
            fav_canonical = SPREADSPOKE_ABBREV_MAP.get(fav_id)
            if not fav_canonical:
                continue

            # Also check if fav matches via historical name
            away_name = row["team_away"]
            away_canonical = SPREADSPOKE_NAME_TO_CANONICAL.get(away_name)

            if fav_canonical == home_canonical:
                # Home is favored: spread_fav is -3, our convention = +3
                home_spread = -spread_fav
            elif fav_canonical == away_canonical:
                # Away is favored: spread_fav is -3, our convention = -3
                home_spread = spread_fav
            else:
                # Couldn't determine — try matching via historical names
                # fav_canonical might map to a current name that doesn't match
                # the historical name. Check if the names correspond to the same franchise.
                home_hist_canonical = SPREADSPOKE_NAME_TO_CANONICAL.get(home_name, home_name)
                away_hist_canonical = SPREADSPOKE_NAME_TO_CANONICAL.get(away_name, away_name)

                if fav_canonical == home_hist_canonical:
                    home_spread = -spread_fav
                elif fav_canonical == away_hist_canonical:
                    home_spread = spread_fav
                else:
                    # Still can't match — skip
                    continue

        key = (date_str, home_canonical)
        ss_index[key] = {
            "spread": home_spread,
            "over_under": ou_line,
        }

    print(f"  Built index with {len(ss_index):,} entries\n")

    # Fill missing spreads
    filled = 0
    not_found = 0
    already_has = 0
    by_season = {}

    for game in games:
        if game.get("spread") is not None:
            already_has += 1
            continue

        home = game.get("homeTeamCanonical", "")
        date_str = game.get("gameDate", "")

        if not home or not date_str:
            continue

        key = (date_str, home)
        match = ss_index.get(key)

        if match:
            game["spread"] = match["spread"]
            game["overUnder"] = match["over_under"]
            game["spreadResult"] = calculate_spread_result(
                game.get("homeScore"), game.get("awayScore"), match["spread"]
            )
            game["ouResult"] = calculate_ou_result(
                game.get("homeScore"), game.get("awayScore"), match["over_under"]
            )
            filled += 1
            season = game.get("season", "?")
            by_season[season] = by_season.get(season, 0) + 1
        else:
            not_found += 1

    # Summary
    missing_after = sum(1 for g in games if g.get("spread") is None)
    print("=" * 50)
    print(f"  Games filled:           {filled:,}")
    print(f"  Already had spread:     {already_has:,}")
    print(f"  Not found in Spreadspoke: {not_found:,}")
    print(f"  Missing before:         {missing_before:,}")
    print(f"  Missing after:          {missing_after:,}")
    print(f"  Coverage:               {(len(games) - missing_after) / len(games) * 100:.1f}%")

    if by_season:
        print(f"\n  Filled by season:")
        for s in sorted(by_season.keys()):
            print(f"    {s}: {by_season[s]} games")

    # Spot-check
    filled_games = [
        g for g in games
        if g.get("season") and 1979 <= g["season"] <= 1998 and g.get("spread") is not None
    ]
    if filled_games:
        print(f"\n  Sample filled 1979-1998 games:")
        for g in filled_games[:5]:
            print(
                f"    {g['gameDate']} {g.get('awayTeamCanonical', '?')} @ {g.get('homeTeamCanonical', '?')}: "
                f"spread={g['spread']}, ou={g['overUnder']}, result={g.get('spreadResult')}"
            )

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
