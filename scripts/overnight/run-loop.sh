#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="$HOME/trendline"
cd "$REPO_DIR"
PROMPT_FILE="$REPO_DIR/scripts/overnight/PERF_PROMPT.md"
BENCHMARK_SCRIPT="$REPO_DIR/scripts/overnight/benchmark.sh"
RESULTS_DIR="$REPO_DIR/perf-results/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"
git checkout experimental
git pull origin experimental 2>/dev/null || true

log()  { echo "[$(date +%H:%M:%S)] $*"; }
ok()   { echo "[$(date +%H:%M:%S)] ok $*"; }
fail() { echo "[$(date +%H:%M:%S)] FAIL $*"; }

bash "$BENCHMARK_SCRIPT" "$REPO_DIR" > "$RESULTS_DIR/baseline.json"
BASELINE_BUILD=$(jq -r .build_time_seconds "$RESULTS_DIR/baseline.json")
BASELINE_BUNDLE=$(jq -r .total_bundle_kb "$RESULTS_DIR/baseline.json")
BEST_BUILD="$BASELINE_BUILD"
BEST_BUNDLE="$BASELINE_BUNDLE"
i=0
IMPROVEMENTS=0
REVERTS=0

log "Baseline: Build ${BASELINE_BUILD}s | Bundle ${BASELINE_BUNDLE}KB"

while true; do
  i=$((i + 1))
  echo "=== Iteration $i ==="
  mkdir -p "$RESULTS_DIR/iter-$i"
  PRE_SHA=$(git rev-parse HEAD)
  CONTEXT="Iteration $i. Build: ${BEST_BUILD}s. Bundle: ${BEST_BUNDLE}KB. Improvements: $IMPROVEMENTS, Reverts: $REVERTS."

  claude -p "$(cat "$PROMPT_FILE")

---
$CONTEXT" --output-format text --max-turns 15 > "$RESULTS_DIR/iter-$i/claude.txt" 2>&1 || true
  ok "Claude Code finished"

  CHANGED=$(git diff --name-only -- src/ | wc -l | tr -d ' ')
  if [ "$CHANGED" -eq "0" ]; then
    fail "No src/ files changed. Reverting."
    git checkout -- . && git clean -fd -- src/
    REVERTS=$((REVERTS + 1))
    continue
  fi

  NEW_FILES=$(git ls-files --others --exclude-standard -- . | grep -v '^src/' | grep -v '^perf-results/' | grep -v '^scripts/overnight/' || true)
  if [ -n "$NEW_FILES" ]; then
    echo "$NEW_FILES" | xargs rm -f 2>/dev/null || true
  fi

  npm run build > "$RESULTS_DIR/iter-$i/build.txt" 2>&1 || {
    fail "Build failed. Reverting."
    git checkout -- . && git clean -fd -- src/ && git reset --hard "$PRE_SHA"
    REVERTS=$((REVERTS + 1))
    continue
  }

  bash "$BENCHMARK_SCRIPT" "$REPO_DIR" > "$RESULTS_DIR/iter-$i/bench.json"
  NEW_BUILD=$(jq -r .build_time_seconds "$RESULTS_DIR/iter-$i/bench.json")
  NEW_BUNDLE=$(jq -r .total_bundle_kb "$RESULTS_DIR/iter-$i/bench.json")
  BUILD_BETTER=$(awk "BEGIN {print ($BEST_BUILD - $NEW_BUILD) / $BEST_BUILD * 100}")
  BUNDLE_BETTER=$(awk "BEGIN {print ($BEST_BUNDLE - $NEW_BUNDLE) / $BEST_BUNDLE * 100}")

  if awk "BEGIN {exit !($BUILD_BETTER > 1.5 || $BUNDLE_BETTER > 1.5)}"; then
    ok "Improved! Build ${BUILD_BETTER}% Bundle ${BUNDLE_BETTER}%"
    git add -- src/
    git commit -m "perf(loop-$i): build ${BUILD_BETTER}%, bundle ${BUNDLE_BETTER}%"
    BEST_BUILD="$NEW_BUILD"
    BEST_BUNDLE="$NEW_BUNDLE"
    IMPROVEMENTS=$((IMPROVEMENTS + 1))
  else
    fail "No significant improvement. Reverting."
    git checkout -- . && git clean -fd -- src/ && git reset --hard "$PRE_SHA"
    REVERTS=$((REVERTS + 1))
  fi

  log "Score: $IMPROVEMENTS kept, $REVERTS reverted"
done
