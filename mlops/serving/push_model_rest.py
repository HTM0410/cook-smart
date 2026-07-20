"""Upload model to W&B using REST API (no wandb service needed).

Usage:
    python push_model_rest.py
"""
import hashlib
import json
import os
import requests

WANDB_API_KEY = os.environ.get("WANDB_API_KEY", "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")
WANDB_ENTITY = "htm0410"
WANDB_PROJECT = "ingredient-detection"
WANDB_ARTIFACT = "ingredient-detector"

MODEL_PATH = "D:/2025.2/DA/food_suggest/mlops/artifacts/model/v1.0.0-20260629-ga1b2c3.pt"

HEADERS = {
    "Authorization": f"Bearer {WANDB_API_KEY}",
    "Content-Type": "application/json",
}


def api_get(path):
    resp = requests.get(f"https://api.wandb.ai/api/v1{path}", headers=HEADERS)
    return resp


def api_post(path, json_data):
    resp = requests.post(f"https://api.wandb.ai/api/v1{path}", headers=HEADERS, json=json_data)
    return resp


def api_put(path, data=None, headers=None):
    full_headers = {**HEADERS}
    if headers:
        full_headers.update(headers)
    resp = requests.put(f"https://api.wandb.ai/api/v1{path}", headers=full_headers, data=data)
    return resp


def get_project():
    """Get or create project"""
    resp = api_get(f"/entities/{WANDB_ENTITY}/projects/{WANDB_PROJECT}")
    if resp.status_code == 200:
        print(f"[OK] Project exists: {WANDB_ENTITY}/{WANDB_PROJECT}")
        return True
    elif resp.status_code == 404:
        print(f"Creating project: {WANDB_ENTITY}/{WANDB_PROJECT}")
        resp = api_post(f"/entities/{WANDB_ENTITY}/projects", {
            "name": WANDB_PROJECT,
            "description": "Ingredient detection project",
            "entityName": WANDB_ENTITY,
        })
        if resp.status_code in (200, 201):
            print(f"[OK] Project created")
            return True
        else:
            print(f"Error creating project: {resp.status_code} - {resp.text}")
            return False
    else:
        print(f"Error: {resp.status_code} - {resp.text}")
        return False


def upload_artifact_file(artifact_name, version, file_path):
    """Upload a file to an artifact using multipart upload"""
    import math
    
    file_size = os.path.getsize(file_path)
    
    # Create or get artifact version
    print(f"Creating artifact version: {artifact_name}:{version}")
    
    # Initialize multipart upload
    resp = api_post(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{artifact_name}/versions/{version}/initialize", {
        "md5": "placeholder",
        "size": file_size,
        "path": "best.pt",
    })
    
    print(f"Init response: {resp.status_code} - {resp.text[:500] if resp.text else 'empty'}")
    
    if resp.status_code not in (200, 201, 202):
        # Try alternate endpoint
        resp = api_post(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{artifact_name}", {
            "type": "model",
            "version": version,
            "name": artifact_name,
        })
        print(f"Create artifact response: {resp.status_code} - {resp.text[:500] if resp.text else 'empty'}")
    
    return True


def upload_simple():
    """Simple upload using PUT"""
    file_path = MODEL_PATH
    
    # Calculate MD5
    with open(file_path, "rb") as f:
        file_md5 = hashlib.md5(f.read()).hexdigest()
    
    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)
    
    print(f"\nFile: {file_name}")
    print(f"Size: {file_size} bytes")
    print(f"MD5: {file_md5}")
    
    # Step 1: Create artifact
    print("\n--- Step 1: Create Artifact ---")
    resp = api_post(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}", {
        "type": "model",
        "description": "Ingredient detector YOLO model v1.0.0",
    })
    print(f"Response: {resp.status_code}")
    if resp.status_code not in (200, 201):
        print(f"Text: {resp.text[:500]}")
    
    # Step 2: Create version
    print("\n--- Step 2: Create Version ---")
    resp = api_post(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}/versions", {
        "version": "v1.0.0",
        "description": "Production model",
    })
    print(f"Response: {resp.status_code}")
    if resp.status_code not in (200, 201, 202):
        print(f"Text: {resp.text[:500]}")
    else:
        data = resp.json()
        upload_url = data.get("uploadUrl")
        artifact_id = data.get("id")
        print(f"Artifact ID: {artifact_id}")
        print(f"Upload URL: {upload_url}")
        
        # Step 3: Upload file
        if upload_url:
            print("\n--- Step 3: Upload File ---")
            with open(file_path, "rb") as f:
                resp = requests.put(upload_url, data=f, headers={
                    "Authorization": f"Bearer {WANDB_API_KEY}",
                    "Content-Type": "application/octet-stream",
                    "Content-MD5": file_md5,
                })
            print(f"Upload Response: {resp.status_code}")
            if resp.status_code not in (200, 201, 204):
                print(f"Text: {resp.text[:500]}")
            else:
                print("[OK] File uploaded!")
                
                # Step 4: Add alias
                print("\n--- Step 4: Add Alias ---")
                resp = api_post(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}/versions/v1.0.0/aliases", {
                    "aliases": ["production"]
                })
                print(f"Alias Response: {resp.status_code}")
                if resp.status_code not in (200, 201):
                    print(f"Text: {resp.text[:500]}")
                else:
                    print("[OK] Alias 'production' added!")


def list_artifacts():
    """List artifacts in the project"""
    print("\n--- Listing Artifacts ---")
    resp = api_get(f"/artifacts/{WANDB_ENTITY}/{WANDB_PROJECT}/{WANDB_ARTIFACT}/versions")
    print(f"Response: {resp.status_code}")
    if resp.status_code == 200:
        data = resp.json()
        versions = data.get("versions", [])
        print(f"Found {len(versions)} versions:")
        for v in versions:
            print(f"  - {v.get('version')} | {v.get('aliases', [])}")
    else:
        print(f"Text: {resp.text[:500]}")


if __name__ == "__main__":
    print(f"Using API key: {WANDB_API_KEY[:20]}...")
    print(f"Entity: {WANDB_ENTITY}")
    print(f"Project: {WANDB_PROJECT}")
    print(f"Artifact: {WANDB_ARTIFACT}")
    
    # Test connection
    print("\n--- Testing Connection ---")
    resp = api_get("/user")
    if resp.status_code == 200:
        user = resp.json()
        print(f"[OK] Logged in as: {user.get('name')} ({user.get('email')})")
    else:
        print(f"Login check: {resp.status_code}")
    
    # Get project
    get_project()
    
    # Upload model
    upload_simple()
    
    # List artifacts
    list_artifacts()
