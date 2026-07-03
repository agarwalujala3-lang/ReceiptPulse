#!/usr/bin/env python3
"""Generate ReceiptPulse dashboard runtime config for demo or AWS Live modes."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any


DEFAULT_REGION = "ap-south-1"
DEFAULT_PUBLIC_URL = "https://receiptpulse-cloud-demo.onrender.com/"
DEFAULT_SAMPLE_DATA_PATH = "./data/demo-dashboard.json"
DEFAULT_APP_PATH = "./app.html"
DEFAULT_DEMO_USER = {
    "id": "demo-cloud-operator",
    "name": "Cloud Demo Operator",
    "email": "demo@receiptpulse.dev",
}
DEFAULT_SCOPES = ["openid", "profile"]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Generate dashboard/config.js for safe public demos or AWS Live deployments."
    )
    subparsers = parser.add_subparsers(dest="mode", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--output", required=True, help="Path to the generated config.js file.")
    common.add_argument(
        "--sample-data-path",
        default=DEFAULT_SAMPLE_DATA_PATH,
        help="Browser-visible sample data path for demo mode.",
    )
    common.add_argument(
        "--app-path",
        default=DEFAULT_APP_PATH,
        help="Relative path to the authenticated dashboard application.",
    )

    pages_demo = subparsers.add_parser(
        "pages-demo",
        parents=[common],
        help="Generate the safe public Cloud Demo config used for static public hosting.",
    )
    pages_demo.add_argument(
        "--pages-url",
        default=DEFAULT_PUBLIC_URL,
        help="Public demo URL used for redirect placeholders.",
    )

    hosted_env = subparsers.add_parser(
        "hosted-env",
        parents=[common],
        help="Generate a live config from hosting environment variables.",
    )
    hosted_env.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or DEFAULT_REGION,
        help="AWS region to embed when hosting env vars do not provide one.",
    )

    aws_live = subparsers.add_parser(
        "aws-live",
        parents=[common],
        help="Generate a live config from CloudFormation stack outputs.",
    )
    aws_live.add_argument("--stack-name", help="CloudFormation stack name to query with the AWS CLI.")
    aws_live.add_argument(
        "--stack-outputs-file",
        help="Path to a JSON file containing CloudFormation describe-stacks output or outputs.",
    )
    aws_live.add_argument(
        "--site-url",
        help="Fallback site URL used for redirectSignIn and redirectSignOut when older stacks lack those outputs.",
    )
    aws_live.add_argument("--redirect-sign-in", help="Explicit redirectSignIn override.")
    aws_live.add_argument("--redirect-sign-out", help="Explicit redirectSignOut override.")
    aws_live.add_argument(
        "--region",
        default=DEFAULT_REGION,
        help="Fallback region when older stacks do not expose ReceiptAwsRegion.",
    )

    return parser.parse_args()


def load_stack_payload(stack_name: str | None, stack_outputs_file: str | None) -> dict[str, Any]:
    if stack_outputs_file:
        with open(stack_outputs_file, "r", encoding="utf-8") as handle:
            return json.load(handle)
    if stack_name:
        completed = subprocess.run(
            [
                "aws",
                "cloudformation",
                "describe-stacks",
                "--stack-name",
                stack_name,
                "--output",
                "json",
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(completed.stdout)
    raise SystemExit("aws-live mode requires either --stack-name or --stack-outputs-file.")


def extract_outputs(payload: Any) -> dict[str, str]:
    if isinstance(payload, dict):
        stacks = payload.get("Stacks")
        if isinstance(stacks, list) and stacks:
            first = stacks[0]
            if isinstance(first, dict):
                return extract_outputs(first.get("Outputs", []))

        outputs = payload.get("Outputs")
        if isinstance(outputs, list):
            return extract_outputs(outputs)

        if payload and all(isinstance(value, str) for value in payload.values()):
            return dict(payload)

    if isinstance(payload, list):
        mapped: dict[str, str] = {}
        for item in payload:
            if isinstance(item, dict) and "OutputKey" in item and "OutputValue" in item:
                mapped[str(item["OutputKey"])] = str(item["OutputValue"])
        if mapped:
            return mapped

    raise SystemExit("Could not parse CloudFormation outputs from the provided payload.")


def require_value(value: str | None, label: str) -> str:
    cleaned = (value or "").strip()
    if not cleaned:
        raise SystemExit(f"Missing required value for {label}.")
    return cleaned


def build_base_config(sample_data_path: str, app_path: str) -> dict[str, Any]:
    return {
        "apiBaseUrl": "",
        "demo": {
            "enabled": True,
            "autoFallback": True,
            "sampleDataPath": sample_data_path,
            "user": dict(DEFAULT_DEMO_USER),
        },
        "auth": {
            "hostedUiDomain": "",
            "clientId": "",
            "region": DEFAULT_REGION,
            "appPath": app_path,
            "redirectSignIn": "",
            "redirectSignOut": "",
            "scopes": list(DEFAULT_SCOPES),
        },
    }


def build_pages_demo_config(args: argparse.Namespace) -> dict[str, Any]:
    config = build_base_config(args.sample_data_path, args.app_path)
    config["auth"]["redirectSignIn"] = args.pages_url
    config["auth"]["redirectSignOut"] = args.pages_url
    return config


def build_hosted_env_config(args: argparse.Namespace) -> dict[str, Any]:
    config = build_base_config(args.sample_data_path, args.app_path)
    config["apiBaseUrl"] = os.environ.get("API_BASE_URL", "").strip()
    config["auth"]["hostedUiDomain"] = os.environ.get("COGNITO_HOSTED_UI_DOMAIN", "").strip()
    config["auth"]["clientId"] = os.environ.get("COGNITO_CLIENT_ID", "").strip()
    config["auth"]["region"] = (
        os.environ.get("COGNITO_REGION")
        or os.environ.get("AWS_REGION")
        or os.environ.get("AWS_DEFAULT_REGION")
        or args.region
    ).strip()
    config["auth"]["redirectSignIn"] = os.environ.get("COGNITO_REDIRECT_SIGN_IN", "").strip()
    config["auth"]["redirectSignOut"] = os.environ.get("COGNITO_REDIRECT_SIGN_OUT", "").strip()
    scopes = os.environ.get("COGNITO_SCOPES", "").strip()
    if scopes:
        config["auth"]["scopes"] = [scope.strip() for scope in scopes.split(",") if scope.strip()]
    return config


def build_aws_live_config(args: argparse.Namespace) -> dict[str, Any]:
    config = build_base_config(args.sample_data_path, args.app_path)
    outputs = extract_outputs(load_stack_payload(args.stack_name, args.stack_outputs_file))

    config["apiBaseUrl"] = require_value(outputs.get("ReceiptApiUrl"), "ReceiptApiUrl")
    config["auth"]["hostedUiDomain"] = require_value(
        outputs.get("ReceiptHostedUiBaseUrl"),
        "ReceiptHostedUiBaseUrl",
    )
    config["auth"]["clientId"] = require_value(
        outputs.get("ReceiptUserPoolClientId"),
        "ReceiptUserPoolClientId",
    )
    config["auth"]["region"] = (outputs.get("ReceiptAwsRegion") or args.region).strip() or DEFAULT_REGION

    fallback_redirect = (args.site_url or "").strip()
    config["auth"]["redirectSignIn"] = require_value(
        args.redirect_sign_in or outputs.get("FrontendCallbackUrl") or fallback_redirect,
        "FrontendCallbackUrl / redirectSignIn",
    )
    config["auth"]["redirectSignOut"] = require_value(
        args.redirect_sign_out or outputs.get("FrontendLogoutUrl") or fallback_redirect,
        "FrontendLogoutUrl / redirectSignOut",
    )
    return config


def render_config(config: dict[str, Any]) -> str:
    return (
        "// Generated by tools/generate_dashboard_config.py. Do not hand-edit.\n"
        f"window.RECEIPTPULSE_CONFIG = {json.dumps(config, indent=2)};\n"
    )


def write_config(path: str, contents: str) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(contents, encoding="utf-8", newline="\n")


def main() -> int:
    args = parse_args()
    if args.mode == "pages-demo":
        config = build_pages_demo_config(args)
    elif args.mode == "hosted-env":
        config = build_hosted_env_config(args)
    elif args.mode == "aws-live":
        config = build_aws_live_config(args)
    else:
        raise SystemExit(f"Unsupported mode: {args.mode}")

    write_config(args.output, render_config(config))
    return 0


if __name__ == "__main__":
    sys.exit(main())
