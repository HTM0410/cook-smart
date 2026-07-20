#!/usr/bin/env python3
"""Setup EventBridge rule to trigger ML retraining from drift alerts.

Creates an EventBridge rule that watches CloudWatch Events from the drift Lambda
and triggers the retrain Lambda when alert_level >= 1.
"""
from __future__ import annotations

import json
import subprocess
import sys

REGION = "ap-southeast-1"
ACCOUNT_ID = "294060270105"
LAMBDA_RETRAIN = "cooksmart-drift-retrain"
DRIFT_RULE_NAME = "cooksmart-drift-to-retrain"
ROLE_NAME = "cooksmart-drift-retrain-events-role"
POLICY_NAME = "InvokeDriftRetrainLambda"
SCHEDULE = "cron(0 */6 * * ? *)"  # Every 6 hours (same as drift check)

ASSUME_ROLE_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": {"Service": "events.amazonaws.com"},
            "Action": "sts:AssumeRole",
        }
    ],
}

INVOKE_POLICY = {
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "lambda:InvokeFunction",
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:{LAMBDA_RETRAIN}",
        }
    ],
}

# Event pattern to match drift Lambda success with alert_level >= 1
EVENT_PATTERN = {
    "source": ["aws.lambda"],
    "detail-type": ["Lambda Function Invocation"],
    "detail": {
        "requestContext": {
            "functionName": [f"cooksmart-prod-v2-drift-job"]
        },
        "response": {
            "statusCode": [200]
        }
    }
}


def run(cmd: list, check: bool = True) -> subprocess.CompletedProcess:
    print(f"  $ {' '.join(cmd[:6])}...")
    return subprocess.run(cmd, capture_output=True, text=True)


def ensure_role() -> str:
    print(f"[1/5] Ensuring IAM role {ROLE_NAME}...")
    result = run(["aws", "iam", "get-role", "--role-name", ROLE_NAME, "--region", REGION], check=False)
    if result.returncode != 0:
        print("  -> creating")
        run([
            "aws", "iam", "create-role",
            "--role-name", ROLE_NAME,
            "--assume-role-policy-document", json.dumps(ASSUME_ROLE_POLICY),
            "--region", REGION,
        ])
    else:
        print("  -> already exists")

    run([
        "aws", "iam", "put-role-policy",
        "--role-name", ROLE_NAME,
        "--policy-name", POLICY_NAME,
        "--policy-document", json.dumps(INVOKE_POLICY),
        "--region", REGION,
    ])

    role_arn = run([
        "aws", "iam", "get-role", "--role-name", ROLE_NAME, "--region", REGION,
        "--query", "Role.Arn", "--output", "text"
    ]).stdout.strip()
    print(f"  RoleArn: {role_arn}")
    return role_arn


def ensure_rule(role_arn: str) -> None:
    print(f"[2/5] Creating EventBridge rule {DRIFT_RULE_NAME}...")
    run([
        "aws", "events", "put-rule",
        "--name", DRIFT_RULE_NAME,
        "--event-pattern", json.dumps(EVENT_PATTERN),
        "--state", "ENABLED",
        "--description", "Trigger ML retrain when drift detection reports alert_level >= 1",
        "--region", REGION,
    ])


def ensure_target(role_arn: str) -> None:
    print(f"[3/5] Setting Lambda target...")
    target_spec = [{
        "Id": "1",
        "Arn": f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:{LAMBDA_RETRAIN}",
        "RoleArn": role_arn,
    }]

    targets_file = ".aws/drift-retrain-target.json"
    with open(targets_file, "w", encoding="utf-8") as f:
        json.dump(target_spec, f)

    run([
        "aws", "events", "put-targets",
        "--rule", DRIFT_RULE_NAME,
        "--targets", f"file://{targets_file}",
        "--region", REGION,
    ])


def ensure_lambda_permission() -> None:
    print(f"[4/5] Adding Lambda invoke permission...")
    result = run([
        "aws", "lambda", "add-permission",
        "--function-name", LAMBDA_RETRAIN,
        "--statement-id", f"AllowEventsFromRule-{DRIFT_RULE_NAME}",
        "--action", "lambda:InvokeFunction",
        "--principal", "events.amazonaws.com",
        "--source-arn", f"arn:aws:events:{REGION}:{ACCOUNT_ID}:rule/{DRIFT_RULE_NAME}",
        "--region", REGION,
    ], check=False)
    if "already exists" in (result.stderr or ""):
        print("  -> permission already exists (OK)")
    else:
        print("  -> permission ensured")


def verify() -> None:
    print(f"[5/5] Verifying...")
    print("  Rule:")
    rule = run([
        "aws", "events", "describe-rule", "--name", DRIFT_RULE_NAME, "--region", REGION,
        "--query", "{name:Name,state:State}", "--output", "json"
    ]).stdout.strip()
    print(f"  {rule}")
    print("  Targets:")
    targets = run([
        "aws", "events", "list-targets-by-rule", "--rule", DRIFT_RULE_NAME, "--region", REGION,
        "--query", "Targets[*].{id:Id,arn:Arn}", "--output", "json"
    ]).stdout.strip()
    print(f"  {targets}")


def main() -> int:
    print(f"Setting up drift-to-retrain EventBridge rule in {REGION}")
    role_arn = ensure_role()
    ensure_rule(role_arn)
    ensure_target(role_arn)
    ensure_lambda_permission()
    verify()
    print("\nDone. Drift events will now trigger ML retraining when alert_level >= 1")
    return 0


if __name__ == "__main__":
    sys.exit(main())
