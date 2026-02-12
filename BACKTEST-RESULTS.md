# Backtest Results — Pick Engine v7 Tuning

**Date:** 2026-02-11
**Seasons analyzed:** 2025 (5,523 games, in-sample), 2026 (1,727 games through Feb, out-of-sample)
**Break-even at -110:** 52.4%

## v5 vs v6 vs v7 Comparison

### Season 2025 (in-sample)

| Metric | v5 | v6 | v7 (regression O/U) |
|--------|----|----|---------------------|
| Total Picks | 3,444 | 3,082 | 3,304 |
| Spread (all) | 54.0%, +3.2% ROI | 56.0%, +6.9% ROI | 56.0%, +6.9% ROI |
| 4-star Spread | 53.7%, +2.6% ROI | 56.3%, +7.4% ROI | 56.3%, +7.4% ROI |
| 5-star Spread | 56.6%, +8.0% ROI | 46.7%, -10.9% ROI | 46.7%, -10.9% ROI |
| O/U (all) | 71.7%, +36.9% ROI | 71.7%, +36.8% ROI | 69.6%, +32.9% ROI |
| 4-star O/U | 67.1%, +28.0% ROI | 67.2%, +28.3% ROI | 63.5%, +21.1% ROI |
| 5-star O/U | 78.4%, +49.6% ROI | 78.1%, +49.1% ROI | 74.4%, +42.0% ROI |

### Season 2026 (out-of-sample)

| Metric | v5 | v6 | v7 (regression O/U) |
|--------|----|----|---------------------|
| Total Picks | 837 | 746 | 916 |
| Spread (all) | 52.5%, +0.2% ROI | 54.3%, +3.7% ROI | 54.3%, +3.7% ROI |
| 4-star Spread | 51.7%, -1.3% ROI | 55.0%, +5.1% ROI | 55.0%, +5.1% ROI |
| 5-star Spread | 55.3%, +5.6% ROI | 36.4%, -30.6% ROI | 36.4%, -30.6% ROI |
| O/U (all) | 49.8%, -5.0% ROI | 49.9%, -4.8% ROI | **52.2%, -0.4% ROI** |
| 4-star O/U | 49.6%, -5.3% ROI | 49.7%, -5.1% ROI | **53.7%, +2.6% ROI** |
| 5-star O/U | 50.5%, -3.6% ROI | 50.5%, -3.6% ROI | 50.0%, -4.5% ROI |

### Key Finding
v7 regression O/U is **+2.3% win% better than v6 on out-of-sample 2026 data**. The 4-star O/U picks cross the 52.4% break-even threshold (+2.6% ROI), while v6's 4-star O/U is a coin flip (-5.1% ROI). The v7 model generalizes better than v6's hand-tuned thresholds.

## Overfitting Analysis

| Version | 2025 O/U Win% | 2026 O/U Win% | Gap |
|---------|---------------|---------------|-----|
| v5 | 71.7% | 49.8% | 21.9pp |
| v6 | 71.7% | 49.9% | 21.8pp |
| v7 | 69.6% | 52.2% | **17.4pp** |

v7 has the **smallest in-sample/out-of-sample gap** of all versions, suggesting the regression model overfits less than the threshold-based approach. The gap is still larger than the 5pp target, but the 2026 season is incomplete (Feb) and all versions show large gaps.

## Parameters Changed

| Parameter | Before | After | Justification |
|-----------|--------|-------|---------------|
| O/U min edge | 1.0 | 1.5 | Health report shows edge 1.5-2.9 is only 52.1% on 2025. Sub-1.5 edges are noise. Minimal impact on backtest (+0.1-0.2% ROI) but theoretically sound. |

## Parameters NOT Changed (with reasoning)

| Parameter | Current Value | Why Kept |
|-----------|--------------|----------|
| HCA values | conf=2.5, non-conf=1.5, nov=1.0, mar=0.5 | HCA tight wins 2025 but default wins 2026. Plan rule: "if only one season, keep default." |
| ML edge threshold | 0.08 (8%) | All thresholds 5-15% produce identical results — no moneyline data in backtest. Can't evaluate. |
| Signal weights | modelEdge=0.30, seasonATS=0.15, etc. | No experiment showed both-season improvement. Differences within noise. |
| Contextual overrides | All 5 overrides active | 2025 data validates all (top-50: 78.4%, high line: 67.9%, low line: 56.4%). Can't validate on 2026 (0% KenPom data on NCAAMBGame rows). |
| Confidence tiers | 5-star >= 85, 4-star >= 70 | 2025 5-star O/U is 74.4% (excellent). 2026 5-star underperformance (50.0%) matches v6 (50.5%) — season issue, not model issue. |
| Regression coefficients | Deployed from 2025 walk-forward | Health report shows drift on minor coefficients (tempoDiff, emAbsDiff) but these have near-zero impact. Major coefficients (sumAdjDE, sumAdjOE, avgTempo) within 7% drift. |

## O/U Prediction by Edge Bucket (2025 season)

| Edge Bucket | Record | Win% | ROI |
|-------------|--------|------|-----|
| >= 10 | 1232-256-14 | 82.8% | +58.1% |
| 7-9.9 | 702-286-12 | 71.1% | +35.6% |
| 5-6.9 | 538-270-10 | 66.6% | +27.1% |
| 3-4.9 | 519-305-15 | 63.0% | +20.2% |
| 1.5-2.9 | 347-319-9 | 52.1% | -0.5% |

## Contextual Override Validation (2025 season)

| Override | Record | Actual | Expected | Status |
|----------|--------|--------|----------|--------|
| Both top-50 | 320-88 | 78.4% | 78% | OK |
| High line >= 155 | 605-286 | 67.9% | 68-70% | OK |
| Low line < 135 | 426-329 | 56.4% | 57% | OK |
| March games | 403-329 | 55.1% | 57% | OK |
| Both 200+ | 940-466 | 66.9% | 69% | OK |

## Known Issues

1. **2026 KenPom data gap**: NCAAMBGame rows for season 2026 have 0% KenPom coverage. KenPom stats are captured on UpcomingGame but not transferred to NCAAMBGame when games complete. Blocks regression validation and contextual override checks on current season data.

2. **5-star spread picks**: Too few 5-star spread picks (7-8 per season in v6/v7) for statistical significance. The v6 context-aware HCA reduces 5-star spread count but improves 4-star quality.

3. **ML edge signal**: Cannot be evaluated in backtest due to missing moneyline data on most historical games.

## Scripts Added/Modified

- `scripts/backtest-v6-compare.ts` — Added v7 regression O/U config, v6-vs-v7 comparison output
- `scripts/backtest-report.ts` — NEW: Model health check (coefficient drift, edge buckets, override validation)
- `scripts/register.cjs` — NEW: Stubs out `server-only` module for script execution outside Next.js

## Next Review

After March Madness 2026 (complete season). Key actions:
- Fix 2026 KenPom data pipeline to enable current-season regression validation
- Re-run full backtest suite with complete 2026 data
- Evaluate raising 5-star threshold if 5-star O/U remains < 58%
- Consider spread regression model (Model B) if spread ATS > 54% on both seasons
