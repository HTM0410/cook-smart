"""Read CloudWatch logs safely."""
import os
import sys
import json
import subprocess

os.environ["PYTHONIOENCODING"] = "utf-8"

query_id = sys.argv[1] if len(sys.argv) > 1 else "4b1b22a3-7b64-4ea1-8f95-5aeff8484110"
log_group = sys.argv[2] if len(sys.argv) > 2 else "/ecs/cooksmart-backend"
minutes = sys.argv[3] if len(sys.argv) > 3 else "15"

import time
end = int(time.time())
start = end - (int(minutes) * 60)

start_q = subprocess.run(
    ["aws", "logs", "start-query", "--log-group-names", log_group,
     "--start-time", str(start), "--end-time", str(end),
     "--query-string", "fields @message | sort @timestamp desc | limit 50",
     "--region", "ap-southeast-1", "--output", "json"],
    capture_output=True,
    env={**os.environ, "PYTHONIOENCODING": "utf-8"},
)
data = json.loads(start_q.stdout)
qid = data.get("queryId")
print(f"Query: {qid}")

for _ in range(10):
    time.sleep(3)
    r = subprocess.run(
        ["aws", "logs", "get-query-results", "--query-id", qid,
         "--region", "ap-southeast-1", "--output", "json"],
        capture_output=True,
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )
    try:
        res = json.loads(r.stdout)
    except Exception:
        continue
    status = res.get("status", "Unknown")
    print(f"Status: {status}, results: {len(res.get('results', []))}")
    if status == "Complete":
        for row in res.get("results", []):
            for f in row:
                if f["field"] == "@message":
                    print(f["value"])
        break