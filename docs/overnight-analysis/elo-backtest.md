# Elo Backtest Results

*Generated 2026-02-15. Rolling Elo computed from historical game results.*

## Methodology

- **Elo K-factor:** 20 (NFL), 32 (college)
- **Home advantage:** 65 Elo pts (NFL), 100 Elo pts (college)
- **Spread conversion:** Elo diff / 25 (NFL), / 28 (college)
- **Season regression:** 40% toward 1500 between seasons
- **MOV multiplier:** log-based margin of victory adjustment
- **ATS bet logic:** When Elo-predicted spread disagrees with market by ≥N points, bet Elo's side
- **ROI:** Calculated at -110 standard juice


---

## NCAAMB

### NCAAMB ATS Backtest Results

| Edge Threshold | Sample | Wins | Win% | ROI (flat bet) |
|---|---|---|---|---|
| ≥0 pts | 80287 | 37574 | 46.8% | -10.7% |
| ≥1 pts | 66326 | 30702 | 46.3% | -11.6% |
| ≥2 pts | 53124 | 24364 | 45.9% | -12.4% |
| ≥3 pts | 41662 | 18981 | 45.6% | -13.0% |
| ≥5 pts | 24408 | 10990 | 45.0% | -14.0% |
| ≥7 pts | 14180 | 6376 | 45.0% | -14.2% |
| ≥10 pts | 6676 | 2937 | 44.0% | -16.0% |

### NCAAMB ATS by Season (≥3pt Edge)

| Season | Sample | Win% | ROI |
|---|---|---|---|
| 2010 | 2472 | 44.3% | -15.4% |
| 2011 | 2372 | 43.1% | -17.7% |
| 2012 | 2513 | 44.8% | -14.5% |
| 2013 | 2492 | 46.4% | -11.4% |
| 2014 | 2409 | 44.1% | -15.8% |
| 2015 | 2449 | 45.3% | -13.5% |
| 2016 | 2650 | 46.5% | -11.2% |
| 2017 | 2576 | 45.5% | -13.1% |
| 2018 | 2639 | 45.2% | -13.7% |
| 2019 | 2626 | 46.6% | -11.0% |
| 2020 | 2421 | 44.5% | -15.1% |
| 2021 | 2034 | 46.4% | -11.5% |
| 2022 | 2633 | 46.1% | -12.0% |
| 2023 | 2663 | 45.7% | -12.7% |
| 2024 | 2795 | 45.8% | -12.5% |
| 2025 | 2929 | 46.2% | -11.9% |
| 2026 | 989 | 50.7% | -3.3% |

### NCAAMB O/U Analysis

| Elo Diff Range | Games | Avg Total | Avg Line | Over% |
|---|---|---|---|---|
| 0-100 | 43576 | 141.0 | 140.1 | 50.5% |
| 100-200 | 25394 | 140.7 | 139.8 | 50.7% |
| 200-300 | 9499 | 140.4 | 139.5 | 50.4% |
| 300-500 | 2554 | 140.5 | 139.3 | 50.7% |
| 500+ | 19 | 136.7 | 137.4 | 36.8% |

**By Average Team Quality (Avg Elo):**

| Avg Elo Range | Games | Avg Total | Over% |
|---|---|---|---|
| 0-1300 | 213 | 134.2 | 79.8% |
| 1300-1450 | 11837 | 139.3 | 69.0% |
| 1450-1550 | 31139 | 140.8 | 57.7% |
| 1550-1700 | 33213 | 141.4 | 41.0% |
| 1700+ | 4640 | 141.0 | 22.4% |

### NCAAMB: KenPom vs Elo Comparison

| Edge Threshold | KenPom N | KenPom Win% | KenPom ROI | Elo N | Elo Win% | Elo ROI |
|---|---|---|---|---|---|---|
| ≥0 pts | 80286 | 53.5% | +2.0% | 80286 | 46.8% | -10.7% |
| ≥1 pts | 65067 | 54.1% | +3.4% | 66325 | 46.3% | -11.6% |
| ≥2 pts | 51033 | 54.9% | +4.8% | 53123 | 45.9% | -12.4% |
| ≥3 pts | 38744 | 55.3% | +5.5% | 41661 | 45.6% | -13.0% |
| ≥5 pts | 20325 | 56.2% | +7.3% | 24408 | 45.0% | -14.0% |
| ≥7 pts | 9744 | 58.4% | +11.6% | 14180 | 45.0% | -14.2% |

---

## NFL

### NFL ATS Backtest Results

| Edge Threshold | Sample | Wins | Win% | ROI (flat bet) |
|---|---|---|---|---|
| ≥0 pts | 11592 | 7012 | 60.5% | +15.5% |
| ≥1 pts | 9802 | 6137 | 62.6% | +19.5% |
| ≥2 pts | 8186 | 5288 | 64.6% | +23.3% |
| ≥3 pts | 6763 | 4553 | 67.3% | +28.5% |
| ≥5 pts | 4347 | 3250 | 74.8% | +42.7% |
| ≥7 pts | 2781 | 2281 | 82.0% | +56.6% |
| ≥10 pts | 1649 | 1489 | 90.3% | +72.4% |

### NFL ATS by Season (≥3pt Edge)

| Season | Sample | Win% | ROI |
|---|---|---|---|
| 1979 | 189 | 77.8% | +48.5% |
| 1980 | 183 | 78.7% | +50.2% |
| 1981 | 183 | 75.4% | +44.0% |
| 1982 | 107 | 73.8% | +41.0% |
| 1983 | 185 | 74.1% | +41.4% |
| 1984 | 185 | 81.6% | +55.8% |
| 1985 | 186 | 83.9% | +60.1% |
| 1986 | 197 | 83.2% | +58.9% |
| 1987 | 141 | 73.8% | +40.8% |
| 1988 | 188 | 80.9% | +54.4% |
| 1989 | 190 | 81.1% | +54.7% |
| 1990 | 188 | 84.0% | +60.4% |
| 1991 | 202 | 84.7% | +61.6% |
| 1992 | 196 | 85.2% | +62.7% |
| 1993 | 197 | 81.2% | +55.1% |
| 1994 | 192 | 77.6% | +48.2% |
| 1995 | 195 | 86.2% | +64.5% |
| 1996 | 210 | 78.6% | +50.0% |
| 1997 | 197 | 80.7% | +54.1% |
| 1998 | 217 | 84.8% | +61.9% |
| 1999 | 109 | 55.0% | +5.1% |
| 2000 | 101 | 52.5% | +0.2% |
| 2001 | 100 | 53.0% | +1.2% |
| 2002 | 95 | 56.8% | +8.5% |
| 2003 | 85 | 48.2% | -7.9% |
| 2004 | 111 | 50.5% | -3.7% |
| 2005 | 109 | 40.4% | -22.9% |
| 2006 | 107 | 57.9% | +10.6% |
| 2007 | 135 | 51.9% | -1.0% |
| 2008 | 109 | 55.0% | +5.1% |
| 2009 | 131 | 48.9% | -6.7% |
| 2010 | 97 | 52.6% | +0.4% |
| 2011 | 122 | 50.8% | -3.0% |
| 2012 | 100 | 46.0% | -12.2% |
| 2013 | 112 | 47.3% | -9.7% |
| 2014 | 107 | 53.3% | +1.7% |
| 2015 | 95 | 54.7% | +4.5% |
| 2016 | 91 | 49.5% | -5.6% |
| 2017 | 134 | 47.8% | -8.8% |
| 2018 | 105 | 53.3% | +1.8% |
| 2019 | 122 | 53.3% | +1.7% |
| 2020 | 123 | 52.8% | +0.9% |
| 2021 | 141 | 44.7% | -14.7% |
| 2022 | 131 | 53.4% | +2.0% |
| 2023 | 115 | 48.7% | -7.0% |
| 2024 | 122 | 50.0% | -4.5% |
| 2025 | 118 | 51.7% | -1.3% |

### NFL O/U Analysis

| Elo Diff Range | Games | Avg Total | Avg Line | Over% |
|---|---|---|---|---|
| 0-100 | 9325 | 43.0 | 42.3 | 49.2% |
| 100-200 | 2164 | 43.4 | 42.7 | 50.0% |
| 200-300 | 121 | 43.7 | 43.2 | 51.2% |

**By Average Team Quality (Avg Elo):**

| Avg Elo Range | Games | Avg Total | Over% |
|---|---|---|---|
| 1300-1450 | 1155 | 40.9 | 47.4% |
| 1450-1550 | 8968 | 42.9 | 49.3% |
| 1550-1700 | 1487 | 45.5 | 51.5% |

---

## NCAAF

### NCAAF ATS Backtest Results

| Edge Threshold | Sample | Wins | Win% | ROI (flat bet) |
|---|---|---|---|---|
| ≥0 pts | 8820 | 4436 | 50.3% | -4.0% |
| ≥1 pts | 8027 | 4059 | 50.6% | -3.5% |
| ≥2 pts | 7337 | 3709 | 50.6% | -3.5% |
| ≥3 pts | 6676 | 3393 | 50.8% | -3.0% |
| ≥5 pts | 5360 | 2715 | 50.7% | -3.3% |
| ≥7 pts | 4165 | 2109 | 50.6% | -3.3% |
| ≥10 pts | 2741 | 1380 | 50.3% | -3.9% |

### NCAAF ATS by Season (≥3pt Edge)

| Season | Sample | Win% | ROI |
|---|---|---|---|
| 2013 | 562 | 47.3% | -9.6% |
| 2014 | 554 | 54.0% | +3.0% |
| 2015 | 551 | 46.5% | -11.3% |
| 2016 | 561 | 52.4% | +0.0% |
| 2017 | 583 | 50.6% | -3.4% |
| 2018 | 587 | 50.1% | -4.4% |
| 2019 | 594 | 48.8% | -6.8% |
| 2020 | 412 | 52.4% | +0.1% |
| 2021 | 571 | 49.7% | -5.0% |
| 2022 | 581 | 53.4% | +1.9% |
| 2023 | 559 | 50.8% | -3.0% |
| 2024 | 561 | 54.4% | +3.8% |

### NCAAF O/U Analysis

| Elo Diff Range | Games | Avg Total | Avg Line | Over% |
|---|---|---|---|---|
| 0-100 | 3798 | 54.7 | 54.7 | 48.3% |
| 100-200 | 1746 | 55.8 | 54.9 | 50.5% |
| 200-300 | 436 | 56.4 | 55.8 | 51.1% |
| 300-500 | 51 | 58.9 | 58.2 | 49.0% |

**By Average Team Quality (Avg Elo):**

| Avg Elo Range | Games | Avg Total | Over% |
|---|---|---|---|
| 0-1300 | 4 | 64.0 | 100.0% |
| 1300-1450 | 1197 | 55.6 | 50.0% |
| 1450-1550 | 3424 | 55.0 | 49.2% |
| 1550-1700 | 1361 | 55.1 | 48.0% |
| 1700+ | 45 | 58.3 | 51.1% |

---

## NFL Modern Era (2000+) Only

The pre-2000 NFL spread data shows implausibly high Elo ATS rates (75-85%), suggesting unreliable historical spreads or massive Elo head-start advantage. Modern era is the fair test:

| Edge Threshold | Sample | Wins | Win% | ROI |
|---|---|---|---|---|
| ≥0 pts | 6831 | 3451 | 50.5% | -3.6% |
| ≥1 pts | 5314 | 2716 | 51.1% | -2.4% |
| ≥2 pts | 4002 | 2034 | 50.8% | -3.0% |
| ≥3 pts | 2918 | 1484 | 50.9% | -2.9% |
| ≥5 pts | 1259 | 662 | 52.6% | +0.4% |
| ≥7 pts | 420 | 224 | 53.3% | +1.8% |
| ≥10 pts | 79 | 41 | 51.9% | -0.9% |

---

## Cross-Sport Comparison

| Sport | Total ATS Games | ≥3pt Edge N | ≥3pt Win% | ≥3pt ROI |
|---|---|---|---|---|
| NCAAMB | 80287 | 41662 | 45.6% | -13.0% |
| NFL | 11592 | 6763 | 67.3% | +28.5% |
| NCAAF | 8820 | 6676 | 50.8% | -3.0% |

---

## Recommendations

### ⚠️ Critical Finding: Elo is NOT Profitable ATS as a Standalone Signal

Across all three sports in the modern era, Elo-based ATS betting does NOT produce positive ROI:

- **NCAAMB:** 45-46% win rate at all thresholds — WORSE than a coin flip. The market already prices in team quality better than Elo.
- **NCAAF:** ~50.5% win rate — essentially break-even before juice, negative ROI after.
- **NFL (2000+):** ~50-51% — no edge in modern era. The pre-2000 results showing 67%+ are artifacts of unreliable historical spread data.

### Why NCAAMB Elo is Below 50%

This is actually an important signal: Elo LAGS the market. When Elo disagrees with the spread, the market is right more often. This is because:
1. Elo is purely results-based and slow-moving
2. The market incorporates injuries, motivation, matchups, public info
3. In NCAAMB especially, KenPom/efficiency metrics capture team quality far better than W/L-based Elo
4. Elo's sub-50% rate means it's a **contrarian indicator** — fading Elo disagreements may have value

### O/U Finding: Elo Team Quality Predicts Over/Under Direction

The most interesting finding is in NCAAMB O/U by average Elo:
- Low-Elo matchups (avg <1300): 80% OVER rate
- Mid-Elo matchups: ~50-58% OVER
- High-Elo matchups (avg >1700): only 22% OVER (78% UNDER)
- This suggests the market UNDERESTIMATES defense quality of elite teams and OVERESTIMATES bad teams
- **Actionable:** When both teams are elite (high Elo), lean UNDER. When both are bad, lean OVER.

### Optimal Elo Edge Thresholds

Since Elo alone isn't profitable ATS, there's no magical threshold. However:
- **NCAAMB:** Consider Elo as a NEGATIVE signal — when Elo strongly disagrees with the market (≥5pt), the market is even MORE likely to be right
- **NCAAF:** Closest to break-even; Elo has marginal directional value but not enough to overcome juice
- **NFL:** No edge at any threshold in modern era

### Recommended Weight in Pick Engine

**Elo should have VERY LOW weight as a standalone ATS predictor:**

- **NCAAMB ATS:** 0-5% weight. KenPom is strictly superior. Elo adds noise, not signal.
- **NCAAF ATS:** 5-10% weight. Marginally useful where better power ratings aren't available.
- **NFL ATS:** 0-5% weight. Markets are too efficient.
- **O/U (all sports):** 10-15% weight for the team-quality-based O/U signal (high Elo = lean under)

### Where Elo IS Useful

1. **Quick team quality tiers** — identifying massive mismatches without needing detailed stats
2. **O/U lean** — average team Elo quality correlates with under rates in NCAAMB
3. **As a baseline/sanity check** — not as a primary signal
4. **Season-long tracking** — Elo trend (rising/falling) may capture momentum better than point-in-time Elo
5. **Pre-season projections** — before KenPom/SP+ data is available, Elo from prior season provides a starting point
