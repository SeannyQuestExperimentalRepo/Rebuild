# Ensemble Analysis: KenPom + Barttorvik for NCAAMB Predictions

**Date:** 2026-02-15  
**Sample:** 1,805 games (2025-26 season through 2/14/2026)  
**Data Note:** KenPom ratings are **point-in-time** (per-game snapshots). Barttorvik ratings are from a **single snapshot** (2/14/2026) applied retroactively. This gives Barttorvik lookahead bias, especially for early-season games. Results should be interpreted accordingly.

---

## TL;DR

**The ensemble barely helps.** Correlation between KenPom and Barttorvik margin predictions is **0.9877** — they're nearly the same model. Ensembling provides ~0.06 points of MAE improvement at best. The juice isn't worth the squeeze unless you already have both data feeds.

---

## 1. Margin Prediction (MAE)

| Model | Weight | MAE |
|-------|--------|-----|
| KenPom only | 100% KP | **8.905** |
| Barttorvik only | 100% BT | **8.867** |
| Ensemble 50/50 | 50/50 | **8.845** |
| Ensemble KP60 | 60 KP / 40 BT | 8.852 |
| **Ensemble BT60** | **40 KP / 60 BT** | **8.842** ✅ |
| Ensemble KP70 | 70 KP / 30 BT | 8.861 |
| Ensemble KP80 | 80 KP / 20 BT | 8.874 |

**Best ensemble: 40% KenPom / 60% Barttorvik** (MAE 8.842)

⚠️ **BUT:** Barttorvik's slight edge (8.867 vs 8.905) is likely due to lookahead bias from using end-of-season ratings. With point-in-time Barttorvik data, KenPom would likely match or beat it.

## 2. Total Prediction (MAE)

| Model | MAE | Avg Predicted | Actual Avg |
|-------|-----|---------------|------------|
| KenPom | **14.608** | 145.9 | 148.7 |
| Barttorvik | **14.585** | 146.0 | 148.7 |
| Ensemble 50/50 | **14.587** | 146.0 | 148.7 |

Total correlation: **0.9953** — essentially identical predictions. No ensemble value for totals.

**Note:** Barttorvik tempo scale differs from KenPom (~51 vs ~67 possessions). KenPom tempo was used for both total calculations to normalize.

## 3. ATS Accuracy by Edge Threshold

| Edge | KP % (n) | BT % (n) | Ensemble 50/50 % (n) | BT60 % (n) |
|------|----------|----------|----------------------|-------------|
| 0 | 59.3 (1805) | 58.4 (1805) | 59.6 (1805) | 59.5 (1805) |
| 1 | 61.3 (1562) | 60.4 (1570) | 60.9 (1584) | 60.5 (1578) |
| 3 | 63.2 (1122) | 63.9 (1169) | 63.9 (1142) | 63.9 (1137) |
| 5 | 67.0 (757) | 67.7 (792) | **68.0** (752) | 67.9 (748) |
| 7 | 70.4 (450) | 69.6 (494) | **71.2** (469) | 70.9 (467) |
| 10 | 73.9 (199) | 74.6 (224) | 73.3 (195) | 73.2 (205) |

**Key finding:** Ensemble shows modest ATS improvement at 5-7 point edges (the sweet spot for actual betting). At edge ≥5, ensemble hits **68.0%** vs KP's 67.0% and BT's 67.7%.

## 4. O/U Accuracy by Edge Threshold

| Edge | KP % (n) | BT % (n) | Ensemble % (n) |
|------|----------|----------|----------------|
| 0 | 54.2 (1805) | 54.6 (1805) | 54.5 (1805) |
| 3 | 55.7 (1369) | 55.7 (1368) | 55.8 (1365) |
| 5 | 56.5 (1060) | 56.4 (1050) | 56.4 (1054) |
| 7 | 57.3 (785) | 56.8 (778) | 57.1 (780) |
| 10 | 58.2 (445) | **59.1** (430) | 59.0 (427) |

No meaningful O/U difference between models. Total prediction correlation is 0.995 — they're the same signal.

## 5. Situational Analysis

| Period | Conf Game? | n | KP MAE | BT MAE | Ensemble MAE | Correlation |
|--------|-----------|---|--------|--------|--------------|-------------|
| Early (pre-12/15) | Non-conf | 592 | **9.02** | 9.27 | 9.11 | 0.989 |
| Early | Conf | 24 | **6.58** | 6.73 | 6.55 | 0.986 |
| Late (post-12/15) | Non-conf | 128 | 9.73 | **9.43** | 9.56 | 0.993 |
| Late | Conf | 1061 | 8.79 | **8.62** | 8.67 | 0.982 |

**Pattern:** 
- **Early season:** KenPom is better (point-in-time data advantage vs BT's static snapshot)
- **Late season conference games:** Barttorvik is slightly better (may reflect BT's snapshot being most accurate for late-season)
- Conference games have lower MAE across the board (smaller talent gaps = more predictable)

## 6. Correlation Analysis

| Metric | Correlation |
|--------|-------------|
| Margin predictions | **0.9877** |
| Total predictions | **0.9953** |

At 0.99 correlation, ensembling provides almost no diversification benefit. For comparison:
- 0.99 = ~1% independent signal → ~0.5% potential improvement
- 0.90 = ~10% independent signal → ~5% potential improvement  
- 0.80 = ~20% independent signal → meaningful ensemble gains

KenPom and Barttorvik are essentially the same model with minor weighting differences.

## 7. Recommendations

### Should you ensemble?

**If you already have both data feeds:** Yes, use a simple 50/50 average. The cost is zero and you get ~0.06 MAE improvement on margins and ~1% ATS improvement at the 5-7 point edge range.

**If you'd need to add Barttorvik:** Probably not worth it. The marginal improvement is within noise. Invest effort in genuinely uncorrelated signals instead (e.g., injury data, travel fatigue, referee tendencies, public betting percentages).

### Optimal Weights

| Situation | Recommended Weight |
|-----------|--------------------|
| General | 50% KP / 50% BT |
| Early season (Nov-Dec) | 70% KP / 30% BT (KP point-in-time is more reliable) |
| Late conference play | 40% KP / 60% BT |
| Totals | KenPom only (no BT value added) |

### When Barttorvik Adds Value

1. **Late-season conference games** — BT's adjusted metrics slightly outperform
2. **At higher edge thresholds (≥3)** — BT ATS accuracy matches or exceeds KP
3. **As a sanity check** — if KP and BT strongly disagree (>3 point difference in margin), investigate why before betting

### When Barttorvik Adds Noise

1. **Early season** — without point-in-time snapshots, BT ratings are stale
2. **Totals** — 0.995 correlation, zero value
3. **Low-edge situations** — at edges <3, KP alone is better ATS

### Caveats

1. **Lookahead bias:** This analysis used BT's current snapshot for all games, inflating BT's accuracy. With point-in-time BT data, KP likely equals or beats it.
2. **Single season:** N=1805 is decent but one-season results may not generalize.
3. **To properly test:** Need daily Barttorvik snapshots stored alongside KenPom snapshots so both can be evaluated point-in-time.

### Action Item

**Start storing daily Barttorvik snapshots** (like KenPom). Until we have point-in-time BT data across multiple seasons, ensemble conclusions are preliminary. The correlation analysis alone confirms: these systems measure the same thing with minor differences.
