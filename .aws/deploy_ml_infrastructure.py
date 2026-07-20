#!/usr/bin/env python3
"""Deploy ML training infrastructure to AWS.

This script creates all the necessary AWS resources for the ML training pipeline:
- CodePipeline
- CodeBuild projects
- CodeDeploy application
- IAM roles
- CloudWatch alarms
- EventBridge rules

Usage:
    python deploy_ml_infrastructure.py --region ap-southeast-1
    python deploy_ml_infrastructure.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

REGION = "ap-southeast-1"
ACCOUNT_ID = "294060270105"
PREFIX = "cooksmart"

SCRIPT_DIR = Path(__file__).parent


def run(cmd: List[str], check: bool = True, capture: bool = True) -> subprocess.CompletedProcess:
    """Run AWS CLI command."""
    print(f"  $ {' '.join(cmd[:5])}...")
    result = subprocess.run(
        cmd,
        capture_output=capture,
        text=True,
    )
    if check and result.returncode != 0:
        print(f"Error: {result.stderr}")
        sys.exit(1)
    return result


def create_iam_role(role_name: str, trust_policy: Dict, permissions_policy: Dict) -> str:
    """Create IAM role with trust and permissions policies."""
    print(f"\n[IAM] Creating role {role_name}...")

    # Check if role exists
    result = run(
        ["aws", "iam", "get-role", "--role-name", role_name, "--region", REGION],
        check=False,
        capture=True,
    )

    if result.returncode == 0:
        print(f"  Role already exists")
        role_arn = json.loads(result.stdout)["Role"]["Arn"]
    else:
        # Create role
        trust_doc = json.dumps(trust_policy)
        result = run([
            "aws", "iam", "create-role",
            "--role-name", role_name,
            "--assume-role-policy-document", trust_doc,
            "--region", REGION,
        ])
        role_arn = json.loads(result.stdout)["Role"]["Arn"]
        print(f"  Created role: {role_arn}")

    # Attach permissions
    permissions_doc = json.dumps(permissions_policy)
    result = run([
        "aws", "iam", "put-role-policy",
        "--role-name", role_name,
        "--policy-name", f"{role_name}-policy",
        "--policy-document", permissions_doc,
        "--region", REGION,
    ])
    print(f"  Policy attached")

    return role_arn


def create_codebuild_project(project_name: str, role_arn: str, buildspec: str) -> None:
    """Create CodeBuild project."""
    print(f"\n[CodeBuild] Creating project {project_name}...")

    # Check if project exists
    result = run(
        ["aws", "codebuild", "batch-get-projects", "--names", project_name],
        check=False,
        capture=True,
    )

    if result.returncode == 0 and json.loads(result.stdout).get("projects"):
        print(f"  Project already exists")
        return

    # Create project
    run([
        "aws", "codebuild", "create-project",
        "--name", project_name,
        "--description", f"ML Training project for {project_name}",
        "--service-role", role_arn,
        "--source", json.dumps({
            "type": "CODEPIPELINE",
        }),
        "--artifacts", json.dumps({
            "type": "CODEPIPELINE",
        }),
        "--environment", json.dumps({
            "type": "LINUX_CONTAINER",
            "image": "aws/codebuild/standard:7.0",
            "computeType": "BUILD_GENERAL1_MEDIUM",
        }),
        "--region", REGION,
    ])
    print(f"  Project created")


def create_codepipeline(pipeline_name: str, role_arn: str) -> None:
    """Create CodePipeline."""
    print(f"\n[CodePipeline] Creating pipeline {pipeline_name}...")

    # Check if pipeline exists
    result = run(
        ["aws", "codepipeline", "get-pipeline", "--name", pipeline_name],
        check=False,
        capture=True,
    )

    if result.returncode == 0:
        print(f"  Pipeline already exists")
        return

    # Read pipeline template
    pipeline_file = SCRIPT_DIR / "codepipeline-ml-training.json"
    if not pipeline_file.exists():
        print(f"  Warning: Pipeline template not found at {pipeline_file}")
        print(f"  Run 'aws codepipeline create-pipeline' manually")
        return

    with open(pipeline_file) as f:
        pipeline_config = json.load(f)

    # Create pipeline
    run([
        "aws", "codepipeline", "create-pipeline",
        "--pipeline", json.dumps(pipeline_config["pipeline"]),
        "--region", REGION,
    ])
    print(f"  Pipeline created")


def create_s3_bucket(bucket_name: str) -> None:
    """Create S3 bucket if it doesn't exist."""
    print(f"\n[S3] Checking bucket {bucket_name}...")

    result = run(
        ["aws", "s3", "ls", f"s3://{bucket_name}/"],
        check=False,
        capture=True,
    )

    if result.returncode == 0:
        print(f"  Bucket already exists")
    else:
        print(f"  Creating bucket...")
        run(["aws", "s3", "mb", f"s3://{bucket_name}", "--region", REGION])
        print(f"  Bucket created")


def create_dynamodb_table(table_name: str) -> None:
    """Create DynamoDB table for model versioning."""
    print(f"\n[DynamoDB] Checking table {table_name}...")

    result = run(
        ["aws", "dynamodb", "describe-table", "--table-name", table_name, "--region", REGION],
        check=False,
        capture=True,
    )

    if result.returncode == 0:
        print(f"  Table already exists")
        return

    print(f"  Creating table...")
    run([
        "aws", "dynamodb", "create-table",
        "--table-name", table_name,
        "--attribute-definitions", json.dumps([
            {"AttributeName": "PK", "AttributeType": "S"},
            {"AttributeName": "SK", "AttributeType": "S"},
        ]),
        "--key-schema", json.dumps([
            {"AttributeName": "PK", "KeyType": "HASH"},
            {"AttributeName": "SK", "KeyType": "RANGE"},
        ]),
        "--billing-mode", "PAY_PER_REQUEST",
        "--region", REGION,
    ])
    print(f"  Table created")


def create_cloudwatch_alarms() -> None:
    """Create CloudWatch alarms for deployment monitoring."""
    print(f"\n[CloudWatch] Creating alarms...")

    alarms = [
        {
            "name": f"{PREFIX}-prod-yolo-5xx-error-rate",
            "metric": "5xxErrorRate",
            "threshold": 0.05,
            "period": 300,
            "evaluation": 2,
            "comparison": "GreaterThanThreshold",
        },
        {
            "name": f"{PREFIX}-prod-yolo-p95-latency",
            "metric": "TargetResponseTime",
            "threshold": 3,
            "period": 60,
            "evaluation": 3,
            "comparison": "GreaterThanThreshold",
        },
    ]

    for alarm in alarms:
        print(f"  Creating alarm: {alarm['name']}...")

        # Check if alarm exists
        result = run(
            ["aws", "cloudwatch", "describe-alarms", "--alarm-names", alarm["name"], "--region", REGION],
            check=False,
            capture=True,
        )

        if result.returncode == 0 and json.loads(result.stdout).get("MetricAlarms"):
            print(f"    Already exists")
            continue

        # Create alarm
        run([
            "aws", "cloudwatch", "put-metric-alarm",
            "--alarm-name", alarm["name"],
            "--alarm-description", f"ML monitoring alarm: {alarm['metric']}",
            "--metric-name", alarm["metric"],
            "--namespace", f"{PREFIX.upper().replace('-', '_')}/MLOps",
            "--statistic", "Average",
            "--period", str(alarm["period"]),
            "--threshold", str(alarm["threshold"]),
            "--evaluation-periods", str(alarm["evaluation"]),
            "--comparison-operator", alarm["comparison"],
            "--alarm-actions", f"arn:aws:sns:{REGION}:{ACCOUNT_ID}:{PREFIX}-alerts",
            "--ok-actions", f"arn:aws:sns:{REGION}:{ACCOUNT_ID}:{PREFIX}-alerts",
            "--region", REGION,
        ])
        print(f"    Created")


def create_codedeploy_application() -> None:
    """Create CodeDeploy application."""
    print(f"\n[CodeDeploy] Creating application...")

    result = run(
        ["aws", "deploy", "get-application", "--application-name", f"{PREFIX}-yolo-app"],
        check=False,
        capture=True,
    )

    if result.returncode == 0:
        print(f"  Application already exists")
    else:
        run([
            "aws", "deploy", "create-application",
            "--application-name", f"{PREFIX}-yolo-app",
            "--compute-platform", "ECS",
            "--region", REGION,
        ])
        print(f"  Application created")


def create_eventbridge_rules() -> None:
    """Create EventBridge rules for drift detection."""
    print(f"\n[EventBridge] Creating rules...")

    # Run the existing drift cron setup
    print(f"  Running enable_drift_cron.py...")
    try:
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "enable_drift_cron.py")],
            check=True,
            cwd=SCRIPT_DIR,
        )
    except subprocess.CalledProcessError as e:
        print(f"  Warning: enable_drift_cron.py failed: {e}")

    # Run the drift-to-retrain setup
    print(f"  Running enable_drift_retrain.py...")
    try:
        subprocess.run(
            [sys.executable, str(SCRIPT_DIR / "enable_drift_retrain.py")],
            check=True,
            cwd=SCRIPT_DIR,
        )
    except subprocess.CalledProcessError as e:
        print(f"  Warning: enable_drift_retrain.py failed: {e}")


def deploy_dashboard() -> None:
    """Deploy CloudWatch dashboard."""
    print(f"\n[CloudWatch] Deploying dashboard...")

    dashboard_file = SCRIPT_DIR / "cloudwatch-mlops-dashboard-v2.json"
    if not dashboard_file.exists():
        print(f"  Dashboard file not found")
        return

    with open(dashboard_file) as f:
        dashboard_body = f.read()

    dashboard_name = f"{PREFIX}-mlops-dashboard-v2"

    result = run(
        ["aws", "cloudwatch", "get-dashboard", "--dashboard-name", dashboard_name, "--region", REGION],
        check=False,
        capture=True,
    )

    if result.returncode == 0:
        print(f"  Updating existing dashboard...")
        run([
            "aws", "cloudwatch", "put-dashboard",
            "--dashboard-name", dashboard_name,
            "--dashboard-body", dashboard_body,
            "--region", REGION,
        ])
    else:
        print(f"  Creating new dashboard...")
        run([
            "aws", "cloudwatch", "put-dashboard",
            "--dashboard-name", dashboard_name,
            "--dashboard-body", dashboard_body,
            "--region", REGION,
        ])
    print(f"  Dashboard deployed")


def main() -> int:
    parser = argparse.ArgumentParser(description="Deploy ML training infrastructure")
    parser.add_argument("--region", default=REGION, help="AWS region")
    parser.add_argument("--dry-run", action="store_true", help="Validate without creating resources")
    args = parser.parse_args()

    global REGION
    REGION = args.region

    print(f"=" * 60)
    print(f"CookSmart ML Training Infrastructure Deployment")
    print(f"Region: {REGION}")
    print(f"Dry run: {args.dry_run}")
    print(f"=" * 60)

    if args.dry_run:
        print("\n[DRY RUN] Would create the following resources:")
        print("  - IAM roles: codepipeline-ml-build-role, codepipeline-ml-training-role")
        print("  - CodeBuild projects: cooksmart-ml-validate, cooksmart-ml-train, etc.")
        print("  - CodePipeline: cooksmart-ml-training-pipeline")
        print("  - CodeDeploy: cooksmart-yolo-app")
        print("  - S3 buckets: cooksmart-models, cooksmart-training-data")
        print("  - DynamoDB: cooksmart-model-versions")
        print("  - CloudWatch: alarms and dashboard")
        print("  - EventBridge: drift cron and retrain rules")
        return 0

    # Create IAM roles
    trust_policy = {
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow", "Principal": {"Service": "codebuild.amazonaws.com"}, "Action": "sts:AssumeRole"}]
    }

    with open(SCRIPT_DIR / "codepipeline-ml-permissions.json") as f:
        permissions_policy = json.load(f)

    build_role_arn = create_iam_role(
        "codepipeline-ml-build-role",
        trust_policy,
        permissions_policy,
    )

    trust_policy_pipeline = {
        "Version": "2012-10-17",
        "Statement": [{"Effect": "Allow", "Principal": {"Service": "codepipeline.amazonaws.com"}, "Action": "sts:AssumeRole"}]
    }

    create_iam_role(
        "codepipeline-ml-training-role",
        trust_policy_pipeline,
        permissions_policy,
    )

    # Create S3 buckets
    create_s3_bucket("cooksmart-models")
    create_s3_bucket("cooksmart-training-data")

    # Create DynamoDB table
    create_dynamodb_table("cooksmart-model-versions")

    # Create CodeBuild projects
    codebuild_projects = [
        "cooksmart-ml-validate",
        "cooksmart-ml-train",
        "cooksmart-ml-test",
        "cooksmart-ml-integration-test",
        "cooksmart-ml-benchmark",
        "cooksmart-ml-register",
        "cooksmart-ml-staging-smoke",
        "cooksmart-ml-promote-alias",
    ]

    for project in codebuild_projects:
        create_codebuild_project(project, build_role_arn, f"mlops/buildspec/{project.replace('cooksmart-ml-', '')}.yml")

    # Create CodePipeline
    create_codepipeline("cooksmart-ml-training-pipeline", build_role_arn)

    # Create CodeDeploy application
    create_codedeploy_application()

    # Create CloudWatch alarms
    create_cloudwatch_alarms()

    # Create EventBridge rules
    create_eventbridge_rules()

    # Deploy dashboard
    deploy_dashboard()

    print("\n" + "=" * 60)
    print("Deployment completed successfully!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Configure GitHub Actions secrets:")
    print("   - AWS_ACCESS_KEY_ID")
    print("   - AWS_SECRET_ACCESS_KEY")
    print("   - WANDB_API_KEY")
    print("   - DRIFT_URL")
    print("2. Update CodePipeline with GitHub connection")
    print("3. Trigger a test pipeline run")

    return 0


if __name__ == "__main__":
    sys.exit(main())
