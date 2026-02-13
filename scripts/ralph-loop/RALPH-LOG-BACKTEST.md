# Ralph Loop — NCAAMB Backtest Log

**Started:** 2026-02-12
**Branch:** experimental/ncaamb-backtest-20260212
**Goal:** Find models with ≥55% accuracy and <5pp overfitting gap

---

## Phase 0: Data Preparation & Validation

### Phase 0 / Iteration 1
**Experiment**: Data coverage and quality audit
**Hypothesis**: 2026 KenPom data gap needs fixing; data quality may have issues
**Result**:
- **2025 bettable games: 5,523** — 100% KenPom, 96.4% FanMatch, 0% moneyline
- **2026 bettable games: 1,781** — 98.6% KenPom (1,756/1,781), 2.7% FanMatch (48), 3.0% moneyline (54)
- **Data quality: PERFECT** — 0 duplicates, 0 missing results, 0 O/U inconsistencies
- 2026 bettable date range: Nov 4, 2025 to Feb 12, 2026 (Nov-Feb only, no March yet)

**Baselines established:**

| Baseline | 2025 | 2026 |
|----------|------|------|
| Random | 50.0% | 50.0% |
| Always UNDER | 49.5% (2701/5460 excl push) | 51.9% (924/1781) |
| Always HOME COVERS | 47.7% (2578/5409 excl push) | 48.1% (857/1781) |
| Vegas within ±3 of O/U | 15.6% | 13.8% |
| v7 O/U | 69.6% | 52.2% |
| v7 Spread | 56.0% | 54.3% |

**Key findings**:
1. KenPom gap is already fixed — 98.6% coverage on 2026 bettable games (25 missing are name-match failures for minor schools)
2. **FanMatch is essentially unavailable for 2026** (2.7% coverage). Any model using fmTotal trains on real data (2025) but gets zeros at test time (2026). This is likely a contributor to overfitting.
3. 2026 has a slight UNDER lean (51.9%) vs 2025 near-50/50 (49.5%). "Always UNDER" beats random on 2026.
4. No moneyline data for 2025 — cannot evaluate ML edge signal at all.
5. 2026 only covers Nov-Feb (1,781 games). Full 2025 has 5,523 with March Madness.

**Next step**: Phase 1 — diagnose why v7 O/U model fails out-of-sample

---

## Phase 1: Diagnose Current Model Failures

### Phase 1 / Iteration 1
**Experiment**: Comprehensive v7 O/U model diagnostics (7 tests)
**Hypothesis**: Overfitting comes from unstable coefficients, noise features, or contextual overrides
**Result**:

**ROOT CAUSE IDENTIFIED: Contextual overrides are the primary source of overfitting.**

The pure regression model (no overrides) achieves:
- 2025: 70.0% (3331/4760 with edge >= 1.5)
- 2026: **65.1%** (881/1354 with edge >= 1.5)
- **Gap: 4.9pp** (UNDER the 5pp target!)

v7 with overrides reports 52.2% on 2026 — a 13pp degradation from the pure model. The overrides are memorized 2025 patterns:

| Override | 2025 | 2026 | Gap |
|----------|------|------|-----|
| Both top-50 → UNDER | 78.4% | 50.6% | -27.8pp |
| High line ≥155 → UNDER | 67.9% | 51.9% | -16.0pp |
| Both 200+ → OVER | 66.9% | 49.1% | -17.8pp |
| Low line <135 → OVER | 56.4% | 47.0% | -9.4pp |

**Coefficient stability test** (1st half vs 2nd half of 2025):
- STABLE: avgTempo (0.7% shift), sumAdjOE (24.1%), sumAdjDE (25.6%)
- UNSTABLE: tempoDiff (390%), emAbsDiff (191%), fmTotal (556%), isConf (44%)

**Feature ablation** (remove each, measure OOS impact):
- Core (removing hurts OOS): avgTempo (-6.6pp), sumAdjDE (-11.9pp), sumAdjOE (-11.6pp)
- Noise (removing has no impact): tempoDiff (+0.1pp), emAbsDiff (0.0pp), isConf (-0.5pp), fmTotal (-0.8pp)

**Edge calibration** — monotonic and holds OOS:
| Edge | 2025 Acc | 2026 Acc |
|------|----------|----------|
| 1.5-2.9 | 53.2% | 57.2% |
| 3.0-4.9 | 62.8% | 64.3% |
| 5.0-6.9 | 66.9% | 68.5% |
| 7.0-9.9 | 71.1% | 66.3% |
| 10.0+ | 83.4% | 87.1% |

**Residual analysis**: Mean ~0, StdDev 15.39 (2025), 17.61 (2026). Feb 2026 has -3.54 bias (model over-predicts).

**Vegas line**: R²=0.12-0.18. OLS improves RMSE by 5.9-11.1%.

**Key finding**: The regression model alone exceeds ALL success criteria (65.1% OOS, 4.9pp gap). The overrides are actively harmful. Drop them.

**Next step**: Phase 2 — test simplified models (3-feature, regularized, market-relative) to see if we can improve further or confirm the finding.

---

