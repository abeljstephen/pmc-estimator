#!/bin/bash

# test_api_auth.sh
#
# Purpose: Mimics Code.gs authentication for pmcEstimatorAPI in a macOS Terminal.
# Generates a JWT with the same claims as Code.gs, exchanges it for an ID token,
# and tests the API to diagnose the 401 Unauthorized error in deploy_pmcEstimatorAPI.sh's Step 11.
#
# Usage: ./test_api_auth.sh
#
# Prerequisites:
# - jq and openssl installed (brew install jq openssl on macOS).
# - Service account key file: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/pmc-estimator-b50a03244199.json
#
# Current date and time: July 14, 2025, 02:06 PM PDT

# Configuration
KEY_FILE="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/pmc-estimator-b50a03244199.json"
API_URL="https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI"
TEST_PAYLOAD='{"task":{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000},"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeUncertainty":50,"riskTolerance":50},"targetValue":{"value":2500,"description":"Target cost value"}}'
EXPECTED_SERVICE_ACCOUNT="icarenow@pmc-estimator.iam.gserviceaccount.com"

# Color codes for console output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Validate key file
echo -e "${YELLOW}Validating key file...${NC}"
if [ ! -f "$KEY_FILE" ]; then
  echo -e "${RED}Error: Key file ${KEY_FILE} not found.${NC}"
  exit 1
fi
CLIENT_EMAIL=$(jq -r '.client_email' "$KEY_FILE" 2>/dev/null)
if [ "$CLIENT_EMAIL" != "$EXPECTED_SERVICE_ACCOUNT" ]; then
  echo -e "${RED}Error: Key file does not match expected service account. Got ${CLIENT_EMAIL}, expected ${EXPECTED_SERVICE_ACCOUNT}.${NC}"
  exit 1
fi
PRIVATE_KEY=$(jq -r '.private_key' "$KEY_FILE" | sed 's/\\n/\n/g')
if [ -z "$PRIVATE_KEY" ]; then
  echo -e "${RED}Error: Failed to extract private_key from ${KEY_FILE}.${NC}"
  exit 1
fi
echo -e "${GREEN}Key file validated: ${CLIENT_EMAIL}${NC}"

# Generate JWT (aligned with Code.gs)
echo -e "${YELLOW}Generating JWT...${NC}"
HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')
NOW=$(date +%s)
# Modified: Added target_audience, removed scope to match Code.gs
PAYLOAD=$(echo -n "{\"iss\":\"${CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"target_audience\":\"${API_URL}\"}" | base64 -w0 | tr -d '=' | tr '/+' '_-')
SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign <(echo -n "${PRIVATE_KEY}") | base64 -w0 | tr -d '=' | tr '/+' '_-')
JWT="${SIGNATURE_INPUT}.${SIGNATURE}"
if [ -z "$JWT" ]; then
  echo -e "${RED}Error: Failed to generate JWT.${NC}"
  exit 1
fi
echo -e "${GREEN}JWT generated successfully.${NC}"

# Exchange JWT for ID token (modified to match Code.gs)
echo -e "${YELLOW}Exchanging JWT for ID token...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}")
if [ -z "$TOKEN_RESPONSE" ]; then
  echo -e "${RED}Error: No response from token endpoint. Check network or https://oauth2.googleapis.com/token availability.${NC}"
  exit 1
fi
echo -e "${YELLOW}Token response: ${TOKEN_RESPONSE}${NC}"
# Modified: Extract id_token instead of access_token
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token' 2>/dev/null)
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo -e "${RED}Error: Failed to obtain ID token. Response: ${TOKEN_RESPONSE}${NC}"
  exit 1
fi
echo -e "${GREEN}ID token obtained successfully.${NC}"

# Test API (using ID token in Authorization header)
echo -e "${YELLOW}Testing API with ID token...${NC}"
RESPONSE=$(curl -s -w "%{http_code}" -X POST "$API_URL" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD" -o response.json)
if [ "$RESPONSE" -eq 200 ]; then
  echo -e "${GREEN}API test successful. Response saved to response.json.${NC}"
  if ! jq -e '.' response.json >/dev/null 2>&1; then
    echo -e "${RED}Error: Invalid JSON response.${NC}"
    cat response.json
    rm response.json
    exit 1
  fi
  jq '.' response.json
else
  echo -e "${RED}API test failed with status ${RESPONSE}.${NC}"
  cat response.json
  rm response.json
  exit 1
fi
rm response.json

echo -e "${GREEN}Success: Authentication matches Code.gs setup and API call succeeded.${NC}"
