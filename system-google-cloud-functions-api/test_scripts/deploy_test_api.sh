#!/bin/bash

# deploy_test_api.sh
# WHAT: Tests the pmcEstimatorAPI Cloud Function with JWT authentication and dynamically returns all fields in the JSON response.
# WHY: Validates API functionality and displays response structure, aligning with Code.gs and Plot.html integration.
# WHERE: Run from /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api.
# HOW:
#   - Uses icarenow@pmc-estimator.iam.gserviceaccount.com and pmc-estimator-b50a03244199.json for JWT authentication.
#   - Tests with full response and target probability payloads.
#   - Displays high-level fields hierarchically with drill-down using numeric-only numbering (1.1, 1.1.1).
#   - Summarizes PDF/CDF arrays with a 'plot points' option, using existing JSON data for point selection.
# CHANGES:
#   - Suppressed individual point enumeration for PDF/CDF arrays in initial display.
#   - Added 'plot points' option for drill-down to specific points or samples without additional API calls.
#   - Used jq exclusively, removing all external commands (sed, sort, head, grep, awk, cut).
#   - Implemented numeric-only hierarchy (1, 1.1, 1.1.1).
#   - Saved full field list to fields_${TEST_CHOICE}.txt.
#   - Ensured Bash 3.2 compatibility.
#   - Fixed JWT generation with temporary file.

# Ensure PATH includes /usr/bin and /bin
export PATH=$PATH:/usr/bin:/bin

# Debug environment
echo -e "Debug: PATH=$PATH"
for cmd in jq curl openssl; do
  if command -v "$cmd" &>/dev/null; then
    echo -e "Debug: $cmd found at $(which $cmd)"
  else
    echo -e "\033[0;31mError: $cmd not found. Install it (e.g., 'brew install $cmd').\033[0m"
    exit 1
  fi
done

test_api() {
  local project_id="$1"
  local region="$2"
  local function_name="$3"
  local service_account_email="$4"
  local service_account_key="$5"
  local RED='\033[0;31m'
  local GREEN='\033[0;32m'
  local YELLOW='\033[1;33m'
  local NC='\033[0m'

  local FUNCTION_URL="https://${region}-${project_id}.cloudfunctions.net/${function_name}"
  local TEST_PAYLOAD_FULL='[{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeCertainty":50,"scopeReductionAllowance":50,"reworkPercentage":50,"riskTolerance":50},"targetValue":2500,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target","userSlider_Confidence":"confident"}]'
  local TEST_PAYLOAD_TARGET='[{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeCertainty":50,"scopeReductionAllowance":50,"reworkPercentage":50,"riskTolerance":50},"targetValue":2500,"confidenceLevel":0.9,"targetProbabilityOnly":true,"optimizeFor":"target","userSlider_Confidence":"confident"}]'

  echo -e "${YELLOW}Testing pmcEstimatorAPI at $FUNCTION_URL...${NC}"
  echo -e "${YELLOW}Select test payloads:${NC}"
  echo -e "  (1) Full response (all fields)"
  echo -e "  (2) Target probability fields only"
  echo -e "  (3) No test"
  echo -e "${YELLOW}Enter selections (space-separated, e.g., '1 2' for both):${NC}"
  read -a TEST_CHOICES

  if [ ${#TEST_CHOICES[@]} -eq 0 ] || [[ " ${TEST_CHOICES[*]} " =~ " 3 " ]]; then
    echo -e "${GREEN}Skipping API test.${NC}"
    return 0
  fi

  # Validate service account key
  if [ ! -f "$service_account_key" ]; then
    echo -e "${RED}Error: Service account key file $service_account_key not found.${NC}"
    return 1
  fi
  KEY_CLIENT_EMAIL=$(jq -r '.client_email' "$service_account_key" 2>/dev/null)
  if [ "$KEY_CLIENT_EMAIL" != "$service_account_email" ]; then
    echo -e "${RED}Error: Service account key client_email ($KEY_CLIENT_EMAIL) does not match $service_account_email. Regenerate key with: gcloud iam service-accounts keys create <new-key-file>.json --iam-account=$service_account_email --project=$project_id${NC}"
    return 1
  fi
  PRIVATE_KEY=$(jq -r '.private_key' "$service_account_key")
  if [ -z "$PRIVATE_KEY" ]; then
    echo -e "${RED}Error: Failed to extract private_key from $service_account_key.${NC}"
    return 1
  fi
  echo -e "${GREEN}Service account key validated: $KEY_CLIENT_EMAIL${NC}"

  for TEST_CHOICE in "${TEST_CHOICES[@]}"; do
    if [ "$TEST_CHOICE" != "1" ] && [ "$TEST_CHOICE" != "2" ]; then
      echo -e "${RED}Invalid selection '$TEST_CHOICE'. Skipping.${NC}"
      continue
    fi

    echo -e "${YELLOW}Testing API for choice $TEST_CHOICE...${NC}"
    if [ "$TEST_CHOICE" = "1" ]; then
      TEST_PAYLOAD="$TEST_PAYLOAD_FULL"
      RESPONSE_TYPE="Full response"
    else
      TEST_PAYLOAD="$TEST_PAYLOAD_TARGET"
      RESPONSE_TYPE="Target probability response"
    fi

    # Generate JWT
    echo -e "${YELLOW}Generating JWT for $RESPONSE_TYPE...${NC}"
    HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')
    NOW=$(date +%s)
    PAYLOAD=$(echo -n "{\"iss\":\"${KEY_CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"target_audience\":\"${FUNCTION_URL}\"}" | base64 -w0 | tr -d '=' | tr '/+' '_-')
    SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
    # Write private key to a temporary file
    TEMP_KEY_FILE=$(mktemp)
    echo "$PRIVATE_KEY" > "$TEMP_KEY_FILE"
    SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign "$TEMP_KEY_FILE" | base64 -w0 | tr -d '=' | tr '/+' '_-')
    rm "$TEMP_KEY_FILE" 2>/dev/null
    if [ -z "$SIGNATURE" ]; then
      echo -e "${RED}Error: Failed to generate signature for JWT for $RESPONSE_TYPE.${NC}"
      return 1
    fi
    JWT="${SIGNATURE_INPUT}.${SIGNATURE}"
    if [ -z "$JWT" ]; then
      echo -e "${RED}Error: Failed to generate JWT for $RESPONSE_TYPE.${NC}"
      return 1
    fi
    echo -e "${GREEN}JWT generated successfully for $RESPONSE_TYPE.${NC}"

    # Exchange JWT for ID token
    echo -e "${YELLOW}Exchanging JWT for ID token for $RESPONSE_TYPE...${NC}"
    TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}" 2> token_error.log)
    if [ -z "$TOKEN_RESPONSE" ]; then
      echo -e "${RED}Error: No response from token endpoint for $RESPONSE_TYPE. Check network or https://oauth2.googleapis.com/token availability.${NC}"
      cat token_error.log
      rm token_error.log
      return 1
    fi
    TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token' 2>/dev/null)
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
      echo -e "${RED}Error: Failed to obtain ID token for $RESPONSE_TYPE. Response: $TOKEN_RESPONSE${NC}"
      cat token_error.log
      rm token_error.log
      return 1
    fi
    rm token_error.log
    echo -e "${GREEN}ID token obtained successfully for $RESPONSE_TYPE.${NC}"

    # Test API with ID token (with retries)
    max_retries=3
    retry_delay=10
    for attempt in $(seq 1 $max_retries); do
      echo -e "${YELLOW}Attempt $attempt/$max_retries: Testing API for $RESPONSE_TYPE...${NC}"
      JSON_RESPONSE=$(curl -s -w "%{http_code}" -X POST "$FUNCTION_URL" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$TEST_PAYLOAD" -o json_response_${TEST_CHOICE}.json 2> curl_error.log)
      if [ "$JSON_RESPONSE" -eq 200 ]; then
        echo -e "${GREEN}Test successful for $RESPONSE_TYPE.${NC}"
        if ! jq -e '.' json_response_${TEST_CHOICE}.json >/dev/null 2>&1; then
          echo -e "${RED}Error: Invalid JSON response for $RESPONSE_TYPE.${NC}"
          cat json_response_${TEST_CHOICE}.json
          rm json_response_${TEST_CHOICE}.json curl_error.log
          return 1
        fi
        break
      else
        echo -e "${RED}Error: Test failed for $RESPONSE_TYPE (status: $JSON_RESPONSE).${NC}"
        cat json_response_${TEST_CHOICE}.json
        cat curl_error.log
        if [ $attempt -eq $max_retries ]; then
          echo -e "${RED}Error: API test failed after $max_retries attempts. Debugging steps:${NC}"
          echo -e "${YELLOW}- Check function logs: gcloud functions logs read $function_name --project=$project_id --region=$region${NC}"
          echo -e "${YELLOW}- Check Cloud Build logs: https://console.cloud.google.com/cloud-build/builds;region=$region?project=$project_id${NC}"
          echo -e "${YELLOW}- Verify resource limits: gcloud functions describe $function_name --project=$project_id --region=$region${NC}"
          echo -e "${YELLOW}- Increase memory: gcloud functions deploy $function_name --memory=1024MB ...${NC}"
          echo -e "${YELLOW}- Check VPC Service Controls: gcloud access-context-manager policies list --organization=<ORG_ID>${NC}"
          rm json_response_${TEST_CHOICE}.json curl_error.log
          return 1
        fi
        echo -e "${YELLOW}Retrying after $retry_delay seconds...${NC}"
        sleep $retry_delay
      fi
    done

    # Filter fields for target probability response
    JQ_FILTER="."
    if [ "$TEST_CHOICE" = "2" ]; then
      JQ_FILTER='. | {results: [.results[] | {task, targetProbability, feedbackMessages, error}]}'
    fi

    # Debug jq output
    echo -e "${YELLOW}Debug: Writing filtered JSON to json_filtered_${TEST_CHOICE}.json${NC}"
    jq "$JQ_FILTER" json_response_${TEST_CHOICE}.json > json_filtered_${TEST_CHOICE}.json 2> jq_error.log
    if [ $? -ne 0 ]; then
      echo -e "${RED}Error: jq filtering failed for $RESPONSE_TYPE.${NC}"
      cat jq_error.log
      cat json_response_${TEST_CHOICE}.json
      rm json_response_${TEST_CHOICE}.json json_filtered_${TEST_CHOICE}.json jq_error.log curl_error.log
      return 1
    fi
    echo -e "${YELLOW}Debug: First 5 lines of json_filtered_${TEST_CHOICE}.json:${NC}"
    jq -r 'limit(5; .[] | tostring)' json_filtered_${TEST_CHOICE}.json 2>/dev/null || echo "Unable to display json_filtered_${TEST_CHOICE}.json"

    # Debug subshell PATH
    echo -e "${YELLOW}Debug: Subshell PATH: $(bash -c 'echo $PATH')${NC}"

    # Use jq to get all field paths recursively
    FIELD_PATHS=($(jq -r 'paths(scalars) | join(".")' json_filtered_${TEST_CHOICE}.json 2>/dev/null))
    if [ ${#FIELD_PATHS[@]} -eq 0 ]; then
      echo -e "${RED}Error: No fields found in JSON response for $RESPONSE_TYPE.${NC}"
      cat json_filtered_${TEST_CHOICE}.json
      rm json_response_${TEST_CHOICE}.json json_filtered_${TEST_CHOICE}.json curl_error.log
      return 1
    fi

    # Save full field list to file
    echo -e "${YELLOW}Debug: Saving full field list to fields_${TEST_CHOICE}.txt${NC}"
    for PATH in "${FIELD_PATHS[@]}"; do
      echo "$PATH" >> fields_${TEST_CHOICE}.txt
    done

    # Group fields by category
    CATEGORIES=(
      "Estimates task optimistic mostLikely pessimistic"
      "Moments triangleMean pertMean betaMean alpha beta baselineMoments mcUnsmoothedMean mcUnsmoothedVariance mcUnsmoothedStdDev mcSmoothedMean mcSmoothedVariance mcSmoothedStdDev"
      "Probabilities probExceedPertMeanMC targetProbability valueAtConfidence mcVaR mcCVaR mcMAD mcMedian"
      "Sensitivity sensitivityMatrix sliderSensitivity distributionShift"
      "Sliders optimalSliderSettings"
      "PDF Points targetProbabilityOriginalPdf targetProbabilityAdjustedPdf targetProbabilityAdjustedOptimizedPdf allDistributions.triangle.pdfPoints allDistributions.pert.pdfPoints allDistributions.beta.pdfPoints allDistributions.monteCarloRaw.pdfPoints allDistributions.monteCarloSmoothed.pdfPoints adjustedPoints.pdfPoints optimizedPoints.pdfPoints"
      "CDF Points targetProbabilityOriginalCdf targetProbabilityAdjustedCdf targetProbabilityAdjustedOptimizedCdf allDistributions.triangle.cdfPoints allDistributions.pert.cdfPoints allDistributions.beta.cdfPoints allDistributions.monteCarloRaw.cdfPoints allDistributions.monteCarloSmoothed.cdfPoints adjustedPoints.cdfPoints optimizedPoints.cdfPoints"
      "Summaries dynamicOutcome scenarioSummary"
      "Other feedbackMessages error"
    )

    echo -e "${YELLOW}Available JSON fields for $RESPONSE_TYPE (grouped):${NC}"
    MENU_NUMBERS=()
    MENU_PATHS=()
    COUNT=0
    for CATEGORY in "${CATEGORIES[@]}"; do
      # Parse category name and fields using Bash
      CATEGORY_NAME="${CATEGORY%% *}"
      CATEGORY_FIELDS="${CATEGORY#* }"
      COUNT=$((COUNT+1))
      MENU_NUMBERS+=("$COUNT")
      MENU_PATHS+=("$CATEGORY_NAME")
      echo -e "${YELLOW}$CATEGORY_NAME:${NC}"
      echo "  $COUNT) $CATEGORY_NAME (category)"
      SUBCOUNT=0
      for FIELD in $CATEGORY_FIELDS; do
        if [ "$CATEGORY_NAME" = "PDF Points" ] || [ "$CATEGORY_NAME" = "CDF Points" ]; then
          # Handle array fields for PDF Points and CDF Points
          ARRAY_PATHS=($(jq -r "paths(arrays) | join(\".\") | select(test(\"${FIELD//./\\.}[:${#FIELD}].*value$\"))" json_filtered_${TEST_CHOICE}.json 2>/dev/null))
          for ARRAY_PATH in "${ARRAY_PATHS[@]}"; do
            SUBCOUNT=$((SUBCOUNT+1))
            COUNT=$((COUNT+1))
            MENU_NUMBERS+=("$COUNT.$SUBCOUNT")
            MENU_PATHS+=("$ARRAY_PATH")
            DISPLAY_PATH=$(jq -r "[.\"$ARRAY_PATH\" | split(\".\") | .[:-1] | join(\".\")] | if . == \"\" then \"$ARRAY_PATH\" else . end | sub(\"\\\\.[0-9]+\"; \"[*]\")" json_filtered_${TEST_CHOICE}.json 2>/dev/null || echo "$ARRAY_PATH")
            ARRAY_LENGTH=$(jq -r ".${ARRAY_PATH} | length" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
            echo "    $COUNT.$SUBCOUNT) $DISPLAY_PATH (array, $ARRAY_LENGTH points)"
            COUNT=$((COUNT+1))
            MENU_NUMBERS+=("$COUNT.$SUBCOUNT.1")
            MENU_PATHS+=("$ARRAY_PATH::plot_points")
            echo "      $COUNT.$SUBCOUNT.1) (plot points)"
          done
        else
          # Handle scalar fields for other categories
          MATCHING_PATHS=($(jq -r "paths(scalars) | join(\".\") | select(test(\"${FIELD//./\\.}[:${#FIELD}]\"))" json_filtered_${TEST_CHOICE}.json 2>/dev/null))
          for PATH in "${MATCHING_PATHS[@]}"; do
            SUBCOUNT=$((SUBCOUNT+1))
            COUNT=$((COUNT+1))
            MENU_NUMBERS+=("$COUNT.$SUBCOUNT")
            MENU_PATHS+=("$PATH")
            DISPLAY_PATH=$(jq -r "[.\"$PATH\" | split(\".\") | .[:-1] | join(\".\")] | if . == \"\" then \"$PATH\" else . end | if type==\"array\" then sub(\"\\\\.[0-9]+\"; \"[*]\") else . end" json_filtered_${TEST_CHOICE}.json 2>/dev/null || echo "$PATH")
            echo "    $COUNT.$SUBCOUNT) $DISPLAY_PATH"
          done
        fi
      done
    done

    echo -e "${YELLOW}Enter field numbers to display values (space-separated, e.g., '1 2.1 6.1.1'), or press Enter to skip:${NC}"
    read -a FIELD_SELECTIONS
    if [ ${#FIELD_SELECTIONS[@]} -gt 0 ]; then
      for SELECTION in "${FIELD_SELECTIONS[@]}"; do
        if [[ " ${MENU_NUMBERS[*]} " =~ " ${SELECTION} " ]]; then
          for k in "${!MENU_NUMBERS[@]}"; do
            if [ "${MENU_NUMBERS[$k]}" = "$SELECTION" ]; then
              PATH="${MENU_PATHS[$k]}"
              # Check if path is a category
              for CATEGORY in "${CATEGORIES[@]}"; do
                CATEGORY_NAME="${CATEGORY%% *}"
                if [ "$PATH" = "$CATEGORY_NAME" ]; then
                  echo -e "${YELLOW}Selected category: $PATH. Displaying first 5 fields:${NC}"
                  CATEGORY_FIELDS="${CATEGORY#* }"
                  CATEGORY_PATHS=($(jq -r "paths(scalars) | join(\".\") | select(test(\"(${CATEGORY_FIELDS// /|})\")) | limit(5; .)" json_filtered_${TEST_CHOICE}.json 2>/dev/null))
                  for CPATH in "${CATEGORY_PATHS[@]}"; do
                    VALUE=$(jq -r ".${CPATH}" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                    if [ $? -eq 0 ] && [ -n "$VALUE" ] && [ "$VALUE" != "null" ]; then
                      echo -e "${GREEN}Field ($CPATH): $VALUE${NC}"
                    else
                      echo -e "${RED}Field ($CPATH): Unable to retrieve value or value is null${NC}"
                    fi
                  done
                  break
                fi
              done
              # Handle non-category paths
              if [ "$PATH" != "$CATEGORY_NAME" ]; then
                # Handle plot points option
                if [[ "$PATH" =~ ::plot_points$ ]]; then
                  ARRAY_PATH=$(echo "$PATH" | cut -d':' -f1)
                  ARRAY_LENGTH=$(jq -r ".${ARRAY_PATH} | length" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                  echo -e "${YELLOW}Selected array field: $ARRAY_PATH ($ARRAY_LENGTH points). Enter point index (0 to $((ARRAY_LENGTH-1))) or 'sample' for first 5, or press Enter to skip:${NC}"
                  read POINT_INDEX
                  if [ "$POINT_INDEX" = "sample" ]; then
                    SAMPLE_VALUES=$(jq -r ".${ARRAY_PATH} | .[0:5] | .[] | tostring" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                    INDEX=0
                    for VALUE in $SAMPLE_VALUES; do
                      echo -e "${GREEN}Point [$INDEX]: $VALUE${NC}"
                      INDEX=$((INDEX+1))
                    done
                  elif [ -n "$POINT_INDEX" ] && [ "$POINT_INDEX" -ge 0 ] && [ "$POINT_INDEX" -lt "$ARRAY_LENGTH" ] 2>/dev/null; then
                    VALUE=$(jq -r ".${ARRAY_PATH}[$POINT_INDEX] | tostring" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                    echo -e "${GREEN}Point [$POINT_INDEX]: $VALUE${NC}"
                  else
                    echo -e "${GREEN}Skipped point selection.${NC}"
                  fi
                else
                  # Handle array fields
                  if [[ "$PATH" =~ \.value$ ]] && jq -r ".${PATH} | type" json_filtered_${TEST_CHOICE}.json 2>/dev/null | grep -q "array"; then
                    ARRAY_LENGTH=$(jq -r ".${PATH} | length" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                    echo -e "${YELLOW}Selected array field: $PATH ($ARRAY_LENGTH points). Enter point index (0 to $((ARRAY_LENGTH-1))) or 'sample' for first 5, or press Enter to skip:${NC}"
                    read POINT_INDEX
                    if [ "$POINT_INDEX" = "sample" ]; then
                      SAMPLE_VALUES=$(jq -r ".${PATH} | .[0:5] | .[] | tostring" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                      INDEX=0
                      for VALUE in $SAMPLE_VALUES; do
                        echo -e "${GREEN}Point [$INDEX]: $VALUE${NC}"
                        INDEX=$((INDEX+1))
                      done
                    elif [ -n "$POINT_INDEX" ] && [ "$POINT_INDEX" -ge 0 ] && [ "$POINT_INDEX" -lt "$ARRAY_LENGTH" ] 2>/dev/null; then
                      VALUE=$(jq -r ".${PATH}[$POINT_INDEX] | tostring" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                      echo -e "${GREEN}Point [$POINT_INDEX]: $VALUE${NC}"
                    else
                      echo -e "${GREEN}Skipped point selection.${NC}"
                    fi
                  else
                    # Handle scalar fields
                    VALUE=$(jq -r ".${PATH}" json_filtered_${TEST_CHOICE}.json 2>/dev/null)
                    if [ $? -eq 0 ] && [ -n "$VALUE" ] && [ "$VALUE" != "null" ]; then
                      echo -e "${GREEN}Field $SELECTION ($PATH): $VALUE${NC}"
                    else
                      echo -e "${RED}Field $SELECTION ($PATH): Unable to retrieve value or value is null${NC}"
                    fi
                  fi
                fi
              fi
            fi
          done
        else
          echo -e "${RED}Invalid selection '$SELECTION'. Skipping.${NC}"
        fi
      done
    else
      echo -e "${GREEN}Skipped field selection. Full response in json_response_${TEST_CHOICE}.json, filtered in json_filtered_${TEST_CHOICE}.json, field list in fields_${TEST_CHOICE}.txt.${NC}"
    fi
    rm json_response_${TEST_CHOICE}.json json_filtered_${TEST_CHOICE}.json curl_error.log 2>/dev/null
  done
  return 0
}

# Main execution
PROJECT_ID="pmc-estimator"
REGION="us-central1"
FUNCTION_NAME="pmcEstimatorAPI"
SERVICE_ACCOUNT_EMAIL="icarenow@pmc-estimator.iam.gserviceaccount.com"
SERVICE_ACCOUNT_KEY="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/pmc-estimator-b50a03244199.json"

test_api "$PROJECT_ID" "$REGION" "$FUNCTION_NAME" "$SERVICE_ACCOUNT_EMAIL" "$SERVICE_ACCOUNT_KEY"
exit $?
