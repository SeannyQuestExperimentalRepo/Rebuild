# Multi-Sport Betting Research Report

Date: 2026-02-14

## Current State: What You Have vs What's Missing

### NCAAMB (Most Mature)
Have: KenPom PIT model (v9), 9 signal categories, 722K+ PIT snapshots, KenPom supplemental data (Four Factors, Team Stats, HCA, Height, Point Distribution), neutral site data, conference game flags, tournament rounds.

Missing / Underutilized:
- Rest/schedule data (B2B was 55.6% ATS in your experiment but isn't stored)
- Altitude/elevation data (KenpomHCA has it, not used in signals)
- Early-season vs late-season weighting (ATS experiment showed Nov/Dec is best, March worst)
- Tournament game suppression (37.6% ATS — should possibly be auto-excluded)

---

### NFL (Has Infrastructure, Missing Key Data)
Have: Power rating model edge (simple ELO-style), season ATS, trend angles, recent form, H2H, situational signals. Signal weights: modelEdge 0.20, trendAngles 0.25, recentForm 0.20.

Critical Missing Data:
- EPA/play differential — Best single predictor of NFL outcomes. Offense weighted 1.6x defense. Source: nflfastR / nflverse (Free)
- DVOA — More predictive than actual record. Splits by pass/rush/special teams. Source: Football Outsiders (Paid ~$50/yr)
- Success Rate — % of plays gaining "enough" yards (40%+ 1st, 60%+ 2nd, 100%+ 3rd). Source: nflfastR (Free)
- Weather data — Wind 20+ mph reduces scoring by 2.7 pts; temp < 32F increases unders. Source: NFL weather APIs (Free)
- Injury/QB status — Single biggest line mover in NFL; backup QB = 3-7 pt swing. Source: ESPN injury reports (Free)

Key Research Findings:
- Modern NFL HFA has declined to ~1.5-2.0 points (not the traditional 3). Current model uses 2.5 — already close but could be refined.
- Bye week advantage has largely disappeared post-2011 CBA (~0.3 pts). If the situational signal weights this heavily, it's noise.
- Divisional underdogs cover at ~71% ATS since 2014 — familiarity breeds competitiveness.
- Wong teasers crossing key numbers 3 and 7 remain one of the most consistent NFL edges.
- Weather matters most for totals: wind 20+ mph = take the under.

Highest-Impact Upgrade: Replace the simple power rating model with EPA/play-based efficiency ratings from nflfastR. Free data, gold standard for NFL game prediction.

---

### NCAAF (Recently Enhanced with SP+, Still Gaps)
Have: SP+ model edge via CollegeFootballData.com API (0.30 weight — highest of any signal), season ATS, trend angles, recent form, H2H, situational.

Critical Missing Data:
- Five Factors — Explosiveness (86% win rate when won), Efficiency (83%), Finishing Drives (75%). Source: CFBD API (Free)
- Havoc Rate — Forced fumbles + TFL + PBU — defensive disruption metric. Source: CFBD API (Free)
- PPA (Predicted Points Added) — NCAAF equivalent of EPA; per-play efficiency. Source: CFBD API (Free)
- Weather — Wind 15+ mph -> 58% under rate; cold weather reduces scoring. Source: Weather APIs (Free)
- Returning production % — Measures roster turnover year-to-year; critical for early season. Source: CFBD API (Free)

Key Research Findings:
- Bill Connelly's Five Factors are the most validated framework: Explosiveness, Efficiency, Finishing Drives, Turnovers, Field Position. Each individually predicts wins at 72-86%.
- SP+ raw is only 52-54% ATS — but combined with situational factors (early season, line movement) it improves significantly.
- Early season lines are most inefficient — public overvalues prior-year reputation. Teams that lost star players are overvalued for ~4 weeks.
- Bowl game opt-outs create massive line shifts that books sometimes don't fully account for.
- Trap games debunked by Harvard research — no statistical evidence for letdown/lookahead spots in NCAAF.
- HFA is approximately 2.5-3.0 points with only 11 of 247 stadiums showing statistically significant deviation (current model uses 3.0 — correct).

Highest-Impact Upgrade: Pull Five Factors + PPA from CFBD API (already connected for SP+). Essentially free additional data from an API already in use.

---

### NBA (Stub — Most Opportunity)
Have: Signal weights defined but model edge is essentially a fallback power-rating stub. No sport-specific efficiency model. restDays signal (0.10 weight) and tempoDiff (0.15 weight) are defined but data population is unclear.

Critical Missing Data:
- Adjusted Net Rating — Points per 100 possessions, adjusted for opponent. Single best team metric. Source: nba_api / NBA.com (Free)
- Four Factors — Explain 96% of win variance: eFG%, TOV%, ORB%, FTRate. Source: nba_api (Free)
- B2B detection — Teams on B2B lose ATS ~57% vs rested opponents. Biggest situational edge. Source: Schedule data / ESPN (Free)
- Travel distance — Every 500km reduces win probability by ~4%. West->East worse than East->West. Source: Calculate from city coords (Free)
- Player impact (EPM/RAPTOR) — Star absence shifts lines 4-8 points; market often over-adjusts. Source: Dunks & Threes / FiveThirtyEight (Free)
- Pace — Fastest teams have highest variance — affects totals significantly. Source: nba_api (Free)

Key Research Findings:
- NBA Four Factors explain 96% of win variance — eFG% alone explains ~40%. Most validated basketball model.
- B2B is the NBA's biggest situational edge: teams playing second of B2B vs rested opponent lose ATS approximately 57% of the time.
- HCA is declining — now approximately 2.2 points (was 3.5+ pre-COVID). Altitude still matters (Denver is a clear outlier).
- Travel/timezone effects are real: West Coast home teams vs East Coast visitors win at 63.5% vs 55.0%.
- Star player absence shifts lines 4-8 points but the market tends to over-adjust — fading the line movement when a star sits out is profitable.
- EPM (Estimated Plus-Minus) is the current best single-number player metric for prediction.

Highest-Impact Upgrade: NBA has the most room for improvement. Building an Adjusted Net Rating model with Four Factors from nba_api would immediately give a real model edge instead of the current stub. Adding B2B detection from schedule data is trivially easy and provides the single best situational signal.

---

## Priority-Ranked Actionable Improvements

### Tier 1: High Impact, Low Effort (Do First)
1. NBA B2B detection — Parse schedule to detect B2B situations. ESPN schedule data already exists. Add a boolean field, weight it heavily in situational signals. Expected edge: ~57% ATS.
2. NCAAMB rest/schedule data — Store days of rest per team. ATS experiment proved B2B matters (55.6%). Just adding a field and computing it from existing game dates.
3. NCAAMB tournament game suppression — ATS experiment showed 37.6% ATS in tournament games. Either exclude them from picks or heavily discount confidence.
4. NCAAMB seasonal weighting — Nov/Dec games are most exploitable (early season lines are soft). Late season/March picks should require higher edge thresholds.

### Tier 2: High Impact, Medium Effort
5. NFL EPA/play model — Replace power ratings with nflfastR EPA-based efficiency. Free data, well-documented, dramatically better than simple ELO. Requires building an ingestion pipeline for R data (or using nflverse Python package).
6. NCAAF Five Factors from CFBD — Already calling CFBD for SP+. Add Five Factors + PPA endpoints to the same pipeline. Minimal API work, significant model improvement.
7. NBA Four Factors + Adjusted Net Rating — Build from nba_api. Replaces the stub model edge with a real predictive model.

### Tier 3: Medium Impact, Higher Effort
8. NFL weather integration — Wind 20+ mph is a strong under signal (2.7 pts). Requires weather API integration and matching to game locations.
9. NBA travel distance calculation — Pre-compute distances between arenas, track schedule density. Every 500km = ~4% win probability reduction.
10. NFL HFA refinement — Move from static 2.5 to dynamic HFA based on crowd size, dome vs outdoor, altitude.
11. NCAAF returning production — Early-season model adjustment based on roster continuity. CFBD has this data.

### Tier 4: Lower Priority / Longer-Term
12. Player-level impact metrics — EPM for NBA, QB-adjusted power ratings for NFL. Requires player-level data pipelines.
13. Live line movement tracking — Detect sharp money vs public money. Requires odds history storage (partially exists with opening/closing lines).
14. Prop bet engine — NFL code already has prop discovery infrastructure. Expanding with player-level models could be lucrative.

---

## Data Source Summary

Source                      | Sports | Cost      | What It Provides
nflfastR / nflverse         | NFL    | Free      | EPA/play, success rate, CPOE, play-by-play since 1999
CollegeFootballData.com     | NCAAF  | Free      | SP+ (already using), Five Factors, PPA, havoc rate, returning prod
nba_api                     | NBA    | Free      | Four Factors, Net Rating, pace, player stats, schedule
ESPN APIs                   | All    | Free      | Schedules, scores, odds (already using)
Football Outsiders          | NFL    | ~$50/yr   | DVOA — more predictive than record but paid
