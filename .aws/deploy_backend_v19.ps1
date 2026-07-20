# Deploy Backend ECS service to task definition revision 19 with MLOPS_ENABLED=true.
# Usage: powershell -ExecutionPolicy Bypass -File deploy_backend_v19.ps1
$ErrorActionPreference = 'Stop'
$Region = 'ap-southeast-1'
$Cluster = 'cooksmart-prod-v2'
$Service = 'cooksmart-backend'
$TaskDef = 'cooksmart-backend-task:19'

Write-Host "[deploy_backend] Updating service to $TaskDef ..."
aws ecs update-service --cluster $Cluster --service $Service --task-definition $TaskDef --force-new-deployment --region $Region | Out-Null

Write-Host "[deploy_backend] Waiting for service to stabilize (timeout 600s) ..."
$stable = aws ecs wait services-stable --cluster $Cluster --services $Service --region $Region
if ($LASTEXITCODE -eq 0) {
    Write-Host "[deploy_backend] Service stable on $TaskDef" -ForegroundColor Green
} else {
    Write-Host "[deploy_backend] FAILED to stabilize" -ForegroundColor Red
    exit 1
}

Write-Host "[deploy_backend] Final status:"
aws ecs describe-services --cluster $Cluster --services $Service --region $Region --query 'services[0].{status:status,running:runningCount,desired:desiredCount,taskDef:taskDefinition,deployments:deployments[*].{status:status,taskDef:taskDefinition}}' --output json