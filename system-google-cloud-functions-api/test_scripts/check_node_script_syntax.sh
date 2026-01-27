#!/bin/bash

for file in core-*.js; do node --check "$file" && echo "$file is syntactically valid" || echo "$file has syntax errors"; done
