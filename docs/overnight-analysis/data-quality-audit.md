# Data Quality Audit Report
**Date:** 2026-02-15  
**Database:** Neon PostgreSQL (neondb)

---

## 1. Table Inventory & Row Counts

| Table | Rows | Status |
|-------|------|--------|
| KenpomSnapshot | 723,255 | ✅ Core data |
| NCAAMBGame | 125,169 | ✅ Core data |
| PlayerGameLog | 105,391 | ✅ |
| NCAAFGame | 14,711 | ✅ |
| NFLGame | 14,140 | ✅ |
| KenpomPointDist | 8,679 | ✅ |
| KenpomHeight | 7,035 | ✅ |
| KenpomHCA | 6,205 | ✅ |
| KenpomFourFactors | 6,014 | ✅ |
| KenpomTeamStats | 6,014 | ✅ |
| KenpomOfficial | 3,400 | ✅ |
| KenpomJumpBall | 2,865 | ✅ |
| EloRating | 1,850 | ✅ |
| Team | 1,850 | ✅ |
| OddsSnapshot | 679 | ⚠️ NCAAMB only |
| UpcomingGame | 420 | ✅ |
| BarttovikSnapshot | 358 | ⚠️ Single date only |
| DailyPick | 102 | ✅ |
| TeamNameMapping | 22 | ✅ |
| User | 3 | ✅ |
| Bet | 2 | ✅ |
| **Empty tables** | — | 🔴 |
| NBAGame | 0 | Unused |
| NBATeamStats | 0 | Unused |
| NFLTeamEPA | 0 | Unused |
| NCAAFAdvancedStats | 0 | Unused |
| GameWeather | 0 | Unused |
| Venue | 0 | Unused |
| SearchLog | 0 | Unused |
| SavedTrend | 0 | Unused |

**8 empty tables** — either planned features not yet implemented or abandoned schemas.

---

## 2. Team Table Audit

### Counts by Sport
| Sport | Count |
|-------|-------|
| NCAAMB | 1,683 |
| NCAAF | 135 |
| NFL | 32 |
| **Total** | **1,850** |

### NCAAMB: 1,683 Teams — ~1,319 are Non-D-I
- **363 teams** in the Team table have no Barttorvik snapshot and appear to be non-D-I programs (D-II, D-III, NAIA, club teams)
- Examples of junk: "Pensacola Christian College," "East-West University Phantoms," "Caltech," "Gallaudet Bison," "MIT Engineers"
- ~364 are legitimate D-I teams (matches 2025 KenPom count of 364)
- The extra ~1,319 teams exist because historical game data includes non-D-I opponents

### Duplicates: ✅ None
No duplicate team names within the same sport.

### Orphaned Teams: ✅ None
Every team has at least one game associated with it.

### 🔧 Recommendation (Priority: LOW)
- Add a `division` or `isD1` flag to the Team table to distinguish D-I from non-D-I
- Useful for filtering in queries and UI, but not blocking anything

---

## 3. Game Table Completeness

### NCAAMB (125,169 games, 2005–2026)

| Issue | Details |
|-------|---------|
| **Missing spreads (2005–2009)** | 🔴 26,778 games — ALL 5 seasons have zero spread/O-U data |
| **Missing spreads (2010–2025)** | ⚠️ ~850/season (~14%) missing — likely non-D-I matchups with no betting lines |
| **Missing spreads (2026)** | ⚠️ 2,983 of 4,837 (62%) — season in progress, many future games |
| **Missing scores** | ✅ 0 — all completed games have scores |
| **Impossible scores** | ✅ 0 |

### NFL (14,140 games, 1966–2025)

| Issue | Details |
|-------|---------|
| **Missing spreads (1966–1978)** | 🔴 ~2,600 games — pre-modern era, no spread data |
| **Missing O/U (1966–1985)** | 🔴 Variable — spotty totals data before 1986 |
| **1986–present** | ✅ Nearly complete (only 1 missing in 2025 — likely Super Bowl not yet played) |
| **Missing scores** | ✅ 0 |
| **Impossible scores** | ✅ 0 |

### NCAAF (14,711 games, 2005–2024)

| Issue | Details |
|-------|---------|
| **Missing spreads (2005–2012)** | 🔴 5,719 games — ALL 8 seasons have zero spread data |
| **Missing O/U (2005–2016)** | 🔴 Majority missing through 2016 |
| **2017–present** | ✅ Nearly complete (0–4 missing per season) |
| **Missing scores** | ✅ 0 |
| **Impossible scores** | ✅ 0 |

### 🔧 Recommendations (Priority: MEDIUM)
1. **Backfill NCAAMB 2005–2009 spreads** — If historical betting analysis matters, source from covers.com or similar
2. **Backfill NCAAF 2005–2012 spreads** — Same approach
3. **Accept NFL pre-1979 gaps** — Historical spread data for this era is very hard to find
4. **The ~14% missing per NCAAMB season is expected** — these are games involving non-D-I teams that sportsbooks don't line

---

## 4. KenpomSnapshot Audit

### Coverage
- **387 unique team names** across **2,040 snapshot dates**
- **Seasons:** 2012–2026 (15 seasons)
- **Date range:** 2011-11-08 to 2026-02-14

### Teams per Season
| Season | Teams |
|--------|-------|
| 2012 | 345 |
| 2013 | 347 |
| 2014–2018 | 351 |
| 2019–2020 | 353 |
| 2021 | 357 |
| 2022 | 358 |
| 2023 | 363 |
| 2024 | 362 |
| 2025 | 364 |
| 2026 | 365 |

Team count increases over time as D-I expands — this is correct and expected.

### Date Gaps
- **Off-season gaps (March→November):** ✅ Expected — KenPom only publishes during basketball season
- **Christmas gaps (Dec 23→Dec 27):** ✅ Expected — KenPom pauses during holiday break
- **COVID gap (2020-03-10 → 2020-11-25):** ✅ Expected — season cancelled

### Data Corruption (adjEM swings > 15 between consecutive days)
✅ **None found.** Data is clean.

### Name Mismatch with Team Table
🔴 **22 KenPom team names don't match any Team table entry:**
- `St. Bonaventure` vs Team table `Saint Bonaventure`
- `McNeese St.` vs `McNeese`
- `Nicholls St.` vs `Nicholls`
- `Cal St. Northridge` vs `CSUN`
- `UMKC` vs `Kansas City`
- `Queens` vs `Queens (NC)`
- Plus historical names: `IPFW`→`Fort Wayne`, `Houston Baptist`→now renamed, etc.

### 🔧 Recommendations (Priority: HIGH)
1. **Expand TeamNameMapping table** to cover all 22 mismatches — this is critical for joining KenPom data to games
2. Currently only 22 mappings exist, which may already cover these — verify coverage

---

## 5. EloRating Audit

### Counts
| Sport | Count | Expected | Status |
|-------|-------|----------|--------|
| NCAAMB | 1,683 | ~1,683 | ✅ |
| NCAAF | 135 | 135 | ✅ |
| NFL | 32 | 32 | ✅ |
| **Total** | **1,850** | **1,850** | ✅ |

### Outliers
- **117 teams with Elo > 2000** 🔴
  - Highest: Saint Mary's (2357), New Mexico (2307.7), Santa Clara (2276.3)
  - These are suspiciously high — standard Elo systems rarely exceed 1800 for college basketball
  - Likely indicates Elo inflation over time (no regression to mean / no season reset)
- **0 teams with Elo < 800** ✅

### Orphans
✅ Every EloRating references a valid Team.

### 🔧 Recommendations (Priority: HIGH)
1. **Investigate Elo inflation** — 117 teams above 2000 suggests the system lacks mean regression
2. **Add season-start regression** — Pull all ratings toward 1500 by ~33% at season start
3. **Saint Mary's at 2357 is almost certainly wrong** — likely a bug in the update logic

---

## 6. BarttovikSnapshot Audit

### Coverage
- **358 teams** on **1 date** (2026-02-14)
- Only a single-day snapshot — not historical data

### Missing Teams (vs 365 in KenPom 2026)
~7 teams from KenPom's D-I list are missing. These appear to be **name mismatches** rather than truly missing:
- Teams in NCAAMBGame 2026 season but not in Barttorvik: includes non-D-I opponents and name variants like `UC-Davis` vs `UC Davis`, `Saint Bonaventure` vs `St. Bonaventure`

### Null/Zero Values
✅ No null tRank or adjOE values.

### 🔧 Recommendations (Priority: MEDIUM)
1. **Set up daily Barttorvik scraping** — currently only 1 snapshot exists
2. **Standardize team names** between Barttorvik, KenPom, and Team table using TeamNameMapping

---

## 7. OddsSnapshot Audit

### Coverage
- **679 snapshots** — all NCAAMB
- **0 NFL, 0 NCAAF odds data**

### 🔧 Recommendations (Priority: MEDIUM)
1. **Add NFL and NCAAF odds collection** if betting analysis is planned for those sports
2. **679 is low** for NCAAMB — verify the collection pipeline is running consistently

---

## 8. DailyPick Audit

### Summary
| Result | Count |
|--------|-------|
| PENDING | 64 |
| LOSS | 24 |
| WIN | 14 |
| **Total** | **102** |

- **All NCAAMB** — no picks for NFL or NCAAF
- **38 graded** out of 102 (37% graded)
- **Win rate: 36.8%** (14/38) 🔴 — below break-even for standard -110 spreads (needs ~52.4%)

### 🔧 Recommendations (Priority: HIGH)
1. **64 ungraded picks** — grading pipeline may be broken or delayed
2. **36.8% win rate is very poor** — review pick generation algorithm
3. **Expand to NFL/NCAAF** if the model is sport-agnostic

---

## 9. Cross-Table Integrity

### Foreign Key Violations
✅ **Zero orphaned game records** — all homeTeamId/awayTeamId reference valid teams across all 3 game tables.

### KenPom ↔ Team Name Mismatches
🔴 **22 KenPom team names** don't directly match Team table names (see Section 4)

### OddsSnapshot ↔ Games
⚠️ OddsSnapshot uses text team names (`homeTeam`, `awayTeam`), not foreign keys — no referential integrity enforced. Potential for orphaned or unmatchable odds.

---

## Priority Summary

| Priority | Issue | Impact |
|----------|-------|--------|
| 🔴 HIGH | Elo inflation (117 teams > 2000) | Corrupts any model using Elo as input |
| 🔴 HIGH | 22 KenPom↔Team name mismatches | Breaks joins for analytics |
| 🔴 HIGH | DailyPick 36.8% win rate | Product credibility |
| 🔴 HIGH | 64 ungraded DailyPicks | Grading pipeline issue |
| 🟡 MEDIUM | NCAAMB 2005–2009 missing all spreads (26K games) | Limits historical backtest range |
| 🟡 MEDIUM | NCAAF 2005–2012 missing all spreads (5.7K games) | Same |
| 🟡 MEDIUM | Barttorvik has only 1 snapshot date | No historical Barttorvik trends |
| 🟡 MEDIUM | OddsSnapshot NCAAMB-only (679 rows) | No NFL/NCAAF odds tracking |
| 🟢 LOW | 1,319 non-D-I teams in Team table | Clutter, not harmful |
| 🟢 LOW | 8 empty tables | Cleanup or future features |
| 🟢 LOW | NFL pre-1979 missing spreads | Historical limitation |
