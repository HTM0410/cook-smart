"""FastAPI service cho drift detection.

Endpoints:
  GET  /health              - liveness
  POST /drift/run           - chay 3 kenh drift (data/concept/prediction)
                               va day metric len Prometheus Pushgateway
  GET  /drift/reports       - danh sach lan chay gan day (in-memory)
  GET  /metrics             - Prometheus metrics cho drift service
"""
from __future__ import annotations

import json
import os
import re
import time
from collections import deque
from typing import Any, Deque, Dict, List, Optional

import httpx
import numpy as np
from fastapi import FastAPI, HTTPException
from prometheus_client import CollectorRegistry, Counter, Gauge, Histogram, generate_latest
from pydantic import BaseModel

# Import relative modules
from .concept_drift import concept_drift
from .data_drift import data_drift_score
from .prediction_drift import prediction_drift

YOLO_METRICS_URL = os.environ.get("YOLO_METRICS_URL", "http://localhost:8000/metrics")
PUSHGATEWAY_URL = os.environ.get("PUSHGATEWAY_URL", "http://localhost:9091")
METRICS_TOKEN = os.environ.get("METRICS_TOKEN", "")

EMBED_BATCH = int(os.environ.get("EMBED_BATCH", "16"))
EMBEDDING_ENABLED = os.environ.get("EMBEDDING_ENABLED", "false").lower() == "true"

MAX_HISTORY = int(os.environ.get("DRIFT_HISTORY_SIZE", "20"))

# -----------------------------------------------------------------------------
# Prometheus metrics (registry rieng de clean)
# -----------------------------------------------------------------------------

registry = CollectorRegistry()
metric_run_total = Counter(
    "drift_run_total",
    "So lan drift run duoc goi",
    ["channel"],
    registry=registry,
)
metric_data_p_min = Gauge(
    "drift_data_p_value_min",
    "Min p-value cua KS-test qua cac PCA components (data drift)",
    registry=registry,
)
metric_prediction_jsd = Gauge(
    "drift_prediction_jsd",
    "Jensen-Shannon divergence giua baseline va live class counts",
    registry=registry,
)
metric_concept_p = Gauge(
    "drift_concept_p_value",
    "P-value cua KS-test tren confidence histogram",
    registry=registry,
)
metric_alert = Gauge(
    "drift_alert",
    "1 neu co it nhat 1 kenh drift, 2 neu co 2+ kenh drift",
    registry=registry,
)
metric_run_timestamp = Gauge(
    "drift_run_timestamp",
    "Unix timestamp cua lan chay drift gan nhat",
    registry=registry,
)
metric_run_duration = Histogram(
    "drift_run_duration_seconds",
    "Thoi gian chay drift run (giay)",
    registry=registry,
)

# History trong RAM (khong can DB cho dung luong nho)
_reports: Deque[Dict[str, Any]] = deque(maxlen=MAX_HISTORY)


# -----------------------------------------------------------------------------
# Schema
# -----------------------------------------------------------------------------


class DriftRunRequest(BaseModel):
    window: Optional[str] = "1h"
    channels: List[str] = ["data", "concept", "prediction"]
    live_confidence_path: Optional[str] = None
    live_class_counts: Optional[Dict[str, int]] = None
    live_embeds_path: Optional[str] = None


class DriftRunResponse(BaseModel):
    timestamp: str
    channels: Dict[str, Any]
    alert_level: int
    duration_seconds: float


# -----------------------------------------------------------------------------
# Service
# -----------------------------------------------------------------------------

app = FastAPI(
    title="CookSmart Drift Detection Service",
    version="1.0.0",
    description="Phat hien data/concept/prediction drift cho YOLO service.",
)


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "drift",
        "yolo_metrics_url": YOLO_METRICS_URL,
        "pushgateway_url": PUSHGATEWAY_URL,
        "embedding_enabled": EMBEDDING_ENABLED,
        "history_size": len(_reports),
    }


@app.get("/metrics")
def metrics():
    return generate_latest(registry)


@app.get("/drift/reports")
def list_reports(limit: int = 10):
    limit = min(limit, MAX_HISTORY)
    return {"count": limit, "items": list(_reports)[:limit]}


def _scrape_yolo_metrics() -> Dict[str, Any]:
    """Scrape YOLO service /metrics, tra ve cac gia tri can thiet.

    Dung http.client thay vi httpx async de giam phu thuoc trong smoke test.
    """
    headers = {}
    if METRICS_TOKEN:
        headers["Authorization"] = f"Bearer {METRICS_TOKEN}"
    with httpx.Client(timeout=10.0) as client:
        try:
            r = client.get(YOLO_METRICS_URL, headers=headers)
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise HTTPException(status_code=502, detail=f"YOLO /metrics unreachable: {e}")
    return _parse_prometheus_text(r.text)


_METRIC_VAL_RE = re.compile(
    r"^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{[^}]*\})?\s+([0-9.eE+-]+|NaN)\s*$",
    flags=re.MULTILINE,
)


def _parse_prometheus_text(text: str) -> Dict[str, Any]:
    """Parse Prometheus exposition format -> dict theo metric name.

    Tra ve:
        - detections_total_by_class: dict[class_name, sum]
        - confidence_samples: list[float]
        - detected_total_count: float
    """
    detections_total: Dict[str, float] = {}
    confidence_samples: List[float] = []
    detected_total = 0.0

    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        # confidence histogram se co _bucket/_sum/_count - doc sum
        if line.startswith("yolo_detection_confidence"):
            m = _METRIC_VAL_RE.match(line)
            if m:
                try:
                    v = float(m.group(3))
                    # chi lay _sum va _count de tinh approximate mean
                    if "_sum" in line:
                        confidence_samples.append(v)  # sum value
                except ValueError:
                    pass
        elif line.startswith("yolo_detections_total"):
            m = _METRIC_VAL_RE.match(line)
            if m:
                name = m.group(1)
                labels = m.group(2) or ""
                try:
                    val = float(m.group(3))
                except ValueError:
                    continue
                # Lay class_name tu labels
                class_match = re.search(r'class_name="([^"]+)"', labels)
                if class_match:
                    cls = class_match.group(1)
                    detections_total[cls] = detections_total.get(cls, 0.0) + val
                detected_total += val
    return {
        "detections_total_by_class": detections_total,
        "confidence_samples": confidence_samples,
        "detected_total_count": detected_total,
    }


def _push_metrics_to_gateway(report: DriftRunResponse):
    """Day metric len Prometheus Pushgateway.

    Bo qua neu PUSHGATEWAY_URL khong duoc set hoac loi mang.
    """
    if not PUSHGATEWAY_URL:
        return
    try:
        metrics_text = generate_latest(registry).decode("utf-8")
        with httpx.Client(timeout=5.0) as client:
            client.post(
                f"{PUSHGATEWAY_URL.rstrip('/')}/metrics/job/cooksmart-drift",
                content=metrics_text,
                headers={"Content-Type": "text/plain; version=0.0.4"},
            )
    except httpx.HTTPError:
        # Drift service van tra ve ket qua du push failed
        pass


@app.post("/drift/run")
def run_drift(req: DriftRunRequest) -> DriftRunResponse:
    start = time.time()
    channels = req.channels or ["data", "concept", "prediction"]
    report: Dict[str, Any] = {"status": "ok"}

    # ---- Prediction drift: live_counts tu client hoac scrape YOLO --------
    live_class_counts: Optional[Dict[str, int]] = None
    if "prediction" in channels:
        if req.live_class_counts:
            live_class_counts = {k: int(v) for k, v in req.live_class_counts.items()}
        else:
            try:
                yolo = _scrape_yolo_metrics()
                live_class_counts = {
                    k: int(v) for k, v in yolo["detections_total_by_class"].items()
                }
            except HTTPException as e:
                report["prediction"] = {"drift": True, "error": str(e.detail), "skipped": True}
        if live_class_counts is not None and "prediction" not in report:
            res = prediction_drift(live_class_counts)
            metric_prediction_jsd.set(float(res.get("jsd", 0.0)))
            metric_run_total.labels(channel="prediction").inc()
            report["prediction"] = res

    # ---- Data drift: neu co live embeds ------------------------------
    if "data" in channels:
        live_embeds = None
        if req.live_embeds_path:
            try:
                live_embeds = np.load(req.live_embeds_path)
            except (OSError, ValueError):
                live_embeds = None
        # Neu bat EMBEDDING_ENABLED va scrape YOLO /embed duoc, co the bo sung o day.
        res = data_drift_score(live_embeds or None)
        metric_data_p_min.set(float(res.get("min_p", 1.0)))
        metric_run_total.labels(channel="data").inc()
        report["data"] = res

    # ---- Concept drift: confidence histogram -------------------------
    if "concept" in channels:
        live_conf = None
        if req.live_confidence_path:
            try:
                live_conf = np.load(req.live_confidence_path)
            except (OSError, ValueError):
                live_conf = None
        res = concept_drift(live_conf)
        metric_concept_p.set(float(res.get("p_value", 1.0)))
        metric_run_total.labels(channel="concept").inc()
        report["concept"] = res

    # ---- Tong hop alert ----------------------------------------------
    drift_flags = [
        report.get(ch, {}).get("drift", False)
        for ch in ("data", "concept", "prediction")
        if ch in report
    ]
    n_drift = sum(1 for f in drift_flags if f)
    alert_level = 0 if n_drift == 0 else (1 if n_drift == 1 else 2)
    metric_alert.set(alert_level)
    metric_run_timestamp.set(time.time())

    duration = time.time() - start
    metric_run_duration.observe(duration)

    response = DriftRunResponse(
        timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        channels=report,
        alert_level=alert_level,
        duration_seconds=duration,
    )
    _reports.appendleft({"timestamp": response.timestamp, **response.model_dump()})
    _push_metrics_to_gateway(response)
    return response


@app.post("/metrics/push")
def force_push():
    """Manual trigger: day metric hien tai len Pushgateway."""
    try:
        _push_metrics_to_gateway(None)  # noqa: type - dummy
        return {"ok": True, "pushed_to": PUSHGATEWAY_URL}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e)) from e


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "8100")))
