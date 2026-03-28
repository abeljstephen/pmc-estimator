#!/bin/bash

# test_api.sh
# WHAT: Tests pmcEstimatorAPI via curl with service account authentication.
# WHY: Bypasses Code.gs for direct testing, respecting IAM restrictions.
# HOW: Generates JWT, gets ID token, sends authenticated POST request.

# Place the script in the same directory as your service account key.


PROJECT_ID="pmc-estimator"
FUNCTION_NAME="pmcEstimatorAPI"
REGION="us-central1"
SERVICE_ACCOUNT_KEY="./pmc-estimator-b50a03244199.json"  # Update path if needed

# Extract from key file
CLIENT_EMAIL=$(jq -r '.client_email' "$SERVICE_ACCOUNT_KEY")
PRIVATE_KEY=$(jq -r '.private_key' "$SERVICE_ACCOUNT_KEY" | sed 's/\\n/\n/g')

# Generate JWT
HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 | tr -d '=' | tr '/+' '_-')
NOW=$(date +%s)
PAYLOAD=$(echo -n "{\"iss\":\"${CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"target_audience\":\"https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}\"}" | base64 | tr -d '=' | tr '/+' '_-')
SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign <(echo -n "${PRIVATE_KEY}") | base64 | tr -d '=' | tr '/+' '_-')
JWT="${SIGNATURE_INPUT}.${SIGNATURE}"

# Get ID token
TOKEN_RESPONSE=$(curl -s -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}")
TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.id_token')

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: Failed to obtain ID token. Response: $TOKEN_RESPONSE"
  exit 1
fi

# Test payload (matching Estimate Calculations inputs)
TEST_PAYLOAD='[{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":20,"scheduleFlexibility":20,"scopeCertainty":30,"scopeReductionAllowance":10,"reworkPercentage":5,"riskTolerance":15},"targetValue":1800,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target","userSlider_Confidence":"confident"}]'

# Send authenticated request
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$TEST_PAYLOAD")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Code: $HTTP_CODE"
echo "Response Body: $BODY"

if [ "$HTTP_CODE" -ne 200 ]; then
  echo "Test failed (non-200 response)."
  exit 1
fi
echo "Test successful."
