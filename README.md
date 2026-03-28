# ProjectCare by iCareNOW

Probability-based project cost & schedule estimation powered by **SACO** (Shape-Adaptive Copula Optimization).

## Architecture — Three-Tier Universal API

```
WordPress (icarenow.io)       Google Apps Script             GitHub Pages
──────────────────────────    ──────────────────────         ──────────────────────────
Admin, billing, user mgmt →   projectcareAPI()          →   plot/, report/
Stripe, CRM, REST API         SACO + CPM engines             Static UI
projectcare/v1 namespace      X-Projectcare-Secret auth      abeljstephen.github.io
```

## Engines

| Engine | Runtime | Consumers |
|--------|---------|-----------|
| `saco-gas/` | Google Apps Script | GPT, CRM, Sheets addon |
| `cpm-gas/` | Google Apps Script | GPT, CRM (when tasks have predecessors) |
| `saco-browser/` | Browser (JS) | WordPress plugin (self-contained, offline) |
| `cpm-browser/` | Browser (JS) | Future |

## Products

| Product | Surface | Engine | Features |
|---------|---------|--------|----------|
| **ProjectCare Free** | Google Sheets addon | saco-gas | SACO only |
| **ProjectCare Free** | WordPress `[projectcare]` | saco-browser | SACO only, offline |
| **ProjectCare Full** | GPT + API | saco-gas + cpm-gas | SACO + CPM + plots + reports |

## Repository Structure

```
projectcare/
├── api/                    GAS web app entry + addon
│   ├── webapp.gs           doPost → projectcareAPI()
│   ├── addon/              Google Sheets addon (ProjectCare Free)
│   └── core/
│       ├── saco-gas/       SACO engine (Google server-side)
│       └── cpm-gas/        CPM engine (Google server-side)
├── engines/
│   ├── saco-browser/       SACO engine (browser — mirrors saco-gas)
│   └── cpm-browser/        CPM engine (browser — mirrors cpm-gas)
├── plot/                   GitHub Pages — interactive chart
├── report/                 GitHub Pages — static report
├── integrations/
│   ├── wordpress/
│   │   ├── projectcare/    WP plugin (ProjectCare Free, shortcode [projectcare])
│   │   └── pmc-crm/        CRM + Stripe + REST API (projectcare/v1)
│   └── gpt/                OpenAI GPT instructions + OpenAPI spec
├── agents/                 Dev tooling (monitor, QA, math, research)
├── custom-gpt/             GPT knowledge docs
├── patent/                 SACO + CPM invention disclosures
└── docs/                   Research, architecture, validation
```

## GAS Deployments

| Deployment | Description |
|-----------|-------------|
| Web App `AKfycbwu...` | ProjectCare API — serves GPT + CRM |
| Addon `AKfycbxP...` | ProjectCare Free — Google Sheets |

## Author

[iCareNOW](https://icarenow.io)
