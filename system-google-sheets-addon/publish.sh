#!/bin/bash
# File: publish.sh
#
# Purpose:
#   - Runs the full QA gate (tests/qa-publish.js) before any publish
#   - If QA passes, prompts to deploy via clasp push + clasp deploy
#   - Supports --dry-run to run QA only (no clasp checks or deploy)
#   - Increments version in tests/version.json after successful deploy
#
# Usage:
#   cd /Users/abeljstephen/pmc-estimator/system-google-sheets-addon
#   chmod +x publish.sh
#   ./publish.sh              # full QA + deploy
#   ./publish.sh --dry-run    # QA only, no clasp

set -euo pipefail

# ────────────────────────────────────────────────
# CONFIG
# ────────────────────────────────────────────────
PROJECT_ROOT="/Users/abeljstephen/pmc-estimator/system-google-sheets-addon"
VERSION_FILE="$PROJECT_ROOT/tests/version.json"
DEPLOYMENT_ID="AKfycbxh-bGMgpwMTyGEnmFYs3M9D-bfLxdoFZe2IDrYXmU"

# ────────────────────────────────────────────────
# Parse args
# ────────────────────────────────────────────────
DRY_RUN=""
for arg in "$@"; do
  if [ "$arg" = "--dry-run" ]; then
    DRY_RUN="--dry-run"
  fi
done

# ────────────────────────────────────────────────
# Step 1: Run QA Gate
# ────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════"
echo "  Step 1: Running QA Gate..."
echo "═══════════════════════════════════════════════"
echo ""

node "$PROJECT_ROOT/tests/qa-publish.js" $DRY_RUN
QA_EXIT=$?

if [ $QA_EXIT -ne 0 ]; then
  echo ""
  echo "QA FAILED — aborting publish."
  exit 1
fi

# If dry-run, stop here
if [ -n "$DRY_RUN" ]; then
  echo ""
  echo "Dry run complete — no deploy performed."
  exit 0
fi

# ────────────────────────────────────────────────
# Step 2: Read current version
# ────────────────────────────────────────────────
if [ -f "$VERSION_FILE" ]; then
  CURRENT_VERSION=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$VERSION_FILE','utf8')).version)")
else
  CURRENT_VERSION=1
fi
NEXT_VERSION=$((CURRENT_VERSION))

echo ""
echo "═══════════════════════════════════════════════"
echo "  Step 2: Deploy (version $NEXT_VERSION)"
echo "═══════════════════════════════════════════════"
echo ""

# ────────────────────────────────────────────────
# Step 3: Confirm deploy
# ────────────────────────────────────────────────
read -p "QA passed. Deploy version $NEXT_VERSION to Apps Script? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Deploy cancelled."
  exit 0
fi

# ────────────────────────────────────────────────
# Step 4: Backup
# ────────────────────────────────────────────────
echo ""
echo "Creating backup..."
if [ -f "$PROJECT_ROOT/backup.sh" ]; then
  bash "$PROJECT_ROOT/backup.sh"
else
  echo "  (backup.sh not found — skipping backup)"
fi

# ────────────────────────────────────────────────
# Step 5: Push + Deploy
# ────────────────────────────────────────────────
echo ""
echo "Pushing to Apps Script..."
cd "$PROJECT_ROOT"
clasp push --force

echo ""
echo "Creating deployment version $NEXT_VERSION..."
clasp deploy -i "$DEPLOYMENT_ID" -d "v$NEXT_VERSION — QA gate passed"

# ────────────────────────────────────────────────
# Step 6: Update version.json
# ────────────────────────────────────────────────
TIMESTAMP=$(TZ="America/Los_Angeles" date -u +"%Y-%m-%dT%H:%M:%SZ")
node -e "
  const fs = require('fs');
  const f = '$VERSION_FILE';
  const v = JSON.parse(fs.readFileSync(f, 'utf8'));
  v.version = $NEXT_VERSION + 1;
  v.lastPublished = '$TIMESTAMP';
  fs.writeFileSync(f, JSON.stringify(v, null, 2) + '\n');
  console.log('Updated version.json: next version will be ' + v.version);
"

echo ""
echo "═══════════════════════════════════════════════"
echo "  SUCCESS: Deployed version $NEXT_VERSION"
echo "═══════════════════════════════════════════════"
echo ""
echo "Refresh Apps Script editor to see changes."
echo "Marketplace users will get the update automatically."
