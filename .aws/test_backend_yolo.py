#!/usr/bin/env python3
"""Verify Backend ↔ YOLO connectivity end-to-end."""
import os, sys, json
import urllib.request


def get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return None, str(e)


def post(url, body, headers=None):
    data = json.dumps(body).encode("utf-8")
    h = {"Content-Type": "application/json"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception as e:
        return None, str(e)


common_h = {
    "Origin": "https://cooksmart.click",
    "Referer": "https://cooksmart.click/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}


def main():
    os.environ["PYTHONIOENCODING"] = "utf-8"
    print("=" * 60)
    print("TEST 1: Backend /api/yolo/health")
    print("=" * 60)
    s, body = get("https://api.cooksmart.click/api/yolo/health", common_h)
    print(f"Status: {s}")
    try:
        j = json.loads(body)
        print(json.dumps(j, indent=2, ensure_ascii=False))
        data = j.get("data", {})
        if data.get("available") and data.get("modelLoaded"):
            print("✓ Backend successfully reached YOLO")
        else:
            print("✗ Backend reports YOLO not available / not loaded")
            return
    except Exception:
        print(f"Body: {body[:500]}")
        return

    print()
    print("=" * 60)
    print("TEST 2: Backend /api/yolo/info")
    print("=" * 60)
    s, body = get("https://api.cooksmart.click/api/yolo/info", common_h)
    print(f"Status: {s}")
    try:
        j = json.loads(body)
        print(json.dumps(j, indent=2, ensure_ascii=False))
    except Exception:
        print(body[:500])

    print()
    print("=" * 60)
    print("TEST 3: Backend /api/yolo/labels")
    print("=" * 60)
    s, body = get("https://api.cooksmart.click/api/yolo/labels", common_h)
    print(f"Status: {s}")
    try:
        j = json.loads(body)
        data = j.get("data", {})
        total = data.get("total") or data.get("count") or len(data.get("labels", []))
        print(f"Total labels: {total}")
        # Print first 5 labels
        labels = data.get("labels", [])
        if labels:
            print(f"First 5: {labels[:5]}")
    except Exception:
        print(body[:500])

    print()
    print("=" * 60)
    print("TEST 4: E2E detect with 1x1 px (should return 0 ingredients)")
    print("=" * 60)
    pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII="
    s, body = post(
        "https://api.cooksmart.click/api/yolo/detect",
        {"imageBase64": pixel, "confidence": 0.25},
        common_h,
    )
    print(f"Status: {s}")
    try:
        j = json.loads(body)
        print(json.dumps(j, indent=2, ensure_ascii=False))
        if j.get("success"):
            print("✓ Backend → YOLO inference pipeline WORKS")
    except Exception:
        print(body[:500])


if __name__ == "__main__":
    main()