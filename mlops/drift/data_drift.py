"""Drift detection - data drift score.

So sánh phân phối embedding ảnh mới vs baseline bằng KS-test trên các
chiều PCA. Cần bật EMBEDDING_ENABLED=true ở YOLO service để lấy embedding.

Output (dict):
    p_values: list[float] len = n_components (default 8)
    min_p: min(p_values)
    drift: bool - True neu min_p < 0.01
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Iterable

import numpy as np
from scipy.stats import ks_2samp
from sklearn.decomposition import PCA

N_COMPONENTS = int(os.environ.get("DRIFT_PCA_COMPONENTS", "8"))
KS_P_THRESHOLD = float(os.environ.get("DRIFT_DATA_KS_P", "0.01"))


def _baseline_path() -> Path:
    return Path(
        os.environ.get(
            "BASELINE_EMBEDDINGS_PATH",
            str(Path(__file__).resolve().parents[1] / "artifacts" / "baseline_embeddings.npy"),
        )
    )


def _load_baseline() -> np.ndarray:
    p = _baseline_path()
    if not p.exists():
        return np.zeros((1, N_COMPONENTS), dtype=np.float32)
    return np.load(p)


def data_drift_score(live_embeds: np.ndarray | None = None) -> dict:
    """Tinh diem drift giua baseline va live embeddings.

    Args:
        live_embeds: numpy array shape (n_samples, n_features) hoac None de skip.

    Returns:
        dict chua p_values, min_p, drift
    """
    baseline = _load_baseline()
    if live_embeds is None or len(live_embeds) == 0:
        return {
            "p_values": [1.0] * N_COMPONENTS,
            "min_p": 1.0,
            "drift": False,
            "samples_compared": 0,
        }

    if baseline.shape[0] < 2 or live_embeds.shape[0] < 2:
        return {
            "p_values": [1.0] * N_COMPONENTS,
            "min_p": 1.0,
            "drift": False,
            "samples_compared": min(len(baseline), len(live_embeds)),
        }

    # Dam bao cung chieu feature - pad/trim neu can
    n_features = min(baseline.shape[1], live_embeds.shape[1])
    baseline = baseline[:, :n_features]
    live_embeds = live_embeds[:, :n_features]

    n_components = min(N_COMPONENTS, n_features, baseline.shape[0] - 1)
    if n_components < 1:
        return {
            "p_values": [1.0] * N_COMPONENTS,
            "min_p": 1.0,
            "drift": False,
            "samples_compared": min(len(baseline), len(live_embeds)),
        }

    pca = PCA(n_components=n_components)
    pca.fit(baseline)
    base_proj = pca.transform(baseline)
    live_proj = pca.transform(live_embeds)

    p_values = [float(ks_2samp(base_proj[:, i], live_proj[:, i]).pvalue) for i in range(n_components)]

    # Pad lai neu it hon N_COMPONENTS
    while len(p_values) < N_COMPONENTS:
        p_values.append(1.0)

    min_p = min(p_values)
    return {
        "p_values": p_values,
        "min_p": min_p,
        "drift": min_p < KS_P_THRESHOLD,
        "samples_compared": min(len(baseline), len(live_embeds)),
    }


def embeddable_to_array(items: Iterable) -> np.ndarray:
    """Helper: chuyen danh sach embedding dict -> numpy array."""
    arr = []
    for it in items:
        if isinstance(it, dict) and "embedding" in it:
            arr.append(it["embedding"])
        elif isinstance(it, (list, np.ndarray)):
            arr.append(it)
    if not arr:
        return np.zeros((0, 0), dtype=np.float32)
    return np.asarray(arr, dtype=np.float32)


if __name__ == "__main__":
    # CLI test: tai embedding test cua ban va check drift
    import sys
    fp = sys.argv[1] if len(sys.argv) > 1 else None
    if fp:
        live = np.load(fp)
        result = data_drift_score(live)
        print(json.dumps(result, indent=2))
    else:
        print(json.dumps({"min_p": 1.0, "drift": False, "samples_compared": 0}))
