"""Test W&B REST API directly."""
import requests
import json

API_KEY = "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"
HEADERS = {"Authorization": f"Bearer {API_KEY}"}

BASE_URL = "https://api.wandb.ai"

def get(path):
    resp = requests.get(f"{BASE_URL}{path}", headers=HEADERS)
    return resp

def post(path, data=None):
    if data:
        resp = requests.post(f"{BASE_URL}{path}", headers=HEADERS, json=data)
    else:
        resp = requests.post(f"{BASE_URL}{path}", headers=HEADERS)
    return resp

# Test 1: Get user info
print("=== Test 1: GET /api/v1/user ===")
resp = get("/api/v1/user")
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"User: {data}")
else:
    print(f"Response: {resp.text[:500]}")

# Test 2: Get projects
print("\n=== Test 2: GET /api/v1/projects ===")
resp = get("/api/v1/projects")
print(f"Status: {resp.status_code}")
if resp.status_code == 200:
    data = resp.json()
    print(f"Projects: {json.dumps(data, indent=2)[:1000]}")
else:
    print(f"Response: {resp.text[:500]}")

# Test 3: Get specific project
print("\n=== Test 3: GET /api/v1/htm0410/ingredient-detection ===")
resp = get("/api/v1/htm0410/ingredient-detection")
print(f"Status: {resp.status_code}")
if resp.status_code != 200:
    print(f"Response: {resp.text[:500]}")
