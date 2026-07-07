# ============================================================
# Terraform Deploy Script - Production Environment
# ============================================================
# Su dung: .\deploy.ps1 -Action [init|plan|apply|destroy|validate]
# Hoac:    .\deploy.ps1 -Action plan -AutoApprove=false
# ============================================================

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("init", "plan", "apply", "destroy", "validate", "fmt", "show")]
    [string]$Action,

    [switch]$AutoApprove,
    [string]$TfvarsFile = "terraform.tfvars",
    [string]$Region = "ap-southeast-1"
)

$ErrorActionPreference = "Stop"

# ----- Pre-checks -----
function Test-Prerequisites {
    Write-Host "[1/4] Kiem tra prerequisites..." -ForegroundColor Cyan

    # Terraform
    try {
        $tfVer = terraform --version 2>&1 | Select-Object -First 1
        Write-Host "  OK: $tfVer" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: terraform chua cai. Cai qua: winget install HashiCorp.Terraform" -ForegroundColor Red
        exit 1
    }

    # AWS CLI
    try {
        $awsVer = aws --version 2>&1 | Select-Object -First 1
        Write-Host "  OK: $awsVer" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: aws cli chua cai. Cai qua: winget install Amazon.AWSCLI" -ForegroundColor Red
        exit 1
    }

    # AWS credentials
    try {
        $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
        Write-Host "  OK: AWS Account $($identity.Account), User $($identity.Arn)" -ForegroundColor Green
    } catch {
        Write-Host "  FAIL: AWS credentials chua config. Chay: aws configure" -ForegroundColor Red
        exit 1
    }

    # tfvars file
    if (-not (Test-Path $TfvarsFile)) {
        Write-Host "  FAIL: Khong tim thay $TfvarsFile. Tao tu $TfvarsFile.example" -ForegroundColor Red
        Write-Host "        Copy: cp $TfvarsFile.example $TfvarsFile" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  OK: $TfvarsFile ton tai" -ForegroundColor Green
}

# ----- Init -----
function Invoke-Init {
    Write-Host "[2/4] Terraform init voi S3 backend..." -ForegroundColor Cyan
    terraform init -input=false -upgrade
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL: init that bai" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK: init thanh cong" -ForegroundColor Green
}

# ----- Validate -----
function Invoke-Validate {
    Write-Host "[3/4] Terraform validate..." -ForegroundColor Cyan
    terraform validate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL: validate that bai" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK: configuration hop le" -ForegroundColor Green
}

# ----- Format -----
function Invoke-Fmt {
    Write-Host "[3/4] Terraform fmt..." -ForegroundColor Cyan
    terraform fmt -recursive ../../
    Write-Host "  OK: format xong" -ForegroundColor Green
}

# ----- Plan -----
function Invoke-Plan {
    Write-Host "[3/4] Terraform plan..." -ForegroundColor Cyan
    $planFile = "tfplan-$(Get-Date -Format 'yyyyMMdd-HHmmss').bin"
    terraform plan -input=false -var-file=$TfvarsFile -out=$planFile
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL: plan that bai" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK: plan thanh cong. File: $planFile" -ForegroundColor Green
    Write-Host "  Xem chi tiet: terraform show $planFile" -ForegroundColor Yellow
    return $planFile
}

# ----- Apply -----
function Invoke-Apply {
    $planFile = Invoke-Plan
    Write-Host "[4/4] Terraform apply..." -ForegroundColor Cyan
    if ($AutoApprove) {
        terraform apply -input=false -auto-approve $planFile
    } else {
        Write-Host "  Can xac nhan de apply. Goi deploy.ps1 -Action apply -AutoApprove" -ForegroundColor Yellow
        $confirmation = Read-Host "  Apply plan '$planFile'? (yes/no)"
        if ($confirmation -eq "yes") {
            terraform apply -input=false $planFile
        } else {
            Write-Host "  Da huy." -ForegroundColor Yellow
            exit 0
        }
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL: apply that bai" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK: apply thanh cong!" -ForegroundColor Green
    Write-Host "  Outputs:" -ForegroundColor Cyan
    terraform output
}

# ----- Destroy -----
function Invoke-Destroy {
    Write-Host "[!] CANH BAO: Destroy se xoa toan bo infrastructure!" -ForegroundColor Red
    if (-not $AutoApprove) {
        $confirmation = Read-Host "  Ban co CHAC CHAN muon destroy? (yes/no)"
        if ($confirmation -ne "yes") {
            Write-Host "  Da huy." -ForegroundColor Yellow
            exit 0
        }
    }
    terraform destroy -input=false -var-file=$TfvarsFile -auto-approve
}

# ----- Show outputs -----
function Invoke-Show {
    terraform output -json | ConvertFrom-Json | ConvertTo-Json -Depth 5
}

# ----- Main -----
Set-Location $PSScriptRoot

Test-Prerequisites

switch ($Action) {
    "init"     { Invoke-Init; Invoke-Validate }
    "validate" { Invoke-Validate }
    "fmt"      { Invoke-Fmt }
    "plan"     { Invoke-Plan }
    "apply"    { Invoke-Apply }
    "destroy"  { Invoke-Destroy }
    "show"     { Invoke-Show }
    default    { Write-Host "Unknown action: $Action" -ForegroundColor Red; exit 1 }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green