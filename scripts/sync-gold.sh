#!/bin/bash
# Updates the 21K gold price from this Mac (bajus.org blocks GitHub's servers).
# Uses its own clone so it never touches your working copy; commits and pushes
# public/gold.json only when the price changed, and the push redeploys the site.
# Scheduled by ~/Library/LaunchAgents/com.ahasan09.dpdc-bill-gold.plist; run it by hand any time.
set -euo pipefail
export PATH="/opt/homebrew/bin:/opt/homebrew/opt/node/bin:/usr/local/bin:/usr/bin:/bin"

DIR="$HOME/Library/Application Support/dpdc-bill-gold"
REPO="https://github.com/ahasan09/dpdc-bill.git"

echo "--- $(date '+%Y-%m-%d %H:%M:%S')"
[ -d "$DIR/.git" ] || git clone -q "$REPO" "$DIR"
cd "$DIR"
git fetch -q origin main
git reset -q --hard origin/main

node scripts/fetch-gold.ts
if git diff --quiet -- public/gold.json; then
  exit 0
fi
git commit -q -m "Update 21K gold price" -- public/gold.json
git push -q origin HEAD:main
echo "Pushed the new price; the site redeploys in about a minute."
