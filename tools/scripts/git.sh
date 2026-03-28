#!/usr/bin/env bash

ROOT="/Users/abeljstephen/pmc-estimator"

# Define directories (relative to ROOT)
DIRS=(
  "."
  "api"
  "engines/cpm-browser"
  "engines/saco-browser"
  "plot"
  "integrations/wordpress"
  "integrations/gpt"
  "agents"
  "docs"
  "tools"
  "_archive"
)

echo "==============================================="
echo " 📝 Select Directories to Work In (enter numbers separated by spaces):"
echo "==============================================="
for i in "${!DIRS[@]}"; do
  NAME="${DIRS[$i]}"
  if [[ "$NAME" == "." ]]; then
    NAME="[ROOT PROJECT DIRECTORY]"
  fi
  echo "$((i+1))) $NAME"
done

echo "👉 Example: 1 3 6"
read -r -p "Your choice: " DIR_SELECTION

if [[ -z "$DIR_SELECTION" ]]; then
  echo "❌ No directories selected. Exiting."
  exit 0
fi

# Build list of selected directories
SELECTED_DIRS=()
for num in $DIR_SELECTION; do
  idx=$((num-1))
  if [[ -z "${DIRS[$idx]}" ]]; then
    echo "⚠️ Invalid directory number: $num. Skipping."
    continue
  fi
  SELECTED_DIRS+=("${DIRS[$idx]}")
done

if [[ ${#SELECTED_DIRS[@]} -eq 0 ]]; then
  echo "❌ No valid directories selected. Exiting."
  exit 0
fi

ALL_SELECTED_FILES=()

# Stay in root directory
cd "$ROOT" || exit 1

for DIR in "${SELECTED_DIRS[@]}"; do
  echo "-----------------------------------------------"
  echo "📂 Checking: $DIR"

  # Collect changed files in this directory
  FILES=()
  while IFS= read -r line; do
    FILE=$(echo "$line" | awk '{print $2}')
    # Only include files inside this directory
    if [[ "$FILE" == "$DIR"* ]] || ([[ "$DIR" == "." ]] && [[ "$FILE" != */* ]]); then
      FILES+=("$FILE")
    fi
  done < <(git status --porcelain)

  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "✅ No changes in this directory."
    continue
  fi

  echo "🔹 Select files to stage in $DIR:"
  for i in "${!FILES[@]}"; do
    echo "$((i+1))) ${FILES[$i]}"
  done

  echo "👉 Enter numbers separated by spaces (or leave empty to skip):"
  read -r -p "Your choice: " FILE_SELECTION

  if [[ -z "$FILE_SELECTION" ]]; then
    echo "⏭️  Skipping this directory."
    continue
  fi

  for num in $FILE_SELECTION; do
    idx=$((num-1))
    if [[ -z "${FILES[$idx]}" ]]; then
      echo "⚠️ Invalid file number: $num. Skipping."
      continue
    fi
    ALL_SELECTED_FILES+=("${FILES[$idx]}")
  done
done

if [[ ${#ALL_SELECTED_FILES[@]} -eq 0 ]]; then
  echo "❌ No files selected to commit. Exiting."
  exit 0
fi

echo "-----------------------------------------------"
echo "✅ Summary of files to commit:"
for FILE in "${ALL_SELECTED_FILES[@]}"; do
  echo "📄 $FILE"
done

echo "-----------------------------------------------"
echo "🚀 Ready to add, commit, and push?"
echo "1) Yes, proceed"
echo "2) Cancel"
read -r -p "Your choice: " CONFIRM

if [[ "$CONFIRM" != "1" ]]; then
  echo "❌ Operation cancelled."
  exit 0
fi

echo "✏️ Enter commit message:"
read -r MESSAGE

if [[ -z "$MESSAGE" ]]; then
  echo "❌ No commit message entered. Exiting."
  exit 0
fi

# Add files
for FILE in "${ALL_SELECTED_FILES[@]}"; do
  echo "➕ Adding: $FILE"
  git add "$FILE"
done

git commit -m "$MESSAGE"
git push

echo "-----------------------------------------------"
echo "🌐 Deploy using deploy.sh script?"
echo "1) Yes"
echo "2) No"
read -r -p "Your choice: " DEPLOY

if [[ "$DEPLOY" == "1" ]]; then
  DEPLOY_SCRIPT_PATH="$ROOT/_archive/deploy.sh"
  if [[ -f "$DEPLOY_SCRIPT_PATH" ]]; then
    echo "🚀 Running deploy.sh..."
    bash "$DEPLOY_SCRIPT_PATH"
  else
    echo "❌ deploy.sh not found at $DEPLOY_SCRIPT_PATH"
    exit 1
  fi
else
  echo "✅ Skipped deploy."
fi

echo "🎉 All done!"

