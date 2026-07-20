"""Create W&B Model Registry using REST API.

Usage:
    python -m mlops.serving.create_wandb_registry create
    python -m mlops.serving.create_wandb_registry list
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Optional

import click
import requests

WANDB_ENTITY = os.environ.get("WANDB_ENTITY", "htm0410")
WANDB_PROJECT = os.getenv("WANDB_PROJECT", "ingredient-detection")
WANDB_ARTIFACT = os.getenv("WANDB_MODEL_ARTIFACT", "ingredient-detector")
WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "")


def get_headers() -> dict:
    return {
        "Authorization": f"Bearer {WANDB_API_KEY}",
        "Content-Type": "application/json",
    }


def api_url(path: str) -> str:
    return f"https://api.wandb.ai/api/v1{path}"


def create_registry() -> bool:
    """Create W&B Model Registry via REST API"""
    print(f"Creating model registry: {WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}")
    
    # Create project if not exists
    url = api_url(f"/entities/{WANDB_ENTITY}/projects")
    resp = requests.get(url, headers=get_headers())
    
    # Try to create artifact by uploading
    url = api_url(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}")
    
    payload = {
        "name": WANDB_ARTIFACT,
        "type": "model",
        "description": "Ingredient detection YOLO model registry",
    }
    
    resp = requests.post(url, headers=get_headers(), json=payload)
    
    if resp.status_code in (200, 201):
        print(f"[OK] Created/updated registry: {WANDB_ARTIFACT}")
        return True
    elif resp.status_code == 409:
        print(f"[OK] Registry already exists: {WANDB_ARTIFACT}")
        return True
    else:
        print(f"Error: {resp.status_code} - {resp.text}")
        return False


def upload_model_artifact(version: str, model_path: Path, metrics: Optional[dict] = None) -> bool:
    """Upload model file to W&B artifact storage"""
    import hashlib
    
    print(f"Uploading model to W&B...")
    
    # Calculate file hash
    sha256_hash = hashlib.sha256()
    with open(model_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    file_digest = sha256_hash.hexdigest()
    
    # Get upload URL
    url = api_url(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}/versions/{version}/file")
    resp = requests.post(
        url,
        headers=get_headers(),
        json={
            "path": "best.pt",
            "contentHash": file_digest,
            "size": model_path.stat().st_size,
        }
    )
    
    if resp.status_code not in (200, 201):
        print(f"Error getting upload URL: {resp.status_code}")
        print(resp.text)
        return False
    
    upload_result = resp.json()
    
    # Upload file
    upload_url = upload_result.get("uploadUrl") or upload_result.get("presignedUrl")
    if not upload_url:
        # Direct API upload
        upload_url = api_url(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}/versions/{version}/file")
        with open(model_path, "rb") as f:
            resp = requests.put(
                upload_url,
                headers={**get_headers(), "Content-Type": "application/octet-stream"},
                data=f
            )
    else:
        with open(model_path, "rb") as f:
            resp = requests.put(upload_url, data=f)
    
    if resp.status_code in (200, 201):
        print(f"[OK] Model uploaded successfully")
        return True
    else:
        print(f"Error uploading: {resp.status_code}")
        return False


def list_registries() -> bool:
    """List all model registries"""
    url = api_url(f"/entities/{WANDB_ENTITY}/projects/{WANDB_PROJECT}/artifacts")
    resp = requests.get(url, headers=get_headers())
    
    if resp.status_code != 200:
        print(f"Error: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    artifacts = data.get("artifacts", [])
    
    print(f"\nModel Registries in {WANDB_ENTITY}/{WANDB_PROJECT}:")
    print("-" * 60)
    
    model_artifacts = [a for a in artifacts if a.get("type") == "model"]
    if not model_artifacts:
        print("  No model registries found")
    else:
        for art in model_artifacts:
            print(f"  [MODEL] {art.get('name')} - {art.get('versionCount', 0)} versions")
    
    return True


def list_models() -> bool:
    """List all models in the registry"""
    url = api_url(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}/versions")
    resp = requests.get(url, headers=get_headers())
    
    if resp.status_code != 200:
        print(f"Error: {resp.status_code} - {resp.text}")
        return False
    
    data = resp.json()
    versions = data.get("versions", [])
    
    print(f"\nModels in {WANDB_ARTIFACT}:")
    print("-" * 60)
    
    if not versions:
        print("  No models found")
    else:
        for v in versions:
            aliases = v.get("aliases", [])
            created = v.get("createdAt", "")[:19]
            print(f"  {v.get('version'):12} | {aliases} | {created}")
    
    return True


def add_alias(version: str, alias: str) -> bool:
    """Add alias to a model version"""
    url = api_url(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}/versions/{version}")
    resp = requests.patch(
        url,
        headers=get_headers(),
        json={"aliases": [alias]}
    )
    
    if resp.status_code == 200:
        print(f"[OK] Added alias '{alias}' to {version}")
        return True
    else:
        print(f"Error: {resp.status_code} - {resp.text}")
        return False


@click.group()
def cli():
    """Manage W&B Model Registry via REST API"""
    pass


@cli.command("create")
def create_cmd():
    """Create the model registry"""
    if not WANDB_API_KEY:
        print("Error: WANDB_API_KEY not set")
        sys.exit(1)
    success = create_registry()
    sys.exit(0 if success else 1)


@cli.command("list")
def list_cmd():
    """List registries and models"""
    if not WANDB_API_KEY:
        print("Error: WANDB_API_KEY not set")
        sys.exit(1)
    list_registries()
    list_models()


@cli.command("models")
def models_cmd():
    """List models in current registry"""
    if not WANDB_API_KEY:
        print("Error: WANDB_API_KEY not set")
        sys.exit(1)
    list_models()


@cli.command("add-alias")
@click.option("--version", required=True, help="Model version")
@click.option("--alias", required=True, help="Alias to add")
def add_alias_cmd(version: str, alias: str):
    """Add alias to a model version"""
    if not WANDB_API_KEY:
        print("Error: WANDB_API_KEY not set")
        sys.exit(1)
    success = add_alias(version, alias)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    cli()
