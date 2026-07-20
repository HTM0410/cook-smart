#!/usr/bin/env python3
"""Query Backend logs for YOLO controller activity."""
import subprocess
import json
import time
import sys

LOG_GROUP = "/ecs/cooksmart-backend"
REGION = "ap-southeast-1"
MINUTES = int(sys.argv[1]) if len(sys.argv) > 1 else 5

# Match any yolo-related log in backend
query = (
    "fields @timestamp, @message "
    "| filter @message like /yoloController/ or @message like /YoloService/ or @message like /YoloService.*error/ or @message like /api.yolo/ "
    "| sort @timestamp desc "
    "| limit 30"
)

start = int(time.time()) - MINUTES * 60
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
print(f"Results in last {MINUTES} min: {len(results)}")
for row in results:
    for f in row:
        if f["field"] == "@message":
            msg = f["value"].encode("ascii", "replace").decode("ascii")
            print(msg[:300])