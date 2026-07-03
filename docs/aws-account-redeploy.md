# AWS Account Redeploy Guide

This guide explains how to keep ReceiptPulse working as an AWS cloud showcase if the original AWS account is restricted, suspended, or too risky to keep using.

## Important Billing Reality

- A new AWS account does not erase or transfer an unpaid balance from an old AWS account.
- Projects and data inside a restricted account may be inaccessible until AWS restores access.
- Cognito users, S3 files, DynamoDB records, CloudFront distributions, and API Gateway URLs do not automatically move to a new account.
- Cognito passwords cannot be exported and reused directly.
- Use a new account only as a clean redeploy target, not as a way to bypass AWS billing obligations.

## What Can Be Moved Now

These are safe to move because they live in this repository:

- `template.yaml` AWS SAM infrastructure
- Lambda source under `lambda/`
- Dashboard source under `dashboard/`
- Demo data under `dashboard/data/`
- Documentation and sample receipts
- Render Cloud Demo Blueprint under `render.yaml` plus optional static fallback workflow under `.github/workflows/`

## What Requires Old Account Access

These may not be recoverable without AWS support or restored access:

- Existing S3 receipt uploads
- Existing DynamoDB receipt rows
- Existing Cognito users
- Old API Gateway URL
- Old CloudFront distribution URL
- Old Cognito hosted UI domain
- Old S3 bucket names if they remain reserved by the restricted account

## New AWS Account Guardrails

Do these before deploying any ReceiptPulse stack:

1. Enable MFA on the root user.
2. Create an IAM admin user and stop using the root user for daily work.
3. Create AWS Budgets alerts at low thresholds, for example 1 USD, 5 USD, and 10 USD.
4. Confirm the active region before deploy, preferably `ap-south-1` for this project.
5. Avoid broad experiments with Textract because OCR usage can cost money.
6. Keep test traffic tiny until billing alarms are confirmed.
7. Deploy one stack only, then inspect created resources.

## Interim Live Showcase

Use the single Render launch URL for the public recruiter link until the AWS account situation is resolved:

```text
https://receiptpulse-cloud-demo.onrender.com/
```

The Render static demo keeps AWS calls disabled and Cloud Demo enabled. This keeps the project visible without creating AWS resources or charges.

## Redeploy Backend

```bash
sam build
sam deploy --guided
```

Use a new, globally unique Cognito domain prefix when prompted.

After deployment, record these stack outputs:

- `ReceiptApiUrl`
- `ReceiptHostedUiBaseUrl`
- `ReceiptUserPoolClientId`
- `FrontendCallbackUrl`
- `FrontendLogoutUrl`
- `ReceiptAwsRegion`

## Reconnect Dashboard

Generate `dashboard/config.js` from the deployed stack instead of editing it by hand:

```bash
python tools/generate_dashboard_config.py aws-live --stack-name receiptpulse-prod --output dashboard/config.js
```

If you prefer an explicit artifact for redeploy records, save the stack description and generate from that file:

```bash
aws cloudformation describe-stacks --stack-name receiptpulse-prod --output json > .deploy-dashboard/receiptpulse-stack.json
python tools/generate_dashboard_config.py aws-live --stack-outputs-file .deploy-dashboard/receiptpulse-stack.json --output dashboard/config.js
```

Cloud Demo stays enabled in the generated file. If the new AWS API fails, the dashboard remains usable without calling AWS.

## Smoke Test Checklist

- Sign-in page loads.
- `View Cloud Demo` opens the dashboard without AWS.
- Demo upload changes dashboard metrics locally.
- New Cognito sign-up works in the new account.
- New Cognito users include a recovery email, and **Forgot password** sends a reset code to that verified email.
- AWS Live sign-in opens the dashboard.
- AWS Live receipt upload reaches S3.
- Lambda processor writes a receipt row to DynamoDB.
- Dashboard archive loads signed-in user data from API Gateway.
- AWS Budget alerts are active.

## Shut Down Test Stack

If you only deployed for testing, remove the stack:

```bash
sam delete
```

Check S3, CloudWatch logs, Cognito, DynamoDB, Lambda, API Gateway, and CloudFront manually after deletion to confirm no unexpected resources remain.
