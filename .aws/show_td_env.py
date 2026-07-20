#!/usr/bin/env python3
"""Show env vars of an ECS task definition."""
import boto3
import sys

REGION = "ap-southeast-1"
task_def = sys.argv[1]
filters = sys.argv[2].split(",") if len(sys.argv) > 2 else ["yolo", "mlops", "cloud", "node_env", "database"]

c = boto3.client("ecs", region_name=REGION)
resp = c.describe_task_definition(taskDefinition=task_def)
env = resp["taskDefinition"]["containerDefinitions"][0]["environment"]
for e in env:
    name = e["name"].lower()
    if any(f in name for f in filters):
        print(f"{e['name']}={e['value']}")