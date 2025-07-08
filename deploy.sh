#!/bin/bash

# cloud_deploy.sh
# Script to deploy the pmcEstimatorAPI Cloud Function and optionally verify JSON data flow with dynamic piece selection
# Updated to support multiple JSON test selections (full response and target probability fields)

set -e

# Configuration
PROJECT_ID="pmc-estimator"
PROJECT_NUMBER="615922754202"
FUNCTION_NAME="pmcEstimatorAPI"
REGION="us-central1"
SOURCE_DIR="system-google-cloud-functions-api"
TEST_PAYLOAD='[{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000}]'
TEST_PAYLOAD_WITH_SLIDERS='{"task":{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000},"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeUncertainty":50,"riskTolerance":50},"targetValue":2500}'
TEST_PAYLOAD_TARGET_ONLY='{"task":{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000},"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeUncertainty":50,"riskTolerance":50},"targetValue":2500,"targetProbabilityOnly":true}'
SERVICE_URL="https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI"
UPDATE_TIME="2025-07-08T01:45:06.957Z"
VERSION_ID="49"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting deployment of ${FUNCTION_NAME} to Cloud Functions for project ${PROJECT_ID} (${PROJECT_NUMBER})...${NC}"
echo -e "${YELLOW}Cloud Functions URL: ${SERVICE_URL}${NC}"
echo -e "${YELLOW}Current date and time: $(date)${NC}"
echo -e "${YELLOW}Update time: ${UPDATE_TIME}${NC}"
echo -e "${YELLOW}Version ID: ${VERSION_ID}${NC}"

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
BILLING_ENABLED=$(echo "$BILLING_RAW" | jq -r '.billingEnabled')
if [ "$BILLING_ENABLED" != "true" ]; then
  echo -e "${RED}Error: Billing is not enabled.${NC}"
  exit 1
else
  BILLING_ACCOUNT=$(echo "$BILLING_RAW" | jq -r '.billingAccountName')
  echo -e "${GREEN}Billing enabled with account ${BILLING_ACCOUNT}${NC}"
fi

# Step 3: Check Authentication
echo -e "${YELLOW}3. Checking authentication...${NC}"
if gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
  USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
  echo -e "${GREEN}Active credentials: ${USER_EMAIL}${NC}"
else
  echo -e "${YELLOW}No credentials found. Logging in...${NC}"
  gcloud auth login --brief --quiet
  USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)")
  if [ -z "$USER_EMAIL" ]; then
    echo -e "${RED}Error: Authentication failed.${NC}"
    exit 1
  fi
fi

# Step 4: Enable APIs
echo -e "${YELLOW}4. Enabling required APIs...${NC}"
REQUIRED_APIS=(
  "cloudfunctions.googleapis.com"
  "cloudbuild.googleapis.com"
  "artifactregistry.googleapis.com"
  "containerregistry.googleapis.com"
  "eventarc.googleapis.com"
)
for API in "${REQUIRED_APIS[@]}"; do
  if gcloud services list --enabled --format="value(config.name)" | grep -q "$API"; then
    echo -e "${GREEN}${API} already enabled.${NC}"
  else
    echo -e "${GREEN}Enabling ${API}...${NC}"
    gcloud services enable "$API"
  fi
done

# Step 5: Set Permissions
echo -e "${YELLOW}5. Ensuring IAM roles...${NC}"
ROLES=(
  "roles/cloudfunctions.admin"
  "roles/storage.admin"
)
for ROLE in "${ROLES[@]}"; do
  if gcloud projects get-iam-policy "$PROJECT_ID" --format=json | jq -e ".bindings[] | select(.role==\"${ROLE}\" and .members[]==\"user:${USER_EMAIL}\")" >/dev/null; then
    echo -e "${GREEN}${ROLE} already assigned.${NC}"
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
  echo -e "${RED}Error: ${INDEX_FILE} not found.${NC}"
  exit 1
fi
if ! grep -Eq 'exports\.pmcEstimatorAPI|module\.exports\s*=' "$INDEX_FILE"; then
  echo -e "${RED}Error: index.js does not export pmcEstimatorAPI.${NC}"
  exit 1
fi
echo -e "${GREEN}index.js export verified.${NC}"

# Step 7: Verify Dependencies
echo -e "${YELLOW}7. Verifying dependencies...${NC}"
PACKAGE_JSON="${SOURCE_DIR}/package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
  echo -e "${YELLOW}Creating minimal package.json...${NC}"
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
    echo -e "${GREEN}${DEP} in package.json${NC}"
  else
    echo -e "${RED}Error: ${DEP} missing.${NC}"
    exit 1
  fi
done

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$SOURCE_DIR"
npm install
cd -

# Step 8: Test Locally (NO OUTPUT by default)
echo -e "${YELLOW}8. Testing locally with USE_CORE=1...${NC}"
USE_CORE=1 npm --prefix "$SOURCE_DIR" run start &
NODE_PID=$!
sleep 5

CURL_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:8080 -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o curl_response.json)
if [ "$CURL_RESPONSE" -eq 200 ]; then
  echo -e "${GREEN}Local test successful. JSON saved for inspection.${NC}"
else
  echo -e "${RED}Local test failed with status ${CURL_RESPONSE}.${NC}"
  jq '.' curl_response.json
  kill $NODE_PID
  exit 1
fi
kill $NODE_PID
rm curl_response.json

# Step 9: Deploy
echo -e "${YELLOW}9. Deploying to Cloud Functions...${NC}"
gcloud functions deploy "$FUNCTION_NAME" \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region "$REGION" \
  --source "$SOURCE_DIR" \
  --project "$PROJECT_ID" \
  --set-env-vars=USE_CORE=1

# Step 10: Verify JSON Data Flow
echo -e "${YELLOW}10. Test JSON data flow?${NC}"
echo -e "  (1) Test full response (all fields)"
echo -e "  (2) Test target probability fields only"
echo -e "  (3) No"
echo -e "${YELLOW}Enter selections (space-separated, e.g., '1 2' for both):${NC}"
read -a JSON_TEST_CHOICES

if [ ${#JSON_TEST_CHOICES[@]} -eq 0 ] || [[ " ${JSON_TEST_CHOICES[*]} " =~ " 3 " ]]; then
  echo -e "${GREEN}Skipping JSON test.${NC}"
else
  for JSON_TEST_CHOICE in "${JSON_TEST_CHOICES[@]}"; do
    if [ "$JSON_TEST_CHOICE" != "1" ] && [ "$JSON_TEST_CHOICE" != "2" ]; then
      echo -e "${RED}Invalid selection '$JSON_TEST_CHOICE'. Skipping JSON test.${NC}"
      continue
    fi

    echo -e "${YELLOW}Testing JSON data flow for choice ${JSON_TEST_CHOICE}...${NC}"
    if [ "$JSON_TEST_CHOICE" = "1" ]; then
      TEST_PAYLOAD_TO_USE="$TEST_PAYLOAD_WITH_SLIDERS"
      RESPONSE_KEY="results[0]"
      RESPONSE_TYPE="Full response"
    else
      TEST_PAYLOAD_TO_USE="$TEST_PAYLOAD_TARGET_ONLY"
      RESPONSE_KEY=""
      RESPONSE_TYPE="Target probability response"
    fi

    JSON_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$SERVICE_URL" -H "Content-Type: application/json" -d "$TEST_PAYLOAD_TO_USE" -o json_response_${JSON_TEST_CHOICE}.json)
    if [ "$JSON_RESPONSE" -eq 200 ]; then
      echo -e "${GREEN}Test successful for ${RESPONSE_TYPE}.${NC}"
      if [ "$JSON_TEST_CHOICE" = "1" ] && jq -e '.results[0]' json_response_${JSON_TEST_CHOICE}.json >/dev/null; then
        echo -e "${GREEN}JSON structure valid (full response).${NC}"
      elif [ "$JSON_TEST_CHOICE" = "2" ] && jq -e '.task' json_response_${JSON_TEST_CHOICE}.json >/dev/null; then
        echo -e "${GREEN}JSON structure valid (target probability response).${NC}"
      else
        echo -e "${RED}JSON structure invalid for ${RESPONSE_TYPE}.${NC}"
        jq '.' json_response_${JSON_TEST_CHOICE}.json
        rm json_response_${JSON_TEST_CHOICE}.json
        exit 1
      fi

      MENU_NUMBERS=()
      MENU_PATHS=()
      COUNT=0

      if [ "$JSON_TEST_CHOICE" = "1" ]; then
        TOP_KEYS=($(jq -r '.results[0] | keys[]' json_response_${JSON_TEST_CHOICE}.json))
      else
        TOP_KEYS=($(jq -r 'keys[]' json_response_${JSON_TEST_CHOICE}.json))
      fi
      echo -e "${YELLOW}Available JSON fields for ${RESPONSE_TYPE}:${NC}"
      for i in "${!TOP_KEYS[@]}"; do
        KEY="${TOP_KEYS[$i]}"
        COUNT=$((COUNT+1))
        MENU_NUMBERS+=("$COUNT")
        MENU_PATHS+=("$KEY")
        echo "  $COUNT) $KEY"

        TYPE=$(jq -r ".${RESPONSE_KEY}${RESPONSE_KEY:+.}$KEY | type" json_response_${JSON_TEST_CHOICE}.json)
        if [ "$TYPE" == "object" ]; then
          CHILD_KEYS=($(jq -r ".${RESPONSE_KEY}${RESPONSE_KEY:+.}$KEY | keys[]" json_response_${JSON_TEST_CHOICE}.json))
          for j in "${!CHILD_KEYS[@]}"; do
            SUBCOUNT="$COUNT.$((j+1))"
            SUBPATH="$KEY.${CHILD_KEYS[$j]}"
            MENU_NUMBERS+=("$SUBCOUNT")
            MENU_PATHS+=("$SUBPATH")
            echo "    $SUBCOUNT) $SUBPATH"
          done
        elif [ "$TYPE" == "array" ]; then
          LENGTH=$(jq ".${RESPONSE_KEY}${RESPONSE_KEY:+.}$KEY | length" json_response_${JSON_TEST_CHOICE}.json)
          for ((j=0;j<LENGTH;j++)); do
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
      echo "  $EXIT_OPTION) Exit"

      echo -e "${YELLOW}Enter selections for ${RESPONSE_TYPE} (space-separated):${NC}"
      read -a SELECTIONS

      SHOW_ALL=false
      SHOW_EXIT=false
      SELECTED_PATHS=()

      for SEL in "${SELECTIONS[@]}"; do
        if [ "$SEL" = "$ALL_OPTION" ]; then
          SHOW_ALL=true
        elif [ "$SEL" = "$EXIT_OPTION" ]; then
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
            echo -e "${RED}Invalid selection '$SEL' for ${RESPONSE_TYPE}. Skipping.${NC}"
          fi
        fi
      done

      if [ "$SHOW_EXIT" = true ]; then
        echo -e "${YELLOW}Exiting without displaying data for ${RESPONSE_TYPE}.${NC}"
      elif [ "$SHOW_ALL" = true ]; then
        jq '.' json_response_${JSON_TEST_CHOICE}.json
      else
        for PATH in "${SELECTED_PATHS[@]}"; do
          echo -e "${YELLOW}Data for '$PATH' (${RESPONSE_TYPE}):${NC}"
          jq ".${RESPONSE_KEY}${RESPONSE_KEY:+.}$PATH" json_response_${JSON_TEST_CHOICE}.json
        done
      fi

      rm json_response_${JSON_TEST_CHOICE}.json
    else
      echo -e "${RED}Test failed for ${RESPONSE_TYPE}: Status $JSON_RESPONSE${NC}"
      jq '.' json_response_${JSON_TEST_CHOICE}.json
      rm json_response_${JSON_TEST_CHOICE}.json
      exit 1
    fi
  done
fi

echo -e "${GREEN}🎉 All done!${NC}"
