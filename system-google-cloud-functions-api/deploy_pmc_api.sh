#!/bin/bash

# deploy_pmc_api.sh
# WHAT: Deploys, tests (unauthenticated and authenticated), restricts access to, and validates the pmcEstimatorAPI Cloud Function.
# WHY: Ensures secure deployment, restricted invocation, and successful tests for Code.gs/Plot.html integration.
# WHERE: Run from /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api.
# HOW:
#   - Uses nodejs20 (1st gen) for compatibility.
#   - Deploys with --allow-unauthenticated for initial test, then re-deploys with --no-allow-unauthenticated.
#   - Tests unauthenticated to isolate IAM issues, then authenticated with JWT.
#   - Restricts IAM to service account with invoker and token creator roles.
#   - Tests with Project_1 inputs (O=10, M=20, P=30, target=20) and target probability payload.
#   - Outputs two-column table (Column Name | Value Returned) matching Google Sheets columns.
#   - Validates PERT, non-empty points, sliders, etc. (no fallbacks).
#   - Logs to deployment_log.txt with colored, timestamped output.
# ARGUMENTS: project_id, region, function_name, service_account_email, service_account_key, source_dir (optional, default .)
# RETURNS: 0 on success, 1 on failure
# SECURITY: Temporary public access for debugging; reverts to JWT-only after testing.
# CHANGES (2025-09-19):
#   - Based on 2025-09-18 version (deploy_pmc_api.sh.09192025245PMPST).
#   - Simplified curl parsing to handle output variations.
#   - Added phases for testing with explanatory messages and SUCCESS/FAIL.
#   - Supports y/Y/n/N for prompts.
#   - CAPS only for (Y/N) prompts, lowercase for other logs.
#   - Breaks retries on HTTP 200 or 500.
#   - Enforced mathjs (^12.0.0) and jstat (^1.9.6) versions.
#   - Added curl timeout (30s).

# Ensure PATH includes /usr/bin and /bin
export PATH="$PATH:/usr/bin:/bin"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Default values
PROJECT_ID="${1:-pmc-estimator}"
REGION="${2:-us-central1}"
FUNCTION_NAME="${3:-pmcEstimatorAPI}"
SERVICE_ACCOUNT_EMAIL="${4:-icarenow@pmc-estimator.iam.gserviceaccount.com}"
SERVICE_ACCOUNT_KEY="${5:-pmc-estimator-b50a03244199.json}"
SOURCE_DIR="${6:-.}"

DEPLOY_LOG_FILE="deployment_log.txt"

# Progress bar or spinner
progress_bar() {
  local pid=$1
  if command -v pv >/dev/null 2>&1; then
    pv -t -p -w 80 -N "Processing" /dev/zero >/dev/null 2>&1 &
    local pv_pid=$!
    wait $pid
    kill $pv_pid 2>/dev/null
  else
    local delay=2.0
    local spinstr='|/-\'
    local timeout=30
    local start_time=$(date +%s)
    while ps -p "$pid" >/dev/null; do
      local current_time=$(date +%s)
      if [ $((current_time - start_time)) -gt $timeout ]; then
        kill $pid 2>/dev/null
        break
      fi
      local temp=${spinstr#?}
      printf " [%c]  " "$spinstr"
      spinstr=$temp${spinstr%"$temp"}
      sleep $delay
      printf "\b\b\b\b\b\b"
    done
    printf "    \b\b\b\b"
  fi
}

# Log messages with timestamp
log_message() {
  local level="$1"
  local message="$2"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local color=""
  local emoji=""
  case "$level" in
    ERROR) color="$RED"; emoji="❌";;
    SUCCESS) color="$GREEN"; emoji="✅";;
    WARNING) color="$YELLOW"; emoji="⚠️";;
    INFO) color="$YELLOW"; emoji="ℹ️";;
  esac
  local formatted_message="$message"
  if [[ "$message" =~ \(Y/N\)$ ]]; then
    formatted_message="${message}"
  else
    formatted_message=$(echo "$message" | tr '[:upper:]' '[:lower:]')
  fi
  echo "${color}${emoji} ${level} [${timestamp}]: ${formatted_message}${NC}" >> "$DEPLOY_LOG_FILE"
  echo "${color}${emoji} ${level} [${timestamp}]: ${formatted_message}${NC}"
}

# Check prerequisites
check_prerequisites() {
  log_message "INFO" "phase 1: checking prerequisites - ensuring all required tools and files are present..."
  for cmd in gcloud jq curl openssl mktemp npm; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      log_message "ERROR" "command $cmd not found. install it (e.g., 'brew install $cmd')."
      exit 1
    fi
  done
  if [ ! -f "$SERVICE_ACCOUNT_KEY" ]; then
    log_message "ERROR" "service account key file $SERVICE_ACCOUNT_KEY not found."
    exit 1
  fi
  if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    log_message "ERROR" "no active gcloud authentication found. run 'gcloud auth login'."
    exit 1
  fi
  if [ ! -f "$SOURCE_DIR/index.js" ]; then
    log_message "ERROR" "index.js not found in $SOURCE_DIR."
    exit 1
  fi
  if ! grep -q "functions.http('pmcEstimatorAPI'" "$SOURCE_DIR/index.js"; then
    log_message "ERROR" "entry point pmcEstimatorAPI not found in $SOURCE_DIR/index.js."
    grep "functions.http" "$SOURCE_DIR/index.js" | awk '{print $1}' | sort -u >> "$DEPLOY_LOG_FILE"
    exit 1
  fi
  if [ ! -f "$SOURCE_DIR/package.json" ]; then
    log_message "ERROR" "package.json not found in $SOURCE_DIR."
    exit 1
  fi
  if ! jq -e '.dependencies["jstat"] and .dependencies["mathjs"]' "$SOURCE_DIR/package.json" >/dev/null; then
    log_message "ERROR" "package.json missing required dependencies: jstat, mathjs."
    exit 1
  fi
  local jstat_version=$(jq -r '.dependencies["jstat"] // "none"' "$SOURCE_DIR/package.json")
  local mathjs_version=$(jq -r '.dependencies["mathjs"] // "none"' "$SOURCE_DIR/package.json")
  if [ "$jstat_version" != "^1.9.6" ]; then
    log_message "ERROR" "jstat version ($jstat_version) is not compatible. expected ^1.9.6."
    exit 1
  fi
  if [ "$mathjs_version" != "^12.0.0" ]; then
    log_message "ERROR" "mathjs version ($mathjs_version) is not compatible. expected ^12.0.0."
    exit 1
  fi
  if [ ! -f "$SOURCE_DIR/core/main/main.js" ] || ! grep -q "SCHEMA_VERSION = '2025-09-16.api-envelope.v1'" "$SOURCE_DIR/core/main/main.js"; then
    log_message "ERROR" "main.js not found or outdated in $SOURCE_DIR/core/main/. ensure it contains 'SCHEMA_VERSION = 2025-09-16.api-envelope.v1'."
    exit 1
  fi
  local core_files=(
    "core/main/main.js"
    "core/reshaping/slider-adjustments.js"
    "core/optimization/slider-optimizer.js"
    "core/baseline/coordinator.js"
    "core/helpers/validation.js"
    "core/helpers/metrics.js"
    "core/reshaping/copula-utils.js"
    "core/baseline/triangle-points.js"
    "core/baseline/pert-points.js"
    "core/baseline/beta-points.js"
    "core/baseline/monte-carlo-raw.js"
    "core/baseline/monte-carlo-smoothed.js"
  )
  for file in "${core_files[@]}"; do
    if [ ! -f "$SOURCE_DIR/$file" ]; then
      log_message "ERROR" "core file $file not found in $SOURCE_DIR."
      exit 1
    fi
  done
  for file in "${core_files[@]}"; do
    node -c "$SOURCE_DIR/$file" >> "$DEPLOY_LOG_FILE" 2>&1
    if [ $? -ne 0 ]; then
      log_message "ERROR" "syntax error in core file $file. check $DEPLOY_LOG_FILE for details."
      exit 1
    fi
  done
  log_message "SUCCESS" "phase 1: prerequisites check passed! all tools and files are ready. 🎉"
  log_message "WARNING" "ensure google cloud cli is up-to-date. run 'gcloud components update' if issues occur."
}

# Install dependencies
install_dependencies() {
  log_message "INFO" "phase 2: installing dependencies - setting up required node.js packages..."
  (cd "$SOURCE_DIR" && rm -rf node_modules package-lock.json && npm install >> "$DEPLOY_LOG_FILE" 2>&1) &
  progress_bar $!
  if [ $? -ne 0 ]; then
    log_message "ERROR" "phase 2: failed to install dependencies. check $DEPLOY_LOG_FILE for npm errors."
    exit 1
  fi
  log_message "SUCCESS" "phase 2: dependencies installed successfully! 📦"
}

# Deploy the Cloud Function (allow unauthenticated for initial test)
deploy_function_unauthenticated() {
  log_message "INFO" "PHASE 3: READY TO DEPLOY $FUNCTION_NAME WITH PUBLIC ACCESS FOR INITIAL TEST? (Y/N)"
  read -r confirm
  if ! echo "$confirm" | grep -qi '^y$'; then
    log_message "INFO" "phase 3: unauthenticated deployment skipped by user."
    return 0
  fi
  local runtime="nodejs20"
  log_message "INFO" "phase 3: deploying cloud function $FUNCTION_NAME with runtime $runtime (public access for testing to verify api functionality)..."
  (gcloud functions deploy "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --runtime="$runtime" \
    --trigger-http \
    --allow-unauthenticated \
    --source="$SOURCE_DIR" \
    --entry-point=pmcEstimatorAPI \
    --memory=512MB \
    --timeout=60s \
    --set-env-vars=PROJECT_ID="$PROJECT_ID",DEBUG=1 \
    >> "$DEPLOY_LOG_FILE" 2>&1) &
  progress_bar $!
  if [ $? -ne 0 ]; then
    log_message "ERROR" "phase 3: unauthenticated deployment failed. check cloud build logs: https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID"
    return 1
  fi
  log_message "SUCCESS" "phase 3: unauthenticated deployment completed successfully! 🎉"
  return 0
}

# Deploy the Cloud Function (restricted access)
deploy_function_restricted() {
  log_message "INFO" "PHASE 5: READY TO RE-DEPLOY $FUNCTION_NAME WITH RESTRICTED ACCESS? (Y/N)"
  read -r confirm
  if ! echo "$confirm" | grep -qi '^y$'; then
    log_message "INFO" "phase 5: restricted deployment skipped by user."
    return 0
  fi
  local runtime="nodejs20"
  log_message "INFO" "phase 5: re-deploying cloud function $FUNCTION_NAME with runtime $runtime (restricted access for secure production use)..."
  (gcloud functions deploy "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --runtime="$runtime" \
    --trigger-http \
    --no-allow-unauthenticated \
    --source="$SOURCE_DIR" \
    --entry-point=pmcEstimatorAPI \
    --memory=512MB \
    --timeout=60s \
    --set-env-vars=PROJECT_ID="$PROJECT_ID",DEBUG=1 \
    >> "$DEPLOY_LOG_FILE" 2>&1) &
  progress_bar $!
  if [ $? -ne 0 ]; then
    log_message "ERROR" "phase 5: restricted deployment failed. check cloud build logs: https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID"
    return 1
  fi
  log_message "SUCCESS" "phase 5: restricted deployment completed successfully! 🎉"
  return 0
}

# Restrict API access
restrict_api_access() {
  log_message "INFO" "PHASE 6: READY TO RESTRICT API ACCESS TO $SERVICE_ACCOUNT_EMAIL? (Y/N)"
  read -r confirm
  if ! echo "$confirm" | grep -qi '^y$'; then
    log_message "INFO" "phase 6: iam restriction skipped by user."
    return 0
  fi
  log_message "INFO" "phase 6: restricting api access to $SERVICE_ACCOUNT_EMAIL (ensures only authorized service account can invoke the api)..."
  gcloud functions remove-iam-policy-binding "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --member="allUsers" \
    --role="roles/cloudfunctions.invoker" >> "$DEPLOY_LOG_FILE" 2>&1
  gcloud functions remove-iam-policy-binding "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --member="allAuthenticatedUsers" \
    --role="roles/cloudfunctions.invoker" >> "$DEPLOY_LOG_FILE" 2>&1
  gcloud functions add-iam-policy-binding "$FUNCTION_NAME" \
    --project="$PROJECT_ID" \
    --region="$REGION" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/cloudfunctions.invoker" >> "$DEPLOY_LOG_FILE" 2>&1
  if [ $? -ne 0 ]; then
    log_message "ERROR" "phase 6: failed to restrict api access."
    return 1
  fi
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/iam.serviceAccountTokenCreator" >> "$DEPLOY_LOG_FILE" 2>&1
  if [ $? -ne 0 ]; then
    log_message "ERROR" "phase 6: failed to add roles/iam.serviceAccountTokenCreator to $SERVICE_ACCOUNT_EMAIL."
    return 1
  fi
  log_message "SUCCESS" "phase 6: api access restricted to $SERVICE_ACCOUNT_EMAIL! 🔐"
  return 0
}

# Test API (unauthenticated)
test_api_unauthenticated() {
  log_message "INFO" "PHASE 4: READY TO TEST THE API WITHOUT AUTHENTICATION? (Y/N)"
  read -r confirm
  if ! echo "$confirm" | grep -qi '^y$'; then
    log_message "INFO" "phase 4: unauthenticated api testing skipped by user."
    return 0
  fi
  log_message "INFO" "phase 4: testing api without authentication (public access) to verify api functionality before restricting access..."
  local FUNCTION_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}"
  local TEST_PAYLOAD_PROJECT1='[{"task":"Project_1","optimistic":10,"mostLikely":20,"pessimistic":30,"targetValue":20,"confidenceLevel":0.95,"optimizeFor":"target","optimize":true,"distributionType":"monte-carlo-smoothed"}]'
  local TEST_PAYLOAD_TARGET='[{"task":"Test Target","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"targetValue":2500,"confidenceLevel":0.95,"optimizeFor":"target","optimize":false,"distributionType":"monte-carlo-smoothed"}]'

  echo "${YELLOW}SELECT TEST PAYLOADS (SPACE-SEPARATED, E.G., '1 2'):${NC}"
  echo "1) Project_1 full response (O=10, M=20, P=30, target=20)"
  echo "2) Target probability response (O=1800, M=2400, P=3000, target=2500)"
  echo "3) Skip test"
  read -r choices
  if [ -z "$choices" ]; then
    choices="1"
  fi

  for choice in $choices; do
    case "$choice" in
      1) TEST_PAYLOAD="$TEST_PAYLOAD_PROJECT1"; RESPONSE_TYPE="Project_1 full response" ;;
      2) TEST_PAYLOAD="$TEST_PAYLOAD_TARGET"; RESPONSE_TYPE="Target probability response" ;;
      3) log_message "INFO" "phase 4: skipping unauthenticated api test."; continue ;;
      *) log_message "WARNING" "phase 4: invalid choice $choice. skipping."; continue ;;
    esac

    max_retries=4
    retry_delays=(10 20 40 80)
    attempt=1
    while [ $attempt -le $max_retries ]; do
      log_message "INFO" "phase 4 (attempt $attempt/$max_retries): testing $RESPONSE_TYPE to verify baseline pert, confidence intervals, and optimized sliders..."
      local temp_err=$(mktemp)
      local temp_out=$(mktemp)
      local HTTP_STATUS
      local response_body
      curl -s -m 30 -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" -o "$temp_out" 2>"$temp_err"
      if [ -s "$temp_out" ]; then
        HTTP_STATUS=$(tail -n 1 "$temp_out" | tr -d '\r' | tr -d '\n')
        response_body=$(sed -e :a -e '$d;N;2,3ba' -e 'P;D' "$temp_out" | tr -d '\r' | tr -d '\n')
      else
        HTTP_STATUS=""
        response_body=""
      fi
      local curl_exit=$?
      local curl_error=$(cat "$temp_err")
      rm "$temp_err" "$temp_out" 2>/dev/null
      if [ $curl_exit -ne 0 ]; then
        log_message "ERROR" "phase 4: failed to connect to unauthenticated api (curl exit code: $curl_exit). error: $curl_error"
        echo "$response_body" > "json_response_unauth_${choice}.json"
        cat "json_response_unauth_${choice}.json" >> "$DEPLOY_LOG_FILE" 2>/dev/null
        rm "json_response_unauth_${choice}.json" 2>/dev/null
        if [ $attempt -eq $max_retries ]; then
          log_message "ERROR" "phase 4: unauthenticated api test failed after $max_retries attempts. check logs: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION"
          return 1
        fi
        local delay=${retry_delays[$((attempt-1))]}
        log_message "INFO" "phase 4: retrying after $delay seconds..."
        sleep $delay
        attempt=$((attempt+1))
        continue
      fi
      if [ -z "$HTTP_STATUS" ] || ! echo "$HTTP_STATUS" | grep -qE '^[0-9]{3}$'; then
        log_message "ERROR" "phase 4: invalid or no http status received from api call (status: $HTTP_STATUS). response: $response_body"
        echo "$response_body" > "json_response_unauth_${choice}.json"
        cat "json_response_unauth_${choice}.json" >> "$DEPLOY_LOG_FILE" 2>/dev/null
        rm "json_response_unauth_${choice}.json" 2>/dev/null
        if [ $attempt -eq $max_retries ]; then
          log_message "ERROR" "phase 4: unauthenticated api test failed after $max_retries attempts. check logs: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION"
          return 1
        fi
        local delay=${retry_delays[$((attempt-1))]}
        log_message "INFO" "phase 4: retrying after $delay seconds..."
        sleep $delay
        attempt=$((attempt+1))
        continue
      fi
      echo "$response_body" > "json_response_unauth_${choice}.json"
      if [ "$HTTP_STATUS" -eq 500 ]; then
        log_message "ERROR" "phase 4: unauthenticated api test failed with status 500. response: $(cat json_response_unauth_${choice}.json)"
        log_message "INFO" "phase 4: response body saved to json_response_unauth_${choice}.json"
        cat "json_response_unauth_${choice}.json" >> "$DEPLOY_LOG_FILE"
        log_message "INFO" "phase 4: stack trace: $(jq -r '.stack // "no stack trace"' json_response_unauth_${choice}.json)"
        log_message "INFO" "phase 4: fetching recent logs for $FUNCTION_NAME..."
        gcloud functions logs read "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --limit=50 >> "$DEPLOY_LOG_FILE" 2>&1
        rm "json_response_unauth_${choice}.json" 2>/dev/null
        return 1
      fi
      if [ "$HTTP_STATUS" -eq 200 ]; then
        if jq -e . "json_response_unauth_${choice}.json" >/dev/null 2>>"$DEPLOY_LOG_FILE"; then
          log_message "SUCCESS" "phase 4: unauthenticated api test successful for $RESPONSE_TYPE! ✅"
          local table_output=""
          local response_json=$(cat "json_response_unauth_${choice}.json")
          local name=$(echo "$response_json" | jq -r '.results[0].taskEcho.task // "N/A"')
          local pert=$(echo "$response_json" | jq -r '.results[0].pertMean.value // "N/A"')
          local ci_lower=$(echo "$response_json" | jq -r '.results[0].ci.monteCarloSmoothed.lower // "N/A"')
          local ci_upper=$(echo "$response_json" | jq -r '.results[0].ci.monteCarloSmoothed.upper // "N/A"')
          local base_prob=$(echo "$response_json" | jq -r '.results[0].targetProbability.value.original // "N/A"')
          local bf=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.budgetFlexibility // "N/A"')
          local sf=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.scheduleFlexibility // "N/A"')
          local sc=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.scopeCertainty // "N/A"')
          local sra=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.scopeReductionAllowance // "N/A"')
          local rp=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.reworkPercentage // "N/A"')
          local rt=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.riskTolerance // "N/A"')
          local uc=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.userConfidence // "N/A"')
          local opt_prob=$(echo "$response_json" | jq -r '.results[0].targetProbability.value.adjustedOptimized // "N/A"')
          local sens_change=$(echo "$response_json" | jq -r '.results[0].sliderSensitivity.value.change // "N/A"')
          local kld=$(echo "$response_json" | jq -r '.results[0].baseline.metrics.klDivergenceToTriangle // "N/A"')
          local base_pdf=$(echo "$response_json" | jq -r '.results[0].baseline.monteCarloSmoothed.pdfPoints | length > 0 // "Empty"')
          local base_cdf=$(echo "$response_json" | jq -r '.results[0].baseline.monteCarloSmoothed.cdfPoints | length > 0 // "Empty"')
          local opt_pdf=$(echo "$response_json" | jq -r '.results[0].optimize.reshapedPoints.pdfPoints | length > 0 // "Empty"')
          local opt_cdf=$(echo "$response_json" | jq -r '.results[0].optimize.reshapedPoints.cdfPoints | length > 0 // "Empty"')
          local status=$(echo "$response_json" | jq -r '.results[0].optimize.status // "N/A"')

          table_output="${table_output}Column Name | Value Returned\n"
          table_output="${table_output}------------|---------------\n"
          table_output="${table_output}Name | $name\n"
          table_output="${table_output}Best Case | 10\n"
          table_output="${table_output}Most Likely | 20\n"
          table_output="${table_output}Worst Case | 30\n"
          table_output="${table_output}PERT | $pert\n"
          table_output="${table_output}MC Smoothed 95% CI Lower | $ci_lower\n"
          table_output="${table_output}MC Smoothed 95% CI Upper | $ci_upper\n"
          table_output="${table_output}% Confidence of Original PERT Value | $base_prob\n"
          table_output="${table_output}Optimal Budget Flexibility | $bf\n"
          table_output="${table_output}Optimal Schedule Flexibility | $sf\n"
          table_output="${table_output}Optimal Scope Certainty | $sc\n"
          table_output="${table_output}Optimal Scope Reduction Allowance | $sra\n"
          table_output="${table_output}Optimal Rework Percentage | $rp\n"
          table_output="${table_output}Optimal Risk Tolerance | $rt\n"
          table_output="${table_output}Optimal User Confidence | $uc\n"
          table_output="${table_output}% Confidence of Original PERT Value After Slider Optimization | $opt_prob\n"
          table_output="${table_output}MC Smoothed Sensitivity Change | $sens_change\n"
          table_output="${table_output}KL Divergence To Triangle | $kld\n"
          table_output="${table_output}Baseline MC Smoothed Points (PDF) | $base_pdf\n"
          table_output="${table_output}Baseline MC Smoothed Points (CDF) | $base_cdf\n"
          table_output="${table_output}Optimized MC Smoothed Points (PDF) | $opt_pdf\n"
          table_output="${table_output}Optimized MC Smoothed Points (CDF) | $opt_cdf\n"
          table_output="${table_output}Status | $status\n"

          log_message "INFO" "phase 4: unauthenticated api test results for $RESPONSE_TYPE:\n$table_output"
          echo -e "$table_output" >> "$DEPLOY_LOG_FILE"

          if [ "$choice" = "1" ]; then
            local expected_pert=$(echo "scale=2; (10 + 4*20 + 30)/6" | bc)
            if [ "$(echo "$pert == $expected_pert" | bc)" -ne 1 ]; then
              log_message "ERROR" "phase 4: pert value ($pert) does not match expected ($expected_pert)."
              return 1
            fi
            if [ "$base_pdf" = "Empty" ] || [ "$base_cdf" = "Empty" ]; then
              log_message "ERROR" "phase 4: baseline pdf/cdf points are empty."
              return 1
            fi
            if [ "$opt_pdf" = "Empty" ] || [ "$opt_cdf" = "Empty" ]; then
              log_message "ERROR" "phase 4: optimized pdf/cdf points are empty."
              return 1
            fi
            local neutral_sliders="50 50 50 50 0 50 50"
            local sliders="$bf $sf $sc $sra $rp $rt $uc"
            if [ "$sliders" = "$neutral_sliders" ]; then
              log_message "ERROR" "phase 4: sliders are neutral ($sliders); expected non-neutral for optimization."
              return 1
            fi
            log_message "SUCCESS" "phase 4: validation passed for $RESPONSE_TYPE: pert=20, non-empty points, non-neutral sliders."
          fi

          rm "json_response_unauth_${choice}.json" 2>/dev/null
          break
        else
          log_message "ERROR" "phase 4: invalid json response for unauthenticated $RESPONSE_TYPE. response: $(cat json_response_unauth_${choice}.json)"
          log_message "INFO" "phase 4: response body saved to json_response_unauth_${choice}.json"
          cat "json_response_unauth_${choice}.json" >> "$DEPLOY_LOG_FILE"
          log_message "INFO" "phase 4: stack trace: $(jq -r '.stack // "no stack trace"' json_response_unauth_${choice}.json)"
          log_message "INFO" "phase 4: fetching recent logs for $FUNCTION_NAME..."
          gcloud functions logs read "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --limit=50 >> "$DEPLOY_LOG_FILE" 2>&1
          rm "json_response_unauth_${choice}.json" 2>/dev/null
          return 1
        fi
      else
        log_message "ERROR" "phase 4: unauthenticated api test failed with status $HTTP_STATUS. response: $(cat json_response_unauth_${choice}.json)"
        log_message "INFO" "phase 4: response body saved to json_response_unauth_${choice}.json"
        cat "json_response_unauth_${choice}.json" >> "$DEPLOY_LOG_FILE"
        log_message "INFO" "phase 4: stack trace: $(jq -r '.stack // "no stack trace"' json_response_unauth_${choice}.json)"
        log_message "INFO" "phase 4: fetching recent logs for $FUNCTION_NAME..."
        gcloud functions logs read "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --limit=50 >> "$DEPLOY_LOG_FILE" 2>&1
        rm "json_response_unauth_${choice}.json" 2>/dev/null
        return 1
      fi
    done
  done
  return 0
}

# Test API (authenticated)
test_api_authenticated() {
  log_message "INFO" "PHASE 7: READY TO TEST THE API WITH AUTHENTICATION? (Y/N)"
  read -r confirm
  if ! echo "$confirm" | grep -qi '^y$'; then
    log_message "INFO" "phase 7: authenticated api testing skipped by user."
    return 0
  fi
  log_message "INFO" "phase 7: testing api with authentication to verify secure access with service account..."
  local FUNCTION_URL="https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}"
  local TEST_PAYLOAD_PROJECT1='[{"task":"Project_1","optimistic":10,"mostLikely":20,"pessimistic":30,"targetValue":20,"confidenceLevel":0.95,"optimizeFor":"target","optimize":true,"distributionType":"monte-carlo-smoothed"}]'
  local TEST_PAYLOAD_TARGET='[{"task":"Test Target","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"targetValue":2500,"confidenceLevel":0.95,"optimizeFor":"target","optimize":false,"distributionType":"monte-carlo-smoothed"}]'

  log_message "INFO" "phase 7: validating service account key..."
  local KEY_CLIENT_EMAIL
  KEY_CLIENT_EMAIL=$(jq -r '.client_email' "$SERVICE_ACCOUNT_KEY" 2>>"$DEPLOY_LOG_FILE")
  if [ "$KEY_CLIENT_EMAIL" != "$SERVICE_ACCOUNT_EMAIL" ]; then
    log_message "ERROR" "phase 7: service account key client_email ($KEY_CLIENT_EMAIL) does not match $SERVICE_ACCOUNT_EMAIL."
    return 1
  fi
  local PRIVATE_KEY
  PRIVATE_KEY=$(jq -r '.private_key' "$SERVICE_ACCOUNT_KEY" 2>>"$DEPLOY_LOG_FILE")
  if [ -z "$PRIVATE_KEY" ]; then
    log_message "ERROR" "phase 7: failed to extract private_key from $SERVICE_ACCOUNT_KEY."
    return 1
  fi
  log_message "SUCCESS" "phase 7: service account key validated: $KEY_CLIENT_EMAIL"

  log_message "INFO" "phase 7: generating jwt..."
  local HEADER PAYLOAD SIGNATURE_INPUT SIGNATURE JWT
  HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')
  NOW=$(date +%s)
  PAYLOAD=$(echo -n "{\"iss\":\"${KEY_CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"target_audience\":\"${FUNCTION_URL}\"}" | base64 -w0 | tr -d '=' | tr '/+' '_-')
  SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
  TEMP_KEY_FILE=$(mktemp)
  echo "$PRIVATE_KEY" > "$TEMP_KEY_FILE"
  SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign "$TEMP_KEY_FILE" | base64 -w0 | tr -d '=' | tr '/+' '_-' 2>>"$DEPLOY_LOG_FILE")
  rm "$TEMP_KEY_FILE" 2>/dev/null
  if [ -z "$SIGNATURE" ]; then
    log_message "ERROR" "phase 7: failed to generate signature for jwt. check openssl command and service account key."
    return 1
  fi
  JWT="${SIGNATURE_INPUT}.${SIGNATURE}"
  log_message "SUCCESS" "phase 7: jwt generated successfully."

  log_message "INFO" "phase 7: exchanging jwt for id token..."
  local TOKEN_RESPONSE TOKEN
  local temp_err=$(mktemp)
  local temp_out=$(mktemp)
  (curl -s -m 30 -X POST https://oauth2.googleapis.com/token \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}" >"$temp_out" 2>"$temp_err") &
  progress_bar $!
  local curl_exit=$?
  local curl_error=$(cat "$temp_err")
  TOKEN_RESPONSE=$(cat "$temp_out")
  rm "$temp_err" "$temp_out" 2>/dev/null
  if [ $curl_exit -ne 0 ]; then
    log_message "ERROR" "phase 7: failed to connect to token endpoint (curl exit code: $curl_exit). error: $curl_error"
    return 1
  fi
  if [ -z "$TOKEN_RESPONSE" ]; then
    log_message "ERROR" "phase 7: no response from token endpoint. error: $curl_error"
    return 1
  fi
  TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token' 2>>"$DEPLOY_LOG_FILE")
  if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
    log_message "ERROR" "phase 7: failed to obtain id token. response: $TOKEN_RESPONSE"
    return 1
  fi
  log_message "SUCCESS" "phase 7: id token obtained successfully! 🔑"

  echo "${YELLOW}SELECT TEST PAYLOADS (SPACE-SEPARATED, E.G., '1 2'):${NC}"
  echo "1) Project_1 full response (O=10, M=20, P=30, target=20)"
  echo "2) Target probability response (O=1800, M=2400, P=3000, target=2500)"
  echo "3) Skip test"
  read -r choices
  if [ -z "$choices" ]; then
    choices="1"
  fi

  for choice in $choices; do
    case "$choice" in
      1) TEST_PAYLOAD="$TEST_PAYLOAD_PROJECT1"; RESPONSE_TYPE="Project_1 full response" ;;
      2) TEST_PAYLOAD="$TEST_PAYLOAD_TARGET"; RESPONSE_TYPE="Target probability response" ;;
      3) log_message "INFO" "phase 7: skipping authenticated api test."; continue ;;
      *) log_message "WARNING" "phase 7: invalid choice $choice. skipping."; continue ;;
    esac

    max_retries=4
    retry_delays=(10 20 40 80)
    attempt=1
    while [ $attempt -le $max_retries ]; do
      log_message "INFO" "phase 7 (attempt $attempt/$max_retries): testing $RESPONSE_TYPE with authentication to verify secure access and data consistency..."
      local temp_err=$(mktemp)
      local temp_out=$(mktemp)
      local HTTP_STATUS
      local response_body
      curl -s -m 30 -w "\n%{http_code}" -X POST "$FUNCTION_URL" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d "$TEST_PAYLOAD" -o "$temp_out" 2>"$temp_err"
      if [ -s "$temp_out" ]; then
        HTTP_STATUS=$(tail -n 1 "$temp_out" | tr -d '\r' | tr -d '\n')
        response_body=$(sed -e :a -e '$d;N;2,3ba' -e 'P;D' "$temp_out" | tr -d '\r' | tr -d '\n')
      else
        HTTP_STATUS=""
        response_body=""
      fi
      local curl_exit=$?
      local curl_error=$(cat "$temp_err")
      rm "$temp_err" "$temp_out" 2>/dev/null
      if [ $curl_exit -ne 0 ]; then
        log_message "ERROR" "phase 7: failed to connect to authenticated api (curl exit code: $curl_exit). error: $curl_error"
        echo "$response_body" > "json_response_auth_${choice}.json"
        cat "json_response_auth_${choice}.json" >> "$DEPLOY_LOG_FILE" 2>/dev/null
        rm "json_response_auth_${choice}.json" 2>/dev/null
        if [ $attempt -eq $max_retries ]; then
          log_message "ERROR" "phase 7: authenticated api test failed after $max_retries attempts. check logs: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION"
          return 1
        fi
        local delay=${retry_delays[$((attempt-1))]}
        log_message "INFO" "phase 7: retrying after $delay seconds..."
        sleep $delay
        attempt=$((attempt+1))
        continue
      fi
      if [ -z "$HTTP_STATUS" ] || ! echo "$HTTP_STATUS" | grep -qE '^[0-9]{3}$'; then
        log_message "ERROR" "phase 7: invalid or no http status received from api call (status: $HTTP_STATUS). response: $response_body"
        echo "$response_body" > "json_response_auth_${choice}.json"
        cat "json_response_auth_${choice}.json" >> "$DEPLOY_LOG_FILE" 2>/dev/null
        rm "json_response_auth_${choice}.json" 2>/dev/null
        if [ $attempt -eq $max_retries ]; then
          log_message "ERROR" "phase 7: authenticated api test failed after $max_retries attempts. check logs: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION"
          return 1
        fi
        local delay=${retry_delays[$((attempt-1))]}
        log_message "INFO" "phase 7: retrying after $delay seconds..."
        sleep $delay
        attempt=$((attempt+1))
        continue
      fi
      echo "$response_body" > "json_response_auth_${choice}.json"
      if [ "$HTTP_STATUS" -eq 500 ]; then
        log_message "ERROR" "phase 7: authenticated api test failed with status 500. response: $(cat json_response_auth_${choice}.json)"
        log_message "INFO" "phase 7: response body saved to json_response_auth_${choice}.json"
        cat "json_response_auth_${choice}.json" >> "$DEPLOY_LOG_FILE"
        log_message "INFO" "phase 7: stack trace: $(jq -r '.stack // "no stack trace"' json_response_auth_${choice}.json)"
        log_message "INFO" "phase 7: fetching recent logs for $FUNCTION_NAME..."
        gcloud functions logs read "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --limit=50 >> "$DEPLOY_LOG_FILE" 2>&1
        rm "json_response_auth_${choice}.json" 2>/dev/null
        return 1
      fi
      if [ "$HTTP_STATUS" -eq 200 ]; then
        if jq -e . "json_response_auth_${choice}.json" >/dev/null 2>>"$DEPLOY_LOG_FILE"; then
          log_message "SUCCESS" "phase 7: authenticated api test successful for $RESPONSE_TYPE! ✅"
          local table_output=""
          local response_json=$(cat "json_response_auth_${choice}.json")
          local name=$(echo "$response_json" | jq -r '.results[0].taskEcho.task // "N/A"')
          local pert=$(echo "$response_json" | jq -r '.results[0].pertMean.value // "N/A"')
          local ci_lower=$(echo "$response_json" | jq -r '.results[0].ci.monteCarloSmoothed.lower // "N/A"')
          local ci_upper=$(echo "$response_json" | jq -r '.results[0].ci.monteCarloSmoothed.upper // "N/A"')
          local base_prob=$(echo "$response_json" | jq -r '.results[0].targetProbability.value.original // "N/A"')
          local bf=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.budgetFlexibility // "N/A"')
          local sf=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.scheduleFlexibility // "N/A"')
          local sc=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.scopeCertainty // "N/A"')
          local sra=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.scopeReductionAllowance // "N/A"')
          local rp=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.reworkPercentage // "N/A"')
          local rt=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.riskTolerance // "N/A"')
          local uc=$(echo "$response_json" | jq -r '.results[0].optimize.sliders.userConfidence // "N/A"')
          local opt_prob=$(echo "$response_json" | jq -r '.results[0].targetProbability.value.adjustedOptimized // "N/A"')
          local sens_change=$(echo "$response_json" | jq -r '.results[0].sliderSensitivity.value.change // "N/A"')
          local kld=$(echo "$response_json" | jq -r '.results[0].baseline.metrics.klDivergenceToTriangle // "N/A"')
          local base_pdf=$(echo "$response_json" | jq -r '.results[0].baseline.monteCarloSmoothed.pdfPoints | length > 0 // "Empty"')
          local base_cdf=$(echo "$response_json" | jq -r '.results[0].baseline.monteCarloSmoothed.cdfPoints | length > 0 // "Empty"')
          local opt_pdf=$(echo "$response_json" | jq -r '.results[0].optimize.reshapedPoints.pdfPoints | length > 0 // "Empty"')
          local opt_cdf=$(echo "$response_json" | jq -r '.results[0].optimize.reshapedPoints.cdfPoints | length > 0 // "Empty"')
          local status=$(echo "$response_json" | jq -r '.results[0].optimize.status // "N/A"')

          table_output="${table_output}Column Name | Value Returned\n"
          table_output="${table_output}------------|---------------\n"
          table_output="${table_output}Name | $name\n"
          table_output="${table_output}Best Case | 10\n"
          table_output="${table_output}Most Likely | 20\n"
          table_output="${table_output}Worst Case | 30\n"
          table_output="${table_output}PERT | $pert\n"
          table_output="${table_output}MC Smoothed 95% CI Lower | $ci_lower\n"
          table_output="${table_output}MC Smoothed 95% CI Upper | $ci_upper\n"
          table_output="${table_output}% Confidence of Original PERT Value | $base_prob\n"
          table_output="${table_output}Optimal Budget Flexibility | $bf\n"
          table_output="${table_output}Optimal Schedule Flexibility | $sf\n"
          table_output="${table_output}Optimal Scope Certainty | $sc\n"
          table_output="${table_output}Optimal Scope Reduction Allowance | $sra\n"
          table_output="${table_output}Optimal Rework Percentage | $rp\n"
          table_output="${table_output}Optimal Risk Tolerance | $rt\n"
          table_output="${table_output}Optimal User Confidence | $uc\n"
          table_output="${table_output}% Confidence of Original PERT Value After Slider Optimization | $opt_prob\n"
          table_output="${table_output}MC Smoothed Sensitivity Change | $sens_change\n"
          table_output="${table_output}KL Divergence To Triangle | $kld\n"
          table_output="${table_output}Baseline MC Smoothed Points (PDF) | $base_pdf\n"
          table_output="${table_output}Baseline MC Smoothed Points (CDF) | $base_cdf\n"
          table_output="${table_output}Optimized MC Smoothed Points (PDF) | $opt_pdf\n"
          table_output="${table_output}Optimized MC Smoothed Points (CDF) | $opt_cdf\n"
          table_output="${table_output}Status | $status\n"

          log_message "INFO" "phase 7: authenticated api test results for $RESPONSE_TYPE:\n$table_output"
          echo -e "$table_output" >> "$DEPLOY_LOG_FILE"

          if [ "$choice" = "1" ]; then
            local expected_pert=$(echo "scale=2; (10 + 4*20 + 30)/6" | bc)
            if [ "$(echo "$pert == $expected_pert" | bc)" -ne 1 ]; then
              log_message "ERROR" "phase 7: pert value ($pert) does not match expected ($expected_pert)."
              return 1
            fi
            if [ "$base_pdf" = "Empty" ] || [ "$base_cdf" = "Empty" ]; then
              log_message "ERROR" "phase 7: baseline pdf/cdf points are empty."
              return 1
            fi
            if [ "$opt_pdf" = "Empty" ] || [ "$opt_cdf" = "Empty" ]; then
              log_message "ERROR" "phase 7: optimized pdf/cdf points are empty."
              return 1
            fi
            local neutral_sliders="50 50 50 50 0 50 50"
            local sliders="$bf $sf $sc $sra $rp $rt $uc"
            if [ "$sliders" = "$neutral_sliders" ]; then
              log_message "ERROR" "phase 7: sliders are neutral ($sliders); expected non-neutral for optimization."
              return 1
            fi
            log_message "SUCCESS" "phase 7: validation passed for $RESPONSE_TYPE: pert=20, non-empty points, non-neutral sliders."
          fi

          rm "json_response_auth_${choice}.json" 2>/dev/null
          break
        else
          log_message "ERROR" "phase 7: invalid json response for authenticated $RESPONSE_TYPE. response: $(cat json_response_auth_${choice}.json)"
          log_message "INFO" "phase 7: response body saved to json_response_auth_${choice}.json"
          cat "json_response_auth_${choice}.json" >> "$DEPLOY_LOG_FILE"
          log_message "INFO" "phase 7: stack trace: $(jq -r '.stack // "no stack trace"' json_response_auth_${choice}.json)"
          log_message "INFO" "phase 7: fetching recent logs for $FUNCTION_NAME..."
          gcloud functions logs read "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --limit=50 >> "$DEPLOY_LOG_FILE" 2>&1
          rm "json_response_auth_${choice}.json" 2>/dev/null
          return 1
        fi
      else
        log_message "ERROR" "phase 7: authenticated api test failed with status $HTTP_STATUS. response: $(cat json_response_auth_${choice}.json)"
        log_message "INFO" "phase 7: response body saved to json_response_auth_${choice}.json"
        cat "json_response_auth_${choice}.json" >> "$DEPLOY_LOG_FILE"
        log_message "INFO" "phase 7: stack trace: $(jq -r '.stack // "no stack trace"' json_response_auth_${choice}.json)"
        log_message "INFO" "phase 7: fetching recent logs for $FUNCTION_NAME..."
        gcloud functions logs read "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --limit=50 >> "$DEPLOY_LOG_FILE" 2>&1
        rm "json_response_auth_${choice}.json" 2>/dev/null
        return 1
      fi
    done
  done
  return 0
}

# Validate deployment
validate_deploy() {
  log_message "INFO" "phase 8: validating deployment - checking function status and iam policies..."
  local validation_messages=""
  local status=0

  local function_describe
  function_describe=$(gcloud functions describe "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --format=json 2>>"$DEPLOY_LOG_FILE")
  if [ $? -ne 0 ]; then
    validation_messages="${validation_messages}${RED}❌ failure: failed to describe function $FUNCTION_NAME. check cloud build logs: https://console.cloud.google.com/cloud-build/builds;region=$REGION?project=$PROJECT_ID${NC}\n"
    status=1
  else
    local function_status
    function_status=$(echo "$function_describe" | jq -r '.status // "UNKNOWN"')
    local function_url
    function_url=$(echo "$function_describe" | jq -r '.httpsTrigger.url // ""')
    if [ "$function_status" != "ACTIVE" ]; then
      validation_messages="${validation_messages}${RED}❌ failure: function $FUNCTION_NAME is not active (status: $function_status). check logs: gcloud functions logs read $FUNCTION_NAME --project=$PROJECT_ID --region=$REGION${NC}\n"
      status=1
    elif [ -z "$function_url" ]; then
      validation_messages="${validation_messages}${RED}❌ failure: function $FUNCTION_NAME has no https trigger url.${NC}\n"
      status=1
    else
      validation_messages="${validation_messages}${GREEN}✅ success: function $FUNCTION_NAME is active with url $function_url.${NC}\n"
    fi
  fi

  local iam_policy
  iam_policy=$(gcloud functions get-iam-policy "$FUNCTION_NAME" --project="$PROJECT_ID" --region="$REGION" --format=json 2>>"$DEPLOY_LOG_FILE")
  if [ $? -ne 0 ]; then
    validation_messages="${validation_messages}${YELLOW}⚠️ warning: failed to retrieve iam policy. ensure permissions for cloudfunctions.functions.getIamPolicy.${NC}\n"
  else
    if echo "$iam_policy" | jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.invoker\" and .members[]==\"serviceAccount:$SERVICE_ACCOUNT_EMAIL\")" >/dev/null 2>>"$DEPLOY_LOG_FILE"; then
      validation_messages="${validation_messages}${GREEN}✅ success: iam policy restricts invocation to $SERVICE_ACCOUNT_EMAIL.${NC}\n"
    else
      validation_messages="${validation_messages}${RED}❌ failure: iam policy does not include $SERVICE_ACCOUNT_EMAIL for roles/cloudfunctions.invoker.${NC}\n"
      status=1
    fi
    if echo "$iam_policy" | jq -e '.bindings[] | select(.members[] | contains("allUsers") or contains("allAuthenticatedUsers"))' >/dev/null 2>>"$DEPLOY_LOG_FILE"; then
      validation_messages="${validation_messages}${RED}❌ failure: iam policy contains public access bindings (allUsers/allAuthenticatedUsers).${NC}\n"
      status=1
    else
      validation_messages="${validation_messages}${GREEN}✅ success: no public access bindings in iam policy.${NC}\n"
    fi
  fi

  log_message "INFO" "phase 8: validation summary:"
  echo "$validation_messages" >> "$DEPLOY_LOG_FILE"
  echo "$validation_messages"

  if [ $status -eq 0 ]; then
    log_message "SUCCESS" "phase 8: deployment validation passed! function is active and secure."
  else
    log_message "ERROR" "phase 8: deployment validation failed. check details above."
    return 1
  fi
  return $status
}

# Main execution
main() {
  log_message "INFO" "starting deployment of $FUNCTION_NAME to $PROJECT_ID in $REGION..."
  check_prerequisites || { log_message "ERROR" "deployment failed at phase 1."; exit 1; }
  install_dependencies || { log_message "ERROR" "deployment failed at phase 2."; exit 1; }
  deploy_function_unauthenticated || { log_message "ERROR" "deployment failed at phase 3."; exit 1; }
  test_api_unauthenticated || { log_message "ERROR" "deployment failed at phase 4."; exit 1; }
  deploy_function_restricted || { log_message "ERROR" "deployment failed at phase 5."; exit 1; }
  restrict_api_access || { log_message "ERROR" "deployment failed at phase 6."; exit 1; }
  test_api_authenticated || { log_message "ERROR" "deployment failed at phase 7."; exit 1; }
  validate_deploy || { log_message "ERROR" "deployment failed at phase 8."; exit 1; }
  log_message "SUCCESS" "all deployment phases completed successfully! 🎉"
  log_message "INFO" "function url: https://${REGION}-${PROJECT_ID}.cloudfunctions.net/$FUNCTION_NAME"
  log_message "INFO" "runtime: nodejs20"
  log_message "INFO" "logs: $DEPLOY_LOG_FILE"
  log_message "INFO" "next steps: verify with code.gs in google sheets. ensure apps script project is associated with $PROJECT_ID (project number 615922754202)."
  log_message "INFO" "run 'gcloud components update' if you encounter cli issues."
}

main
