# ProjectCare — Deploy Tracker

> Last checked: 2026-03-29 (manually updated)

## Apps Script Limits

| Resource     | Used | Limit | % Used | Status |
|-------------|------|-------|--------|--------|
| Deployments | 3    | 20     | 15%     | OK      |
| Versions    | 81   | 100    | 81%     | WATCH   |

## Rules
- `clasp push` → updates HEAD only. **No slots consumed. Push freely.**
- `clasp deploy` → consumes 1 deployment slot. Use sparingly (major releases only).
- `clasp version` → consumes 1 version slot. Use for milestone snapshots only.

## Current Deployments
```
Found 3 deployments.
- AKfycbzoO42SACRrzX8N1nnLPTqth4MX4Rgpsce0TIciCWE @HEAD
- AKfycbwu2VJv9zMJz3GSb7ijyLqrQzvwweJjS9hP6EFAB9Aao4MNo4vl2zgEil-GcBNACQxp @81 - ProjectCare API v1.1.0 — slim/full GAS tier  ← PRODUCTION API
- AKfycbxPMikpb1W7qHCYwuIfx1696rU-rsnZka_SRhdSL6x8r8EnhRVbwQ1Kofdjm8jIFcaL @77 - ProjectCare Free v1.0.0 — unified brand launch  ← ADDON
```

## Deploy Commands (authoritative)
```bash
# API (production):
clasp deploy --deploymentId AKfycbwu2VJv9zMJz3GSb7ijyLqrQzvwweJjS9hP6EFAB9Aao4MNo4vl2zgEil-GcBNACQxp \
  --description "ProjectCare API vX.Y.Z — <summary>"

# Addon:
clasp deploy --deploymentId AKfycbxPMikpb1W7qHCYwuIfx1696rU-rsnZka_SRhdSL6x8r8EnhRVbwQ1Kofdjm8jIFcaL \
  --description "ProjectCare Free vX.Y — <summary>"
```

## Recent Versions (last 5)
```
68 - ProjectCare API v1.9.38 — slim-only session payload, fix multi-task plot URL
75 - (version snapshot pre-deploy)
76 - (API deploy version)
77 - (Addon deploy version)
81 - ProjectCare API v1.1.0 — slim/full GAS tier per plan
```

## Tasks for This Agent
<!-- Add new monitoring tasks below -->
- [x] Track deployment and version slot usage
- [ ] Check for unpushed git changes before deploy reminders
- [ ] Remind to tag git releases when a formal clasp version is cut
- [ ] Alert if more than 1 week passes without a git commit

## History (last 10 checks)
<!-- Updated automatically by check-limits.sh -->
- 2026-03-29 — Deployments: 3/20  Versions: 81/100  [OK / WATCH]  API v1.1.0 slim/full tier — API @81, Addon @77
- 2026-03-28 — Deployments: 3/20  Versions: 77/100  [OK / WATCH]  ProjectCare v1.0.0 launch — API @76, Addon @77
- 2026-03-09 15:45 — Deployments: 3/20  Versions: 51/100  [OK / OK]
