/**
 * Deep analysis of NCAAMB backtest data
 *
 * Explores overlooked statistical angles and patterns to improve
 * the pick engine. Runs targeted queries against the completed
 * games database.
 *
 * Usage: npx tsx scripts/backtest-deep-analysis.ts
 */

import { prisma } from "../src/lib/db";
import { getKenpomRatings, lookupRating, type KenpomRating } from "../src/lib/kenpom";
import { wilsonInterval } from "../src/lib/trend-stats";

function pct(num: number, den: number): string {
  if (den === 0) return "N/A";
  return ((num / den) * 100).toFixed(1) + "%";
}

function roi(wins: number, losses: number): string {
  const decided = wins + losses;
  if (decided === 0) return "N/A";
  return ((((wins * 100 / 110) - losses) / decided) * 100).toFixed(1) + "%";
}

interface GameRow {
  gameDate: Date;
  homeScore: number;
  awayScore: number;
  scoreDifference: number;
  spread: number | null;
  overUnder: number | null;
  spreadResult: string | null;
  ouResult: string | null;
  homeRank: number | null;
  awayRank: number | null;
  homeTeam: { name: string; conference: string | null };
  awayTeam: { name: string; conference: string | null };
}

async function main() {
  console.log("=== NCAAMB Deep Analysis ===\n");

  // Load games
  const games = await prisma.nCAAMBGame.findMany({
    where: { season: 2025, spread: { not: null } },
    orderBy: { gameDate: "asc" },
    include: {
      homeTeam: { select: { name: true, conference: true } },
      awayTeam: { select: { name: true, conference: true } },
    },
  }) as unknown as GameRow[];

  console.log(`Total games: ${games.length}\n`);

  // Load KenPom
  let kenpom: Map<string, KenpomRating> | null = null;
  try {
    kenpom = await getKenpomRatings();
    console.log(`KenPom: ${kenpom.size} teams loaded\n`);
  } catch { console.log("KenPom unavailable\n"); }

  // ═══════════════════════════════════════════════════════════════
  // ANALYSIS 1: Spread by line range
  // ═══════════════════════════════════════════════════════════════
  console.log("═══ SPREAD BY LINE RANGE ═══");
  const lineRanges = [
    { label: "Home fav -14+", filter: (s: number) => s <= -14 },
    { label: "Home fav -7 to -13.5", filter: (s: number) => s > -14 && s <= -7 },
    { label: "Home fav -3 to -6.5", filter: (s: number) => s > -7 && s <= -3 },
    { label: "Home fav -1 to -2.5", filter: (s: number) => s > -3 && s < 0 },
    { label: "Pick'em (0 to +0.5)", filter: (s: number) => s >= 0 && s <= 0.5 },
    { label: "Home dog +1 to +2.5", filter: (s: number) => s > 0.5 && s <= 3 },
    { label: "Home dog +3 to +6.5", filter: (s: number) => s > 3 && s <= 7 },
    { label: "Home dog +7 to +13.5", filter: (s: number) => s > 7 && s <= 14 },
    { label: "Home dog +14+", filter: (s: number) => s > 14 },
  ];

  for (const range of lineRanges) {
    const subset = games.filter((g) => g.spread !== null && range.filter(g.spread));
    const homeCov = subset.filter((g) => g.spreadResult === "COVERED").length;
    const homeLost = subset.filter((g) => g.spreadResult === "LOST").length;
    const pushes = subset.filter((g) => g.spreadResult === "PUSH").length;
    const decided = homeCov + homeLost;
    // "Home covers" rate
    console.log(`  ${range.label}: ${subset.length} games, home covers ${pct(homeCov, decided)} (${homeCov}-${homeLost}-${pushes})`);
  }

  // ═══════════════════════════════════════════════════════════════
  // ANALYSIS 2: KenPom edge vs actual spread results
  // ═══════════════════════════════════════════════════════════════
  if (kenpom) {
    console.log("\n═══ KENPOM SPREAD EDGE BUCKETS ═══");
    console.log("  (edge = predicted margin + spread; positive = model favors home)\n");

    interface EdgeBucket {
      label: string;
      min: number;
      max: number;
      wins: number;
      losses: number;
    }

    const edgeBuckets: EdgeBucket[] = [
      { label: "Strong away (edge < -6)", min: -100, max: -6, wins: 0, losses: 0 },
      { label: "Mod away (-6 to -3)", min: -6, max: -3, wins: 0, losses: 0 },
      { label: "Slight away (-3 to -1)", min: -3, max: -1, wins: 0, losses: 0 },
      { label: "Neutral (-1 to +1)", min: -1, max: 1, wins: 0, losses: 0 },
      { label: "Slight home (+1 to +3)", min: 1, max: 3, wins: 0, losses: 0 },
      { label: "Mod home (+3 to +6)", min: 3, max: 6, wins: 0, losses: 0 },
      { label: "Strong home (edge > +6)", min: 6, max: 100, wins: 0, losses: 0 },
    ];

    let matched = 0;
    for (const g of games) {
      if (g.spread === null || !g.spreadResult || g.spreadResult === "PUSH") continue;
      const homeR = lookupRating(kenpom, g.homeTeam.name);
      const awayR = lookupRating(kenpom, g.awayTeam.name);
      if (!homeR || !awayR) continue;
      matched++;

      const predictedMargin = homeR.AdjEM - awayR.AdjEM + 2.0;
      const edge = predictedMargin + g.spread;

      for (const bucket of edgeBuckets) {
        if (edge >= bucket.min && edge < bucket.max) {
          if (edge > 0) {
            // Model says home
            if (g.spreadResult === "COVERED") bucket.wins++;
            else bucket.losses++;
          } else {
            // Model says away
            if (g.spreadResult === "LOST") bucket.wins++;
            else bucket.losses++;
          }
          break;
        }
      }
    }

    console.log(`  (${matched} games matched to KenPom)\n`);
    for (const b of edgeBuckets) {
      const d = b.wins + b.losses;
      console.log(`  ${b.label}: ${b.wins}-${b.losses} (${pct(b.wins, d)}, ROI: ${roi(b.wins, b.losses)})`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ANALYSIS 3: KenPom edge by month (season-half effect)
    // ═══════════════════════════════════════════════════════════════
    console.log("\n═══ KENPOM EDGE BY MONTH (away-side only, edge < -1) ═══");
    const monthGroups: Record<string, { wins: number; losses: number }> = {};

    for (const g of games) {
      if (g.spread === null || !g.spreadResult || g.spreadResult === "PUSH") continue;
      const homeR = lookupRating(kenpom, g.homeTeam.name);
      const awayR = lookupRating(kenpom, g.awayTeam.name);
      if (!homeR || !awayR) continue;

      const edge = homeR.AdjEM - awayR.AdjEM + 2.0 + g.spread;
      if (edge >= -1) continue; // Only away-side

      const month = g.gameDate.toISOString().substring(0, 7);
      if (!monthGroups[month]) monthGroups[month] = { wins: 0, losses: 0 };
      // Model says away — away wins when home LOSES the spread
      if (g.spreadResult === "LOST") monthGroups[month].wins++;
      else monthGroups[month].losses++;
    }

    for (const [month, r] of Object.entries(monthGroups).sort()) {
      console.log(`  ${month}: ${r.wins}-${r.losses} (${pct(r.wins, r.wins + r.losses)}, ROI: ${roi(r.wins, r.losses)})`);
    }

    console.log("\n═══ KENPOM EDGE BY MONTH (home-side only, edge > +1) ═══");
    const homeMonthGroups: Record<string, { wins: number; losses: number }> = {};

    for (const g of games) {
      if (g.spread === null || !g.spreadResult || g.spreadResult === "PUSH") continue;
      const homeR = lookupRating(kenpom, g.homeTeam.name);
      const awayR = lookupRating(kenpom, g.awayTeam.name);
      if (!homeR || !awayR) continue;

      const edge = homeR.AdjEM - awayR.AdjEM + 2.0 + g.spread;
      if (edge <= 1) continue; // Only home-side

      const month = g.gameDate.toISOString().substring(0, 7);
      if (!homeMonthGroups[month]) homeMonthGroups[month] = { wins: 0, losses: 0 };
      if (g.spreadResult === "COVERED") homeMonthGroups[month].wins++;
      else homeMonthGroups[month].losses++;
    }

    for (const [month, r] of Object.entries(homeMonthGroups).sort()) {
      console.log(`  ${month}: ${r.wins}-${r.losses} (${pct(r.wins, r.wins + r.losses)}, ROI: ${roi(r.wins, r.losses)})`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ANALYSIS 4: Conference effects on ATS
    // ═══════════════════════════════════════════════════════════════
    console.log("\n═══ CONFERENCE MATCHUP EFFECTS ═══");
    const powerConfs = ["Big East", "Big 12", "Big Ten", "SEC", "ACC", "Pac-12"];

    // Conference game vs non-conference
    const confGames = games.filter((g) => g.homeTeam.conference === g.awayTeam.conference);
    const nonConfGames = games.filter((g) => g.homeTeam.conference !== g.awayTeam.conference);

    let confHomeCov = confGames.filter((g) => g.spreadResult === "COVERED").length;
    let confHomeLost = confGames.filter((g) => g.spreadResult === "LOST").length;
    let nonConfHomeCov = nonConfGames.filter((g) => g.spreadResult === "COVERED").length;
    let nonConfHomeLost = nonConfGames.filter((g) => g.spreadResult === "LOST").length;

    console.log(`  Conference games: ${confGames.length} total, home covers ${pct(confHomeCov, confHomeCov + confHomeLost)} (${confHomeCov}-${confHomeLost})`);
    console.log(`  Non-conf games: ${nonConfGames.length} total, home covers ${pct(nonConfHomeCov, nonConfHomeCov + nonConfHomeLost)} (${nonConfHomeCov}-${nonConfHomeLost})`);

    // Power vs power
    const powerVsPower = games.filter((g) =>
      powerConfs.includes(g.homeTeam.conference || "") &&
      powerConfs.includes(g.awayTeam.conference || "")
    );
    const pvpHomeCov = powerVsPower.filter((g) => g.spreadResult === "COVERED").length;
    const pvpHomeLost = powerVsPower.filter((g) => g.spreadResult === "LOST").length;
    console.log(`  Power vs Power: ${powerVsPower.length} total, home covers ${pct(pvpHomeCov, pvpHomeCov + pvpHomeLost)}`);

    // Power vs mid-major (power is home favorite)
    const powerHomeFav = games.filter((g) =>
      powerConfs.includes(g.homeTeam.conference || "") &&
      !powerConfs.includes(g.awayTeam.conference || "") &&
      g.spread !== null && g.spread < -3
    );
    const phfHomeCov = powerHomeFav.filter((g) => g.spreadResult === "COVERED").length;
    const phfHomeLost = powerHomeFav.filter((g) => g.spreadResult === "LOST").length;
    console.log(`  Power home fav (-3+) vs mid-major: ${powerHomeFav.length} total, home covers ${pct(phfHomeCov, phfHomeCov + phfHomeLost)}`);

    // ═══════════════════════════════════════════════════════════════
    // ANALYSIS 5: Home court advantage erosion
    // ═══════════════════════════════════════════════════════════════
    console.log("\n═══ HOME COURT ADVANTAGE (straight up AND ATS) ═══");
    const homeWins = games.filter((g) => g.scoreDifference > 0).length;
    const awayWins = games.filter((g) => g.scoreDifference < 0).length;
    console.log(`  Home wins SU: ${homeWins}/${games.length} (${pct(homeWins, games.length)})`);
    console.log(`  Home covers ATS: ${games.filter((g) => g.spreadResult === "COVERED").length}/${games.filter((g) => g.spreadResult !== "PUSH").length}`);

    // HCA by month
    console.log("\n  Home cover rate by month:");
    const hcaMonths: Record<string, { cov: number; lost: number }> = {};
    for (const g of games) {
      if (!g.spreadResult || g.spreadResult === "PUSH") continue;
      const month = g.gameDate.toISOString().substring(0, 7);
      if (!hcaMonths[month]) hcaMonths[month] = { cov: 0, lost: 0 };
      if (g.spreadResult === "COVERED") hcaMonths[month].cov++;
      else hcaMonths[month].lost++;
    }
    for (const [month, r] of Object.entries(hcaMonths).sort()) {
      console.log(`    ${month}: ${pct(r.cov, r.cov + r.lost)} (${r.cov}-${r.lost})`);
    }

    // ═══════════════════════════════════════════════════════════════
    // ANALYSIS 6: Rest/schedule effects
    // ═══════════════════════════════════════════════════════════════
    console.log("\n═══ REST DAYS BETWEEN GAMES ═══");

    // Build last game date per team
    const teamLastGame = new Map<string, Date>();
    const restResults: { homeDays: number; awayDays: number; spreadResult: string }[] = [];

    for (const g of games) {
      if (!g.spreadResult || g.spreadResult === "PUSH") continue;
      const homeLastDate = teamLastGame.get(g.homeTeam.name);
      const awayLastDate = teamLastGame.get(g.awayTeam.name);

      if (homeLastDate && awayLastDate) {
        const homeDays = Math.round((g.gameDate.getTime() - homeLastDate.getTime()) / 86400000);
        const awayDays = Math.round((g.gameDate.getTime() - awayLastDate.getTime()) / 86400000);
        restResults.push({ homeDays, awayDays, spreadResult: g.spreadResult });
      }

      teamLastGame.set(g.homeTeam.name, g.gameDate);
      teamLastGame.set(g.awayTeam.name, g.gameDate);
    }

    // Rest advantage: home has more rest
    const homeMoreRest = restResults.filter((r) => r.homeDays > r.awayDays + 1);
    const awayMoreRest = restResults.filter((r) => r.awayDays > r.homeDays + 1);
    const evenRest = restResults.filter((r) => Math.abs(r.homeDays - r.awayDays) <= 1);

    const hmrCov = homeMoreRest.filter((r) => r.spreadResult === "COVERED").length;
    const hmrLost = homeMoreRest.filter((r) => r.spreadResult === "LOST").length;
    const amrCov = awayMoreRest.filter((r) => r.spreadResult === "COVERED").length;
    const amrLost = awayMoreRest.filter((r) => r.spreadResult === "LOST").length;
    const evCov = evenRest.filter((r) => r.spreadResult === "COVERED").length;
    const evLost = evenRest.filter((r) => r.spreadResult === "LOST").length;

    console.log(`  Home has 2+ more rest days: home covers ${pct(hmrCov, hmrCov + hmrLost)} (${hmrCov}-${hmrLost}, n=${homeMoreRest.length})`);
    console.log(`  Away has 2+ more rest days: home covers ${pct(amrCov, amrCov + amrLost)} (${amrCov}-${amrLost}, n=${awayMoreRest.length})`);
    console.log(`  Even rest (±1 day): home covers ${pct(evCov, evCov + evLost)} (${evCov}-${evLost}, n=${evenRest.length})`);

    // Back-to-back (1 day rest)
    const homeB2B = restResults.filter((r) => r.homeDays <= 1);
    const awayB2B = restResults.filter((r) => r.awayDays <= 1);
    const hb2bCov = homeB2B.filter((r) => r.spreadResult === "COVERED").length;
    const hb2bLost = homeB2B.filter((r) => r.spreadResult === "LOST").length;
    const ab2bCov = awayB2B.filter((r) => r.spreadResult === "COVERED").length;
    const ab2bLost = awayB2B.filter((r) => r.spreadResult === "LOST").length;
    console.log(`  Home on B2B (≤1 day rest): home covers ${pct(hb2bCov, hb2bCov + hb2bLost)} (${hb2bCov}-${hb2bLost}, n=${homeB2B.length})`);
    console.log(`  Away on B2B (≤1 day rest): home covers ${pct(ab2bCov, ab2bCov + ab2bLost)} (${ab2bCov}-${ab2bLost}, n=${awayB2B.length})`);

    // ═══════════════════════════════════════════════════════════════
    // ANALYSIS 7: KenPom O/U deep dive — validate the model
    // ═══════════════════════════════════════════════════════════════
    console.log("\n═══ KENPOM O/U DEEP DIVE ═══");

    const sumDEBuckets = [
      { label: "sumDE > 215", filter: (de: number) => de > 215 },
      { label: "sumDE 210-215", filter: (de: number) => de > 210 && de <= 215 },
      { label: "sumDE 205-210", filter: (de: number) => de > 205 && de <= 210 },
      { label: "sumDE 200-205", filter: (de: number) => de > 200 && de <= 205 },
      { label: "sumDE 195-200", filter: (de: number) => de > 195 && de <= 200 },
      { label: "sumDE 190-195", filter: (de: number) => de > 190 && de <= 195 },
      { label: "sumDE 185-190", filter: (de: number) => de > 185 && de <= 190 },
      { label: "sumDE < 185", filter: (de: number) => de <= 185 },
    ];

    for (const bucket of sumDEBuckets) {
      let overs = 0, unders = 0;
      for (const g of games) {
        if (g.overUnder === null || !g.ouResult || g.ouResult === "PUSH") continue;
        const homeR = lookupRating(kenpom!, g.homeTeam.name);
        const awayR = lookupRating(kenpom!, g.awayTeam.name);
        if (!homeR || !awayR) continue;

        const sumDE = homeR.AdjDE + awayR.AdjDE;
        if (!bucket.filter(sumDE)) continue;

        if (g.ouResult === "OVER") overs++;
        else unders++;
      }
      const total = overs + unders;
      if (total > 0) {
        console.log(`  ${bucket.label}: ${overs} over, ${unders} under (${pct(overs, total)} over, n=${total})`);
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ANALYSIS 8: Rank-based ATS patterns
    // ═══════════════════════════════════════════════════════════════
    if (kenpom) {
      console.log("\n═══ KENPOM RANK-BASED ATS PATTERNS ═══");

      // Top 25 home vs everyone
      const top25Home = games.filter((g) => {
        const r = lookupRating(kenpom!, g.homeTeam.name);
        return r && r.RankAdjEM <= 25;
      });
      const t25hCov = top25Home.filter((g) => g.spreadResult === "COVERED").length;
      const t25hLost = top25Home.filter((g) => g.spreadResult === "LOST").length;
      console.log(`  Top 25 at home: ${pct(t25hCov, t25hCov + t25hLost)} cover (${t25hCov}-${t25hLost}, n=${top25Home.length})`);

      // Top 25 away vs everyone
      const top25Away = games.filter((g) => {
        const r = lookupRating(kenpom!, g.awayTeam.name);
        return r && r.RankAdjEM <= 25;
      });
      const t25aCov = top25Away.filter((g) => g.spreadResult === "LOST").length; // away covers when home loses
      const t25aLost = top25Away.filter((g) => g.spreadResult === "COVERED").length;
      console.log(`  Top 25 on road: ${pct(t25aCov, t25aCov + t25aLost)} cover (${t25aCov}-${t25aLost}, n=${top25Away.length})`);

      // Top 25 vs Top 25
      const top25VsTop25 = games.filter((g) => {
        const h = lookupRating(kenpom!, g.homeTeam.name);
        const a = lookupRating(kenpom!, g.awayTeam.name);
        return h && a && h.RankAdjEM <= 25 && a.RankAdjEM <= 25;
      });
      const t25vCov = top25VsTop25.filter((g) => g.spreadResult === "COVERED").length;
      const t25vLost = top25VsTop25.filter((g) => g.spreadResult === "LOST").length;
      console.log(`  Top 25 vs Top 25 (home covers): ${pct(t25vCov, t25vCov + t25vLost)} (${t25vCov}-${t25vLost}, n=${top25VsTop25.length})`);

      // Ranked home fav by spread size
      console.log("\n  Ranked home favorites by spread size:");
      for (const [label, minSpread, maxSpread] of [
        ["  -1 to -5", -5, 0],
        ["  -5.5 to -10", -10, -5],
        ["  -10.5 to -15", -15, -10],
        ["  -15.5+", -50, -15],
      ] as [string, number, number][]) {
        const subset = games.filter((g) => {
          const r = lookupRating(kenpom!, g.homeTeam.name);
          return r && r.RankAdjEM <= 25 && g.spread !== null && g.spread >= minSpread && g.spread < maxSpread;
        });
        const cov = subset.filter((g) => g.spreadResult === "COVERED").length;
        const lost = subset.filter((g) => g.spreadResult === "LOST").length;
        if (cov + lost > 0) {
          console.log(`    ${label}: ${pct(cov, cov + lost)} cover (${cov}-${lost}, n=${subset.length})`);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // ANALYSIS 9: Upset alert — big dogs covering
      // ═══════════════════════════════════════════════════════════════
      console.log("\n═══ BIG UNDERDOG ATS PERFORMANCE ═══");
      for (const threshold of [7, 10, 14, 17, 20]) {
        const bigDogs = games.filter((g) => g.spread !== null && g.spread >= threshold);
        const dogCov = bigDogs.filter((g) => g.spreadResult === "LOST").length; // home lost = dog covered
        const dogLost = bigDogs.filter((g) => g.spreadResult === "COVERED").length;
        console.log(`  Dogs +${threshold}+: ${pct(dogCov, dogCov + dogLost)} cover (${dogCov}-${dogLost}, n=${bigDogs.length})`);
      }

      // ═══════════════════════════════════════════════════════════════
      // ANALYSIS 10: Total points vs line — line accuracy
      // ═══════════════════════════════════════════════════════════════
      console.log("\n═══ O/U LINE ACCURACY ═══");
      const ouGames = games.filter((g) => g.overUnder !== null);
      const totalDiffs: number[] = [];
      for (const g of ouGames) {
        const actual = g.homeScore + g.awayScore;
        totalDiffs.push(actual - g.overUnder!);
      }
      totalDiffs.sort((a, b) => a - b);
      const meanDiff = totalDiffs.reduce((s, v) => s + v, 0) / totalDiffs.length;
      const medianDiff = totalDiffs[Math.floor(totalDiffs.length / 2)];
      const mae = totalDiffs.reduce((s, v) => s + Math.abs(v), 0) / totalDiffs.length;
      console.log(`  Mean actual - line: ${meanDiff.toFixed(1)}`);
      console.log(`  Median actual - line: ${medianDiff.toFixed(1)}`);
      console.log(`  MAE: ${mae.toFixed(1)}`);

      // O/U by line range
      console.log("\n  O/U by total line range:");
      for (const [label, min, max] of [
        ["< 125", 0, 125],
        ["125-134.5", 125, 135],
        ["135-144.5", 135, 145],
        ["145-154.5", 145, 155],
        ["155-164.5", 155, 165],
        ["165+", 165, 300],
      ] as [string, number, number][]) {
        const subset = ouGames.filter((g) => g.overUnder! >= min && g.overUnder! < max);
        const ov = subset.filter((g) => g.ouResult === "OVER").length;
        const un = subset.filter((g) => g.ouResult === "UNDER").length;
        if (ov + un > 0) {
          console.log(`    ${label}: ${pct(ov, ov + un)} over (${ov}-${un}, n=${subset.length})`);
        }
      }

      // ═══════════════════════════════════════════════════════════════
      // ANALYSIS 11: Combined KenPom edge + ATS momentum
      // ═══════════════════════════════════════════════════════════════
      console.log("\n═══ COMBINED SIGNALS: KENPOM EDGE + TEAM ATS SEASON ═══");

      // Build running team ATS records
      const teamATS = new Map<string, { cov: number; lost: number }>();
      const combinedResults: {
        edge: number;
        homeATSPct: number;
        awayATSPct: number;
        spreadResult: string;
        pickDirection: "home" | "away";
      }[] = [];

      for (const g of games) {
        if (!g.spreadResult || g.spreadResult === "PUSH" || g.spread === null) continue;
        const homeR = lookupRating(kenpom!, g.homeTeam.name);
        const awayR = lookupRating(kenpom!, g.awayTeam.name);

        const homeATS = teamATS.get(g.homeTeam.name) || { cov: 0, lost: 0 };
        const awayATS = teamATS.get(g.awayTeam.name) || { cov: 0, lost: 0 };

        if (homeR && awayR) {
          const edge = homeR.AdjEM - awayR.AdjEM + 2.0 + g.spread;
          const homeTotal = homeATS.cov + homeATS.lost;
          const awayTotal = awayATS.cov + awayATS.lost;

          if (homeTotal >= 5 && awayTotal >= 5) {
            const homeATSPct = homeATS.cov / homeTotal * 100;
            const awayATSPct = awayATS.cov / awayTotal * 100;

            combinedResults.push({
              edge,
              homeATSPct,
              awayATSPct,
              spreadResult: g.spreadResult,
              pickDirection: edge > 0 ? "home" : "away",
            });
          }
        }

        // Update running ATS
        if (!teamATS.has(g.homeTeam.name)) teamATS.set(g.homeTeam.name, { cov: 0, lost: 0 });
        if (!teamATS.has(g.awayTeam.name)) teamATS.set(g.awayTeam.name, { cov: 0, lost: 0 });
        const hATS = teamATS.get(g.homeTeam.name)!;
        const aATS = teamATS.get(g.awayTeam.name)!;
        if (g.spreadResult === "COVERED") { hATS.cov++; aATS.lost++; }
        else { hATS.lost++; aATS.cov++; }
      }

      // Model edge + agreeing ATS momentum
      const edgeAndATS = combinedResults.filter((r) => {
        if (r.pickDirection === "home") {
          return r.edge > 2 && r.homeATSPct > 55 && r.awayATSPct < 50;
        }
        return r.edge < -2 && r.awayATSPct > 55 && r.homeATSPct < 50;
      });
      let eaWins = 0, eaLosses = 0;
      for (const r of edgeAndATS) {
        if (r.pickDirection === "home") {
          if (r.spreadResult === "COVERED") eaWins++;
          else eaLosses++;
        } else {
          if (r.spreadResult === "LOST") eaWins++;
          else eaLosses++;
        }
      }
      console.log(`  KenPom edge > 2 + side ATS > 55% + opponent ATS < 50%:`);
      console.log(`    ${eaWins}-${eaLosses} (${pct(eaWins, eaWins + eaLosses)}, ROI: ${roi(eaWins, eaLosses)}, n=${edgeAndATS.length})`);

      // Strong model edge alone (edge > 4)
      const strongEdge = combinedResults.filter((r) => Math.abs(r.edge) > 4);
      let seWins = 0, seLosses = 0;
      for (const r of strongEdge) {
        if (r.pickDirection === "home") {
          if (r.spreadResult === "COVERED") seWins++;
          else seLosses++;
        } else {
          if (r.spreadResult === "LOST") seWins++;
          else seLosses++;
        }
      }
      console.log(`\n  KenPom edge > 4 (any ATS):`);
      console.log(`    ${seWins}-${seLosses} (${pct(seWins, seWins + seLosses)}, ROI: ${roi(seWins, seLosses)}, n=${strongEdge.length})`);

      // Strong edge + strong ATS
      const strongBoth = combinedResults.filter((r) => {
        if (r.pickDirection === "home") {
          return r.edge > 4 && r.homeATSPct > 60;
        }
        return r.edge < -4 && r.awayATSPct > 60;
      });
      let sbWins = 0, sbLosses = 0;
      for (const r of strongBoth) {
        if (r.pickDirection === "home") {
          if (r.spreadResult === "COVERED") sbWins++;
          else sbLosses++;
        } else {
          if (r.spreadResult === "LOST") sbWins++;
          else sbLosses++;
        }
      }
      console.log(`\n  KenPom edge > 4 + side ATS > 60%:`);
      console.log(`    ${sbWins}-${sbLosses} (${pct(sbWins, sbWins + sbLosses)}, ROI: ${roi(sbWins, sbLosses)}, n=${strongBoth.length})`);

      // ═══════════════════════════════════════════════════════════════
      // ANALYSIS 12: Tempo as a spread signal
      // ═══════════════════════════════════════════════════════════════
      console.log("\n═══ TEMPO MISMATCH AS SPREAD SIGNAL ═══");

      // When a fast-tempo team plays a slow-tempo team, who covers?
      const tempoGames: { tempoMismatch: number; homeTempo: number; spreadResult: string; spread: number }[] = [];
      for (const g of games) {
        if (!g.spreadResult || g.spreadResult === "PUSH" || g.spread === null) continue;
        const homeR = lookupRating(kenpom!, g.homeTeam.name);
        const awayR = lookupRating(kenpom!, g.awayTeam.name);
        if (!homeR || !awayR) continue;
        tempoGames.push({
          tempoMismatch: homeR.AdjTempo - awayR.AdjTempo,
          homeTempo: homeR.AdjTempo,
          spreadResult: g.spreadResult,
          spread: g.spread,
        });
      }

      // Home team plays faster
      const homeFaster = tempoGames.filter((g) => g.tempoMismatch > 3);
      const hfCov = homeFaster.filter((g) => g.spreadResult === "COVERED").length;
      const hfLost = homeFaster.filter((g) => g.spreadResult === "LOST").length;
      console.log(`  Home plays faster (tempo diff > 3): ${pct(hfCov, hfCov + hfLost)} cover (${hfCov}-${hfLost}, n=${homeFaster.length})`);

      const homeSlower = tempoGames.filter((g) => g.tempoMismatch < -3);
      const hsCov = homeSlower.filter((g) => g.spreadResult === "COVERED").length;
      const hsLost = homeSlower.filter((g) => g.spreadResult === "LOST").length;
      console.log(`  Home plays slower (tempo diff < -3): ${pct(hsCov, hsCov + hsLost)} cover (${hsCov}-${hsLost}, n=${homeSlower.length})`);

      // ═══════════════════════════════════════════════════════════════
      // ANALYSIS 13: Defensive efficiency mismatch for spreads
      // ═══════════════════════════════════════════════════════════════
      console.log("\n═══ OFFENSIVE vs DEFENSIVE MISMATCH ═══");

      // Home has top offense but opponent has top defense (and vice versa)
      for (const [label, homeOERank, awayDERank] of [
        ["Home top-30 OE vs Away top-30 DE", 30, 30],
        ["Home bot-100 OE vs Away top-50 DE", 250, 50],
      ] as [string, number, number][]) {
        const subset = games.filter((g) => {
          if (!g.spreadResult || g.spreadResult === "PUSH") return false;
          const homeR = lookupRating(kenpom!, g.homeTeam.name);
          const awayR = lookupRating(kenpom!, g.awayTeam.name);
          if (!homeR || !awayR) return false;
          if (label.includes("top-30 OE")) {
            return homeR.RankAdjOE <= homeOERank && awayR.RankAdjDE <= awayDERank;
          }
          return homeR.RankAdjOE >= homeOERank && awayR.RankAdjDE <= awayDERank;
        });
        const cov = subset.filter((g) => g.spreadResult === "COVERED").length;
        const lost = subset.filter((g) => g.spreadResult === "LOST").length;
        console.log(`  ${label}: home covers ${pct(cov, cov + lost)} (${cov}-${lost}, n=${subset.length})`);
      }
    }
  }

  console.log("\n=== Analysis Complete ===");
}

main()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
