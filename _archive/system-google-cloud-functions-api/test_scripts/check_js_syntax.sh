#!/bin/bash

# Script to check syntax of all core*.js files in the current directory
# Requires Node.js installed; assumes no ESLint for basic syntax check
# Run from the directory containing the files: ./check_js_syntax.sh

for file in core*.js; do
  if [ -f "$file" ]; then
    echo "Checking syntax for $file..."
    node --check "$file" 2>&1
    if [ $? -eq 0 ]; then
      echo "$file: Syntax OK"
    else
      echo "$file: Syntax Error"
    fi
    echo "---------------------"
  fi
done
