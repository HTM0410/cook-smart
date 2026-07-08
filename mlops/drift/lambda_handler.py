from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger("drift_lambda_handler")

# Drift service duoc goi theo 2 cach:
# 1. EventBridge scheduled event -> payload {"action": "run"} -> handler chay drift job
# 2. HTTP qua API Gateway / web-adapter (cho manual trigger) -> POST /drift/run
#
# Khi EventBridge invoke, web-adapter se khong co HTTP request, nen handler nay
# can tu goi drift logic va emit CloudWatch EMF metrics.


def _run_scheduled_drift() -> dict:
    """Chay drift job truc tiep (khong qua HTTP) va tra ve summary."""
    try:
        from drift.service import run_drift, DriftRunRequest
    except ImportError as exc:
        logger.error("Cannot import drift service: %s", exc)
        return {"status": "error", "error": str(exc)}

    try:
        req = DriftRunRequest(
            window="1h",
            channels=["data", "concept", "prediction"],
        )
        result = run_drift(req)
        return {
            "status": "ok",
            "alert_level": result.alert_level,
            "duration_seconds": result.duration_seconds,
            "timestamp": result.timestamp,
        }
    except Exception as exc:  # noqa: BLE001
        logger.exception("Drift run failed: %s", exc)
        return {"status": "error", "error": str(exc)}


def handler(event: Any, context: Any) -> dict[str, Any]:
    """Lambda entry point.

    EventBridge payload: {"action": "run"} -> chay drift job ngay
    API Gateway / web-adapter: forward HTTP request den uvicorn (port 8100)
    """
    logger.info("Drift job invoked event=%s", type(event).__name__)

    # Neu la EventBridge scheduled event (co action field), chay drift truc tiep
    if isinstance(event, dict) and event.get("action") == "run":
        summary = _run_scheduled_drift()
        return {
            "statusCode": 200 if summary.get("status") == "ok" else 500,
            "headers": {"Content-Type": "application/json"},
            "body": str(summary),
        }

    # Neu la HTTP request qua web-adapter, tra ve 200 (web-adapter da forward den uvicorn)
    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": '{"service":"drift","status":"ok"}',
    }
