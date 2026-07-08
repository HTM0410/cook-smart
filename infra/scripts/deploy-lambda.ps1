#!/usr/bin/env pwsh
# =============================================================================
# CookSmart Lambda Deploy Helper (PowerShell wrapper)
# Mirror cua deploy-lambda.sh cho Windows dev.
#
# Su dung:
#   .\deploy-lambda.ps1 -Function cooksmart-prod-v2-yolo-infer -ImageUri URI
#   .\deploy-lambda.ps1 -Rollback -Function cooksmart-prod-v2-yolo-infer
# =============================================================================

param(
    [Parameter(Mandatory=$false)]
    [string]$Function,

    [Parameter(Mandatory=$false)]
    [string]$ImageUri,

    [Parameter(Mandatory=$false)]
    [string]$Alias = "prod",

    [Parameter(Mandatory=$false)]
    [string]$Region = "ap-southeast-1",

    [Parameter(Mandatory=$false)]
    [switch]$Rollback,

    [Parameter(Mandatory=$false)]
    [switch]$NoPublish,

    [Parameter(Mandatory=$false)]
    [switch]$NoWait
)

$ErrorActionPreference = "Stop"

function Update-LambdaFunction {
    param([string]$FuncName, [string]$Image, [bool]$Wait)

    Write-Host ">> Updating $FuncName -> $Image" -ForegroundColor Cyan

    if (-not $NoPublish) {
        $updateResult = aws lambda update-function-code `
            --function-name $FuncName `
            --image-uri $Image `
            --region $Region `
            --publish `
            --query 'Version' --output text
        Write-Host "   Published version: $updateResult" -ForegroundColor Green

        $aliasResult = aws lambda update-alias `
            --function-name $FuncName `
            --name $Alias `
            --function-version $updateResult `
            --region $Region `
            --query 'FunctionVersion' --output text
        Write-Host "   Alias $Alias -> version $aliasResult" -ForegroundColor Green
    } else {
        $updateResult = aws lambda update-function-code `
            --function-name $FuncName `
            --image-uri $Image `
            --region $Region `
            --query 'LastModified' --output text
        Write-Host "   Updated (no publish) at $updateResult" -ForegroundColor Green
    }

    if ($Wait) {
        Write-Host "   Waiting for $FuncName to become Active..." -ForegroundColor Yellow
        aws lambda wait function-updated --function-name $FuncName --region $Region
        Write-Host "   OK" -ForegroundColor Green
    }
}

function Invoke-LambdaRollback {
    param([string]$FuncName)

    Write-Host ">> Rolling back $FuncName via alias $Alias" -ForegroundColor Yellow
    $current = aws lambda get-alias --function-name $FuncName --name $Alias --region $Region `
        --query 'FunctionVersion' --output text
    Write-Host "   Current version: $current"

    $versions = aws lambda list-versions-by-function --function-name $FuncName --region $Region `
        --query 'Versions[?Version!=`$LATEST`].Version' --output text
    $sortedVersions = $versions -split "`t" | Where-Object { $_ -match '^\d+$' } | Sort-Object {[int]$_} -Descending
    $idx = $sortedVersions.IndexOf($current)
    if ($idx -lt 0 -or $idx + 1 -ge $sortedVersions.Count) {
        Write-Error "No previous version found"
        exit 1
    }
    $previous = $sortedVersions[$idx + 1]
    aws lambda update-alias --function-name $FuncName --name $Alias `
        --function-version $previous --region $Region `
        --query 'FunctionVersion' --output text | ForEach-Object {
            Write-Host "   Rolled back to version $_" -ForegroundColor Green
        }
}

if ($Rollback) {
    if (-not $Function) { Write-Error "--Function required"; exit 1 }
    Invoke-LambdaRollback -FuncName $Function
} else {
    if (-not $Function) { Write-Error "--Function required"; exit 1 }
    if (-not $ImageUri) { Write-Error "--ImageUri required"; exit 1 }
    Update-LambdaFunction -FuncName $Function -Image $ImageUri -Wait (-not $NoWait)
}

Write-Host ">> Done." -ForegroundColor Green
