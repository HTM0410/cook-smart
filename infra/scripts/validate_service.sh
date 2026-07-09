#!/bin/bash
# =============================================================================
# Validate YOLO Green Service truoc khi CodeDeploy switch traffic
# Chay 30 lan, moi 10s, kiem tra /health/detailed cua ALB test listener.
# Tra ve 0 neu thanh cong, 1 neu fail.
# =============================================================================

set -euo pipefail

# GREEN_ENDPOINT duoc truyen qua CodeDeploy envvar (port 9000 cua ALB)
GREEN_ENDPOINT="${GREEN_ENDPOINT:-http://localhost:8000}"

echo "=== Validate YOLO Green Service ==="
echo "Endpoint: ${GREEN_ENDPOINT}"

EXPECT_CLASS_COUNT=59

for i in {1..30}; do
  echo "Attempt ${i}/30..."

  RESPONSE=$(curl -fsS "${GREEN_ENDPOINT}/health/detailed" 2>/dev/null || echo "")

  if [ -n "$RESPONSE" ]; then
    # Parse JSON thu cong (khong can jq tren ECS task image)
    if echo "$RESPONSE" | grep -q '"model_loaded"\s*:\s*true'; then
      if echo "$RESPONSE" | grep -q '"schema_compatible"\s*:\s*true'; then
        CLASS_COUNT=$(echo "$RESPONSE" | grep -oP '"class_count"\s*:\s*\K\d+' || echo "0")
        if [ "${CLASS_COUNT}" = "${EXPECT_CLASS_COUNT}" ]; then
          echo "OK: green service ready (class_count=${CLASS_COUNT})"
          exit 0
        else
          echo "WRONG CLASS COUNT: expected=${EXPECT_CLASS_COUNT}, got=${CLASS_COUNT}"
        fi
      else
        echo "SCHEMA_NOT_COMPATIBLE"
      fi
    else
      echo "MODEL_NOT_LOADED"
    fi
  fi

  sleep 10
done

echo "ERROR: green service failed validation after 5 minutes"
exit 1
