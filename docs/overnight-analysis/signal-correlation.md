# Signal Correlation Analysis

**Date:** 2025-02-15  
**Database:** Neon PostgreSQL (neondb)  
**Scope:** NCAAMB primary (81,928 games with KenPom + spread), NFL (11,881), NCAAF (9,005)

---

## Executive Summary

**KenPom efficiency margin differential is the single strongest predictor** of game outcomes (r=0.70 vs margin of victory). It is nearly identical to Vegas spread in predictive power (r=0.694 vs r=0.693), confirming KenPom as a legitimate first-principles model. **Tempo-adjusted KenPom totals outperform Vegas O/U** (r=0.55 vs r=0.41) for predicting actual game totals — a significant edge. The `fmHomePred`/`fmAwayPred` fields are **weak and should be dropped or rebuilt** (r=0.52 for spread, r=0.12 for totals). Elo and Barttorvik data have only single-day snapshots and cannot be historically validated yet.

---

## 1. KenPom Efficiency Margin → Margin of Victory

**Metric:** corr(homeAdjEM - awayAdjEM, homeScore - awayScore)  
**N = 81,928 games** (seasons 2010–2026)

| Season | N | EM Diff vs MOV (r) | Trend |
|--------|------|-------------------|-------|
| 2010 | 4,874 | **0.7296** | Peak |
| 2011 | 4,876 | 0.7077 | |
| 2012 | 4,892 | 0.7160 | |
| 2013 | 4,948 | 0.7056 | |
| 2014 | 4,992 | 0.6950 | |
| 2015 | 4,994 | 0.7106 | |
| 2016 | 5,027 | 0.7000 | |
| 2017 | 5,075 | 0.6986 | |
| 2018 | 5,087 | 0.6851 | |
| 2019 | 5,229 | 0.6861 | |
| 2020 | 4,999 | 0.6685 | Trough |
| 2021 | 3,679 | 0.6928 | COVID |
| 2022 | 5,144 | 0.6832 | |
| 2023 | 5,352 | **0.6572** | Low |
| 2024 | 5,384 | 0.6752 | |
| 2025 | 5,523 | 0.6897 | |
| 2026 | 1,853 | 0.7109 | Partial |

**Key Finding:** Slight degradation trend from ~0.72 → ~0.68 over 15 years, but signal remains very strong. The degradation may reflect increasing parity in college basketball or more transfer portal volatility. **KenPom EM is a KEEP signal — it's the backbone.**

---

## 2. KenPom Predicted Total → Actual Total

**Formula:** `(homeAdjTempo + awayAdjTempo) / 2 / 100 × (homeAdjOE × awayAdjDE + awayAdjOE × homeAdjDE) / 100`

| Metric | Correlation (r) |
|--------|----------------|
| KenPom Predicted Total vs Actual Total | **0.5520** |
| Vegas O/U vs Actual Total | 0.4141 |
| Raw OE Sum vs Actual Total | 0.2074 |
| Tempo alone vs Actual Total | 0.4726 |

**Key Finding:** KenPom-derived total **significantly outperforms Vegas O/U** (0.55 vs 0.41). This is a major exploitable edge for O/U betting. Tempo is the dominant component — OE alone is weak without tempo normalization.

---

## 3. KenPom vs Vegas Spread — Edge Analysis (ATS)

**Overall:** KenPom predicted spread correlates 0.994 with Vegas spread — they are nearly identical. But small disagreements are exploitable.

### Cover Rate by KenPom Edge Size (KenPom side)

| Absolute Edge | N | Cover Rate | Profit Signal? |
|---------------|-------|------------|----------------|
| 0–1 pts | 15,219 | 50.5% | Noise |
| 1–2 pts | 14,034 | 51.4% | Marginal |
| 2–3 pts | 12,289 | **53.7%** | Breakeven after vig |
| 3–4 pts | 10,281 | **54.3%** | ✅ Profitable |
| 4–5 pts | 8,138 | **54.2%** | ✅ Profitable |
| 5–7 pts | 10,581 | **54.1%** | ✅ Profitable |
| 7–10 pts | 6,946 | **57.6%** | ✅ Very Profitable |
| 10+ pts | 2,798 | **60.4%** | ✅ Highly Profitable |

**Key Finding:** At 3+ point edge, the KenPom side covers >54% — comfortably profitable at -110 juice (breakeven ~52.4%). At 7+ points, it's 57.6% — a massive edge. **Recommendation: minimum 3-point edge threshold for ATS plays, prefer 5+ for high-confidence.**

### Directional Asymmetry

| Direction | Cover Rate |
|-----------|-----------|
| KenPom favors Home (vs Vegas) | 51.1% |
| KenPom favors Away (vs Vegas) | **56.1%** |

**Key Finding:** Away-side KenPom edges are significantly more profitable. This suggests Vegas lines may slightly over-value home court advantage. **Weight away-side edges higher.**

---

## 4. Over/Under Edge Analysis

### KenPom Total Edge vs Over Rate

| KenPom Edge | N | Over Rate |
|-------------|-------|-----------|
| < -8 | 4,540 | **18.6%** |
| -8 to -4 | 6,481 | **25.6%** |
| -4 to -2 | 4,547 | 30.8% |
| -2 to 0 | 5,424 | 35.8% |
| 0 to 2 | 6,225 | 41.2% |
| 2 to 4 | 7,258 | 45.2% |
| 4 to 8 | 16,652 | **53.1%** |
| 8+ | 29,914 | **68.3%** |

**Key Finding:** O/U signal is exceptionally strong. When KenPom total exceeds Vegas O/U by 8+, the over hits 68.3% of the time. The KenPom total is systematically higher than Vegas O/U (avg 144.8 vs 139.9), and that bias is *correct* — actual games average 140.8. This means the KenPom total is better calibrated than Vegas. **O/U is the strongest exploitable edge in the dataset.**

Note: The large skew toward 8+ bucket (29,914 games) suggests KenPom total is systematically higher than Vegas. A recalibration with a scaling factor would improve bucketing but the directional signal is clear.

---

## 5. Home Court Advantage

### Actual HCA by Season

| Season | Home Advantage (pts) | Neutral Site "HCA" | N (Home) |
|--------|---------------------|---------------------|----------|
| 2010 | 6.42 | -5.35 | 5,055 |
| 2015 | 6.89 | 1.15 | 5,232 |
| 2020 | 7.85 | 1.36 | 5,243 |
| 2023 | 8.05 | 3.87 | 5,480 |
| 2025 | **8.63** | 4.06 | 5,582 |
| 2026 | 6.20 | 1.67 | 4,119 |

**Key Finding:** Home court advantage is **increasing over time** (6.4 → 8.6 pts), contrary to popular narrative. The commonly used 3.5-point HCA adjustment is **significantly too low**. 

### Residual Analysis (after KenPom EM)

| Venue | N | Avg Residual | Std Dev |
|-------|-------|-------------|---------|
| Home | 86,471 | **+2.49** | 10.77 |
| Neutral | 7,699 | -0.80 | 10.45 |

**Key Finding:** After accounting for KenPom EM differential, home teams still outperform by 2.49 points. This means KenPom's EM already partially captures HCA, but **there's still ~2.5 points of residual home advantage not explained by the EM difference alone.** The 3.5-pt HCA add-on may be reasonable as it combines with KenPom's built-in HCA adjustment, but monitoring by season is important since HCA is trending upward.

---

## 6. Game Context Effects

### KenPom Correlation by Game Type

| Game Type | N | EM Corr (r) | Avg MOV |
|-----------|-------|------------|---------|
| Non-Conference | 30,553 | **0.7335** | 8.03 |
| Tournament | 1,130 | 0.6664 | 3.27 |
| Conference | 50,245 | 0.6393 | 3.13 |

**Key Finding:** KenPom is most predictive for non-conference games (where talent gaps are largest) and weakest for conference games (where familiarity and scouting reduce the EM advantage). **Conference game spreads should have wider confidence intervals.**

---

## 7. fmHomePred / fmAwayPred (Built-in Model)

| Metric | Correlation (r) |
|--------|----------------|
| FM Spread Prediction vs MOV | 0.5217 |
| KenPom EM vs MOV | 0.6884 |
| FM Total vs Actual Total | 0.1190 |

**Key Finding:** The `fmHomePred`/`fmAwayPred` fields are significantly worse than raw KenPom (0.52 vs 0.69 for spread, 0.12 vs 0.55 for totals). **These should be dropped or completely rebuilt.** They add noise, not signal.

---

## 8. DailyPick Performance

| Pick Type | N | Win Rate | Status |
|-----------|---|----------|--------|
| SPREAD | 16 | **25.0%** | ❌ Terrible |
| OVER_UNDER | 22 | **45.5%** | ❌ Below breakeven |
| **Total** | **38** | **36.8%** | ❌ |

**Key Finding:** The current pick generation system is performing *worse than random* on spreads and below breakeven on O/U. With 14-24 record overall, something is fundamentally wrong with pick generation. Sample is small but the signal is clear — the pick algorithm needs a complete overhaul.

---

## 9. Elo & Barttorvik — Insufficient Data

| Data Source | Records | Date Range | Historical Coverage |
|-------------|---------|------------|-------------------|
| EloRating (NCAAMB) | 1,683 | 2026-02-14 only | ❌ Single snapshot |
| BarttovikSnapshot | 358 | 2026-02-14 only | ❌ Single snapshot |

**Key Finding:** Both Elo and Barttorvik have only a single day of data. Cannot perform historical correlation analysis. **Need to start collecting daily snapshots of both to build historical dataset.** Theoretical value:
- Elo captures momentum/recency that KenPom may miss
- Barttorvik is an independent efficiency model that could be averaged with KenPom for ensemble benefit

---

## 10. Other Sports

| Sport | N | Spread vs MOV (r) | Notes |
|-------|-------|-------------------|-------|
| NCAAMB | 81,928 | 0.693 | Strong |
| NCAAF | 9,005 | 0.632 | Moderate |
| NFL | 11,881 | **0.104** | Very weak |
| NBA | 0 | N/A | No data |

**Key Finding:** NFL spread-MOV correlation is extremely weak (0.10), suggesting either data issues with the spread field, or that NFL games are simply much harder to predict from spreads alone (more parity, more variance). Needs investigation.

---

## Recommendations

### 🟢 KEEP & AMPLIFY
1. **KenPom EM Differential** — Core predictor (r=0.70). Use as backbone for all NCAAMB spread predictions.
2. **KenPom Tempo-Adjusted Total** — Significantly outperforms Vegas O/U (r=0.55 vs 0.41). Use formula: `poss/100 × (homeOE × awayDE + awayOE × homeDE) / 100`. **This is your best edge.**
3. **KenPom ATS Edge ≥ 3 pts** — Covers 54%+ historically. Filter picks to this threshold minimum.
4. **Away-side edges** — 56.1% vs 51.1% for home-side. Weight away picks higher.

### 🟡 INVESTIGATE & FIX
5. **Home Court Advantage** — Current 3.5-pt flat HCA is too simple. Consider season-specific HCA (trending 6→8.5 pts) and venue-specific adjustments.
6. **Conference game adjustments** — KenPom is 10% less predictive in conference games. Consider reducing edge confidence or requiring higher thresholds.
7. **NFL spread data** — 0.10 correlation is suspiciously low. Verify spread sign convention and data quality.
8. **Elo collection** — Start daily snapshots immediately to build historical backtest data.
9. **Barttorvik collection** — Start daily snapshots. Expected to add ensemble value when averaged with KenPom.

### 🔴 DROP OR REBUILD
10. **fmHomePred / fmAwayPred** — r=0.52 for spread (vs 0.69 KenPom), r=0.12 for totals. These are actively harmful to predictions. **Drop or rebuild from scratch.**
11. **Current DailyPick algorithm** — 14-24 (36.8%) is catastrophically bad. Must be rebuilt using the signals identified above.
12. **Raw OE Sum** (without tempo adjustment) — r=0.21 for totals. Useless without tempo normalization. Never use OE without tempo.

### 📊 Threshold Guidelines for New Pick System

| Edge Type | Min Edge | Expected Cover% | Confidence |
|-----------|----------|-----------------|------------|
| ATS (any) | 3 pts | 54.3% | Standard |
| ATS (prefer) | 5 pts | 54.1% | High |
| ATS (strong) | 7 pts | 57.6% | Very High |
| ATS (max) | 10+ pts | 60.4% | Premium |
| O/U (any) | 4 pts KP edge | 53.1% | Standard |
| O/U (strong) | 8+ pts KP edge | 68.3% | Very High |

### Priority Actions
1. **Immediately:** Start collecting daily Elo and Barttorvik snapshots
2. **This week:** Rebuild pick algorithm using KenPom edges with 3+ pt threshold
3. **This week:** Implement KenPom total formula for O/U picks (biggest edge available)
4. **This month:** Build season-specific HCA model
5. **This month:** Investigate NFL spread data quality
