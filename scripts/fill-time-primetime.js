/**
 * Fill Time & Primetime Gaps — Phase 1, Cycles 43-48
 *
 * 1. kickoffTime: 455 missing → use day-of-week heuristics
 * 2. Primetime classification: verify/enhance based on day + time
 * 3. scoreDifference: verify it's always homeScore - awayScore (signed)
 */

const fs = require("fs");
const path = require("path");

const dataPath = path.join(__dirname, "../data/nfl-games-staging.json");
const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));

let timesFilled = 0;
let primetimeFixed = 0;
let scoreDiffFixed = 0;

for (const game of data) {
  // ─── 1. Fill missing kickoff times with heuristics ──────────────────────

  if (game.kickoffTime === null || game.kickoffTime === undefined || game.kickoffTime === "") {
    // Use day-of-week heuristics for pre-1978 games
    switch (game.dayOfWeek) {
      case "Sun":
        game.kickoffTime = "1:00PM";
        break;
      case "Mon":
        game.kickoffTime = "9:00PM";
        break;
      case "Sat":
        game.kickoffTime = "1:00PM";
        break;
      case "Thu":
        game.kickoffTime = "8:15PM";
        break;
      case "Fri":
        game.kickoffTime = "8:00PM";
        break;
      default:
        game.kickoffTime = "1:00PM";
    }
    timesFilled++;
  }

  // ─── 2. Primetime classification ────────────────────────────────────────

  // Any Monday game is MNF
  if (game.dayOfWeek === "Mon" && game.isPrimetime === false) {
    game.isPrimetime = true;
    if (game.primetimeSlot === null) game.primetimeSlot = "MNF";
    primetimeFixed++;
  }

  // Thursday games post-2006 are TNF
  if (game.dayOfWeek === "Thu" && game.season >= 2006 && game.isPrimetime === false) {
    game.isPrimetime = true;
    if (game.primetimeSlot === null) game.primetimeSlot = "TNF";
    primetimeFixed++;
  }

  // Sunday 8PM+ games are SNF (check time string)
  if (game.dayOfWeek === "Sun" && game.kickoffTime) {
    const time = game.kickoffTime.toUpperCase();
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/);
    if (match) {
      let hour = parseInt(match[1]);
      const ampm = match[3];
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (hour >= 20 && game.isPrimetime === false) {
        game.isPrimetime = true;
        if (game.primetimeSlot === null) game.primetimeSlot = "SNF";
        primetimeFixed++;
      }
    }
  }

  // Saturday evening games in December/January
  if (game.dayOfWeek === "Sat") {
    const time = (game.kickoffTime || "").toUpperCase();
    const match = time.match(/(\d+):(\d+)\s*(AM|PM)?/);
    if (match) {
      let hour = parseInt(match[1]);
      const ampm = match[3];
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (hour >= 20 && game.isPrimetime === false) {
        game.isPrimetime = true;
        if (game.primetimeSlot === null) game.primetimeSlot = "Saturday Primetime";
        primetimeFixed++;
      }
    }
  }

  // ─── 3. Score difference verification ───────────────────────────────────

  const expectedDiff = game.homeScore - game.awayScore;
  if (game.scoreDifference !== expectedDiff) {
    game.scoreDifference = expectedDiff;
    scoreDiffFixed++;
  }
}

// ─── Save ─────────────────────────────────────────────────────────────────

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

console.log("Fill Time & Primetime Gaps Complete");
console.log(`  Kickoff times filled:    ${timesFilled}`);
console.log(`  Primetime fixes:         ${primetimeFixed}`);
console.log(`  Score diff corrections:  ${scoreDiffFixed}`);

// Stats
const noPrimetime = data.filter((g) => g.isPrimetime === false);
const yesPrimetime = data.filter((g) => g.isPrimetime === true);
console.log(`\n  Total primetime games:   ${yesPrimetime.length}`);
console.log(`  Total non-primetime:     ${noPrimetime.length}`);

// Primetime by slot
const bySlot = {};
for (const g of yesPrimetime) {
  const slot = g.primetimeSlot || "Unknown";
  bySlot[slot] = (bySlot[slot] || 0) + 1;
}
console.log("\n  Primetime by slot:");
Object.entries(bySlot)
  .sort((a, b) => b[1] - a[1])
  .forEach(([s, n]) => console.log(`    ${s}: ${n}`));

// Missing kickoff times
const noTime = data.filter(
  (g) => g.kickoffTime === null || g.kickoffTime === undefined || g.kickoffTime === ""
);
console.log(`\n  Games still missing kickoff time: ${noTime.length}`);
