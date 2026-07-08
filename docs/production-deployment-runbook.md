# Production Deployment Runbook - MLOps CookSmart

> **Mục tiêu**: Triển khai hệ thống MLOps nhận diện nguyên liệu lên AWS production với Blue/Green deployment, drift detection, monitoring đầy đủ. Frontend sẽ deploy lên Netlify thay vì S3 + CloudFront.

---

## Phase 0: Pre-flight Checklist (15 phút)

### 0.1 Tooling

```powershell
# Verify tools da cai
terraform --version    # >= 1.6
aws --version          # >= 2.x
git --version
```

Neu thieu, cai dat:
```powershell
winget install HashiCorp.Terraform
winget install Amazon.AWSCLI
```

### 0.2 AWS Credentials

```powershell
aws configure
# AWS Access Key ID: <paste>
# AWS Secret Access Key: <paste>
# Default region: ap-southeast-1
# Default output format: json

# Verify
aws sts get-caller-identity
# Phai tra ve JSON voi Account ID va ARN user.
```

### 0.3 IAM Permissions

User IAM can it nhat cac quyen sau (hoac `AdministratorAccess`):

```
ec2, ecs, ecr, elasticloadbalancing,
codepipeline, codebuild, codedeploy,
iam, logs, cloudwatch, sns,
s3, dynamodb, secretsmanager,
codestar-connections
```

### 0.4 Lay thong tin AWS hien co

```powershell
# Lay VPC
aws ec2 describe-vpcs --query "Vpcs[].[VpcId,Tags[?Key=='Name'].Value|[0]]" --output table

# Lay Subnets (can it nhat 2 public + 2 private o 2 AZ khac nhau)
aws ec2 describe-subnets --filters "Name=vpc-id,Values=<VPC_ID>" `
  --query "Subnets[].[SubnetId,AvailabilityZone,MapPublicIpOnLaunch]" --output table

# Lay ACM certificate (neu co)
aws acm list-certificates --query "CertificateSummaryList[].[CertificateArn,DomainName]" --output table
```

---

## Phase 1: Manual Setup (30 phút)

### 1.1 Tao CodeStar Connection (GitHub)

1. AWS Console > **Developer Tools** > **Settings** > **Connections**
2. **Create connection** > GitHub > Ten: `cooksmart-github`
3. **Install a new app** > Authorize > Chon repo cua ban
4. Quay lai AWS > Refresh > Status: **Available**
5. Lay ARN:
   ```powershell
   aws codestar-connections list-connections --query "Connections[].[ConnectionArn,ConnectionName,ConnectionStatus]" --output table
   ```

### 1.2 Tao ACM Certificate (neu can HTTPS)

1. AWS Console > **Certificate Manager** > **Request certificate**
2. Domain names: `api.yourdomain.com` (wildcard `*.yourdomain.com` cung duoc)
3. Validation: DNS (khuyen nghi) hoac Email
4. Sau khi status = Issued, lay ARN (xem lenh Phase 0.4).

### 1.3 Tao SNS Topic cho approval (khuyen nghi)

```powershell
aws sns create-topic --name cooksmart-deploy-approval --region ap-southeast-1

# Subscribe email de nhan notification approve
aws sns subscribe --topic-arn <TopicArn> --protocol email --notification-endpoint your-email@example.com

# Confirm subscription qua email.
```

---

## Phase 2: Terraform Backend (5 phút)

### 2.1 Tao S3 bucket cho tfstate

```powershell
cd D:\2025.2\DA\food_suggest\infra\scripts

.\setup-backend.ps1 `
    -BucketName "cooksmart-tfstate" `
    -TableName "cooksmart-tflock" `
    -Region "ap-southeast-1"
```

Output mong doi:
```
[2/3] Tao S3 bucket: cooksmart-tfstate...
  OK: Bucket da enable versioning + encryption + block public access
[3/3] Tao DynamoDB table: cooksmart-tflock...
  OK: Tao table thanh cong
========================================
Backend setup HOAN TAT!
========================================
```

### 2.2 Dien thong tin vao terraform.tfvars

```powershell
cd ..\envs\prod
cp terraform.tfvars.example terraform.tfvars
notepad terraform.tfvars
```

Dien cac gia tri:
- `aws_region` = `ap-southeast-1`
- `vpc_id` = `vpc-xxxxx`
- `public_subnets` = `["subnet-aaaa", "subnet-bbbb"]`
- `private_subnets` = `["subnet-cccc", "subnet-dddd"]`
- `acm_arn` = `arn:aws:acm:...` (hoac `null` neu dung HTTP only)
- `codestar_connection_arn` = `arn:aws:codestar-connections:...`
- `approval_sns_topic_arn` = `arn:aws:sns:...` (hoac `null`)
- `github_repo` = `owner/repo`

---

## Phase 3: Terraform Apply (15 phút)

### 3.1 Validate

```powershell
.\deploy.ps1 -Action validate
# Expected: "Success! The configuration is valid."
```

### 3.2 Plan (offline review)

```powershell
.\deploy.ps1 -Action plan
# Expected: file tfplan-YYYYMMDD-HHMMSS.bin duoc tao.
# Xem chi tiet:
terraform show tfplan-YYYYMMDD-HHMMSS.bin
```

**Review checklist**:
- [ ] Tao moi: ALB, 2 Target Groups (blue + green), 2 Listeners (prod HTTPS, test HTTP).
- [ ] Tao moi: ECS Cluster, ECS Service (YOLO).
- [ ] Tao moi: ECR repos (backend, yolo, drift).
- [ ] Tao moi: CodePipeline + CodeBuild + CodeDeploy.
- [ ] Tao moi: CloudWatch alarms (5xx, unhealthy hosts, CPU/MEM).
- [ ] Tao moi: Secrets (4 secrets empty, se fill o Phase 4).

### 3.3 Apply

```powershell
.\deploy.ps1 -Action apply -AutoApprove
# HOAC: .\deploy.ps1 -Action apply (se hoi confirm)
```

**Sau khi apply thanh cong**:
```powershell
terraform output
# Ghi lai cac ARN:
#   alb_dns_name (URL cong cong)
#   pipeline_name (Name de trigger)
#   ecr_yolo_url, ecr_backend_url, ecr_drift_url
#   secret_arns (dung cho Phase 4)
```

---

## Phase 4: Secrets Initialization (5 phút)

### 4.1 Lay cac secret ARN tu Terraform

```powershell
$secrets = terraform output -json secret_arns | ConvertFrom-Json
$secrets | Format-List
```

### 4.2 Set secret values

```powershell
.\infra\scripts\setup-secrets.ps1 `
    -Region "ap-southeast-1" `
    -WandbApiKey "your-wandb-key-here" `
    -DatabaseUrl "mysql://user:pass@host:3306/dbname" `
    -MetricsToken "" `        # de trong se auto-gen
    -PrometheusToken ""        # de trong se auto-gen
```

Tokens auto-gen duoc luu vao `infra/scripts/secrets-local.env`.

---

## Phase 5: Frontend Deploy to Netlify (5 phút)

### 5.1 Tạo Netlify Personal Access Token

1. Truy cập [Netlify User Settings > Applications > Personal access tokens](https://app.netlify.com/user/applications#personal-access-tokens)
2. Click **New access token**
3. Đặt tên: `github-actions-deploy`
4. Copy token

### 5.2 Thêm GitHub Secrets

Vào repo GitHub > Settings > Secrets and variables > Actions > New repository secret:

```
NETLIFY_AUTH_TOKEN = <token vừa tạo>
NETLIFY_SITE_ID = <site ID từ Netlify>
```

### 5.3 Tạo Netlify Site

1. Truy cập [Netlify Dashboard](https://app.netlify.com/)
2. Click **New site from Git** > chọn GitHub > repo `cook-smart`
3. Cấu hình:
   - Branch: `main`
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Base directory: `src/frontend`
4. Deploy và lấy Site ID

### 5.4 Push code de trigger deploy

```powershell
git push origin main
```

Workflow `deploy-frontend.yml` sẽ tự động build và deploy frontend lên Netlify.

## Phase 6: Initial Image Build & Deploy (20 phút)

### 6.1 Trigger CodePipeline lan dau

Co 2 cach:

**Cach 1: Push tag**:
```powershell
git tag v1.0.0
git push origin v1.0.0
```

**Cach 2: Console**:
1. AWS Console > **CodePipeline** > `cooksmart-prod-pipeline`
2. **Release change**

**Cach 3: CLI**:
```powershell
aws codepipeline start-pipeline-execution --name cooksmart-prod-pipeline
```

### 5.2 Theo doi deployment

```powershell
# Xem trang thai
aws codepipeline get-pipeline-state --name cooksmart-prod-pipeline --query "stageStates[].[stageName,status]" --output table

# Logs CodeBuild
aws logs tail /aws/codebuild/cooksmart-prod-build --follow

# Logs ECS
aws logs tail /ecs/cooksmart-prod-yolo --follow
```

**Cac stage**:
1. **Source** (30s): CodeStar pull code tu GitHub.
2. **Build** (5-10 phút): docker build backend + yolo + drift, push len ECR.
3. **Approval** (manual): Click **Approve** hoac **Reject** tren Console / qua email SNS.
4. **Deploy** (10 phút): CodeDeploy blue/green, kiem tra validate.

### 5.3 Verify Blue/Green thanh cong

```powershell
# Lay DNS name cua ALB
$albDns = terraform output -raw alb_dns_name

# Test endpoint
curl -fsS https://$albDns/health
# Phai tra ve: {"status":"ok"}

# Test detailed health (YOLO schema check)
curl -fsS https://$albDns/health/detailed
# Phai tra ve: {"model_loaded":true,"schema_compatible":true,"class_count":59}
```

---

## Phase 7: Drift Detection & Monitoring (10 phút)

### 7.1 Trigger drift detection lan dau

```powershell
# Lay drift service URL (ALB + path-based hoac direct)
$driftUrl = "http://<drift-service-hostname>:8100"

# Trigger drift job
python -m mlops.scripts.run_drift_job `
    --drift-url $driftUrl `
    --metrics-token $env:METRICS_TOKEN `
    --channels data concept prediction
```

Output:
```json
{
  "data_drift": {"drift": false, "min_p": 0.42},
  "concept_drift": {"drift": false, "p_value": 0.85},
  "prediction_drift": {"drift": false, "jsd": 0.02},
  "alert_level": 0
}
```

### 6.2 Setup Grafana

1. Truy cap `https://<alb_dns>:3001/grafana` (hoac public URL)
2. Login admin / change-me-now (DOI NGAY!)
3. Import dashboard: **Dashboards** > **Manage** > **Import** > Upload JSON tu `monitoring/grafana/dashboards/food-suggest-mlops.json`

### 6.3 Alertmanager setup (optional)

Edit `monitoring/alertmanager/alertmanager.yml`, them:
```yaml
route:
  receiver: 'team-email'
receivers:
  - name: 'team-email'
    email_configs:
      - to: 'your-team@example.com'
        from: 'alerts@example.com'
        smarthost: 'smtp.example.com:587'
        auth_username: 'alerts@example.com'
        auth_password: '<secret>'
```

---

## Phase 8: Smoke Test toàn diện (15 phút)

### 8.1 Detection flow

```powershell
# Tao test image (su dung 1 trong validation images co san)
$testImage = "mlops/data/yolo_dataset/images/test/your_test.jpg"

# Call backend API
curl -X POST https://$albDns/api/detect `
    -H "Authorization: Bearer <test-jwt>" `
    -F "image=@$testImage"

# Expected: JSON voi list detections + confidence + class names
```

### 8.2 Admin endpoints

```powershell
# Lay MLOps overview
curl https://$albDns/api/admin/mlops/overview -H "Authorization: Bearer <admin-jwt>"

# Feedback queue
curl https://$albDns/api/admin/mlops/feedback/queue?status=pending -H "Authorization: Bearer <admin-jwt>"
```

### 8.3 Verify pipelines

1. Truy cap CodePipeline console → Status = **Succeeded**.
2. Truy cap ECS console → Service `cooksmart-prod-yolo-svc`:
   - Tasks running = 1 (green)
   - Health = Healthy
   - Deployment = PRIMARY
3. ALB target groups:
   - Blue TG: 0 tasks (drain)
   - Green TG: 1 task healthy (active)

### 8.4 Verify metrics

- Prometheus: `https://<host>:9090` → query `up{job="cooksmart-yolo"}` → return 1.
- Grafana: Dashboard hien thi:
  - Request rate
  - Latency p50/p95/p99
  - Detection confidence histogram
  - Drift gauges (3 loai)

---

## Phase 9: Post-deploy Operations

### 9.1 Xem logs

```powershell
# ECS service logs
aws logs tail /ecs/cooksmart-prod-yolo --follow --region ap-southeast-1

# CodeBuild logs
aws logs tail /aws/codebuild/cooksmart-prod-build --follow --region ap-southeast-1

# CodeDeploy events
aws deploy list-deployments --application-name cooksmart-prod-yolo-codedeploy --region ap-southeast-1
```

### 9.2 Promote candidate model (manual)

```powershell
# Trigger promote + deploy workflow
python -m mlops.serving.promotion promote-and-deploy `
    --entity "htm0410" `
    --project "ingredient-detection" `
    --artifact "ingredient-detector" `
    --from-alias "candidate" `
    --to-alias "production" `
    --pipeline-name "cooksmart-prod-pipeline" `
    --region "ap-southeast-1"
```

### 9.3 Rollback (khi co van de)

```powershell
# Cach 1: Stop deployment dang chay
aws deploy stop-deployment `
    --deployment-id <DEPLOYMENT_ID> `
    --region ap-southeast-1

# Cach 2: Re-deploy image cu
aws ecs update-service `
    --cluster cooksmart-prod `
    --service cooksmart-prod-yolo-svc `
    --task-definition cooksmart-prod-yolo:<OLD_REVISION> `
    --region ap-southeast-1

# Cach 3: Switch traffic trong ALB (manual)
aws elbv2 modify-listener `
    --listener-arn <PROD_LISTENER_ARN> `
    --default-actions Type=forward,TargetGroupArn=<BLUE_TG_ARN> `
    --region ap-southeast-1
```

Xem them chi tiet trong `docs/rollback-procedure.md`.

---

## Cost Estimate (ap-southeast-1, ~2026 prices)

| Service | Usage | Monthly Cost (USD) |
|---------|-------|-------------------:|
| ECS Fargate (1 vCPU, 2GB, 1 task) | 24/7 | ~$30 |
| ALB | 1 ALB + low traffic | ~$20 |
| ECR | 3 repos, ~3GB images | ~$1 |
| Secrets Manager | 4 secrets | ~$2 |
| CloudWatch | Logs + alarms | ~$10 |
| S3 + DynamoDB | tfstate | ~$1 |
| Data transfer | low | ~$5 |
| **Total** | | **~$70-100 USD/month** |

### Tip tiet kiem

- Su dung **Fargate Spot** (giam 70%): sua task definition `capacity_provider_strategy`.
- Resize CloudWatch log retention tu default → 7 ngay.
- Dung 1 task thay vi 2 neu traffic thap (sacrifice HA).

---

## Troubleshooting

### Loi: "Error: creating ECS Service: ... AccessDenied"

User IAM thieu quyen `ecs:CreateService`. Can add full `ecs:*`.

### Loi: "Error: putting secret value: ResourceNotFoundException"

Terraform chua apply xong. Chay `terraform apply` truoc.

### Loi: ALB health check fail (502/503)

- Check ECS task logs de xem app co start thanh cong khong.
- Verify security group: ALB SG phai cho phep outgoing 0.0.0.0/0 port 8000.
- Verify health check path: YOLO su dung `/health`, backend su dung `/health`.

### Loi: CodeBuild fail "Cannot connect to Docker daemon"

CodeBuild project can `privileged_mode = true`. Verify trong `infra/modules/pipeline/main.tf`.

### Loi: CodeDeploy "validate_service.sh" timeout

- Kiem tra GREEN endpoint accessible tu CodeDeploy agent.
- Xem log CodeDeploy: `aws deploy get-deployment --deployment-id <ID>` → LifecycleEventList.

### Loi: Drift service 503

- Verify YOLO_METRICS_URL dung (should be internal ALB DNS, not localhost).
- Check task role co quyen Pushgateway khong (se them trong Phase 4).

### Loi: Out of memory (OOM) trong YOLO task

Tang task memory tu 2048 → 4096 MB trong `infra/modules/ecs_blue_green/main.tf`.

---

## References

- [AWS ECS Blue/Green with CodeDeploy](https://docs.aws.amazon.com/codedeploy/latest/userguide/deployment-steps-ecs.html)
- [Terraform AWS Provider 5.x](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [W&B Model Registry](https://docs.wandb.ai/guides/models)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)

---

## Next Steps

- [ ] Setup custom domain cho Netlify (nếu có domain riêng).
- [ ] Enable Netlify Form handling / Identity nếu cần.
- [ ] Setup Webhook từ Netlify về backend nếu cần.
- [ ] Setup DNS cho ALB (Route53 alias record) cho backend API.
- [ ] Enable WAF cho ALB (chong SQLi/XSS).
- [ ] Multi-region failover (DR plan).
- [ ] Auto-scaling cho ECS service (target tracking on CPU).
- [ ] Setup Slack/PagerDuty alerts tu Alertmanager.
- [ ] On-call runbook cho team.
- [ ] Quarterly DR drill.