# Mobile Strategy Research — Sports Betting Analytics App

> **Date:** 2026-02-14
> **Stack:** Next.js 14, React 18, Tailwind CSS, Vercel deployment
> **Context:** Solo dev / small team, sports betting analytics (not a sportsbook)

---

## TL;DR Recommendation

**Ship a PWA first.** It's 90% of what you need with 10% of the effort. Add Capacitor later _only_ if you need App Store presence or hit a real PWA wall. Skip React Native and Tauri for this use case.

---

## 1. Progressive Web App (PWA)

### Current State (2025–2026)

| Feature | Android (Chrome) | iOS (Safari 17+) |
|---|---|---|
| Install prompt (A2HS) | ✅ Native prompt via `beforeinstallprompt` | ⚠️ Manual "Add to Home Screen" only — no programmatic prompt |
| Push notifications | ✅ Reliable, FCM-backed | ✅ Supported since iOS 16.4 — but with caveats |
| Offline / service worker | ✅ Full support | ✅ Full support |
| Background sync | ✅ | ❌ Not supported |
| Badging API | ✅ | ✅ (iOS 16.4+) |
| Persistent storage | ✅ | ⚠️ Safari may evict after ~7 days of non-use |

### iOS Push Notification Reality Check

- **Works** since iOS 16.4+ via Web Push (standard Push API + VAPID keys).
- **Requires** the user to have _installed_ the PWA to home screen first — push doesn't work from Safari tab.
- **Reliability:** Good when the app is installed. Delivery rate is comparable to native in testing. Apple uses APNs under the hood.
- **Gotcha:** If user doesn't open the PWA for ~7 days, iOS can revoke notification permission silently. This is the biggest real-world limitation.
- **No silent/background push** — you can't wake the service worker to sync data silently on iOS.

### Real Limitations in 2026

1. **No install prompt on iOS** — you must educate users ("tap Share → Add to Home Screen"). Conversion is lower than Android.
2. **Storage eviction** — Safari may clear cached data if the PWA isn't used for ~7 days. Workbox with `navigator.storage.persist()` helps but isn't guaranteed.
3. **No background sync on iOS** — can't fetch new odds/picks in the background. Data is only fresh when the app is open.
4. **No access to:** HealthKit, NFC, Bluetooth, Siri Shortcuts, Widgets. None of these matter for a betting analytics app.
5. **iOS WebKit-only rendering** — performance is good for a data/dashboard app but you won't match 60fps native animations.

### Dev Effort

| Item | Estimate |
|---|---|
| Add `manifest.json` + service worker to existing Next.js app | 2–4 hours |
| Implement Workbox caching strategy | 4–8 hours |
| Add Web Push (VAPID setup + backend) | 1–2 days |
| Build install prompt UX (especially iOS education banner) | 4–8 hours |
| **Total** | **2–4 days** |

### App Store Risk

**None.** PWAs don't go through App Store review. This is a massive advantage for betting-adjacent content.

### Verdict

✅ **Best starting point.** Your app is a data dashboard — it doesn't need native hardware APIs. PWA gets you installable, push-enabled, offline-capable with minimal effort on top of your existing Next.js app.

---

## 2. React Native / Expo

### Code Sharing with Next.js

- **UI components: ~0% shared.** React Native uses `<View>`, `<Text>`, `<Pressable>` — not HTML/CSS. Your Tailwind-styled JSX is not portable.
- **Business logic / hooks / API layer: 50–70% shared** if you extract it into a shared package (monorepo with Turborepo). State management (Zustand, TanStack Query), API calls, auth logic — all reusable.
- **Expo Router** supports web, but it's a _replacement_ for Next.js, not a complement. You'd rewrite your web app in Expo Router to get true universal code.

### Expo Router for Web + Native

Expo Router (v3+) does support file-based routing for web and native from a single codebase. **But:**

- You'd abandon Next.js and Vercel's SSR/ISR advantages.
- Expo web rendering is client-side SPA — no server components, no ISR, no edge middleware.
- Tailwind doesn't work in RN — you'd use NativeWind (Tailwind-like for RN) but it's a rewrite.
- For a sports analytics app that benefits from SSR/SEO (shareable picks, public stats pages), this is a downgrade on web.

### Cost to Maintain

| Item | Estimate |
|---|---|
| Initial RN app build (screens, navigation, styling) | 4–8 weeks |
| Shared logic extraction (monorepo setup) | 1–2 weeks |
| Ongoing maintenance (two UIs, RN upgrades, native deps) | 10–20% of dev time permanently |
| App Store submissions, TestFlight, signing, etc. | Recurring overhead |

### App Store Risk

**HIGH for betting-adjacent apps.** Apple's guidelines (§5.2.1 and §5.3.3):

- Apps that provide real-money gambling features require a gambling license in each jurisdiction.
- **Analytics / picks apps** are a gray area. Apple has rejected "tip" and "picks" apps for being too close to gambling facilitation. You need to be careful with:
  - No direct links to sportsbooks
  - No facilitating placing bets
  - Framing as "educational" or "statistical analysis"
- Even if approved, **one policy change or reviewer having a bad day** can kill your app. This is a real risk.
- Google Play is somewhat more lenient but has similar restrictions.

### Verdict

❌ **Overkill for this stage.** You'd essentially build a second app. The shared code story is weaker than people claim — the UI is a complete rewrite. Only makes sense if you need features PWA literally can't provide (there are none for a data dashboard) or if App Store presence is a hard business requirement.

---

## 3. Capacitor (Ionic)

### How It Works

Capacitor wraps your **existing web app** in a native WebView shell. Your Next.js app runs inside WKWebView (iOS) / Android WebView with a bridge to native APIs.

### Pros vs PWA

| Advantage | Details |
|---|---|
| **App Store presence** | Real listing in App Store / Google Play |
| **Native push** | Uses APNs/FCM directly — more reliable than Web Push, works without "install to home screen" requirement |
| **Background fetch** | Capacitor plugin for periodic background fetch (iOS allows ~30s every 15min) |
| **No storage eviction** | Native app data isn't subject to Safari's 7-day purge |
| **Deep links** | Universal links / App Links work properly |
| **Plugins** | Access to native APIs (haptics, local notifications, biometrics) via Capacitor plugins |

### Cons vs PWA

| Disadvantage | Details |
|---|---|
| **App Store review** | Same betting-adjacent risks as React Native (see above) |
| **Build/deploy pipeline** | Need Xcode + Android Studio, signing certs, TestFlight, review cycles. Vercel instant deploys → multi-day release cycles |
| **WebView quirks** | WKWebView has subtle differences from Safari. Test thoroughly. |
| **App size** | ~15–30MB for a WebView shell vs 0 for a PWA |
| **Update friction** | Users must update from store (or use Capacitor's live update plugin for web layer changes) |

### Integration with Next.js

- **Works**, but with caveats. Capacitor expects a static export or SPA. You'd run `next export` (static) or configure it for client-side rendering.
- **You lose SSR/ISR** inside the native app (the WebView loads local or remote static files).
- **Alternative:** Point Capacitor's WebView at your live Vercel URL. This preserves SSR but requires internet (no offline) and is basically a fancy browser wrapper. Apple may reject this as a "thin client."
- **Best approach:** Static export for the app shell + API calls to your Vercel backend. Use `output: 'export'` in next.config or a separate Capacitor-specific build.

### Dev Effort

| Item | Estimate |
|---|---|
| Capacitor setup + static export config | 1–2 days |
| Native push notification plugin integration | 1–2 days |
| iOS/Android build pipeline (Xcode, signing, etc.) | 1–2 days |
| Testing & App Store submission | 2–3 days |
| **Total** | **1–2 weeks** |

### Verdict

⚠️ **Good Plan B.** If you hit real PWA limitations (iOS push unreliability, need App Store presence, need background fetch), Capacitor is the lowest-effort path to native. You keep 90%+ of your existing code. But it adds build complexity and App Store risk.

---

## 4. Tauri Mobile

### Current State

- Tauri 2.0 (stable late 2024) added iOS and Android support.
- Uses the **system WebView** (WKWebView on iOS, Android WebView) — similar to Capacitor in concept.
- Backend is **Rust** instead of JavaScript — Tauri plugins are Rust.
- Smaller binary size than Electron (irrelevant on mobile since both use system WebView).

### Pros

- Smaller bundle than Capacitor (marginally — both use system WebView on mobile).
- Rust backend for any heavy computation (not needed for a data dashboard).
- Strong security model.

### Cons

- **Ecosystem is immature for mobile.** Plugin ecosystem is much smaller than Capacitor's. Push notifications, background fetch, in-app purchases — these require community plugins or custom Rust code.
- **Rust requirement.** If you need a native plugin, you're writing Rust, not JavaScript. For a solo JS/TS dev, this is a significant context switch.
- **Smaller community.** Fewer Stack Overflow answers, fewer tutorials, fewer battle-tested production apps on mobile.
- **Next.js integration** is the same story as Capacitor — static export into the WebView.

### Dev Effort

| Item | Estimate |
|---|---|
| Tauri setup + static export | 2–3 days |
| Push notifications (less mature plugin ecosystem) | 2–4 days |
| Learning Rust basics for custom plugins | 1–2 weeks if needed |
| **Total** | **2–4 weeks** (more unknowns) |

### Verdict

❌ **Not yet for this use case.** Tauri mobile is promising but the plugin ecosystem isn't mature enough. You'd spend time fighting tooling instead of shipping features. Revisit in 1–2 years. If you were building a desktop app, Tauri would be compelling — but for mobile, Capacitor is more proven.

---

## Comparison Matrix

| Factor | PWA | React Native / Expo | Capacitor | Tauri Mobile |
|---|---|---|---|---|
| **Dev effort** | 2–4 days | 6–10 weeks | 1–2 weeks | 2–4 weeks |
| **Code reuse from Next.js** | 100% | 30–50% (UI rewrite) | 90%+ | 90%+ |
| **App Store presence** | ❌ | ✅ | ✅ | ✅ |
| **App Store risk (betting)** | N/A | 🔴 High | 🔴 High | 🔴 High |
| **Push reliability (iOS)** | 🟡 Good, requires install | 🟢 Native APNs | 🟢 Native APNs | 🟡 Plugin maturity |
| **Offline support** | 🟡 Good (iOS storage caveats) | 🟢 Full | 🟢 Full | 🟢 Full |
| **Background sync** | ❌ iOS / ✅ Android | ✅ | ✅ (limited on iOS) | ⚠️ Plugin dependent |
| **Maintenance cost** | Very low | High (dual codebase) | Low–moderate | Moderate (Rust) |
| **SSR / SEO preserved** | ✅ | ❌ | ❌ (static export) | ❌ (static export) |
| **Update speed** | Instant (Vercel deploy) | Store review (1–3 days) | Hybrid (live updates possible) | Store review |

---

## Recommended Strategy

### Phase 1: PWA (Now)

1. Add `manifest.json` with proper icons, theme color, display: standalone.
2. Implement service worker with Workbox (cache API responses, app shell).
3. Add Web Push via VAPID keys for pick alerts, game notifications.
4. Build a smart iOS install banner ("Add to Home Screen" education).
5. **Ship in days, not weeks.**

### Phase 2: Capacitor (If/When Needed)

Trigger conditions to move to Phase 2:

- Users complain about iOS push reliability
- You need background data refresh (pre-fetch odds before games)
- Business requires App Store presence for credibility/distribution
- You want to charge via in-app purchase

When you do:

- Use Capacitor with your existing Next.js app (static export build)
- Use Capacitor's live update plugin (Appflow or Capgo) to push web-layer updates without store review
- Budget 1–2 weeks for initial setup, then ongoing store maintenance

### Phase 3: Never (for now)

- **React Native:** Don't rewrite your UI. You're a solo dev / small team. The code sharing promise is a trap — you'll maintain two UI codebases.
- **Tauri Mobile:** Revisit when the plugin ecosystem matures. Not worth the risk for a production app today.

---

## Apple App Store — Betting App Survival Guide

If you go Capacitor or native, here's how to navigate Apple review:

1. **Frame as analytics/education**, not gambling. "Sports statistics and analysis tool."
2. **No direct bet placement** or links to sportsbooks.
3. **No real-money transactions** related to betting.
4. **Age gate** (17+ rating) in your App Store listing.
5. **Privacy policy** that covers data usage.
6. **Be prepared for rejection** and have an appeal ready explaining you're a stats tool, not a gambling app.
7. **Consider:** Is App Store presence actually worth the risk and maintenance? For an analytics dashboard, PWA might be permanently sufficient.

---

## Final Word

The sports betting analytics use case is almost perfectly suited for a PWA. You're showing data, charts, picks, and notifications — all of which work great in a modern mobile browser. The main PWA limitation (iOS install friction) is a UX problem you can design around, not a technical blocker.

Don't over-engineer the mobile story. Ship the PWA, get users, and let real user feedback — not hypothetical limitations — drive the decision to go native.
