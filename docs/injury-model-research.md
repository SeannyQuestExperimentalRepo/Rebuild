# Injury-Adjusted Sports Betting Model Research

> Last updated: 2026-02-14

## Table of Contents
1. [Free Injury Data Sources](#1-free-injury-data-sources)
2. [Player Impact Metrics (Free)](#2-player-impact-metrics-free)
3. [Quantifying Missing Players → Point Swings](#3-quantifying-missing-players--point-swings)
4. [Open-Source Implementations & Papers](#4-open-source-implementations--papers)
5. [Minimum Viable Injury Adjustment](#5-minimum-viable-injury-adjustment)

---

## 1. Free Injury Data Sources

### NFL (Best availability — legally mandated)
- **NFL.com /injuries/** — Official injury reports published Wed/Thu/Fri during season. Includes practice participation status (Full/Limited/DNP) and game status (Out/Doubtful/Questionable). Scrapeable.
- **ESPN API** — `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/{id}/injuries` — Free JSON endpoint, no key needed.
- **Pro Football Reference** — Historical injury data via game logs (players who didn't play).
- **nflverse/nflreadr** (R) / **nfl_data_py** (Python) — Open-source packages that include roster/status data. `nflreadr::load_injuries()` gives weekly injury reports going back several years.
- **CBS Sports / Rotoworld RSS** — Scrapeable injury news feeds.

### NBA (Good availability — mandated since 2017)
- **NBA Official Injury Report** — Published daily by 5pm ET on NBA.com. PDF format at `https://official.nba.com/nba-injury-report-2024-25-season/`. Lists every player with status (Out/Doubtful/Questionable/Probable/Available).
- **nba_api** (Python, `pip install nba_api`) — Wraps NBA.com's stats API. No key needed. Endpoints include player game logs (tells you who played/didn't).
- **ESPN API** — `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/{id}/injuries` — Free JSON.
- **Basketball Reference** — Game logs show GP; cross-reference with schedule to find missed games.
- **Rotowire/CBS RSS** — Injury news feeds (scrapeable).

### NCAAMB (College Basketball)
- **No mandatory injury reports** — This is the hardest sport for injury data.
- **ESPN API** — `https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{id}/injuries` — Exists but sparse.
- **KenPom** — Doesn't publish injury data, but player minutes data (free tier) reveals who's missing from box scores.
- **Box score monitoring** — Best practical approach: track which players from the rotation appear in box scores. If a starter has 0 minutes, they're out. Use Sports Reference or ESPN box scores.
- **Twitter/X injury accounts** — @CBBonFOX, team beat reporters. Not programmatic but can be monitored.
- **Donbest.com** — Sometimes lists college injuries (scrapeable).

### NCAAF (College Football)
- **No mandatory injury reports** — Coaches routinely lie/obscure.
- **SEC requires availability reports** (since 2024) — Game-day availability lists.
- **ESPN API** — Same pattern as above for college football injuries.
- **Box score monitoring** — Same approach as NCAAMB: if a player who normally gets snaps has 0 stats, they were out.
- **Depth charts** — Published weekly by teams, available on ESPN/CBS. Changes in depth chart signal injuries.

### Universal Sources
| Source | Sports | Format | Access |
|--------|--------|--------|--------|
| ESPN API | All 4 | JSON | Free, no key |
| Sports Reference sites | All 4 | HTML tables | Scrape (rate-limited) |
| nflverse ecosystem | NFL | R/Python packages | Free |
| nba_api | NBA | Python package | Free |
| CBS Sports | All 4 | HTML/RSS | Scrape |

---

## 2. Player Impact Metrics (Free)

### NBA — Best Metric Ecosystem
| Metric | Source | What It Measures | Free? |
|--------|--------|-----------------|-------|
| **EPM** (Estimated Plus-Minus) | dunksandthrees.com | All-in-one impact per 100 poss | Viewable (scrape) |
| **BPM** (Box Plus-Minus) | Basketball Reference | Box score-estimated impact | Free |
| **VORP** (Value Over Replacement) | Basketball Reference | Cumulative BPM over replacement | Free |
| **WS** (Win Shares) | Basketball Reference | Wins attributed to player | Free |
| **PER** | Basketball Reference | Per-minute efficiency | Free |
| **RAPTOR** | FiveThirtyEight (archived) | Blend of box + on/off | GitHub archive |
| **On/Off splits** | NBA.com via nba_api | Net rating with/without player | Free |
| **DARKO** | apanalytics.shinyapps.io | Daily player projections | Free (viewable) |

**Best for injury adjustment: EPM or BPM.** Both express impact as points per 100 possessions relative to average. Easy to convert to "points per game" impact.

### NFL — More Positional
| Metric | Source | What It Measures | Free? |
|--------|--------|-----------------|-------|
| **EPA/play** (per player) | nflfastR / rbsdm.com | Expected points added | Free |
| **CPOE** (QBs) | nflfastR | Completion % over expected | Free |
| **PFF grades** | PFF | Subjective + analytic grades | **Paid** ❌ |
| **AV** (Approximate Value) | Pro Football Reference | Career value metric | Free |
| **ANY/A** (QBs) | Pro Football Reference | Adjusted net yards/attempt | Free |
| **WAR** (Wins Above Replacement) | PFR / Ben Baldwin | Positional value | Free (calculated) |

**Best for injury adjustment:** EPA/play for QBs (massive), AV or positional WAR for other positions. QB is ~80% of the injury signal in NFL.

### NCAAMB — Limited but Usable
| Metric | Source | What It Measures | Free? |
|--------|--------|-----------------|-------|
| **KenPom player stats** | kenpom.com | ORtg, DRtg, usage, etc. | Free tier limited |
| **BPM** | Barttorvik (barttorvik.com) | Box Plus-Minus for college | Free |
| **EvanMiya ratings** | evanmiya.com | Bayesian player impact | Partially free |
| **Sports Reference BPM** | sports-reference.com/cbb | College BPM | Free |
| **Box score stats** | ESPN/Sports Reference | Points, rebounds, assists | Free |

**Best for injury adjustment:** Barttorvik BPM — free, covers all D1 players, expressed in points per 100 possessions.

### NCAAF — Very Limited
| Metric | Source | What It Measures | Free? |
|--------|--------|-----------------|-------|
| **EPA/play** (QBs) | collegefootballdata.com | Expected points added | Free API |
| **PPA** (Predicted Points Added) | collegefootballdata.com | Similar to EPA | Free API |
| **SP+ player usage** | Not publicly broken out per player | — | — |
| **QBR** | ESPN | Total QB rating | Viewable |

**Best for injury adjustment:** QB EPA from collegefootballdata.com. For non-QBs, college football player-level impact is very hard to isolate — focus on QBs and maybe top RBs.

---

## 3. Quantifying "Missing Player X = Y Point Swing"

### The Core Formula

```
Point Swing = (Player_Impact - Replacement_Impact) × Minutes_Share × Pace_Factor
```

### NBA: Most Tractable

**Method 1: BPM/VORP approach (simplest)**
- BPM is points per 100 possessions above average
- A player with +6.0 BPM playing 34 min/game on a team with 100 possessions/game:
  - Impact = 6.0 × (34/48) = ~4.25 points/game above average
  - Replacement level ≈ -2.0 BPM
  - Missing this player = swing of (6.0 - (-2.0)) × (34/48) = ~5.7 points vs replacement
- **Simplified: BPM × minutes_fraction ≈ per-game point impact above average**

**Method 2: On/Off Net Rating (empirical)**
- NBA.com provides team net rating with/without each player
- Noisy for small samples but directly measures the question
- Available free via nba_api: `PlayerOnOffSummary` endpoint

**Method 3: EPM (most sophisticated free option)**
- EPM at dunksandthrees.com already accounts for teammate/opponent quality
- Directly interpretable: +5.0 EPM ≈ team scores 5 more points per 100 possessions with this player
- Convert: EPM × (player_minutes / 48) × (team_pace / 100) ≈ points/game impact

**Replacement Level Assumptions:**
- NBA: ~-2.0 BPM (end-of-bench player)
- Backup starter: ~0.0 BPM (league average)
- Key: know WHO replaces the injured player, not just generic replacement

### NFL: QB-Dominated

**QB Injury = Massive (~3-7 point swing)**
- Difference between elite QB and backup ≈ 0.15-0.25 EPA/play
- Over ~35 pass attempts: 0.20 × 35 = 7.0 expected points
- This translates roughly to 3-7 points on the spread depending on the drop-off
- Historical data: teams lose ~3-4 points of spread value when starting QB goes down

**Non-QB NFL Injuries:**
- Individual non-QB players are worth ~0.5-2 points at most
- Exceptions: elite edge rushers (~1-2 pts), elite WR1 (~1-1.5 pts)
- Cumulative injuries matter more: 3-4 starters out on one side of the ball ≈ 2-4 points

**Practical NFL formula:**
```
QB_adjustment = (starter_EPA - backup_EPA) × expected_dropbacks × 0.5
Non_QB_adjustment = sum(positional_value × (starter_grade - backup_grade)) 
                    for each missing starter
```

### College (NCAAMB & NCAAF)

**NCAAMB:**
- Use Barttorvik BPM same as NBA BPM method
- College has higher variance, fewer possessions, so adjustments are noisier
- Star players matter MORE in college (usage rates higher, fewer quality backups)
- Rule of thumb: losing a 20+ PPG scorer ≈ 3-6 point swing depending on replacement

**NCAAF:**
- QB injuries: 3-10 point swing (even bigger than NFL due to larger talent gaps)
- Use collegefootballdata.com EPA to compare starter vs backup
- Non-QB: very hard to quantify individually, focus on cumulative OL injuries

### Key Research / Models

1. **FiveThirtyEight RAPTOR WAR** — Converted player impact to wins, which converts to points (1 win ≈ 2.7 points of spread over a season). Their methodology is archived on GitHub.

2. **Adjusted Net Rating with lineup data** — NBA's best approach. Look at 5-man lineup net ratings to see how lineups with/without a player perform. Cleaning Lineup data available via nba_api.

3. **DARKO** — Provides daily win probability impact per player. Free at apanalytics.shinyapps.io.

4. **The Power Rank** — Ed Feng's work on injury-adjusted predictions (methodology published in blog posts).

---

## 4. Open-Source Implementations & Papers

### GitHub Repositories

| Repo | Description | Sport |
|------|-------------|-------|
| **nflverse/nflfastR** | Play-by-play data with EPA, WP models | NFL |
| **nflverse/nflreadr** | Load pre-cleaned NFL data (injuries, rosters) | NFL |
| **swar/nba_api** | Python wrapper for NBA.com API | NBA |
| **FiveThirtyEight/data** | Archived RAPTOR, ELO data | NBA/NFL |
| **collegefootballdata** | Free API for college football stats + EPA | NCAAF |
| **sportsdataverse** | Python/R packages for ESPN data | All |
| **barttorvik** | College basketball analytics (website, some data downloadable) | NCAAMB |
| **nflseedR / nflsimulator** | NFL simulation frameworks | NFL |
| **basketball_reference_web_scraper** | Python scraper for BBRef | NBA |

### Academic Papers & Key Articles

1. **"Accounting for Injuries in NFL Predictions"** — Various blog posts by Ben Baldwin (rbsdm.com) discuss using nflfastR EPA data to adjust for QB injuries.

2. **"EPM: Estimated Plus-Minus"** (Taylor Snarr, dunksandthrees.com/about/epm) — Methodology for the best free all-in-one NBA metric. Explains how to use it for predictions.

3. **"RAPTOR: Our New Metric"** (FiveThirtyEight, 2019) — Full methodology for player impact metric, including WAR calculation. Code/data archived on GitHub.

4. **"Adjusting for Injuries in Sports Prediction Markets"** — General framework discussed in sports analytics conferences (SSAC/MIT Sloan). Key finding: markets are slow to adjust for non-star injuries.

5. **"How Much Do Injuries Matter?"** (various Pinnacle articles) — Practical betting perspective on injury impact by position.

6. **KenPom methodology** — While player-level adjustment isn't published, KenPom's team ratings implicitly reflect injuries through results. The gap between preseason projections and current ratings can partially reflect injury impact.

### Key Finding from Literature
**Markets are generally efficient for star player injuries but underreact to:**
- Cumulative depth injuries (3rd string OL, backup rotation players)
- Players returning from injury (rust factor)
- Injuries announced close to game time (late scratches)
- College injuries (less information, less market attention)

---

## 5. Minimum Viable Injury Adjustment (Practical Approach)

### Tier 1: Dead Simple (Start Here)

**Track starters in/out + apply fixed positional values**

```python
# Fixed point swing values by position (approximate)
NBA_POSITION_VALUES = {
    'star': 4.0,      # All-NBA level
    'starter': 1.5,   # Average starter
    'rotation': 0.5,  # 6th-8th man
}

NFL_POSITION_VALUES = {
    'QB': 5.0,         # Starting QB
    'QB_elite': 7.0,   # Top-5 QB
    'WR1': 1.5,
    'RB1': 0.5,
    'Edge': 1.5,
    'CB1': 1.0,
    'OL': 0.5,         # Per lineman
}

NCAAMB_VALUES = {
    'star': 5.0,       # Leading scorer/best player
    'starter': 2.0,
    'rotation': 0.5,
}

NCAAF_VALUES = {
    'QB': 7.0,
    'other': 1.0,      # Only track QB realistically
}
```

**Implementation:**
1. Before each game, check ESPN injury API for both teams
2. Identify OUT players, look up their role (starter/rotation/star)
3. Sum point adjustments for each side
4. Adjust the spread: `adjusted_spread = market_spread + (away_injury_impact - home_injury_impact)`

### Tier 2: Metric-Based (Better)

**Use actual player impact metrics instead of fixed values**

```python
def nba_injury_adjustment(missing_players, team_pace=100):
    """
    missing_players: list of dicts with 'bpm', 'minutes_per_game', 'replacement_bpm'
    """
    total_swing = 0
    for p in missing_players:
        impact = (p['bpm'] - p['replacement_bpm']) * (p['minutes_per_game'] / 48) * (team_pace / 100)
        total_swing += impact
    return total_swing

def nfl_qb_adjustment(starter_epa, backup_epa, expected_dropbacks=35):
    """EPA per play difference × dropbacks, scaled to points"""
    return (starter_epa - backup_epa) * expected_dropbacks
```

**Data pipeline:**
1. Pre-season: scrape BPM/EPM for all players, store in DB
2. Daily: pull injury reports from ESPN API
3. Match injured players to their metrics
4. Calculate adjustment
5. Compare to market spread for edge detection

### Tier 3: Full Model (Ideal)

**Lineup-based predictions with injury-conditional ratings**

For NBA:
1. Pull all 5-man lineup data via nba_api
2. Build a model that predicts net rating from lineup composition
3. When a player is injured, substitute the expected replacement and re-predict
4. Difference = injury adjustment

For NFL:
1. Use nflfastR EPA models
2. Build team strength ratings conditioned on QB (the biggest factor)
3. Adjust for other personnel using AV or snap-weighted contributions

### Recommended Starting Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Injury Scraper │────▶│  Player Metrics   │────▶│  Spread Adjuster │
│  (ESPN API)     │     │  DB (BPM/EPA/etc) │     │  (per game)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                        │                        │
   NFL: nflreadr           NBA: BBRef/nba_api       Compare to
   NBA: ESPN API           NFL: nflfastR            market line
   CBB: ESPN + boxscores   CBB: Barttorvik          → find edges
   CFB: ESPN               CFB: cfbdata API
```

### Quick Wins (Highest ROI Adjustments)
1. **NFL QB injuries** — Biggest and most predictable impact. Track QB status religiously.
2. **NBA star players** — A top-10 NBA player being out is 4-6 points. Markets adjust but sometimes slowly.
3. **College basketball stars** — Less market attention, bigger edge opportunity.
4. **Late scratches** — Players ruled out <2 hours before tip. Lines may not fully adjust.
5. **Back-to-backs in NBA** — Rest patterns (stars sitting) are quasi-injury events.

### Data Refresh Cadence
- **NFL:** Wednesday (first practice report), Friday (final status) — 2x/week
- **NBA:** Daily by 5pm ET (official report), plus morning shootaround updates
- **NCAAMB:** No schedule; monitor ESPN injuries page + box scores daily
- **NCAAF:** Weekly; check depth charts Tuesday, monitor through Saturday

---

## Summary: What to Build First

1. **ESPN injury API scraper** — Covers all 4 sports, single data source, JSON format
2. **Player metrics database** — Pre-load BPM (NBA/CBB), EPA (NFL/CFB) for all relevant players
3. **Simple lookup model** — Injured player → metric → minutes share → point swing
4. **Spread comparison** — Your adjusted spread vs market spread → flag games with ≥2pt discrepancy
5. **Track accuracy** — Log your adjustments and actual outcomes to refine values over time

**Estimated build time for Tier 1:** 1-2 days
**Estimated build time for Tier 2:** 1 week
**Estimated edge:** 1-3% improvement in spread prediction accuracy (significant for betting)
