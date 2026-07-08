from __future__ import annotations

import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Any

logger = logging.getLogger("model_loader")

# Source priority: S3 (immutable, AWS-native) -> W&B (training) -> local fallback
# MLOPS_REGISTRY env var chon nguon chinh:
#   - "s3"     : S3 first, fallback W&B, fallback local
#   - "wandb"  : W&B first, fallback S3, fallback local
#   - "local"  : local only (dev mode)


def _load_from_s3() -> tuple[Any, dict[str, Any]] | None:
    """Download model from S3 + lookup version tu DynamoDB.

    Env:
        S3_MODEL_BUCKET (required)
        S3_MODEL_PREFIX (default 'ingredient-detector/')
        DYNAMODB_MODEL_TABLE (default 'cooksmart-model-versions')
        MODEL_VERSION (default = lookup alias='production' tu DynamoDB)
    """
    bucket = os.environ.get("S3_MODEL_BUCKET")
    if not bucket:
        logger.info("[s3] S3_MODEL_BUCKET chua set, skip S3 source")
        return None

    prefix = os.environ.get("S3_MODEL_PREFIX", "ingredient-detector/")
    table_name = os.environ.get("DYNAMODB_MODEL_TABLE", "cooksmart-model-versions")
    version = os.environ.get("MODEL_VERSION")

    import boto3  # type: ignore

    region = os.environ.get("AWS_REGION", "ap-southeast-1")
    dynamodb = boto3.resource("dynamodb", region_name=region)
    s3 = boto3.client("s3", region_name=region)

    # Neu khong co MODEL_VERSION, lookup ALIAS#production -> version
    if not version:
        try:
            table = dynamodb.Table(table_name)
            resp = table.get_item(Key={"PK": "ALIAS#production", "SK": "POINTER"})
            item = resp.get("Item")
            if not item:
                logger.warning("[s3] No alias pointer for 'production' in %s", table_name)
                return None
            version = item["version"]
            logger.info("[s3] Resolved alias 'production' -> version %s", version)
        except Exception as exc:  # noqa: BLE001
            logger.warning("[s3] DynamoDB lookup failed: %s", exc)
            return None

    model_key = f"{prefix}{version}/best.pt"
    manifest_key = f"{prefix}{version}/manifest.json"

    try:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            model_path = tmp_path / "best.pt"
            s3.download_file(bucket, model_key, str(model_path))
            manifest: dict[str, Any] = {}
            try:
                obj = s3.get_object(Bucket=bucket, Key=manifest_key)
                manifest = json.loads(obj["Body"].read().decode("utf-8"))
            except s3.exceptions.NoSuchKey:
                logger.warning("[s3] manifest.json not found at %s", manifest_key)
            metadata = {
                **manifest,
                "source": "s3",
                "version": version,
                "bucket": bucket,
                "model_key": model_key,
                "weights_path": str(model_path),
            }
            from ultralytics import YOLO
            return YOLO(str(model_path), task="detect"), metadata
    except Exception as exc:  # noqa: BLE001
        logger.warning("[s3] Download failed: %s", exc)
        return None


def _load_from_wandb() -> tuple[Any, dict[str, Any]] | None:
    """Download model from W&B artifact registry.

    Env (legacy):
        WANDB_ENTITY (required)
        WANDB_PROJECT (default 'ingredient-detection')
        WANDB_MODEL_ARTIFACT (default 'ingredient-detector')
        WANDB_MODEL_ALIAS (default 'production')
    """
    entity = os.environ.get("WANDB_ENTITY")
    if not entity:
        logger.info("[wandb] WANDB_ENTITY chua set, skip W&B source")
        return None

    try:
        import wandb  # type: ignore
        from ultralytics import YOLO
    except ImportError as exc:
        logger.warning("[wandb] Missing dependency: %s", exc)
        return None

    project = os.getenv("WANDB_PROJECT", "ingredient-detection")
    artifact_name = os.getenv("WANDB_MODEL_ARTIFACT", "ingredient-detector")
    alias = os.getenv("WANDB_MODEL_ALIAS", "production")
    artifact_ref = f"{entity}/{project}/{artifact_name}:{alias}"
    cache_dir = Path(os.getenv("WANDB_MODEL_CACHE", "/tmp/food-suggest-models"))
    cache_dir.mkdir(parents=True, exist_ok=True)

    try:
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
    except Exception as exc:  # noqa: BLE001
        logger.warning("[wandb] Download failed: %s", exc)
        return None


def _load_from_local(script_dir: Path) -> tuple[Any, dict[str, Any]] | None:
    """Fallback: load from local best59.pt."""
    local_path = os.getenv("YOLO_MODEL_PATH", str(script_dir / "best59.pt"))
    if not Path(local_path).is_file():
        logger.warning("[local] No local model at %s", local_path)
        return None
    try:
        from ultralytics import YOLO
        return YOLO(local_path, task="detect"), {"source": "local", "weights_path": local_path}
    except Exception as exc:  # noqa: BLE001
        logger.error("[local] Load failed: %s", exc)
        return None


def load_yolo_model_from_registry() -> tuple[Any, dict[str, Any]]:
    """Top-level loader theo thu tu uu tien MLOPS_REGISTRY."""
    registry = os.environ.get("MLOPS_REGISTRY", "s3").lower()
    script_dir = Path(__file__).parent

    sources = {
        "s3": [_load_from_s3, _load_from_wandb, lambda: _load_from_local(script_dir)],
        "wandb": [_load_from_wandb, _load_from_s3, lambda: _load_from_local(script_dir)],
        "local": [lambda: _load_from_local(script_dir)],
    }

    chain = sources.get(registry, sources["s3"])
    last_error: str | None = None
    for src in chain:
        try:
            result = src()
            if result is not None:
                return result
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            logger.warning("Loader %s raised: %s", src.__name__ if hasattr(src, "__name__") else src, exc)

    raise RuntimeError(
        f"Khong the load model tu bat ky nguon nao (registry={registry}). Last error: {last_error}"
    )
