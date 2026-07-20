"""Read backend CloudWatch logs directly (handles bad encoding)."""
import os
import sys
import json
import subprocess

os.environ["PYTHONIOENCODING"] = "utf-8"

log_group = "/ecs/cooksmart-backend"

r = subprocess.run(
    ["aws", "logs", "describe-log-streams",
     "--log-group-name", log_group, "--region", "ap-southeast-1",
     "--order-by", "LastEventTime", "--descending",
     "--max-items", "3", "--output", "json"],
    capture_output=True, env=os.environ,
)
streams = json.loads(r.stdout).get("logStreams", [])
for s in streams:
    name = s["logStreamName"]
    print(f"=== Stream: {name} last={s.get('lastEventTimestamp')} ===")
    # Use text output to bypass JSON encoding issues
    r2 = subprocess.run(
        ["aws", "logs", "get-log-events",
         "--log-group-name", log_group, "--log-stream-name", name,
         "--region", "ap-southeast-1", "--limit", "30", "--output", "text"],
        capture_output=True, env=os.environ,
    )
    out = r2.stdout.decode("utf-8", errors="replace")
    lines = out.split("\n")
    print(f"  lines: {len(lines)}")
    for ln in lines[-40:]:
        if ln.strip():
            print(f"  > {ln[:300]}")