#!/bin/bash

# query_plot_data.sh
# Script to query plot-relevant fields from pmcEstimatorAPI, display data, and provide a summary as the final output
# Focuses on targetProbabilityOriginalPdf, targetProbabilityAdjustedPdf, targetProbabilityOriginalCdf, targetProbabilityAdjustedCdf, and optimalData
# Ensures summary answers specific validation questions for Plot.html

set -e

# Configuration
PROJECT_ID="pmc-estimator"
FUNCTION_NAME="pmcEstimatorAPI"
LOCAL_URL="http://localhost:8080"
CLOUD_URL="https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI"
SOURCE_DIR="system-google-cloud-functions-api"
TEST_PAYLOAD='{"task":{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000},"sliderValues":{"budgetFlexibility":100,"scheduleFlexibility":100,"scopeCertainty":100,"riskTolerance":100},"targetValue":2500,"optimizeFor":"target","confidenceLevel":0.9}'

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if jq is installed
check_jq() {
  if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed. Please install jq (e.g., 'brew install jq' on macOS).${NC}"
    exit 1
  fi
  JQ_VERSION=$(jq --version | cut -d- -f2)
  if [[ "$(echo "$JQ_VERSION < 1.6" | bc -l)" -eq 1 ]]; then
    echo -e "${YELLOW}Warning: jq version $JQ_VERSION detected. Using compatible queries.${NC}"
  fi
}

# Function to check if server is running
check_server() {
  local url=$1
  if curl -s --connect-timeout 2 "$url" &> /dev/null; then
    echo -e "${GREEN}Server is running at $url${NC}"
    return 0
  else
    echo -e "${YELLOW}Server not running at $url${NC}"
    return 1
  fi
}

# Function to query and display plot-relevant fields with summary
query_plot_data() {
  local url=$1
  local payload=$2
  local output_file="plot_data_response.json"
  local issues=()
  local summary=""
  local orig_pdf_length=0 orig_cdf_length=0
  local has_confidence_issues=false

  echo -e "${YELLOW}Querying API at $url with payload: $payload${NC}"
  CURL_OUTPUT=$(curl -s -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$payload" -o "$output_file")
  
  if [ "$CURL_OUTPUT" -eq 200 ]; then
    echo -e "${GREEN}Request successful. Parsing plot-relevant fields...${NC}"
    
    # Validate JSON structure
    if jq -e '.' "$output_file" >/dev/null 2>&1; then
      echo -e "${GREEN}JSON structure is valid.${NC}"
    else
      echo -e "${RED}Error: Invalid JSON response.${NC}"
      cat "$output_file"
      rm -f "$output_file"
      exit 1
    fi

    # Define plot-relevant fields
    PLOT_FIELDS=(
      "targetProbabilityOriginalPdf"
      "targetProbabilityAdjustedPdf"
      "targetProbabilityOriginalCdf"
      "targetProbabilityAdjustedCdf"
      "optimalData"
    )

    # Extract and display plot-relevant fields
    echo -e "${YELLOW}Plot-Relevant JSON Fields:${NC}"
    for i in "${!PLOT_FIELDS[@]}"; do
      FIELD="${PLOT_FIELDS[$i]}"
      COUNT=$((i+1))
      echo -e "$COUNT) $FIELD"
      
      if jq -e ".${FIELD}" "$output_file" >/dev/null 2>&1; then
        TYPE=$(jq -r ".${FIELD} | type" "$output_file")
        echo -e "  Type: $TYPE"

        if [ "$TYPE" == "object" ]; then
          CHILD_KEYS=($(jq -r ".${FIELD} | keys[] | select(. != \"description\")" "$output_file"))
          for j in "${!CHILD_KEYS[@]}"; do
            SUBCOUNT="$COUNT.$((j+1))"
            SUBKEY="${CHILD_KEYS[$j]}"
            echo -e "  $SUBCOUNT) ${FIELD}.${SUBKEY}"
            SUBTYPE=$(jq -r ".${FIELD}.${SUBKEY} | type" "$output_file")
            echo -e "    Type: $SUBTYPE"
            if [ "$SUBTYPE" == "array" ]; then
              LENGTH=$(jq ".${FIELD}.${SUBKEY} | length" "$output_file")
              echo -e "    Length: $LENGTH"
              if [ "$LENGTH" -eq 0 ]; then
                issues+=("Empty array in ${FIELD}.${SUBKEY}")
              fi
              if [ "$FIELD" == "targetProbabilityOriginalPdf" ] && [ "$SUBKEY" == "value" ]; then
                orig_pdf_length=$LENGTH
              elif [ "$FIELD" == "targetProbabilityOriginalCdf" ] && [ "$SUBKEY" == "value" ]; then
                orig_cdf_length=$LENGTH
              fi
              # Display first 3 array items
              for ((k=0; k<LENGTH && k<3; k++)); do
                VALUE=$(jq -r ".${FIELD}.${SUBKEY}[$k] // {} | tostring" "$output_file")
                echo -e "    [$k]: $VALUE"
                if jq -e ".${FIELD}.${SUBKEY}[$k].x" "$output_file" >/dev/null 2>&1; then
                  X_VALUE=$(jq -r ".${FIELD}.${SUBKEY}[$k].x // \"missing\"" "$output_file")
                  Y_VALUE=$(jq -r ".${FIELD}.${SUBKEY}[$k].y // \"missing\"" "$output_file")
                  CONF_VALUE=$(jq -r ".${FIELD}.${SUBKEY}[$k].confidence // \"missing\"" "$output_file")
                  echo -e "      x: $X_VALUE (Type: $(jq -r ".${FIELD}.${SUBKEY}[$k].x | type // \"missing\"" "$output_file"))"
                  echo -e "      y: $Y_VALUE (Type: $(jq -r ".${FIELD}.${SUBKEY}[$k].y | type // \"missing\"" "$output_file"))"
                  echo -e "      confidence: $CONF_VALUE (Type: $(jq -r ".${FIELD}.${SUBKEY}[$k].confidence | type // \"missing\"" "$output_file"))"
                  if [ "$CONF_VALUE" == "missing" ]; then
                    issues+=("Missing confidence field in ${FIELD}.${SUBKEY}[$k]")
                    has_confidence_issues=true
                  fi
                  if [ "$X_VALUE" != "missing" ] && [ "$(jq -r ".${FIELD}.${SUBKEY}[$k].x | type == \"number\" and (. < 0 or . > 0 or . == 0)" "$output_file")" != "true" ]; then
                    issues+=("Non-numeric or non-finite x in ${FIELD}.${SUBKEY}[$k]: $X_VALUE")
                  fi
                  if [ "$Y_VALUE" != "missing" ] && [ "$(jq -r ".${FIELD}.${SUBKEY}[$k].y | type == \"number\" and (. < 0 or . > 0 or . == 0)" "$output_file")" != "true" ]; then
                    issues+=("Non-numeric or non-finite y in ${FIELD}.${SUBKEY}[$k]: $Y_VALUE")
                  fi
                  if [ "$CONF_VALUE" != "missing" ] && [ "$(jq -r ".${FIELD}.${SUBKEY}[$k].confidence | type == \"number\" and (. < 0 or . > 0 or . == 0)" "$output_file")" != "true" ]; then
                    issues+=("Non-numeric or non-finite confidence in ${FIELD}.${SUBKEY}[$k]: $CONF_VALUE")
                  fi
                else
                  issues+=("Invalid object structure in ${FIELD}.${SUBKEY}[$k]")
                fi
              done
              if [ "$LENGTH" -gt 3 ]; then
                echo -e "    ... (and $((LENGTH-3)) more items)"
              fi
            else
              VALUE=$(jq -r ".${FIELD}.${SUBKEY} // \"missing\"" "$output_file")
              echo -e "    Value: $VALUE"
              if [ "$SUBTYPE" == "number" ] && [ "$(jq -r ".${FIELD}.${SUBKEY} | type == \"number\" and (. < 0 or . > 0 or . == 0)" "$output_file")" != "true" ]; then
                issues+=("Non-finite value in ${FIELD}.${SUBKEY}: $VALUE")
              fi
            fi
          done
          # Handle description separately
          if jq -e ".${FIELD}.description" "$output_file" >/dev/null 2>&1; then
            echo -e "  $COUNT.$(( ${#CHILD_KEYS[@]} + 1 )) ${FIELD}.description"
            echo -e "    Type: string"
            echo -e "    Value: $(jq -r ".${FIELD}.description" "$output_file")"
          fi
        fi
      else
        issues+=("Missing field: $FIELD")
        echo -e "${RED}  Error: Field $FIELD not found in response${NC}"
      fi
    done

    # Check for identical original and adjusted points
    local identical_pdf=false identical_cdf=false
    if jq -e '.targetProbabilityOriginalPdf.value' "$output_file" >/dev/null 2>&1 && jq -e '.targetProbabilityAdjustedPdf.value' "$output_file" >/dev/null 2>&1; then
      if [ "$orig_pdf_length" != "$(jq '.targetProbabilityAdjustedPdf.value | length' "$output_file")" ]; then
        issues+=("Length mismatch: targetProbabilityAdjustedPdf ($(jq '.targetProbabilityAdjustedPdf.value | length' "$output_file")) vs targetProbabilityOriginalPdf ($orig_pdf_length)")
      else
        jq -r '.targetProbabilityOriginalPdf.value[0:3]' "$output_file" > original_pdf.json 2>/dev/null
        jq -r '.targetProbabilityAdjustedPdf.value[0:3]' "$output_file" > adjusted_pdf.json 2>/dev/null
        DIFF_COUNT=$(diff -u original_pdf.json adjusted_pdf.json | grep -c '^[-+]' || true)
        if [ "$DIFF_COUNT" -eq 0 ]; then
          identical_pdf=true
          issues+=("targetProbabilityAdjustedPdf is identical to targetProbabilityOriginalPdf")
        fi
        rm -f original_pdf.json adjusted_pdf.json
      fi
    fi
    if jq -e '.targetProbabilityOriginalCdf.value' "$output_file" >/dev/null 2>&1 && jq -e '.targetProbabilityAdjustedCdf.value' "$output_file" >/dev/null 2>&1; then
      if [ "$orig_cdf_length" != "$(jq '.targetProbabilityAdjustedCdf.value | length' "$output_file")" ]; then
        issues+=("Length mismatch: targetProbabilityAdjustedCdf ($(jq '.targetProbabilityAdjustedCdf.value | length' "$output_file")) vs targetProbabilityOriginalCdf ($orig_cdf_length)")
      else
        jq -r '.targetProbabilityOriginalCdf.value[0:3]' "$output_file" > original_cdf.json 2>/dev/null
        jq -r '.targetProbabilityAdjustedCdf.value[0:3]' "$output_file" > adjusted_cdf.json 2>/dev/null
        DIFF_COUNT=$(diff -u original_cdf.json adjusted_cdf.json | grep -c '^[-+]' || true)
        if [ "$DIFF_COUNT" -eq 0 ]; then
          identical_cdf=true
          issues+=("targetProbabilityAdjustedCdf is identical to targetProbabilityOriginalCdf")
        fi
        rm -f original_cdf.json adjusted_cdf.json
      fi
    fi

    # Check x-value scaling for adjusted points
    local scaling_valid=true
    if [ "$identical_pdf" == "false" ] && jq -e '.targetProbabilityOriginalPdf.value[0].x' "$output_file" >/dev/null 2>&1; then
      ORIG_X=$(jq -r '.targetProbabilityOriginalPdf.value[0].x' "$output_file")
      ADJ_X=$(jq -r '.targetProbabilityAdjustedPdf.value[0].x // "missing"' "$output_file")
      if [ "$ADJ_X" != "missing" ]; then
        EXPECTED_X=$(echo "$ORIG_X * 0.3024" | bc -l)
        DIFF=$(echo "$ADJ_X - $EXPECTED_X" | bc -l | awk '{print ($1 < 0 ? -$1 : $1)}')
        if [ "$(echo "$DIFF > 1" | bc -l)" -eq 1 ]; then
          issues+=("Adjusted PDF x-values not scaled as expected (got $ADJ_X, expected ~$EXPECTED_X for scaleFactor=0.3024)")
          scaling_valid=false
        fi
      fi
    fi

    # Validate optimalData fields
    local optimal_data_valid=true
    if jq -e '.optimalData.value' "$output_file" >/dev/null 2>&1; then
      OPT_OBJECTIVE=$(jq -r '.optimalData.value.optimalObjective // "missing"' "$output_file")
      OPT_PROB=$(jq -r '.optimalData.value.probability // "missing"' "$output_file")
      if [ "$OPT_OBJECTIVE" != "missing" ] && [ "$(jq -r '.optimalData.value.optimalObjective | type == "number" and (. >= 1800 and . <= 3000)' "$output_file")" != "true" ]; then
        issues+=("Invalid optimalObjective in optimalData.value: $OPT_OBJECTIVE (expected number between 1800 and 3000)")
        optimal_data_valid=false
      fi
      if [ "$OPT_PROB" != "missing" ] && [ "$(jq -r '.optimalData.value.probability | type == "number" and (. >= 0 and . <= 1)' "$output_file")" != "true" ]; then
        issues+=("Invalid probability in optimalData.value: $OPT_PROB (expected number between 0 and 1)")
        optimal_data_valid=false
      fi
      if ! jq -e '.optimalData.value.optimalSliderSettings' "$output_file" >/dev/null 2>&1; then
        issues+=("Missing optimalSliderSettings in optimalData.value")
        optimal_data_valid=false
      fi
    else
      issues+=("Missing optimalData.value")
      optimal_data_valid=false
    fi

    # Display full JSON before summary
    echo -e "${YELLOW}\nFull JSON Response:${NC}"
    jq '.' "$output_file" 2>/dev/null || echo "Failed to display full JSON"

    # Summary Section
    echo -e "${YELLOW}\nFinal Summary of API Response for Plot Rendering:${NC}"
    echo -e "Validation Questions Answered:"
    echo -e "1) Are all required fields present?"
    if [[ "${issues[*]}" =~ "Missing field" ]]; then
      echo -e "   - No, missing fields: $(echo "${issues[*]}" | grep -o "Missing field: [^ ]*" | paste -sd, -)"
    else
      echo -e "   - Yes, all fields (targetProbabilityOriginalPdf, targetProbabilityAdjustedPdf, targetProbabilityOriginalCdf, targetProbabilityAdjustedCdf, optimalData) present."
    fi
    echo -e "2) Do array fields have valid data types and formats?"
    if [ "$has_confidence_issues" == "true" ] || [[ "${issues[*]}" =~ "Non-numeric or non-finite" ]]; then
      echo -e "   - No, issues detected:"
      if [ "$has_confidence_issues" == "true" ]; then
        echo -e "     - Missing confidence fields in array elements."
      fi
      if [[ "${issues[*]}" =~ "Non-numeric or non-finite" ]]; then
        echo -e "     - Non-numeric or non-finite values: $(echo "${issues[*]}" | grep -o "Non-numeric or non-finite [xyc].*" | paste -sd, -)"
      fi
    else
      echo -e "   - Yes, arrays contain objects with numeric x, y, and confidence fields."
    fi
    echo -e "3) Do original and adjusted points differ?"
    if [ "$identical_pdf" == "true" ] || [ "$identical_cdf" == "true" ]; then
      echo -e "   - No, adjusted points are identical to original: $([ "$identical_pdf" == "true" ] && echo "PDF" || echo "") $([ "$identical_cdf" == "true" ] && echo "CDF" || echo "")"
    else
      echo -e "   - Yes, adjusted PDF/CDF points differ from original."
    fi
    echo -e "4) Are x, y, and confidence values valid?"
    if [ "$has_confidence_issues" == "true" ] || [[ "${issues[*]}" =~ "Non-numeric or non-finite" ]]; then
      echo -e "   - No, issues detected:"
      if [ "$has_confidence_issues" == "true" ]; then
        echo -e "     - Missing confidence fields in array elements."
      fi
      if [[ "${issues[*]}" =~ "Non-numeric or non-finite" ]]; then
        echo -e "     - Non-numeric or non-finite values: $(echo "${issues[*]}" | grep -o "Non-numeric or non-finite [xyc].*" | paste -sd, -)"
      fi
    else
      echo -e "   - Yes, all x, y, and confidence values are numeric and finite."
    fi
    echo -e "5) Are array lengths consistent?"
    if [[ "${issues[*]}" =~ "Length mismatch" ]]; then
      echo -e "   - No, length mismatches: $(echo "${issues[*]}" | grep -o "Length mismatch:.*" | paste -sd, -)"
    else
      echo -e "   - Yes, original and adjusted PDF/CDF arrays have matching lengths."
    fi
    echo -e "6) Is optimalData valid for rendering optimized plots?"
    if [ "$optimal_data_valid" == "true" ]; then
      echo -e "   - Yes, optimalData includes valid optimalObjective (1800–3000), probability (0–1), and optimalSliderSettings."
    else
      echo -e "   - No, issues with optimalData: $(echo "${issues[*]}" | grep -o "Invalid optimalObjective\|Invalid probability\|Missing optimalSliderSettings" | paste -sd, -)"
    fi
    echo -e "7) Why might adjusted plots match baseline plots?"
    if [ ${#issues[@]} -eq 0 ]; then
      echo -e "   - No issues detected. Adjusted plots should differ from baseline due to correct scaling (x-values ~0.3024 of original)."
    else
      echo -e "   - Potential reasons for identical plots:"
      if [ "$identical_pdf" == "true" ] || [ "$identical_cdf" == "true" ]; then
        echo -e "     - Adjusted PDF/CDF points identical to original, likely due to core.js failing to apply slider adjustments."
      fi
      if [ "$has_confidence_issues" == "true" ]; then
        echo -e "     - Missing confidence fields likely cause Plot.html to fallback to baseline data or fail rendering."
      fi
      if [ "$scaling_valid" == "false" ]; then
        echo -e "     - Adjusted x-values not scaled correctly (expected ~0.3024 of original)."
      fi
      if [ "$optimal_data_valid" == "false" ]; then
        echo -e "     - Invalid optimalData may prevent optimized plot rendering."
      fi
      echo -e "   Recommendations:"
      echo -e "     - Update core.js to ensure confidence fields are included in PDF/CDF points."
      echo -e "     - Fix findOptimalSliderSettings to return valid optimalObjective (1800–3000) and probability (0–1)."
      echo -e "     - Add logging in core.js to check input validation and normalization."
      echo -e "     - Enhance Plot.html to handle missing confidence fields and invalid optimalData."
    fi

    # Clean up
    rm -f "$output_file"
  else
    echo -e "${RED}Request failed with status $CURL_OUTPUT.${NC}"
    jq '.' "$output_file" 2>/dev/null || echo "Failed to parse response"
    rm -f "$output_file"
    exit 1
  fi
}

# Main execution
echo -e "${YELLOW}Starting query for plot-relevant data from ${FUNCTION_NAME}...${NC}"
check_jq

# Try local endpoint first
echo -e "${YELLOW}Attempting to query local endpoint ($LOCAL_URL)...${NC}"
if check_server "$LOCAL_URL"; then
  query_plot_data "$LOCAL_URL" "$TEST_PAYLOAD"
else
  echo -e "${YELLOW}Local server not running. Starting functions-framework...${NC}"
  cd "$SOURCE_DIR" || { echo -e "${RED}Error: Directory $SOURCE_DIR not found${NC}"; exit 1; }
  USE_CORE=1 npm run start &
  NODE_PID=$!
  sleep 10
  cd -

  if check_server "$LOCAL_URL"; then
    query_plot_data "$LOCAL_URL" "$TEST_PAYLOAD"
    kill $NODE_PID 2>/dev/null
  else
    echo -e "${YELLOW}Local server failed to start. Trying cloud endpoint ($CLOUD_URL)...${NC}"
    query_plot_data "$CLOUD_URL" "$TEST_PAYLOAD"
  fi
fi

echo -e "${GREEN}🎉 All done!${NC}"
