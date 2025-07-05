#!/bin/bash

# cloud_deploy.sh
# Script to deploy the pmcEstimatorAPI Cloud Function and optionally verify JSON data flow with dynamic piece selection
# Project: pmc-estimator
# Project Number: 615922754202
# Cloud Function: pmcEstimatorAPI
# Cloud Web App URL: https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI
# Region: us-central1
# Billing Account: billingAccounts/010656-5E1AC1-335B03

# Exit on any error
set -e

# Configuration
PROJECT_ID="pmc-estimator"
PROJECT_NUMBER="615922754202"
FUNCTION_NAME="pmcEstimatorAPI"
REGION="us-central1"
SOURCE_DIR="system-google-cloud-functions-api"
TEST_PAYLOAD='[{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000}]'
SERVICE_URL="https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment of ${FUNCTION_NAME} to Cloud Functions for project ${PROJECT_ID} (${PROJECT_NUMBER})...${NC}"
echo -e "${YELLOW}Cloud Functions URL: ${SERVICE_URL}${NC}"
echo -e "${YELLOW}Current date and time: $(date) ${NC}"

# Step 1: Verify Google Cloud Project Setup
echo -e "${YELLOW}1. Verifying Google Cloud project setup...${NC}"
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  echo -e "${GREEN}Setting project to ${PROJECT_ID}${NC}"
  gcloud config set project "$PROJECT_ID"
else
  echo -e "${GREEN}Project is already set to ${PROJECT_ID}${NC}"
fi

# Step 2: Verify Billing
echo -e "${YELLOW}2. Verifying billing status...${NC}"
BILLING_RAW=$(gcloud billing projects describe "$PROJECT_ID" --format=json)
echo -e "${YELLOW}Raw billing output: ${BILLING_RAW}${NC}"
BILLING_ENABLED=$(echo "$BILLING_RAW" | jq -r '.billingEnabled')
if [ "$BILLING_ENABLED" != "true" ]; then
  echo -e "${RED}Error: Billing is not enabled for project ${PROJECT_ID}. Please enable billing in the Google Cloud Console.${NC}"
  exit 1
else
  BILLING_ACCOUNT=$(echo "$BILLING_RAW" | jq -r '.billingAccountName')
  echo -e "${GREEN}Billing is enabled with account ${BILLING_ACCOUNT}${NC}"
fi

# Step 3: Check Authentication
echo -e "${YELLOW}3. Checking authentication...${NC}"
if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
  echo -e "${GREEN}Active credentials found for ${USER_EMAIL}${NC}"
else
  echo -e "${YELLOW}No active credentials found. Authenticating...${NC}"
  gcloud auth login --brief --quiet
  USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
  if [ -z "$USER_EMAIL" ]; then
    echo -e "${RED}Error: Authentication failed. Please run 'gcloud auth login' manually.${NC}"
    exit 1
  fi
fi

# Step 4: Enable Required APIs
echo -e "${YELLOW}4. Enabling required APIs...${NC}"
REQUIRED_APIS=(
  "cloudfunctions.googleapis.com"
  "cloudbuild.googleapis.com"
  "artifactregistry.googleapis.com"
  "containerregistry.googleapis.com"
  "eventarc.googleapis.com"
)
for API in "${REQUIRED_APIS[@]}"; do
  if gcloud services list --enabled --project="$PROJECT_ID" --format="value(config.name)" | grep -q "$API"; then
    echo -e "${GREEN}${API} is already enabled${NC}"
  else
    echo -e "${GREEN}Enabling ${API}...${NC}"
    gcloud services enable "$API" --project="$PROJECT_ID"
  fi
done

# Step 5: Set Permissions
echo -e "${YELLOW}5. Ensuring necessary IAM roles...${NC}"
ROLES=(
  "roles/cloudfunctions.admin"
  "roles/storage.admin"
)
for ROLE in "${ROLES[@]}"; do
  if gcloud projects get-iam-policy "$PROJECT_ID" --format="json" | jq -e ".bindings[] | select(.role==\"${ROLE}\" and .members[]==\"user:${USER_EMAIL}\")" >/dev/null; then
    echo -e "${GREEN}${ROLE} already assigned to ${USER_EMAIL}${NC}"
  else
    echo -e "${GREEN}Assigning ${ROLE} to ${USER_EMAIL}...${NC}"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" \
      --member="user:${USER_EMAIL}" \
      --role="$ROLE"
  fi
done

# Step 6: Verify Application Code
echo -e "${YELLOW}6. Verifying application code...${NC}"
INDEX_FILE="${SOURCE_DIR}/index.js"
if [ ! -f "$INDEX_FILE" ]; then
  echo -e "${RED}Error: ${INDEX_FILE} not found in ${SOURCE_DIR}${NC}"
  exit 1
fi

  if ! grep -Eq 'exports\.pmcEstimatorAPI|module\.exports\s*=' "$INDEX_FILE"; then
echo -e "${RED}Error: index.js does not export pmcEstimatorAPI. Update to exports.pmcEstimatorAPI = (req, res) => {...}${NC}"
  exit 1
fi
echo -e "${GREEN}${INDEX_FILE} configuration looks good${NC}"

# Step 7: Verify Dependencies
echo -e "${YELLOW}7. Verifying dependencies...${NC}"
PACKAGE_JSON="${SOURCE_DIR}/package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
  echo -e "${YELLOW}Creating a minimal package.json...${NC}"
  cat <<EOF > "$PACKAGE_JSON"
{
  "name": "pmc-estimator-api",
  "version": "1.0.0",
  "main": "index.js",
  "dependencies": {
    "@google-cloud/functions-framework": "^3.0.0",
    "mathjs": "^12.0.0",
    "jstat": "^1.9.6"
  },
  "scripts": {
    "start": "functions-framework --target=pmcEstimatorAPI --port=8080"
  }
}
EOF
fi

REQUIRED_DEPS=("@google-cloud/functions-framework" "mathjs" "jstat")
for DEP in "${REQUIRED_DEPS[@]}"; do
  if jq -e ".dependencies.\"${DEP}\"" "$PACKAGE_JSON" >/dev/null; then
    echo -e "${GREEN}${DEP} found in package.json${NC}"
  else
    echo -e "${RED}Error: ${DEP} missing in package.json${NC}"
    exit 1
  fi
done

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$SOURCE_DIR"
npm install
cd -

# Step 8: Test Application Locally
echo -e "${YELLOW}8. Testing application locally with USE_CORE=1...${NC}"
USE_CORE=1 npm --prefix "$SOURCE_DIR" run start &
NODE_PID=$!
sleep 5

CURL_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:8080 -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o curl_response.json)
if [ "$CURL_RESPONSE" -eq 200 ]; then
  echo -e "${GREEN}Local test successful: Server responded with status 200${NC}"
  cat curl_response.json
else
  echo -e "${RED}Error: Local test failed with status ${CURL_RESPONSE}${NC}"
  cat curl_response.json
  kill $NODE_PID
  exit 1
fi
kill $NODE_PID
rm curl_response.json

# Step 9: Deploy to Cloud Functions
echo -e "${YELLOW}9. Deploying to Cloud Functions with USE_CORE=1...${NC}"
gcloud functions deploy "$FUNCTION_NAME" \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region "$REGION" \
  --source "$SOURCE_DIR" \
  --project "$PROJECT_ID" \
  --set-env-vars=USE_CORE=1

# Step 10: Verify JSON Data Flow (Optional)
echo -e "${YELLOW}10. Do you want to test JSON data flow?${NC}"
echo -e "  (1) Yes"
echo -e "  (2) No"
read -p "Enter your choice (1 or 2): " JSON_TEST_CHOICE

if [ "$JSON_TEST_CHOICE" = "1" ]; then
  echo -e "${YELLOW}Testing JSON data flow...${NC}"
  JSON_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$SERVICE_URL" -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o json_response.json)
  if [ "$JSON_RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}JSON data flow test successful.${NC}"
    if jq -e '.results[0]' json_response.json >/dev/null; then
      echo -e "${GREEN}JSON structure valid: Contains 'results' array.${NC}"

      MENU_NUMBERS=()
      MENU_PATHS=()
      COUNT=0

      TOP_KEYS=($(jq -r '.results[0] | keys[]' json_response.json))
      echo -e "${YELLOW}Available JSON fields:${NC}"
      for i in "${!TOP_KEYS[@]}"; do
        KEY="${TOP_KEYS[$i]}"
        COUNT=$((COUNT+1))
        MENU_NUMBERS+=("$COUNT")
        MENU_PATHS+=("$KEY")
        echo "  $COUNT) $KEY"

        TYPE=$(jq -r ".results[0].$KEY | type" json_response.json)
        if [ "$TYPE" == "object" ]; then
          CHILD_KEYS=($(jq -r ".results[0].$KEY | keys[]" json_response.json))
          for j in "${!CHILD_KEYS[@]}"; do
            SUBCOUNT="$COUNT.$((j+1))"
            SUBPATH="$KEY.${CHILD_KEYS[$j]}"
            MENU_NUMBERS+=("$SUBCOUNT")
            MENU_PATHS+=("$SUBPATH")
            echo "    $SUBCOUNT) $SUBPATH"
          done
        elif [ "$TYPE" == "array" ]; then
          LENGTH=$(jq ".results[0].$KEY | length" json_response.json)
          for ((j=0; j<"$LENGTH"; j++)); do
            SUBCOUNT="$COUNT.$((j+1))"
            SUBPATH="$KEY[$j]"
            MENU_NUMBERS+=("$SUBCOUNT")
            MENU_PATHS+=("$SUBPATH")
            echo "    $SUBCOUNT) $SUBPATH"
          done
        fi
      done

      ALL_OPTION=$((COUNT+1))
      EXIT_OPTION=$((COUNT+2))
      echo "  $ALL_OPTION) Show entire JSON"
      echo "  $EXIT_OPTION) Exit without showing data"

      echo -e "${YELLOW}Enter one or more selections separated by spaces:${NC}"
      read -a SELECTIONS

      SHOW_ALL=false
      SHOW_EXIT=false
      SELECTED_PATHS=()

      for SEL in "${SELECTIONS[@]}"; do
        if [ "$SEL" -eq "$ALL_OPTION" ]; then
          SHOW_ALL=true
        elif [ "$SEL" -eq "$EXIT_OPTION" ]; then
          SHOW_EXIT=true
        else
          MATCHED=false
          for idx in "${!MENU_NUMBERS[@]}"; do
            if [ "${MENU_NUMBERS[$idx]}" = "$SEL" ]; then
              SELECTED_PATHS+=("${MENU_PATHS[$idx]}")
              MATCHED=true
              break
            fi
          done
          if [ "$MATCHED" = false ]; then
            echo -e "${RED}Error: Invalid selection '$SEL'. Exiting.${NC}"
            rm json_response.json
            exit 1
          fi
        fi
      done

      if [ "$SHOW_EXIT" = true ]; then
        echo -e "${YELLOW}Exiting without displaying any data.${NC}"
      elif [ "$SHOW_ALL" = true ]; then
        echo -e "${YELLOW}Full JSON response:${NC}"
        jq '.' json_response.json
      else
        for PATH in "${SELECTED_PATHS[@]}"; do
          echo -e "${YELLOW}Raw data for '$PATH':${NC}"
          jq ".results[0].$PATH" json_response.json
        done
      fi

    else
      echo -e "${RED}Error: JSON does not contain expected structure.${NC}"
      jq '.' json_response.json
      rm json_response.json
      exit 1
    fi
  else
    echo -e "${RED}Error: JSON data flow test failed with status ${JSON_RESPONSE}.${NC}"
    jq '.' json_response.json
    rm json_response.json
    exit 1
  fi
  rm json_response.json
else
  echo -e "${GREEN}Skipping JSON data flow test.${NC}"
fi

