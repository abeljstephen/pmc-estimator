#!/usr/bin/env node
/**
 * deploy_pmc_api.js — OWNER→SA IAM flow + single “PERT Test” + PERT-derived target + 5-scenario batch
 *
 * Flow:
 *   1) Switch to OWNER (abeljstephen@gmail.com) → grant SA deploy-time roles + function invoker.
 *   2) Switch to SA → call API once (baseline, no target) to get PERT mean.
 *   3) Compute target = PERT * 1.15.
 *   4) Send ONE batched request { tasks: [ ...5 scenarios... ] }.
 *   5) Print self-contained tables (Scenario summary + Sliders legend per run + sliders tables).
 *   6) Switch back to OWNER → revoke project roles (invoker retained). Run one unauthenticated negative test.
 *
 * Slider views (we print all three for clarity in tables):
 *   - optimize.sliders       : UI units (back-compat). 0–100; reworkPercentage 0–50
 *   - optimize.scaledSliders : UI units (canonical mirror, future-proof naming)
 *   - optimize.sliders01     : normalized [0–1]; reworkPercentage in [0, 0.5]
 */

const { spawnSync } = require("child_process");
const path = require("path");

// ==========================
// CONFIG
// ==========================
const REGION = process.env.GCF_REGION || "us-central1";
const FUNCTION_NAME = process.env.GCF_FUNCTION || "pmcEstimatorAPI";
const PROJECT_ID = process.env.GCP_PROJECT || getGcloudValue("project");

// OWNER account for IAM policy binding
const USER_ACCOUNT = "abeljstephen@gmail.com";

// Service Account used for runtime auth/invocation
const SA_EMAIL =
  process.env.GCP_SA_EMAIL || `icarenow@${PROJECT_ID}.iam.gserviceaccount.com`;
const SA_KEYFILE =
  process.env.GCP_SA_KEYFILE ||
  path.resolve(process.cwd(), "pmc-estimator-b50a03244199.json");

// GCF v1 URL (override with FUNCTION_URL if needed)
const FUNCTION_URL =
  process.env.FUNCTION_URL ||
  `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/${FUNCTION_NAME}`;

const HEADERS_BASE = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "X-Client": "saco-v1.9.8-runner",
};

// Single test case (only “PERT Test”)
const TEST = { name: "PERT Test", O: 1800, M: 2400, P: 3000 };

// Manual sliders (UI units). You can tweak these defaults as needed.
const MANUAL_SLIDERS_UI = {
  budgetFlexibility: 10,
  scheduleFlexibility: 10,
  scopeCertainty: 8,
  scopeReductionAllowance: 6,
  reworkPercentage: 3,   // UI domain 0..50
  riskTolerance: 7,
  userConfidence: 5
};

// ==========================
// FETCH (Node 18+ has global fetch; else lazy-import node-fetch)
// ==========================
let fetchFn = globalThis.fetch;
async function ensureFetch() {
  if (typeof fetchFn === "function") return;
  try {
    fetchFn = (await import("node-fetch")).default;
  } catch (e) {
    throw new Error(
      "No global fetch and failed to import node-fetch. Use Node 18+ or `npm i node-fetch@3`."
    );
  }
}

// ==========================
// SHELL HELPERS
// ==========================
function sh(cmd, opts = {}) {
  const res = spawnSync(cmd, {
    shell: true,
    stdio: "pipe",
    encoding: "utf8",
    ...opts,
  });
  if (res.status !== 0) {
    const msg = `Command failed (${cmd}):\nSTDOUT:\n${res.stdout}\nSTDERR:\n${res.stderr}`;
    throw new Error(msg);
  }
  return res.stdout.trim();
}

function getGcloudValue(key) {
  try {
    const out = sh(`gcloud config get-value ${key} --quiet`);
    return out.replace(/^\[.*\]\s*/g, "").trim();
  } catch {
    return "";
  }
}

function info(msg) { console.log(`ℹ️ INFO [${new Date().toISOString()}]: ${msg}`); }
function success(msg) { console.log(`✅ SUCCESS [${new Date().toISOString()}]: ${msg}`); }
function warn(msg) { console.log(`⚠️ WARN [${new Date().toISOString()}]: ${msg}`); }
function fail(msg) { console.error(`❌ ERROR [${new Date().toISOString()}]: ${msg}`); }

// ==========================
// GCLOUD WRAPPERS
// ==========================
function setProject(project) {
  info(`executing: gcloud config set project ${project}`);
  sh(`gcloud config set project ${project}`);
}
function setAccount(account) {
  info(`executing: gcloud config set account ${account}`);
  sh(`gcloud config set account ${account}`);
}
function addProjectRole(member, role) {
  info(`executing: gcloud projects add-iam-policy-binding ${PROJECT_ID} --member="${member}" --role="${role}"`);
  sh(`gcloud projects add-iam-policy-binding ${PROJECT_ID} --member="${member}" --role="${role}"`);
}
function removeProjectRole(member, role) {
  info(`executing: gcloud projects remove-iam-policy-binding ${PROJECT_ID} --member="${member}" --role="${role}"`);
  sh(`gcloud projects remove-iam-policy-binding ${PROJECT_ID} --member="${member}" --role="${role}"`);
}
function addFunctionInvoker(member) {
  info(`executing: gcloud functions add-iam-policy-binding ${FUNCTION_NAME} --region=${REGION} --member="${member}" --role="roles/cloudfunctions.invoker"`);
  sh(`gcloud functions add-iam-policy-binding ${FUNCTION_NAME} --region=${REGION} --member="${member}" --role="roles/cloudfunctions.invoker"`);
}
function activateServiceAccount(saEmail, keyFile) {
  info(`executing: gcloud auth activate-service-account ${saEmail} --key-file="${keyFile}" --project=${PROJECT_ID}`);
  sh(`gcloud auth activate-service-account ${saEmail} --key-file="${keyFile}" --project=${PROJECT_ID}`);
}
function mintIdToken(audience) {
  info(`executing: gcloud auth print-identity-token --audiences=${audience}`);
  const token = sh(`gcloud auth print-identity-token --audiences=${audience}`);
  return token.trim();
}

// ==========================
// PRINT HELPERS
// ==========================
function padRight(str, n) {
  const s = String(str);
  return s + " ".repeat(Math.max(0, n - s.length));
}

function printCompactTable(rows, cols) {
  const widths = cols.map((c) =>
    Math.max(c.length, ...rows.map((r) => String(r[c] ?? "").length))
  );
  const header =
    "┌" + widths.map((w) => "─".repeat(w + 2)).join("┬") + "┐\n" +
    "│ " + cols.map((c, i) => padRight(c, widths[i])).join(" │ ") + " │\n" +
    "├" + widths.map((w) => "─".repeat(w + 2)).join("┼") + "┤";
  console.log(header);
  for (const r of rows) {
    console.log("│ " + cols.map((c, i) => padRight(String(r[c] ?? ""), widths[i])).join(" │ ") + " │");
  }
  console.log("└" + widths.map((w) => "─".repeat(w + 2)).join("┴") + "┘");
}

function printErrorTable(stage, label, httpStatus, json) {
  const rows = [
    { Stage: stage, Scenario: label, Field: "HTTP Status", Value: httpStatus },
    { Stage: stage, Scenario: label, Field: "Error", Value: (json && json.error) || "Unknown error" },
  ];
  printCompactTable(rows, ["Stage", "Scenario", "Field", "Value"]);
}

function printSliderLegendOnce() {
  if (printSliderLegendOnce._done) return;
  printSliderLegendOnce._done = true;
  console.log("\nℹ️ Slider field meanings:");
  console.log("  • optimize.sliders       → UI units (back-compat). 0–100; reworkPercentage 0–50.");
  console.log("  • optimize.scaledSliders → UI units (canonical mirror). Same domains as above.");
  console.log("  • optimize.sliders01     → Normalized [0–1] (reworkPercentage in [0,0.5]).\n");
}

// ==========================
// REQUEST HELPERS
// ==========================
async function callAPI_raw(idToken, body) {
  await ensureFetch();
  const headers = { ...HEADERS_BASE, Authorization: `Bearer ${idToken}` };
  const t0 = Date.now();
  const res = await fetchFn(FUNCTION_URL, { method: "POST", headers, body: JSON.stringify(body) });
  const latencyMs = Date.now() - t0;
  const httpStatus = res.status;
  let json;
  try { json = await res.json(); } catch { json = { error: `Non-JSON response (HTTP ${res.status})` }; }
  return { json, latencyMs, httpStatus };
}

function unwrapResults(json) {
  // API returns { results:[...] } or sometimes array; normalize to array of results
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.results)) return json.results;
  if (Array.isArray(json.tasks)) return json.tasks; // just in case
  return [json];
}

// ==========================
// MAIN FLOW
// ==========================
(async () => {
  try {
    info(`Detected project: ${PROJECT_ID}`);
    setProject(PROJECT_ID);

    // ---------- OWNER context for IAM binding ----------
    info(`Switching to OWNER account: ${USER_ACCOUNT}`);
    setAccount(USER_ACCOUNT);
    setProject(PROJECT_ID);
    success("Now operating as OWNER — IAM bindings allowed.");

    // Grant SA invoker + deploy-time project roles
    addFunctionInvoker(`serviceAccount:${SA_EMAIL}`);
    addProjectRole(`serviceAccount:${SA_EMAIL}`, "roles/cloudfunctions.developer");
    addProjectRole(`serviceAccount:${SA_EMAIL}`, "roles/cloudbuild.builds.editor");
    addProjectRole(`serviceAccount:${SA_EMAIL}`, "roles/iam.serviceAccountTokenCreator");
    success("Deploy-time roles granted to Service Account.");

    // ---------- Switch to Service Account for calls ----------
    activateServiceAccount(SA_EMAIL, SA_KEYFILE);
    setAccount(SA_EMAIL);
    setProject(PROJECT_ID);
    success("Switched to Service Account for authenticated tests.");

    console.log("\n========== TEST: PERT-Derived Target ==========");
    info(`Function URL: ${FUNCTION_URL}`);
    info("Minting ID token as Service Account");
    const idToken = mintIdToken(FUNCTION_URL);

    // 1) Baseline call (no target) to fetch PERT from API
    info("Requesting baseline (no target) to obtain PERT mean from API...");
    const baselinePayload = { tasks: [{
      task: "baseline-no-target",
      optimistic: TEST.O,
      mostLikely: TEST.M,
      pessimistic: TEST.P,
      optimize: false,
      adaptive: false
    }]};

    const { json: jsonPert, httpStatus: httpPert } = await callAPI_raw(idToken, baselinePayload);
    if (httpPert >= 400 || (jsonPert && jsonPert.error)) {
      printErrorTable("PERT fetch", "baseline-no-target", httpPert, jsonPert);
      throw new Error("Unable to fetch PERT from API.");
    }

    const baselineResults = unwrapResults(jsonPert);
    const pertFromApi = Number(baselineResults?.[0]?.baseline?.pert?.value ?? NaN);
    if (!Number.isFinite(pertFromApi)) {
      throw new Error("PERT mean not found in baseline response.");
    }

    const targetValue = Number((pertFromApi * 1.15).toFixed(6));

    // Print Table A — Inputs & Derived
    const tableA = [
      { Metric: "Optimistic (O)", Value: TEST.O, How: "input" },
      { Metric: "Most Likely (M)", Value: TEST.M, How: "input" },
      { Metric: "Pessimistic (P)", Value: TEST.P, How: "input" },
      { Metric: "PERT mean", Value: pertFromApi, How: "API (baseline.pert.value)" },
      { Metric: "Target", Value: targetValue, How: "PERT × 1.15" },
    ];
    console.log("\n# Table A — Inputs & Derived Target");
    printCompactTable(tableA, ["Metric", "Value", "How"]);

    printSliderLegendOnce();

    // 2) Build 5-scenario batch with this target
    const tasks = [
      {
        task: "baseline-no-target",
        optimistic: TEST.O, mostLikely: TEST.M, pessimistic: TEST.P,
        optimize: false, adaptive: false
      },
      {
        task: "baseline-with-target",
        optimistic: TEST.O, mostLikely: TEST.M, pessimistic: TEST.P,
        targetValue, optimize: false, adaptive: false
      },
      {
        task: "manual-sliders",
        optimistic: TEST.O, mostLikely: TEST.M, pessimistic: TEST.P,
        targetValue, optimize: true, adaptive: false, probeLevel: 0,
        sliderValues: { ...MANUAL_SLIDERS_UI }
      },
      {
        task: "saco-probe3",
        optimistic: TEST.O, mostLikely: TEST.M, pessimistic: TEST.P,
        targetValue, optimize: true, adaptive: true, probeLevel: 3
      },
      {
        task: "saco-probe7",
        optimistic: TEST.O, mostLikely: TEST.M, pessimistic: TEST.P,
        targetValue, optimize: true, adaptive: true, probeLevel: 7
      }
    ];

    // 3) Single batched call
    info("Sending ONE batched request with 5 scenarios...");
    const { json: jsonBatch, httpStatus: httpBatch } = await callAPI_raw(idToken, { tasks });
    if (httpBatch >= 400 || (jsonBatch && jsonBatch.error)) {
      printErrorTable("Batch", "5-scenarios", httpBatch, jsonBatch);
      throw new Error("Batched request failed.");
    }
    const results = unwrapResults(jsonBatch);

    // Helper to pick a result by task name
    const R = {};
    for (const r of results) {
      const name = r?.taskEcho?.task || r?.task || "unknown";
      R[name] = r;
    }

    // Extract baseline p(target) for lift comparison (from baseline-with-target)
    const p0 = Number(R["baseline-with-target"]?.baseline?.probabilityAtTarget?.value ?? 0);

    // Table B — Scenario Comparison
    const scenRows = [];
    const addRow = (label, key, probeNote) => {
      const row = { Scenario: label, Probe: probeNote || "—", Status: "ok",
        "P(target)": "—", "Lift vs Baseline (pts)": "—", "KL vs Baseline": "—", "StdDev Δ%": "—", Notes: "" };

      const r = R[key];
      if (!r) { row.Status = "missing"; scenRows.push(row); return; }

      // baseline p(target)
      const baseP = Number(r?.baseline?.probabilityAtTarget?.value);
      // optimized p(target)
      const optP = Number(r?.optimize?.probabilityAtTarget?.value);

      if (Number.isFinite(baseP)) row["P(target)"] = baseP.toFixed(6);
      if (Number.isFinite(optP))  row["P(target)"] = optP.toFixed(6);

      // Lift vs baseline-with-target (p0)
      const pShown = Number.isFinite(optP) ? optP : (Number.isFinite(baseP) ? baseP : NaN);
      if (Number.isFinite(pShown) && Number.isFinite(p0)) {
        row["Lift vs Baseline (pts)"] = (pShown - p0).toFixed(6);
      }

      // KL + StdDevΔ from optimize.explain
      const kl = Number(r?.optimize?.explain?.klDivergence);
      if (Number.isFinite(kl)) row["KL vs Baseline"] = kl.toFixed(6);

      const dstd = Number(r?.optimize?.explain?.stdDevChange);
      if (Number.isFinite(dstd)) row["StdDev Δ%"] = (dstd * 100).toFixed(3) + "%";

      row.Status = r?.optimize?.status || r?.baseline?.status || "ok";
      scenRows.push(row);
    };

    addRow("Baseline (no target)", "baseline-no-target", "—");
    addRow("Baseline (with target)", "baseline-with-target", "—");
    addRow("Manual sliders (probe=0)", "manual-sliders", "0");
    addRow("SACO adaptive (probe=3)", "saco-probe3", "3");
    addRow("SACO adaptive (probe=7)", "saco-probe7", "7");

    console.log("\n# Table B — Scenario Comparison");
    printCompactTable(
      scenRows,
      ["Scenario", "P(target)", "Lift vs Baseline (pts)", "KL vs Baseline", "StdDev Δ%", "Probe", "Status", "Notes"]
    );

    // Table C — Slider Settings (for rows that have sliders)
    const sliderRows = [];
    const pushSliderBlock = (label, r) => {
      const sUI = r?.optimize?.sliders || {};
      const sScaled = r?.optimize?.scaledSliders || {};
      const s01 = r?.optimize?.sliders01 || {};

      const emit = (view, obj) => {
        const entries = Object.entries(obj);
        if (!entries.length) {
          sliderRows.push({ Scenario: label, View: view, Field: "—", Value: "—", Domain: "—", Note: "No sliders returned" });
          return;
        }
        for (const [k, v] of entries) {
          let fmtV = v;
          if (view.includes('01')) {
            fmtV = Number.isFinite(Number(v)) ? Number(v).toFixed(2) : v;  // Normalized: 0.58
          } else if (Number.isFinite(Number(v))) {
            const pctV = Number(v).toFixed(2);
            fmtV = (Number(v) % 1 === 0) ? Number(v).toString() : `${pctV}%`;  // UI: 10 or 57.86%
          }
          sliderRows.push({
            Scenario: label,
            View: view,
            Field: k,
            Value: fmtV,
            Domain: k === "reworkPercentage" ? (view.includes("01") ? "[0, 0.5]" : "0–50") : (view.includes("01") ? "[0, 1]" : "0–100"),
            Note: view.includes("01") ? "Normalized" : (view.includes("scaled") ? "UI (canonical mirror)" : "UI (back-compat)")
          });
        }
      };

      emit("sliders (UI/back-compat)", sUI);
      emit("scaledSliders (UI/canonical)", sScaled);
      emit("sliders01 (normalized)", s01);
    };

    pushSliderBlock("Manual sliders (probe=0)", R["manual-sliders"] || {});
    pushSliderBlock("SACO adaptive (probe=3)", R["saco-probe3"] || {});
    pushSliderBlock("SACO adaptive (probe=7)", R["saco-probe7"] || {});

    console.log("\n# Table C — Slider Settings (three views)");
    printCompactTable(sliderRows, ["Scenario", "View", "Field", "Value", "Domain", "Note"]);

    // Done
    success("PERT-derived target batch complete.");

    // ---------- CLEANUP ----------
    console.log("\n========== CLEANUP (revoke deploy-time roles; keep function invoker on SA) ==========");
    setAccount(USER_ACCOUNT);
    setProject(PROJECT_ID);
    success("Account returned to OWNER.");

    removeProjectRole(`serviceAccount:${SA_EMAIL}`, "roles/cloudfunctions.developer");
    removeProjectRole(`serviceAccount:${SA_EMAIL}`, "roles/cloudbuild.builds.editor");
    removeProjectRole(`serviceAccount:${SA_EMAIL}`, "roles/iam.serviceAccountTokenCreator");
    success("Cleanup complete: project-level deploy roles removed. Function invoker on SA is preserved.");

    // Negative test: unauthenticated POST should be blocked (401/403)
    const neg = await unauthenticatedProbe();
    if (neg.httpStatus === 401 || neg.httpStatus === 403) {
      success(`Negative test passed (HTTP ${neg.httpStatus}). Unauthenticated request is blocked.`);
    } else {
      warn(`Negative test did not return 401/403 (HTTP ${neg.httpStatus}). If the function is public, this may be expected.`);
    }
  } catch (e) {
    fail(e?.message || String(e));
    process.exitCode = 1;
  }
})();

// ==========================
// UNAUTHENTICATED PROBE
// ==========================
async function unauthenticatedProbe() {
  await ensureFetch();
  let httpStatus = 0;
  let json;
  try {
    const res = await fetchFn(FUNCTION_URL, {
      method: "POST",
      headers: HEADERS_BASE, // No Authorization on purpose
      body: JSON.stringify({ tasks: [{ ping: true }] }),
    });
    httpStatus = res.status;
    try { json = await res.json(); } catch { json = { error: "Non-JSON response" }; }
  } catch (e) {
    json = { error: String(e?.message || e) };
  }
  return { httpStatus, json };
}
