#!/usr/bin/env python3
"""Fetch log events bypassing PowerShell encoding issues."""
import subprocess
import json
import sys

REGION = "ap-southeast-1"
LOG_GROUP = "/ecs/cooksmart-backend"
LOG_STREAM = sys.argv[1]
OUT_FILE = "d:/2025.2/DA/food_suggest/.aws/stream-events.json"

with open(OUT_FILE, "wb") as f:
    result = subprocess.run(
        [
            "aws", "logs", "get-log-events",
            "--log-group-name", LOG_GROUP,
            "--log-stream-name", LOG_STREAM,
            "--region", REGION,
            "--start-from-head",
        ],
        stdout=f,
        stderr=subprocess.PIPE,
    )

with open(OUT_FILE, "rb") as f:
    raw = f.read()

text = raw.decode("utf-8", errors="replace")
text = text.encode("ascii", "replace").decode("ascii")

try:
    data = json.loads(text)
except json.JSONDecodeError:
    print(f"Decode error at char 95 - log stream likely contains chars that crash JSON parse")
    print(f"File size: {len(raw)} bytes")
    print(f"First 150 bytes: {raw[:150]!r}")
    sys.exit(1)

events = data.get("events", [])
print(f"Total events: {len(events)}")
print(f"--- Last 15 ---")
for e in events[-15:]:
    msg = e["message"].encode("ascii", "replace").decode("ascii")
    print(msg[:280])