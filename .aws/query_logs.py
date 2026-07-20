#!/usr/bin/env python3
"""Query CloudWatch Logs Insights for yolo-related events."""
import subprocess
import json
import time
import sys

LOG_GROUP = "/ecs/cooksmart-backend"
REGION = "ap-southeast-1"
WINDOW = int(sys.argv[1]) if len(sys.argv) > 1 else 1800  # 30 min default

query = (
    "fields @timestamp, @message "
    "| filter @message like /api.yolo/ or @message like /yoloService/ or @message like /YoloService/ "
    "| sort @timestamp desc "
    "| limit 30"
)

start = int(time.time()) - WINDOW
end = int(time.time())

r = subprocess.run(
    [
        "aws", "logs", "start-query",
        "--log-group-name", LOG_GROUP,
        "--start-time", str(start),
        "--end-time", str(end),
        "--query-string", query,
        "--region", REGION,
    ],
    capture_output=True, text=True,
)
qid = json.loads(r.stdout)["queryId"]
print(f"Query ID: {qid}")

# Poll until complete
for _ in range(15):
    time.sleep(2)
    r2 = subprocess.run(
        ["aws", "logs", "get-query-results", "--query-id", qid, "--region", REGION],
        capture_output=True, text=True,
    )
    data = json.loads(r2.stdout)
    status = data.get("status", "")
    if status == "Complete":
        break

results = data.get("results", [])
print(f"Results: {len(results)}")
for row in results:
    for f in row:
        if f["field"] == "@message":
            msg = f["value"].encode("ascii", "replace").decode("ascii")
            print(msg[:280])