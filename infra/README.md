# Terraform IaC cho CookSmart MLOps Production

## Muc tieu

Ha tang AWS hoan chinh cho he nhan dien nguyen lieu, su dung
**AWS Lambda container image + API Gateway HTTP API** thay the ECS Fargate:

- Lambda functions chay backend-api, yolo-infer, drift-job (arm64 / Graviton).
- API Gateway HTTP API route `/api/*` -> backend, `/yolo/*` -> yolo, scheduled
  drift job qua EventBridge Scheduler.
- Provisioned Concurrency = 1 cho yolo-infer (cold start < 100ms).
- VPC endpoints cho Secrets Manager + S3 (fix loi `ResourceInit` cua ECS cu).
- ECR (3 repos) + S3 model registry (immutable) + DynamoDB version manifest.
- Secrets Manager + CloudWatch alarms cho Lambda metrics.
- Terraform state luu S3 + lock DynamoDB.
- **Hybrid model registry**: W&B cho training experiment, S3 + DynamoDB cho runtime.

## Cau truc

```
infra/
├── modules/
│   ├── lambda/              # 3 Lambda + API Gateway HTTP API + EventBridge schedule + VPC endpoints
│   ├── ecr/                 # 3 ECR repos: backend, yolo, drift
│   ├── model_registry/      # S3 (immutable) + DynamoDB (version manifest)
│   ├── secrets/             # Secrets Manager (4 secrets) + IAM policy
│   ├── monitoring/          # CloudWatch alarms cho Lambda metrics
│   └── github_actions/      # IAM role cho GHA (Lambda update, S3, DynamoDB)
├── envs/
│   └── prod/                # Entry point: main.tf (ECS legacy) | main.tf.lambda (new)
├── scripts/
│   ├── deploy-lambda.sh     # Helper update Lambda code + alias
│   └── deploy-lambda.ps1    # Windows wrapper
└── README.md                # (file nay)
```

## Stack song song: ECS (cu) vs Lambda (moi)

Co 2 state key S3 rieng biet:

| State key | Stack | Trang thai |
|-----------|-------|------------|
| `prod-v2/terraform.tfstate` | ECS Fargate (legacy) | Dang chay production |
| `prod-v2-lambda/terraform.tfstate` | Lambda + API Gateway | Moi trien khai song song |

De switch sang Lambda stack (sau khi test ky):

```bash
cd infra/envs/prod

# Backup ECS main.tf
cp main.tf main.tf.ecs.backup

# Use Lambda main.tf
cp main.tf.lambda main.tf

# Doi backend key trong backend.tf: prod-v2 -> prod-v2-lambda
# (hoac su dung -reconfigure de khoi tao state moi)

terraform init -reconfigure
terraform plan
terraform apply
```

## Cach dung

### Chuan bi

Tao state backend truoc khi init (neu chua co):

```bash
aws s3api create-bucket --bucket cooksmart-tfstate --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1

aws dynamodb create-table --table-name cooksmart-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Bat versioning cho S3 bucket state:

```bash
aws s3api put-bucket-versioning --bucket cooksmart-tfstate \
  --versioning-configuration Status=Enabled
```

Tao S3 bucket cho model registry (Terraform se tao tu dong khi apply
`module.model_registry`).

### Apply Lambda stack (moi)

```bash
cd infra/envs/prod
cp main.tf.lambda main.tf  # Neu chua switch

# Tao terraform.tfvars tu example
cp terraform.tfvars.example terraform.tfvars
# Edit cac gia tri: vpc_id, public_subnets, private_subnets, github_repo

terraform init
terraform plan -var-file=terraform.tfvars
terraform apply -var-file=terraform.tfvars
```

### Outputs

Sau khi apply, cac output quan trong:

- `alb_dns_name`: URL cua API Gateway HTTP API (api endpoint).
- `yolo_function_name`, `backend_function_name`, `drift_function_name`.
- `model_bucket`: S3 bucket chua model weights.
- `model_versions_table`: DynamoDB table version manifest.
- `ecr_backend_url`, `ecr_yolo_url`, `ecr_drift_url`.

## Quy trinh release moi

### Backend / YOLO / Drift service code

1. Developer push code -> GitHub main.
2. `.github/workflows/deploy-prod.yml` chay:
   - Build 3 Docker images song song (backend, yolo, drift) tren `linux/arm64`.
   - Push len ECR voi tag `${{ github.sha }}` + `latest`.
   - Update Lambda function code (publish version moi).
   - Update alias `prod` tro ve version moi.
3. Smoke test query API Gateway `/health` + `/yolo/health`.

Thoi gian deploy: < 5 phut (vs 10-15 phut cua ECS rolling update).

### Model artifact (W&B -> S3 + DynamoDB)

Sau khi training xong (alias `candidate` tren W&B):

```bash
python -m mlops.serving.promote_and_mirror promote-and-mirror \
    --entity htm0410 \
    --project ingredient-detection \
    --artifact ingredient-detector \
    --from-alias candidate \
    --to-alias production \
    --bucket cooksmart-models \
    --region ap-southeast-1
```

Script se:
1. Pull artifact tu W&B.
2. Upload `best.pt` + `manifest.json` len S3 `s3://cooksmart-models/ingredient-detector/<semver>/`.
3. Update DynamoDB `ALIAS#production` -> version moi.
4. Promote W&B alias `production` (atomic).

Sau do, deploy Lambda moi de no pick up model moi (Lambda doc S3 luc init):

```bash
# Re-deploy yolo-infer voi image moi hoac restart
bash infra/scripts/deploy-lambda.sh \
    --function cooksmart-prod-v2-yolo-infer \
    --image "$ECR_REGISTRY/cooksmart-yolo:$SHA"
```

## Phu thuoc giua cac module

```
secrets ──► (tham chieu boi Lambda env vars)
ecr ──► (image URL truyen vao Lambda function)
lambda ──► (3 function + API Gateway + EventBridge + VPC endpoints)
model_registry ──► (S3 + DynamoDB cho model artifact)
monitoring ──► (CloudWatch alarms cho Lambda metrics + API Gateway 5xx)
github_actions ──► (IAM role cho GHA: Lambda update, S3, DynamoDB)
```

Moi module expose output ro rang; orchestration nam trong
`infra/envs/prod/main.tf.lambda`.

## Cost optimization

- Lambda chi tra khi co request (vs ECS 2 task 24/7).
- YOLO co Provisioned Concurrency = 1 (~$15/thang de giu model warm).
- Backend Lambda memory 512 MB, timeout 30s (web request).
- Drift job Lambda 512 MB, timeout 5 phut, chay 6h/lan.
- S3 lifecycle rule xoa non-current version sau 30 ngay.
- DynamoDB PAY_PER_REQUEST (free tier cho version lookup).

## So sanh voi ECS cu

| Metric | ECS (cu) | Lambda (moi) |
|--------|----------|---------------|
| Time-to-deploy | 10-15 phut | < 5 phut |
| Cold start | 0 (warm) | YOLO 100ms (provisioned), 2-5s (cold) |
| Idle cost | 2 task 24/7 | $0 (chi provisioned concurrency) |
| Rollback | 5-10 phut (ECS update) | < 30s (alias update) |
| Secrets Manager | Bi timeout (VPC endpoint) | OK (co VPC endpoint) |
| Operational complexity | ALB + ECS + CodeDeploy | API Gateway + Lambda |
