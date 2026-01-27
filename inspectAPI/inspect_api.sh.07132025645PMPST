#!/bin/bash

# Script to inspect settings and credentials for pmcEstimatorAPI Cloud Function
# Updated: July 13, 2025, 6:36 PM PDT
# Purpose: Generate a comprehensive report of credentials, service accounts, keys, permissions, and API configurations
# Output: Display results in terminal and write to a timestamped file

echo "Starting script..." | tee -a pmc_estimator_api_settings_$(date +%Y%m%d_%H%M%S).txt

# Initialize variables
PROJECT_ID=""
PROJECT_NUMBER=""
SERVICE_NAME="pmcEstimatorAPI"
SERVICE_ACCOUNT=""
APPS_SCRIPT_SERVICE_ACCOUNT="icarenow@pmc-estimator.iam.gserviceaccount.com"
APPS_SCRIPT_PROJECT_TITLE="PERT Estimator Add-on"  # Matches your Apps Script project title
APPS_SCRIPT_PROJECT_ID=""
REGION=""
TRIGGER_URL=""
INGRESS_SETTING=""
API_GATEWAY_ID=""
ENDPOINTS_ID=""
SERVICE_ACCOUNT_KEY_ID=""
APPS_SCRIPT_KEY_ID=""
LOG_TIMESTAMP=$(date -u -d "1 hour ago" +"%Y-%m-%dT%H:%M:%SZ")  # Dynamic: 1 hour before current time
LOG_LIMIT=50
OUTPUT_FILE="pmc_estimator_api_settings_$(date +%Y%m%d_%H%M%S).txt"
OAUTH2_SCOPES=""

# Validate prerequisites
echo "Validating prerequisites..." | tee -a $OUTPUT_FILE
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI not found. Please install Google Cloud SDK." | tee -a $OUTPUT_FILE
    exit 1
fi
if ! command -v jq &> /dev/null; then
    echo "Warning: jq not found. Some JSON parsing may fail. Install with 'brew install jq'." | tee -a $OUTPUT_FILE
fi
if ! command -v timeout &> /dev/null; then
    echo "Warning: timeout command not found. Install with 'brew install coreutils'." | tee -a $OUTPUT_FILE
fi
echo "----------------------------------------" | tee -a $OUTPUT_FILE

# Check and enable Apps Script API
echo "Checking Apps Script API (script.googleapis.com)..." | tee -a $OUTPUT_FILE
if ! gcloud services list --enabled --project=$PROJECT_ID --format='value(name)' | grep -q "script.googleapis.com"; then
    echo "Enabling Apps Script API..." | tee -a $OUTPUT_FILE
    if gcloud services enable script.googleapis.com --project=$PROJECT_ID &> /dev/null; then
        echo "Apps Script API enabled successfully." | tee -a $OUTPUT_FILE
    else
        echo "Error: Failed to enable Apps Script API. Ensure you have permissions (e.g., roles/serviceusage.serviceUsageAdmin)." | tee -a $OUTPUT_FILE
    fi
else
    echo "Apps Script API is already enabled." | tee -a $OUTPUT_FILE
fi

# Fetch PROJECT_ID
echo "Fetching Project ID..." | tee -a $OUTPUT_FILE
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "Error: Could not fetch PROJECT_ID. Ensure gcloud is authenticated." | tee -a $OUTPUT_FILE
    exit 1
fi
echo "Project ID: $PROJECT_ID" | tee -a $OUTPUT_FILE

# Fetch PROJECT_NUMBER
echo "Fetching Project Number..." | tee -a $OUTPUT_FILE
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
if [ -z "$PROJECT_NUMBER" ]; then
    PROJECT_NUMBER="unknown"
fi
echo "Project Number: $PROJECT_NUMBER" | tee -a $OUTPUT_FILE

# Fetch APPS_SCRIPT_PROJECT_ID
echo "Fetching Apps Script Project ID..." | tee -a $OUTPUT_FILE
APPS_SCRIPT_PROJECT_ID=$(gcloud beta app scripts list --project=$PROJECT_ID --format='value(scriptId)' --filter="title:$APPS_SCRIPT_PROJECT_TITLE" | head -n 1)
if [ -z "$APPS_SCRIPT_PROJECT_ID" ]; then
    echo "Warning: Could not find Apps Script project with title '$APPS_SCRIPT_PROJECT_TITLE'. Fetching first available project..." | tee -a $OUTPUT_FILE
    APPS_SCRIPT_PROJECT_ID=$(gcloud beta app scripts list --project=$PROJECT_ID --format='value(scriptId)' | head -n 1)
    if [ -z "$APPS_SCRIPT_PROJECT_ID" ]; then
        echo "Error: No Apps Script projects found in $PROJECT_ID. Check Apps Script API (script.googleapis.com) is enabled." | tee -a $OUTPUT_FILE
        APPS_SCRIPT_PROJECT_ID="unknown"
    else
        echo "Using first Apps Script project ID: $APPS_SCRIPT_PROJECT_ID" | tee -a $OUTPUT_FILE
    fi
else
    echo "Apps Script Project ID: $APPS_SCRIPT_PROJECT_ID" | tee -a $OUTPUT_FILE
fi

# Fetch OAUTH2_SCOPES
echo "Fetching OAuth2 Scopes for Apps Script..." | tee -a $OUTPUT_FILE
if [ "$APPS_SCRIPT_PROJECT_ID" != "unknown" ]; then
    OAUTH2_SCOPES=$(gcloud beta app scripts describe $APPS_SCRIPT_PROJECT_ID --project=$PROJECT_ID --format='value(oauthScopes)' 2>/dev/null || echo "none")
    if [ "$OAUTH2_SCOPES" = "none" ]; then
        echo "Warning: Could not fetch OAuth2 scopes for Apps Script project $APPS_SCRIPT_PROJECT_ID." | tee -a $OUTPUT_FILE
        OAUTH2_SCOPES="https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/script.external_request https://www.googleapis.com/auth/script.container.ui"
        echo "Using expected scopes: $OAUTH2_SCOPES" | tee -a $OUTPUT_FILE
    else
        echo "OAuth2 Scopes: $OAUTH2_SCOPES" | tee -a $OUTPUT_FILE
    fi
else
    OAUTH2_SCOPES="https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/script.external_request https://www.googleapis.com/auth/script.container.ui"
    echo "Warning: Apps Script Project ID not found. Using expected scopes: $OAUTH2_SCOPES" | tee -a $OUTPUT_FILE
fi

# Confirm Cloud Function and REGION
echo "Checking Cloud Function: $SERVICE_NAME..." | tee -a $OUTPUT_FILE
REGION=$(gcloud functions list --project=$PROJECT_ID --format='value(region)' --filter="name:$SERVICE_NAME" | head -n 1)
if [ -z "$REGION" ]; then
    REGION="us-central1"
    echo "Warning: Could not find $SERVICE_NAME. Using default region: $REGION" | tee -a $OUTPUT_FILE
    if ! gcloud functions describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID &> /dev/null; then
        echo "Error: Cloud Function $SERVICE_NAME not found in $REGION." | tee -a $OUTPUT_FILE
        exit 1
    fi
fi
echo "Confirmed: $SERVICE_NAME is a Cloud Function in $REGION" | tee -a $OUTPUT_FILE

# Fetch TRIGGER_URL
echo "Fetching TRIGGER_URL..." | tee -a $OUTPUT_FILE
TRIGGER_URL=$(gcloud functions describe $SERVICE_NAME --region=$REGION --format='value(httpsTrigger.url)')
if [ -z "$TRIGGER_URL" ]; then
    TRIGGER_URL="https://$REGION-$PROJECT_ID.cloudfunctions.net/$SERVICE_NAME"
    echo "Warning: Could not fetch TRIGGER_URL. Using default: $TRIGGER_URL" | tee -a $OUTPUT_FILE
fi
echo "Trigger URL: $TRIGGER_URL" | tee -a $OUTPUT_FILE

# Fetch SERVICE_ACCOUNT
echo "Fetching Cloud Function Service Account..." | tee -a $OUTPUT_FILE
SERVICE_ACCOUNT=$(gcloud functions describe $SERVICE_NAME --region=$REGION --format='value(serviceAccountEmail)')
if [ -z "$SERVICE_ACCOUNT" ]; then
    SERVICE_ACCOUNT="pmc-estimator@appspot.gserviceaccount.com"
    echo "Warning: Could not fetch service account. Using default: $SERVICE_ACCOUNT" | tee -a $OUTPUT_FILE
fi
echo "Cloud Function Service Account: $SERVICE_ACCOUNT" | tee -a $OUTPUT_FILE

# Fetch INGRESS_SETTING
echo "Fetching Ingress Setting..." | tee -a $OUTPUT_FILE
INGRESS_SETTING=$(gcloud functions describe $SERVICE_NAME --region=$REGION --format='value(ingressSettings)')
if [ -z "$INGRESS_SETTING" ]; then
    INGRESS_SETTING="unknown"
fi
echo "Ingress Setting: $INGRESS_SETTING" | tee -a $OUTPUT_FILE

# Fetch API_GATEWAY_ID
echo "Fetching API Gateway ID..." | tee -a $OUTPUT_FILE
API_GATEWAY_ID=$(timeout 10s gcloud api-gateway apis list --project=$PROJECT_ID --format='value(name)' | head -n 1 || echo "none")
echo "API Gateway ID: $API_GATEWAY_ID" | tee -a $OUTPUT_FILE

# Fetch ENDPOINTS_ID
echo "Fetching Cloud Endpoints ID..." | tee -a $OUTPUT_FILE
ENDPOINTS_ID=$(timeout 10s gcloud endpoints services list --project=$PROJECT_ID --format='value(serviceName)' | head -n 1 || echo "none")
echo "Cloud Endpoints ID: $ENDPOINTS_ID" | tee -a $OUTPUT_FILE

# Fetch SERVICE_ACCOUNT_KEY_ID
echo "Fetching Cloud Function Service Account Key ID..." | tee -a $OUTPUT_FILE
SERVICE_ACCOUNT_KEY_ID=$(gcloud iam service-accounts keys list --iam-account=$SERVICE_ACCOUNT --project=$PROJECT_ID --format='value(name)' | head -n 1 | awk -F'/' '{print $NF}' || echo "none")
echo "Cloud Function Service Account Key ID: $SERVICE_ACCOUNT_KEY_ID" | tee -a $OUTPUT_FILE

# Fetch APPS_SCRIPT_KEY_ID
echo "Fetching Apps Script Service Account Key ID..." | tee -a $OUTPUT_FILE
APPS_SCRIPT_KEY_ID=$(gcloud iam service-accounts keys list --iam-account=$APPS_SCRIPT_SERVICE_ACCOUNT --project=$PROJECT_ID --format='value(name)' | head -n 1 | awk -F'/' '{print $NF}' || echo "b50a032441999fd2a9a14bb3f7e9fc7e43cbdcd9")
echo "Apps Script Service Account Key ID: $APPS_SCRIPT_KEY_ID" | tee -a $OUTPUT_FILE

# Fetch Key Restrictions
echo "Fetching Key Restrictions for Apps Script Service Account..." | tee -a $OUTPUT_FILE
KEY_RESTRICTIONS=$(gcloud iam service-accounts keys describe projects/$PROJECT_ID/serviceAccounts/$APPS_SCRIPT_SERVICE_ACCOUNT/keys/$APPS_SCRIPT_KEY_ID --project=$PROJECT_ID --format='value(restrictions)' || echo "none")
echo "Key Restrictions: $KEY_RESTRICTIONS" | tee -a $OUTPUT_FILE

# Check Active Accounts
echo "Fetching Active Accounts..." | tee -a $OUTPUT_FILE
echo "\n1. Active Accounts" | tee -a $OUTPUT_FILE
gcloud auth list --format='value(account, status)' | tee -a $OUTPUT_FILE

# Check Enabled APIs
echo "Fetching Enabled APIs..." | tee -a $OUTPUT_FILE
echo "\n2. Enabled APIs" | tee -a $OUTPUT_FILE
gcloud services list --enabled --project=$PROJECT_ID | tee -a $OUTPUT_FILE || echo "Error: Failed to list enabled APIs" | tee -a $OUTPUT_FILE

# Check Service Accounts
echo "Fetching Service Accounts..." | tee -a $OUTPUT_FILE
echo "\n3. Service Accounts" | tee -a $OUTPUT_FILE
gcloud iam service-accounts list --project=$PROJECT_ID | tee -a $OUTPUT_FILE || echo "Error: Failed to list service accounts" | tee -a $OUTPUT_FILE

# Check IAM Roles for Cloud Function Service Account
echo "Fetching IAM Roles for Cloud Function Service Account..." | tee -a $OUTPUT_FILE
echo "\n4. Cloud Function Service Account IAM Roles" | tee -a $OUTPUT_FILE
gcloud projects get-iam-policy $PROJECT_ID --format=json | jq '.bindings[] | select(.members[] | contains("serviceAccount:'$SERVICE_ACCOUNT'"))' | tee -a $OUTPUT_FILE || echo "Error: Failed to retrieve IAM roles for $SERVICE_ACCOUNT" | tee -a $OUTPUT_FILE

# Check IAM Roles for Apps Script Service Account
echo "Fetching IAM Roles for Apps Script Service Account..." | tee -a $OUTPUT_FILE
echo "\n5. Apps Script Service Account IAM Roles" | tee -a $OUTPUT_FILE
gcloud projects get-iam-policy $PROJECT_ID --format=json | jq '.bindings[] | select(.members[] | contains("serviceAccount:'$APPS_SCRIPT_SERVICE_ACCOUNT'"))' | tee -a $OUTPUT_FILE || echo "Error: Failed to retrieve IAM roles for $APPS_SCRIPT_SERVICE_ACCOUNT" | tee -a $OUTPUT_FILE

# Check Cloud Function IAM Policy
echo "Fetching Cloud Function IAM Policy..." | tee -a $OUTPUT_FILE
echo "\n6. Cloud Function IAM Policy" | tee -a $OUTPUT_FILE
gcloud functions get-iam-policy $SERVICE_NAME --region=$REGION --project=$PROJECT_ID | tee -a $OUTPUT_FILE || echo "Error: IAM policy not found for $SERVICE_NAME" | tee -a $OUTPUT_FILE

# Check Apps Script Service Account Invoker Permission
echo "Checking Apps Script Service Account Invoker Permission..." | tee -a $OUTPUT_FILE
APPS_SCRIPT_INVOKER=$(gcloud functions get-iam-policy $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --format=json | jq '.bindings[] | select(.role=="roles/cloudfunctions.invoker") | .members[]' | grep "$APPS_SCRIPT_SERVICE_ACCOUNT" || echo "none")
echo "Apps Script Invoker Permission: $( [ "$APPS_SCRIPT_INVOKER" != "none" ] && echo "Present" || echo "Missing" )" | tee -a $OUTPUT_FILE

# Check Apps Script Project Details
echo "Fetching Apps Script Project Details..." | tee -a $OUTPUT_FILE
echo "\n7. Apps Script Project Details" | tee -a $OUTPUT_FILE
if [ "$APPS_SCRIPT_PROJECT_ID" != "unknown" ]; then
    APPS_SCRIPT_DETAILS=$(gcloud beta app scripts describe $APPS_SCRIPT_PROJECT_ID --project=$PROJECT_ID 2>/dev/null || echo "none")
    echo "Apps Script Project Details: $APPS_SCRIPT_DETAILS" | tee -a $OUTPUT_FILE
else
    echo "Warning: Apps Script Project ID not found." | tee -a $OUTPUT_FILE
fi

# Check Detailed Service Account Key Information
echo "Fetching Detailed Service Account Key Information..." | tee -a $OUTPUT_FILE
echo "\n8. Detailed Service Account Key Information" | tee -a $OUTPUT_FILE
gcloud iam service-accounts keys list --iam-account=$APPS_SCRIPT_SERVICE_ACCOUNT --project=$PROJECT_ID --format="table(name.basename(), createdAt, expiresAt, validAfterTime, validBeforeTime)" | tee -a $OUTPUT_FILE || echo "Error: Failed to list keys for $APPS_SCRIPT_SERVICE_ACCOUNT" | tee -a $OUTPUT_FILE
gcloud iam service-accounts keys list --iam-account=$SERVICE_ACCOUNT --project=$PROJECT_ID --format="table(name.basename(), createdAt, expiresAt, validAfterTime, validBeforeTime)" | tee -a $OUTPUT_FILE || echo "Error: Failed to list keys for $SERVICE_ACCOUNT" | tee -a $OUTPUT_FILE

# Check Audit Logs for Service Account
echo "Fetching Audit Logs for Apps Script Service Account..." | tee -a $OUTPUT_FILE
echo "\n9. Audit Logs for Apps Script Service Account" | tee -a $OUTPUT_FILE
gcloud logging read "resource.type=service_account resource.labels.email_id=$APPS_SCRIPT_SERVICE_ACCOUNT" --project=$PROJECT_ID --limit=$LOG_LIMIT --format="yaml" | tee -a $OUTPUT_FILE || echo "No audit logs found for $APPS_SCRIPT_SERVICE_ACCOUNT" | tee -a $OUTPUT_FILE

# Check Recent API Logs
echo "Fetching Recent API Logs..." | tee -a $OUTPUT_FILE
echo "\n10. Recent API Logs" | tee -a $OUTPUT_FILE
gcloud logging read "resource.type=cloud_function resource.labels.function_name=$SERVICE_NAME timestamp>=\"$LOG_TIMESTAMP\"" --project=$PROJECT_ID --limit=$LOG_LIMIT --format="yaml" | tee -a $OUTPUT_FILE || echo "No logs found" | tee -a $OUTPUT_FILE
if ! gcloud logging read "resource.type=cloud_function resource.labels.function_name=$SERVICE_NAME timestamp>=\"$LOG_TIMESTAMP\"" --project=$PROJECT_ID --limit=1 &> /dev/null; then
    echo "No recent logs found. Trying older logs..." | tee -a $OUTPUT_FILE
    gcloud logging read "resource.type=cloud_function resource.labels.function_name=$SERVICE_NAME timestamp>=\"2025-07-01T00:00:00Z\"" --project=$PROJECT_ID --limit=$LOG_LIMIT --format="yaml" | tee -a $OUTPUT_FILE || echo "No older logs found" | tee -a $OUTPUT_FILE
fi

# Check Billing Status
echo "Checking Billing Status..." | tee -a $OUTPUT_FILE
echo "\n11. Billing Status" | tee -a $OUTPUT_FILE
BILLING_STATUS=$(gcloud billing projects describe $PROJECT_ID --format='value(billingEnabled)' || echo "unknown")
echo "Billing Enabled: $BILLING_STATUS" | tee -a $OUTPUT_FILE
echo "Note: Check Google Cloud Console (Billing > Overview) for detailed usage and budget alerts." | tee -a $OUTPUT_FILE

# Check Organization Policies
echo "Checking Organization Policies..." | tee -a $OUTPUT_FILE
echo "\n12. Organization Policies" | tee -a $OUTPUT_FILE
gcloud org-policies list --project=$PROJECT_ID | tee -a $OUTPUT_FILE || echo "Error: Failed to list organization policies" | tee -a $OUTPUT_FILE

# Test Unauthenticated Access to Cloud Function
echo "Testing Unauthenticated Access to Cloud Function..." | tee -a $OUTPUT_FILE
echo "\n13. Unauthenticated Access Test" | tee -a $OUTPUT_FILE
UNAUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" $TRIGGER_URL)
echo "HTTP Status Code: $UNAUTH_CODE" | tee -a $OUTPUT_FILE
echo "Expected: 403 Forbidden for unauthenticated access" | tee -a $OUTPUT_FILE

# Test API Call with Correct Payload
echo "Testing API Call with Flattened Payload..." | tee -a $OUTPUT_FILE
echo "\n14. Test API Call" | tee -a $OUTPUT_FILE
echo "Generating ID token..." | tee -a $OUTPUT_FILE
token=$(gcloud auth print-identity-token --account=$APPS_SCRIPT_SERVICE_ACCOUNT)
if [ -z "$token" ]; then
    echo "Error: Failed to generate ID token." | tee -a $OUTPUT_FILE
else
    echo "Sending test API call..." | tee -a $OUTPUT_FILE
    API_RESPONSE=$(curl -s -H "Authorization: Bearer $token" -H "Content-Type: application/json" -X POST -d '[{"task":"Test","optimistic":1.0,"mostLikely":2.0,"pessimistic":3.0,"budgetFlexibility":0.0,"scheduleFlexibility":0.0,"scopeCertainty":0.0,"qualityTolerance":0.0,"targetValue":1.0,"confidenceLevel":0.9,"targetProbabilityOnly":false,"optimizeFor":"target"}]' https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI)
    echo "API Response: $API_RESPONSE" | tee -a $OUTPUT_FILE
fi

echo "Script completed. Check $OUTPUT_FILE for full report." | tee -a $OUTPUT_FILE
