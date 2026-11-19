#!/bin/sh
# Runs the six visual sweeps, one at a time, and keeps the current build's
# artifacts apart from the pre-repair baseline's.
#
#   scripts/audit-sweeps.sh
#
# The machine has about 1.5 GB free, so two Chromium sweeps at once is what
# brought the previous runs down. One at a time, and each one survives a
# browser that dies.

set -e
cd "$(dirname "$0")/.."

CHROME=${CHROME_PATH:-/home/mrx/.local/bin/chromium}
CURRENT=${CURRENT_BASE:-http://127.0.0.1:4180}
BASELINE=${BASELINE_BASE:-http://127.0.0.1:4181}

run() {
  base=$1
  out=$2
  variant=$3
  echo "=== $variant -> $out ($base) ==="
  CHROME_PATH=$CHROME node scripts/visual-audit.mjs \
    --base "$base" --out "$out" --variant "$variant" \
    > "/tmp/sweep-${out##*/}-${variant}.log" 2>&1 || true
  tail -20 "/tmp/sweep-${out##*/}-${variant}.log"
}

run "$CURRENT"  artifacts/visual-audit/current light
run "$CURRENT"  artifacts/visual-audit/current dark
run "$CURRENT"  artifacts/visual-audit/current bn
run "$BASELINE" artifacts/visual-audit/baseline light
run "$BASELINE" artifacts/visual-audit/baseline dark
run "$BASELINE" artifacts/visual-audit/baseline bn

echo "=== all sweeps done ==="
