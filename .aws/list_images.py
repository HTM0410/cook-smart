#!/usr/bin/env python3
import boto3
import json

c = boto3.client("ecr", region_name="ap-southeast-1")
resp = c.describe_images(repositoryName="cooksmart-backend")
details = resp.get("imageDetails", [])
details.sort(key=lambda x: x.get("imagePushedAt", ""), reverse=True)
print(f"Total images: {len(details)}")
for d in details[:8]:
    tags = d.get("imageTags", [])
    tag = tags[0] if tags else "(untagged)"
    pushed = d.get("imagePushedAt", "")
    size_mb = d.get("imageSizeInBytes", 0) / 1024 / 1024
    print(f"  {tag:40} {pushed} {size_mb:.1f}MB")