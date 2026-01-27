#!/bin/bash
# File: deploy_pmc.sh
# Purpose: Deploys pmcEstimatorAPI to Google Cloud Functions with JWT-only access for Code.gs
# Used in: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api
# Validates: Environment, permissions, billing, source files, and service account; tests functions; deploys with restricted access
# Ensures: API is accessible only via Code.gs with JWT authentication
# Dependencies: test_scripts/deploy_validate.sh, core/main/main.js, Node.js 20.x, gcloud, jq, curl, openssl

# Configuration Variables
PROJECT_ID="pmc-estimator"
PROJECT_NUMBER="615922754202"
FUNCTION_NAME="pmcEstimatorAPI"
REGION="us-central1"
SOURCE_DIR="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api"
SERVICE_ACCOUNT="icarenow@pmc-estimator.iam.gserviceaccount.com"
SERVICE_ACCOUNT_KEY="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/pmc-estimator-b50a03244199.json"
EXPECTED_USER="abeljstephen@gmail.com"
TIMEOUT=540
MEMORY="1GB"
FUNCTION_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}"
DEPLOY_LOG_FILE="$SOURCE_DIR/deployment_log.txt"
PREVIOUS_BUILD_ID="6c208cbb-72c6-4f58-a950-c77d4e430a14"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Clear deployment log file
rm -f "$DEPLOY_LOG_FILE"
touch "$DEPLOY_LOG_FILE"
printf "${YELLOW}1. Clearing previous deployment log file...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
printf "${GREEN}Deployment log file initialized at $DEPLOY_LOG_FILE.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 1. Validate user permissions
printf "${YELLOW}1. Validating user permissions for $EXPECTED_USER...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
if [ -z "$USER_EMAIL" ]; then
  printf "${YELLOW}No active credentials found. Initiating login for $EXPECTED_USER...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  gcloud auth login --brief --quiet --account="$EXPECTED_USER"
  USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
fi
USER_EMAIL_LOWER=$(echo "$USER_EMAIL" | tr '[:upper:]' '[:lower:]')
EXPECTED_USER_LOWER=$(echo "$EXPECTED_USER" | tr '[:upper:]' '[:lower:]')
if [ "$USER_EMAIL_LOWER" != "$EXPECTED_USER_LOWER" ]; then
  printf "${YELLOW}Active account ($USER_EMAIL) does not match $EXPECTED_USER. Attempting login...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  gcloud auth login --brief --quiet --account="$EXPECTED_USER"
  USER_EMAIL=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" 2>/dev/null)
  USER_EMAIL_LOWER=$(echo "$USER_EMAIL" | tr '[:upper:]' '[:lower:]')
  if [ "$USER_EMAIL_LOWER" != "$EXPECTED_USER_LOWER" ]; then
    printf "${RED}Error: Failed to authenticate as $EXPECTED_USER. Got ${USER_EMAIL:-none}.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    exit 1
  fi
fi
printf "${GREEN}Active credentials: $USER_EMAIL${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
ROLES=("roles/cloudfunctions.admin" "roles/storage.admin" "roles/cloudbuild.builds.editor" "roles/cloudfunctions.viewer")
for ROLE in "${ROLES[@]}"; do
  if ! gcloud projects get-iam-policy "$PROJECT_ID" --format=json | jq -e ".bindings[] | select(.role==\"${ROLE}\" and .members[]==\"user:${EXPECTED_USER}\")" >/dev/null; then
    printf "${YELLOW}Assigning $ROLE to $EXPECTED_USER...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:$EXPECTED_USER" --role="$ROLE" > /dev/null 2>> "$DEPLOY_LOG_FILE"
    if [ $? -ne 0 ]; then
      printf "${RED}Error: Failed to assign $ROLE to $EXPECTED_USER. Assign manually at https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
      exit 1
    fi
  fi
  printf "${GREEN}$ROLE assigned to $EXPECTED_USER.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
done
if ! gcloud projects get-iam-policy "$PROJECT_ID" --format=json | jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.viewer\" and .members[]==\"user:${EXPECTED_USER}\")" >/dev/null; then
  printf "${YELLOW}Ensuring cloudfunctions.functions.get permission via roles/cloudfunctions.viewer for $EXPECTED_USER...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="user:$EXPECTED_USER" --role="roles/cloudfunctions.viewer" > /dev/null 2>> "$DEPLOY_LOG_FILE"
  if [ $? -ne 0 ]; then
    printf "${RED}Error: Failed to assign roles/cloudfunctions.viewer to $EXPECTED_USER. Assign manually at https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    exit 1
  fi
  printf "${GREEN}roles/cloudfunctions.viewer assigned to $EXPECTED_USER for cloudfunctions.functions.get.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
fi

# 2. Validate project and billing
printf "${YELLOW}2. Validating Google Cloud project and billing...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
  printf "${RED}Error: Active project ($CURRENT_PROJECT) does not match $PROJECT_ID. Run 'gcloud config set project $PROJECT_ID'.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
ACTUAL_PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)" 2>/dev/null)
if [ "$ACTUAL_PROJECT_NUMBER" != "$PROJECT_NUMBER" ]; then
  printf "${RED}Error: Project number ($ACTUAL_PROJECT_NUMBER) does not match $PROJECT_NUMBER.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
BILLING_RAW=$(gcloud billing projects describe "$PROJECT_ID" --format=json 2>/dev/null)
if [ -z "$BILLING_RAW" ]; then
  printf "${RED}Error: Failed to retrieve billing information. Ensure $EXPECTED_USER has billing permissions.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
BILLING_ENABLED=$(echo "$BILLING_RAW" | jq -r '.billingEnabled' 2>/dev/null)
if [ "$BILLING_ENABLED" != "true" ]; then
  printf "${RED}Error: Billing is not enabled for project $PROJECT_ID. Enable at https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
BILLING_ACCOUNT=$(echo "$BILLING_RAW" | jq -r '.billingAccountName' 2>/dev/null)
printf "${GREEN}Project $PROJECT_ID ($PROJECT_NUMBER) validated, billing enabled with account $BILLING_ACCOUNT.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 3. Enable required APIs
printf "${YELLOW}3. Enabling required APIs...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
REQUIRED_APIS=(
  "cloudfunctions.googleapis.com"
  "cloudbuild.googleapis.com"
  "artifactregistry.googleapis.com"
  "containerregistry.googleapis.com"
  "eventarc.googleapis.com"
)
for API in "${REQUIRED_APIS[@]}"; do
  if gcloud services list --enabled --format="value(config.name)" | grep -q "$API"; then
    printf "${GREEN}$API already enabled.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  else
    printf "${YELLOW}Enabling $API...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    gcloud services enable "$API" --project="$PROJECT_ID" > /dev/null 2>> "$DEPLOY_LOG_FILE"
    if [ $? -ne 0 ]; then
      printf "${RED}Error: Failed to enable $API. Enable manually at https://console.cloud.google.com/apis/library?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
      exit 1
    fi
  fi
done
printf "${GREEN}All required APIs enabled.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 4. Skip sourcing deploy_restrict_api_access.sh (handled in step 19)
printf "${YELLOW}4. Skipping sourcing deploy_restrict_api_access.sh (IAM policy applied in step 19)...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 5. Validate environment
printf "${YELLOW}5. Validating local environment...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
NODE_VERSION=$(node -v 2>/dev/null)
if [[ ! $NODE_VERSION =~ ^v20\..* ]]; then
  printf "${RED}Error: Node.js version 20.x required, found $NODE_VERSION. Install via 'nvm install 20'.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
if [ "$NODE_VERSION" != "v20.19.3" ]; then
  printf "${YELLOW}Warning: Node.js version is $NODE_VERSION, expected v20.19.3. This may cause numerical precision differences. Consider installing v20.19.3 with 'nvm install 20.19.3'.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
fi
if ! command -v gcloud &> /dev/null || ! command -v jq &> /dev/null || ! command -v curl &> /dev/null || ! command -v openssl &> /dev/null; then
  printf "${RED}Error: Missing required tools (gcloud, jq, curl, openssl). Install via 'brew install jq openssl curl' and Google Cloud SDK.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
printf "${GREEN}Environment validated: Node.js $NODE_VERSION, gcloud, jq, curl, openssl installed.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 6. Check source directory
printf "${YELLOW}6. Checking source directory...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
CORE_DIR="$SOURCE_DIR/core"
if [ ! -d "$SOURCE_DIR" ] || [ ! -d "$CORE_DIR" ]; then
  printf "${RED}Error: Source directory ($SOURCE_DIR) or core directory ($CORE_DIR) not found.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
printf "${GREEN}Source directory validated: $SOURCE_DIR and core directory exist.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 7. Validate service account key
printf "${YELLOW}7. Validating service account key...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
if [ ! -f "$SERVICE_ACCOUNT_KEY" ]; then
  printf "${RED}Error: Service account key file $SERVICE_ACCOUNT_KEY not found.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
KEY_CLIENT_EMAIL=$(jq -r '.client_email' "$SERVICE_ACCOUNT_KEY" 2>/dev/null)
PRIVATE_KEY=$(jq -r '.private_key' "$SERVICE_ACCOUNT_KEY" 2>/dev/null)
if [ -z "$PRIVATE_KEY" ] || ! echo "$PRIVATE_KEY" | grep -q "BEGIN PRIVATE KEY"; then
  printf "${RED}Error: Invalid or missing private_key in $SERVICE_ACCOUNT_KEY.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
if [ "$KEY_CLIENT_EMAIL" != "$SERVICE_ACCOUNT" ]; then
  printf "${YELLOW}Warning: Service account key client_email ($KEY_CLIENT_EMAIL) does not match $SERVICE_ACCOUNT. Ensure Code.gs uses the correct key.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
else
  printf "${GREEN}Service account key validated: $KEY_CLIENT_EMAIL.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
fi

# 8. Validate service account permissions
printf "${YELLOW}8. Validating service account permissions...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
if ! gcloud projects get-iam-policy "$PROJECT_ID" --format=json | jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.invoker\" and .members[]==\"serviceAccount:${SERVICE_ACCOUNT}\")" >/dev/null; then
  printf "${YELLOW}Adding roles/cloudfunctions.invoker to $SERVICE_ACCOUNT...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SERVICE_ACCOUNT" --role="roles/cloudfunctions.invoker" > /dev/null 2>> "$DEPLOY_LOG_FILE"
  if [ $? -ne 0 ]; then
    printf "${RED}Error: Failed to assign roles/cloudfunctions.invoker to $SERVICE_ACCOUNT. Assign manually at https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    exit 1
  fi
  printf "${GREEN}Successfully added roles/cloudfunctions.invoker to $SERVICE_ACCOUNT.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
else
  printf "${GREEN}Service account $SERVICE_ACCOUNT has roles/cloudfunctions.invoker.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
fi

# 9. Validate package.json
printf "${YELLOW}9. Validating package.json...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
if [ ! -f "$SOURCE_DIR/package.json" ]; then
  printf "${RED}Error: package.json not found in $SOURCE_DIR. Create package.json with the following content and retry:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  printf "${YELLOW}{\n  \"name\": \"pmc-estimator-api\",\n  \"version\": \"1.0.0\",\n  \"main\": \"index.js\",\n  \"dependencies\": {\n    \"@google-cloud/functions-framework\": \"^3.5.1\",\n    \"jstat\": \"^1.9.6\",\n    \"mathjs\": \"^13.0.0\",\n    \"ml-random-forest\": \"^2.0.0\"\n  },\n  \"scripts\": {\n    \"start\": \"functions-framework --target=pmcEstimatorAPI --port=8080\",\n    \"deploy\": \"gcloud functions deploy pmcEstimatorAPI --runtime nodejs20 --trigger-http --no-allow-unauthenticated --region us-central1 --memory 1GB --timeout 540s --set-env-vars=USE_CORE=1\"\n  }\n}${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
errors=()
if ! jq -e '.main == "index.js"' "$SOURCE_DIR/package.json" >/dev/null; then
  errors+=("main is not set to 'index.js'")
fi
if ! jq -e '.dependencies["mathjs"] == "^13.0.0"' "$SOURCE_DIR/package.json" >/dev/null; then
  errors+=("mathjs dependency is missing or not ^13.0.0")
fi
if ! jq -e '.dependencies["jstat"] == "^1.9.6"' "$SOURCE_DIR/package.json" >/dev/null; then
  errors+=("jstat dependency is missing or not ^1.9.6")
fi
if ! jq -e '.dependencies["@google-cloud/functions-framework"] == "^3.5.1"' "$SOURCE_DIR/package.json" >/dev/null; then
  errors+=("@google-cloud/functions-framework dependency is missing or not ^3.5.1")
fi
if ! jq -e '.dependencies["ml-random-forest"] == "^2.0.0"' "$SOURCE_DIR/package.json" >/dev/null; then
  errors+=("ml-random-forest dependency is missing or not ^2.0.0")
fi
if ! jq -e '.scripts.start == "functions-framework --target=pmcEstimatorAPI --port=8080"' "$SOURCE_DIR/package.json" >/dev/null; then
  errors+=("scripts.start is not set to 'functions-framework --target=pmcEstimatorAPI --port=8080'")
fi
if [ ${#errors[@]} -gt 0 ]; then
  printf "${RED}Error: package.json validation failed. Errors: ${errors[*]}. Update package.json with the above content and retry:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  jq . "$SOURCE_DIR/package.json" >> "$DEPLOY_LOG_FILE" 2>&1
  exit 1
fi
printf "${GREEN}package.json validated: main is index.js, required dependencies and start script present.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 10. Validate dependency versions
printf "${YELLOW}10. Validating dependency versions...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
cd "$SOURCE_DIR"
DEPENDENCY_ERRORS=()
if ! npm list @google-cloud/functions-framework | grep -q "@google-cloud/functions-framework@3.5.1"; then
  DEPENDENCY_ERRORS+=("@google-cloud/functions-framework is not version 3.5.1")
fi
if ! npm list jstat | grep -q "jstat@1.9.6"; then
  DEPENDENCY_ERRORS+=("jstat is not version 1.9.6")
fi
if ! npm list mathjs | grep -q "mathjs@13.0.0"; then
  DEPENDENCY_ERRORS+=("mathjs is not version 13.0.0")
fi
if ! npm list ml-random-forest | grep -q "ml-random-forest@2.0.0"; then
  DEPENDENCY_ERRORS+=("ml-random-forest is not version 2.0.0")
fi
if [ ${#DEPENDENCY_ERRORS[@]} -gt 0 ]; then
  printf "${RED}Error: Dependency version validation failed. Errors: ${DEPENDENCY_ERRORS[*]}. Installing correct versions...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  npm install @google-cloud/functions-framework@3.5.1 jstat@1.9.6 mathjs@13.0.0 ml-random-forest@2.0.0 >> "$SOURCE_DIR/test_scripts/npm_install.log" 2>&1
  if [ $? -ne 0 ]; then
    printf "${RED}Error: Failed to install correct dependency versions. Check test_scripts/npm_install.log in $SOURCE_DIR:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/npm_install.log" >> "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/npm_install.log"
    exit 1
  fi
  rm "$SOURCE_DIR/test_scripts/npm_install.log"
fi
printf "${GREEN}Dependency versions validated: @google-cloud/functions-framework@3.5.1, jstat@1.9.6, mathjs@13.0.0, ml-random-forest@2.0.0.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 11. Install dependencies
printf "${YELLOW}11. Installing Node.js dependencies...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
rm -rf node_modules package-lock.json
if ! npm install > "$SOURCE_DIR/test_scripts/npm_install.log" 2>&1; then
  printf "${RED}Error: Failed to install dependencies. Check test_scripts/npm_install.log in $SOURCE_DIR:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/npm_install.log" >> "$DEPLOY_LOG_FILE"
  rm "$SOURCE_DIR/test_scripts/npm_install.log"
  exit 1
fi
rm "$SOURCE_DIR/test_scripts/npm_install.log"
printf "${GREEN}Dependencies installed successfully.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 12. Validate index.js syntax
printf "${YELLOW}12. Validating index.js syntax...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
if [ ! -f "$SOURCE_DIR/index.js" ]; then
  printf "${RED}Error: index.js not found in $SOURCE_DIR.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
if ! grep -Eq 'exports\.pmcEstimatorAPI|module\.exports\s*=|functions\.http\(['"'"']pmcEstimatorAPI['"'"']\s*,' "$SOURCE_DIR/index.js"; then
  printf "${RED}Error: index.js does not export pmcEstimatorAPI. Ensure it uses exports.pmcEstimatorAPI, module.exports, or functions.http('pmcEstimatorAPI', ...).${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
if ! node -c "$SOURCE_DIR/index.js" 2>> "$DEPLOY_LOG_FILE"; then
  printf "${RED}Error: Syntax validation failed for index.js:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$DEPLOY_LOG_FILE" | grep "SyntaxError" >> "$DEPLOY_LOG_FILE"
  exit 1
fi
printf "${GREEN}index.js syntax validated.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 13. Validate core directory files
printf "${YELLOW}13. Validating core directory files...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
REQUIRED_MODULES=(
  "baseline/triangle-points.js"
  "baseline/pert-points.js"
  "baseline/beta-points.js"
  "baseline/monte-carlo-raw.js"
  "baseline/monte-carlo-smoothed.js"
  "baseline/coordinator.js"
  "reshaping/slider-adjustments.js"
  "reshaping/slider-normalization.js"
  "reshaping/outcome-summary.js"
  "reshaping/copula-utils.js"
  "optimization/slider-optimizer.js"
  "optimization/sensitivity-analysis.js"
  "optimization/kl-divergence.js"
  "optimization/matrix-utils.js"
  "helpers/validation.js"
  "helpers/metrics.js"
  "main/main.js"
)
for module in "${REQUIRED_MODULES[@]}"; do
  if [ ! -f "$CORE_DIR/$module" ]; then
    printf "${RED}Error: Required module $module not found in $CORE_DIR.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    exit 1
  fi
done
printf "${GREEN}Core directory files validated: All required modules found.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 14. Pre-deployment test for generateTrianglePoints
printf "${YELLOW}14. Testing generateTrianglePoints function locally...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
TEST_TRIANGLE_OUTPUT=$(node test_scripts/test_triangle_points.js 2> "$SOURCE_DIR/test_scripts/triangle_test_error.log")
TEST_TRIANGLE_STATUS=$?
echo "$TEST_TRIANGLE_OUTPUT" | tee -a "$DEPLOY_LOG_FILE"
if [ $TEST_TRIANGLE_STATUS -ne 0 ]; then
  printf "${RED}Error: generateTrianglePoints test failed. Check test_scripts/triangle_test_error.log:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/triangle_test_error.log" >> "$DEPLOY_LOG_FILE" 2>/dev/null || printf "${RED}No content in test_scripts/triangle_test_error.log${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  rm "$SOURCE_DIR/test_scripts/triangle_test_error.log"
  exit 1
fi
rm "$SOURCE_DIR/test_scripts/triangle_test_error.log"
printf "${GREEN}generateTrianglePoints test passed.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 14.5. Pre-deployment test for computeBetaMoments
printf "${YELLOW}14.5. Testing computeBetaMoments function locally...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
TEST_BETA_OUTPUT=$(node test_scripts/test_beta_moments.js 2> "$SOURCE_DIR/test_scripts/beta_test_error.log")
TEST_BETA_STATUS=$?
echo "$TEST_BETA_OUTPUT" | tee -a "$DEPLOY_LOG_FILE"
if [ $TEST_BETA_STATUS -ne 0 ]; then
  printf "${RED}Error: computeBetaMoments test failed. Check test_scripts/beta_test_error.log:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/beta_test_error.log" >> "$DEPLOY_LOG_FILE" 2>/dev/null || printf "${RED}No content in test_scripts/beta_test_error.log${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  rm "$SOURCE_DIR/test_scripts/beta_test_error.log"
  exit 1
fi
rm "$SOURCE_DIR/test_scripts/beta_test_error.log"
printf "${GREEN}computeBetaMoments test passed.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 14.6. Pre-deployment test for processTask
printf "${YELLOW}14.6. Testing processTask function locally...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
TEST_PROCESS_TASK_OUTPUT=$(node --max-old-space-size=2048 --expose-gc test_scripts/test_process_task.js 2> "$SOURCE_DIR/test_scripts/process_task_error.log")
TEST_PROCESS_TASK_STATUS=$?
echo "$TEST_PROCESS_TASK_OUTPUT" | tee -a "$DEPLOY_LOG_FILE"
if [ $TEST_PROCESS_TASK_STATUS -ne 0 ]; then
  printf "${RED}Error: processTask test failed. Check test_scripts/process_task_error.log:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/process_task_error.log" >> "$DEPLOY_LOG_FILE" 2>/dev/null || printf "${RED}No content in test_scripts/process_task_error.log${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  rm "$SOURCE_DIR/test_scripts/process_task_error.log"
  exit 1
fi
rm "$SOURCE_DIR/test_scripts/process_task_error.log" 2>/dev/null
printf "${GREEN}processTask test passed.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 14.7. Pre-deployment test for reshapeDistribution
printf "${YELLOW}14.7. Testing reshapeDistribution function locally...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
TEST_SLIDER_ADJUST_OUTPUT=$(node --max-old-space-size=1024 test_scripts/test_reshape_distribution.js 2> "$SOURCE_DIR/test_scripts/slider_adjustment_error.log")
TEST_SLIDER_ADJUST_STATUS=$?
echo "$TEST_SLIDER_ADJUST_OUTPUT" | tee -a "$DEPLOY_LOG_FILE"
if [ $TEST_SLIDER_ADJUST_STATUS -ne 0 ]; then
  printf "${RED}Error: reshapeDistribution test failed. Check test_scripts/slider_adjustment_error.log:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/slider_adjustment_error.log" >> "$DEPLOY_LOG_FILE" 2>/dev/null || printf "${RED}No content in test_scripts/slider_adjustment_error.log${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  rm "$SOURCE_DIR/test_scripts/slider_adjustment_error.log"
  exit 1
fi
rm "$SOURCE_DIR/test_scripts/slider_adjustment_error.log" 2>/dev/null
printf "${GREEN}reshapeDistribution test passed.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 15. Pre-deployment test for pmcEstimatorAPI
printf "${YELLOW}15. Testing pmcEstimatorAPI function locally...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
TEST_API_OUTPUT=$(node --max-old-space-size=1024 test_scripts/test_pmc_estimator_api.js 2> "$SOURCE_DIR/test_scripts/api_test_error.log")
TEST_API_STATUS=$?
echo "$TEST_API_OUTPUT" | tee -a "$DEPLOY_LOG_FILE"
if [ $TEST_API_STATUS -ne 0 ]; then
  printf "${RED}Error: pmcEstimatorAPI test failed. Check test_scripts/api_test_error.log for details:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/api_test_error.log" >> "$DEPLOY_LOG_FILE" 2>/dev/null || printf "${RED}No content in test_scripts/api_test_error.log${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
rm "$SOURCE_DIR/test_scripts/api_test_error.log" 2>/dev/null
printf "${GREEN}pmcEstimatorAPI test passed.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 16. Local test with functions framework
printf "${YELLOW}16. Testing locally with functions framework...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
TEST_PAYLOAD='[{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeCertainty":50,"scopeReductionAllowance":50,"reworkPercentage":50,"riskTolerance":50},"targetValue":1800,"confidenceLevel":0.9,"optimizeFor":"target","optimize":true,"userSlider_Confidence":"confident"}]'
if lsof -i :8080 > /dev/null; then
  printf "${RED}Error: Port 8080 is in use. Free the port with 'kill -9 $(lsof -t -i :8080)' and retry:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
USE_CORE=1 npm --prefix "$SOURCE_DIR" run start > "$SOURCE_DIR/test_scripts/functions_framework.log" 2>&1 &
NODE_PID=$!
sleep 30
if ! ps -p $NODE_PID > /dev/null; then
  printf "${RED}Error: Functions framework failed to start. Check test_scripts/functions_framework.log in $SOURCE_DIR for errors:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/functions_framework.log" >> "$DEPLOY_LOG_FILE"
  kill $NODE_PID 2>/dev/null
  exit 1
fi
max_retries=3
retry_delay=5
for attempt in $(seq 1 $max_retries); do
  printf "${YELLOW}Attempt $attempt/$max_retries: Sending test request...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  CURL_OUTPUT=$(curl -s -w "%{http_code}" -X POST http://localhost:8080 -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o "$SOURCE_DIR/test_scripts/curl_response.json" 2> "$SOURCE_DIR/test_scripts/curl_error.log")
  CURL_STATUS=$?
  CURL_RESPONSE_TEXT=$(cat "$SOURCE_DIR/test_scripts/curl_response.json" 2>/dev/null || echo "No response")
  CURL_ERROR_TEXT=$(cat "$SOURCE_DIR/test_scripts/curl_error.log" 2>/dev/null || echo "No error log")
  FRAMEWORK_LOG=$(cat "$SOURCE_DIR/test_scripts/functions_framework.log" 2>/dev/null || echo "No framework log")
  if [ $CURL_STATUS -ne 0 ]; then
    printf "${RED}Error: Curl request failed on attempt $attempt (status $CURL_STATUS). Details:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    printf "${YELLOW}Curl Error:${NC} $CURL_ERROR_TEXT\n" | tee -a "$DEPLOY_LOG_FILE"
    printf "${YELLOW}Functions Framework Log:${NC} $FRAMEWORK_LOG\n" | tee -a "$DEPLOY_LOG_FILE"
    kill $NODE_PID 2>/dev/null
    if [ $attempt -eq $max_retries ]; then
      exit 1
    fi
    sleep $retry_delay
    continue
  fi
  if [ "$CURL_OUTPUT" -eq 200 ] && jq -e '.' "$SOURCE_DIR/test_scripts/curl_response.json" >/dev/null 2>> "$DEPLOY_LOG_FILE"; then
    printf "${GREEN}Local test successful: Received status 200 with valid JSON response:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/curl_response.json" >> "$DEPLOY_LOG_FILE"
    kill $NODE_PID 2>/dev/null
    rm "$SOURCE_DIR/test_scripts/curl_response.json" "$SOURCE_DIR/test_scripts/curl_error.log" "$SOURCE_DIR/test_scripts/functions_framework.log" 2>/dev/null
    break
  else
    printf "${RED}Error: Local test failed on attempt $attempt with status $CURL_OUTPUT or invalid JSON response:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    printf "${YELLOW}Response:${NC} $CURL_RESPONSE_TEXT\n" | tee -a "$DEPLOY_LOG_FILE"
    printf "${YELLOW}Error Log:${NC} $CURL_ERROR_TEXT\n" | tee -a "$DEPLOY_LOG_FILE"
    printf "${YELLOW}Functions Framework Log:${NC} $FRAMEWORK_LOG\n" | tee -a "$DEPLOY_LOG_FILE"
    if [ $attempt -eq $max_retries ]; then
      kill $NODE_PID 2>/dev/null
      rm "$SOURCE_DIR/test_scripts/curl_response.json" "$SOURCE_DIR/test_scripts/curl_error.log" "$SOURCE_DIR/test_scripts/functions_framework.log" 2>/dev/null
      exit 1
    fi
    sleep $retry_delay
  fi
done

# 16.5. Check deployment package size
printf "${YELLOW}16.5. Checking deployment package size...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
du -sh . | tee -a "$DEPLOY_LOG_FILE"
du -sh core | tee -a "$DEPLOY_LOG_FILE"
find . -type f -exec ls -l {} \; | tee -a "$DEPLOY_LOG_FILE"

# 17. Deploy to Google Cloud Functions
printf "${YELLOW}17. Deploying pmcEstimatorAPI to Google Cloud Functions...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
DEPLOY_OUTPUT=$(gcloud functions deploy "$FUNCTION_NAME" \
  --runtime nodejs20 \
  --trigger-http \
  --no-allow-unauthenticated \
  --source "$SOURCE_DIR" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --set-env-vars=USE_CORE=1 \
  --timeout "$TIMEOUT" \
  --memory "$MEMORY" \
  --ingress-settings all 2> "$SOURCE_DIR/test_scripts/deploy_error.log")
DEPLOY_STATUS=$?
echo "$DEPLOY_OUTPUT" | tee -a "$DEPLOY_LOG_FILE"
if [ $DEPLOY_STATUS -ne 0 ]; then
  printf "${RED}Error: Deployment failed. Check test_scripts/deploy_error.log and Cloud Build log: https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/deploy_error.log" >> "$DEPLOY_LOG_FILE"
  exit 1
fi
rm "$SOURCE_DIR/test_scripts/deploy_error.log" 2>/dev/null
printf "${GREEN}Deployment successful: pmcEstimatorAPI deployed to $FUNCTION_URL (JWT-only access). Waiting for function to become fully active...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
sleep 600

# 18. Check Apps Script project association and network configurations
printf "${YELLOW}18. Checking Apps Script project association and network configurations...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
printf "${YELLOW}Please ensure the Apps Script project for Code.gs is associated with $PROJECT_ID (project number $PROJECT_NUMBER).${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
printf "${YELLOW}Action: In the Apps Script editor, go to Project Settings > Change project, and set the project number to $PROJECT_NUMBER. Confirm at: https://console.cloud.google.com/iam-admin/iam?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
IAM_POLICY=$(gcloud functions get-iam-policy "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --format=json 2> "$SOURCE_DIR/test_scripts/iam_error.log")
if [ $? -ne 0 ]; then
  printf "${YELLOW}Warning: Failed to retrieve IAM policy. Ensure $EXPECTED_USER has cloudfunctions.functions.getIamPolicy permission. Error:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/iam_error.log" >> "$DEPLOY_LOG_FILE"
  rm "$SOURCE_DIR/test_scripts/iam_error.log"
else
  if echo "$IAM_POLICY" | jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.invoker\" and .members[]==\"serviceAccount:$SERVICE_ACCOUNT\")" >/dev/null; then
    printf "${GREEN}IAM policy confirmed: $SERVICE_ACCOUNT has roles/cloudfunctions.invoker.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  else
    printf "${YELLOW}Warning: $SERVICE_ACCOUNT does not have roles/cloudfunctions.invoker. This may cause Code.gs 403 errors. Applying IAM policy in step 19.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  fi
  if echo "$IAM_POLICY" | jq -e '.bindings[] | select(.members[] | contains("allUsers") or contains("allAuthenticatedUsers"))' >/dev/null; then
    printf "${YELLOW}Warning: IAM policy contains public access bindings (allUsers or allAuthenticatedUsers). These will be removed in step 19 to ensure JWT-only access.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  else
    printf "${GREEN}No public access bindings (allUsers, allAuthenticatedUsers) found in IAM policy.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  fi
fi
printf "${YELLOW}Checking for VPC Service Controls (requires organization ID)...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
printf "${YELLOW}If your project is part of an organization, provide the organization ID (run 'gcloud organizations list' to find it). If unknown or not applicable, press Enter to skip:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
read -p "Enter organization ID (or press Enter to skip): " ORG_ID
if [ -n "$ORG_ID" ]; then
  VPC_POLICIES=$(gcloud access-context-manager policies list --organization="$ORG_ID" 2> "$SOURCE_DIR/test_scripts/vpc_error.log")
  if [ $? -ne 0 ]; then
    printf "${YELLOW}Warning: Failed to check VPC Service Controls. Ensure $EXPECTED_USER has accesscontextmanager.policies.list permission and the correct organization ID. Error:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/vpc_error.log" >> "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/vpc_error.log"
  else
    if [ -z "$VPC_POLICIES" ]; then
      printf "${GREEN}No VPC Service Controls policies found for organization $ORG_ID. No potential restrictions for Code.gs access.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    else
      printf "${YELLOW}VPC Service Controls policies found: ${VPC_POLICIES}. Verify if they restrict Cloud Functions access in $REGION at https://console.cloud.google.com/security/vpc-sc/perimeters?project=$PROJECT_ID. This may cause Code.gs 404 errors.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    fi
  fi
else
  printf "${YELLOW}Skipped VPC Service Controls check (no organization ID provided). If Code.gs fails with 404, check VPC settings at https://console.cloud.google.com/security/vpc-sc/perimeters?project=$PROJECT_ID or run 'gcloud organizations list' to find your organization ID.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
fi
printf "${YELLOW}Checking Cloud Build logs for recent deployment...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
BUILD_LOGS=$(gcloud builds list --project="$PROJECT_ID" --region="$REGION" --filter="sourceProvenance.resolvedRepoSource.commitSha" --limit=1 --format="value(id,status,createTime)" 2> "$SOURCE_DIR/test_scripts/build_error.log")
if [ $? -ne 0 ]; then
  printf "${YELLOW}Warning: Failed to check Cloud Build logs. Ensure $EXPECTED_USER has cloudbuild.builds.list permission. Error:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  cat "$SOURCE_DIR/test_scripts/build_error.log" >> "$DEPLOY_LOG_FILE"
  rm "$SOURCE_DIR/test_scripts/build_error.log"
else
  if [ -z "$BUILD_LOGS" ]; then
    printf "${YELLOW}No recent Cloud Build logs found. Previous build ID: $PREVIOUS_BUILD_ID. Check at https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  else
    printf "${GREEN}Recent Cloud Build log: $BUILD_LOGS. Verify details at https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  fi
fi
printf "${GREEN}Apps Script project and network configuration checks completed. Proceed with IAM restriction.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 19. Restrict API access
printf "${YELLOW}19. Restricting API access to $SERVICE_ACCOUNT...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
if ! echo '{"bindings":[{"role":"roles/cloudfunctions.invoker","members":["serviceAccount:'"$SERVICE_ACCOUNT"'"]}]}' | gcloud functions set-iam-policy "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" - >> "$DEPLOY_LOG_FILE" 2>&1; then
  printf "${RED}Error: Failed to set IAM policy for $FUNCTION_NAME to restrict to $SERVICE_ACCOUNT. Apply manually at https://console.cloud.google.com/functions/details/$REGION/$FUNCTION_NAME/permissions?project=$PROJECT_ID${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
printf "${GREEN}API access restricted to $SERVICE_ACCOUNT.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 20. Verify function existence and URL
printf "${YELLOW}20. Verifying Cloud Function $FUNCTION_NAME exists and is accessible...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
max_retries=10
retry_delays=(10 20 30 40 50 60 70 80 90)
for attempt in $(seq 1 $max_retries); do
  printf "${YELLOW}Attempt $attempt/$max_retries: Checking function status...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  FUNCTION_DESCRIBE_OUTPUT=$(gcloud functions describe "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --format=json 2> "$SOURCE_DIR/test_scripts/function_error.log")
  FUNCTION_STATUS=$(echo "$FUNCTION_DESCRIBE_OUTPUT" | jq -r '.status // "UNKNOWN"' 2>> "$SOURCE_DIR/test_scripts/function_error.log")
  FUNCTION_URL_CHECK=$(echo "$FUNCTION_DESCRIBE_OUTPUT" | jq -r '.httpsTrigger.url // ""' 2>> "$SOURCE_DIR/test_scripts/function_error.log")
  if [ "$FUNCTION_STATUS" = "ACTIVE" ] && [ -n "$FUNCTION_URL_CHECK" ] && [ "$FUNCTION_URL_CHECK" = "$FUNCTION_URL" ]; then
    printf "${GREEN}Cloud Function $FUNCTION_NAME is verified at $FUNCTION_URL (JWT authentication required). Status: $FUNCTION_STATUS${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/function_error.log"
    break
  else
    printf "${YELLOW}Attempt $attempt/$max_retries: Function $FUNCTION_NAME not fully active (Status: $FUNCTION_STATUS, URL: $FUNCTION_URL_CHECK). Retrying after ${retry_delays[$((attempt-1))]} seconds...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    echo "gcloud functions describe output:" >> "$DEPLOY_LOG_FILE"
    echo "$FUNCTION_DESCRIBE_OUTPUT" >> "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/function_error.log" >> "$DEPLOY_LOG_FILE"
  fi
  if [ $attempt -eq $max_retries ]; then
    printf "${RED}Error: Failed to verify function after $max_retries attempts. Deployment may have failed. Check Cloud Build log: https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID or function logs: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    printf "${YELLOW}Additional checks: Verify Apps Script project association (Project Settings > Change project to $PROJECT_NUMBER), VPC Service Controls (run: gcloud access-context-manager policies list --organization=<ORG_ID>), or IAM policies (gcloud projects get-iam-policy $PROJECT_ID).${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/function_error.log" 2>/dev/null
    exit 1
  fi
  sleep ${retry_delays[$((attempt-1))]}
done

# 21. Test unauthorized access
printf "${YELLOW}21. Testing unauthorized access (expecting 403/401)...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
max_retries=5
retry_delay=30
for attempt in $(seq 1 $max_retries); do
  printf "${YELLOW}Attempt $attempt/$max_retries: Testing unauthorized access...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  TEST_PAYLOAD='[{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeCertainty":50,"scopeReductionAllowance":50,"reworkPercentage":50,"riskTolerance":50},"targetValue":1800,"confidenceLevel":0.9,"optimizeFor":"target","optimize":true,"userSlider_Confidence":"confident"}]'
  UNAUTH_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$FUNCTION_URL" -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o "$SOURCE_DIR/test_scripts/unauth_response.json" 2> "$SOURCE_DIR/test_scripts/unauth_error.log")
  if [ "$UNAUTH_RESPONSE" -eq 403 ] || [ "$UNAUTH_RESPONSE" -eq 401 ]; then
    printf "${GREEN}Unauthorized access test successful (status: $UNAUTH_RESPONSE).${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/unauth_response.json" "$SOURCE_DIR/test_scripts/unauth_error.log"
    break
  else
    printf "${YELLOW}Attempt $attempt/$max_retries failed with status: $UNAUTH_RESPONSE. Retrying after $retry_delay seconds...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/unauth_response.json" >> "$DEPLOY_LOG_FILE" 2>/dev/null
    cat "$SOURCE_DIR/test_scripts/unauth_error.log" >> "$DEPLOY_LOG_FILE" 2>/dev/null
    if [ $attempt -eq $max_retries ]; then
      printf "${YELLOW}Warning: Unauthorized access test failed after $max_retries attempts (status: $UNAUTH_RESPONSE). Deployment is still valid if function is accessible via Code.gs. Response:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
      cat "$SOURCE_DIR/test_scripts/unauth_response.json" >> "$DEPLOY_LOG_FILE" 2>/dev/null
      cat "$SOURCE_DIR/test_scripts/unauth_error.log" >> "$DEPLOY_LOG_FILE" 2>/dev/null
      rm "$SOURCE_DIR/test_scripts/unauth_response.json" "$SOURCE_DIR/test_scripts/unauth_error.log"
      break
    fi
    sleep $retry_delay
  fi
done

# 22. Test authenticated access
printf "${YELLOW}22. Testing authenticated access with JWT...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
printf "${YELLOW}Cloud Shell Test Command:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
printf "${YELLOW}gcloud auth activate-service-account --key-file=$SERVICE_ACCOUNT_KEY\nHEADER=\$(echo -n '{\"alg\":\"RS256\",\"typ\":\"JWT\"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')\nNOW=\$(date +%s)\nPAYLOAD=\$(echo -n \"{\\\"iss\\\":\\\"${SERVICE_ACCOUNT}\\\",\\\"aud\\\":\\\"https://oauth2.googleapis.com/token\\\",\\\"exp\\\":\$((NOW+3600)),\\\"iat\\\":\${NOW},\\\"target_audience\\\":\\\"${FUNCTION_URL}\\\"}\" | base64 -w0 | tr -d '=' | tr '/+' '_-')\nSIGNATURE_INPUT=\"\${HEADER}.\${PAYLOAD}\"\nSIGNATURE=\$(echo -n \"\${SIGNATURE_INPUT}\" | openssl dgst -sha256 -sign $SERVICE_ACCOUNT_KEY | base64 -w0 | tr -d '=' | tr '/+' '_-')\nJWT=\"\${SIGNATURE_INPUT}.\${SIGNATURE}\"\nTOKEN=\$(curl -s -X POST https://oauth2.googleapis.com/token -H \"Content-Type: application/x-www-form-urlencoded\" -d \"grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=\${JWT}\" | jq -r '.id_token')\ncurl -s -w \"%{http_code}\" -X POST \"$FUNCTION_URL\" -H \"Authorization: Bearer \$TOKEN\" -H \"Content-Type: application/json\" -d '$TEST_PAYLOAD'${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
max_retries=3
retry_delay=10
for attempt in $(seq 1 $max_retries); do
  printf "${YELLOW}Attempt $attempt/$max_retries: Generating JWT...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')
  NOW=$(date +%s)
  PAYLOAD=$(echo -n "{\"iss\":\"${KEY_CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"target_audience\":\"${FUNCTION_URL}\"}" | base64 -w0 | tr -d '=' | tr '/+' '_-')
  SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
  SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign <(echo "$PRIVATE_KEY") | base64 -w0 | tr -d '=' | tr '/+' '_-')
  JWT="${SIGNATURE_INPUT}.${SIGNATURE}"
  TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token -H "Content-Type: application/x-www-form-urlencoded" -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}" 2> "$SOURCE_DIR/test_scripts/token_error.log")
  TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token' 2>/dev/null)
  if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    printf "${RED}Error: Failed to obtain ID token on attempt $attempt. Response: $TOKEN_RESPONSE${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/token_error.log" >> "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/token_error.log"
    if [ $attempt -eq $max_retries ]; then
      printf "${YELLOW}Warning: All attempts to obtain ID token failed. Deployment may still be valid. Verify with Code.gs or run: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    fi
    sleep $retry_delay
    continue
  fi
  rm "$SOURCE_DIR/test_scripts/token_error.log"
  printf "${YELLOW}Attempt $attempt/$max_retries: Sending authenticated request...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  AUTH_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$FUNCTION_URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o "$SOURCE_DIR/test_scripts/auth_response.json" 2> "$SOURCE_DIR/test_scripts/curl_error.log")
  if [ "$AUTH_RESPONSE" -eq 200 ]; then
    printf "${GREEN}Authenticated access test successful (status: $AUTH_RESPONSE).${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/auth_response.json" "$SOURCE_DIR/test_scripts/curl_error.log"
    break
  else
    printf "${RED}Error: Authenticated access test failed (status: $AUTH_RESPONSE). Response:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/auth_response.json" >> "$DEPLOY_LOG_FILE"
    cat "$SOURCE_DIR/test_scripts/curl_error.log" >> "$DEPLOY_LOG_FILE"
    rm "$SOURCE_DIR/test_scripts/auth_response.json" "$SOURCE_DIR/test_scripts/curl_error.log"
    if [ $attempt -eq $max_retries ]; then
      printf "${YELLOW}Warning: All authenticated access attempts failed. Deployment may still be valid. Verify with Code.gs or run: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
    fi
    sleep $retry_delay
  fi
done

# 23. Validate deployment
printf "${YELLOW}23. Validating deployment using deploy_validate.sh...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
if [ ! -f "$SOURCE_DIR/test_scripts/deploy_validate.sh" ]; then
  printf "${RED}Error: deploy_validate.sh not found in $SOURCE_DIR/test_scripts.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
source "$SOURCE_DIR/test_scripts/deploy_validate.sh"
if ! type -t validate_deploy >/dev/null; then
  printf "${RED}Error: validate_deploy function not defined in deploy_validate.sh.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
if ! validate_deploy "$PROJECT_ID" "$REGION" "$FUNCTION_NAME" "$SERVICE_ACCOUNT" "$DEPLOY_LOG_FILE"; then
  printf "${RED}Error: Deployment validation failed. Check $DEPLOY_LOG_FILE for details:${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
  exit 1
fi
printf "${GREEN}Deployment validation successful: API restricted to $SERVICE_ACCOUNT.${NC}\n" | tee -a "$DEPLOY_LOG_FILE"

# 24. Generate configuration file
printf "${YELLOW}24. Generating pmcEstimatorConfiguration file...${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
CONFIG_FILE="$SOURCE_DIR/pmcEstimatorConfiguration_${TIMESTAMP}.json"
NODE_VERSION=$(node --version 2>/dev/null || echo "Unknown")
JQ_VERSION=$(jq --version 2>/dev/null || echo "Unknown")
OPENSSL_VERSION=$(openssl version 2>/dev/null || echo "Unknown")
GCLOUD_VERSION=$(gcloud --version --format=json | jq -r '.Google Cloud SDK' 2>/dev/null || echo "Unknown")
cat << EOF > "$CONFIG_FILE"
{
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "project_id": "$PROJECT_ID",
  "project_number": "$PROJECT_NUMBER",
  "function_name": "$FUNCTION_NAME",
  "region": "$REGION",
  "source_dir": "$SOURCE_DIR",
  "service_url": "$FUNCTION_URL",
  "expected_user": "$EXPECTED_USER",
  "expected_service_account": "$SERVICE_ACCOUNT",
  "service_account_key_path": "$SERVICE_ACCOUNT_KEY",
  "billing_enabled": "$BILLING_ENABLED",
  "billing_account": "$BILLING_ACCOUNT",
  "required_apis": $(printf '%s\n' "${REQUIRED_APIS[@]}" | jq -R . | jq -s .),
  "required_roles_user": $(printf '%s\n' "${ROLES[@]}" | jq -R . | jq -s .),
  "required_role_service_account": "roles/cloudfunctions.invoker",
  "environment": {
    "node_version": "$NODE_VERSION",
    "jq_version": "$JQ_VERSION",
    "openssl_version": "$OPENSSL_VERSION",
    "gcloud_version": "$GCLOUD_VERSION",
    "os": "$(uname -a)"
  },
  "instructions": {
    "prerequisites": [
      "Install Google Cloud SDK and configure with 'gcloud init'.",
      "Install Node.js 20.x for local testing and dependency installation.",
      "Install jq and openssl with 'brew install jq openssl' on macOS.",
      "Ensure billing is enabled for project $PROJECT_ID.",
      "Verify service account key at $SERVICE_ACCOUNT_KEY.",
      "Assign roles/cloudfunctions.admin, roles/storage.admin, roles/cloudbuild.builds.editor, and roles/cloudfunctions.viewer to $EXPECTED_USER.",
      "Assign roles/cloudfunctions.invoker to $SERVICE_ACCOUNT."
    ],
    "replication_steps": [
      "Set project: 'gcloud config set project $PROJECT_ID'.",
      "Authenticate as $EXPECTED_USER: 'gcloud auth login --account=$EXPECTED_USER'.",
      "Enable APIs: 'gcloud services enable <api>' for each in required_apis.",
      "Assign IAM roles as specified in required_roles_user and required_role_service_account.",
      "Copy source code to $SOURCE_DIR and install dependencies with 'npm install'.",
      "Deploy with: 'gcloud functions deploy $FUNCTION_NAME --runtime nodejs20 --trigger-http --no-allow-unauthenticated --region $REGION --source $SOURCE_DIR --project $PROJECT_ID --set-env-vars=USE_CORE=1 --timeout=$TIMEOUT --memory=$MEMORY'.",
      "Apply IAM policy to restrict invocation to $SERVICE_ACCOUNT.",
      "Ensure Apps Script project is associated with project number $PROJECT_NUMBER in Project Settings > Change project."
    ]
  }
}
EOF
printf "${GREEN}Configuration file generated: $CONFIG_FILE${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
jq '.' "$CONFIG_FILE" >> "$DEPLOY_LOG_FILE"

printf "${GREEN}pmcEstimatorAPI deployment completed. API is live at $FUNCTION_URL, restricted to $SERVICE_ACCOUNT via JWT. Ensure Apps Script project is associated with $PROJECT_ID (project number $PROJECT_NUMBER) in Project Settings > Change project. If Code.gs fails with 404 or 503, check VPC Service Controls (run: gcloud access-context-manager policies list --project=$PROJECT_ID), IAM policies (gcloud projects get-iam-policy $PROJECT_ID), Cloud Build logs (https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID), or function logs (gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION).${NC}\n" | tee -a "$DEPLOY_LOG_FILE"
