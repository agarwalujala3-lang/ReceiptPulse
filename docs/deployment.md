# Live Deployment Guide

This project is designed to go live in two parts:

1. **AWS SAM** for the serverless backend
2. **Render Static Site** for the public dashboard, with AWS Amplify available for AWS Live hosting

For portfolio viewing while the original AWS account is restricted, publish the dashboard through Render first. That path runs Cloud Demo mode and does not call AWS.

## Prerequisites

- AWS account
- AWS CLI configured locally
- AWS SAM CLI installed
- A final dashboard URL for Cognito callbacks, or at minimum the URL you will use during first testing
- A globally unique Cognito hosted UI domain prefix

Recommended Region for this project:

```text
ap-south-1
```

## Part 1: Deploy the Backend

### 1. Review deployment defaults

The repo includes [samconfig.toml](../samconfig.toml) with sensible defaults for a first production-style deploy.

Before deploying, update the auth placeholders in that file:

```toml
CognitoDomainPrefix=your-unique-domain-prefix
FrontendCallbackUrl=https://your-dashboard.example.com
FrontendLogoutUrl=https://your-dashboard.example.com
```

### 2. Build the stack

```bash
sam build
```

### 3. Deploy the stack

```bash
sam deploy
```

If you want the guided prompt the first time:

```bash
sam deploy --guided
```

### 4. Save the backend outputs

After deployment, keep these stack outputs available:

- `ReceiptApiUrl`
- `ReceiptHostedUiBaseUrl`
- `ReceiptUserPoolClientId`
- `FrontendCallbackUrl`
- `FrontendLogoutUrl`
- `ReceiptAwsRegion`

You will use them to generate the dashboard config without hand-editing runtime files.

The Cognito stack is configured for username/password sign-in, username-gated password entry, password strength and match feedback, browser-password-manager friendly fields, and verified-email password recovery. New users should provide a recovery email during sign-up so the **Forgot password** flow can send a reset code.

## Part 2: Deploy the Dashboard

### Option 0: Render Cloud Demo

The repo includes [render.yaml](../render.yaml), which publishes `dashboard/` as a static site with clean routes and security headers.

Use the Render Blueprint flow for the public recruiter demo:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/agarwalujala3-lang/ReceiptPulse
```

Current safe public link:

```text
https://receiptpulse-cloud-demo.onrender.com/
```

Use this path until a healthy AWS account is ready. It creates no AWS charges, does not collect real passwords, and still presents the AWS architecture, UI, and redeploy story. The GitHub Pages workflow remains available as an optional static fallback, but Render is the canonical public demo host.

### Option A: AWS Amplify Hosting

This repo already includes [amplify.yml](../amplify.yml).

In Amplify:

1. Create a new app from the GitHub repo
2. Keep the root of the repo as the app root
3. Add these environment variables:

```text
API_BASE_URL=https://your-api-id.execute-api.ap-south-1.amazonaws.com
COGNITO_HOSTED_UI_DOMAIN=https://your-domain-prefix.auth.ap-south-1.amazoncognito.com
COGNITO_CLIENT_ID=your-cognito-app-client-id
COGNITO_REDIRECT_SIGN_IN=https://your-dashboard.example.com
COGNITO_REDIRECT_SIGN_OUT=https://your-dashboard.example.com
```

4. Deploy

Amplify will copy the `dashboard/` folder into the published site and run [`tools/generate_dashboard_config.py`](../tools/generate_dashboard_config.py) in `hosted-env` mode to inject the live API base URL plus Cognito hosted UI settings into `dashboard/config.js`.

### Option B: Manual Static Hosting

If you do not want Amplify, you can host `dashboard/` anywhere static hosting is supported.

Generate a live config from your deployed stack outputs:

```bash
python tools/generate_dashboard_config.py aws-live --stack-name receiptpulse-prod --output dashboard/config.js
```

If you want to avoid a live AWS CLI call, save the stack description first and generate from the file:

```bash
aws cloudformation describe-stacks --stack-name receiptpulse-prod --output json > .deploy-dashboard/receiptpulse-stack.json
python tools/generate_dashboard_config.py aws-live --stack-outputs-file .deploy-dashboard/receiptpulse-stack.json --output dashboard/config.js
```

Then upload the `dashboard/` files to your static host.

## Cloud Demo Fallback

`dashboard/config.js` can keep demo mode enabled even when AWS Live is connected:

```js
demo: {
  enabled: true,
  autoFallback: true,
  sampleDataPath: "./data/demo-dashboard.json",
}
```

When Cognito or the API is unavailable, the dashboard can still open a browser-local Cloud Demo workspace. This keeps the portfolio showcase usable without calling AWS, collecting real passwords, or creating new AWS charges. AWS Live mode resumes when `apiBaseUrl` and Cognito settings point to a healthy deployed stack.

## Config Generation Shortcuts

Use the shared generator directly when you want deterministic config files:

```bash
python tools/generate_dashboard_config.py pages-demo --output dashboard/config.js
python tools/generate_dashboard_config.py aws-live --stack-name receiptpulse-prod --output dashboard/config.js
```

Equivalent Make targets are available:

```bash
make config-pages-demo
make config-live STACK_NAME=receiptpulse-prod
```

## Quick Smoke Checks

After deployment, verify these:

### Backend

```text
GET /health
GET /analytics (with Authorization header from a signed-in user)
GET /receipts (with Authorization header from a signed-in user)
```

### Frontend

- public Render site loads with Cloud Demo as the primary action and no visible credential form
- dashboard loads and shows `Private Workspace` after AWS Live sign-in
- Cognito sign-up/sign-in redirects back to the dashboard successfully
- **Forgot password** sends a Cognito reset code to the user's recovery email and accepts the code plus a new password
- analytics cards render only the signed-in user's data
- receipt table fills from the private API
- uploading a receipt from the browser stores it under the signed-in account
- receipt progress and processed results appear inside the dashboard after sign-in

## Recommended Production Follow-ups

- restrict API and S3 CORS to your dashboard domain instead of `*`
- add MFA or stronger account recovery rules in Cognito for production users
- add CloudWatch alarms for Lambda errors and DLQ activity
- add lifecycle policies to the S3 bucket
- add a custom domain for the dashboard

## Custom Domain On CloudFront

If you redeploy the dashboard behind CloudFront, finishing it on a branded domain requires the DNS
name you want to use, so this part cannot be completed from code alone.

Use this path when you are ready:

1. Pick a hostname such as `receipts.yourdomain.com`
2. Request an ACM certificate for that hostname in `us-east-1`
3. Validate the certificate through Route 53 or your DNS provider
4. Open the CloudFront distribution for the dashboard
5. Add the hostname as an Alternate Domain Name (CNAME)
6. Attach the ACM certificate you created in `us-east-1`
7. In Route 53, create an Alias `A` record pointing that hostname to the CloudFront distribution
8. If your DNS is outside Route 53, create the equivalent `CNAME` / provider-specific record
9. Keep the distribution on HTTPS-only redirect mode
10. Run a CloudFront invalidation after the alias is attached

That leaves you with a branded, HTTPS-served product URL without changing the dashboard code.
