#!/usr/bin/env bash
# ============================================================
# PMC Estimator — Apps Script Limits Monitor
# Run manually: bash agents/limits-monitor/check-limits.sh
# Or let the Claude session cron call it automatically.
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
ADDON_DIR="$REPO_ROOT/system-google-sheets-addon"
TRACKER="$SCRIPT_DIR/deploy-tracker.md"

# ── Limits (Google Apps Script as of 2024) ─────────────────
DEPLOY_LIMIT=20
VERSION_LIMIT=100
WARN_PCT=80   # warn when % used exceeds this

# ── Fetch live counts ───────────────────────────────────────
cd "$ADDON_DIR" || { echo "ERROR: addon dir not found"; exit 1; }

DEPLOY_RAW=$(clasp deployments 2>&1)
VERSION_RAW=$(clasp versions 2>&1)

DEPLOY_COUNT=$(echo "$DEPLOY_RAW" | grep -c "^-")
VERSION_COUNT=$(echo "$VERSION_RAW" | grep -c "^[0-9]")

DEPLOY_PCT=$(( DEPLOY_COUNT * 100 / DEPLOY_LIMIT ))
VERSION_PCT=$(( VERSION_COUNT * 100 / VERSION_LIMIT ))

TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# ── Status labels ───────────────────────────────────────────
status_label() {
  local pct=$1
  if   [ "$pct" -ge 90 ]; then echo "CRITICAL"
  elif [ "$pct" -ge "$WARN_PCT" ]; then echo "WARNING"
  else echo "OK"
  fi
}

DEPLOY_STATUS=$(status_label $DEPLOY_PCT)
VERSION_STATUS=$(status_label $VERSION_PCT)

# ── Print report ────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║   PMC Estimator — Apps Script Limits Report          ║"
echo "║   $TIMESTAMP                              ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Deployments : %2d / %2d  (%3d%%)  [%s]\n" \
  "$DEPLOY_COUNT" "$DEPLOY_LIMIT" "$DEPLOY_PCT" "$DEPLOY_STATUS"
printf "║  Versions    : %2d / %3d  (%3d%%)  [%s]\n" \
  "$VERSION_COUNT" "$VERSION_LIMIT" "$VERSION_PCT" "$VERSION_STATUS"
echo "╠══════════════════════════════════════════════════════╣"

# Latest named version
LATEST=$(echo "$VERSION_RAW" | grep "^[0-9]" | tail -1)
echo "║  Latest version: $LATEST"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  NOTE: clasp push = safe (no slots used)             ║"
echo "║        clasp deploy = consumes 1 deployment slot     ║"
echo "║        clasp version = consumes 1 version slot       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Warnings ────────────────────────────────────────────────
if [ "$DEPLOY_STATUS" != "OK" ]; then
  echo "⚠️  DEPLOYMENT SLOTS $DEPLOY_STATUS: ${DEPLOY_COUNT}/${DEPLOY_LIMIT} used."
  echo "   Run: clasp undeploy <deploymentId>  to free old slots."
fi
if [ "$VERSION_STATUS" != "OK" ]; then
  echo "⚠️  VERSION SLOTS $VERSION_STATUS: ${VERSION_COUNT}/${VERSION_LIMIT} used."
  echo "   Old versions can be viewed but not deleted via clasp."
  echo "   Plan: slow down explicit versioning; rely on git tags instead."
fi

# ── Write tracker file ──────────────────────────────────────
cat > "$TRACKER" << MARKDOWN
# PMC Estimator — Deploy Tracker

> Last checked: $TIMESTAMP

## Apps Script Limits

| Resource     | Used | Limit | % Used | Status |
|-------------|------|-------|--------|--------|
| Deployments | $DEPLOY_COUNT    | $DEPLOY_LIMIT     | $DEPLOY_PCT%     | $DEPLOY_STATUS      |
| Versions    | $VERSION_COUNT    | $VERSION_LIMIT     | $VERSION_PCT%     | $VERSION_STATUS      |

## Rules
- \`clasp push\` → updates HEAD only. **No slots consumed. Push freely.**
- \`clasp deploy\` → consumes 1 deployment slot. Use sparingly (major releases only).
- \`clasp version\` → consumes 1 version slot. Use for milestone snapshots only.

## Current Deployments
\`\`\`
$DEPLOY_RAW
\`\`\`

## Recent Versions (last 5)
\`\`\`
$(echo "$VERSION_RAW" | grep "^[0-9]" | tail -5)
\`\`\`

## Tasks for This Agent
<!-- Add new monitoring tasks below -->
- [x] Track deployment and version slot usage
- [ ] Check for unpushed git changes before deploy reminders
- [ ] Remind to tag git releases when a formal clasp version is cut
- [ ] Alert if more than 1 week passes without a git commit

## History (last 10 checks)
<!-- Updated automatically by check-limits.sh -->
- $TIMESTAMP — Deployments: $DEPLOY_COUNT/$DEPLOY_LIMIT  Versions: $VERSION_COUNT/$VERSION_LIMIT  [$DEPLOY_STATUS / $VERSION_STATUS]
MARKDOWN

echo "Tracker updated: $TRACKER"
