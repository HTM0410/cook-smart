from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def load_yolo_model_from_registry() -> tuple[Any, dict[str, Any]]:
    import wandb
    from ultralytics import YOLO

    entity = os.environ["WANDB_ENTITY"]
    project = os.getenv("WANDB_PROJECT", "food-suggest-ingredient-detection")
    artifact_name = os.getenv("WANDB_MODEL_ARTIFACT", "ingredient-detector")
    alias = os.getenv("WANDB_MODEL_ALIAS", "production")
    artifact_ref = f"{entity}/{project}/{artifact_name}:{alias}"
    cache_dir = Path(os.getenv("WANDB_MODEL_CACHE", "/tmp/food-suggest-models"))
    cache_dir.mkdir(parents=True, exist_ok=True)

    artifact = wandb.Api().artifact(artifact_ref, type="model")
    artifact_dir = Path(artifact.download(root=str(cache_dir / artifact.version)))
    model_path = artifact_dir / "best.pt"
    if not model_path.is_file():
        raise FileNotFoundError(f"W&B artifact {artifact_ref} has no best.pt")

    manifest_path = artifact_dir / "manifest.json"
    manifest: dict[str, Any] = {}
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    metadata = {
        **manifest,
        "source": "wandb",
        "artifact": artifact_ref,
        "artifact_version": artifact.version,
        "weights_path": str(model_path),
    }
    return YOLO(str(model_path), task="detect"), metadata
