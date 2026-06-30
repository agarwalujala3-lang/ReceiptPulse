<div align="center">
  <img src="dashboard/receiptpulse-logo-light.svg" alt="ReceiptPulse logo" width="300" />

  # ReceiptPulse

  <strong>Demo-first AWS receipt intelligence for upload, OCR extraction, duplicate review, and spend analytics.</strong>

  <p>
    <a href="https://receiptpulse-cloud-demo.onrender.com/"><strong>Open Live Demo</strong></a>
    &nbsp;|&nbsp;
    <a href="https://github.com/agarwalujala3-lang/ReceiptPulse"><strong>Source Code</strong></a>
    &nbsp;|&nbsp;
    <a href="#deploy-on-render"><strong>Deploy on Render</strong></a>
  </p>

  <img src="https://img.shields.io/badge/status-demo--first%20launch-12c7a8?style=for-the-badge" alt="Demo first launch" />
  <img src="https://img.shields.io/badge/frontend-HTML%20CSS%20JavaScript-10263a?style=for-the-badge" alt="HTML CSS JavaScript" />
  <img src="https://img.shields.io/badge/cloud-AWS%20serverless-ffb347?style=for-the-badge" alt="AWS serverless" />
  <img src="https://img.shields.io/badge/deploy-Render%20Blueprint-46e3ff?style=for-the-badge" alt="Render Blueprint" />
  <img src="https://img.shields.io/badge/security-no%20static%20secrets-16d6a5?style=for-the-badge" alt="No static secrets" />
</div>

<br />

<p align="center">
  <img src="branding/receiptpulse-ai-hero.png" alt="AI generated ReceiptPulse hero artwork showing a 3D receipt OCR and analytics pipeline" width="100%" />
</p>

## Executive Snapshot

ReceiptPulse is a recruiter-ready cloud portfolio project that presents a complete receipt-processing product flow: users can enter a safe public demo, review sample uploads, inspect OCR-style extraction, handle duplicates, search receipt history, and explore analytics dashboards without exposing real credentials or cloud secrets.

The public build is intentionally **demo-first**. That keeps the project accessible while the AWS Live path remains documented and reconnectable through configuration for Cognito, API Gateway, Lambda, S3, DynamoDB, and Textract.

## Why It Stands Out

| Signal | What reviewers see |
| --- | --- |
| Product thinking | A full journey from launch page to dashboard, reports, profile, receipt history, and analytics. |
| Cloud architecture | Clear AWS serverless path with API, OCR, storage, metadata, and auth responsibilities separated. |
| Demo safety | Public users can explore without passwords, billing risk, or private receipt data. |
| Frontend polish | High-contrast visual system, 3D entry motion, dashboard cards, readable charts, and responsive pages. |
| Recruiter clarity | The README and UI explain what is live, what is simulated, and how the production path connects. |
| Deployment maturity | Netlify live demo plus Render Blueprint configuration with security headers and route rewrites. |

<p align="center">
  <img src="docs/readme-system-graph.svg" alt="ReceiptPulse demo-first cloud pipeline diagram" width="100%" />
</p>

## Public Demo Vs AWS Live

| Mode | Purpose | Current behavior |
| --- | --- | --- |
| Cloud Demo | Recruiter-safe public preview | Runs in the browser with local/sample data and no real credentials. |
| AWS Live | Real backend architecture path | Connects when `dashboard/config.js` contains working Cognito/API configuration. |
| Render Deploy | Alternative public hosting path | `render.yaml` is included for static hosting, headers, and clean routes. |
| Netlify Deploy | Current live demo host | Publishes the `dashboard/` folder as the canonical public demo. |

## Product Journey

```mermaid
flowchart LR
  A[Visitor opens live demo] --> B[3D branded launch]
  B --> C[Cloud Demo mode]
  C --> D[Receipt upload or sample run]
  D --> E[OCR extraction preview]
  E --> F[Duplicate decision]
  F --> G[Private dashboard view]
  G --> H[Search, filters, charts, reports]

  B --> I[AWS Live setup]
  I --> J[Cognito auth when configured]
  J --> K[API Gateway]
  K --> L[Lambda processing]
  L --> M[S3, Textract, DynamoDB]
```

## Architecture

```mermaid
flowchart TB
  UI[Static frontend: dashboard pages] --> Demo[Browser-local Cloud Demo]
  UI --> Auth[Cognito auth config]
  UI --> API[API Gateway]

  API --> Upload[Lambda upload handler]
  API --> Query[Lambda query handler]
  API --> Delete[Lambda delete handler]

  Upload --> S3[S3 receipt storage]
  Upload --> Textract[Amazon Textract OCR]
  Upload --> Dynamo[DynamoDB metadata]
  Query --> Dynamo
  Delete --> Dynamo
  Delete --> S3

  Dynamo --> Analytics[Dashboard analytics]
  Demo --> Analytics
```

## Capability Graph

```mermaid
pie title Capability focus - design map, not usage metrics
  "Demo UX and auth safety" : 30
  "Receipt OCR workflow" : 25
  "Dashboard analytics" : 20
  "AWS architecture" : 15
  "Docs and deployment" : 10
```

## Feature Matrix

| Feature | Demo mode | AWS Live path |
| --- | --- | --- |
| Safe public launch | Yes | Yes |
| Receipt/bill upload UI | Yes | Yes |
| OCR-style extracted fields | Yes, sample/local | Yes, via Textract path |
| Vendor, amount, date, labels | Yes | Yes |
| Duplicate receipt decision | Yes | Yes |
| Search and filters | Yes | Yes |
| Category charts and reports | Yes | Yes |
| Per-user workspace | Demo identity | Cognito-backed identity |
| Storage and metadata | Browser-local sample data | S3 and DynamoDB |
| API processing | Simulated/local fallback | API Gateway and Lambda |

## Visual System

| Layer | Direction |
| --- | --- |
| Brand mood | Deep navy, graphite, cyan, teal, and warm amber for a cloud-console feel. |
| Entry pages | 3D receipt visuals, staged launch motion, clear demo-first messaging, and high-contrast controls. |
| Dashboard | Command-center layout with spending cards, receipt history, charts, reports, and review states. |
| Accessibility | Stronger contrast, reduced-motion support, responsive stacking, and readable form states. |
| Trust | Mode labels show whether the user is in Cloud Demo or AWS Live setup. |

<p align="center">
  <img src="dashboard/social-preview.png" alt="ReceiptPulse social preview dashboard screenshot" width="86%" />
</p>

## Security And Demo Safety

| Control | Why it matters |
| --- | --- |
| Demo-first public flow | Recruiters can test the app without creating credentials. |
| No static AWS secrets | The frontend does not store private AWS keys. |
| Config-driven live mode | Real auth/API only appear when backend settings exist. |
| Local sample data | Public demos avoid private receipts, phone numbers, addresses, or billing data. |
| Strict static headers | Render Blueprint includes frame, content type, referrer, permissions, and CSP protections. |
| Clear AWS boundary | The README separates the public demo from the production AWS deployment path. |

## Repository Map

```text
dashboard/
  index.html                 Public demo/auth launch page
  signup.html                AWS Live setup entry
  app.html                   Main dashboard shell
  profile.html               Profile workspace page
  reports.html               Reports and analytics page
  app.js                     Receipt state, demo data, analytics, duplicate flow
  auth.js                    Auth and demo-mode state handling
  auth-3d.js                 Auth page 3D visuals
  entry-3d.js                Launch page 3D motion layer
  brand-launch.js            Entry experience interactions
  multipage.js               Shared page navigation behavior
  styles.css                 Main visual system
  config.js                  Runtime API/auth configuration
  data/demo-dashboard.json   Safe demo dataset

docs/
  deployment.md              Deployment notes
  aws-account-redeploy.md    AWS recovery and redeploy plan
  readme-system-graph.svg    README system visual

branding/
  receiptpulse-ai-hero.png   AI-generated README hero artwork
  portfolio-brand-mark.svg   Brand mark

render.yaml                  Render Static Site Blueprint
template.yaml                AWS SAM/serverless infrastructure template
netlify.toml                 Current Netlify static deployment config
```

## Run Locally

This project can run as a static frontend without installing Node dependencies.

```bash
cd dashboard
python -m http.server 4173
```

Open:

```text
http://localhost:4173/
```

Then choose **Cloud Demo** to explore the dashboard safely.

## Configure AWS Live Mode

`dashboard/config.js` controls whether the frontend connects to a live backend.

```js
window.RECEIPTPULSE_CONFIG = {
  apiBaseUrl: "https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com",
  demo: {
    enabled: true,
    autoFallback: true
  },
  auth: {
    hostedUiDomain: "YOUR_COGNITO_DOMAIN",
    clientId: "YOUR_COGNITO_CLIENT_ID",
    region: "ap-south-1",
    appPath: "./app.html"
  }
};
```

Keep secrets out of this file. Static frontend config can contain public endpoints and public Cognito client identifiers, not private keys.

## Deploy On Render

This repo already includes a Render Blueprint. Use **Blueprint** so headers and rewrites are applied automatically.

[Open Render Blueprint Deploy](https://dashboard.render.com/blueprint/new?repo=https://github.com/agarwalujala3-lang/ReceiptPulse)

Expected Render settings from `render.yaml`:

| Setting | Value |
| --- | --- |
| Service type | Static web service |
| Runtime | `static` |
| Branch | `main` |
| Build command | `echo "Publishing ReceiptPulse dashboard static assets"` |
| Publish path | `./dashboard` |
| Auto deploy | Enabled |
| Clean routes | `/app`, `/signup`, `/profile`, `/reports` |
| Headers | Security and cache headers included |

## Verification Checklist

Before sharing the project publicly, verify:

| Check | Expected result |
| --- | --- |
| Open `/` | Launch page appears with clear Cloud Demo messaging. |
| Click Cloud Demo | Dashboard opens without asking for real credentials. |
| Open `/app` | Render/Netlify rewrite serves `app.html`. |
| Open `/signup` | AWS Live setup page stays demo-safe and readable. |
| Upload/sample action | Demo data renders without backend errors. |
| Mobile viewport | Cards stack cleanly with no horizontal overflow. |
| Browser console | No missing asset or blocked script errors. |

## AI-Friendly Project Context

```yaml
project: ReceiptPulse
category: cloud portfolio and receipt intelligence demo
current_public_mode: browser-local Cloud Demo
aws_live_path: config-driven Cognito + API Gateway + Lambda + S3 + DynamoDB + Textract
frontend: HTML, CSS, JavaScript
hosting:
  current_demo: Netlify static site
  render_ready: render.yaml Blueprint included
security_posture:
  - no static AWS secrets
  - demo-first public access
  - local sample data for public reviewers
  - security headers for static deployment
reviewer_value:
  - product-style flow
  - cloud architecture clarity
  - OCR workflow storytelling
  - dashboard analytics
  - deployment resilience
```

## Recruiter Pitch

ReceiptPulse shows more than a static portfolio page. It demonstrates how a cloud product is designed, explained, deployed, and made safe for public review: a polished frontend, a demo-first auth strategy, OCR workflow storytelling, analytics screens, Render/Netlify deployment readiness, and a documented AWS serverless path for production rebuilds.
