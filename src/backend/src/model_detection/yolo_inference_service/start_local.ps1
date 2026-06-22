# YOLO Inference Service Startup Script for Windows
# Usage: .\start_local.ps1 [-ModelPath <path>] [-Port <port>] [-Confidence <value>]

param(
    [string]$ModelPath = ".\best59.pt",
    [int]$Port = 8000,
    [float]$Confidence = 0.25
)

# Colors
$RED = "`e[0;31m"
$GREEN = "`e[0;32m"
$YELLOW = "`e[1;33m"
$NC = "`e[0m"

function Write-Step {
    param([string]$Message)
    Write-Host "${GREEN}[STEP]${NC} $Message"
}

function Write-Warn {
    param([string]$Message)
    Write-Host "${YELLOW}[WARN]${NC} $Message"
}

function Write-Err {
    param([string]$Message)
    Write-Host "${RED}[ERROR]${NC} $Message"
}

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if ($ScriptDir) {
    Set-Location $ScriptDir
}

Write-Host ""
Write-Host "========================================"
Write-Host "  YOLO Inference Service Setup"
Write-Host "========================================"
Write-Host ""

# Step 1: Create virtual environment
Write-Step "Creating virtual environment..."
if (-not (Test-Path "venv")) {
    python -m venv venv
    Write-Host "Virtual environment created."
} else {
    Write-Host "Virtual environment already exists."
}

# Step 2: Activate virtual environment
Write-Step "Activating virtual environment..."
& ".\venv\Scripts\Activate.ps1"

# Step 3: Install dependencies
Write-Step "Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Step 4: Check if model exists
Write-Step "Checking model file..."
if (-not (Test-Path $ModelPath)) {
    Write-Warn "Model file not found at $ModelPath"
    Write-Warn "The service will start but inference will fail until model is provided."
    Write-Host "You can specify model path with: .\start_local.ps1 -ModelPath <path>"
} else {
    Write-Host "Model found: $ModelPath"
}

# Step 5: Set environment variables
$env:YOLO_MODEL_PATH = $ModelPath
$env:CONF_INFERENCE_FLOOR = $Confidence
$env:CUDA_VISIBLE_DEVICES = ""
$env:PORT = $Port

Write-Host ""
Write-Host "========================================"
Write-Host "  YOLO Inference Service"
Write-Host "========================================"
Write-Host ""
Write-Host "  Model:      $ModelPath"
Write-Host "  Port:       $Port"
Write-Host "  Confidence: $Confidence"
Write-Host ""

# Step 6: Start the server
Write-Step "Starting server..."
Write-Host "Press Ctrl+C to stop."
Write-Host ""

uvicorn app:app --host 0.0.0.0 --port $Port --reload
