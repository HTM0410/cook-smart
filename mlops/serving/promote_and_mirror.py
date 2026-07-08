"""W&B promote -> S3 mirror -> DynamoDB version manifest.

Flow moi thay the `promote-and-deploy` cu (W&B -> CodePipeline):
1. Pull model artifact tu W&B (alias candidate)
2. Upload len S3 immutable prefix
3. Update DynamoDB `cooksmart-model-versions` voi metadata
4. Trigger deploy Lambda alias update (qua GitHub Actions workflow_dispatch hoac AWS CLI)

Su dung:
    # Promote candidate -> production
    python -m mlops.serving.promote_and_mirror \\
        --entity htm0410 \\
        --project ingredient-detection \\
        --artifact ingredient-detector \\
        --from-alias candidate \\
        --to-alias production \\
        --bucket cooksmart-models \\
        --region ap-southeast-1

    # Chi mirror (khong promote W&B alias), dung cho blue/green staging
    python -m mlops.serving.promote_and_mirror mirror-only \\
        --entity htm0410 \\
        --project ingredient-detection \\
        --artifact ingredient-detector \\
        --version v2026.07.09-rc1 \\
        --bucket cooksmart-models
"""
from __future__ import annotations

import argparse
import hashlib
import json
import logging
import os
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import click

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def _require_boto3():
    try:
        import boto3  # type: ignore
    except ImportError as exc:
        raise RuntimeError("boto3 chua duoc cai. Cai bang: pip install boto3") from exc
    return boto3


def _download_wandb_artifact(
    entity: str,
    project: str,
    artifact: str,
    alias: str,
    target_dir: Path,
) -> tuple[Path, dict[str, Any]]:
    """Download W&B artifact vao target_dir. Tra ve (model_path, manifest_dict)."""
    try:
        import wandb  # type: ignore
    except ImportError as exc:
        raise RuntimeError("wandb chua duoc cai. Cai bang: pip install wandb") from exc

    api = wandb.Api()
    ref = f"{entity}/{project}/{artifact}:{alias}"
    logger.info("Pulling W&B artifact %s", ref)
    art = api.artifact(ref, type="model")
    artifact_dir = Path(art.download(root=str(target_dir)))
    model_path = artifact_dir / "best.pt"
    if not model_path.is_file():
        raise FileNotFoundError(f"W&B artifact {ref} has no best.pt")
    manifest_path = artifact_dir / "manifest.json"
    manifest: dict[str, Any] = {}
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    return model_path, {**manifest, "wandb_ref": ref, "wandb_version": art.version}


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _upload_to_s3(
    model_path: Path,
    manifest: dict[str, Any],
    bucket: str,
    prefix: str,
    version: str,
    region: str,
) -> dict[str, str]:
    """Upload best.pt + manifest.json len S3 voi immutable prefix <prefix>/<version>/.

    Su dung S3 Object Lock neu bucket da enable, nguoc lai chi set metadata version.
    """
    boto3 = _require_boto3()
    s3 = boto3.client("s3", region_name=region)

    model_key = f"{prefix}{version}/best.pt"
    manifest_key = f"{prefix}{version}/manifest.json"

    model_sha = _sha256_file(model_path)
    manifest = {
        **manifest,
        "version": version,
        "model_sha256": model_sha,
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }

    logger.info("Uploading s3://%s/%s (%.2f MB)", bucket, model_key, model_path.stat().st_size / 1e6)
    s3.upload_file(
        str(model_path),
        bucket,
        model_key,
        ExtraArgs={
            "Metadata": {"version": version, "sha256": model_sha},
            "ContentType": "application/octet-stream",
        },
    )
    s3.put_object(
        Bucket=bucket,
        Key=manifest_key,
        Body=json.dumps(manifest, ensure_ascii=False, indent=2).encode("utf-8"),
        ContentType="application/json",
    )
    return {
        "model_uri": f"s3://{bucket}/{model_key}",
        "manifest_uri": f"s3://{bucket}/{manifest_key}",
        "model_sha256": model_sha,
    }


def _update_dynamodb(
    version: str,
    alias: str,
    bucket: str,
    prefix: str,
    model_uri: str,
    manifest_uri: str,
    sha256: str,
    wandb_ref: str,
    table_name: str,
    region: str,
) -> None:
    """Upsert DynamoDB item voi version + alias pointer (alias -> version)."""
    boto3 = _require_boto3()
    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(table_name)

    now = datetime.now(timezone.utc).isoformat()
    # Item 1: version metadata
    table.put_item(
        Item={
            "PK": f"VERSION#{version}",
            "SK": "META",
            "version": version,
            "alias": alias,
            "bucket": bucket,
            "prefix": prefix,
            "model_uri": model_uri,
            "manifest_uri": manifest_uri,
            "model_sha256": sha256,
            "wandb_ref": wandb_ref,
            "created_at": now,
        }
    )
    # Item 2: alias pointer (de runtime lookup nhanh "production" -> version)
    table.put_item(
        Item={
            "PK": f"ALIAS#{alias}",
            "SK": "POINTER",
            "alias": alias,
            "version": version,
            "updated_at": now,
        }
    )
    logger.info("DynamoDB table=%s updated: alias=%s -> version=%s", table_name, alias, version)


# -----------------------------------------------------------------------------
# Commands
# -----------------------------------------------------------------------------

@click.group()
def cli():
    """Hybrid W&B + S3 + DynamoDB model promotion."""


@cli.command("promote-and-mirror")
@click.option("--entity", required=True, help="W&B entity")
@click.option("--project", required=True, help="W&B project")
@click.option("--artifact", required=True, help="Artifact name (vd: ingredient-detector)")
@click.option("--from-alias", default="candidate", show_default=True)
@click.option("--to-alias", default="production", show_default=True)
@click.option("--bucket", required=True, help="S3 bucket for model weights")
@click.option("--prefix", default="ingredient-detector/", show_default=True)
@click.option("--dynamodb-table", default="cooksmart-model-versions", show_default=True)
@click.option("--region", default=lambda: os.environ.get("AWS_REGION", "ap-southeast-1"), show_default=True)
@click.option("--semver", default=None, help="Override version (default: auto from wandb version + timestamp)")
def promote_and_mirror_cmd(
    entity: str,
    project: str,
    artifact: str,
    from_alias: str,
    to_alias: str,
    bucket: str,
    prefix: str,
    dynamodb_table: str,
    region: str,
    semver: str | None,
):
    """Pull W&B candidate, mirror to S3, update DynamoDB, promote W&B alias."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        model_path, manifest = _download_wandb_artifact(
            entity, project, artifact, from_alias, tmp_path
        )

        # Determine version
        if not semver:
            wandb_v = manifest.get("wandb_version", "v0")
            ts = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
            semver = f"v{ts}-{wandb_v}"
        manifest["version"] = semver
        manifest["alias"] = to_alias

        # Upload to S3
        s3_result = _upload_to_s3(
            model_path=model_path,
            manifest=manifest,
            bucket=bucket,
            prefix=prefix,
            version=semver,
            region=region,
        )

        # Update DynamoDB
        _update_dynamodb(
            version=semver,
            alias=to_alias,
            bucket=bucket,
            prefix=prefix,
            model_uri=s3_result["model_uri"],
            manifest_uri=s3_result["manifest_uri"],
            sha256=s3_result["model_sha256"],
            wandb_ref=manifest.get("wandb_ref", ""),
            table_name=dynamodb_table,
            region=region,
        )

    # Promote W&B alias (last step - atomic)
    try:
        import wandb  # type: ignore
        api = wandb.Api()
        ref = f"{entity}/{project}/{artifact}:{from_alias}"
        art = api.artifact(ref)
        aliases = set(art.aliases)
        aliases.add(to_alias)
        art.aliases = sorted(aliases)
        art.save()
        logger.info("W&B %s promoted :%s -> :%s", ref, from_alias, to_alias)
    except Exception as exc:  # noqa: BLE001
        logger.warning("W&B alias promotion failed (S3 mirror OK): %s", exc)

    click.echo(
        json.dumps(
            {
                "ok": True,
                "version": semver,
                "alias": to_alias,
                "model_uri": s3_result["model_uri"],
                "manifest_uri": s3_result["manifest_uri"],
                "model_sha256": s3_result["model_sha256"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


@cli.command("mirror-only")
@click.option("--entity", required=True)
@click.option("--project", required=True)
@click.option("--artifact", required=True)
@click.option("--alias", default="candidate", show_default=True)
@click.option("--version", required=True, help="Explicit version (vd: v2026.07.09-rc1)")
@click.option("--bucket", required=True)
@click.option("--prefix", default="ingredient-detector/", show_default=True)
@click.option("--region", default=lambda: os.environ.get("AWS_REGION", "ap-southeast-1"), show_default=True)
def mirror_only_cmd(
    entity: str,
    project: str,
    artifact: str,
    alias: str,
    version: str,
    bucket: str,
    prefix: str,
    region: str,
):
    """Chi mirror W&B -> S3, khong promote alias (dung cho staging test)."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        model_path, manifest = _download_wandb_artifact(
            entity, project, artifact, alias, tmp_path
        )
        manifest["alias"] = alias
        s3_result = _upload_to_s3(
            model_path=model_path,
            manifest=manifest,
            bucket=bucket,
            prefix=prefix,
            version=version,
            region=region,
        )
    click.echo(json.dumps({"ok": True, "version": version, **s3_result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    cli()
