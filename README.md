<p align="center">
  <img src="dashboard/receiptpulse-logo.svg" alt="ReceiptPulse" width="420" />
</p>

<p align="center">
  Serverless AWS receipt workspace with private uploads, Textract extraction, duplicate review, and a live dashboard that feels product-grade.
</p>

<p align="center">
  <a href="https://d2ijsg7huf2h2p.cloudfront.net/app.html?v=20260331">Live App</a>
  |
  <a href="https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/health">API Health</a>
  |
  <a href="dashboard/receiptpulse-github-preview.svg?v=20260408a">Brand Preview</a>
</p>

<p align="center">
  <img src="dashboard/receiptpulse-github-preview.svg?v=20260408a" alt="ReceiptPulse preview showing the AWS receipt-processing workflow and live dashboard proof." width="100%" />
</p>

# ReceiptPulse

ReceiptPulse is a serverless AWS portfolio project for private receipt processing. Each signed-in user gets their own workspace to upload receipt files, extract structured fields with Textract, review duplicate decisions, rename labels after upload, and manage the results in a live dashboard.

## Live Demo

- Frontend: [https://d2ijsg7huf2h2p.cloudfront.net/](https://d2ijsg7huf2h2p.cloudfront.net/app.html?v=20260331)
- API root: [https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/](https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/)
- Health check: [https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/health](https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/health)

## What This Project Shows

This repository is meant to show a complete student or portfolio-grade cloud workflow rather than a single isolated Lambda:

- Cognito-backed private workspaces so each user only sees their own receipts
- direct sign-up and sign-in pages instead of a hosted auth screen
- receipt enrichment with category, confidence, compact auto labels, review status, and duplicate keys
- review, snapshot, upload, rename, and delete APIs for stored receipts
- browser upload UI with preview, history drawer, duplicate choice flow, and processing timeline
- receipt-only validation that rejects unrelated photos or documents
- SAM template for backend deployment
- Amplify build configuration for static frontend hosting
- deployment docs for AWS launch and custom-domain finish

## Architecture

1. A signed-in user opens the custom auth pages and gets a private workspace through Cognito
2. The browser requests a signed upload session for that user and uploads the file to Amazon S3
3. S3 triggers a Lambda function
4. Lambda calls Amazon Textract AnalyzeExpense
5. The processor enriches the result with:
   - vendor
   - date
   - total amount
   - line items
   - category
   - confidence score
   - compact auto label
   - duplicate key
   - review status
6. Non-receipt uploads are rejected before they enter the stored receipt set
7. The enriched record is stored in DynamoDB under the signed-in user scope
8. A second Lambda exposes user-scoped snapshot, upload, review, rename, delete, and export endpoints through HTTP API
9. The static dashboard reads from the live API and renders history, duplicate decisions, rename actions, and analytics

## AWS Services Used

- Amazon S3
- AWS Lambda
- Amazon Textract
- Amazon DynamoDB
- Amazon API Gateway HTTP API
- Amazon Cognito
- Amazon SQS
- IAM
- AWS Amplify Hosting

## Features

### Receipt Intelligence

- multi-record S3 event handling
- vendor, date, amount, and line-item extraction
- category inference from vendors and items
- confidence-based review routing
- compact auto-generated labels such as `Food me&u 12Jan`
- duplicate detection using hashed receipt signatures
- receipt-only validation that rejects unrelated images or docs
- in-app status updates scoped to each signed-in workspace

### API Layer

- JWT-protected user-scoped routes
- `GET /health`
- `POST /uploads`
- `GET /uploads/status`
- `GET /receipts`
- `GET /snapshot`
- `GET /analytics`
- `GET /exports/csv`
- `POST /receipts/clear`
- `DELETE /receipts/{receiptId}`
- `PATCH /receipts/{receiptId}/review`

### Dashboard

The dashboard in [dashboard](./dashboard) is designed to present the backend clearly without overstating the scope of the project.

It includes:

- separate sign-up and sign-in pages
- sign out and switch-account actions
- project-style overview and status cards
- receipt upload with live preview from device storage
- browser-side upload history drawer scoped per signed-in account
- duplicate choice modal with keep-separate or reject actions
- rename-label actions after upload
- single-receipt delete actions in both the latest result and history/archive views
- animated metric counters
- category spend bars and donut view
- merchant spend overview
- review queue
- monthly trend visualization
- pipeline summary panel
- filterable receipt table

By default it loads demo data. In live mode it reads the backend API from:

- the `?api=` query parameter, or
- [dashboard/config.js](./dashboard/config.js), which can be generated automatically during Amplify deploys

## Repository Structure

```text
.
|-- .github/workflows/validate.yml
|-- amplify.yml
|-- dashboard/
|   |-- app.js
|   |-- config.js
|   |-- data/demo-dashboard.json
|   |-- index.html
|   `-- styles.css
|-- docs/deployment.md
|-- events/
|   |-- sample_review_event.json
|   `-- sample_s3_event.json
|-- lambda/
|   |-- dashboard_api.py
|   `-- lambda_function.py
|-- sample-receipts/
|-- screenshots/
|-- samconfig.toml
`-- template.yaml
```

## Important Files

### [lambda/lambda_function.py](./lambda/lambda_function.py)

- processes S3 upload events
- calls Textract AnalyzeExpense
- normalizes dates and amounts
- calculates confidence
- infers categories
- generates compact auto labels
- checks for duplicates
- rejects non-receipt uploads
- stores enriched records
- stores receipt updates for in-app review and analytics

### [lambda/dashboard_api.py](./lambda/dashboard_api.py)

- creates signed upload sessions
- returns receipt lists and snapshots
- builds analytics summaries
- exports CSV
- handles duplicate decisions
- renames labels
- deletes individual receipts or date ranges

### [template.yaml](./template.yaml)

- provisions the backend with SAM
- creates the bucket, DynamoDB table, Cognito user pool, DLQ, API, and Lambdas
- accepts deploy-time parameters for confidence threshold, object metadata reads, and Cognito callback URLs

### [amplify.yml](./amplify.yml)

- publishes the dashboard as a static site
- injects the live backend API URL and direct Cognito settings through Amplify environment variables

### [samconfig.toml](./samconfig.toml)

- provides a practical default deployment profile for `ap-south-1`

## Example Enriched Receipt Record

```json
{
  "receipt_id": "rcpt-118",
  "vendor": "SkyRoute Travels",
  "category": "Travel",
  "total_amount": "384.50",
  "confidence_score": "96.20",
  "review_status": "AUTO_APPROVED",
  "expense_month": "2026-03",
  "uploaded_by": "demo-user"
}
```

## Deploying It Live

This repo is ready for a two-part deployment:

1. backend on AWS using SAM
2. frontend on AWS Amplify Hosting

### Backend

Update the auth placeholders in [samconfig.toml](./samconfig.toml), then run:

```bash
sam build
sam deploy
```

If this is your first deploy and you want guided prompts:

```bash
sam deploy --guided
```

### Frontend

Connect the repo in Amplify and add these environment variables:

```text
API_BASE_URL=https://your-api-id.execute-api.ap-south-1.amazonaws.com
COGNITO_HOSTED_UI_DOMAIN=https://your-domain-prefix.auth.ap-south-1.amazoncognito.com
COGNITO_CLIENT_ID=your-cognito-app-client-id
COGNITO_REDIRECT_SIGN_IN=https://your-dashboard.example.com
COGNITO_REDIRECT_SIGN_OUT=https://your-dashboard.example.com
```

Amplify will publish the dashboard and inject both the API URL and Cognito settings into [dashboard/config.js](./dashboard/config.js) during the build.

Detailed steps are in [docs/deployment.md](./docs/deployment.md).

### Custom Domain

The live frontend can be finished under a branded domain by attaching an ACM certificate and alias
to the CloudFront distribution. The exact Route 53 / DNS steps are documented in
[docs/deployment.md](./docs/deployment.md#custom-domain-on-cloudfront).

Receipt updates now stay inside the app, so no outbound email provider is required for the default deployment.

## Validation

The repo includes:

- sample events in [events](./events)
- a GitHub Actions validation workflow in [.github/workflows/validate.yml](./.github/workflows/validate.yml)

Lightweight local check:

```bash
python -m py_compile lambda/*.py
node --check dashboard/app.js
```

## Why It Fits Portfolio Use

- shows event-driven cloud design
- demonstrates AI-assisted document extraction
- includes private auth, duplicate decisions, rename/delete flows, and analytics, not just OCR
- has a clear frontend for demos without hiding the architecture
- is deployable as a real cloud project

## Possible Extensions

- MFA and stronger account recovery policies
- Step Functions approval workflow
- budget anomaly alerts
- vendor forecasting
- PDF report generation
- domain-based multi-tenant expense routing

## License

This project is licensed under the MIT License.
