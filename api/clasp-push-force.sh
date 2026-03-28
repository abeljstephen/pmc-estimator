#!/bin/bash
# File: clasp-push-force.sh
#
# Purpose:
#   - Force-pushes ONLY the desired files/folders to Apps Script using clasp --files
#   - Hardcodes the exact list of what to push (no .claspignore needed)
#   - Uses paths relative to this script's location (safe across directory renames/moves)
#   - Checks login, shows what will be pushed, confirms before force
#
# Project Info (hardcoded for reference):
#   Script ID:          1O1lerl7umTJb9at87fOQFVFWOVzXI31QzB3itGH2FiFaceGPr7Zd7AzO
#   Project name:       PMC Estimator
#   Project number:     615922754202
#   Project ID:         pmc-estimator
#
# Usage:
#   chmod +x clasp-push-force.sh
#   ./clasp-push-force.sh   (from any directory — paths are resolved relative to this script)

set -euo pipefail

# ────────────────────────────────────────────────
# CONFIG — paths resolved relative to this script's location
# (safe to rename or move the parent directory)
# ────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
CLASP_PROJECT_DIR="$PROJECT_ROOT"

# ────────────────────────────────────────────────
# Hardcoded list: ONLY these files/folders will be pushed
# Add/remove items here if project structure changes
# ────────────────────────────────────────────────
ALLOWED_PUSH_ITEMS=(
  "$PROJECT_ROOT/appsscript.json"
  "$PROJECT_ROOT/Code.gs"
  "$PROJECT_ROOT/Plot.html"
  "$PROJECT_ROOT/webapp.gs"           # Custom GPT web app entry point
  "$PROJECT_ROOT/core"                # pushes entire core/ folder + all subfiles
)

# ────────────────────────────────────────────────
# Safety checks
# ────────────────────────────────────────────────
if [ ! -d "$PROJECT_ROOT" ]; then
  echo "ERROR: Project root not found: $PROJECT_ROOT"
  exit 1
fi

if [ ! -f "$CLASP_PROJECT_DIR/.clasp.json" ]; then
  echo "ERROR: Not a clasp project — missing .clasp.json in $CLASP_PROJECT_DIR"
  echo "Run:"
  echo "  clasp login"
  echo "  clasp clone 1O1lerl7umTJb9at87fOQFVFWOVzXI31QzB3itGH2FiFaceGPr7Zd7AzO"
  exit 1
fi

# Check that all allowed items exist
for item in "${ALLOWED_PUSH_ITEMS[@]}"; do
  if [ ! -e "$item" ]; then
    echo "WARNING: Allowed push item missing: $item"
  fi
done

# ────────────────────────────────────────────────
# Check clasp login status
# ────────────────────────────────────────────────
echo "Checking clasp login status..."
clasp login --status || {
  echo "Not logged in. Opening browser for login..."
  clasp login
}

# ────────────────────────────────────────────────
# Show what will be pushed (explicit list + clasp status)
# ────────────────────────────────────────────────
echo ""
echo "Files/Folders that WILL be pushed (hardcoded in script):"
for item in "${ALLOWED_PUSH_ITEMS[@]}"; do
  echo "  - $item"
done
echo ""
echo "Full clasp tracked files (for reference):"
clasp status
echo ""

# ────────────────────────────────────────────────
# Confirm before force push
# ────────────────────────────────────────────────
read -p "Are you sure you want to FORCE PUSH only the above files to Apps Script? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Push cancelled."
  exit 0
fi

# ────────────────────────────────────────────────
# Execute force push with explicit --files list
# ────────────────────────────────────────────────
echo ""
echo "Starting clasp push --force from: $CLASP_PROJECT_DIR"
cd "$CLASP_PROJECT_DIR" || { echo "Failed to cd to $CLASP_PROJECT_DIR"; exit 1; }

# Build --files argument (space-separated list)
FILES_ARG=""
for item in "${ALLOWED_PUSH_ITEMS[@]}"; do
  # Convert to relative path (clasp expects relative to project root)
  rel_item="${item#$PROJECT_ROOT/}"
  if [ -e "$item" ]; then
    FILES_ARG="$FILES_ARG $rel_item"
  fi
done

# Run push with explicit files
clasp push --force $FILES_ARG

# ────────────────────────────────────────────────
# Final status
# ────────────────────────────────────────────────
if [ $? -eq 0 ]; then
  echo ""
  echo "SUCCESS: Force push completed (only hardcoded files/folders)."
  echo "Refresh Apps Script editor to see changes."
  echo "Updated files should include:"
  echo "  - Code.gs"
  echo "  - Plot.html"
  echo "  - core/baseline/coordinator.gs (with CI & KL)"
  echo "  - core/main/main.gs (with sensitivity & fallback)"
  echo "  - core/optimization/optimizer.gs (with relaxed maxDiv)"
else
  echo ""
  echo "ERROR: clasp push failed. Check output above."
  echo "Common fixes:"
  echo "  - Re-run 'clasp login'"
  echo "  - Verify .clasp.json has Script ID: 1O1lerl7umTJb9at87fOQFVFWOVzXI31QzB3itGH2FiFaceGPr7Zd7AzO"
fi
