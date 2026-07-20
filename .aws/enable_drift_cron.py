#!/usr/bin/env python3
"""Enable EventBridge rule to invoke Lambda `cooksmart-prod-v2-drift-job` every 6 hours.

Cross-platform: works on Windows + Linux. Idempotent.
"""
from __future__ import annotations

import json
import subprocess
import sys

REGION = "ap-southeast-1"
ACCOUNT_ID = "294060270105"
LAMBDA_NAME = "cooksmart-prod-v2-drift-job"
RULE_NAME = "cooksmart-prod-v2-drift-job-schedule"
ROLE_NAME = "cooksmart-drift-events-role"
POLICY_NAME = "InvokeDriftLambda"
SCHEDULE = "cron(0 */6 * * ? *)"

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
            "Resource": f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:{LAMBDA_NAME}",
        }
    ],
}

TARGET_SPEC = [
    {
        "Id": "1",
        "Arn": f"arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:{LAMBDA_NAME}",
        "RoleArn": f"arn:aws:iam::{ACCOUNT_ID}:role/{ROLE_NAME}",
        "Input": json.dumps({"action": "run"}),
    }
]


def run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess:
    print(f"  $ {' '.join(cmd[:6])}...")
    return subprocess.run(cmd, capture_output=True, text=True)


def ensure_role() -> str:
    print(f"[1/5] Ensuring IAM role {ROLE_NAME} ...")
    result = run(["aws", "iam", "get-role", "--role-name", ROLE_NAME, "--region", REGION], check=False)
    if result.returncode != 0:
        print("  -> creating")
        run(
            [
                "aws", "iam", "create-role",
                "--role-name", ROLE_NAME,
                "--assume-role-policy-document", json.dumps(ASSUME_ROLE_POLICY),
                "--region", REGION,
            ]
        )
    else:
        print("  -> already exists")

    # Always update inline policy (idempotent)
    run(
        [
            "aws", "iam", "put-role-policy",
            "--role-name", ROLE_NAME,
            "--policy-name", POLICY_NAME,
            "--policy-document", json.dumps(INVOKE_POLICY),
            "--region", REGION,
        ]
    )

    role_arn = run(["aws", "iam", "get-role", "--role-name", ROLE_NAME, "--region", REGION, "--query", "Role.Arn", "--output", "text"]).stdout.strip()
    print(f"  RoleArn: {role_arn}")
    return role_arn


def ensure_rule() -> None:
    print(f"[2/5] Creating EventBridge rule {RULE_NAME} ...")
    run(
        [
            "aws", "events", "put-rule",
            "--name", RULE_NAME,
            "--schedule-expression", SCHEDULE,
            "--state", "ENABLED",
            "--description", f"Trigger {LAMBDA_NAME} every 6 hours",
            "--region", REGION,
        ]
    )


def ensure_target(role_arn: str) -> None:
    print(f"[3/5] Setting Lambda target ...")
    targets_file = "drift-target.json"
    with open(targets_file, "w", encoding="utf-8") as f:
        json.dump(TARGET_SPEC, f)
    run(
        [
            "aws", "events", "put-targets",
            "--rule", RULE_NAME,
            "--targets", f"file://{targets_file}",
            "--region", REGION,
        ]
    )


def ensure_lambda_permission() -> None:
    print(f"[4/5] Adding Lambda invoke permission ...")
    result = run(
        [
            "aws", "lambda", "add-permission",
            "--function-name", LAMBDA_NAME,
            "--statement-id", f"AllowEventsFromRule-{RULE_NAME}",
            "--action", "lambda:InvokeFunction",
            "--principal", "events.amazonaws.com",
            "--source-arn", f"arn:aws:events:{REGION}:{ACCOUNT_ID}:rule/{RULE_NAME}",
            "--region", REGION,
        ],
        check=False,
    )
    if "already exists" in (result.stderr or ""):
        print("  -> permission already exists (OK)")
    else:
        print("  -> permission ensured")


def verify() -> None:
    print(f"[5/5] Verifying ...")
    print("  Rule:")
    rule = run(
        ["aws", "events", "describe-rule", "--name", RULE_NAME, "--region", REGION, "--query", "{name:Name,state:State,schedule:ScheduleExpression}", "--output", "json"]
    ).stdout.strip()
    print(f"  {rule}")
    print("  Targets:")
    targets = run(
        ["aws", "events", "list-targets-by-rule", "--rule", RULE_NAME, "--region", REGION, "--query", "Targets[*].{id:Id,arn:Arn,input:Input}", "--output", "json"]
    ).stdout.strip()
    print(f"  {targets}")


def test_invoke() -> None:
    print()
    print("[test] Manual invoke Lambda with payload {\"action\":\"run\"} ...")
    out_file = "drift-test-output.json"
    payload = json.dumps({"action": "run"})
    result = run(
        [
            "aws", "lambda", "invoke",
            "--function-name", LAMBDA_NAME,
            "--payload", payload,
            "--cli-binary-format", "raw-in-base64-out",
            "--region", REGION,
            out_file,
        ],
        check=False,
    )
    print(f"  Exit code: {result.returncode}")
    print(f"  Stderr: {(result.stderr or '').strip()}")
    try:
        with open(out_file, "r", encoding="utf-8") as f:
            body = f.read()
        print(f"  Output: {body}")
    except FileNotFoundError:
        print("  (no output file)")


def main() -> int:
    role_arn = ensure_role()
    ensure_rule()
    ensure_target(role_arn)
    ensure_lambda_permission()
    verify()
    test_invoke()
    print("\nDone.")
    return 0


if __name__ == "__main__":
    sys.exit(main())