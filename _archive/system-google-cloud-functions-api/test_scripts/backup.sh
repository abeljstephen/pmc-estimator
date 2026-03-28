#!/bin/bash
# File: backup.sh
#
# Purpose:
# Creates a backup of the core directory under /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/archive/SAFE/
# with a directory name in the format mmddyyhhmmAMPST or mmddyyhhmmPMPST (e.g., 0828251623PMPST for August 28, 2025, 4:23 PM PDT).
# Preserves all existing subdirectories under the backup directory, avoiding any deletion.
# Provides dynamic terminal updates for each file/subdirectory copied and a final success or failure message.
# Supports the pmc-estimator project, which implements copula-based reshaping with LHS/RF/B&B optimization.
#
# Functionality:
# 1. Retrieves the current system date and time in PDT using the date command.
# 2. Formats the timestamp as mmddyyhhmmAMPST or mmddyyhhmmPMPST (e.g., 0828251623PMPST).
# 3. Creates the backup directory /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/archive/SAFE/<timestamp>.
# 4. Copies the core directory to the backup location using cp -rv for dynamic copy updates, preserving existing subdirectories.
# 5. Logs each file/subdirectory copied in real-time.
# 6. Verifies the backup and outputs a final success or failure message.
#
# Usage:
#   chmod +x backup.sh
#   ./backup.sh
#
# Notes:
# - Designed for macOS with Bash (compatible with Node.js v20.19.3 and rsync 2.6.9).
# - Uses cp -rv for dynamic copy updates due to rsync 2.6.9 lacking --info=progress2.
# - Does NOT remove existing subdirectories under $BACKUP_DIR/core to preserve data.
# - Logs success or failure with timestamps for debugging.
# - Aligns with pmc-estimator project structure, supporting files like test_process_task.js, main.js, etc.

# Set strict mode for robust error handling
set -euo pipefail

# Define base paths
BASE_DIR="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api"
CORE_DIR="$BASE_DIR/core"
ARCHIVE_DIR="$BASE_DIR/archive/SAFE"

# Get current date and time in PDT (macOS date command with TZ for Pacific Daylight Time)
# Format: mmddyyhhmmAMPST or mmddyyhhmmPMPST (e.g., 0828251623PMPST)
TIMESTAMP=$(TZ="America/Los_Angeles" date +%m%d%y%H%M%p | sed 's/AM/AMPST/' | sed 's/PM/PMPST/')
BACKUP_DIR="$ARCHIVE_DIR/$TIMESTAMP"

# Log function for consistent output with timestamps
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S %Z')] $1"
}

# Check if core directory exists
if [ ! -d "$CORE_DIR" ]; then
  log "ERROR: Core directory $CORE_DIR does not exist"
  exit 1
fi

# Create archive directory
log "Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

# Copy core directory to backup location with verbose output for dynamic updates
log "Copying $CORE_DIR to $BACKUP_DIR/core"
cp -rv "$CORE_DIR" "$BACKUP_DIR/core" | while IFS= read -r line; do
  log "Copying: $line"
done

# Verify backup
if [ -d "$BACKUP_DIR/core" ]; then
  log "Backup successfully created at $BACKUP_DIR/core"
  ls -l "$BACKUP_DIR/core" | while read -r line; do
    log "Backup contents: $line"
  done
  log "Backup process completed successfully"
  exit 0
else
  log "ERROR: Failed to create backup at $BACKUP_DIR/core"
  exit 1
fi
