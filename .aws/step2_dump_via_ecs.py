#!/usr/bin/env python3
"""
Run pg_dump inside a one-off ECS task (with Postgres client installed).
This avoids needing to install psql locally.

We register a special task def that uses a Postgres image with psql,
then run pg_dump → upload to S3 → start another task to pg_restore.

But simpler: run a single command inside an existing backend task as Exec.
"""
import os
import sys
import json
import subprocess
import time
import boto3

REGION = "ap-southeast-1"
CLUSTER = "cooksmart-prod-v2"
SERVICE = "cooksmart-backend"

OLD_DB_HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
OLD_DB_PORT = "6543"
OLD_DB_USER = "postgres.hcswzmpqkhtqdwbhevqb"
OLD_DB_NAME = "postgres"
OLD_DB_PASSWORD = "hoanghhk123."

NEW_PROJECT_REF = "dbdsrdtofmhlluxgrfok"
# Try different SG pooler hostnames
NEW_DB_HOST_CANDIDATES = [
    "aws-0-ap-southeast-1.pooler.supabase.com",
    "aws-1-ap-southeast-1.pooler.supabase.com",
]
NEW_DB_PORT = "6543"
NEW_DB_USER = f"postgres.{NEW_PROJECT_REF}"
NEW_DB_NAME = "postgres"
NEW_DB_PASSWORD = "hoanghhk123."

S3_BUCKET = "cooksmart-yolo-models"  # reuse existing bucket
DUMP_KEY = "migration/dump-2026-07-10.dump"


def shell(cmd, **kw):
    print(f"+ {cmd[:200]}{'...' if len(cmd) > 200 else ''}")
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)


def find_backend_task():
    ecs = boto3.client("ecs", region_name=REGION)
    r = ecs.list_tasks(cluster=CLUSTER, serviceName=SERVICE)
    tasks = r["taskArns"]
    if not tasks:
        return None
    d = ecs.describe_tasks(cluster=CLUSTER, tasks=tasks)
    for t in d["tasks"]:
        if t["lastStatus"] == "RUNNING":
            return t["taskArn"], t["containerInstanceArn"], t.get("containers", [{}])[0].get("runtimeId")
    return None


def exec_on_task(task_arn, command, timeout=300):
    ecs = boto3.client("ecs", region_name=REGION)
    r = ecs.execute_command(
        cluster=CLUSTER,
        task=task_arn,
        container="cooksmart-backend",
        command=command,
        interactive=True,
    )
    print("ExecuteCommand response:", json.dumps(r, default=str)[:500])
    # The CLI output is harder to capture programmatically in this script.
    # Recommend using AWS CLI directly: see step2_dump_via_cli.sh


def main():
    # This script just prints the commands to run.
    print("=" * 60)
    print("Step 2: Dump Tokyo DB via ECS Exec")
    print("=" * 60)

    task = find_backend_task()
    if not task:
        print("No running backend task!")
        sys.exit(1)
    task_arn, _, _ = task
    print(f"Task: {task_arn}")

    # Enable ECS Exec
    print("\n1) Enable ECS Exec on service (one-time):")
    print(f"   aws ecs update-service --cluster {CLUSTER} --service {SERVICE} \\")
    print(f"     --enable-execute-command --region {REGION}")

    # Install postgres client in task (need apt or apk)
    print("\n2) Install postgres client in container:")
    print("   aws ecs execute-command ...")

    # Run pg_dump
    print("\n3) Run pg_dump in task:")
    dump_cmd = f"PGPASSWORD={OLD_DB_PASSWORD} pg_dump -h {OLD_DB_HOST} -p {OLD_DB_PORT} -U {OLD_DB_USER} -d {OLD_DB_NAME} --schema=public --no-owner --no-privileges -Fc -f /tmp/dump.tokyo"
    print(f"   {dump_cmd}")

    # Upload to S3
    print("\n4) Upload to S3:")
    print(f"   aws s3 cp /tmp/dump.tokyo s3://{S3_BUCKET}/{DUMP_KEY}")

    # Download in another task, restore
    print("\n5) Restore to new SG project:")
    restore_cmd = f"PGPASSWORD={NEW_DB_PASSWORD} pg_restore -h {NEW_DB_HOST_CANDIDATES[0]} -p {NEW_DB_PORT} -U {NEW_DB_USER} -d {NEW_DB_NAME} --no-owner --no-privileges --clean --if-exists -j 2 {DUMP_KEY}"
    print(f"   {restore_cmd}")


if __name__ == "__main__":
    main()