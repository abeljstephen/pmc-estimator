#!/bin/bash

# query_all_fields.sh
# Script to query all fields from the pmcEstimatorAPI Cloud Function and display them with numbered subsections (e.g., 1) mean, 1.a) value, 1.b) description)
# Supports local (http://localhost:8080) and cloud (https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI) endpoints

set -e

# Configuration
PROJECT_ID="pmc-estimator"
FUNCTION_NAME="pmcEstimatorAPI"
LOCAL_URL="http://localhost:8080"
CLOUD_URL="https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI"
SOURCE_DIR="system-google-cloud-functions-api"
TEST_PAYLOAD='{"task":{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000},"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeCertainty":50,"riskTolerance":50},"targetValue":2500,"optimizeFor":"target","confidenceLevel":0.9}'

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
}

# Function to check if server is running (for local testing)
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

# Function to query and display all fields with numbered subsections
query_all_fields() {
  local url=$1
  local payload=$2
  local output_file="response.json"

  echo -e "${YELLOW}Querying API at $url...${NC}"
  CURL_OUTPUT=$(curl -s -w "%{http_code}" -X POST "$url" -H "Content-Type: application/json" -d "$payload" -o "$output_file")
  
  if [ "$CURL_OUTPUT" -eq 200 ]; then
    echo -e "${GREEN}Request successful. Parsing response...${NC}"
    
    # Validate JSON structure
    if jq -e '.' "$output_file" >/dev/null; then
      echo -e "${GREEN}JSON structure is valid.${NC}"
    else
      echo -e "${RED}Error: Invalid JSON response.${NC}"
      jq '.' "$output_file"
      rm "$output_file"
      exit 1
    fi

    # Extract and display all top-level fields with subsections
    echo -e "${YELLOW}Available JSON fields for Full response:${NC}"
    TOP_KEYS=($(jq -r 'keys[]' "$output_file"))
    for i in "${!TOP_KEYS[@]}"; do
      KEY="${TOP_KEYS[$i]}"
      COUNT=$((i+1))
      echo -e "$COUNT) $KEY"
      
      TYPE=$(jq -r ".${KEY} | type" "$output_file")
      if [ "$TYPE" == "object" ]; then
        CHILD_KEYS=($(jq -r ".${KEY} | keys[]" "$output_file"))
        for j in "${!CHILD_KEYS[@]}"; do
          SUBCOUNT="$COUNT.$((j+97))" # Use ASCII 'a' (97) for subfields
          SUBKEY="${CHILD_KEYS[$j]}"
          echo -e "  $SUBCOUNT) ${KEY}.${SUBKEY}"
          VALUE=$(jq -r ".${KEY}.${SUBKEY}" "$output_file")
          echo -e "    Value: $VALUE"
        done
      elif [ "$TYPE" == "array" ]; then
        LENGTH=$(jq ".${KEY} | length" "$output_file")
        for ((j=0;j<LENGTH && j<3;j++)); do # Limit to first 3 array items for brevity
          SUBCOUNT="$COUNT.$((j+1))"
          echo -e "  $SUBCOUNT) ${KEY}[$j]"
          VALUE=$(jq -r ".${KEY}[$j]" "$output_file")
          echo -e "    Value: $VALUE"
        done
        if [ "$LENGTH" -gt 3 ]; then
          echo -e "  ... (and $((LENGTH-3)) more items)"
        fi
      fi
    done

    # Display entire JSON
    echo -e "${YELLOW}\nFull JSON response:${NC}"
    jq '.' "$output_file"

    # Clean up
    rm "$output_file"
  else
    echo -e "${RED}Request failed with status $CURL_OUTPUT.${NC}"
    jq '.' "$output_file"
    rm "$output_file"
    exit 1
  fi
}

# Main execution
echo -e "${YELLOW}Starting query for all fields from ${FUNCTION_NAME}...${NC}"
check_jq

# Try local endpoint first
echo -e "${YELLOW}Attempting to query local endpoint ($LOCAL_URL)...${NC}"
if check_server "$LOCAL_URL"; then
  query_all_fields "$LOCAL_URL" "$TEST_PAYLOAD"
else
  echo -e "${YELLOW}Local server not running. Starting functions-framework...${NC}"
  cd "$SOURCE_DIR"
  USE_CORE=1 npm run start &
  NODE_PID=$!
  sleep 10  # Wait for server to start
  cd -

  if check_server "$LOCAL_URL"; then
    query_all_fields "$LOCAL_URL" "$TEST_PAYLOAD"
    kill $NODE_PID
  else
    echo -e "${YELLOW}Local server failed to start. Trying cloud endpoint ($CLOUD_URL)...${NC}"
    query_all_fields "$CLOUD_URL" "$TEST_PAYLOAD"
  fi
fi

echo -e "${GREEN}🎉 All done!${NC}"
