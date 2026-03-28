#!/bin/bash

cd /Users/abeljstephen/pmc-estimator/system-google-cloud-functions-api
NODE_DEBUG=fs,http,net PORT=8081 USE_CORE=1 npm run start -- --verbose > server.log 2>&1 &
sleep 5

curl -X POST http://localhost:8081 -H "Content-Type: application/json" -d '{"task":{"task":"Cost","optimistic":1800,"mostLikely":2400,"pessimistic":3000},"sliderValues":{"budgetFlexibility":50,"scheduleFlexibility":50,"scopeCertainty":50,"scopeReductionAllowance":10,"reworkPercentage":20,"riskTolerance":70},"targetValue":2500,"userSlider_Confidence":"confident"}' > response.json

cat response.json | grep -i "error"
cat server.log
