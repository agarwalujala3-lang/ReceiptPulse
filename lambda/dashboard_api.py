import csv
import json
import os
import re
import time
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal
from io import StringIO

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError


s3 = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
RECEIPT_TABLE = os.environ.get("DYNAMODB_TABLE", "ReceiptRecords")
RECEIPT_BUCKET = os.environ.get("RECEIPT_BUCKET", "")
CACHE_TTL_SECONDS = int(os.environ.get("SNAPSHOT_CACHE_TTL_SECONDS", "15"))
UPLOAD_URL_EXPIRES_IN = int(os.environ.get("UPLOAD_URL_EXPIRES_IN", "900"))
UPLOAD_STATUS_PREFIX = "_upload-status"
ALLOWED_UPLOAD_TYPES = {
    "application/pdf": {".pdf"},
    "image/png": {".png"},
    "image/jpeg": {".jpg", ".jpeg"},
}
_SNAPSHOT_CACHE = {}
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class ApiError(Exception):
    def __init__(self, status_code, message):
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def lambda_handler(event, context):
    if event.get("warmer") or event.get("source") == "aws.events":
        return response(200, {"status": "warm"})

    method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod", "GET")
    ).upper()
    path = (event.get("rawPath") or event.get("path") or "/").rstrip("/") or "/"

    try:
        if method == "OPTIONS":
            return response(200, {"status": "ok"})
        if method == "GET" and path == "/":
            return response(
                200,
                {
                    "service": "ReceiptPulse API",
                    "status": "ok",
                    "routes": [
                        "/health",
                        "/snapshot",
                        "/receipts",
                        "/receipts/clear",
                        "/analytics",
                        "/uploads",
                        "/uploads/status",
                        "/exports/csv",
                    ],
                    "workspaceAccess": "JWT authentication is required for private receipt routes.",
                },
            )
        if method == "GET" and path == "/health":
            return response(200, {"status": "ok"})

        identity = require_identity(event)

        if method == "POST" and path == "/uploads":
            body = parse_json_body(event)
            return response(200, create_upload_session(body, identity))
        if method == "GET" and path == "/uploads/status":
            query_params = event.get("queryStringParameters") or {}
            return response(200, get_upload_status(query_params.get("key"), identity))
        if method == "GET" and path == "/receipts":
            snapshot = get_snapshot_payload(identity["user_id"])
            receipts = filter_receipts(
                snapshot["receipts"], event.get("queryStringParameters") or {}
            )
            return response(200, {"receipts": receipts})
        if method == "GET" and path == "/analytics":
            analytics = get_snapshot_payload(identity["user_id"])["analytics"]
            return response(200, analytics)
        if method == "GET" and path == "/snapshot":
            return response(200, get_snapshot_payload(identity["user_id"]))
        if method == "POST" and path == "/receipts/clear":
            body = parse_json_body(event)
            deleted = clear_receipts(body, identity)
            return response(200, deleted)
        if method == "GET" and path == "/exports/csv":
            receipts = get_snapshot_payload(identity["user_id"])["receipts"]
            csv_text = export_csv(receipts)
            return response(200, csv_text, content_type="text/csv")
        if method == "PATCH" and path.startswith("/receipts/") and path.endswith("/review"):
            receipt_id = path.split("/")[2]
            body = parse_json_body(event)
            updated = update_review_status(receipt_id, body, identity)
            return response(200, updated)
    except ApiError as exc:
        return response(exc.status_code, {"message": exc.message})
    except Exception as exc:
        print(f"Unhandled dashboard API error: {exc}")
        return response(500, {"message": str(exc)})

    return response(404, {"message": "Route not found."})


def require_identity(event):
    claims = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("jwt", {})
        .get("claims", {})
    )
    user_id = (
        claims.get("sub")
        or claims.get("cognito:username")
        or claims.get("username")
        or ""
    ).strip()
    if not user_id:
        raise ApiError(401, "Authentication is required for this workspace route.")

    user_email = resolve_identity_email(claims)
    user_name = (
        claims.get("name")
        or claims.get("given_name")
        or claims.get("preferred_username")
        or claims.get("cognito:username")
        or claims.get("username")
        or user_email
        or user_id
    ).strip()
    return {
        "user_id": user_id,
        "user_email": user_email,
        "user_name": user_name,
    }


def resolve_identity_email(claims):
    for key in ("email",):
        candidate = normalize_email(claims.get(key))
        if candidate:
            return candidate
    return ""


def normalize_email(value):
    candidate = str(value or "").strip().lower()
    if not candidate or not EMAIL_PATTERN.match(candidate):
        return ""
    return candidate


def normalize_upload_content_type(value):
    candidate = str(value or "").strip().lower()
    if candidate == "image/jpg":
        return "image/jpeg"
    return candidate


def get_file_extension(file_name):
    sanitized = str(file_name or "").strip().lower()
    if "." not in sanitized:
        return ""
    return f".{sanitized.rsplit('.', 1)[-1]}"


def is_supported_receipt_upload(file_name, content_type):
    allowed_extensions = ALLOWED_UPLOAD_TYPES.get(content_type)
    if not allowed_extensions:
        return False
    return get_file_extension(file_name) in allowed_extensions


def parse_json_body(event):
    try:
        return json.loads(event.get("body") or "{}")
    except json.JSONDecodeError as exc:
        raise ApiError(400, "Request body must be valid JSON.") from exc


def query_user_receipts(user_id):
    table = dynamodb.Table(RECEIPT_TABLE)
    items = []
    query_args = {
        "IndexName": "UserReceiptIndex",
        "KeyConditionExpression": Key("user_id").eq(user_id),
        "ProjectionExpression": (
            "receipt_id, vendor, category, review_status, total_amount, "
            "confidence_score, expense_month, uploaded_by, receipt_label, s3_path, "
            "processed_timestamp, is_duplicate, review_reasons, file_name, "
            "currency_symbol, duplicate_of, item_count, user_id, user_email, user_name, "
            "created_at, #receipt_key"
        ),
        "ExpressionAttributeNames": {"#receipt_key": "key"},
        "ScanIndexForward": False,
    }
    page = table.query(**query_args)
    items.extend(page.get("Items", []))

    while "LastEvaluatedKey" in page:
        page = table.query(
            ExclusiveStartKey=page["LastEvaluatedKey"],
            **query_args,
        )
        items.extend(page.get("Items", []))

    return items


def get_snapshot_payload(user_id, force_refresh=False):
    now = time.time()
    cached = _SNAPSHOT_CACHE.get(user_id)
    if (
        not force_refresh
        and cached is not None
        and cached["expires_at"] > now
    ):
        return cached["payload"]

    receipts = query_user_receipts(user_id)
    payload = {
        "receipts": receipts,
        "analytics": build_analytics(receipts),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    _SNAPSHOT_CACHE[user_id] = {
        "expires_at": now + CACHE_TTL_SECONDS,
        "payload": payload,
    }
    return payload


def create_upload_session(payload, identity):
    if not RECEIPT_BUCKET:
        raise ApiError(500, "Receipt bucket is not configured for uploads.")

    file_name = sanitize_filename(payload.get("fileName") or "receipt-upload")
    content_type = normalize_upload_content_type(
        payload.get("contentType") or "application/octet-stream"
    )
    if not is_supported_receipt_upload(file_name, content_type):
        raise ApiError(
            400,
            "Only PDF, PNG, JPG, and JPEG receipt or bill files are supported.",
        )

    receipt_label = (
        payload.get("receiptLabel")
        or payload.get("uploaderName")
        or ""
    ).strip()
    stamp = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    user_key = sanitize_path_segment(identity["user_id"])
    object_key = f"users/{user_key}/{stamp}/{uuid.uuid4().hex[:12]}-{file_name}"
    metadata = compact_metadata({
        "user-id": identity["user_id"][:120],
        "user-name": identity["user_name"][:120],
        "uploader-name": identity["user_name"][:120],
        "receipt-label": receipt_label[:120],
    })

    upload_url = s3.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": RECEIPT_BUCKET,
            "Key": object_key,
            "ContentType": content_type,
            "Metadata": metadata,
        },
        ExpiresIn=UPLOAD_URL_EXPIRES_IN,
    )

    return {
        "uploadUrl": upload_url,
        "objectKey": object_key,
        "s3Path": f"s3://{RECEIPT_BUCKET}/{object_key}",
        "expiresIn": UPLOAD_URL_EXPIRES_IN,
        "headers": compact_metadata({
            "Content-Type": content_type,
            "x-amz-meta-user-id": metadata["user-id"],
            "x-amz-meta-user-name": metadata["user-name"],
            "x-amz-meta-uploader-name": metadata["uploader-name"],
            "x-amz-meta-receipt-label": metadata.get("receipt-label", ""),
        }),
        "pollAfterMs": 2200,
    }


def compact_metadata(values):
    return {key: value for key, value in values.items() if value not in ("", None)}


def get_upload_status(object_key, identity):
    if not object_key:
        return {
            "status": "INVALID",
            "stage": "intake",
            "message": "Upload key is missing.",
        }

    assert_user_owns_object_key(object_key, identity["user_id"])

    receipt = find_receipt_by_key(object_key, identity["user_id"], force_refresh=True)
    if receipt:
        return {
            "status": "PROCESSED",
            "stage": "stored",
            "receipt": serialize_receipt(receipt),
            "message": "Receipt processed and available in your private workspace.",
        }

    upload_status = read_upload_status_record(object_key)
    if upload_status:
        return upload_status

    try:
        head = s3.head_object(Bucket=RECEIPT_BUCKET, Key=object_key)
        owner_id = head.get("Metadata", {}).get("user-id", "")
        if owner_id and owner_id != identity["user_id"]:
            raise ApiError(403, "This receipt belongs to a different user.")
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in {"404", "NotFound", "NoSuchKey"}:
            return {
                "status": "NOT_FOUND",
                "stage": "intake",
                "message": "Receipt file was not found in storage.",
            }
        raise

    return {
        "status": "PROCESSING",
        "stage": "textract",
        "objectKey": object_key,
        "lastModified": head.get("LastModified", datetime.now(timezone.utc))
        .astimezone(timezone.utc)
        .isoformat(),
        "message": "Receipt uploaded. AI extraction and review checks are running now.",
    }


def find_receipt_by_key(object_key, user_id, force_refresh=False):
    snapshot = get_snapshot_payload(user_id, force_refresh=force_refresh)
    for receipt in snapshot["receipts"]:
        if receipt.get("key") == object_key:
            return receipt
    return None


def build_upload_status_key(object_key):
    normalized_key = str(object_key or "").lstrip("/")
    return f"{UPLOAD_STATUS_PREFIX}/{normalized_key}.json"


def read_upload_status_record(object_key):
    try:
        response_payload = s3.get_object(
            Bucket=RECEIPT_BUCKET,
            Key=build_upload_status_key(object_key),
        )
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code", "")
        if error_code in {"404", "NotFound", "NoSuchKey"}:
            return None
        raise

    try:
        data = json.loads(
            response_payload["Body"].read().decode("utf-8") or "{}"
        )
    except json.JSONDecodeError:
        return {
            "status": "FAILED",
            "stage": "quality",
            "message": "Upload status data was unreadable. Please try the receipt again.",
            "objectKey": object_key,
        }

    return {
        "status": data.get("status", "FAILED"),
        "stage": data.get("stage", "quality"),
        "message": data.get(
            "message",
            "This upload could not be processed as a receipt.",
        ),
        "objectKey": object_key,
        "reason": data.get("reason", ""),
        "processedAt": data.get("processedAt", ""),
    }


def assert_user_owns_object_key(object_key, user_id):
    expected_prefix = f"users/{sanitize_path_segment(user_id)}/"
    if not str(object_key).startswith(expected_prefix):
        raise ApiError(403, "This upload key does not belong to the signed-in user.")


def filter_receipts(receipts, query_params):
    status = (query_params.get("status") or "").lower()
    category = (query_params.get("category") or "").lower()
    vendor = (query_params.get("vendor") or "").lower()
    month = query_params.get("month") or ""

    filtered = []
    for receipt in receipts:
        if status and receipt.get("review_status", "").lower() != status:
            continue
        if category and receipt.get("category", "").lower() != category:
            continue
        if vendor and vendor not in receipt.get("vendor", "").lower():
            continue
        if month and receipt.get("expense_month") != month:
            continue
        filtered.append(receipt)

    return filtered


def build_analytics(receipts):
    total_spend = 0.0
    confidence_values = []
    category_totals = defaultdict(float)
    vendor_totals = defaultdict(float)
    month_totals = defaultdict(lambda: {"amount": 0.0, "count": 0})
    status_totals = defaultdict(int)
    review_queue = []

    for receipt in receipts:
        amount = parse_float(receipt.get("total_amount"))
        confidence = parse_float(receipt.get("confidence_score"))
        category = receipt.get("category", "Uncategorized")
        vendor = receipt.get("vendor", "Unknown Vendor")
        month = receipt.get("expense_month", "unknown")
        status = receipt.get("review_status", "UNKNOWN")

        total_spend += amount
        if confidence:
            confidence_values.append(confidence)
        category_totals[category] += amount
        vendor_totals[vendor] += amount
        month_totals[month]["amount"] += amount
        month_totals[month]["count"] += 1
        status_totals[status] += 1

        if status in ("NEEDS_REVIEW", "DUPLICATE"):
            review_queue.append(
                {
                    "receiptId": receipt.get("receipt_id"),
                    "vendor": vendor,
                    "category": category,
                    "receiptLabel": receipt.get("receipt_label", ""),
                    "totalAmount": receipt.get("total_amount", "0.00"),
                    "reviewStatus": status,
                    "reasons": receipt.get("review_reasons", []),
                }
            )

    average_confidence = (
        sum(confidence_values) / len(confidence_values) if confidence_values else 0.0
    )
    duplicate_count = sum(1 for receipt in receipts if receipt.get("is_duplicate"))

    return {
        "summary": {
            "receiptCount": len(receipts),
            "totalSpend": round(total_spend, 2),
            "averageConfidence": round(average_confidence, 2),
            "duplicateCount": duplicate_count,
            "needsReviewCount": status_totals.get("NEEDS_REVIEW", 0)
            + status_totals.get("DUPLICATE", 0),
            "autoApprovedCount": status_totals.get("AUTO_APPROVED", 0),
        },
        "categoryBreakdown": sort_breakdown(category_totals),
        "topVendors": sort_breakdown(vendor_totals, key_name="vendor"),
        "statusBreakdown": [
            {"status": status, "count": count}
            for status, count in sorted(status_totals.items(), key=lambda item: item[0])
        ],
        "monthlyTrend": [
            {
                "month": month,
                "amount": round(values["amount"], 2),
                "count": values["count"],
            }
            for month, values in sorted(month_totals.items(), key=lambda item: item[0])
        ],
        "reviewQueue": review_queue[:6],
    }


def export_csv(receipts):
    buffer = StringIO()
    writer = csv.DictWriter(
        buffer,
        fieldnames=[
            "receipt_id",
            "vendor",
            "category",
            "review_status",
            "total_amount",
            "confidence_score",
            "expense_month",
            "uploaded_by",
            "receipt_label",
            "s3_path",
            "processed_timestamp",
        ],
    )
    writer.writeheader()
    for receipt in receipts:
        writer.writerow(
            {
                "receipt_id": receipt.get("receipt_id"),
                "vendor": receipt.get("vendor"),
                "category": receipt.get("category"),
                "review_status": receipt.get("review_status"),
                "total_amount": receipt.get("total_amount"),
                "confidence_score": receipt.get("confidence_score"),
                "expense_month": receipt.get("expense_month"),
                "uploaded_by": receipt.get("uploaded_by"),
                "receipt_label": receipt.get("receipt_label"),
                "s3_path": receipt.get("s3_path"),
                "processed_timestamp": receipt.get("processed_timestamp"),
            }
        )
    return buffer.getvalue()


def update_review_status(receipt_id, payload, identity):
    table = dynamodb.Table(RECEIPT_TABLE)
    review_status = payload.get("reviewStatus", "REVIEWED")
    reviewer = identity["user_email"] or identity["user_name"] or "workspace-user"
    note = payload.get("note", "")
    reviewed_at = datetime.now(timezone.utc).isoformat()

    try:
        response_payload = table.update_item(
            Key={"receipt_id": receipt_id},
            UpdateExpression=(
                "SET review_status = :status, reviewed_by = :reviewed_by, "
                "reviewed_at = :reviewed_at, reviewer_note = :reviewer_note"
            ),
            ConditionExpression="attribute_exists(receipt_id) AND user_id = :user_id",
            ExpressionAttributeValues={
                ":status": review_status,
                ":reviewed_by": reviewer,
                ":reviewed_at": reviewed_at,
                ":reviewer_note": note,
                ":user_id": identity["user_id"],
            },
            ReturnValues="ALL_NEW",
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            raise ApiError(404, "Receipt not found for the signed-in user.") from exc
        raise

    invalidate_snapshot_cache(identity["user_id"])
    return {"receipt": serialize_receipt(response_payload.get("Attributes", {}))}


def clear_receipts(payload, identity):
    from_date = payload.get("fromDate") or ""
    to_date = payload.get("toDate") or ""
    matching_receipts = [
        receipt
        for receipt in query_user_receipts(identity["user_id"])
        if receipt_matches_range(receipt, from_date, to_date)
    ]

    if not matching_receipts:
        return {
            "deletedCount": 0,
            "deletedS3Objects": 0,
            "fromDate": from_date or None,
            "toDate": to_date or None,
            "message": "No stored receipts matched the selected time period.",
        }

    table = dynamodb.Table(RECEIPT_TABLE)
    deleted_objects = 0

    with table.batch_writer() as batch:
        for receipt in matching_receipts:
            batch.delete_item(Key={"receipt_id": receipt["receipt_id"]})
            key = receipt.get("key")
            if RECEIPT_BUCKET and key:
                try:
                    s3.delete_object(Bucket=RECEIPT_BUCKET, Key=key)
                    deleted_objects += 1
                except ClientError:
                    pass

    invalidate_snapshot_cache(identity["user_id"])
    return {
        "deletedCount": len(matching_receipts),
        "deletedS3Objects": deleted_objects,
        "fromDate": from_date or None,
        "toDate": to_date or None,
        "message": (
            f"Deleted {len(matching_receipts)} stored receipts from your private workspace."
        ),
    }


def invalidate_snapshot_cache(user_id=None):
    if user_id:
        _SNAPSHOT_CACHE.pop(user_id, None)
        return

    _SNAPSHOT_CACHE.clear()


def serialize_receipt(receipt):
    return {
        "receiptId": receipt.get("receipt_id"),
        "vendor": receipt.get("vendor", "Unknown Vendor"),
        "category": receipt.get("category", "Uncategorized"),
        "reviewStatus": receipt.get("review_status", "UNKNOWN"),
        "totalAmount": receipt.get("total_amount", "0.00"),
        "confidenceScore": receipt.get("confidence_score", "0.00"),
        "expenseMonth": receipt.get("expense_month"),
        "uploadedBy": receipt.get("uploaded_by"),
        "receiptLabel": receipt.get("receipt_label", ""),
        "s3Path": receipt.get("s3_path"),
        "processedAt": receipt.get("processed_timestamp"),
        "fileName": receipt.get("file_name"),
        "objectKey": receipt.get("key"),
        "currencySymbol": receipt.get("currency_symbol", "$"),
        "duplicateOf": receipt.get("duplicate_of"),
        "itemCount": receipt.get("item_count", 0),
        "reviewReasons": receipt.get("review_reasons", []),
    }


def sort_breakdown(values, key_name="label"):
    total = sum(values.values()) or 1
    rows = []
    for label, amount in sorted(values.items(), key=lambda item: item[1], reverse=True):
        rows.append(
            {
                key_name: label,
                "amount": round(amount, 2),
                "share": round((amount / total) * 100, 1),
            }
        )
    return rows


def parse_float(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def sanitize_filename(value):
    basename = os.path.basename(str(value).strip())
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "-", basename).strip(".-")
    return sanitized or "receipt-upload"


def sanitize_path_segment(value):
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "-", str(value).strip()).strip(".-")
    return sanitized or "user"


def receipt_matches_range(receipt, from_date, to_date):
    stamp = parse_receipt_timestamp(receipt)
    if stamp is None:
        return not from_date and not to_date

    if from_date:
        start = datetime.fromisoformat(f"{from_date}T00:00:00+00:00")
        if stamp < start:
            return False

    if to_date:
        end = datetime.fromisoformat(f"{to_date}T23:59:59.999999+00:00")
        if stamp > end:
            return False

    return True


def parse_receipt_timestamp(receipt):
    candidates = [
        receipt.get("processed_timestamp"),
        receipt.get("created_at"),
        receipt.get("date"),
    ]
    for candidate in candidates:
        if not candidate:
            continue
        if len(candidate) == 10:
            candidate = f"{candidate}T00:00:00+00:00"
        normalized = str(candidate).replace("Z", "+00:00")
        try:
            stamp = datetime.fromisoformat(normalized)
            if stamp.tzinfo is None:
                stamp = stamp.replace(tzinfo=timezone.utc)
            return stamp.astimezone(timezone.utc)
        except ValueError:
            continue
    return None


def response(status_code, payload, content_type="application/json"):
    body = payload if isinstance(payload, str) else json.dumps(normalize_payload(payload))
    cache_control = "no-store"
    if content_type == "application/json" and status_code == 200:
        cache_control = "private, no-store"
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
            "Content-Type": content_type,
            "Cache-Control": cache_control,
        },
        "body": body,
    }


def normalize_payload(value):
    if isinstance(value, list):
        return [normalize_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize_payload(item) for key, item in value.items()}
    if isinstance(value, Decimal):
        if value % 1 == 0:
            return int(value)
        return float(value)
    return value
