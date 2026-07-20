#!/usr/bin/env python3
"""
Run pg_dump and pg_restore via one-off ECS Fargate tasks.

Strategy:
1. Task A (Fargate, with postgres client):
   - Download postgres image (or use amazon/aws-cli with s3)
   - pg_dump Tokyo → S3
2. Task B (Fargate, with postgres client):
   - pg_restore from S3 → Singapore

But for Fargate, we can't have a "postgres client" image directly.
We can use the postgres image and run the postgres client tools.

Simpler: use a one-off EC2 SSM command via ECS Exec on a running task.
But ECS Exec requires ecs-execute-command IAM role.

Simplest of all: use Python's psycopg2 inside the existing backend container.
"""
import os
import sys
import json
import subprocess
import time

REGION = "ap-southeast-1"
CLUSTER = "cooksmart-prod-v2"
SERVICE = "cooksmart-backend"
TASK_FAMILY = "cooksmart-backend-task"
SUBNET_1 = "subnet-0bfbfaa1b84106896"  # 1b
SUBNET_2 = "subnet-0bb2d6f726fa3fc41"  # 1a
SG = "sg-026fa02fe8e303357"  # same as backend
EXEC_ROLE = "arn:aws:iam::294060270105:role/ecsTaskExecutionRole"

OLD_HOST = "aws-1-ap-northeast-1.pooler.supabase.com"
OLD_PORT = "6543"
OLD_USER = "postgres.hcswzmpqkhtqdwbhevqb"
OLD_PASS = "hoanghhk123."
OLD_DB = "postgres"

NEW_PROJECT_REF = "dbdsrdtofmhlluxgrfok"
# Try aws-0 first, fallback to aws-1
NEW_HOST = "aws-0-ap-southeast-1.pooler.supabase.com"
NEW_PORT = "6543"
NEW_USER = f"postgres.{NEW_PROJECT_REF}"
NEW_PASS = "hoanghhk123."
NEW_DB = "postgres"

S3_BUCKET = "cooksmart-yolo-models"
DUMP_KEY = "migration/dump-2026-07-10.dump"
S3_URI = f"s3://{S3_BUCKET}/{DUMP_KEY}"


def sh(cmd, **kw):
    print(f"\n+ {cmd[:300]}")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, **kw)
    if r.stdout:
        print(r.stdout)
    if r.stderr:
        print("STDERR:", r.stderr, file=sys.stderr)
    return r.returncode, r.stdout, r.stderr


def run_in_container(task_arn, command, timeout=1800):
    """Run a shell command in a running ECS task via ECS Exec."""
    full_cmd = (
        f'aws ecs execute-command --cluster {CLUSTER} '
        f'--task {task_arn.split("/")[-1]} '
        f'--container cooksmart-backend '
        f'--command "{command}" '
        f'--interactive '
        f'--region {REGION}'
    )
    return sh(full_cmd, timeout=timeout)


def find_running_task():
    code, out, _ = sh(
        f'aws ecs list-tasks --cluster {CLUSTER} --service-name {SERVICE} --region {REGION} --query "taskArns[0]" --output text'
    )
    if code != 0 or not out.strip():
        return None
    return out.strip()


def enable_exec():
    print("\n=== Enable ECS Exec on service ===")
    sh(
        f'aws ecs update-service --cluster {CLUSTER} --service {SERVICE} '
        f'--enable-execute-command --force-new-deployment --region {REGION}'
    )


def install_pg_client(task_arn):
    """Install postgresql-client in backend container."""
    # Backend image is node:alpine. Use apk.
    cmd = "apk add --no-cache postgresql-client 2>&1 | tail -5"
    print("\n=== Install postgresql-client ===")
    run_in_container(task_arn, cmd, timeout=300)


def dump_tokyo(task_arn):
    """Run pg_dump in the container, upload to S3."""
    print("\n=== pg_dump Tokyo ===")
    dump_cmd = (
        f"PGPASSWORD='{OLD_PASS}' pg_dump "
        f"-h {OLD_HOST} -p {OLD_PORT} -U {OLD_USER} -d {OLD_DB} "
        f"--schema=public --no-owner --no-privileges --clean --if-exists "
        f"-Fc -f /tmp/dump.tokyo 2>&1 | tail -20"
    )
    run_in_container(task_arn, dump_cmd, timeout=900)

    # Check size
    run_in_container(task_arn, "ls -lh /tmp/dump.tokyo", timeout=10)

    # Upload to S3
    print("\n=== Upload to S3 ===")
    run_in_container(
        task_arn,
        f"aws s3 cp /tmp/dump.tokyo {S3_URI} --region {REGION} 2>&1 | tail -10",
        timeout=300,
    )


def download_dump_in_new_task():
    """Run a new Fargate task to download dump and restore to SG."""
    print("\n=== Run restore in new task ===")
    # Use postgres image which has psql + pg_dump
    cmd_body = (
        f"bash -c \""
        f"PGPASSWORD='{NEW_PASS}' pg_restore "
        f"-h {NEW_HOST} -p {NEW_PORT} -U {NEW_USER} -d {NEW_DB} "
        f"--no-owner --no-privileges --clean --if-exists -j 2 "
        f"--list 2>&1 | head -30; "
        f"echo '--- RESTORE ---'; "
        f"PGPASSWORD='{NEW_PASS}' pg_restore "
        f"-h {NEW_HOST} -p {NEW_PORT} -U {NEW_USER} -d {NEW_DB} "
        f"--no-owner --no-privileges --clean --if-exists -j 2 "
        f"-d {NEW_DB} 2>&1 | tail -30"
        f"\""
    )
    print(cmd_body)
    print("(Manual run needed - see step3_run_restore.sh)")


def main():
    print("=" * 60)
    print("Step 2: Run pg_dump via ECS Exec on backend task")
    print("=" * 60)

    # 1. Enable ECS Exec
    enable_exec()
    print("Waiting 60s for service to update...")
    time.sleep(60)

    # 2. Find a running task
    task_arn = find_running_task()
    if not task_arn:
        print("No running task!")
        sys.exit(1)
    print(f"Found task: {task_arn}")

    # 3. Install postgresql-client
    install_pg_client(task_arn)

    # 4. Dump Tokyo
    dump_tokyo(task_arn)

    print("\n=== Done. Next: run restore in new task ===")


if __name__ == "__main__":
    main()