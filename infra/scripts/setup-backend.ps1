# ============================================================
# Setup Terraform Backend (S3 + DynamoDB) - chay 1 LAN DUY NHAT
# ============================================================
# Script nay tao S3 bucket cho tfstate va DynamoDB table cho lock.
# Can chay truoc khi terraform init (vi backend.tf da khai bao).
# ============================================================

param(
    [string]$BucketName = "cooksmart-tfstate",
    [string]$TableName  = "cooksmart-tflock",
    [string]$Region     = "ap-southeast-1"
)

$ErrorActionPreference = "Stop"

# ----- Pre-checks -----
Write-Host "[1/3] Kiem tra prerequisites..." -ForegroundColor Cyan
try {
    $identity = aws sts get-caller-identity 2>&1 | ConvertFrom-Json
    Write-Host "  OK: AWS Account $($identity.Account)" -ForegroundColor Green
} catch {
    Write-Host "  FAIL: Chay aws configure truoc" -ForegroundColor Red
    exit 1
}

# ----- S3 bucket -----
Write-Host "[2/3] Tao S3 bucket: $BucketName..." -ForegroundColor Cyan
$exists = aws s3api head-bucket --bucket $BucketName --region $Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Bucket da ton tai, skip." -ForegroundColor Yellow
} else {
    # Tao bucket (LocationConstraint chi ap dung neu khac us-east-1)
    if ($Region -eq "us-east-1") {
        aws s3api create-bucket --bucket $BucketName --region $Region
    } else {
        aws s3api create-bucket `
            --bucket $BucketName `
            --region $Region `
            --create-bucket-configuration LocationConstraint=$Region
    }

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL: Khong tao duoc bucket (co the da ton tai o region khac)" -ForegroundColor Red
        Write-Host "  Detail: $exists" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  OK: Tao bucket thanh cong" -ForegroundColor Green
}

# Enable versioning
aws s3api put-bucket-versioning `
    --bucket $BucketName `
    --versioning-configuration Status=Enabled `
    --region $Region

# Enable encryption (AES256 server-side)
aws s3api put-bucket-encryption `
    --bucket $BucketName `
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}' `
    --region $Region

# Block public access
aws s3api put-public-access-block `
    --bucket $BucketName `
    --public-access-block-configuration `
        "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" `
    --region $Region

Write-Host "  OK: Bucket da enable versioning + encryption + block public access" -ForegroundColor Green

# ----- DynamoDB table -----
Write-Host "[3/3] Tao DynamoDB table: $TableName..." -ForegroundColor Cyan
$tableExists = aws dynamodb describe-table --table-name $TableName --region $Region 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Table da ton tai, skip." -ForegroundColor Yellow
} else {
    aws dynamodb create-table `
        --table-name $TableName `
        --attribute-definitions AttributeName=LockID,AttributeType=S `
        --key-schema AttributeName=LockID,KeyType=HASH `
        --billing-mode PAY_PER_REQUEST `
        --region $Region

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  FAIL: Khong tao duoc table" -ForegroundColor Red
        exit 1
    }
    Write-Host "  OK: Tao table thanh cong" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Backend setup HOAN TAT!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Bucket:  s3://$BucketName (region $Region)" -ForegroundColor Cyan
Write-Host "Lock:    $TableName (region $Region)" -ForegroundColor Cyan
Write-Host ""
Write-Host "Buoc tiep theo:" -ForegroundColor Yellow
Write-Host "  1. Copy terraform.tfvars.example thanh terraform.tfvars" -ForegroundColor White
Write-Host "  2. Dien VPC ID, subnet IDs, ACM ARN, CodeStar connection ARN" -ForegroundColor White
Write-Host "  3. Chay: terraform init" -ForegroundColor White
Write-Host "  4. Chay: terraform plan" -ForegroundColor White
Write-Host "  5. Chay: terraform apply (sau khi review plan)" -ForegroundColor White
Write-Host ""
Write-Host "Hoac dung wrapper: .\deploy.ps1 -Action plan" -ForegroundColor Cyan