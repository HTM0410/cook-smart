#!/usr/bin/env python3
"""Generate image with 3 distinct food-like objects."""
import os, sys, base64, json
from PIL import Image, ImageDraw, ImageFilter
import io
import urllib.request


def make():
    img = Image.new("RGB", (800, 600), "white")
    d = ImageDraw.Draw(img)
    # Tomato (red)
    d.ellipse([(100, 100), (300, 300)], fill=(220, 30, 30), outline=(140, 10, 10), width=4)
    d.rectangle([(190, 80), (210, 110)], fill=(40, 140, 40))
    # Onion (yellowish)
    d.ellipse([(400, 150), (570, 320)], fill=(220, 190, 100), outline=(140, 120, 50), width=4)
    # Potato (brown)
    d.ellipse([(150, 380), (300, 510)], fill=(170, 130, 80), outline=(110, 80, 40), width=4)
    # Carrot (orange thin)
    d.polygon([(500, 400), (450, 540), (530, 540)], fill=(230, 120, 30))
    d.polygon([(440, 530), (540, 530), (520, 580), (460, 580)], fill=(100, 60, 10))
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    data = buf.getvalue()
    b64 = base64.b64encode(data).decode("ascii")
    with open(r"D:\yolo-multi.jpg", "wb") as f:
        f.write(data)
    return b64


def detect(b64):
    body = json.dumps({"imageBase64": b64, "confidence": 0.15}).encode("utf-8")
    print(f"Image base64 length: {len(b64)}")
    print(f"POST https://api.cooksmart.click/api/yolo/detect")
    req = urllib.request.Request(
        "https://api.cooksmart.click/api/yolo/detect",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Origin": "https://cooksmart.click",
            "Referer": "https://cooksmart.click/scan",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = resp.read().decode("utf-8", errors="replace")
            print(f"Status: {resp.status}")
            j = json.loads(data)
            print(json.dumps(j, indent=2, ensure_ascii=False))
            return j
    except Exception as e:
        print(f"Error: {e}")
        return None


if __name__ == "__main__":
    os.environ["PYTHONIOENCODING"] = "utf-8"
    b64 = make()
    print(f"Generated image ({len(base64.b64decode(b64))} bytes)")
    res = detect(b64)
    if res:
        ingredients = res.get("data", {}).get("ingredients", [])
        print(f"\n{'='*60}")
        print(f"DETECTED {len(ingredients)} ITEMS")
        print(f"{'='*60}")
        for ing in ingredients:
            print(f"  - {ing.get('name', ing.get('yolo_label'))} (conf={ing.get('confidence', 0):.4f}, bbox={ing.get('bbox')})")