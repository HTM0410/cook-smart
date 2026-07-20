# Deploy YOLO ECS service to task definition revision 9 with MLOps enabled.
# Usage: powershell -ExecutionPolicy Bypass -File deploy_yolo_v9.ps1
$ErrorActionPreference = 'Stop'
$Region = 'ap-southeast-1'
$Cluster = 'cooksmart-prod-v2'
$Service = 'cooksmart-prod-v2-yolo-svc'
$TaskDef = 'cooksmart-yolo-task:9'

Write-Host "[deploy_yolo] Updating service to $TaskDef ..."
aws ecs update-service --cluster $Cluster --service $Service --task-definition $TaskDef --force-new-deployment --region $Region | Out-Null

Write-Host "[deploy_yolo] Waiting for service to stabilize (timeout 600s) ..."
$stable = aws ecs wait services-stable --cluster $Cluster --services $Service --region $Region
if ($LASTEXITCODE -eq 0) {
    Write-Host "[deploy_yolo] Service stable on $TaskDef" -ForegroundColor Green
} else {
    Write-Host "[deploy_yolo] FAILED to stabilize" -ForegroundColor Red
    exit 1
}

Write-Host "[deploy_yolo] Final status:"
aws ecs describe-services --cluster $Cluster --services $Service --region $Region --query 'services[0].{status:status,running:runningCount,desired:desiredCount,taskDef:taskDefinition,deployments:deployments[*].{status:status,taskDef:taskDefinition}}' --output json