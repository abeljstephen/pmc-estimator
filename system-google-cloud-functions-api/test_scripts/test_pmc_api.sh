#!/bin/bash

# test_pmc_api.sh
# WHAT: Tests the pmcEstimatorAPI Cloud Function with multiple tasks, writes a pretty-printed JSON response
#       to a file, and validates required fields (pertMean, allCIs, optimalData.optimalSliderSettings,
#       sliderSensitivity, distributionShift).
# WHY: Confirms the API returns expected fields for integration with Code.gs, with readable output
#      for grepping and debugging missing values in Google Sheets.
# WHERE: Run from /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api.
# HOW: Generates a JWT, exchanges it for an ID token, calls the API, pretty-prints the response with jq,
#      and checks for required fields.

# Configuration
SERVICE_ACCOUNT_KEY="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/pmc-estimator-b50a03244199.json"
API_URL="https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI"
TEST_PAYLOAD='[
  {"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":0,"scheduleFlexibility":0,"scopeCertainty":0,"scopeReductionAllowance":0,"reworkPercentage":0,"riskTolerance":0},"targetValue":1800,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target","userSlider_Confidence":"confident"},
  {"task":"Project_1","optimistic":10,"mostLikely":20,"pessimistic":30,"sliderValues":{"budgetFlexibility":0,"scheduleFlexibility":0,"scopeCertainty":0,"scopeReductionAllowance":0,"reworkPercentage":0,"riskTolerance":0},"targetValue":10,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target","userSlider_Confidence":"confident"}
]'
OUTPUT_DIR="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUTPUT_FILE="${OUTPUT_DIR}/api_response_${TIMESTAMP}.json"
PRETTY_OUTPUT_FILE="${OUTPUT_DIR}/api_response_pretty_${TIMESTAMP}.json"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting pmcEstimatorAPI test...${NC}"
echo -e "${YELLOW}Output will be written to $OUTPUT_FILE (raw) and $PRETTY_OUTPUT_FILE (pretty-printed)${NC}"
echo -e "${YELLOW}Current date and time: $(date)${NC}"

# 1. Validate dependencies
echo -e "${YELLOW}1. Validating dependencies...${NC}"
if ! command -v jq &> /dev/null; then
  echo -e "${RED}Error: jq is not installed. Install with 'brew install jq'${NC}"
  exit 1
fi
if ! command -v openssl &> /dev/null; then
  echo -e "${RED}Error: openssl is not installed. Install with 'brew install openssl'${NC}"
  exit 1
fi
echo -e "${GREEN}Dependencies jq and openssl validated.${NC}"

# 2. Validate service account key
echo -e "${YELLOW}2. Validating service account key...${NC}"
if [ ! -f "$SERVICE_ACCOUNT_KEY" ]; then
  echo -e "${RED}Error: Service account key file $SERVICE_ACCOUNT_KEY not found${NC}"
  exit 1
fi
KEY_CLIENT_EMAIL=$(jq -r '.client_email' "$SERVICE_ACCOUNT_KEY" 2>/dev/null)
EXPECTED_EMAIL="icarenow@pmc-estimator.iam.gserviceaccount.com"
if [ "$KEY_CLIENT_EMAIL" != "$EXPECTED_EMAIL" ]; then
  echo -e "${RED}Error: Service account key does not match $EXPECTED_EMAIL. Got $KEY_CLIENT_EMAIL${NC}"
  exit 1
fi
PRIVATE_KEY=$(jq -r '.private_key' "$SERVICE_ACCOUNT_KEY" | sed 's/\\n/\n/g')
if [ -z "$PRIVATE_KEY" ]; then
  echo -e "${RED}Error: Failed to extract private_key from $SERVICE_ACCOUNT_KEY${NC}"
  exit 1
fi
echo -e "${GREEN}Service account key validated: $KEY_CLIENT_EMAIL${NC}"

# 3. Generate JWT and get ID token
echo -e "${YELLOW}3. Generating JWT and ID token...${NC}"
HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')
NOW=$(date +%s)
PAYLOAD=$(echo -n "{\"iss\":\"${KEY_CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"target_audience\":\"${API_URL}\"}" | base64 -w0 | tr -d '=' | tr '/+' '_-')
SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign <(echo -n "${PRIVATE_KEY}") | base64 -w0 | tr -d '=' | tr '/+' '_-')
JWT="${SIGNATURE_INPUT}.${SIGNATURE}"
if [ -z "$JWT" ]; then
  echo -e "${RED}Error: Failed to generate JWT${NC}"
  exit 1
fi
TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}")
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token' 2>/dev/null)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}Error: Failed to obtain ID token. Response: $TOKEN_RESPONSE${NC}"
  exit 1
fi
echo -e "${GREEN}ID token generated successfully.${NC}"

# 4. Call API and save response
echo -e "${YELLOW}4. Calling pmcEstimatorAPI with 2 tasks...${NC}"
HTTP_STATUS=$(curl -s -w "%{http_code}" -X POST "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD" \
  -o "$OUTPUT_FILE")
if [ "$HTTP_STATUS" -ne 200 ]; then
  echo -e "${RED}Error: API call failed with status $HTTP_STATUS${NC}"
  cat "$OUTPUT_FILE"
  exit 1
fi
echo -e "${GREEN}API call successful. Response saved to $OUTPUT_FILE${NC}"

# 5. Pretty-print JSON response
echo -e "${YELLOW}5. Pretty-printing response to $PRETTY_OUTPUT_FILE...${NC}"
if ! jq '.' "$OUTPUT_FILE" > "$PRETTY_OUTPUT_FILE" 2>/dev/null; then
  echo -e "${RED}Error: Failed to pretty-print JSON response${NC}"
  cat "$OUTPUT_FILE"
  exit 1
fi
echo -e "${GREEN}Pretty-printed response saved to $PRETTY_OUTPUT_FILE${NC}"

# 6. Validate required fields
echo -e "${YELLOW}6. Checking for required fields in response...${NC}"
REQUIRED_FIELDS=(
  "pertMean"
  "allCIs"
  "optimalData.optimalSliderSettings"
  "optimalData.optimalSliderSettings.budgetFlexibility"
  "sliderSensitivity"
  "sliderSensitivity.change"
  "distributionShift"
  "distributionShift.klDivergence"
)
MISSING_FIELDS=()
for FIELD in "${REQUIRED_FIELDS[@]}"; do
  if jq -e ".results[].${FIELD}" "$OUTPUT_FILE" >/dev/null 2>&1; then
    echo -e "${GREEN}Field $FIELD found in response${NC}"
    jq ".results[].${FIELD}" "$PRETTY_OUTPUT_FILE"
  else
    echo -e "${RED}Field $FIELD NOT found in response${NC}"
    MISSING_FIELDS+=("$FIELD")
  fi
done

# 7. Grep for fields in pretty-printed response
echo -e "${YELLOW}7. Grepping for fields in pretty-printed response...${NC}"
echo -e "${YELLOW}Running: grep -E 'pertMean|allCIs|optimalData|sliderSensitivity|distributionShift' $PRETTY_OUTPUT_FILE${NC}"
grep -E "pertMean|allCIs|optimalData|sliderSensitivity|distributionShift" "$PRETTY_OUTPUT_FILE" || echo -e "${YELLOW}No matches found in $PRETTY_OUTPUT_FILE${NC}"

# 8. Summary
echo -e "${YELLOW}8. Summary${NC}"
if [ ${#MISSING_FIELDS[@]} -eq 0 ]; then
  echo -e "${GREEN}All required fields found in $PRETTY_OUTPUT_FILE${NC}"
else
  echo -e "${RED}Missing fields: ${MISSING_FIELDS[*]}${NC}"
  echo -e "${YELLOW}Review $PRETTY_OUTPUT_FILE and check core-optimization.js, core-metrics-single.js, or core-metrics-divergence.js for issues in calculating these fields${NC}"
fi
echo -e "${YELLOW}To grep manually:${NC}"
echo -e "${YELLOW}  grep -E 'pertMean|allCIs|optimalData|sliderSensitivity|distributionShift' $PRETTY_OUTPUT_FILE${NC}"
echo -e "${GREEN}Test completed. Response files: $OUTPUT_FILE (raw), $PRETTY_OUTPUT_FILE (pretty-printed)${NC}"
