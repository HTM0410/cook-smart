#!/usr/bin/env python3
"""Deploy an ECS service to a specific task definition revision."""
import subprocess
import sys

REGION = "ap-southeast-1"
CLUSTER = "cooksmart-prod-v2"
SERVICE = sys.argv[1]
TASKDEF = sys.argv[2]

print(f"[deploy] Updating service {SERVICE} -> {TASKDEF}")
subprocess.run(
    [
        "aws", "ecs", "update-service",
        "--cluster", CLUSTER,
        "--service", SERVICE,
        "--task-definition", TASKDEF,
        "--force-new-deployment",
        "--region", REGION,
    ],
    check=True,
)

print(f"[deploy] Waiting for stable...")
subprocess.run(
    ["aws", "ecs", "wait", "services-stable", "--cluster", CLUSTER, "--services", SERVICE, "--region", REGION],
    check=True,
)

print(f"[deploy] Final state:")
subprocess.run(
    [
        "aws", "ecs", "describe-services",
        "--cluster", CLUSTER,
        "--services", SERVICE,
        "--region", REGION,
        "--query", "services[0].{status:status,running:runningCount,desired:desiredCount,taskDef:taskDefinition}",
        "--output", "json",
    ]
)