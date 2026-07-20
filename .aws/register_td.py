#!/usr/bin/env python3
"""Register ECS task definition from JSON file via boto3."""
import sys
import json
import boto3

REGION = "ap-southeast-1"

path = sys.argv[1]
with open(path, encoding="utf-8") as f:
    td = json.load(f)

c = boto3.client("ecs", region_name=REGION)
resp = c.register_task_definition(**td)
d = resp["taskDefinition"]
print(f"Registered: {d['family']}:{d['revision']}")
print(f"  taskRoleArn: {d.get('taskRoleArn')}")