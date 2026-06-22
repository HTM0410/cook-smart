from __future__ import annotations

import os
import subprocess


def run(*args: str) -> None:
    subprocess.run(["dvc", *args], check=True)


def main() -> None:
    remote_url = os.getenv("DVC_S3_REMOTE_URL", "").strip()
    if not remote_url.startswith("s3://"):
        raise SystemExit("DVC_S3_REMOTE_URL must be an s3:// URL")

    run("remote", "add", "--force", "--default", "storage", remote_url)
    region = os.getenv("AWS_DEFAULT_REGION", "").strip()
    if region:
        run("remote", "modify", "storage", "region", region)
    run("remote", "modify", "storage", "sse", "AES256")
    print(f"Configured DVC remote 'storage' at {remote_url}")


if __name__ == "__main__":
    main()
