"""
Fetch historical daily T-Rank ratings from cbbdata.com API.

This gives TRUE point-in-time ratings (what Barttorvik's model showed
on each date) instead of the blended approximation.

Setup:
  1. Register (free): python3 scripts/fetch-cbbdata-ratings.py --register
  2. Fetch data:       python3 scripts/fetch-cbbdata-ratings.py

The script saves data to data/pit-kenpom-ratings.json in the same format
the backtest expects. It replaces the blended approximation with real data.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from getpass import getpass
from pathlib import Path
from typing import Dict, List, Optional, Union
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from urllib.parse import urlencode

API_BASE = "https://www.cbbdata.com/api"
ENV_FILE = Path(__file__).resolve().parent.parent / ".env"
OUTPUT_FILE = Path(__file__).resolve().parent.parent / "data" / "pit-kenpom-ratings.json"


def load_api_key() -> str | None:
    """Load CBD_API_KEY from .env file or environment."""
    key = os.environ.get("CBD_API_KEY")
    if key:
        return key

    if ENV_FILE.exists():
        for line in ENV_FILE.read_text().splitlines():
            if line.startswith("CBD_API_KEY="):
                return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def save_api_key(key: str):
    """Append CBD_API_KEY to .env file."""
    if ENV_FILE.exists():
        content = ENV_FILE.read_text()
        if "CBD_API_KEY" in content:
            # Replace existing
            lines = content.splitlines()
            lines = [l for l in lines if not l.startswith("CBD_API_KEY")]
            lines.append(f'CBD_API_KEY="{key}"')
            ENV_FILE.write_text("\n".join(lines) + "\n")
        else:
            with open(ENV_FILE, "a") as f:
                f.write(f'\nCBD_API_KEY="{key}"\n')
    else:
        ENV_FILE.write_text(f'CBD_API_KEY="{key}"\n')
    print(f"  Saved API key to {ENV_FILE}")


def api_request(endpoint: str, method: str = "GET", data: dict = None) -> dict | list:
    """Make an API request to cbbdata.com."""
    url = f"{API_BASE}/{endpoint}"
    headers = {"Content-Type": "application/json", "User-Agent": "trendline-backtest/1.0"}

    if data and method == "POST":
        body = json.dumps(data).encode()
    else:
        body = None

    req = Request(url, data=body, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except HTTPError as e:
        error_body = e.read().decode()
        print(f"  API error {e.code}: {error_body}")
        raise


def register():
    """Register for a free cbbdata.com account."""
    print("=== Register for cbbdata.com (free) ===\n")
    username = input("Username: ").strip()
    email = input("Email: ").strip()
    password = getpass("Password: ")
    confirm = getpass("Confirm password: ")

    if password != confirm:
        print("Passwords don't match!")
        sys.exit(1)

    try:
        result = api_request("auth/register", "POST", {
            "username": username,
            "email": email,
            "password": password,
            "confirm_password": confirm,
        })
        print(f"\n  Registration successful!")
        print(f"  Now logging in to get API key...")
        login(username, password)
    except HTTPError:
        print("\n  Registration failed. Account may already exist — try logging in.")
        login_interactive()


def login(username: str = None, password: str = None):
    """Login and save API key."""
    if not username:
        username = input("Username: ").strip()
    if not password:
        password = getpass("Password: ")

    try:
        result = api_request("auth/login", "POST", {
            "username": username,
            "password": password,
        })
        # Result is the API key (first element if list, or string)
        key = result[0] if isinstance(result, list) else result.get("key", result)
        if isinstance(key, str) and len(key) > 10:
            save_api_key(key)
            print(f"  Login successful! API key saved.")
            return key
        else:
            print(f"  Unexpected response: {result}")
            sys.exit(1)
    except HTTPError:
        print("  Login failed. Check credentials.")
        sys.exit(1)


def login_interactive():
    """Interactive login prompt."""
    print("\n=== Login to cbbdata.com ===\n")
    return login()


def fetch_torvik_archive(api_key: str, year: int) -> list:
    """Fetch T-Rank daily archive ratings for a season."""
    parquet_path = OUTPUT_FILE.parent / "torvik-archive-raw.parquet"

    # Use cached parquet if available and fresh (< 1 day old)
    if parquet_path.exists():
        age_hours = (time.time() - parquet_path.stat().st_mtime) / 3600
        if age_hours < 24:
            print(f"\nUsing cached parquet ({age_hours:.1f}h old)")
            return convert_parquet(parquet_path)

    print(f"\nFetching T-Rank archive for {year}...")

    url = f"{API_BASE}/torvik/ratings/archive?year={year}&key={api_key}"
    headers = {"User-Agent": "trendline-backtest/1.0"}
    req = Request(url, headers=headers)

    try:
        with urlopen(req, timeout=120) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()

            if "json" in content_type or raw[:1] in (b"[", b"{"):
                data = json.loads(raw)
                print(f"  Got {len(data)} records (JSON)")
                return data
            else:
                # Likely parquet — save and convert
                parquet_path.parent.mkdir(parents=True, exist_ok=True)
                parquet_path.write_bytes(raw)
                print(f"  Got parquet file ({len(raw)} bytes), saved to {parquet_path}")
                return convert_parquet(parquet_path)
    except HTTPError as e:
        error_body = e.read().decode()
        print(f"  Fetch failed ({e.code}): {error_body}")
        sys.exit(1)


def convert_parquet(parquet_path: Path) -> list[dict]:
    """Convert parquet file to list of dicts using pandas."""
    try:
        import pandas as pd
        df = pd.read_parquet(parquet_path)
        print(f"  Converted parquet: {len(df)} rows, columns: {list(df.columns)}")
        return df.to_dict(orient="records")
    except ImportError:
        print("  pandas not installed. Installing...")
        os.system(f"{sys.executable} -m pip install pandas pyarrow --quiet")
        import pandas as pd
        df = pd.read_parquet(parquet_path)
        print(f"  Converted parquet: {len(df)} rows, columns: {list(df.columns)}")
        return df.to_dict(orient="records")


def build_pit_snapshots(records: list[dict]) -> list[dict]:
    """Convert raw archive records into PIT snapshot format for the backtest."""
    # Detect column names (cbbdata uses various conventions)
    sample = records[0] if records else {}
    cols = list(sample.keys())
    print(f"  Columns: {cols[:15]}...")

    # Map column names
    def get_col(row, *candidates):
        for c in candidates:
            if c in row and row[c] is not None:
                return row[c]
        return None

    # Group by date
    by_date: dict[str, dict[str, dict]] = {}

    for row in records:
        date = get_col(row, "date", "Date", "rating_date")
        if date is None:
            continue
        # Normalize date format
        if hasattr(date, "isoformat"):
            date_str = date.isoformat()[:10]
        elif "T" in str(date):
            date_str = str(date)[:10]
        else:
            date_str = str(date)

        team = get_col(row, "team", "Team", "TeamName", "team_name")
        if not team:
            continue

        adj_oe = float(get_col(row, "adj_o", "AdjOE", "adjoe", "adj_oe") or 0)
        adj_de = float(get_col(row, "adj_d", "AdjDE", "adjde", "adj_de") or 0)
        # AdjEM = AdjOE - AdjDE (not barthag which is win probability 0-1)
        adj_em_raw = get_col(row, "adj_em", "AdjEM", "adjem")
        adj_em = float(adj_em_raw) if adj_em_raw is not None else (adj_oe - adj_de)
        adj_tempo = float(get_col(row, "adj_t", "AdjTempo", "adjt", "adj_tempo") or 0)
        rank = int(get_col(row, "rk", "rank", "RankAdjEM") or 0)
        rank_oe = int(get_col(row, "adj_o_rk", "RankAdjOE") or 0)
        rank_de = int(get_col(row, "adj_d_rk", "RankAdjDE") or 0)
        rank_tempo = int(get_col(row, "adj_t_rk", "RankAdjTempo") or 0)
        # Parse wins/losses from "record" column (e.g., "35-4")
        record_str = str(get_col(row, "record", "rec") or "0-0")
        try:
            parts = record_str.split("-")
            wins = int(parts[0])
            losses = int(parts[1]) if len(parts) > 1 else 0
        except (ValueError, IndexError):
            wins = int(get_col(row, "wins", "Wins") or 0)
            losses = int(get_col(row, "losses", "Losses") or 0)
        conf = str(get_col(row, "conf", "ConfShort", "conference") or "")

        if date_str not in by_date:
            by_date[date_str] = {}

        by_date[date_str][team] = {
            "TeamName": team,
            "Season": 2025,
            "AdjEM": adj_em,
            "AdjOE": adj_oe,
            "AdjDE": adj_de,
            "AdjTempo": adj_tempo,
            "RankAdjEM": rank,
            "RankAdjOE": rank_oe,
            "RankAdjDE": rank_de,
            "RankAdjTempo": rank_tempo,
            "Wins": wins,
            "Losses": losses,
            "ConfShort": conf,
        }

    # Filter to season dates only (Nov through mid-April)
    all_dates = sorted(d for d in by_date.keys() if d <= "2025-04-08")
    print(f"  {len(all_dates)} season dates ({all_dates[0]} to {all_dates[-1]})")

    # Sample weekly (every 7 days) to keep file size reasonable
    snapshots = []
    last_date = ""
    for date_str in all_dates:
        if last_date and days_between(last_date, date_str) < 7:
            if date_str != all_dates[-1]:  # Always include last date
                continue

        ratings = by_date[date_str]
        snapshots.append({
            "date": date_str,
            "alpha": -1,  # Real data, not blended
            "teamCount": len(ratings),
            "ratings": ratings,
        })
        last_date = date_str

    print(f"  Built {len(snapshots)} weekly snapshots")
    return snapshots


def days_between(a: str, b: str) -> float:
    from datetime import datetime
    da = datetime.strptime(a[:10], "%Y-%m-%d")
    db = datetime.strptime(b[:10], "%Y-%m-%d")
    return abs((db - da).days)


def main():
    parser = argparse.ArgumentParser(description="Fetch T-Rank archive from cbbdata.com")
    parser.add_argument("--register", action="store_true", help="Register for a free account")
    parser.add_argument("--login", action="store_true", help="Login to get API key")
    parser.add_argument("--year", type=int, default=2025, help="Season year (default: 2025)")
    args = parser.parse_args()

    if args.register:
        register()
        return

    if args.login:
        login_interactive()
        return

    # Load API key
    api_key = load_api_key()
    if not api_key:
        print("No CBD_API_KEY found.")
        print("  Register: python3 scripts/fetch-cbbdata-ratings.py --register")
        print("  Login:    python3 scripts/fetch-cbbdata-ratings.py --login")
        sys.exit(1)

    print(f"=== Fetching T-Rank Archive (Season {args.year}) ===")
    print(f"  API key: {api_key[:8]}...")

    # Fetch data
    records = fetch_torvik_archive(api_key, args.year)
    if not records:
        print("No data returned!")
        sys.exit(1)

    # Build PIT snapshots
    snapshots = build_pit_snapshots(records)

    # Save
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(snapshots, indent=2, default=str))
    size_mb = OUTPUT_FILE.stat().st_size / 1024 / 1024
    print(f"\nSaved to {OUTPUT_FILE} ({size_mb:.1f} MB)")
    print(f"This replaces the blended approximation with real daily T-Rank data.")
    print(f"\nRe-run backtest: npx tsx scripts/backtest-ncaamb.ts")


if __name__ == "__main__":
    main()
