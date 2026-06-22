from __future__ import annotations

import argparse
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .common import git_revision, metric_dict, read_yaml, sha256_file, write_json


def train(params_path: Path, data_yaml: Path, model_path: Path, metrics_path: Path, manifest_path: Path) -> None:
    from ultralytics import YOLO, settings

    params = read_yaml(params_path)["train"]
    wandb_enabled = bool(params.get("wandb", True)) and bool(os.getenv("WANDB_API_KEY"))
    run: Any = None
    if wandb_enabled:
        import wandb

        wandb.login(key=os.environ["WANDB_API_KEY"], relogin=False)
        run = wandb.init(
            project=os.getenv("WANDB_PROJECT", params.get("project", "food-suggest-ingredient-detection")),
            entity=os.getenv("WANDB_ENTITY") or None,
            name=os.getenv("WANDB_RUN_NAME") or None,
            job_type="train",
            config=params,
            tags=["yolo", "ingredient-detection", os.getenv("EXECUTION_ENV", "local")],
        )
        settings.update({"wandb": True})
    else:
        settings.update({"wandb": False})

    output_dir = model_path.parent.parent / "runs"
    output_dir.mkdir(parents=True, exist_ok=True)
    model = YOLO(str(params["base_model"]))
    results = model.train(
        data=str(data_yaml.resolve()),
        epochs=int(params["epochs"]),
        imgsz=int(params["imgsz"]),
        batch=int(params["batch"]),
        patience=int(params["patience"]),
        optimizer=str(params["optimizer"]),
        lr0=float(params["lr0"]),
        seed=int(params["seed"]),
        deterministic=bool(params["deterministic"]),
        workers=int(params["workers"]),
        device=str(params["device"]),
        project=str(output_dir),
        name="train",
        exist_ok=True,
        pretrained=True,
        plots=True,
        verbose=True,
    )

    source_model = Path(results.save_dir) / "weights" / "best.pt"
    if not source_model.is_file():
        raise FileNotFoundError(f"Ultralytics did not produce {source_model}")
    model_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_model, model_path)

    metrics = metric_dict(results)
    write_json(metrics_path, metrics)
    class_names = [str(value) for _, value in sorted(model.names.items())]
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "git_revision": git_revision(),
        "model_file": model_path.name,
        "model_sha256": sha256_file(model_path),
        "base_model": params["base_model"],
        "class_count": len(class_names),
        "class_names": class_names,
        "dataset_yaml": str(data_yaml),
        "metrics": metrics,
        "wandb_run_id": getattr(run, "id", None),
        "wandb_run_url": getattr(run, "url", None),
    }
    write_json(manifest_path, manifest)

    if run is not None:
        import wandb

        run.log({f"final/{key}": value for key, value in metrics.items()})
        artifact = wandb.Artifact(
            name=os.getenv("WANDB_MODEL_ARTIFACT", "ingredient-detector"),
            type="model",
            metadata=manifest,
        )
        artifact.add_file(str(model_path), name="best.pt")
        artifact.add_file(str(manifest_path), name="manifest.json")
        run.log_artifact(artifact, aliases=["latest", "candidate"])
        run.finish()


def main() -> None:
    parser = argparse.ArgumentParser(description="Train ingredient YOLO model")
    parser.add_argument("--params", default="params.yaml", type=Path)
    parser.add_argument("--data-yaml", required=True, type=Path)
    parser.add_argument("--model", required=True, type=Path)
    parser.add_argument("--metrics", required=True, type=Path)
    parser.add_argument("--manifest", required=True, type=Path)
    args = parser.parse_args()
    train(args.params, args.data_yaml, args.model, args.metrics, args.manifest)


if __name__ == "__main__":
    main()
