# TrendLine — Development Roadmap

*Last updated: Feb 12, 2026*

## Current State

TrendLine is a sports betting analytics platform with **154K+ games** across NFL, NCAAF, and NCAAMB. The core platform and most Tier 1 features are production-ready:

### Fully Built
- Natural language trend search (NLP regex parser + GPT-4o-mini fallback)
- Trend engine with 20+ queryable fields and perspective flipping
- Auto-discover 45+ angle templates with statistical significance testing
- Deep matchup pages (H2H, season stats, recent games, situational trends)
- Daily ESPN data sync (cron at 6 AM/12 PM ET) for upcoming games + completed scores
- **The Odds API integration** — Daily NCAAMB odds supplement + historical backfill, shared team mapping (125+ entries)
- Statistical rigor: p-values, z-scores, confidence intervals on every result
- **Player props & player trends** — Prop finder page, hit rate analysis, PlayerGameLog in DB
- **Live odds** — The Odds API (20K credits/mo), multi-book comparison page, OddsSnapshot storage
- **Bet tracking** — Full dashboard with ROI, streak tracking, by-sport breakdown, auto-grading
- **Daily picks** — Pick Engine v6 with 9-signal convergence scoring, FanMatch integration, market edge signal, auto-generation via cron
- **Saved trends** — Save/replay trend queries, daily cron evaluation against upcoming games
- **Parlay engine** — Joint probability, EV, Kelly criterion, teaser point analysis
- **Rate limiting** — 4 tiered limiters across all API routes (public, auth, query, auth-flow)
- **AP rankings** — Displayed next to team names for college basketball and football
- **Auth** — NextAuth v5 with Google + credentials, JWT sessions, role-based access (FREE/PREMIUM/ADMIN)
- **Tier limits** — Feature gating by user role (pick confidence, bet tracking, props, odds access)
- **Pricing page** — FREE vs Premium ($19/mo, $149/yr) with feature comparison

### Partially Built
- **Subscriptions** — Tiers defined and enforced in code, but Stripe not connected (no payment flow)
- **Error monitoring** — Structured logging utility ready, Sentry not connected
- **Line movement** — OddsSnapshot table captures multi-book odds, but no movement analysis UI or alerts

---

## Competitive Landscape

### Direct Competitors

| Tool | Pricing | Key Strength | What They Have That We Don't |
|------|---------|-------------|------------------------------|
| **Action Network** | $20-30/mo | Sharp money %, line movement, bet tracking | Public/sharp splits, line movement charts, bet sync, mobile app |
| **BetQL** | ~$30/mo | AI model (10K sims per game), star ratings | Predictive model with ratings, injury integration |
| **TeamRankings/BetIQ** | $30/mo | Custom trend builder with filter dropdowns | Polished UI trend builder, pre-built trend pages by sport, predictions |
| **KillerSports** | Free/$10/mo | SDQL (Sports Data Query Language) — power users | Custom query language, daily email alerts when trends are active |
| **Covers.com** | Free/Premium | Consensus picks, real-time odds | Public betting %, consensus data, massive community/forum |
| **Outlier** | $20-80/mo | Player props with hit rate colors | One-click bet placement, +EV feed |
| **OddsShark** | Free | Data-driven betting guides, historical odds | Computer picks, extensive free content |
| **StatMuse** | Free | Natural language sports queries | Voice search, multi-platform, beautiful data viz |

### Where TrendLine Wins
- **Statistical rigor** — No competitor surfaces p-values, confidence intervals, and z-scores
- **NLP trend search** — Only StatMuse does NLP for sports, but they don't do betting trends
- **Auto-discovery** — Reverse-lookup engine scanning 45+ templates is unique
- **Multi-sport depth** — Full coverage of NFL + NCAAF + NCAAMB with sport-specific fields
- **Daily picks engine** — Signal convergence across 9 independent angles with FanMatch + market edge signals
- **Parlay analysis** — True joint probability and Kelly sizing — no competitor does this well

### Where TrendLine Still Loses
- **No line movement tracking** — Infrastructure exists but no UI or alerts
- **No sharp/public splits** — Requires data partnership or scraping
- **No mobile app** — 84% of bettors use mobile
- **No community** — No forums, leaderboards, or social sharing
- **No email alerts** — Saved trend evaluation runs but notifications aren't sent
- **No payment processing** — Can't collect revenue without Stripe

---

## Recently Completed

### The Odds API Integration (Feb 2026)
- Integrated The Odds API into the daily cron pipeline (steps 1.5 and 2.5)
- `supplementUpcomingGamesFromOddsApi()` fills NCAAMB odds gaps ESPN misses
- `backfillYesterdayOdds()` patches completed games still lacking spreads (morning cron only)
- Shared team name mapping module (`odds-api-team-mapping.ts`) with 125+ entries and multi-word mascot handling
- Historical backfill script updated to use shared mapping + commence_time filtering
- Backfilled 26 games across 50 API calls; remaining ~2,983 are small-school games without betting markets

### Pick Engine v6 (Feb 2026)
- **FanMatch predicted margin** — Replaces static AdjEM + HCA formula with KenPom's game-level predictions
- **Context-aware HCA fallback** — Conference=2.5, non-conference=1.5, November=1.0, March=0.5 (was flat 2.0)
- **FanMatch O/U modifier** — Predicted total confirms/dampens the sum_AdjDE signal
- **Moneyline market edge signal** — 9th signal comparing KenPom WP vs market-implied probability
- **AdjOE modifier for O/U** — Offensive efficiency now amplifies OVER/UNDER alongside defensive efficiency
- Weight rebalance: marketEdge=0.10, recentForm=0.10 (was 0.15), h2h=0.05 (was 0.10)

---

## What's Next — Prioritized

### Priority 1: Revenue Unlock (Stripe)

The single most important remaining item. Everything else is built — this is the only blocker to revenue.

**Work needed:**
- Create Stripe products/prices in Stripe Dashboard (Premium Monthly $19, Annual $149)
- Build `/api/stripe/checkout` route (create Checkout Session)
- Build `/api/stripe/webhook` route (handle subscription lifecycle events)
- Build `/api/stripe/portal` route (customer self-service portal)
- Wire "Subscribe Now" button on pricing page to Checkout
- Update user role on subscription create/cancel/update via webhook
- Add `stripeCustomerId` to User model
**Impact:** Revenue generation. Literally the only thing between $0 and recurring revenue.

### Priority 2: Pick Engine v6 Backtesting

The v6 changes introduced 5 new signals/modifiers without backtesting against historical data. Need to validate they actually improve accuracy before the season ends.

**Work needed:**
- Run v6 pick generation against 2025-26 completed games (with FanMatch data from NCAAMBGame table)
- Compare v5 vs v6 win rates for 4★ and 5★ picks (spread and O/U separately)
- Evaluate moneyline market edge signal accuracy (does divergence predict spread covering?)
- Evaluate FanMatch margin vs AdjEM+HCA spread accuracy
- Tune FanMatch O/U modifier thresholds (currently ±1 mag, ±0.05 conf)
- Tune moneyline edge thresholds (currently 8% and 15%)
- Document results and adjust weights if needed
**Impact:** Ensures the new signals are additive, not noise. Could improve or degrade pick accuracy.

### Priority 3: Line Movement Dashboard

OddsSnapshot data is already being captured. Need to surface it.

**Work needed:**
- Query OddsSnapshot history for a game (group by fetchedAt)
- Build sparkline chart component (spread over time)
- Show opening vs. current line on matchup pages
- Detect significant line moves (>1 point shift)
- Optional: line movement alerts (email/push when line crosses a threshold)
**Impact:** Professional-grade feature that justifies premium pricing.

### Priority 4: Email Notifications for Saved Trends

The cron already evaluates saved trends daily. Just need to send emails when they trigger.

**Work needed:**
- Integrate an email service (Resend, SendGrid, or AWS SES)
- Send email when `evaluateSavedTrends()` finds a match
- Add notification preferences to SavedTrend (email on/off)
- Email template: "Your trend 'Chiefs ATS home favorites' is active today — Chiefs -7 vs Bills"
**Impact:** Massive retention. The app reaches out to users instead of waiting for them.

### Priority 5: Sentry Error Monitoring

Structured logging is in place but errors go to console only.

**Work needed:**
- Install `@sentry/nextjs`
- Configure Sentry DSN
- Wire existing `trackError()` calls to Sentry
- Add source maps upload to build process
**Impact:** Visibility into production errors before users report them.

### Priority 6: Mobile PWA

**Work needed:**
- Add web app manifest (`manifest.json`)
- Add service worker for offline support
- Mobile-optimize key pages (Today's Sheet, bet tracker, trend search)
- Add "install app" prompt
**Impact:** Unlocks mobile users with minimal effort (no App Store).

---

## Future Tiers (Unchanged)

### Tier 2: Competitive Advantages

#### Sharp vs. Public Betting Splits
- Source: Requires partnership or API access to betting percentage data
- Display: % of bets vs. % of money for each side
- Highlight reverse line movement (sharp action indicator)

#### Predictive Model & Game Ratings
- Pick Engine v6 has 9-signal convergence scoring with KenPom + FanMatch + market edge
- Next step: build a trained ML model (logistic regression or gradient boosting) on historical signal outputs
- Calibrate confidence tiers against actual outcomes (are 5★ picks truly better than 4★?)
- Track model performance publicly with a real-time record page

### Tier 3: Growth & Polish

#### NBA, MLB, NHL Support
- Priority order: NBA → MLB → NHL
- Each sport roughly doubles the addressable market

#### Community & Social Features
- Public trend leaderboard
- Share trend to Twitter/X with auto-generated card image
- "Popular trends" section

#### Advanced NLP & Conversational Search
- Multi-turn conversations
- Suggested follow-up queries
- Comparison queries ("Chiefs vs. Bills — who covers more at home?")

### Tier 4: Moonshots

- Real-time game dashboard with live scores
- Backtesting engine (simulate betting systems, show equity curves)
- DFS integration (ownership projections, lineup analysis)
- API for third parties
- White-label / B2B licensing

---

## Technical Debt

| Issue | Priority | Status |
|-------|----------|--------|
| Rate limiting on API routes | High | **DONE** — 4 tiered limiters |
| Error monitoring | High | Structured logging done, Sentry not connected |
| `force-dynamic` on matchup route | Low | **DONE** — Cache-Control added |
| Sequential DB queries | Low | **DONE** — Promise.all |
| All-sport cache loading | Low | **DONE** — Sport-specific |
| `cheerio` and `xlsx` in production deps | Low | Move to devDependencies |
| `openai` dependency for NLP | Medium | Consider local model to reduce cost |
| No E2E tests | Medium | Add Playwright tests for critical flows |
| Pick generation timeout on large slates | Low | **DONE** — Pre-generated via cron |
| Pick Engine v6 not backtested | High | New signals (FanMatch, ML edge, AdjOE) need historical validation |
| FanMatch data only available for current day | Medium | Historical FanMatch not stored — can't backtest FanMatch margin signal |

---

## Revenue Model

Pricing page is built with these tiers:

| Tier | Price | Access |
|------|-------|--------|
| **Free** | $0 | 10 trends/day, 4★ picks only, no bet tracking/props/odds |
| **Premium** | $19/mo or $149/yr | Unlimited trends, all picks (4-5★), bet tracking, props, live odds, saved trends |
| **Admin** | Internal | Everything |

**Blocker:** Stripe integration (Priority 1 above).
