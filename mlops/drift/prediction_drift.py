"""Prediction drift - so sanh ty le class detect hien tai vs baseline.

Su dung Jensen-Shannon divergence de do su khac biet giua 2 phan phoi.
Một metric Prometheus: yolo_detections_total{class_name="..."} duoc scrape
tu YOLO service va so voi baseline_class_counts.json (computed luc promote).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict

import numpy as np
from scipy.spatial.distance import jensenshannon

JSD_THRESHOLD = float(os.environ.get("DRIFT_PREDICTION_JSD", "0.1"))


def _baseline_path() -> Path:
    return Path(
        os.environ.get(
            "BASELINE_COUNTS_PATH",
            str(Path(__file__).resolve().parents[1] / "artifacts" / "baseline_class_counts.json"),
        )
    )


def _load_baseline(path: Path | None = None) -> Dict[str, int]:
    p = path or _baseline_path()
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def prediction_drift(live_counts: Dict[str, int] | None = None) -> dict:
    """Compute Jensen-Shannon divergence between baseline va live class counts.

    Args:
        live_counts: dict class_name -> count. Neu None, tra ve safe default.

    Returns:
        dict gom jsd, drift, sample_size
    """
    baseline = _load_baseline()
    if live_counts is None:
        return {"jsd": 0.0, "drift": False, "baseline_size": sum(baseline.values())}

    # Union de tranh metric chi apply tren subset
    all_classes = set(baseline.keys()) | set(live_counts.keys())
    base_vec = np.array([baseline.get(c, 0) for c in all_classes], dtype=np.float64)
    live_vec = np.array([live_counts.get(c, 0) for c in all_classes], dtype=np.float64)

    if base_vec.sum() == 0 or live_vec.sum() == 0:
        # Neu 1 trong 2 empty, khong co bang chung -> mark drift
        return {
            "jsd": 1.0,
            "drift": True,
            "baseline_size": int(base_vec.sum()),
            "live_size": int(live_vec.sum()),
            "reason": "empty_baseline_or_live",
        }

    base_probs = base_vec / base_vec.sum()
    live_probs = live_vec / live_vec.sum()

    jsd = float(jensenshannon(base_probs, live_probs))

    return {
        "jsd": jsd,
        "drift": jsd > JSD_THRESHOLD,
        "baseline_size": int(base_vec.sum()),
        "live_size": int(live_vec.sum()),
        "compared_classes": len(all_classes),
    }


if __name__ == "__main__":
    sample = json.loads(Path(os.environ.get("LIVE_COUNTS_JSON", "{}")).read_text())
    print(json.dumps(prediction_drift(sample), indent=2))
