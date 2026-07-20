"""Upload model to W&B via direct API (no wandb.init required).

Usage:
    python push_model_direct.py
"""
import os
import sys

# Must set before importing wandb
os.environ['WANDB_SERVICE'] = 'false'

import wandb
import tempfile
from pathlib import Path

# Config
WANDB_ENTITY = "htm0410"
WANDB_PROJECT = "ingredient-detection"
WANDB_ARTIFACT = "ingredient-detector"
MODEL_DIR = Path("D:/2025.2/DA/food_suggest/mlops/artifacts/model")

def login():
    api_key = os.environ.get("WANDB_API_KEY", "")
    if not api_key:
        print("Error: WANDB_API_KEY not set")
        sys.exit(1)
    
    wandb.login(key=api_key)
    print("[OK] Logged in to W&B")

def create_and_upload_model(version: str, model_file: Path, aliases: list[str], metrics: dict = None):
    """Create artifact and upload model file"""
    api = wandb.Api(timeout=120)
    
    artifact_name = f"{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}"
    
    print(f"\nUploading {model_file.name} to {artifact_name}:{version}")
    print(f"Aliases: {aliases}")
    
    # Create artifact with the model file
    artifact = wandb.Artifact(
        name=WANDB_ARTIFACT,
        type="model",
        metadata={
            "version": version,
            "description": f"Ingredient detector YOLO model {version}",
            "metrics": metrics or {},
        }
    )
    
    # Add model file
    artifact.add_file(str(model_file), name="best.pt")
    
    # Log to W&B
    run = wandb.init(
        project=WANDB_PROJECT,
        entity=WANDB_ENTITY,
        mode="offline",
        anonymous="never",
    )
    run.log_artifact(artifact, aliases=aliases)
    run.finish()
    
    # Sync to cloud
    wandb.sync(anonymous="never")
    
    print(f"[OK] Uploaded {version} with aliases: {aliases}")

def list_models():
    """List all model versions"""
    api = wandb.Api(timeout=60)
    artifact_name = f"{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}"
    
    print(f"\nModels in {artifact_name}:")
    print("-" * 60)
    
    try:
        artifacts = api.artifacts("model", artifact_name)
        for art in artifacts:
            print(f"  {art.version:12} | {art.aliases} | {str(art.created_at)[:19]}")
    except Exception as e:
        print(f"  Error: {e}")

def upload_all_models():
    """Upload all models from manifest"""
    import json
    
    manifest_path = MODEL_DIR / "manifest.json"
    if not manifest_path.exists():
        print("Error: manifest.json not found")
        return
    
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    models = manifest.get("models", {})
    
    print(f"\nUploading {len(models)} models from manifest...")
    
    for version, info in models.items():
        filename = info.get("filename")
        model_path = MODEL_DIR / filename
        
        if not model_path.exists():
            print(f"  [SKIP] {filename} - file not found")
            continue
        
        aliases = info.get("aliases", [version])
        metrics = info.get("metrics", {})
        
        try:
            create_and_upload_model(version, model_path, aliases, metrics)
        except Exception as e:
            print(f"  [ERROR] {version}: {e}")

if __name__ == "__main__":
    login()
    
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--list", action="store_true", help="List models")
    parser.add_argument("--upload-all", action="store_true", help="Upload all models from manifest")
    parser.add_argument("--version", help="Specific version to upload")
    args = parser.parse_args()
    
    if args.list:
        list_models()
    elif args.upload_all:
        upload_all_models()
    elif args.version:
        manifest_path = MODEL_DIR / "manifest.json"
        import json
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        version = args.version
        info = manifest.get("models", {}).get(version)
        if not info:
            print(f"Version {version} not found in manifest")
            sys.exit(1)
        
        filename = info.get("filename")
        model_path = MODEL_DIR / filename
        aliases = info.get("aliases", [version])
        create_and_upload_model(version, model_path, aliases, info.get("metrics"))
    else:
        # Default: list models
        list_models()
