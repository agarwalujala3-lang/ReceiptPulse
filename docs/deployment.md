# Live Deployment Guide

This project is designed to go live in two parts:

1. **AWS SAM** for the serverless backend
2. **AWS Amplify Hosting** for the dashboard

## Prerequisites

- AWS account
- AWS CLI configured locally
- AWS SAM CLI installed
- A verified SES sender email in the same AWS Region where you deploy
- A final dashboard URL for Cognito callbacks, or at minimum the URL you will use during first testing
- A globally unique Cognito hosted UI domain prefix

Recommended Region for this project:

```text
ap-south-1
```

## Part 1: Deploy the Backend

### 1. Review deployment defaults

The repo includes [samconfig.toml](../samconfig.toml) with sensible defaults for a first production-style deploy.

Before deploying, update the email and auth placeholders in that file:

```toml
SesSenderEmail=your-verified-sender@example.com
SesDefaultRecipientEmail=finance@example.com
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

After deployment, copy these output values:

- `ReceiptApiUrl`
- `ReceiptHostedUiBaseUrl`
- `ReceiptUserPoolClientId`

You will use them in the dashboard deployment.

## Part 2: Make SES Actually Work

New SES accounts usually start in the sandbox. In sandbox mode, you can only send to verified addresses and sending volume is limited.

Before calling this live for public users:

1. Verify the sender identity in SES
2. If needed, verify the fallback recipient too
3. Request production access for SES in your deployed AWS Region

## Part 3: Deploy the Dashboard

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

Amplify will copy the `dashboard/` folder into the published site and inject the live API base URL plus Cognito hosted UI settings into `dashboard/config.js`.

### Option B: Manual Static Hosting

If you do not want Amplify, you can host `dashboard/` anywhere static hosting is supported.

In that case, edit [dashboard/config.js](../dashboard/config.js):

```js
window.RECEIPTPULSE_CONFIG = {
  apiBaseUrl: "https://your-api-id.execute-api.ap-south-1.amazonaws.com",
  auth: {
    hostedUiDomain: "https://your-domain-prefix.auth.ap-south-1.amazoncognito.com",
    clientId: "your-cognito-app-client-id",
    redirectSignIn: "https://your-dashboard.example.com",
    redirectSignOut: "https://your-dashboard.example.com",
    scopes: ["openid", "email", "profile"],
  },
};
```

Then upload the `dashboard/` files to your static host.

## Quick Smoke Checks

After deployment, verify these:

### Backend

```text
GET /health
GET /analytics (with Authorization header from a signed-in user)
GET /receipts (with Authorization header from a signed-in user)
```

### Frontend

- dashboard loads and shows `Private Workspace` after sign-in
- Cognito sign-up/sign-in redirects back to the dashboard successfully
- analytics cards render only the signed-in user's data
- receipt table fills from the private API
- uploading a receipt from the browser stores it under the signed-in account

## Recommended Production Follow-ups

- restrict API and S3 CORS to your dashboard domain instead of `*`
- add MFA or stronger account recovery rules in Cognito for production users
- add CloudWatch alarms for Lambda errors and DLQ activity
- add lifecycle policies to the S3 bucket
- add a custom domain for the dashboard

## Custom Domain on CloudFront

The dashboard is currently being served from a CloudFront distribution. Finishing it on a branded
domain requires the DNS name you want to use, so this part cannot be completed from code alone.

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
