#!/usr/bin/env python3
"""Create CloudWatch dashboard + SNS topic + alarms for CookSmart MLOps."""
from __future__ import annotations

import json
import subprocess
import sys

REGION = "ap-southeast-1"
ACCOUNT_ID = "294060270105"
DASHBOARD_NAME = "cooksmart-mlops-prod"
SNS_TOPIC_NAME = "cooksmart-mlops-alerts"
LAMBDA_DRIFT = "cooksmart-prod-v2-drift-job"
DYNAMODB_TABLE = "cooksmart-model-versions"
S3_BUCKET = "cooksmart-models"


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, check=check)


def ensure_sns_topic() -> str:
    print(f"[sns] Ensuring SNS topic {SNS_TOPIC_NAME} ...")
    result = run(["aws", "sns", "create-topic", "--name", SNS_TOPIC_NAME, "--region", REGION], check=False)
    data = json.loads(result.stdout) if result.stdout.strip().startswith("{") else {}
    arn = data.get("TopicArn") or f"arn:aws:sns:{REGION}:{ACCOUNT_ID}:{SNS_TOPIC_NAME}"
    print(f"  ARN: {arn}")
    return arn


def create_dashboard() -> None:
    print(f"[dashboard] Creating {DASHBOARD_NAME} ...")
    with open("d:/2025.2/DA/food_suggest/.aws/cloudwatch-mlops-dashboard.json", "r", encoding="utf-8") as f:
        body = f.read()
    run(
        [
            "aws", "cloudwatch", "put-dashboard",
            "--dashboard-name", DASHBOARD_NAME,
            "--dashboard-body", body,
            "--region", REGION,
        ]
    )
    print("  Dashboard created.")


def put_alarm(name: str, description: str, metric_spec: list, threshold: float, comparison: str, sns_arn: str, evaluation_periods: int = 3, period: int = 300) -> None:
    print(f"[alarm] {name}: {description}")
    cmd = [
        "aws", "cloudwatch", "put-metric-alarm",
        "--alarm-name", name,
        "--alarm-description", description,
        "--region", REGION,
        "--evaluation-periods", str(evaluation_periods),
        "--period", str(period),
        "--threshold", str(threshold),
        "--comparison-operator", comparison,
        "--treat-missing-data", "notBreaching",
        "--alarm-actions", sns_arn,
    ]
    # metric_spec: list of [namespace, metric_name, ...dimensions]
    cmd += ["--namespace", metric_spec[0], "--metric-name", metric_spec[1]]
    dims = []
    for i in range(2, len(metric_spec), 2):
        dims.append({"Name": metric_spec[i], "Value": metric_spec[i + 1]})
    if dims:
        cmd += ["--dimensions", json.dumps(dims)]
    if "p95" in name.lower():
        cmd += ["--statistic", "ExtendedStatistic", "--extended-statistic", "p95"]
    else:
        cmd += ["--statistic", "Sum"]
    run(cmd)


def create_alarms(topic_arn: str) -> None:
    # 1. DynamoDB throttle
    put_alarm(
        name="cooksmart-mlops-dynamodb-throttle",
        description="DynamoDB model-versions throttle > 5 in 5 min",
        metric_spec=["AWS/DynamoDB", "ThrottledRequests", "TableName", DYNAMODB_TABLE],
        threshold=5,
        comparison="GreaterThanThreshold",
        sns_arn=topic_arn,
        evaluation_periods=1,
        period=300,
    )
    # 2. S3 5xx errors
    put_alarm(
        name="cooksmart-mlops-s3-5xx",
        description="S3 cooksmart-models 5xx errors > 0",
        metric_spec=["AWS/S3", "5xxErrors", "BucketName", S3_BUCKET],
        threshold=0,
        comparison="GreaterThanThreshold",
        sns_arn=topic_arn,
        evaluation_periods=1,
        period=300,
    )
    # 3. Lambda drift-job errors
    put_alarm(
        name="cooksmart-mlops-drift-errors",
        description="Lambda drift-job errors > 0 in 3 hours",
        metric_spec=["AWS/Lambda", "Errors", "FunctionName", LAMBDA_DRIFT],
        threshold=0,
        comparison="GreaterThanThreshold",
        sns_arn=topic_arn,
        evaluation_periods=1,
        period=21600,  # 6h
    )
    # 4. ECS YOLO service running task count
    put_alarm(
        name="cooksmart-mlops-yolo-no-running-tasks",
        description="YOLO service running tasks < 1",
        metric_spec=["AWS/ECS", "RunningTaskCount", "ServiceName", "cooksmart-prod-v2-yolo-svc", "ClusterName", "cooksmart-prod-v2"],
        threshold=1,
        comparison="LessThanThreshold",
        sns_arn=topic_arn,
        evaluation_periods=2,
        period=60,
    )
    # 5. ECS Backend service running task count
    put_alarm(
        name="cooksmart-mlops-backend-no-running-tasks",
        description="Backend service running tasks < 1",
        metric_spec=["AWS/ECS", "RunningTaskCount", "ServiceName", "cooksmart-backend", "ClusterName", "cooksmart-prod-v2"],
        threshold=1,
        comparison="LessThanThreshold",
        sns_arn=topic_arn,
        evaluation_periods=2,
        period=60,
    )


def main() -> int:
    topic_arn = ensure_sns_topic()
    create_dashboard()
    create_alarms(topic_arn)
    print("\nDone.")
    print(f"SNS topic: {topic_arn}")
    print(f"Dashboard: https://{REGION}.console.aws.amazon.com/cloudwatch/home?region={REGION}#dashboards:name={DASHBOARD_NAME}")
    return 0


if __name__ == "__main__":
    sys.exit(main())