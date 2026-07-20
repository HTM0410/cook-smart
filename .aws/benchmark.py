#!/usr/bin/env python3
"""Measure backend response times for common endpoints."""
import os, json, time, urllib.request, statistics


def get(url, h):
    req = urllib.request.Request(url, headers=h)
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            elapsed = (time.perf_counter() - t) * 1000
            body = r.read()
            return r.status, elapsed, len(body), r.headers.get("x-cache") or r.headers.get("cf-cache-status")
    except urllib.error.HTTPError as e:
        elapsed = (time.perf_counter() - t) * 1000
        return e.code, elapsed, len(e.read()), None
    except Exception as e:
        return None, -1, 0, str(e)


def post(url, payload, h):
    data = json.dumps(payload).encode("utf-8")
    hh = {"Content-Type": "application/json"} | h
    req = urllib.request.Request(url, data=data, headers=hh, method="POST")
    t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            elapsed = (time.perf_counter() - t) * 1000
            body = r.read()
            return r.status, elapsed, len(body), r.headers.get("x-cache") or r.headers.get("cf-cache-status")
    except urllib.error.HTTPError as e:
        elapsed = (time.perf_counter() - t) * 1000
        return e.code, elapsed, len(e.read()), None
    except Exception as e:
        return None, -1, 0, str(e)


H = {
    "Origin": "https://cooksmart.click",
    "Referer": "https://cooksmart.click/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

# Endpoints to test
TESTS = [
    ("GET /api/health", "GET", "https://api.cooksmart.click/api/health", None),
    ("GET /api/yolo/health", "GET", "https://api.cooksmart.click/api/yolo/health", None),
    ("GET /api/recipes", "GET", "https://api.cooksmart.click/api/recipes?page=1&limit=20", None),
    ("GET /api/categories", "GET", "https://api.cooksmart.click/api/categories", None),
    ("GET /api/ingredients", "GET", "https://api.cooksmart.click/api/ingredients?page=1&limit=50", None),
    ("GET /api/search?q=thit", "GET", "https://api.cooksmart.click/api/search?q=thit", None),
    ("POST /api/yolo/detect", "POST", "https://api.cooksmart.click/api/yolo/detect", {"imageBase64": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=", "confidence": 0.25}),
]


def main():
    os.environ["PYTHONIOENCODING"] = "utf-8"
    print(f"{'Endpoint':<28} {'Status':<8} {'Avg (ms)':<10} {'Min':<8} {'Max':<8} {'Body':<8} {'Cache':<10}")
    print("-" * 88)
    for name, method, url, payload in TESTS:
        times = []
        for _ in range(3):
            if method == "GET":
                s, ms, bs, cache = get(url, H)
            else:
                s, ms, bs, cache = post(url, payload, H)
            times.append(ms)
        if s is None:
            print(f"{name:<28} ERR     -")
            continue
        avg = statistics.mean(times)
        mn = min(times)
        mx = max(times)
        print(f"{name:<28} {str(s):<8} {avg:<10.1f} {mn:<8.1f} {mx:<8.1f} {bs:<8} {str(cache or '-'):<10}")


if __name__ == "__main__":
    main()