# Enable EventBridge rule to invoke Lambda `cooksmart-prod-v2-drift-job` every 6 hours.
$ErrorActionPreference = 'Continue'
$Region = 'ap-southeast-1'
$AccountId = '294060270105'
$LambdaName = 'cooksmart-prod-v2-drift-job'
$RuleName = 'cooksmart-prod-v2-drift-job-schedule'
$RoleName = 'cooksmart-drift-events-role'
$Schedule = 'cron(0 */6 * * ? *)'

# 1. IAM role for events.amazonaws.com
Write-Host "[drift_cron] Ensuring IAM role $RoleName ..."
$roleExists = aws iam get-role --role-name $RoleName --region $Region 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[drift_cron] Creating role ..."
    aws iam create-role --role-name $RoleName --assume-role-policy-document file://d:/2025.2/DA/food_suggest/.aws/drift-events-role-trust.json --region $Region | Out-Null
} else {
    Write-Host "[drift_cron] Role already exists."
}

aws iam put-role-policy --role-name $RoleName --policy-name InvokeDriftLambda --policy-document file://d:/2025.2/DA/food_suggest/.aws/drift-events-role-policy.json --region $Region | Out-Null
$RoleArn = (aws iam get-role --role-name $RoleName --region $Region --query 'Role.Arn' --output text)
Write-Host "[drift_cron] RoleArn: $RoleArn"

# 2. EventBridge rule
Write-Host "[drift_cron] Creating rule $RuleName with schedule $Schedule ..."
aws events put-rule --name $RuleName --schedule-expression $Schedule --state ENABLED --description "Trigger cooksmart-prod-v2-drift-job every 6 hours" --region $Region | Out-Null

# 3. Target: Lambda invoke with payload {"action":"run"}
$targetSpec = @"
[
  {
    "Id": "1",
    "Arn": "arn:aws:lambda:${Region}:${AccountId}:function:${LambdaName}",
    "RoleArn": "${RoleArn}",
    "Input": "{\"action\":\"run\"}"
  }
]
"@
$tmpDir = $env:TEMP
$targetSpec | Out-File -FilePath "$tmpDir\drift-target.json" -Encoding utf8
aws events put-targets --rule $RuleName --targets "file://$tmpDir\drift-target.json" --region $Region | Out-Null

# 4. Permission for EventBridge to invoke Lambda
Write-Host "[drift_cron] Adding Lambda invoke permission ..."
$permResult = aws lambda add-permission --function-name $LambdaName --statement-id "AllowEventsFromRule-${RuleName}" --action "lambda:InvokeFunction" --principal events.amazonaws.com --source-arn "arn:aws:events:${Region}:${AccountId}:rule/${RuleName}" --region $Region 2>&1
Write-Host $permResult

# 5. Verify
Write-Host "[drift_cron] Rule state:"
aws events describe-rule --name $RuleName --region $Region --query '{name:Name,state:State,schedule:ScheduleExpression}' --output json
Write-Host "[drift_cron] Targets:"
aws events list-targets-by-rule --rule $RuleName --region $Region --query 'Targets[*].{id:Id,arn:Arn,input:Input}' --output json

# 6. Manual test invoke
Write-Host "[drift_cron] Manual invoke Lambda test ..."
$tmpDir = $env:TEMP
$payload = '{"action":"run"}'
aws lambda invoke --function-name $LambdaName --payload $payload --region $Region "$tmpDir\drift-test-output.json"
Get-Content "$tmpDir\drift-test-output.json"
Write-Host ""
Write-Host "[drift_cron] Done."