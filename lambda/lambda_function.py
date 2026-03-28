import hashlib
import json
import os
import re
import urllib.parse
import uuid
from datetime import datetime, timezone

import boto3
from boto3.dynamodb.conditions import Key


s3 = boto3.client("s3")
textract = boto3.client("textract")
dynamodb = boto3.resource("dynamodb")


DYNAMODB_TABLE = os.environ.get("DYNAMODB_TABLE", "ReceiptRecords")
UPLOAD_STATUS_PREFIX = "_upload-status"
CONFIDENCE_THRESHOLD = float(os.environ.get("CONFIDENCE_THRESHOLD", "85"))
ALLOW_DUPLICATES = os.environ.get("ALLOW_DUPLICATES", "false").lower() == "true"
READ_OBJECT_METADATA = (
    os.environ.get("READ_OBJECT_METADATA", "false").lower() == "true"
)
REJECTED_UPLOAD_MESSAGE = (
    "Rejected. This file does not look like a receipt or bill. "
    "Upload a store receipt, invoice, or utility bill with readable vendor and amount details."
)

CATEGORY_KEYWORDS = {
    "Travel": ("air", "flight", "uber", "ola", "rapido", "cab", "hotel", "booking"),
    "Food & Dining": ("restaurant", "cafe", "coffee", "food", "nachos", "kitchen"),
    "Office Supplies": ("office", "printer", "stationery", "supplies", "notebook"),
    "Utilities": ("electric", "internet", "water", "broadband", "telecom"),
    "Medical": ("pharma", "hospital", "clinic", "medical", "medicine"),
    "Retail": ("amazon", "mart", "store", "bazaar", "trading"),
}

DATE_FORMATS = (
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
    "%m/%d/%Y",
    "%d %b %Y",
    "%d %B %Y",
    "%b %d %Y",
    "%B %d %Y",
    "%dth %b %Y",
    "%dth %B %Y",
    "%dnd %b %Y",
    "%drd %b %Y",
)

LABEL_CATEGORY_PREFIXES = {
    "Food & Dining": "Food",
    "Travel": "Travel",
    "Utilities": "Utility",
    "Medical": "Medical",
    "Retail": "Retail",
    "Office Supplies": "Office",
    "General Expense": "Expense",
    "Uncategorized": "Receipt",
}

IGNORED_VENDOR_TOKENS = {
    "and",
    "bill",
    "co",
    "company",
    "corp",
    "corporation",
    "copy",
    "document",
    "enterprises",
    "file",
    "group",
    "image",
    "img",
    "inc",
    "india",
    "invoice",
    "jpeg",
    "jpg",
    "limited",
    "llc",
    "llp",
    "ltd",
    "mart",
    "of",
    "online",
    "pay",
    "payment",
    "payments",
    "pdf",
    "photo",
    "png",
    "private",
    "pty",
    "receipt",
    "scan",
    "services",
    "solutions",
    "statement",
    "store",
    "supermarket",
    "trading",
    "upload",
}

MONTH_LABELS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
]


def lambda_handler(event, context):
    records = extract_event_payloads(event)
    if not records:
        return response(400, {"message": "No S3 records found in event payload."})

    processed = []
    failed = []

    for record in records:
        try:
            processed.append(process_record(record))
        except Exception as exc:
            failed.append(
                {
                    "bucket": record.get("bucket"),
                    "key": record.get("key"),
                    "error": str(exc),
                }
            )
            print(f"Error processing record: {exc}")

    status_code = 207 if failed and processed else 500 if failed else 200
    return response(
        status_code,
        {
            "message": "Receipt processing completed.",
            "processedCount": len(processed),
            "failedCount": len(failed),
            "processedReceipts": processed,
            "failedReceipts": failed,
        },
    )


def process_record(record):
    bucket = record["bucket"]
    key = record["key"]
    object_size = record.get("size", 0)
    etag = record.get("etag", "")

    print(f"Processing receipt from {bucket}/{key}")
    metadata = {}
    if READ_OBJECT_METADATA:
        try:
            head = s3.head_object(Bucket=bucket, Key=key)
            metadata = head.get("Metadata", {})
        except Exception as exc:
            print(f"Unable to read S3 object metadata for {key}: {exc}")
    user_name = (
        metadata.get("user-name")
        or metadata.get("uploader-name")
        or "workspace-user"
    ).strip()
    user_id = (
        metadata.get("user-id")
        or metadata.get("owner-id")
        or parse_user_id_from_key(key)
        or build_fallback_user_id(user_name)
    ).strip()
    receipt_label = str(metadata.get("receipt-label") or "").strip()
    try:
        receipt_data = process_receipt_with_textract(
            bucket=bucket,
            key=key,
            object_size=object_size,
            etag=etag,
            user_id=user_id,
            user_name=user_name,
            receipt_label=receipt_label,
        )

        is_receipt_candidate, rejection_reason = validate_receipt_candidate(
            receipt_data
        )
        if not is_receipt_candidate:
            mark_upload_status(
                bucket=bucket,
                object_key=key,
                payload={
                    "status": "REJECTED",
                    "stage": "quality",
                    "message": REJECTED_UPLOAD_MESSAGE,
                    "reason": rejection_reason,
                    "processedAt": datetime.now(timezone.utc).isoformat(),
                },
            )
            delete_source_upload(bucket, key)
            print(
                "Rejected non-receipt upload "
                f"{key} for user {user_id}: {rejection_reason}"
            )
            return {
                "status": "REJECTED",
                "reason": rejection_reason,
                "message": REJECTED_UPLOAD_MESSAGE,
                "fileName": receipt_data["file_name"],
            }

        duplicate_receipt = find_duplicate_receipt(receipt_data["user_duplicate_key"])
        if duplicate_receipt:
            receipt_data["is_duplicate"] = True
            receipt_data["duplicate_of"] = duplicate_receipt["receipt_id"]
            receipt_data["review_status"] = "DUPLICATE"
            receipt_data["review_reasons"].append(
                f"Potential duplicate of {duplicate_receipt['receipt_id']}."
            )
            if not ALLOW_DUPLICATES:
                receipt_data["lifecycle_stage"] = "needs-attention"

        store_receipt_in_dynamodb(receipt_data)

        return {
            "receiptId": receipt_data["receipt_id"],
            "vendor": receipt_data["vendor"],
            "category": receipt_data["category"],
            "reviewStatus": receipt_data["review_status"],
            "totalAmount": receipt_data["total_amount"],
            "confidenceScore": receipt_data["confidence_score"],
            "duplicate": receipt_data["is_duplicate"],
        }
    except Exception as exc:
        try:
            mark_upload_status(
                bucket=bucket,
                object_key=key,
                payload={
                    "status": "FAILED",
                    "stage": "quality",
                    "message": (
                        "Processing failed before the file could be accepted as a receipt. "
                        "Try a clearer receipt or bill image."
                    ),
                    "reason": str(exc),
                    "processedAt": datetime.now(timezone.utc).isoformat(),
                },
            )
        except Exception as status_exc:
            print(f"Unable to write upload status marker for {key}: {status_exc}")
        raise


def extract_event_payloads(event):
    if event.get("Records"):
        payloads = []
        for record in event["Records"]:
            if record.get("eventSource") != "aws:s3":
                continue
            payloads.append(
                {
                    "bucket": record["s3"]["bucket"]["name"],
                    "key": urllib.parse.unquote_plus(record["s3"]["object"]["key"]),
                    "size": record["s3"]["object"].get("size", 0),
                    "etag": record["s3"]["object"].get("eTag", ""),
                }
            )
        return payloads

    detail = event.get("detail", {})
    if event.get("source") == "aws.s3" and detail:
        bucket = detail.get("bucket", {}).get("name")
        key = urllib.parse.unquote_plus(detail.get("object", {}).get("key", ""))
        if bucket and key:
            return [
                {
                    "bucket": bucket,
                    "key": key,
                    "size": detail.get("object", {}).get("size", 0),
                    "etag": detail.get("object", {}).get("etag", ""),
                }
            ]

    return []


def process_receipt_with_textract(
    bucket,
    key,
    object_size,
    etag,
    user_id,
    user_name,
    receipt_label="",
):
    response = textract.analyze_expense(
        Document={
            "S3Object": {
                "Bucket": bucket,
                "Name": key,
            }
        }
    )

    now = datetime.now(timezone.utc)
    receipt_data = {
        "receipt_id": str(uuid.uuid4()),
        "bucket": bucket,
        "key": key,
        "file_name": key.split("/")[-1],
        "s3_path": f"s3://{bucket}/{key}",
        "source_size": int(object_size or 0),
        "etag": etag,
        "user_id": user_id,
        "user_name": user_name[:120],
        "uploaded_by": (user_name or "workspace-user")[:120],
        "receipt_label": receipt_label[:120],
        "created_at": now.isoformat(),
        "processed_timestamp": now.isoformat(),
        "date": now.strftime("%Y-%m-%d"),
        "expense_month": now.strftime("%Y-%m"),
        "vendor": "Unknown Vendor",
        "vendor_normalized": "unknown vendor",
        "total_amount": "0.00",
        "currency_symbol": "$",
        "item_count": 0,
        "items": [],
        "category": "Uncategorized",
        "confidence_score": "0.00",
        "review_status": "AUTO_APPROVED",
        "review_reasons": [],
        "is_duplicate": False,
        "duplicate_of": None,
        "lifecycle_stage": "stored",
        "duplicate_key": "",
        "user_duplicate_key": "",
        "source": "textract.analyze_expense",
        "summary_fields": {},
    }

    expense_documents = response.get("ExpenseDocuments", [])
    if expense_documents:
        extract_summary_fields(expense_documents[0], receipt_data)
        extract_line_items(expense_documents[0], receipt_data)

    normalized_date = normalize_date(receipt_data["date"])
    receipt_data["date"] = normalized_date
    receipt_data["expense_month"] = normalized_date[:7]
    receipt_data["vendor_normalized"] = normalize_text(receipt_data["vendor"])
    receipt_data["item_count"] = len(receipt_data["items"])
    receipt_data["category"] = infer_category(
        receipt_data["vendor"],
        receipt_data["items"],
        receipt_data["file_name"],
    )
    receipt_data["receipt_label"] = resolve_receipt_label(receipt_data)
    receipt_data["duplicate_key"] = build_duplicate_key(receipt_data)
    receipt_data["user_duplicate_key"] = build_user_duplicate_key(receipt_data)
    receipt_data["review_status"] = determine_review_status(receipt_data)

    print(json.dumps(receipt_data))
    return receipt_data


def validate_receipt_candidate(receipt_data):
    summary_fields = receipt_data.get("summary_fields") or {}
    has_vendor = bool(summary_fields.get("vendor", {}).get("value")) and not (
        receipt_data["vendor"].lower().startswith("unknown")
    )
    has_total = float(receipt_data["total_amount"]) > 0
    has_date = bool(summary_fields.get("date", {}).get("value"))
    has_line_items = bool(receipt_data["items"])

    looks_like_receipt = (
        has_vendor and (has_total or has_date or has_line_items)
    ) or (
        has_total and (has_date or has_line_items)
    )

    if looks_like_receipt:
        return True, ""

    missing_signals = []
    if not has_vendor:
        missing_signals.append("merchant or biller name")
    if not has_total:
        missing_signals.append("total amount")
    if not has_date:
        missing_signals.append("receipt or bill date")
    if not has_line_items:
        missing_signals.append("charge line items")

    reason = (
        "The upload is missing the usual receipt signals: "
        + ", ".join(missing_signals[:3])
        + "."
    )
    return False, reason


def resolve_receipt_label(receipt_data):
    existing_label = str(receipt_data.get("receipt_label") or "").strip()
    if existing_label:
        return existing_label[:120]
    return build_compact_receipt_label(receipt_data)


def extract_summary_fields(expense_document, receipt_data):
    confidences = []

    for field in expense_document.get("SummaryFields", []):
        field_type = field.get("Type", {}).get("Text", "")
        value_detection = field.get("ValueDetection", {})
        value = value_detection.get("Text", "").strip()
        confidence = round(float(value_detection.get("Confidence", 0)), 2)

        if field_type == "TOTAL" and value:
            amount = parse_amount(value)
            receipt_data["total_amount"] = f"{amount:.2f}"
            receipt_data["currency_symbol"] = detect_currency_symbol(value)
            confidences.append(confidence)
            receipt_data["summary_fields"]["total"] = {
                "value": value,
                "confidence": f"{confidence:.2f}",
            }
        elif field_type == "INVOICE_RECEIPT_DATE" and value:
            receipt_data["date"] = value
            confidences.append(confidence)
            receipt_data["summary_fields"]["date"] = {
                "value": value,
                "confidence": f"{confidence:.2f}",
            }
        elif field_type == "VENDOR_NAME" and value:
            receipt_data["vendor"] = value
            confidences.append(confidence)
            receipt_data["summary_fields"]["vendor"] = {
                "value": value,
                "confidence": f"{confidence:.2f}",
            }

    average_confidence = sum(confidences) / len(confidences) if confidences else 0
    receipt_data["confidence_score"] = f"{average_confidence:.2f}"


def extract_line_items(expense_document, receipt_data):
    for group in expense_document.get("LineItemGroups", []):
        for line_item in group.get("LineItems", []):
            item = {
                "name": "Unnamed item",
                "price": "0.00",
                "quantity": "1",
                "line_total": "0.00",
            }
            for field in line_item.get("LineItemExpenseFields", []):
                field_type = field.get("Type", {}).get("Text", "")
                value = field.get("ValueDetection", {}).get("Text", "").strip()

                if field_type == "ITEM" and value:
                    item["name"] = value
                elif field_type == "PRICE" and value:
                    amount = parse_amount(value)
                    item["price"] = f"{amount:.2f}"
                    item["line_total"] = f"{amount:.2f}"
                elif field_type == "QUANTITY" and value:
                    quantity = parse_quantity(value)
                    item["quantity"] = str(quantity)

            if item["name"] != "Unnamed item":
                receipt_data["items"].append(item)


def determine_review_status(receipt_data):
    reasons = receipt_data["review_reasons"]
    confidence = float(receipt_data["confidence_score"])
    total_amount = float(receipt_data["total_amount"])

    if receipt_data["vendor"].lower().startswith("unknown"):
        reasons.append("Vendor could not be identified confidently.")
    if total_amount <= 0:
        reasons.append("Total amount is missing or invalid.")
    if confidence < CONFIDENCE_THRESHOLD:
        reasons.append(
            f"Confidence score {confidence:.2f} is below threshold {CONFIDENCE_THRESHOLD:.2f}."
        )
    if not receipt_data["items"]:
        reasons.append("No line items were detected from the receipt.")

    if reasons:
        receipt_data["lifecycle_stage"] = "needs-attention"
        return "NEEDS_REVIEW"

    receipt_data["lifecycle_stage"] = "ready-for-expense-sync"
    return "AUTO_APPROVED"


def find_duplicate_receipt(user_duplicate_key):
    user_id, _, duplicate_key = user_duplicate_key.partition("#")
    table = dynamodb.Table(DYNAMODB_TABLE)
    response = table.query(
        IndexName="DuplicateKeyIndex",
        KeyConditionExpression=Key("duplicate_key").eq(duplicate_key),
        ProjectionExpression=(
            "receipt_id, duplicate_key, processed_timestamp, review_status, user_id"
        ),
    )
    items = response.get("Items", [])

    while True:
        for item in items:
            if item.get("user_id") == user_id:
                return item

        if "LastEvaluatedKey" not in response:
            return None

        response = table.query(
            IndexName="DuplicateKeyIndex",
            KeyConditionExpression=Key("duplicate_key").eq(duplicate_key),
            ProjectionExpression=(
                "receipt_id, duplicate_key, processed_timestamp, review_status, user_id"
            ),
            ExclusiveStartKey=response["LastEvaluatedKey"],
        )
        items = response.get("Items", [])


def store_receipt_in_dynamodb(receipt_data):
    table = dynamodb.Table(DYNAMODB_TABLE)
    table.put_item(Item=receipt_data)
    print(f"Stored receipt {receipt_data['receipt_id']} in DynamoDB.")


def build_upload_status_key(object_key):
    normalized_key = str(object_key or "").lstrip("/")
    return f"{UPLOAD_STATUS_PREFIX}/{normalized_key}.json"


def mark_upload_status(bucket, object_key, payload):
    s3.put_object(
        Bucket=bucket,
        Key=build_upload_status_key(object_key),
        Body=json.dumps(payload).encode("utf-8"),
        ContentType="application/json",
    )


def delete_source_upload(bucket, object_key):
    s3.delete_object(Bucket=bucket, Key=object_key)


def build_duplicate_key(receipt_data):
    signature = "|".join(
        [
            normalize_text(receipt_data["vendor"]),
            normalize_text(receipt_data["date"]),
            receipt_data["total_amount"],
            ",".join(normalize_text(item["name"]) for item in receipt_data["items"][:5]),
        ]
    )
    return hashlib.sha256(signature.encode("utf-8")).hexdigest()


def build_user_duplicate_key(receipt_data):
    return f"{receipt_data['user_id']}#{receipt_data['duplicate_key']}"


def infer_category(vendor, items, file_name):
    corpus = " ".join(
        [vendor, file_name] + [item.get("name", "") for item in items]
    ).lower()
    for category, keywords in CATEGORY_KEYWORDS.items():
        if any(keyword in corpus for keyword in keywords):
            return category
    if items:
        return "General Expense"
    return "Uncategorized"


def parse_amount(value):
    normalized = re.sub(r"(?<=\d)\s+(?=\d{2}\b)", ".", value)
    normalized = normalized.replace(",", "")
    match = re.search(r"-?\d+(?:\.\d+)?", normalized)
    return float(match.group()) if match else 0.0


def parse_quantity(value):
    match = re.search(r"\d+", value)
    return int(match.group()) if match else 1


def detect_currency_symbol(value):
    for symbol in ("$", "EUR", "£", "₹"):
        if symbol in value:
            return symbol
    return "$"


def normalize_text(value):
    return re.sub(r"\s+", " ", str(value).strip().lower())


def prettify_label_token(token):
    cleaned = str(token or "").strip()
    if not cleaned:
        return ""
    if re.search(r"[a-z]", cleaned):
        return cleaned[:18]
    return cleaned.title()[:18]


def normalize_vendor_token(token):
    return re.sub(r"[^a-z0-9]+", "", str(token or "").lower())


def extract_vendor_marker(receipt_data):
    vendor = str(receipt_data.get("vendor") or "").strip()
    if not vendor or vendor.lower().startswith("unknown"):
        return ""

    for token in re.findall(r"[A-Za-z0-9&']+", vendor):
        normalized = normalize_vendor_token(token)
        if len(normalized) <= 1 or normalized in IGNORED_VENDOR_TOKENS:
            continue
        return prettify_label_token(token)

    return ""


def extract_file_marker(receipt_data):
    file_name = str(receipt_data.get("file_name") or "").rsplit(".", 1)[0]
    for token in re.findall(r"[A-Za-z0-9&']+", file_name):
        normalized = normalize_vendor_token(token)
        if len(normalized) <= 1 or normalized in IGNORED_VENDOR_TOKENS:
            continue
        return prettify_label_token(token)

    return ""


def get_label_category_prefix(receipt_data):
    category = str(receipt_data.get("category") or "").strip()
    if not category:
        return "Receipt"
    if category in LABEL_CATEGORY_PREFIXES:
        return LABEL_CATEGORY_PREFIXES[category]

    cleaned_parts = [
        part
        for part in re.sub(r"[^A-Za-z0-9 ]+", " ", category).split()
        if part
    ]
    if not cleaned_parts:
        return "Receipt"
    return cleaned_parts[0].title()[:18]


def get_label_date_token(receipt_data):
    raw_date = str(receipt_data.get("date") or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", raw_date):
        _, month, day = raw_date.split("-")
        month_index = int(month) - 1
        if 0 <= month_index < len(MONTH_LABELS):
            return f"{int(day)}{MONTH_LABELS[month_index]}"

    expense_month = str(receipt_data.get("expense_month") or "").strip()
    if re.fullmatch(r"\d{4}-\d{2}", expense_month):
        year, month = expense_month.split("-")
        month_index = int(month) - 1
        if 0 <= month_index < len(MONTH_LABELS):
            return f"{MONTH_LABELS[month_index]}{year[-2:]}"

    return ""


def build_compact_receipt_label(receipt_data):
    parts = [get_label_category_prefix(receipt_data)]
    vendor_marker = extract_vendor_marker(receipt_data) or extract_file_marker(receipt_data)
    if vendor_marker and normalize_text(vendor_marker) != normalize_text(parts[0]):
        parts.append(vendor_marker)

    date_token = get_label_date_token(receipt_data)
    if date_token:
        parts.append(date_token)

    generated = " ".join(part for part in parts if part).strip() or "Receipt"
    generated = re.sub(r"\s+", " ", generated)
    return generated[:120]


def build_fallback_user_id(value):
    normalized = re.sub(r"[^a-z0-9._-]+", "-", normalize_text(value).replace(" ", ""))
    return normalized.strip("-") or "public-demo"


def parse_user_id_from_key(key):
    segments = [segment for segment in str(key or "").split("/") if segment]
    if len(segments) >= 2 and segments[0] == "users":
        return build_fallback_user_id(segments[1])
    return ""


def normalize_date(raw_value):
    candidate = raw_value.replace(",", " ").strip()
    candidate = re.sub(r"(\d)(st|nd|rd|th)", r"\1", candidate)

    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(candidate, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue

    if re.match(r"^\d{4}-\d{2}-\d{2}$", candidate):
        return candidate

    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def response(status_code, payload):
    return {
        "statusCode": status_code,
        "body": json.dumps(payload),
    }
