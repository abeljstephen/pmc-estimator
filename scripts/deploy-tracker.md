# PMC Estimator — Deploy Tracker

> Last checked: 2026-03-09 15:45

## Apps Script Limits

| Resource     | Used | Limit | % Used | Status |
|-------------|------|-------|--------|--------|
| Deployments | 3    | 20     | 15%     | OK      |
| Versions    | 51    | 100     | 51%     | OK      |

## Rules
- `clasp push` → updates HEAD only. **No slots consumed. Push freely.**
- `clasp deploy` → consumes 1 deployment slot. Use sparingly (major releases only).
- `clasp version` → consumes 1 version slot. Use for milestone snapshots only.

## Current Deployments
```
Found 3 deployments.
- AKfycbzoO42SACRrzX8N1nnLPTqth4MX4Rgpsce0TIciCWE @HEAD 
- AKfycbxPMikpb1W7qHCYwuIfx1696rU-rsnZka_SRhdSL6x8r8EnhRVbwQ1Kofdjm8jIFcaL @51 - v3.2 — Report tabs, pipeline view, slider fixes
- AKfycby4Rmzz_zcayR9A54pSIcjiZxDifIRx70nbndZgSq3AUa6wykzceQv_HDV6LUSm_Fto @25 - PMC Estimator Web APP V25
```

## Recent Versions (last 5)
```
47 - PMC Estimator (cloud) Web App v3.0
48 - PMC Estimator (cloud) Web App v3.1
49 - No description
50 - v2 — Report tabs, pipeline view, slider fixes, title cleanup
51 - v3.2 — Report tabs, pipeline view, slider fixes
```

## Tasks for This Agent
<!-- Add new monitoring tasks below -->
- [x] Track deployment and version slot usage
- [ ] Check for unpushed git changes before deploy reminders
- [ ] Remind to tag git releases when a formal clasp version is cut
- [ ] Alert if more than 1 week passes without a git commit

## History (last 10 checks)
<!-- Updated automatically by check-limits.sh -->
- 2026-03-09 15:45 — Deployments: 3/20  Versions: 51/100  [OK / OK]
