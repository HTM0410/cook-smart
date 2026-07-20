#!/usr/bin/env python3
"""Download YOLO model from S3 if not present."""
import os
import sys

try:
    import boto3
except ImportError:
    print("boto3 not available, installing...")
    os.system(f"{sys.executable} -m pip install boto3 --quiet")
    import boto3


BUCKET = os.getenv("YOLO_MODEL_BUCKET", "cooksmart-yolo-models")
S3_KEY = os.getenv("YOLO_MODEL_KEY", "models/best59.pt")
LOCAL_PATH = os.getenv("YOLO_MODEL_PATH", "/app/models/best59.pt")


def main():
    os.makedirs(os.path.dirname(LOCAL_PATH), exist_ok=True)

    if os.path.isfile(LOCAL_PATH):
        size_mb = os.path.getsize(LOCAL_PATH) / (1024 * 1024)
        print(f"[download_model] Model already exists at {LOCAL_PATH} ({size_mb:.2f} MB), skipping")
        return 0

    print(f"[download_model] Downloading s3://{BUCKET}/{S3_KEY} -> {LOCAL_PATH}")
    try:
        s3 = boto3.client("s3")
        s3.download_file(BUCKET, S3_KEY, LOCAL_PATH)
        size_mb = os.path.getsize(LOCAL_PATH) / (1024 * 1024)
        print(f"[download_model] Download complete ({size_mb:.2f} MB)")
        return 0
    except Exception as exc:
        print(f"[download_model] ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())