#!/bin/bash
# File: deploy_validate.sh
# Purpose: Validates the deployment of pmcEstimatorAPI
# Used in: deploy_pmc.sh step 23
# Validates: Checks if the Cloud Function exists, is active, has the correct URL, and has proper IAM policies
# Arguments: project_id, region, function_name, service_account, deploy_log_file
# Returns: 0 on success, 1 on failure

validate_deploy() {
  local project_id="$1"
  local region="$2"
  local function_name="$3"
  local service_account="$4"
  local deploy_log_file="$5"

  # Validate inputs
  if [ -z "$project_id" ] || [ -z "$region" ] || [ -z "$function_name" ] || [ -z "$service_account" ] || [ -z "$deploy_log_file" ]; then
    printf "\033[0;31mError: validate_deploy requires project_id, region, function_name, service_account, and deploy_log_file arguments\033[0m\n" | tee -a "$deploy_log_file"
    return 1
  }

  # Check function existence and status
  local function_describe=$(gcloud functions describe "$function_name" --project="$project_id" --region="$region" --format=json 2>> "$deploy_log_file")
  if [ $? -ne 0 ]; then
    printf "\033[0;31mError: Failed to describe function $function_name in $region. Check Cloud Build logs or function logs.\033[0m\n" | tee -a "$deploy_log_file"
    return 1
  fi
  local function_status=$(echo "$function_describe" | jq -r '.status // "UNKNOWN"')
  local function_url=$(echo "$function_describe" | jq -r '.httpsTrigger.url // ""')
  if [ "$function_status" != "ACTIVE" ]; then
    printf "\033[0;31mError: Function $function_name is not ACTIVE (status: $function_status).\033[0m\n" | tee -a "$deploy_log_file"
    return 1
  fi
  if [ -z "$function_url" ]; then
    printf "\033[0;31mError: Function $function_name has no HTTPS trigger URL.\033[0m\n" | tee -a "$deploy_log_file"
    return 1
  fi
  printf "\033[0;32mFunction $function_name is ACTIVE with URL $function_url.\033[0m\n" | tee -a "$deploy_log_file"

  # Check IAM policy
  local iam_policy=$(gcloud functions get-iam-policy "$function_name" --project="$project_id" --region="$region" --format=json 2>> "$deploy_log_file")
  if [ $? -ne 0 ]; then
    printf "\033[0;33mWarning: Failed to retrieve IAM policy for $function_name. Ensure permissions for cloudfunctions.functions.getIamPolicy.\033[0m\n" | tee -a "$deploy_log_file"
  else
    if echo "$iam_policy" | jq -e ".bindings[] | select(.role==\"roles/cloudfunctions.invoker\" and .members[]==\"serviceAccount:$service_account\")" >/dev/null; then
      printf "\033[0;32mIAM policy validated: $service_account has roles/cloudfunctions.invoker.\033[0m\n" | tee -a "$deploy_log_file"
    else
      printf "\033[0;31mError: $service_account does not have roles/cloudfunctions.invoker.\033[0m\n" | tee -a "$deploy_log_file"
      return 1
    fi
    if echo "$iam_policy" | jq -e '.bindings[] | select(.members[] | contains("allUsers") or contains("allAuthenticatedUsers"))' >/dev/null; then
      printf "\033[0;33mWarning: IAM policy contains public access bindings (allUsers or allAuthenticatedUsers).\033[0m\n" | tee -a "$deploy_log_file"
    else
      printf "\033[0;32mNo public access bindings in IAM policy.\033[0m\n" | tee -a "$deploy_log_file"
    fi
  fi

  return 0
}
