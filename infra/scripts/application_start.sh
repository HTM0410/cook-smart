#!/bin/bash
set -euo pipefail
echo "=== ApplicationStart: check service responding on green ==="
curl -fsS --max-time 10 "${GREEN_ENDPOINT:-http://localhost:8000}/health" || {
  echo "ERROR: green service not responding"
  exit 1
}
echo "Green service responding to /health"
