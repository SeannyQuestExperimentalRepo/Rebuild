# Trendline — Master Rebuild Plan

*Dorothy's assessment after reading every file in the Rebuild repo.*
*Generated: 2026-02-15*

---

## Part 1: What I'd Keep vs Change

### 🟢 KEEP (These Are Competitive Advantages)

**1. Pick Engine v9 — The Crown Jewel**
This is genuinely sophisticated. The PIT (point-in-time) Ridge regression trained on 70,303 games with walk-forward validation is something 95% of competitors don't do. The 62.8% O/U accuracy with honest backtesting (no look-ahead bias) is real edge. The 5-star tier at 82.3% OOS is elite if it holds.

**2. Unified Team Resolver**
The `team-resolver.ts` + `team-aliases.generated.ts` system is clean. 1,504 lines of aliases generated from a consolidation script. This solves a problem every sports data platform fights. Keep this architecture.

**3. KenPom PIT System**
`kenpom-pit.ts` with batch queries using `DISTINCT ON` is smart. The EOS vs PIT bias gap analysis (4.6pp average look-ahead) is the kind of thing you'd put in a pitch deck — "we discovered our own model was cheating and fixed it."

**4. Multi-Signal Weighted Architecture**
9 independent signal categories with per-sport weight configs, graceful fallback, and reasoning labels. This is more transparent than anything Action Network or BetQL shows.

**5. NLP Search ("Home underdogs in primetime NFL")**
The `nlp-query-parser.ts` at 1,445 lines is a real differentiator. Natural language trend queries are something only DraftKings has attempted at scale, and poorly.

**6. Trend Discovery Engine**
`reverse-lookup-engine.ts` (950 lines) + `trend-engine.ts` (1,130 lines) with 50+ templates and Wilson interval confidence. This is unique in the market.

**7. Data Pipeline Integrity**
The cron job captures FanMatch predictions BEFORE games start, stores KenPom snapshots daily, uses Odds API to supplement ESPN gaps. This attention to data integrity is rare.

### 🟡 UPGRADE (Good Foundation, Needs Polish)

**1. Barttorvik Scraper**
The cheerio approach in the Rebuild will hit the same JS verification wall we discovered. Needs Puppeteer (we already solved this in dorothyv2). Also: the JSON endpoint `getadvstats.php` is worth trying first — could avoid the browser entirely.

**2. Elo System**
Good implementation but stores every game-date snapshot. The dorothyv2 version only stores final ratings. The Rebuild's approach is better (historical snapshots for analysis) but will generate massive row counts. Consider keeping only weekly snapshots + most-recent.

**3. Signal Weights**
v11 weights look reasonable but haven't been backtested as rigorously as the O/U model. The `sizeExp` and `pointDist` signals (v11 additions) are smart but need validation data.

**4. Weather/Venue/Travel**
Good static data in `venue.ts` (1,106 lines) but the weather signal isn't wired into the cron yet. NFL season will need this.

### 🔴 CHANGE (Fundamental Issues)

**1. No NBA Support in Production**
NBA is in the enum but `SPORTS` array in the cron is `["NFL", "NCAAF", "NCAAMB"]`. NBA is the fastest-growing betting market. This needs to ship.

**2. Frontend is Generic**
The hero section says "Sports Betting Intelligence" and "Find statistically significant betting trends." This doesn't convey the technical depth. The UI looks like every other dark-mode analytics dashboard. Needs a distinctive visual identity.

**3. No Mobile App / PWA Notifications Don't Work Well**
`service-worker-registration.tsx` and `web-push` are there but PWA notifications are unreliable on iOS. Need native mobile or at minimum a solid PWA with offline support.

**4. No Real-Time / Live Features**
The `use-live-scores.ts` hook exists but there's no live betting flow. Users want to see picks update as lines move, not just 3x/day cron.

**5. No Social/Community Layer**
`/community/page.tsx` exists but is likely empty. Sports betting is inherently social — leaderboards, shared picks, discussions. This is where retention happens.

**6. Stripe Integration Is Dormant**
Pricing page exists but subscription is inactive. Revenue needs to be on from day one.

**7. OpenAI Dependency for NLP**
Using OpenAI for search query interpretation is expensive at scale and adds latency. Could be replaced with a fine-tuned small model or rule-based parser for common queries.

---

## Part 2: Competitive Positioning

### Where Trendline Wins

| Advantage | vs Competitors |
|-----------|---------------|
| **PIT honest backtesting** | Nobody else publishes honest (non-look-ahead) backtest results. Action Network, BetQL, Dimers all use EOS data. |
| **Methodology transparency** | We show 9 signal categories with weights. Competitors show a "confidence score" black box. |
| **NLP trend search** | "Home underdogs after bye week in primetime" — nobody else lets you ask in plain English. |
| **Ensemble modeling** | KenPom + Barttorvik (NCAAMB), SP+ + PPA + Elo (NCAAF), Four Factors + Elo (NBA), EPA + Elo (NFL). Most competitors use 1 model. |
| **Data integrity** | PIT snapshots, pre-game odds capture, FanMatch persistence. Our data pipeline doesn't cheat. |
| **NCAAMB depth** | With KenPom FanMatch + PIT snapshots + Barttorvik ensemble + pointDist + height signals, we're deeper than anyone on college basketball. |

### Where Trendline Lags

| Gap | Who Does It Better |
|-----|-------------------|
| **Public betting %** | Action Network ($120/yr) has sharp/public splits — strongest contrarian signal. We don't have this. |
| **Injury-adjusted models** | Unabated and EVAnalytics adjust for player impact (EPM, WAR). Our models are team-level only. |
| **Live betting flow** | OddsShopper and Unabated have live odds comparison + real-time edges. We're batch (3x/day). |
| **Mobile experience** | BetQL and Action Network have native iOS/Android apps. We're web-only. |
| **Brand/community** | Covers.com has decades of community. We have zero social proof. |
| **Props/player markets** | PrizePicks integration, player prop modeling. Our prop engine exists but is thin. |
| **Speed** | Line movement detection should be real-time. Our cron runs every 6 hours for odds. |

---

## Part 3: Rebuild Roadmap

### Phase 0: Foundation (Week 1-2) — Ship what we have
- [ ] Fix Barttorvik scraper (Puppeteer or JSON endpoint)
- [ ] Add NBA to SPORTS array in cron
- [ ] Wire weather/venue into cron and pick engine for NFL/NCAAF
- [ ] Activate Stripe — even a simple $9.99/mo tier
- [ ] Deploy to Vercel with production DATABASE_URL
- [ ] Seed Elo ratings for all sports
- [ ] Run validation: picks generate for all 4 sports without errors

### Phase 1: Product-Market Fit (Week 3-6)
- [ ] **Track record page** — public, verifiable pick history with date stamps. THIS IS THE #1 conversion driver.
- [ ] **Daily email/push** — "Today's best edges" digest. Morning brief format.
- [ ] **Shareable pick cards** — social media optimized images for Twitter/Discord
- [ ] **Line movement alerts** — detect significant moves (>1 point) and notify users
- [ ] **Parlay builder** — already started, needs polish. Correlated parlay warnings.
- [ ] **Mobile PWA improvements** — offline picks cache, install prompt, iOS-friendly

### Phase 2: Differentiation (Week 7-12)
- [ ] **"Why This Pick" deep-dive** — expand reasoning to full-page matchup analysis
- [ ] **Injury impact model** — when a starter is ruled out, adjust spread prediction
- [ ] **Referee data** — scrape referee assignments, correlate with O/U tendencies
- [ ] **Live odds comparison** — integrate multiple books, show best available line
- [ ] **Backtesting playground** — let users run custom trend queries against historical data
- [ ] **API access** — paid tier for developers/podcasters who want raw pick data

### Phase 3: Growth (Week 13-20)
- [ ] **Social layer** — leaderboards, follow sharp users, pick discussions
- [ ] **Discord bot** — post daily picks to Discord servers
- [ ] **Affiliate integration** — link to sportsbooks, earn on sign-ups
- [ ] **Public betting % signal** — integrate Action Network or build scraping pipeline
- [ ] **Content engine** — auto-generated matchup previews for SEO
- [ ] **Native mobile app** — React Native or Expo, share codebase

### Phase 4: Scale (Week 21+)
- [ ] **B2B licensing** — sell the pick engine API to media companies
- [ ] **International markets** — European soccer, cricket, tennis
- [ ] **ML model upgrade** — graduate from Ridge to gradient boosting with more features
- [ ] **Real-time pipeline** — stream odds from multiple books, generate picks on line movement

---

## Part 4: Three UI Concepts

### Concept A: "The Bloomberg Terminal" (Power Users)
**Vibe:** Dense, data-rich, dark mode. For serious bettors who want every number.

- Grid-based dashboard with customizable panels
- Split-screen: picks on left, matchup deep-dive on right
- Real-time odds ticker at top (like a stock ticker)
- Keyboard shortcuts for power users (j/k to navigate, Enter to expand)
- Color-coded confidence: green/yellow/red glow intensity
- Compact tables with sparkline charts for trends
- Terminal-style search bar with autocomplete
- **Target audience:** Sharp bettors, data nerds, podcast handicappers
- **Reference:** Bloomberg Terminal, TradingView, Unabated

### Concept B: "The Daily Sheet" (Mass Market)
**Vibe:** Clean, card-based, approachable. For casual bettors who want simple picks.

- Single scrollable feed of today's best picks (like Instagram stories for bets)
- Large pick cards with team logos, star ratings, one-line reasoning
- Swipe/tap to "track" a pick or add to parlay
- Bottom nav: Today | Trends | Parlays | Record | Profile
- Morning brief notification: "3 five-star picks today"
- Social proof: "87% of Trendline users are on this pick"
- Minimal stats — show confidence stars, not raw numbers
- **Target audience:** Recreational bettors, DraftKings/FanDuel users, sports fans
- **Reference:** The Score, ESPN app, Action Network mobile

### Concept C: "The War Room" (Storytelling)
**Vibe:** Editorial + data. Each pick is a mini-article with narrative.

- Full-width matchup pages with hero images (team colors/logos)
- Narrative format: "Why Michigan covers: The Wolverines' defensive efficiency ranks 1st nationally..."
- Interactive signal breakdown: click each signal category to expand
- "The Case For" / "The Case Against" dual columns
- Historical parallels: "Teams in this situation are 73-41 ATS since 2015"
- Expert consensus vs Trendline pick comparison
- Video-style horizontal scroll for multiple picks
- **Target audience:** Content consumers, fantasy/betting crossover, newsletter subscribers
- **Reference:** The Athletic, FiveThirtyEight (RIP), Dimers

### Recommendation: Start with B, evolve toward A
The mass market is bigger and converts faster. Ship Concept B for v1 launch, then add Concept A as a "Pro" mode for paying subscribers. Concept C elements (narrative reasoning, historical parallels) can be layered into both.

---

## Part 5: Ground-Up Architecture (If Building from Scratch)

### Stack
- **Framework:** Next.js 15 (App Router, Server Components, Server Actions)
- **DB:** Neon PostgreSQL (keep — branching is valuable for dev)
- **ORM:** Prisma (keep — generated types are too valuable)
- **Auth:** NextAuth v5 (keep)
- **Payments:** Stripe (keep)
- **Hosting:** Vercel (keep — edge functions, cron, analytics)
- **Monitoring:** Sentry (keep)
- **Styling:** Tailwind + shadcn/ui (keep)
- **State:** TanStack Query (keep)
- **Search:** Replace OpenAI NLP with local rule-based parser + optional LLM fallback
- **Real-time:** Vercel KV + Server-Sent Events for live updates (ADD)
- **Cache:** Vercel KV or Upstash Redis for rate limiting + caching (ADD)
- **Queue:** Inngest or Trigger.dev for background jobs beyond cron (ADD)

### Data Architecture
```
┌─────────────────────────────────────────────────┐
│ Data Sources (Free)                              │
├────────────┬────────────┬───────────┬───────────┤
│ KenPom API │ ESPN API   │ CFBD API  │ nflverse  │
│ Barttorvik │ Odds API   │ NBA.com   │ Open-Meteo│
└─────┬──────┴─────┬──────┴─────┬─────┴─────┬─────┘
      │            │            │           │
      v            v            v           v
┌─────────────────────────────────────────────────┐
│ Unified Team Resolver (canonical names)          │
└─────────────────────┬───────────────────────────┘
                      v
┌─────────────────────────────────────────────────┐
│ PostgreSQL (Neon) — Source of Truth               │
├─────────────────────────────────────────────────┤
│ Team, Games (4 sport tables), KenpomSnapshot,    │
│ BarttovikSnapshot, EloRating, NBATeamStats,      │
│ NFLTeamEPA, NCAAFAdvancedStats, GameWeather,     │
│ OddsSnapshot, UpcomingGame, DailyPick, Bet, User │
└─────────────────────┬───────────────────────────┘
                      v
┌─────────────────────────────────────────────────┐
│ Pick Engine v9 (Signal Convergence Model)        │
│ - 9 signal categories × per-sport weight configs │
│ - PIT Ridge O/U regression (62.8% walk-forward)  │
│ - Ensemble: KenPom + Barttorvik + Elo + EPA etc. │
│ - Confidence tiers with monotonic calibration     │
└─────────────────────┬───────────────────────────┘
                      v
┌─────────────────────────────────────────────────┐
│ Delivery Layer                                    │
├───────────┬───────────┬──────────┬──────────────┤
│ Web App   │ Email     │ Push     │ API          │
│ (Next.js) │ Digest    │ Notif    │ (JSON/REST)  │
└───────────┴───────────┴──────────┴──────────────┘
```

### Database Schema Changes (vs current Rebuild)

1. **Add `isActiveD1` boolean to Team** — flag non-D-I teams without deleting them
2. **Add `Referee` model** — name, sport, game assignments, O/U tendencies
3. **Add `LineMovement` model** — track spread/total changes over time per game
4. **Add `UserPickTrack` model** — when a user marks they're tailing a pick
5. **Expand `DailyPick` with `settledPnl`** — track P&L per pick for public record
6. **Add `PickStreak` materialized view** — running hot/cold streaks per sport

### Key Architectural Principles

1. **PIT-first** — Every model trains on point-in-time data. No exceptions.
2. **Graceful degradation** — If any data source fails, picks still generate from remaining signals.
3. **Transparent reasoning** — Every pick has human-readable signal labels. No black boxes.
4. **Canonical names everywhere** — All data flows through `team-resolver.ts` at ingestion.
5. **Batch efficiency** — Use `$queryRaw` with `DISTINCT ON` for bulk lookups, not N+1 queries.
6. **Cache at the right level** — In-memory for hot data (6h TTL), DB for historical, Redis for rate limits.

---

## Part 6: Investor Positioning (One-Liner)

> **"Trendline is the Bloomberg Terminal for sports bettors — transparent, data-driven picks powered by ensemble models and honest backtesting, in a market where every competitor is a black box."**

### What makes this fundable:
- $7.9B → $12.4B TAM (sports betting analytics)
- 38 states + DC with legal sports betting
- Technical moat: PIT backtesting, ensemble models, NLP search, 150k+ game dataset
- First product that publishes *honest* accuracy (no look-ahead bias)
- Subscription model: $9.99/mo free tier → $29.99/mo Pro → $99/mo API
- Path to B2B: license the pick engine to media companies

### Pre-seed milestones:
1. 1,000 free users with 20% WAU
2. Public track record: 60%+ verified O/U accuracy over 30 days
3. 50 paying subscribers ($500+ MRR)
4. 3 sports generating profitable picks simultaneously

---

## Summary

The Rebuild repo is 80% of the way to a shippable product. The pick engine is legitimately strong — the PIT honest backtesting alone is a differentiator. What's missing is:

1. **Polish** — Fix Barttorvik, add NBA to cron, wire weather
2. **Identity** — The UI needs to scream "this is different" not "another dark dashboard"  
3. **Trust** — Public track record page is the single most important feature to build
4. **Revenue** — Turn on Stripe day one, even at $9.99/mo
5. **Distribution** — Daily email digest, shareable pick cards, Discord bot

The rebuild isn't a rewrite. It's finishing what's started, adding a distinctive UI, and shipping fast.
