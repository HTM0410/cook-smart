#!/usr/bin/env python3
"""
Register a model version in DynamoDB `cooksmart-model-versions` and create an
ALIAS pointer (default: `production`) that points to that version.

Usage:
    python register_production_alias.py \\
        --version v2026.07.09-local-upload \\
        --alias production \\
        --s3-key ingredient-detector/v2026.07.09-local-upload/manifest.json

Behavior:
    - Reads manifest.json from S3 (cooksmart-models)
    - Writes 2 items to DynamoDB:
        PK=ALIAS#<alias>, SK=POINTER -> {version, s3_key, sha256, updated_at}
        PK=VERSION#<version>, SK=METADATA -> full manifest contents
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone

import boto3

AWS_REGION = "ap-southeast-1"
AWS_ACCOUNT_ID = "294060270105"
DYNAMODB_TABLE = "cooksmart-model-versions"
DEFAULT_S3_BUCKET = "cooksmart-models"


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--version", required=True, help="Version string e.g. v2026.07.09-local-upload")
    p.add_argument("--alias", default="production", help="Alias name (default: production)")
    p.add_argument(
        "--s3-key",
        default=None,
        help="S3 key for manifest.json (default: ingredient-detector/<version>/manifest.json)",
    )
    p.add_argument("--s3-bucket", default=DEFAULT_S3_BUCKET)
    p.add_argument("--dry-run", action="store_true", help="Print items without writing")
    return p.parse_args()


def fetch_manifest(s3, bucket: str, key: str) -> dict:
    obj = s3.get_object(Bucket=bucket, Key=key)
    body = obj["Body"].read().decode("utf-8-sig")
    return json.loads(body)


def build_items(manifest: dict, version: str, alias: str, s3_key: str) -> list[dict]:
    now = datetime.now(timezone.utc).isoformat()

    pointer = {
        "PK": f"ALIAS#{alias}",
        "SK": "POINTER",
        "version": version,
        "s3_bucket": DEFAULT_S3_BUCKET,
        "s3_key": s3_key,
        "model_sha256": manifest.get("model_sha256", ""),
        "alias": alias,
        "updated_at": now,
        "class_count": str(manifest.get("class_count", 0)),
    }

    metadata = {
        "PK": f"VERSION#{version}",
        "SK": "METADATA",
        "version": version,
        "alias": alias,
        "source": manifest.get("source", ""),
        "original_filename": manifest.get("original_filename", ""),
        "size_bytes": str(manifest.get("size_bytes", 0)),
        "model_sha256": manifest.get("model_sha256", ""),
        "class_count": str(manifest.get("class_count", 0)),
        "uploaded_at": manifest.get("uploaded_at", ""),
        "s3_bucket": DEFAULT_S3_BUCKET,
        "s3_key": s3_key,
        "notes": manifest.get("notes", ""),
        "registered_at": now,
    }

    return [pointer, metadata]


def write_items(table, items: list[dict], dry_run: bool) -> None:
    if dry_run:
        for it in items:
            print(json.dumps(it, indent=2))
        return

    for it in items:
        table.put_item(Item=it)
        print(f"Wrote PK={it['PK']} SK={it['SK']}")


def verify_items(table, version: str, alias: str) -> None:
    alias_item = table.get_item(
        Key={"PK": f"ALIAS#{alias}", "SK": "POINTER"},
    ).get("Item")
    ver_item = table.get_item(
        Key={"PK": f"VERSION#{version}", "SK": "METADATA"},
    ).get("Item")

    if not alias_item:
        raise SystemExit(f"ERROR: ALIAS#{alias} POINTER missing after write")
    if not ver_item:
        raise SystemExit(f"ERROR: VERSION#{version} METADATA missing after write")

    print("\nVerification:")
    print(f"  ALIAS#{alias} POINTER -> version={alias_item['version']}, sha={alias_item['model_sha256'][:16]}...")
    print(f"  VERSION#{version} METADATA -> class_count={ver_item['class_count']}, alias={ver_item['alias']}")


def main() -> int:
    args = parse_args()
    s3_key = args.s3_key or f"ingredient-detector/{args.version}/manifest.json"

    s3 = boto3.client("s3", region_name=AWS_REGION)
    ddb_resource = boto3.resource("dynamodb", region_name=AWS_REGION)
    ddb_table = ddb_resource.Table(DYNAMODB_TABLE)

    print(f"Fetching manifest: s3://{args.s3_bucket}/{s3_key}")
    manifest = fetch_manifest(s3, args.s3_bucket, s3_key)
    print(f"  Loaded manifest: version={manifest.get('version')}, classes={manifest.get('class_count')}")

    items = build_items(manifest, args.version, args.alias, s3_key)
    print(f"\nWriting 2 items to DynamoDB table '{DYNAMODB_TABLE}':")
    write_items(ddb_table, items, dry_run=args.dry_run)

    if not args.dry_run:
        verify_items(ddb_table, args.version, args.alias)

    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())