#!/usr/bin/env bash
# Fetches every file listed in the local sources list. Skips files already present.
# Usage: scripts/download-tabs.sh [sources.csv] [outdir]
set -euo pipefail
cd "$(dirname "$0")/.."
CSV="${1:-collection/sources.csv}"; OUT="${2:-collection/tabs}"
mkdir -p "$OUT"
python3 -c 'import csv,sys
for r in csv.DictReader(open(sys.argv[1],encoding="utf-8")): print(r["url"]+"\t"+r["filename"])' "$CSV" |
tr -d "\r" |
while IFS=$'\t' read -r url fn; do
  [ -s "$OUT/$fn" ] && continue
  echo "-> $fn"
  curl -sSfL --retry 3 -o "$OUT/$fn" "$url" || echo "FAILED: $url" >&2
  sleep 0.5
done
