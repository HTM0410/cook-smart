# Terraform IaC cho CookSmart MLOps Production

## Mục tiêu

Hạ tầng AWS hoàn chỉnh cho hệ nhận diện nguyên liệu với **Blue/Green deployment** zero-downtime:

- ECS Fargate cluster chạy YOLO inference và Node backend.
- Application Load Balancer với 2 target group (blue/green) + 2 listener (prod/test).
- AWS CodePipeline + CodeDeploy tự động build image, đẩy ECR, deploy Blue/Green với manual approval.
- ECR + Secrets Manager + CloudWatch alarms.
- Terraform state lưu S3 + lock DynamoDB.

## Cấu trúc

```
infra/
├── modules/
│   ├── ecs_blue_green/   # ECS cluster + 2 task set + CodeDeploy deployment group
│   ├── alb/              # Application Load Balancer + 2 target group + 2 listener
│   ├── ecr/              # 3 ECR repos: backend, yolo, drift
│   ├── pipeline/         # CodePipeline + CodeBuild + Approval stage
│   ├── secrets/          # Secrets Manager cho WANDB_API_KEY, DATABASE_URL, METRICS_TOKEN
│   └── monitoring/       # CloudWatch log groups + alarms
├── envs/
│   └── prod/             # Entry point terraform apply cho production
├── scripts/              # validation script cho CodeDeploy lifecycle hooks
└── README.md             # (file này)
```

## Cách dùng

### Chuẩn bị

Tạo state backend trước khi init:

```bash
aws s3api create-bucket --bucket cooksmart-tfstate --region ap-southeast-1 \
  --create-bucket-configuration LocationConstraint=ap-southeast-1

aws dynamodb create-table --table-name cooksmart-tflock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

Bật versioning cho S3 bucket:

```bash
aws s3api put-bucket-versioning --bucket cooksmart-tfstate \
  --versioning-configuration Status=Enabled
```

### Apply

```bash
cd infra/envs/prod
terraform init
terraform plan \
  -var 'region=ap-southeast-1' \
  -var 'vpc_id=vpc-xxxxx' \
  -var 'public_subnets=["subnet-xxx","subnet-yyy"]' \
  -var 'private_subnets=["subnet-aaa","subnet-bbb"]' \
  -var 'acm_arn=arn:aws:acm:ap-southeast-1:123:certificate/xyz' \
  -var 'github_repo=HTM0410/cook-smart' \
  -var 'github_branch=main'

terraform apply -auto-approve
```

### Outputs

Sau khi apply, các output quan trọng:

- `alb_dns_name`: DNS của Load Balancer production.
- `pipeline_name`: Tên CodePipeline cần trigger khi promote model.
- `ecr_backend_url`, `ecr_yolo_url`, `ecr_drift_url`.
- `code_deploy_deployment_group`: Tên group của CodeDeploy.

## Quy trình release mới

1. Đẩy tag `v1.x.x` lên GitHub → trigger `.github/workflows/deploy.yml` → gọi `aws codepipeline start-pipeline-execution`.
2. CodePipeline build image (backend + yolo) đẩy lên ECR.
3. Approval stage dừng pipeline, chờ admin duyệt qua console/SNS.
4. Sau duyệt, CodeDeploy chạy Blue/Green: deploy image mới vào green task set, health check `/health/detailed`, switch listener.
5. Nếu validate fail, traffic revert về blue task set.

## Phụ thuộc giữa các module

```
secrets ──► (tham chiếu bởi task definition)
ecr ──► (image URL truyền vào ECS task definition + CodeBuild)
alb ──► (target group arn truyền vào ECS service + CodeDeploy)
ecs_blue_green ──► (cluster + service name truyền vào CodeDeploy)
pipeline ──► (gọi CodeBuild + trigger CodeDeploy)
monitoring ──► (đọc log group từ ECS task definition)
```

Mỗi module expose output rõ ràng; orchestration nằm trong `infra/envs/prod/main.tf`.
