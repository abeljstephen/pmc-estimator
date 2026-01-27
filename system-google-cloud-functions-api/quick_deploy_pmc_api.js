#!/usr/bin/env node
/**
 * quick_deploy_pmc_api.js — FINAL v7.1
 * Fixes URL retrieval for Gen2 (serviceConfig.uri)
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const REGION = "us-central1";
const FUNCTION_NAME = "pmcEstimatorAPI";
const PROJECT_ID = process.env.GCP_PROJECT || sh(`gcloud config get-value project --quiet`).trim();
const USER_ACCOUNT = "abeljstephen@gmail.com";
const SA_EMAIL = `icarenow@${PROJECT_ID}.iam.gserviceaccount.com`;
const SA_KEYFILE = path.resolve(__dirname, "pmc-estimator-b50a03244199.json");
const ZIP_NAME = "pmc-source.zip";
const STAGING_BUCKET = `gs://${PROJECT_ID}_cloudbuild`;  
const MARKER_FILE = "core/main/main.js";

function ts() { return new Date().toTimeString().slice(0,8); }
function log(type, msg) { console.log(`[${ts()}] ${type.padEnd(7)} ${msg}`); }
function success(m) { log("SUCCESS", m); }
function info(m)    { log("INFO", m); }
function warn(m)    { log("WARN", m); }
function fail(m)    { console.error(`[ERROR ${ts()}] ${m}`); process.exit(1); }

function sh(cmd, allowFail = false) {
  const res = spawnSync(cmd, { shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (res.status !== 0 && !allowFail) {
    console.error(`FAILED: ${cmd}`);
    console.error("STDOUT:", res.stdout);
    console.error("STDERR:", res.stderr);
    process.exit(1);
  }
  return res.stdout.trim();
}

(async () => {
  try {
    console.log("\nPMC API — FINAL FRESH DEPLOY v7.1\n");

    // Verify location
    if (!fs.existsSync("package.json") || !fs.existsSync("index.js") || !fs.existsSync("core/main/main.js")) {
      fail("Run from folder with package.json and index.js");
    }

    // 1. Marker for fresh
    const marker = `// FRESH_DEPLOY_${Date.now()}_${Math.random().toString(36).slice(2,10)}`;
    const original = fs.readFileSync(MARKER_FILE, "utf8");
    if (!original.includes(marker)) {
      fs.appendFileSync(MARKER_FILE, `\n${marker}\n`);
      info("Injected marker");
    }

    // 2. Zip
    if (fs.existsSync(ZIP_NAME)) fs.unlinkSync(ZIP_NAME);
    info("Creating zip...");
    sh(`zip -r ${ZIP_NAME} . -x "*.git*" "node_modules/**" ".deploy_build/**" "archive/**" "*.log" "${ZIP_NAME}"`);
    success(`Zip ready: ${(fs.statSync(ZIP_NAME).size/1024/1024).toFixed(1)} MB`);

    // 3. Switch to owner for grants
    const cur = sh(`gcloud config get-value account --quiet`);
    if (cur !== USER_ACCOUNT) {
      sh(`gcloud config set account ${USER_ACCOUNT}`);
      success("Switched to OWNER");
    }

    // 4. Grant ALL min roles
    const roles = [
      "roles/cloudfunctions.developer",
      "roles/cloudbuild.builds.builder",
      "roles/artifactregistry.writer",
      "roles/storage.objectAdmin",
      "roles/storage.bucketCreator",
      "roles/iam.serviceAccountUser"
    ];
    roles.forEach(r => sh(`gcloud projects add-iam-policy-binding ${PROJECT_ID} --member="serviceAccount:${SA_EMAIL}" --role="${r}" --quiet`, true));
    success("All roles granted");

    // 5. Create bucket if missing
    info(`Ensuring bucket ${STAGING_BUCKET}`);
    sh(`gsutil mb -l ${REGION} ${STAGING_BUCKET} || true`, true);

    // 6. Upload with unique name
    const uniqueZip = `${Date.now()}_${ZIP_NAME}`;
    const remotePath = `${STAGING_BUCKET}/${uniqueZip}`;
    info(`Uploading to ${remotePath}`);
    sh(`gsutil cp ${ZIP_NAME} ${remotePath}`);
    success("Uploaded to GCS");

    // 7. Switch to SA
    sh(`gcloud auth activate-service-account ${SA_EMAIL} --key-file="${SA_KEYFILE}" --quiet`);
    sh(`gcloud config set account ${SA_EMAIL}`);

    // 8. DEPLOY
    info("Deploying from GCS...");
    const freshLabel = `deploy_${Date.now()}`;
    const deployCmd = [
      "gcloud functions deploy", FUNCTION_NAME,
      "--gen2",
      `--region=${REGION}`,
      "--runtime=nodejs20",
      "--entry-point=pmcEstimatorAPI",
      `--source=${remotePath}`,
      "--trigger-http",
      `--service-account=${SA_EMAIL}`,
      "--timeout=900s",
      "--cpu=2",
      "--memory=2Gi",
      "--min-instances=1",
      "--set-env-vars=DEBUG_OPT=true,LOG_EXECUTION_ID=true",
      "--quiet",
      `--update-labels=${freshLabel}=1`
    ].join(" ");

    sh(deployCmd);
    success("Deploy finished");

    // 9. Wait ACTIVE
    info("Waiting for ACTIVE");
    let status = "";
    for (let i = 0; i < 30; i++) {
      status = sh(`gcloud functions describe ${FUNCTION_NAME} --region=${REGION} --format="value(state)"`, true);
      if (status === "ACTIVE") break;
      process.stdout.write(".");
      sh("sleep 15");
    }
    console.log();
    status === "ACTIVE" ? success("ACTIVE!") : warn("Still deploying...");

    // 10. Get URL (Gen2 fix: use serviceConfig.uri)
    let url = sh(`gcloud functions describe ${FUNCTION_NAME} --region=${REGION} --format="value(serviceConfig.uri)"`, true);
    if (!url) {
      warn("serviceConfig.uri not found, trying httpsTrigger.url");
      url = sh(`gcloud functions describe ${FUNCTION_NAME} --region=${REGION} --format="value(httpsTrigger.url)"`, true);
    }
    if (!url) fail("Could not get function URL");

    const token = sh(`gcloud auth print-identity-token --audiences=${url} --quiet`);

    const payload = JSON.stringify([{task:"test",optimistic:1800,mostLikely:2400,pessimistic:3000,optimize:true,adaptive:true,probeLevel:5}]);

    info("Testing adaptive...");
    const resp = sh(`curl -s -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '${payload}' "${url}"`);
    const m = resp.match(/"adaptiveProbability":\s*([0-9.]+)/);
    if (m && parseFloat(m[1]) > 0.5) {
      success(`PASSED — adaptive ≈ ${(parseFloat(m[1])*100).toFixed(2)}%`);
    } else {
      console.log("Response:", resp.slice(0,500));
      warn("Not 72% — check response");
    }

    // 11. Cleanup
    fs.writeFileSync(MARKER_FILE, original.replace(/\/\/ FRESH_DEPLOY_[^\\n]*\\n/g, ""));
    sh(`gsutil rm ${remotePath}`, true);
    info("Cleaned up");

    success(`\nDEPLOY SUCCESSFUL — Dec 5 optimizer LIVE!`);
    console.log(`URL: ${url}\n`);

  } catch (e) {
    fail(e.message || e);
  }
})();
