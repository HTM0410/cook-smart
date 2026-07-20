#!/usr/bin/env python3
"""Show last 30 log events from a specific log stream (handles encoding edge cases)."""
import subprocess
import json
import sys

REGION = "ap-southeast-1"
LOG_GROUP = "/ecs/cooksmart-backend"
LOG_STREAM = sys.argv[1] if len(sys.argv) > 1 else "ecs/cooksmart-backend/340c41bdbb2e480aa50caea1a22e3fdb"
OUT_FILE = "d:/2025.2/DA/food_suggest/.aws/raw-events.json"

# Run aws command, redirect stdout to binary file via subprocess.Popen to avoid PowerShell rewrapping
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

# Read raw bytes
with open(OUT_FILE, "rb") as f:
    raw = f.read()

# Strip BOM
for bom in (b"\xef\xbb\xbf", b"\xff\xfe", b"\xfe\xff"):
    if raw.startswith(bom):
        raw = raw[len(bom):]
        break

text = raw.decode("utf-8", errors="replace")
# Strip all non-ASCII (handles emojis that break JSON parsing on some platforms)
text = text.encode("ascii", "replace").decode("ascii")
data = json.loads(text)

events = data.get("events", [])
print(f"Total events: {len(events)}")
print(f"--- Last 25 events ---")
for e in events[-25:]:
    msg = e["message"].encode("ascii", "replace").decode("ascii")
    print(msg[:300])