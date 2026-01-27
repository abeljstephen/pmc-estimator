#!/bin/bash

# Function: restrict_cloud_function_access
# Purpose: Restricts a Google Cloud Function to be invoked only by a specified service account.
# Usage: restrict_cloud_function_access <project_id> <region> <function_name> <service_account_email> [temp_policy_file]
# Parameters:
#   project_id: Google Cloud project ID (e.g., pmc-estimator)
#   region: Google Cloud region (e.g., us-central1)
#   function_name: Name of the Cloud Function (e.g., pmcEstimatorAPI)
#   service_account_email: Service account to grant invocation access (e.g., icarenow@pmc-estimator.iam.gserviceaccount.com)
#   temp_policy_file: Optional temporary IAM policy file name (defaults to policy.json)
# Returns:
#   0 on success, 1 on failure with error messages
restrict_cloud_function_access() {
  local project_id="$1"
  local region="$2"
  local function_name="$3"
  local service_account_email="$4"
  local temp_policy_file="${5:-policy.json}"
  local RED='\033[0;31m'
  local GREEN='\033[0;32m'
  local YELLOW='\033[1;33m'
  local NC='\033[0m'

  echo -e "${YELLOW}Restricting ${function_name} to ${service_account_email} in project ${project_id}, region ${region}...${NC}"

  # Generate IAM policy file
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

  # Apply IAM policy
  echo -e "${YELLOW}Applying IAM policy from ${temp_policy_file}...${NC}"
  if ! gcloud functions set-iam-policy "$function_name" "$temp_policy_file" \
    --project="$project_id" --region="$region" >/dev/null; then
    echo -e "${RED}Error: Failed to apply IAM policy for ${function_name}.${NC}"
    /bin/rm "$temp_policy_file"
    return 1
  fi
  echo -e "${GREEN}IAM policy applied successfully.${NC}"

  # Validate IAM policy
  echo -e "${YELLOW}Validating IAM policy...${NC}"
  if gcloud functions get-iam-policy "$function_name" --project="$project_id" --region="$region" --format=json > temp_iam_policy.json; then
    if jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.invoker\" and .members[]==\"serviceAccount:${service_account_email}\")" temp_iam_policy.json >/dev/null; then
      echo -e "${GREEN}IAM policy validated: Only ${service_account_email} has roles/cloudfunctions.invoker.${NC}"
      /bin/rm temp_iam_policy.json "$temp_policy_file"
      return 0
    else
      echo -e "${RED}Error: IAM policy does not restrict invocation to ${service_account_email}.${NC}"
      jq '.' temp_iam_policy.json
      /bin/rm temp_iam_policy.json "$temp_policy_file"
      return 1
    fi
  else
    echo -e "${RED}Error: Failed to retrieve IAM policy for ${function_name}.${NC}"
    /bin/rm "$temp_policy_file"
    return 1
  fi
}
