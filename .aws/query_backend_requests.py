#!/usr/bin/env python3
"""Query ALL Backend request logs."""
import subprocess
import json
import time

REGION = "ap-southeast-1"
query = (
    "fields @timestamp, @message "
    "| filter @message like /Request completed/ "
    "| sort @timestamp desc "
    "| limit 30"
)

start = int(time.time()) - 1800
end = int(time.time())

r = subprocess.run(
    [
        "aws", "logs", "start-query",
        "--log-group-name", "/ecs/cooksmart-backend",
        "--start-time", str(start),
        "--end-time", str(end),
        "--query-string", query,
        "--region", REGION,
    ],
    capture_output=True, text=True,
)
qid = json.loads(r.stdout)["queryId"]

for _ in range(15):
    time.sleep(2)
    r2 = subprocess.run(
        ["aws", "logs", "get-query-results", "--query-id", qid, "--region", REGION],
        capture_output=True, text=True,
    )
    data = json.loads(r2.stdout)
    if data.get("status") == "Complete":
        break

results = data.get("results", [])
print(f"Request logs in last 30 min: {len(results)}")
for row in results:
    for f in row:
        if f["field"] == "@message":
            msg = f["value"].encode("ascii", "replace").decode("ascii")
            if "/api/yolo" in msg or "404" in msg:
                print(msg[:300])