#!/bin/bash

# restrict_api_access.sh
# WHAT: Restricts access to the pmcEstimatorAPI Cloud Function to a specified service account.
# WHY: Ensures only the authorized service account (icarenow@pmc-estimator.iam.gserviceaccount.com) can invoke the API, preventing unauthorized access and aligning with Code.gs integration.
# WHERE: Called by deploy_pmc.sh (step 16) from /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api.
# HOW:
#   - Removes public access bindings (allUsers, allAuthenticatedUsers).
#   - Generates an IAM policy granting roles/cloudfunctions.invoker to the service account.
#   - Applies and validates the IAM policy.
# SECURITY SETUP:
#   - Ensures JWT-only access via --no-allow-unauthenticated and IAM restrictions.
#   - Aligns with deploy_pmc.sh’s default ingress settings.
# CHANGES:
#   - Updated comments to reflect default ingress settings, matching deploy_pmcEstimatorAPI.sh_V1.4_WORKS.
#   - Enhanced error handling and logging.

restrict_api_access() {
  local project_id="$1"
  local region="$2"
  local function_name="$3"
  local service_account_email="$4"
  local temp_policy_file="${5:-policy.json}"
  local RED='\033[0;31m'
  local GREEN='\033[0;32m'
  local YELLOW='\033[1;33m'
  local NC='\033[0m'

  echo -e "${YELLOW}Restricting access to Cloud Function $function_name in project $project_id, region $region to service account $service_account_email...${NC}"
  echo -e "${YELLOW}This ensures only $service_account_email can invoke the API. If Code.gs fails with 404, ensure Apps Script project association with $project_id (project number 615922754202) and check VPC Service Controls (run: gcloud access-context-manager policies list --project=$project_id), firewall rules, or Cloud Function logs (gcloud functions logs read $function_name --project=$project_id --region=$region).${NC}"

  if [ -z "$project_id" ] || [ -z "$region" ] || [ -z "$function_name" ] || [ -z "$service_account_email" ]; then
    echo -e "${RED}Error: Missing required parameters (project_id, region, function_name, service_account_email).${NC}"
    return 1
  fi

  echo -e "${YELLOW}Checking and removing public access bindings...${NC}"
  if gcloud functions get-iam-policy "$function_name" --project="$project_id" --region="$region" --format=json > current_policy.json 2> current_policy_error.log; then
    if jq -e '.bindings[] | select(.members[] | contains("allUsers") or contains("allAuthenticatedUsers"))' current_policy.json >/dev/null; then
      echo -e "${YELLOW}Removing public access bindings...${NC}"
      jq 'del(.bindings[] | select(.members[] | contains("allUsers") or contains("allAuthenticatedUsers")))' current_policy.json > cleaned_policy.json
      if ! gcloud functions set-iam-policy "$function_name" cleaned_policy.json --project="$project_id" --region="$region" > set_policy_log.txt 2>&1; then
        echo -e "${RED}Error: Failed to remove public access bindings. Check set_policy_log.txt.${NC}"
        cat set_policy_log.txt
        rm current_policy.json cleaned_policy.json set_policy_log.txt 2>/dev/null
        return 1
      fi
      echo -e "${GREEN}Public access bindings removed.${NC}"
    else
      echo -e "${GREEN}No public access bindings found.${NC}"
    fi
    rm current_policy.json cleaned_policy.json set_policy_log.txt 2>/dev/null
  else
    echo -e "${RED}Error: Failed to retrieve IAM policy. Check current_policy_error.log.${NC}"
    cat current_policy_error.log
    rm current_policy_error.log 2>/dev/null
    return 1
  fi

  echo -e "${YELLOW}Generating IAM policy file $temp_policy_file...${NC}"
  cat <<EOF > "$temp_policy_file"
{
  "bindings": [
    {
      "role": "roles/cloudfunctions.invoker",
      "members": [
        "serviceAccount:${service_account_email}"
      ]
    }
  ]
}
EOF

  echo -e "${YELLOW}Applying IAM policy...${NC}"
  if ! gcloud functions set-iam-policy "$function_name" "$temp_policy_file" --project="$project_id" --region="$region" > set_policy_log.txt 2>&1; then
    echo -e "${RED}Error: Failed to apply IAM policy. Check set_policy_log.txt.${NC}"
    cat set_policy_log.txt
    rm "$temp_policy_file" set_policy_log.txt 2>/dev/null
    return 1
  fi
  echo -e "${GREEN}IAM policy applied: $function_name restricted to $service_account_email.${NC}"

  echo -e "${YELLOW}Validating IAM policy...${NC}"
  if gcloud functions get-iam-policy "$function_name" --project="$project_id" --region="$region" --format=json > temp_iam_policy.json 2> validate_policy_error.log; then
    if jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.invoker\" and .members[]==\"serviceAccount:${service_account_email}\")" temp_iam_policy.json >/dev/null; then
      if jq -e '.bindings[] | select(.members[] | contains("allUsers") or contains("allAuthenticatedUsers"))' temp_iam_policy.json >/dev/null; then
        echo -e "${RED}Error: IAM policy contains public access bindings.${NC}"
        jq '.' temp_iam_policy.json
        rm temp_iam_policy.json "$temp_policy_file" validate_policy_error.log 2>/dev/null
        return 1
      fi
      echo -e "${GREEN}IAM policy validated: Only $service_account_email has access.${NC}"
      rm temp_iam_policy.json "$temp_policy_file" validate_policy_error.log 2>/dev/null
      return 0
    else
      echo -e "${RED}Error: IAM policy does not restrict to $service_account_email.${NC}"
      jq '.' temp_iam_policy.json
      rm temp_iam_policy.json "$temp_policy_file" validate_policy_error.log 2>/dev/null
      return 1
    fi
  else
    echo -e "${RED}Error: Failed to retrieve IAM policy. Check validate_policy_error.log.${NC}"
    cat validate_policy_error.log
    rm "$temp_policy_file" validate_policy_error.log 2>/dev/null
    return 1
  fi
}
