#!/usr/bin/env python3
"""Generate a synthetic image with simple colors to test YOLO inference path."""
import os
import sys
import base64
import json
import urllib.request
import urllib.error


def try_pillow_image():
    """Generate a synthetic image with simple colored shapes."""
    try:
        from PIL import Image, ImageDraw, ImageFilter
        import io
    except ImportError:
        print("Pillow not available")
        return None

    # Create a synthetic "tomato-like" red circle on white background
    img = Image.new("RGB", (640, 480), "white")
    draw = ImageDraw.Draw(img)
    # Big red tomato
    draw.ellipse([(200, 150), (440, 380)], fill=(220, 30, 30), outline=(150, 10, 10), width=3)
    # Green stem
    draw.rectangle([(310, 130), (330, 160)], fill=(40, 140, 40))
    # Yellow onion
    draw.ellipse([(450, 200), (580, 330)], fill=(220, 200, 100), outline=(140, 110, 40), width=2)
    # Brown potato
    draw.ellipse([(50, 280), (170, 380)], fill=(170, 130, 80), outline=(120, 80, 40), width=2)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    data = buf.getvalue()
    b64 = base64.b64encode(data).decode("ascii")
    with open(r"D:\yolo-synthetic.jpg", "wb") as f:
        f.write(data)
    print(f"Generated synthetic image: {len(data)} bytes, base64={len(b64)}")
    return b64


def download_food_image():
    """Try to fetch a known food image via alternate sources."""
    sources = [
        # Pixabay direct CDN (no auth needed for embedded)
        ("https://cdn.pixabay.com/photo/2017/01/20/15/30/vegetables-1995054_200x200.jpg", "veg.jpg"),
    ]
    headers = {"User-Agent": "Mozilla/5.0"}
    for url, _ in sources:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read()
                if len(data) > 2000:
                    b64 = base64.b64encode(data).decode("ascii")
                    with open(r"D:\yolo-food.jpg", "wb") as f:
                        f.write(data)
                    print(f"Food image: {url.split('/')[-1]} {len(data)} bytes")
                    return b64
        except Exception as e:
            print(f"  {e}")
    return None


def detect(b64, endpoint, label):
    body = json.dumps({"imageBase64": b64, "confidence": 0.2}).encode("utf-8")
    print()
    print(f"=== {label} ===")
    print(f"POST {endpoint}")
    req = urllib.request.Request(
        endpoint,
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
        with urllib.request.urlopen(req, timeout=90) as resp:
            data = resp.read().decode("utf-8", errors="replace")
            print(f"Status: {resp.status}")
            try:
                j = json.loads(data)
                print(json.dumps(j, indent=2, ensure_ascii=False))
                return j
            except Exception:
                print(data[:2000])
                return None
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        print(f"HTTP {e.code}: {e.reason}")
        try:
            j = json.loads(body_err)
            print(json.dumps(j, indent=2, ensure_ascii=False))
            return j
        except Exception:
            print(body_err[:2000])
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None


def main():
    os.environ["PYTHONIOENCODING"] = "utf-8"
    b64 = None

    # Try Pillow first
    b64 = try_pillow_image()

    # Fall back to download
    if not b64:
        b64 = download_food_image()

    if not b64:
        print("No image available, aborting")
        sys.exit(1)

    print(f"\nUsing image, calling /api/yolo/detect...")
    res = detect(b64, "https://api.cooksmart.click/api/yolo/detect", "YOLO /detect")
    if res and res.get("success") and res.get("data", {}).get("detected"):
        print()
        print("=" * 60)
        print("✓✓✓ YOLO SUCCESSFULLY DETECTED INGREDIENTS ✓✓✓")
        print("=" * 60)
        for ing in res["data"]["ingredients"]:
            print(f"  - {ing.get('label','?')} (conf={ing.get('confidence',0):.2f})")


if __name__ == "__main__":
    main()