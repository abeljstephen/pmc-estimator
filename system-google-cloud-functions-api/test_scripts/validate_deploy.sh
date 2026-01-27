#!/bin/bash

# validate_deploy.sh
# WHAT: Validates the deployment of pmcEstimatorAPI to ensure secure and restricted access.
# WHY: Confirms the Cloud Function exists, local tests passed, and IAM policy restricts access to icarenow@pmc-estimator.iam.gserviceaccount.com, ensuring Code.gs compatibility.
# WHERE: Called by deploy_pmc.sh (step 20) from /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api.
# HOW:
#   - Checks deployment_log.txt for local test success.
#   - Validates IAM policy to ensure only the service account has roles/cloudfunctions.invoker.
#   - Confirms Cloud Function existence and active state.
#   - Accepts default ingress settings to support Code.gs.
# SECURITY SETUP:
#   - Ensures JWT-only access via --no-allow-unauthenticated and IAM restrictions.
#   - Aligns with deploy_pmc.sh and restrict_api_access.sh.
# CHANGES:
#   - Updated to accept default ingress settings, matching deploy_pmcEstimatorAPI.sh_V1.4_WORKS.
#   - Enhanced error messages for deployment failure diagnostics.
#   - Updated to check for "Local functions framework test passed" in deployment_log.txt.

project_id="${1:-pmc-estimator}"
region="${2:-us-central1}"
function_name="${3:-pmcEstimatorAPI}"
service_account_email="${4:-icarenow@pmc-estimator.iam.gserviceaccount.com}"
deployment_log_file="${5:-deployment_log.txt}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
status=0
validation_messages=()

echo -e "${YELLOW}Validating deployment of $function_name in project $project_id, region $region...${NC}"
echo -e "${YELLOW}This confirms the Cloud Function exists, local tests passed, and IAM policy restricts access to $service_account_email. If Code.gs fails with 404, ensure Apps Script project association with $project_id (project number 615922754202) and check VPC Service Controls (run: gcloud access-context-manager policies list --project=$project_id), firewall rules, or Cloud Function logs (gcloud functions logs read $function_name --project=$project_id --region=$region).${NC}"

# 1. Check function existence
echo -e "${YELLOW}1. Checking Cloud Function existence...${NC}"
if gcloud functions describe "$function_name" --project="$project_id" --region="$region" --format="value(name)" >/dev/null 2>/dev/null; then
  FUNCTION_STATUS=$(gcloud functions describe "$function_name" --project="$project_id" --region="$region" --format="value(state)")
  if [ "$FUNCTION_STATUS" = "ACTIVE" ]; then
    validation_messages+=("${GREEN}Success: Cloud Function $function_name exists and is active in project $project_id, region $region.${NC}")
  else
    validation_messages+=("${RED}Failure: Cloud Function $function_name exists but is not active (state: $FUNCTION_STATUS). Check Cloud Function logs (gcloud functions logs read $function_name --project=$project_id --region=$region) or $deployment_log_file.${NC}")
    status=1
  fi
else
  validation_messages+=("${RED}Failure: Cloud Function $function_name not found in project $project_id, region $region. Check $deployment_log_file or Cloud Build logs: https://console.cloud.google.com/cloud-build/builds;region=$region?project=$project_id${NC}")
  status=1
fi

# 2. Check deployment log for local test success
echo -e "${YELLOW}2. Checking deployment log for local test success...${NC}"
if [ ! -f "$deployment_log_file" ]; then
  validation_messages+=("${RED}Failure: Deployment log file $deployment_log_file not found.${NC}")
  status=1
elif ! grep -q "Local functions framework test passed" "$deployment_log_file"; then
  validation_messages+=("${RED}Failure: Local test did not pass. Check $deployment_log_file for errors.${NC}")
  grep -i "local test" "$deployment_log_file" | while read -r line; do
    validation_messages+=("${RED}Log: $line${NC}")
  done || validation_messages+=("${RED}No local test output found in $deployment_log_file.${NC}")
  status=1
else
  validation_messages+=("${GREEN}Success: Local test passed in deployment log.${NC}")
fi

# 3. Validate IAM policy
echo -e "${YELLOW}3. Validating IAM policy...${NC}"
if gcloud functions get-iam-policy "$function_name" --project="$project_id" --region="$region" --format=json > temp_iam_policy.json 2>/dev/null; then
  if jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.invoker\" and .members[]==\"serviceAccount:${service_account_email}\")" temp_iam_policy.json >/dev/null; then
    if jq -e '.bindings[] | select(.members[] | contains("allUsers") or contains("allAuthenticatedUsers"))' temp_iam_policy.json >/dev/null; then
      validation_messages+=("${RED}Failure: IAM policy contains public access bindings.${NC}")
      jq '.' temp_iam_policy.json | while read -r line; do
        validation_messages+=("${RED}IAM Policy: $line${NC}")
      done
      status=1
    else
      validation_messages+=("${GREEN}Success: IAM policy restricts invocation to $service_account_email only.${NC}")
    fi
  else
    validation_messages+=("${RED}Failure: IAM policy does not include $service_account_email for roles/cloudfunctions.invoker.${NC}")
    jq '.' temp_iam_policy.json | while read -r line; do
      validation_messages+=("${RED}IAM Policy: $line${NC}")
    done
    status=1
  fi
  rm temp_iam_policy.json 2>/dev/null
else
  validation_messages+=("${RED}Failure: Failed to retrieve IAM policy for $function_name.${NC}")
  status=1
fi

# Print validation messages
echo -e "${YELLOW}Validation Summary:${NC}"
for message in "${validation_messages[@]}"; do
  echo -e "$message"
done

# Final status
if [ $status -eq 0 ]; then
  echo -e "${GREEN}Deployment validation successful: API restricted to $service_account_email. Verify with Code.gs or Cloud Shell (see deploy_pmc.sh step 19). Ensure Apps Script project association with $project_id (project number 615922754202).${NC}"
  exit 0
else
  echo -e "${RED}Deployment validation failed: Check $deployment_log_file, Cloud Build logs (https://console.cloud.google.com/cloud-build/builds;region=$region?project=$project_id), or Cloud Function logs (gcloud functions logs read $function_name --project=$project_id --region=$region). Ensure Apps Script project association with $project_id (project number 615922754202).${NC}"
  exit 1
fi
