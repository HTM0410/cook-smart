#!/usr/bin/env python3
import json
import sys
path = sys.argv[1]
filters = sys.argv[2].split(",") if len(sys.argv) > 2 else ["yolo", "mlops", "cloud", "node_env"]
d = json.load(open(path))
for env in d:
    name = env.get("name", "").lower()
    if any(f in name for f in filters):
        print(f"{env['name']}={env['value']}")