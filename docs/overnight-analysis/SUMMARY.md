# Overnight Analysis Summary — Feb 15, 2026

6 agents ran against the prod database (150k+ games, 722k KenPom snapshots, 1,850 Elo ratings, 358 Barttorvik snapshots). Here's what matters:

---

## 🚨 Biggest Discoveries

### 1. DailyPick is 14-24 (36.8%) — WORSE than coin flip
The actual production picks are losing money. The pick engine backtest shows 62.8% but live picks are 36.8%. Something is broken in the pipeline between the model and pick generation. **This is Priority #1 to fix.**

### 2. Elo is NOT profitable ATS — drop the weight
Elo alone: NCAAMB 45.6%, NCAAF 50.8%, NFL 50.9%. Worse than the market. Current 5% weight in pick engine should be 0-2% for ATS. **But** Elo has a hidden gem: high-Elo NCAAMB matchups (avg >1700) go UNDER 78%. Use Elo for O/U direction, not ATS.

### 3. KenPom + Barttorvik = 0.99 correlation — don't bother ensembling
They're essentially the same signal. Ensembling gives 0.7% MAE improvement. Not worth the complexity. **Invest in genuinely uncorrelated signals instead** (injuries, public betting %, referee tendencies).

### 4. UNDER edge is real but NCAAMB-specific
- NCAA Tournament: 80.5% UNDER rate (!) 
- Slow tempo (<62) + high total (≥150): 73.1% UNDER
- Power conference play: 66-74% UNDER
- NFL and NCAAF: ~50/50, no edge

### 5. NCAAMB ATS is an untapped signal
Away team covers at edge ≥5: 57.8% across 23,234 picks. Profitable every season 2010-2025. **This should be added as 3-star ATS picks immediately.**

---

## 📊 Signal Rankings (by actual predictive value)

| Signal | Verdict | Recommended Weight |
|--------|---------|-------------------|
| KenPom EM (O/U) | **KING** — r=0.70, 62.8% walk-forward | 0.35 (keep) |
| KenPom EM (ATS) | **Strong** — 57.6% at 7+ pt edge | 0.30 (keep) |
| Tempo filter (UNDER) | **Elite** — 73%+ with stacked filters | 0.10 (increase) |
| Away-side ATS edge | **New finding** — 56.1% vs 51.1% | Add as signal |
| Elo (O/U direction) | **Useful** — 78% UNDER for high-Elo | 0.05 (reframe) |
| Barttorvik | **Redundant** — 0.99 correlated w/ KenPom | 0.02 (reduce) |
| Elo (ATS) | **Noise** — 45.6% NCAAMB | 0.00 (drop) |
| fmHomePred/fmAwayPred | **Bad** — r=0.12 for totals | Drop entirely |
| Home court advantage | **Miscalibrated** — trending 6.4→8.6, model uses flat 3.5 | Recalibrate |

---

## 🔧 Data Issues to Fix

1. **Elo inflation** — 117 teams above 2000 (Saint Mary's at 2357). Add season-start mean regression.
2. **22 KenPom↔Team name mismatches** — breaks joins (St. Bonaventure vs Saint Bonaventure, etc.)
3. **64 of 102 DailyPicks ungraded** — grading pipeline broken
4. **Barttorvik has only 1 snapshot date** — need daily collection ASAP
5. **NCAAMB 2005-2009 missing spreads** — 32K games with no ATS data
6. **HCA trending up (6.4→8.6)** — flat 3.5 adjustment is wrong

---

## ✅ Action Items (Priority Order)

1. **Debug why live picks (36.8%) diverge from backtest (62.8%)** — this is the make-or-break issue
2. **Add NCAAMB ATS picks** at edge ≥5 (57.8%, immediately profitable)
3. **Recalibrate HCA** from flat 3.5 to dynamic (season/conference-specific)
4. **Add tournament UNDER auto-boost** (80.5% hit rate)
5. **Drop fmHomePred/fmAwayPred** from pick engine
6. **Reduce Elo ATS weight to 0**, keep Elo O/U at 5%
7. **Fix 22 team name mismatches** for proper data joins
8. **Add Elo season-start regression** (regress 1/3 to mean each season)
9. **Start daily Barttorvik snapshots** for PIT analysis
10. **Pursue uncorrelated signals** — injuries, public %, refs (not more rating systems)
