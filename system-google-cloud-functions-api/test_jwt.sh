#!/bin/bash
SERVICE_ACCOUNT_KEY="pmc-estimator-b50a03244199.json"
KEY_CLIENT_EMAIL=$(jq -r '.client_email' "$SERVICE_ACCOUNT_KEY")
PRIVATE_KEY=$(jq -r '.private_key' "$SERVICE_ACCOUNT_KEY")
HEADER=$(echo -n '{"alg":"RS256","typ":"JWT"}' | base64 -w0 | tr -d '=' | tr '/+' '_-')
NOW=$(date +%s)
PAYLOAD=$(echo -n "{\"iss\":\"${KEY_CLIENT_EMAIL}\",\"aud\":\"https://oauth2.googleapis.com/token\",\"exp\":$((NOW+3600)),\"iat\":${NOW},\"scope\":\"https://www.googleapis.com/auth/cloud-platform\"}" | base64 -w0 | tr -d '=' | tr '/+' '_-')
SIGNATURE_INPUT="${HEADER}.${PAYLOAD}"
TEMP_KEY_FILE=$(mktemp)
echo "$PRIVATE_KEY" > "$TEMP_KEY_FILE"
SIGNATURE=$(echo -n "${SIGNATURE_INPUT}" | openssl dgst -sha256 -sign "$TEMP_KEY_FILE" | base64 -w0 | tr -d '=' | tr '/+' '_-')
rm "$TEMP_KEY_FILE"
JWT="${SIGNATURE_INPUT}.${SIGNATURE}"
curl -v -X POST https://oauth2.googleapis.com/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${JWT}" > token_response.txt 2> token_error.txt
cat token_response.txt
cat token_error.txt
