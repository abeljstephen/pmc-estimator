#!/bin/bash
# File: backup.sh
#
# Purpose:
#   - Creates a timestamped backup of ONLY the specified files/folders
#   - Backup folder format: addon_MM-DD-YYYY_HH-MM-SS
#     (e.g., addon_01-22-2026_16-45-30)
#   - Saves backups directly under ./archive/<timestamp>/
#     (no extra /SAFE/ subfolder)
#   - You control exactly what gets backed up via the BACKUP_ITEMS array below
#   - Automatically excludes anything not listed (e.g. archive/, scripts, logs)
#   - Shows real-time copy progress and final verification
#
# Usage:
#   cd /Users/abeljstephen/pmc-estimator/system-google-sheets-addon
#   chmod +x backup.sh
#   ./backup.sh

set -euo pipefail

# ────────────────────────────────────────────────
# CONFIG — FULL PATHS
# ────────────────────────────────────────────────
ROOT_DIR="/Users/abeljstephen/pmc-estimator/system-google-sheets-addon"
ARCHIVE_DIR="$ROOT_DIR/archive"

# ────────────────────────────────────────────────
# Hardcoded list: ONLY these files/folders will be backed up
# Add/remove items here as needed — full absolute paths
# ────────────────────────────────────────────────
BACKUP_ITEMS=(
  "$ROOT_DIR/appsscript.json"
  "$ROOT_DIR/Code.gs"
  "$ROOT_DIR/Plot.html"
  "$ROOT_DIR/core"                # entire core/ folder + all contents
  # Add more if needed, e.g.:
  # "$ROOT_DIR/testCoreCall.gs"
  # "$ROOT_DIR/some-other-file.gs"
  # "$ROOT_DIR/another-folder/"
)

# ────────────────────────────────────────────────
# Get legible timestamp: MM-DD-YYYY_HH-MM-SS (24-hour, padded zeros)
# ────────────────────────────────────────────────
TIMESTAMP=$(TZ="America/Los_Angeles" date +"%m-%d-%Y_%H-%M-%S")
BACKUP_DIR="$ARCHIVE_DIR/addon_$TIMESTAMP"

# ────────────────────────────────────────────────
# Log function
# ────────────────────────────────────────────────
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $1"
}

# ────────────────────────────────────────────────
# Create archive directory if needed
# ────────────────────────────────────────────────
log "Creating archive directory if needed: $ARCHIVE_DIR"
mkdir -p "$ARCHIVE_DIR"

# ────────────────────────────────────────────────
# Create backup directory
# ────────────────────────────────────────────────
log "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# ────────────────────────────────────────────────
# Copy only the specified items
# ────────────────────────────────────────────────
log "Backing up selected items to: $BACKUP_DIR/addon"

for item in "${BACKUP_ITEMS[@]}"; do
  if [ -e "$item" ]; then
    # Get relative path for logging
    rel_item="${item#$ROOT_DIR/}"
    log "Copying: $rel_item"
    cp -Rv "$item" "$BACKUP_DIR/addon/" | while IFS= read -r line; do
      log "  → $line"
    done
  else
    log "WARNING: Item not found, skipping: $item"
  fi
done

# ────────────────────────────────────────────────
# Verify backup
# ────────────────────────────────────────────────
if [ -d "$BACKUP_DIR/addon" ]; then
  log "Backup successfully created at $BACKUP_DIR/addon"
  ls -l "$BACKUP_DIR/addon" | while read -r line; do
    log "Backup contents: $line"
  done
  log "Backup process completed successfully"
  exit 0
else
  log "ERROR: Failed to create backup at $BACKUP_DIR/addon"
  exit 1
fi
