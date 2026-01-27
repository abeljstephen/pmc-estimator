#!/bin/bash

curl -X POST https://us-central1-pmc-estimator.cloudfunctions.net/pmcEstimatorAPI -H "Content-Type: application/json" -d '{"task":"Test","optimistic":10,"mostLikely":20,"pessimistic":30,"sliderValues":{"BF":50,"SF":50,"SC":50,"SRA":20,"RW":30,"RT":40,"Q":60,"RA":70},"targetValue":25,"optimizeFor":"none","confidenceLevel":0.9,"userSlider_Confidence":"confident"}'
