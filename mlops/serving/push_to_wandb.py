"""Push model to W&B Model Registry.

Usage:
    python -m mlops.serving.push_to_wandb list
    python -m mlops.serving.push_to_wandb push --version v1.0.0
    python -m mlops.serving.push_to_wandb push-all
    python -m mlops.serving.push_to_wandb status
"""
from __future__ import annotations

import json
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import click

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("push_to_wandb")

WANDB_ENTITY = os.environ.get("WANDB_ENTITY", "htm0410")
WANDB_PROJECT = os.getenv("WANDB_PROJECT", "ingredient-detection")
WANDB_ARTIFACT = os.getenv("WANDB_MODEL_ARTIFACT", "ingredient-detector")
MODEL_DIR = Path(__file__).parent.parent / "artifacts" / "model"
MANIFEST_PATH = MODEL_DIR / "manifest.json"


def get_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {}


def list_local_models() -> list[dict]:
    manifest = get_manifest()
    models = manifest.get("models", {})
    
    result = []
    for version, info in models.items():
        filename = info.get("filename", f"{version}.pt")
        filepath = MODEL_DIR / filename
        
        result.append({
            "version": version,
            "filename": filename,
            "path": str(filepath),
            "exists": filepath.exists(),
            "trained_at": info.get("training", {}).get("trained_at"),
            "metrics": info.get("metrics", {}),
            "aliases": info.get("aliases", []),
        })
    
    return sorted(result, key=lambda x: x["version"], reverse=True)


def list_wandb_models() -> list[dict]:
    try:
        import wandb
    except ImportError:
        logger.error("wandb not installed. Run: pip install wandb")
        return []
    
    api = wandb.Api()
    artifact_name = f"{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}"
    
    try:
        artifacts = api.artifacts(artifact_name, type="model")
        result = []
        for art in artifacts:
            result.append({
                "version": art.version,
                "name": art.name,
                "aliases": art.aliases,
                "created_at": str(art.created_at),
                "size": art.size,
            })
        return result
    except Exception as e:
        logger.warning(f"Cannot fetch W&B models: {e}")
        return []


def push_model_to_wandb(version: str, alias: Optional[str] = None) -> bool:
    try:
        import wandb
    except ImportError:
        logger.error("wandb not installed. Run: pip install wandb")
        return False
    
    manifest = get_manifest()
    models = manifest.get("models", {})
    
    if version not in models:
        logger.error(f"Version {version} not found in manifest.json")
        return False
    
    model_info = models[version]
    filename = model_info.get("filename")
    filepath = MODEL_DIR / filename
    
    if not filepath.exists():
        logger.error(f"Model file not found: {filepath}")
        return False
    
    if alias is None:
        aliases = model_info.get("aliases", [])
        alias = aliases[0] if aliases else version
    
    logger.info(f"Pushing {filename} to W&B as {WANDB_ARTIFACT}:{version} with alias '{alias}'")
    
    try:
        run = wandb.init(project=WANDB_PROJECT, entity=WANDB_ENTITY, anonymous="never")
        
        artifact = wandb.Artifact(
            name=WANDB_ARTIFACT,
            type="model",
            metadata={
                "version": version,
                "trained_at": model_info.get("training", {}).get("trained_at"),
                "metrics": model_info.get("metrics", {}),
                "architecture": model_info.get("architecture", "YOLOv11n"),
                "classes": model_info.get("classes", 59),
            }
        )
        
        artifact.add_file(str(filepath), name="best.pt")
        
        if MANIFEST_PATH.exists():
            artifact.add_file(str(MANIFEST_PATH), name="manifest.json")
        
        run.log_artifact(artifact, aliases=[alias, version])
        run.finish()
        
    except Exception as e:
        logger.error(f"Failed to push model: {e}")
        return False
    
    logger.info(f"[OK] Successfully pushed {version} to W&B Model Registry")
    return True


def sync_aliases_to_wandb() -> bool:
    try:
        import wandb
    except ImportError:
        logger.error("wandb not installed. Run: pip install wandb")
        return False
    
    manifest = get_manifest()
    models = manifest.get("models", {})
    
    api = wandb.Api()
    artifact_ref = f"{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}"
    
    for ver, info in models.items():
        aliases = info.get("aliases", [])
        for als in aliases:
            try:
                artifact = api.artifact(f"{artifact_ref}:{ver}", type="model")
                if als not in artifact.aliases:
                    artifact.aliases.append(als)
                    artifact.save()
                    logger.info(f"Added alias '{als}' to {ver}")
            except Exception as e:
                logger.warning(f"Cannot update alias for {ver}: {e}")
    
    return True


@click.group()
def cli():
    """Push models to W&B Model Registry"""
    pass


@cli.command("list")
@click.option("--source", default="local", type=click.Choice(["local", "wandb", "both"]))
def list_cmd(source: str):
    if source in ("local", "both"):
        click.echo("\n[LOCAL] Local Models:")
        click.echo("-" * 80)
        for m in list_local_models():
            status = "[OK]" if m["exists"] else "[MISSING]"
            click.echo(f"{status} {m['version']:12} | {m['trained_at'] or 'N/A'} | {m['aliases']} | {m['filename']}")
    
    if source in ("wandb", "both"):
        click.echo("\n[WANDB] W&B Model Registry:")
        click.echo("-" * 80)
        for m in list_wandb_models():
            click.echo(f"   {m['version']:12} | {m['aliases']} | {m['created_at'][:10]}")


@cli.command("push")
@click.option("--version", required=True, help="Model version to push (e.g., v1.0.0)")
@click.option("--alias", help="Alias to assign (e.g., production, candidate)")
def push_cmd(version: str, alias: Optional[str]):
    success = push_model_to_wandb(version, alias)
    sys.exit(0 if success else 1)


@cli.command("push-all")
@click.option("--dry-run", is_flag=True, help="Show what would be pushed without pushing")
def push_all_cmd(dry_run: bool):
    models = list_local_models()
    
    click.echo(f"\n{'[DRY RUN] ' if dry_run else ''}Pushing {len(models)} models to W&B:")
    
    for m in models:
        click.echo(f"  - {m['version']} ({m['filename']}) -> aliases: {m['aliases']}")
        
        if not dry_run:
            push_model_to_wandb(m["version"])


@cli.command("status")
def status_cmd():
    manifest = get_manifest()
    active = manifest.get("active_model", "N/A")
    
    click.echo(f"\n[INFO] Active Model: {active}")
    click.echo(f"[INFO] Registry: {WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}\n")
    
    local = list_local_models()
    wandb = list_wandb_models()
    
    click.echo(f"Local: {len(local)} models | W&B: {len(wandb)} versions\n")
    
    if wandb:
        click.echo("W&B Versions:")
        for m in wandb:
            click.echo(f"  {m['version']:12} -> {m['aliases']}")


@cli.command("sync-aliases")
def sync_cmd():
    success = sync_aliases_to_wandb()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    cli()
