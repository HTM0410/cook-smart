# start-yolo.ps1 - Khởi động YOLO Inference Service
# Chạy: .\start-yolo.ps1

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$YoloServiceDir = Join-Path $ScriptDir "src\model_detection\yolo_inference_service"

Push-Location $YoloServiceDir

try {
    $env:YOLO_MODEL_PATH = ".\best59.pt"
    $env:CONF_INFERENCE_FLOOR = "0.25"
    $env:CUDA_VISIBLE_DEVICES = ""
    $env:EMBEDDING_ENABLED = "false"
    $env:MLOPS_ENABLED = "false"

    Write-Host "Starting YOLO Inference Service..."
    Write-Host "  Model: $env:YOLO_MODEL_PATH"
    Write-Host "  Port: 8000"
    Write-Host ""

    & ".\venv\Scripts\python.exe" -m uvicorn app:app --host 0.0.0.0 --port 8000
} finally {
    Pop-Location
}
