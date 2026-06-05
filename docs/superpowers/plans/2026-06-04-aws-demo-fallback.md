# AWS Demo Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Keep ReceiptPulse positioned as an AWS serverless showcase while making the frontend usable when the original AWS account is restricted.

**Architecture:** Add an explicit demo-live mode that stores a browser-only demo session, loads sample receipt data, and locally simulates upload/rename/delete actions. Preserve the existing Cognito/API Gateway path so a new AWS account can be connected by updating `dashboard/config.js`.

**Tech Stack:** Vanilla JavaScript, static HTML/CSS, browser storage, existing AWS SAM template and dashboard assets.

---

### Task 1: Demo Auth Entry

**Files:**
- Modify: `dashboard/config.js`
- Modify: `dashboard/auth.js`
- Modify: `dashboard/index.html`
- Modify: `dashboard/styles.css`

- [x] Add a `demo` config object with `enabled`, `sampleDataPath`, and demo user metadata.
- [x] Add browser-only demo token helpers in `dashboard/auth.js`.
- [x] Add a "View Cloud Demo" call-to-action on the sign-in page.
- [x] Style the demo access card so it looks intentional and explains AWS is preserved.

### Task 2: Dashboard Demo Runtime

**Files:**
- Modify: `dashboard/app.js`
- Modify: `dashboard/app.html`

- [x] Detect demo sessions separately from real Cognito sessions.
- [x] Load `dashboard/data/demo-dashboard.json` when demo mode is active or the live API is unavailable.
- [x] Simulate uploads locally with generated receipt records while preserving the S3/Lambda/Textract timeline language.
- [x] Make rename/delete/date-clear actions mutate local demo data instead of calling AWS.
- [x] Add visible badges and copy that distinguish AWS Live from Cloud Demo mode.

### Task 3: Migration Documentation

**Files:**
- Modify: `README.md`
- Add: `docs/aws-account-redeploy.md`

- [x] Document the old-account risk and the safe new-account redeploy path.
- [x] Document that old bills/data are not bypassed by a new account.
- [x] List cost-control steps before redeploying.

### Task 4: Verification

**Files:**
- Verify changed JS/HTML/CSS.

- [x] Run `node --check` on changed JavaScript files.
- [x] Run a local static server.
- [x] Verify sign-in page renders demo access.
- [x] Verify demo sign-in opens the dashboard.
- [x] Verify upload simulation changes dashboard state without AWS.
- [x] Verify there are no relevant console errors.
