# ReceiptPulse

ReceiptPulse is a serverless AWS portfolio project for receipt processing. It accepts uploaded receipts, extracts structured fields with Textract, stores the results in DynamoDB, and shows the processed data in a dashboard with review states and user sign-in.

## Live Demo

- Frontend: [https://d2ijsg7huf2h2p.cloudfront.net/](https://d2ijsg7huf2h2p.cloudfront.net/)
- API root: [https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/](https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/)
- Health check: [https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/health](https://xooa7yv1tf.execute-api.ap-south-1.amazonaws.com/health)

## What This Project Shows

This repository is meant to show a complete student or portfolio-grade cloud workflow rather than a single isolated Lambda:

- receipt enrichment with category, confidence, review status, and duplicate keys
- review and analytics API for stored receipts
- Cognito-backed user accounts so each user only sees their own receipts
- browser upload UI with preview, history drawer, and processing timeline
- SAM template for backend deployment
- Amplify build configuration for static frontend hosting
- deployment docs for AWS launch and custom-domain finish

## Architecture

1. A receipt is uploaded to Amazon S3
2. S3 triggers a Lambda function
3. Lambda calls Amazon Textract AnalyzeExpense
4. The processor enriches the result with:
   - vendor
   - date
   - total amount
   - line items
   - category
   - confidence score
   - duplicate key
   - review status
5. The enriched record is stored in DynamoDB
6. The dashboard reads the processed result back through the private API
7. Cognito authenticates each dashboard user and issues JWTs for private API access
8. A second Lambda exposes user-scoped analytics, review, upload, and export endpoints through HTTP API
9. The static dashboard reads from the live API and renders the project view

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
- duplicate detection using hashed receipt signatures
- in-app status updates scoped to each signed-in workspace

### API Layer

- JWT-protected user-scoped routes
- `GET /health`
- `GET /receipts`
- `GET /analytics`
- `GET /exports/csv`
- `PATCH /receipts/{receiptId}/review`

### Dashboard

The dashboard in [dashboard](./dashboard) is designed to present the backend clearly without overstating the scope of the project.

It includes:

- sign up, sign in, sign out, and session refresh for user accounts
- project-style overview and status cards
- receipt upload with live preview
- saved browser-side upload history drawer scoped per signed-in account
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
- checks for duplicates
- stores enriched records
- stores receipt updates for in-app review and analytics

### [lambda/dashboard_api.py](./lambda/dashboard_api.py)

- returns receipt lists
- builds analytics summaries
- exports CSV
- updates review state

### [template.yaml](./template.yaml)

- provisions the backend with SAM
- creates the bucket, DynamoDB table, Cognito user pool, DLQ, API, and Lambdas
- accepts deploy-time parameters for confidence threshold, object metadata reads, and Cognito callback URLs

### [amplify.yml](./amplify.yml)

- publishes the dashboard as a static site
- injects the live backend API URL and Cognito hosted UI settings through Amplify environment variables

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
- includes review logic and analytics, not just OCR
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
