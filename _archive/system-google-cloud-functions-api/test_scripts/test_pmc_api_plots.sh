#!/bin/bash

# test_pmc_api_plots.sh
# WHAT: Tests pmcEstimatorAPI for baseline, slider-adjusted, and slider-optimized PDF/CDF data.
#       Sends separate payloads, pretty-prints JSON, validates plot fields for viability (arrays >=2 points, finite x/y, PDF y>=0, CDF y in [0,1], bell-shaped PDF, sigmoid CDF).
# WHY: Ensures API returns data for proper bell-shaped PDFs and sigmoid CDFs in Plot.html via Code.gs.
# WHERE: Run from /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api.
# HOW: Generates JWT, calls API with 3 payloads, validates fields with jq/bc for unimodality (PDF) and inflection (CDF).

# Configuration
SERVICE_ACCOUNT_KEY="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/pmc-estimator-b50a03244199.json"
API_URL="https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI"
OUTPUT_DIR="/Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Payloads
BASELINE_PAYLOAD=$(cat <<EOF
[
  {"task":"Baseline_Test","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":0,"scheduleFlexibility":0,"scopeCertainty":0,"scopeReductionAllowance":0,"reworkPercentage":0,"riskTolerance":0},"targetValue":2400,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target","userSlider_Confidence":"confident"}
]
EOF
)

ADJUSTED_PAYLOAD=$(cat <<EOF
[
  {"task":"Adjusted_Test","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":20,"scheduleFlexibility":30,"scopeCertainty":40,"scopeReductionAllowance":10,"reworkPercentage":15,"riskTolerance":25},"targetValue":2400,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target","userSlider_Confidence":"confident"}
]
EOF
)

OPTIMIZED_PAYLOAD=$(cat <<EOF
[
  {"task":"Optimized_Test","optimistic":1800,"mostLikely":2400,"pessimistic":3000,"sliderValues":{"budgetFlexibility":0,"scheduleFlexibility":0,"scopeCertainty":0,"scopeReductionAllowance":0,"reworkPercentage":0,"riskTolerance":0},"targetValue":2400,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target","userSlider_Confidence":"confident","optimize":true}
]
EOF
)

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting pmcEstimatorAPI test for plot data...${NC}"
echo -e "${YELLOW}Output in $OUTPUT_DIR (raw/pretty files per type)${NC}"

# 1. Validate dependencies
echo -e "${YELLOW}1. Validating dependencies...${NC}"
for cmd in jq openssl bc; do
  if ! command -v $cmd &> /dev/null; then
    echo -e "${RED}Error: $cmd is not installed. Install with 'brew install $cmd'${NC}"
    exit 1
  fi
done
echo -e "${GREEN}Dependencies validated.${NC}"

# 2. Validate service account key
echo -e "${YELLOW}2. Validating service account key...${NC}"
if [ ! -f "$SERVICE_ACCOUNT_KEY" ]; then
  echo -e "${RED}Error: Service account key $SERVICE_ACCOUNT_KEY not found${NC}"
  exit 1
fi
KEY_CLIENT_EMAIL=$(jq -r '.client_email' "$SERVICE_ACCOUNT_KEY" 2>/dev/null)
EXPECTED_EMAIL="icarenow@pmc-estimator.iam.gserviceaccount.com"
if [ "$KEY_CLIENT_EMAIL" != "$EXPECTED_EMAIL" ]; then
  echo -e "${YELLOW}Warning: Service account key does not match $EXPECTED_EMAIL. Got $KEY_CLIENT_EMAIL. Continuing...${NC}"
else
  echo -e "${GREEN}Service account key validated: $KEY_CLIENT_EMAIL${NC}"
fi

# 3. Generate JWT and get ID token
echo -e "${YELLOW}3. Generating JWT and ID token...${NC}"
HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')
NOW=$(date +%s)
PAYLOAD=$(echo -n "{\"iss\":\"${KEY_CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"target_audience\":\"${API_URL}\"}" | base64 -w0 | tr -d '=' | tr '/+' '_-')
SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign <(jq -r '.private_key' "$SERVICE_ACCOUNT_KEY" | sed 's/\\n/\n/g') | base64 -w0 | tr -d '=' | tr '/+' '_-')
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
echo -e "${GREEN}ID token generated.${NC}"

# Function to call API and validate
call_and_validate() {
  TYPE=$1
  PAYLOAD=$2
  OUTPUT_FILE="${OUTPUT_DIR}/${TYPE}_response_${TIMESTAMP}.json"
  PRETTY_OUTPUT_FILE="${OUTPUT_DIR}/${TYPE}_pretty_${TIMESTAMP}.json"

  echo -e "${YELLOW}Calling API for ${TYPE}...${NC}"
  HTTP_STATUS=$(curl -s -w "%{http_code}" -X POST "$API_URL" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    -o "$OUTPUT_FILE")
  if [ "$HTTP_STATUS" -ne 200 ]; then
    echo -e "${RED}Error: ${TYPE} call failed with status $HTTP_STATUS${NC}"
    cat "$OUTPUT_FILE"
    return 1
  fi
  echo -e "${GREEN}${TYPE} API call successful. Response saved to $OUTPUT_FILE${NC}"

  # Pretty-print
  jq '.' "$OUTPUT_FILE" > "$PRETTY_OUTPUT_FILE" || { echo -e "${RED}Error pretty-printing ${TYPE}${NC}"; return 1; }
  echo -e "${GREEN}Pretty-printed to $PRETTY_OUTPUT_FILE${NC}"

  # Validate plot fields
  echo -e "${YELLOW}Validating ${TYPE} plot fields...${NC}"
  PLOT_FIELDS=(
    "allDistributions.value.monteCarloSmoothed.pdfPoints"
    "allDistributions.value.monteCarloSmoothed.cdfPoints"
    "adjustedPoints.pdfPoints"
    "adjustedPoints.cdfPoints"
  )
  if [[ $TYPE == "Optimized" ]]; then
    PLOT_FIELDS+=(
      "optimizedPoints.pdfPoints"
      "optimizedPoints.cdfPoints"
    )
  fi

  for FIELD in "${PLOT_FIELDS[@]}"; do
    ARRAY=$(jq ".results[0].${FIELD}" "$OUTPUT_FILE" 2>/dev/null)
    if [ -z "$ARRAY" ] || [ "$ARRAY" = "null" ]; then
      echo -e "${RED}${TYPE} ${FIELD}: Field missing in response${NC}"
      echo -e "${YELLOW}${TYPE} allDistributions.value keys:${NC}"
      jq '.results[0].allDistributions.value | keys' "$OUTPUT_FILE" 2>/dev/null || echo -e "${RED}No allDistributions.value${NC}"
      continue
    fi
    LENGTH=$(echo "$ARRAY" | jq 'length')
    if [ "$LENGTH" -lt 2 ]; then
      echo -e "${RED}${TYPE} ${FIELD}: Array length <2 (got $LENGTH)${NC}"
      continue
    fi
    VALID=true
    PDFSUM=0
    LAST_Y=-1
    PEAK_Y=-1
    PEAK_IDX=-1
    MAX_DY=-1
    MAX_DY_IDX=-1
    YS=()
    for ((k=0; k<LENGTH; k++)); do
      X=$(echo "$ARRAY" | jq ".[$k].x")
      Y=$(echo "$ARRAY" | jq ".[$k].y")
      if ! [[ $X =~ ^-?[0-9]+\.?[0-9]*$ ]] || ! [[ $Y =~ ^-?[0-9]+\.?[0-9]*$ ]]; then
        echo -e "${RED}${TYPE} ${FIELD}: Non-finite x/y at index $k (x=$X, y=$Y)${NC}"
        VALID=false
      fi
      if [[ $FIELD == *pdfPoints* ]]; then
        if [ $(echo "$Y < 0" | bc -l) -eq 1 ]; then
          echo -e "${RED}${TYPE} ${FIELD}: Negative y at index $k (y=$Y)${NC}"
          VALID=false
        fi
        PDFSUM=$(echo "$PDFSUM + $Y * (3000-1800)/100" | bc -l)
        if [ $(echo "$Y > $PEAK_Y" | bc -l) -eq 1 ]; then
          PEAK_Y=$Y
          PEAK_IDX=$k
        fi
      elif [[ $FIELD == *cdfPoints* ]]; then
        if [ $(echo "$Y < 0 || $Y > 1" | bc -l) -eq 1 ]; then
          echo -e "${RED}${TYPE} ${FIELD}: y out of [0,1] at index $k (y=$Y)${NC}"
          VALID=false
        fi
        if [ $(echo "$Y < $LAST_Y" | bc -l) -eq 1 ]; then
          echo -e "${RED}${TYPE} ${FIELD}: Non-monotonic at index $k (y=$Y, prev=$LAST_Y)${NC}"
          VALID=false
        fi
        LAST_Y=$Y
        YS+=("$Y")
        if [ $k -gt 0 ]; then
          DY=$(echo "${YS[$k]} - ${YS[$k-1]}" | bc -l)
          if [ $(echo "$DY > $MAX_DY" | bc -l) -eq 1 ]; then
            MAX_DY=$DY
            MAX_DY_IDX=$k
          fi
        fi
      fi
    done
    if [[ $FIELD == *pdfPoints* ]]; then
      if [ $(echo "$PDFSUM < 0.8 || $PDFSUM > 1.2" | bc -l) -eq 1 ]; then
        echo -e "${RED}${TYPE} ${FIELD}: PDF sum not ≈1 (got $PDFSUM)${NC}"
        VALID=false
      fi
      VARIANCE=$(echo "$ARRAY" | jq '[.[].y] | add/length as $mean | map(. - $mean | . * .) | add/length' 2>/dev/null)
      if [ -z "$VARIANCE" ] || [ $(echo "$VARIANCE < 1e-10" | bc -l) -eq 1 ]; then
        echo -e "${RED}${TYPE} ${FIELD}: Variance too low or not computed (got $VARIANCE)${NC}"
        VALID=false
      fi
      if [ $PEAK_IDX -lt 10 ] || [ $PEAK_IDX -gt $((LENGTH-10)) ]; then
        echo -e "${RED}${TYPE} ${FIELD}: No central peak (peak at index $PEAK_IDX)${NC}"
        VALID=false
      else
        echo -e "${GREEN}${TYPE} ${FIELD}: Bell-shaped (peak at $PEAK_IDX/$LENGTH, variance=$VARIANCE)${NC}"
      fi
    elif [[ $FIELD == *cdfPoints* ]]; then
      if [ $MAX_DY_IDX -lt 20 ] || [ $MAX_DY_IDX -gt $((LENGTH-20)) ]; then
        echo -e "${RED}${TYPE} ${FIELD}: No central inflection (max slope at $MAX_DY_IDX/$LENGTH)${NC}"
        VALID=false
      else
        echo -e "${GREEN}${TYPE} ${FIELD}: Sigmoid-shaped (max slope at $MAX_DY_IDX/$LENGTH)${NC}"
      fi
    fi
    if [ "$VALID" = true ]; then
      echo -e "${GREEN}${TYPE} ${FIELD}: Valid (length=$LENGTH, finite x/y, constraints met)${NC}"
    else
      echo -e "${RED}${TYPE} ${FIELD}: Invalid${NC}"
    fi
  done

  # Log response fields for debugging
  echo -e "${YELLOW}${TYPE} response fields:${NC}"
  jq '.results[0] | keys' "$OUTPUT_FILE"
  # Log error and feedback messages
  echo -e "${YELLOW}${TYPE} error:${NC}"
  jq '.results[0].error' "$OUTPUT_FILE"
  echo -e "${YELLOW}${TYPE} feedbackMessages:${NC}"
  jq '.results[0].feedbackMessages' "$OUTPUT_FILE"
}

# Call for each type
call_and_validate "Baseline" "$BASELINE_PAYLOAD"
call_and_validate "Adjusted" "$ADJUSTED_PAYLOAD"
call_and_validate "Optimized" "$OPTIMIZED_PAYLOAD"

echo -e "${GREEN}Test completed. Check $OUTPUT_DIR for files.${NC}"
