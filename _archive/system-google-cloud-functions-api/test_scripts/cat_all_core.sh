#!/bin/bash

# Script to concatenate all files in the core directory
# Run from: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/test_scripts
# Reads files from: /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/core

find /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api/core -type f -exec cat {} \;
