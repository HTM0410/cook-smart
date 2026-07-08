"""Concept drift - so sanh histogram confidence giua baseline vs live.

Baseline: confidence scores tu eval test split (luu trong
baseline_confidence.json hoac .npy).
Live: scrape yolo_detection_confidence tu YOLO service /metrics.

Su dung KS-test. P < KS_P_THRESHOLD (mac dinh 0.05) -> drift.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

import numpy as np
from scipy.stats import ks_2samp

KS_P_THRESHOLD = float(os.environ.get("DRIFT_CONCEPT_KS_P", "0.05"))


def _baseline_path() -> Path:
    return Path(
        os.environ.get(
            "BASELINE_CONFIDENCE_PATH",
            str(Path(__file__).resolve().parents[1] / "artifacts" / "baseline_confidence.npy"),
        )
    )


def _load_baseline() -> np.ndarray:
    p = _baseline_path()
    if not p.exists():
        return np.zeros((0,), dtype=np.float32)
    if p.suffix == ".npy":
        return np.load(p)
    if p.suffix == ".json":
        try:
            return np.asarray(json.loads(p.read_text()), dtype=np.float32)
        except (OSError, json.JSONDecodeError):
            return np.zeros((0,), dtype=np.float32)
    return np.zeros((0,), dtype=np.float32)


def concept_drift(live_confidence: np.ndarray | None = None) -> dict:
    """Compare baseline confidence vs live."""
    baseline = _load_baseline()
    if live_confidence is None or len(live_confidence) == 0:
        return {"p_value": 1.0, "drift": False, "baseline_size": int(len(baseline))}

    if len(baseline) < 20 or len(live_confidence) < 20:
        return {
            "p_value": 1.0,
            "drift": False,
            "baseline_size": int(len(baseline)),
            "live_size": int(len(live_confidence)),
            "reason": "insufficient_samples",
        }

    result = ks_2samp(baseline, live_confidence)
    return {
        "p_value": float(result.pvalue),
        "drift": float(result.pvalue) < KS_P_THRESHOLD,
        "baseline_size": int(len(baseline)),
        "live_size": int(len(live_confidence)),
        "statistic": float(result.statistic),
    }


if __name__ == "__main__":
    fp = os.environ.get("LIVE_CONFIDENCE_PATH")
    if fp and Path(fp).exists():
        live = np.load(fp)
    else:
        live = np.zeros((0,), dtype=np.float32)
    print(json.dumps(concept_drift(live), indent=2))
