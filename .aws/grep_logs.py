#!/usr/bin/env python3
"""Show last N log events from a specific stream (Windows-safe)."""
import subprocess
import json
import sys
import time

REGION = "ap-southeast-1"
LOG_GROUP = "/ecs/cooksmart-backend"
LOG_STREAM = sys.argv[1]
N = int(sys.argv[2]) if len(sys.argv) > 2 else 20

# Use awscli with proper output encoding handling
result = subprocess.run(
    [
        "aws", "logs", "tail", LOG_GROUP,
        "--region", REGION,
        "--format", "short",
        "--since", "10m",
    ],
    capture_output=True,
)

# Decode ignoring errors (PowerShell can rewrap)
text = result.stdout.decode("utf-8", errors="replace")
# Strip ANSI colors
import re
text = re.sub(r"\x1b\[[0-9;]*m", "", text)
lines = [l for l in text.split("\n") if LOG_STREAM in l or "api/yolo" in l]
print(f"Total lines mentioning {LOG_STREAM} or api/yolo: {len(lines)}")
for line in lines[-N:]:
    print(line[:300])