"""
NFL Player Data Extraction Script

Uses nflreadpy (nflverse ecosystem) to pull player-level game stats
for all current NFL players (2024 roster). Exports JSON files consumed
by the TypeScript normalization pipeline.

Usage:
    python scripts/player-data/extract-nfl-players.py

Output files:
    data/raw/nfl-players/current-player-ids.json
    data/raw/nfl-players/player-weekly-stats.json
    data/raw/nfl-players/player-metadata.json
    data/raw/nfl-players/snap-counts.json
"""

import json
import os
import sys
import time

import nflreadpy as nfl

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../../data/raw/nfl-players")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Current roster year — defines "current players"
ROSTER_YEAR = 2024

# Earliest entry year among current players is 2004, but weekly stats
# are available from 1999. We pull from 2004 onward to cover all careers.
EARLIEST_SEASON = 2004
LATEST_SEASON = 2024

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def polars_to_records(df):
    """Convert a Polars DataFrame to a list of dicts (JSON-safe)."""
    import polars as pl
    # Convert to Python dicts, handling null values
    records = []
    for row in df.iter_rows(named=True):
        clean = {}
        for k, v in row.items():
            if v is None:
                clean[k] = None
            elif isinstance(v, float) and (v != v):  # NaN check
                clean[k] = None
            else:
                clean[k] = v
        records.append(clean)
    return records


def write_json(data, filename):
    """Write data to a JSON file in the output directory."""
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w") as f:
        json.dump(data, f, default=str)
    size_mb = os.path.getsize(path) / (1024 * 1024)
    print(f"  Wrote {path} ({len(data)} records, {size_mb:.1f} MB)")


# ---------------------------------------------------------------------------
# Step 1: Pull 2024 rosters to get current player IDs
# ---------------------------------------------------------------------------

print(f"Step 1: Loading {ROSTER_YEAR} rosters...")
t0 = time.time()

rosters = nfl.load_rosters(seasons=[ROSTER_YEAR])
print(f"  Raw roster rows: {len(rosters)}")

# Extract unique player IDs (gsis_id is the primary nflverse key)
# Drop nulls
rosters_clean = rosters.filter(rosters["gsis_id"].is_not_null())
current_ids = rosters_clean["gsis_id"].unique().to_list()
print(f"  Unique current player IDs: {len(current_ids)}")
print(f"  Entry year range: {rosters_clean['entry_year'].min()} - {rosters_clean['entry_year'].max()}")

# Save current player IDs
write_json(current_ids, "current-player-ids.json")

# ---------------------------------------------------------------------------
# Step 2: Pull player metadata from roster data
# ---------------------------------------------------------------------------

print(f"\nStep 2: Extracting player metadata...")

# Keep one row per player (most recent data)
metadata_cols = [
    "gsis_id", "full_name", "first_name", "last_name", "position",
    "jersey_number", "birth_date", "height", "weight", "college",
    "years_exp", "team", "entry_year", "rookie_year",
    "draft_club", "draft_number", "headshot_url",
    "espn_id", "pfr_id",
]

# Only keep columns that exist
available_cols = [c for c in metadata_cols if c in rosters_clean.columns]
player_meta = rosters_clean.select(available_cols).unique(subset=["gsis_id"], keep="last")
player_meta_records = polars_to_records(player_meta)

write_json(player_meta_records, "player-metadata.json")

print(f"  Elapsed: {time.time() - t0:.1f}s")

# ---------------------------------------------------------------------------
# Step 3: Pull weekly player stats for all relevant seasons
# ---------------------------------------------------------------------------

print(f"\nStep 3: Loading player stats for seasons {EARLIEST_SEASON}-{LATEST_SEASON}...")
t1 = time.time()

seasons = list(range(EARLIEST_SEASON, LATEST_SEASON + 1))
all_stats = nfl.load_player_stats(seasons=seasons)
print(f"  Total stat rows (all players): {len(all_stats)}")

# Filter to current players only
current_ids_set = set(current_ids)
player_stats = all_stats.filter(
    all_stats["player_id"].is_in(current_ids)
)
print(f"  Filtered to current players: {len(player_stats)} rows")

# Show position breakdown
pos_counts = player_stats.group_by("position_group").len().sort("len", descending=True)
print(f"  Position breakdown:")
for row in pos_counts.iter_rows(named=True):
    print(f"    {row['position_group']}: {row['len']} game-rows")

# Convert and save
player_stats_records = polars_to_records(player_stats)
write_json(player_stats_records, "player-weekly-stats.json")

print(f"  Elapsed: {time.time() - t1:.1f}s")

# ---------------------------------------------------------------------------
# Step 4: Pull snap counts (2012+)
# ---------------------------------------------------------------------------

print(f"\nStep 4: Loading snap counts (2012-{LATEST_SEASON})...")
t2 = time.time()

snap_seasons = list(range(2012, LATEST_SEASON + 1))
try:
    snaps = nfl.load_snap_counts(seasons=snap_seasons)
    print(f"  Total snap rows (all players): {len(snaps)}")

    # Snap counts use pfr_player_id, not gsis_id. We need to map.
    # Get the pfr_id -> gsis_id mapping from our roster metadata
    pfr_to_gsis = {}
    for rec in player_meta_records:
        pfr_id = rec.get("pfr_id")
        gsis_id = rec.get("gsis_id")
        if pfr_id and gsis_id:
            pfr_to_gsis[pfr_id] = gsis_id

    print(f"  PFR-to-GSIS mapping entries: {len(pfr_to_gsis)}")

    # Filter snap counts to current players via pfr_player_id
    current_pfr_ids = list(pfr_to_gsis.keys())
    player_snaps = snaps.filter(
        snaps["pfr_player_id"].is_in(current_pfr_ids)
    )
    print(f"  Filtered to current players: {len(player_snaps)} snap rows")

    # Add gsis_id column for easier joining later
    snap_records = polars_to_records(player_snaps)
    for rec in snap_records:
        rec["gsis_id"] = pfr_to_gsis.get(rec.get("pfr_player_id"))

    write_json(snap_records, "snap-counts.json")
    print(f"  Elapsed: {time.time() - t2:.1f}s")

except Exception as e:
    print(f"  WARNING: Snap count loading failed: {e}")
    print(f"  Continuing without snap counts...")
    write_json([], "snap-counts.json")

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

total_elapsed = time.time() - t0
print(f"\n{'=' * 60}")
print(f"Extraction complete in {total_elapsed:.1f}s")
print(f"  Current players: {len(current_ids)}")
print(f"  Player game rows: {len(player_stats_records)}")
print(f"  Seasons covered: {EARLIEST_SEASON}-{LATEST_SEASON}")
print(f"  Output directory: {OUTPUT_DIR}")
print(f"{'=' * 60}")
