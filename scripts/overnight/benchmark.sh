#!/usr/bin/env bash
set -euo pipefail
REPO_DIR="${1:-$(pwd)}"
cd "$REPO_DIR"
BUILD_START=$(date +%s)
npm run build >/dev/null 2>&1
BUILD_END=$(date +%s)
BUILD_TIME_S=$((BUILD_END - BUILD_START))
TOTAL_NEXT_KB=0
if [ -d ".next" ]; then
  TOTAL_NEXT_KB=$(du -sk .next 2>/dev/null | cut -f1)
fi
JS_BUNDLE_KB=0
if [ -d ".next/static" ]; then
  JS_BUNDLE_KB=$(find .next/static -name '*.js' -exec du -sk {} + 2>/dev/null | awk '{s+=$1} END {print s+0}')
fi
echo "{"
echo "  \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
echo "  \"build_time_seconds\": $BUILD_TIME_S,"
echo "  \"total_bundle_kb\": $TOTAL_NEXT_KB,"
echo "  \"js_bundle_kb\": $JS_BUNDLE_KB"
echo "}"
