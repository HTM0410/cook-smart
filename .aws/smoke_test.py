#!/usr/bin/env python3
"""End-to-end smoke test for CookSmart MLOps production deployment."""
import requests
import sys
import time

ALB = "http://cooksmart-prod-v2-alb-881116705.ap-southeast-1.elb.amazonaws.com"

print("=" * 60)
print("CookSmart MLOps Smoke Test")
print("=" * 60)

# 1. Backend health
print("\n[1/4] Backend /health")
try:
    r = requests.get(f"{ALB}/health", timeout=10)
    print(f"  Status: {r.status_code}")
    if r.status_code == 200:
        j = r.json()
        print(f"  uptime: {j.get('uptime', 'N/A')}s")
        print(f"  service: {j.get('service')}")
        print(f"  version: {j.get('version')}")
except Exception as e:
    print(f"  Error: {e}")

# 2. Backend metrics
print("\n[2/4] Backend /metrics (Prometheus)")
try:
    r = requests.get(f"{ALB}/metrics", timeout=10)
    print(f"  Status: {r.status_code}")
    print(f"  Body size: {len(r.text)} bytes")
    sample = [l for l in r.text.split("\n") if l.startswith("yolo_")][:5]
    print(f"  YOLO metrics sample:")
    for s in sample:
        print(f"    {s}")
except Exception as e:
    print(f"  Error: {e}")

# 3. YOLO via backend
print("\n[3/4] Backend /api/yolo/labels")
try:
    r = requests.get(f"{ALB}/api/yolo/labels", timeout=30)
    print(f"  Status: {r.status_code}")
    if r.status_code == 200:
        j = r.json()
        labels = j.get("labels") or j.get("class_names") or []
        print(f"  Total labels: {len(labels)}")
        if labels:
            print(f"  First 5: {labels[:5]}")
    else:
        print(f"  Body: {r.text[:200]}")
except Exception as e:
    print(f"  Error: {e}")

# 4. Detect endpoint (real test)
print("\n[4/4] POST /api/yolo/detect with test image")
try:
    img_path = "d:/2025.2/DA/food_suggest/.aws/test_food.jpg"
    with open(img_path, "rb") as f:
        files = {"image": ("test.jpg", f, "image/jpeg")}
        r = requests.post(f"{ALB}/api/yolo/detect", files=files, timeout=60)
    print(f"  Status: {r.status_code}")
    print(f"  Body: {r.text[:500]}")
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "=" * 60)
print("Done.")