# PMC Estimator — Deploy Tracker

> Last checked: 2026-03-28 (manually updated)

## Apps Script Limits

| Resource     | Used | Limit | % Used | Status |
|-------------|------|-------|--------|--------|
| Deployments | 3    | 20     | 15%     | OK      |
| Versions    | 68   | 100    | 68%     | OK      |

## Rules
- `clasp push` → updates HEAD only. **No slots consumed. Push freely.**
- `clasp deploy` → consumes 1 deployment slot. Use sparingly (major releases only).
- `clasp version` → consumes 1 version slot. Use for milestone snapshots only.

## Current Deployments
```
Found 3 deployments.
- AKfycbzoO42SACRrzX8N1nnLPTqth4MX4Rgpsce0TIciCWE @HEAD
- AKfycbwu2VJv9zMJz3GSb7ijyLqrQzvwweJjS9hP6EFAB9Aao4MNo4vl2zgEil-GcBNACQxp @68 - PMC Estimator API v1.9.38 — slim-only session payload, fix multi-task plot URL  ← PRODUCTION API
- AKfycbxPMikpb1W7qHCYwuIfx1696rU-rsnZka_SRhdSL6x8r8EnhRVbwQ1Kofdjm8jIFcaL @51 - PMC Estimator Addon v3.2 — Report tabs, pipeline view, slider fixes  ← ADDON
```

## Deploy Commands (authoritative)
```bash
# API (production):
clasp deploy --deploymentId AKfycbwu2VJv9zMJz3GSb7ijyLqrQzvwweJjS9hP6EFAB9Aao4MNo4vl2zgEil-GcBNACQxp \
  --description "PMC Estimator API vX.Y.Z — <summary>"
# Note: description MUST start with "PMC Estimator API"

# Addon:
clasp deploy --deploymentId AKfycbxPMikpb1W7qHCYwuIfx1696rU-rsnZka_SRhdSL6x8r8EnhRVbwQ1Kofdjm8jIFcaL \
  --description "PMC Estimator Addon vX.Y — <summary>"
```

## Recent Versions (last 5)
```
64 - (archived)
65 - (archived)
67 - (archived)
68 - PMC Estimator API v1.9.38 — slim-only session payload, fix multi-task plot URL
```

## Tasks for This Agent
<!-- Add new monitoring tasks below -->
- [x] Track deployment and version slot usage
- [ ] Check for unpushed git changes before deploy reminders
- [ ] Remind to tag git releases when a formal clasp version is cut
- [ ] Alert if more than 1 week passes without a git commit

## History (last 10 checks)
<!-- Updated automatically by check-limits.sh -->
- 2026-03-28 — Deployments: 3/20  Versions: 68/100  [OK / OK]  (manual update — tracker was stale at v51)
- 2026-03-09 15:45 — Deployments: 3/20  Versions: 51/100  [OK / OK]
