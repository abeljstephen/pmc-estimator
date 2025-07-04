#!/bin/bash

# deploy.sh
# Script to deploy the pmcEstimatorAPI Cloud Function and optionally verify JSON data flow with dynamic piece selection
# Project: pmc-estimator
# Project Number: 615922754202
# Cloud Function: pmcEstimatorAPI
# Cloud Web App URL: https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI
# Region: us-central1
# Billing Account: billingAccounts/010656-5E1AC1-335B03
# Date: July 04, 2025, 04:50 PM PDT

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
  echo -e "${YELLOW}Steps to enable billing:${NC}"
  echo -e "  1. Go to https://console.cloud.google.com/billing?project=${PROJECT_ID}"
  echo -e "  2. Ensure your Free Trial billing account is active (expires October 1, 2025, \$300 credits)."
  echo -e "  3. Link the billing account (billingAccounts/010656-5E1AC1-335B03) to project ${PROJECT_ID}."
  echo -e "  4. Contact Cloud Billing Support if issues persist: https://cloud.google.com/support/billing"
  echo -e "${YELLOW}Please enable billing and re-run this script.${NC}"
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
CORE_FILE="${SOURCE_DIR}/core.js"
if [ ! -f "$INDEX_FILE" ]; then
  echo -e "${RED}Error: ${INDEX_FILE} not found in ${SOURCE_DIR}${NC}"
  exit 1
fi
if [ ! -f "$CORE_FILE" ]; then
  echo -e "${RED}Error: ${CORE_FILE} not found in ${SOURCE_DIR}${NC}"
  exit 1
fi

# Check for pmcEstimatorAPI in core.js
if ! grep -q 'functions.http.*pmcEstimatorAPI' "$CORE_FILE"; then
  echo -e "${RED}Error: core.js does not export pmcEstimatorAPI. Update to include functions.http('pmcEstimatorAPI', ...)${NC}"
  exit 1
fi
echo -e "${GREEN}${CORE_FILE} configuration looks good${NC}"

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

# Check for required dependencies
REQUIRED_DEPS=("@google-cloud/functions-framework" "mathjs" "jstat")
for DEP in "${REQUIRED_DEPS[@]}"; do
  if jq -e ".dependencies.\"${DEP}\"" "$PACKAGE_JSON" >/dev/null; then
    echo -e "${GREEN}${DEP} found in package.json${NC}"
  else
    echo -e "${RED}Error: ${DEP} missing in package.json${NC}"
    echo -e "${YELLOW}Please add ${DEP} to ${PACKAGE_JSON}, e.g.:${NC}"
    echo -e "${YELLOW}{\n  \"dependencies\": {\n    \"${DEP}\": \"^3.0.0\"\n  }\n}${NC}"
    echo -e "${YELLOW}Then run 'npm install' in ${SOURCE_DIR}${NC}"
    exit 1
  fi
done

# Install dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
cd "$SOURCE_DIR"
npm install
cd -

# Step 8: Test Application Locally
echo -e "${YELLOW}8. Testing application locally...${NC}"
# Run in background and capture PID
npm --prefix "$SOURCE_DIR" run start > local_test.log 2>&1 &
NODE_PID=$!
sleep 5 # Wait for server to start

# Test with simple payload
echo -e "${YELLOW}Testing with simple payload...${NC}"
CURL_RESPONSE=$(curl -s -w "%{http_code}" -X POST http://localhost:8080 -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o curl_response.json)
if [ "$CURL_RESPONSE" -eq 200 ]; then
  echo -e "${GREEN}Simple payload test successful: Server responded with status 200${NC}"
else
  echo -e "${RED}Error: Simple payload test failed with status ${CURL_RESPONSE}${NC}"
  echo -e "${YELLOW}Local test log:${NC}"
  cat local_test.log
  cat curl_response.json
  kill $NODE_PID
  exit 1
fi
# Clean up
kill $NODE_PID
rm local_test.log curl_response.json

# Step 9: Deploy to Cloud Functions
echo -e "${YELLOW}9. Deploying to Cloud Functions...${NC}"
gcloud functions deploy "$FUNCTION_NAME" \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region "$REGION" \
  --source "$SOURCE_DIR" \
  --project "$PROJECT_ID" \
  --memory 512MB
gcloud functions deploy "pmcEstimatorAPIFields" \
  --runtime nodejs20 \
  --trigger-http \
  --allow-unauthenticated \
  --region "$REGION" \
  --source "$SOURCE_DIR" \
  --project "$PROJECT_ID" \
  --memory 512MB

# Step 10: Verify JSON Data Flow (Optional)
echo -e "${YELLOW}10. Do you want to test JSON data flow?${NC}"
echo -e "  (1) Yes"
echo -e "  (2) No"
read -p "Enter your choice (1 or 2): " JSON_TEST_CHOICE
if [ "$JSON_TEST_CHOICE" = "1" ]; then
  echo -e "${YELLOW}Testing JSON data flow with test payload...${NC}"
  JSON_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$SERVICE_URL" -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o json_response.json)
  if [ "$JSON_RESPONSE" -eq 200 ]; then
    echo -e "${GREEN}JSON data flow test successful: Server responded with status 200${NC}"
    if jq -e '.results[0]' json_response.json >/dev/null; then
      echo -e "${GREEN}JSON structure valid: Contains 'results' array${NC}"
      FIELDS=($(jq -r '.results[0] | keys[]' json_response.json))
      echo -e "${YELLOW}Select JSON piece(s) to view raw data (comma or space-separated, e.g., 1,3,5 or 1 3 5, or 'all' for full JSON):${NC}"
      for i in "${!FIELDS[@]}"; do
        echo -e "  $((i+1))) ${FIELDS[$i]}"
      done
      echo -e "  all) Full JSON"
      read -p "Enter your choice: " JSON_PIECE_CHOICE
      if [ "$JSON_PIECE_CHOICE" = "all" ]; then
        echo -e "${YELLOW}Raw data for full JSON:${NC}"
        cat json_response.json
      else
        SELECTED_FIELDS=($(echo "$JSON_PIECE_CHOICE" | tr ',' ' ' | tr -s ' ' | xargs -n1))
        for field_choice in "${SELECTED_FIELDS[@]}"; do
          if [[ "$field_choice" =~ ^[0-9]+$ ]] && [ "$field_choice" -ge 1 ] && [ "$field_choice" -le "${#FIELDS[@]}" ]; then
            FIELD_INDEX=$((field_choice-1))
            FIELD=${FIELDS[$FIELD_INDEX]}
            echo -e "${YELLOW}Raw data for ${FIELD}:${NC}"
            jq ".results[0].${FIELD}" json_response.json
          else
            echo -e "${RED}Error: Invalid choice ${field_choice}. Please select 1-${#FIELDS[@]}, 'all'.${NC}"
          fi
        done
      fi
    else
      echo -e "${RED}Error: JSON structure invalid or missing 'results' array${NC}"
      cat json_response.json
      exit 1
    fi
  else
    echo -e "${RED}Error: JSON data flow test failed with status ${JSON_RESPONSE}${NC}"
    cat json_response.json
    exit 1
  fi
  rm json_response.json
else
  echo -e "${GREEN}Skipping JSON data flow test${NC}"
fi

# Instructions for Further Testing
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Test the API with different payloads using curl to verify JSON fields."
echo -e "  2. If using Apps Script, run 'estimateAndSave' to test the API with your data."
echo -e "  3. Check 'Estimate Calculations' tab for data."
echo -e "  4. Select 'Show Plot' to verify the triangular plot."
echo -e "  5. Deploy the web app and test the plot rendering."

echo -e "${GREEN}Deployment completed successfully!${NC}"
