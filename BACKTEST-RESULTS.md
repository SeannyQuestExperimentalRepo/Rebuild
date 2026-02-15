# Backtest Results — Pick Engine v9 (PIT Ridge)

**Date:** 2026-02-14
**Method:** Walk-forward Ridge regression on point-in-time KenPom snapshots (no look-ahead)
**Seasons tested:** 2013-2026 (train on all prior seasons, predict on test season)
**Break-even at -110:** 52.4%
**All results use point-in-time KenPom snapshots — no end-of-season look-ahead bias.**

## Model Specification

| Parameter | Value |
|-----------|-------|
| Model | Ridge regression, lambda = 1000 |
| Features | intercept, sumAdjDE, sumAdjOE, avgTempo |
| Production coefficients | -233.5315 + 0.4346 x sumAdjDE + 0.4451 x sumAdjOE + 2.8399 x avgTempo |
| Training data | 70,303 games (2012-2025) with PIT KenPom snapshots |
| Snapshot source | KenpomSnapshot table (722,920 rows, 2,039 dates) |

## Walk-Forward Results (14 seasons)

**Overall PIT: 62.8% (36,510W - 21,581L) at edge >= 1.5**

- **13/14 seasons profitable** (>= 52.4%)
- **Only losing season:** 2026 partial (49.8%, limited test data through Feb)
- **Average EOS-PIT bias gap:** 4.6 percentage points (range: 3.4-6.0pp, 11.1pp for partial 2026)

## UNDER vs OVER Asymmetry

UNDER picks consistently outperform OVER at all edge levels:

| Direction | Overall % |
|-----------|-----------|
| UNDER | 65.6% |
| OVER | 61.2% |

## Edge Calibration (monotonic)

| Min Edge | Win % |
|----------|-------|
| >= 1 | 62.8% |
| >= 5 | ~66.8% |
| >= 9 | ~71.5% |
| >= 10 | ~73.0% |
| >= 12 | ~74.8% |
| >= 15 | 75.8% |

## Confidence Tiers (Config #26, PIT-calibrated)

| Tier | Criteria | OOS Win % | Volume/week | Monotonic Seasons |
|------|----------|-----------|-------------|-------------------|
| 5-star | UNDER + edge >= 12 + avgTempo <= 64 | 82.3% | ~2.4 | 12/13 |
| 4-star | UNDER + edge >= 10 | 74.9% | ~16.7 | 12/13 |
| 3-star | edge >= 9 | 68.0% | ~59.1 | 12/13 |

Config #26 achieves monotonic tier accuracy (5-star > 4-star > 3-star) in 12 of 13 testable seasons.

## EOS vs PIT Bias Gap

The honest backtest proved a **4.6 percentage point average look-ahead bias** in end-of-season ratings:

| Metric | EOS (biased) | PIT (honest) | Difference |
|--------|-------------|--------------|------------|
| Overall accuracy | 67.4% | 62.8% | -4.6pp |
| Range per season | 3.4-6.0pp gap | — | — |
| 2026 partial gap | 11.1pp | — | Worst (limited data) |

**Any backtest using NCAAMBGame stored ratings (homeAdjEM etc.) overstates accuracy by ~4.6 percentage points.**

## Deprecated v5/v6/v7 Results

The v5/v6/v7 results previously in this file used end-of-season KenPom ratings and are **invalidated by the EOS look-ahead bias**. They showed:
- v7 O/U 2025: 69.6% (inflated by ~4.6pp, honest ~65%)
- v7 O/U 2026: 52.2% (inflated by ~11pp, honest ~41%)

The gap between in-sample and out-of-sample was caused by EOS bias, not model overfitting.

## Regression Test

Run `scripts/backtest/regression-test.js` to verify model output has not changed:
- 2025 season PIT accuracy at edge >= 1.5 should be in [55%, 72%]
- Overall PIT accuracy should be in [57%, 70%]

## Bootstrap Confidence Intervals

Run `scripts/backtest/bootstrap-ci.js` for full 95% CIs on all categories (10,000 resamples).

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/backtest/honest-backtest.js` | Full walk-forward PIT backtest (14 seasons) |
| `scripts/backtest/honest-tier-sweep.js` | Tier configuration sweep (found config #26) |
| `scripts/backtest/honest-edge-distribution.js` | Edge distribution diagnostic |
| `scripts/backtest/bootstrap-ci.js` | Bootstrap 95% confidence intervals |
| `scripts/backtest/regression-test.js` | Quick regression test (expected accuracy range) |
| `scripts/backtest/extract-pit-coefficients.js` | Extract production Ridge coefficients |
| `scripts/backtest/backfill-kenpom-snapshots.js` | Backfill historical PIT snapshots |
| `scripts/verify-pit-integrity.ts` | Verify NCAAMBGame KenPom values match snapshots |

## Next Review

After March Madness 2026 (complete season):
- Re-run full backtest with complete 2026 data
- Re-run bootstrap CIs with full 2026 sample
- Evaluate if tier thresholds need adjustment based on complete 2026 performance
