$ErrorActionPreference = "Stop"

if (-not $env:DVC_S3_REMOTE_URL) {
    throw "Set DVC_S3_REMOTE_URL, for example s3://my-bucket/food-suggest/dvc"
}

dvc remote add --force --default storage $env:DVC_S3_REMOTE_URL

if ($env:AWS_DEFAULT_REGION) {
    dvc remote modify storage region $env:AWS_DEFAULT_REGION
}

dvc remote modify storage sse AES256
Write-Host "Configured DVC remote 'storage' at $env:DVC_S3_REMOTE_URL"
