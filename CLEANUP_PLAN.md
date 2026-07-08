# Cleanup Plan - Post Lambda Stabilization

File nay ghi lai cac file can XOA sau khi Lambda stack chay on dinh
(it nhat 2 tuan production khong co su co). KHONG xoa ngay bay gio de
co the rollback ve ECS neu can.

## Tiep theo trong vong 1-2 tuan

### Watchlist
- CloudWatch: `*-yolo-errors-high`, `*-backend-errors-high` khong kich hoat.
- Latency: p95 < 3s cho yolo, < 500ms cho backend.
- Provisioned Concurrency utilization: khong qua 80% vao gio cao diem.
- Cost: Lambda bill < 50% ECS bill cu.

## Sau khi confirm Lambda stable

### GHA workflows xoa (da thay the boi `deploy-prod.yml`)

```bash
# Xoa 3 workflow cu (trung lap hoac da chuyen sang EventBridge)
rm .github/workflows/build-yolo.yml     # Trung voi deploy-prod.yml job yolo
rm .github/workflows/deploy.yml         # CodePipeline trigger (khong con pipeline)
rm .github/workflows/drift-cron.yml     # Drift da trigger boi EventBridge scheduler
# Giu .github/workflows/deploy-ecs.yml (rollback safety) cho den khi ECS bi xoa
# Giu .github/workflows/deploy-prod.yml (Lambda)
# Giu .github/workflows/backend-ci.yml, frontend-ci.yml, mlops-checks.yml, deploy-frontend.yml
```

### Dockerfiles cu (da thay the boi `*.Lambda.Dockerfile`)

```bash
# Giu docker/backend.Dockerfile, docker/yolo.Dockerfile, docker/drift.Dockerfile
# (cho docker-compose.mlops.yml local dev)
# Xoa Dockerfiles cu trong src/backend (CI cu dang dung, nhung deploy-prod moi
# dung docker/*.Lambda.Dockerfile):
# KHONG xoa ngay: deploy-prod.yml context=. nen Dockerfile con lai neu trung ten
# co the gay confusion. Sau khi Lambda on dinh, xoa:
rm src/backend/Dockerfile
rm src/backend/src/model_detection/yolo_inference_service/Dockerfile
```

### Terraform modules cu (sau khi khong can parallel stack)

```bash
# Xoa module ECS va ALB (thay the hoan toan boi Lambda)
rm -rf infra/modules/ecs_simple/
rm -rf infra/modules/ecs_blue_green/
rm -rf infra/modules/alb/
rm -rf infra/modules/pipeline/    # Neu con lai (da xoa buildspec-backend.yml)

# Xoa main.tf.ecs.backup va main.tf.lambda (sau khi confirm switch xong)
rm infra/envs/prod/main.tf.ecs.backup
rm infra/envs/prod/main.tf.lambda
# (main.tf se chi con ban Lambda)
```

### Terraform state cleanup

```bash
# Xoa stack ECS tu state S3 (giu AWS resources neu can rollback)
cd infra/envs/prod
terraform state list | xargs -I {} terraform state rm {}

# Hoac destroy toan bo ECS stack (CAN CANH GIAC - mat rollback safety):
terraform destroy -target=module.ecs -target=module.alb
```

### GHA workflow cuoi cung

```bash
# Sau khi ECS da destroy:
rm .github/workflows/deploy-ecs.yml
```

## Pre-cleanup checklist

- [ ] Lambda stack chay on dinh >= 2 tuan
- [ ] Khong co su co `ResourceInitializationError` (VPC endpoints OK)
- [ ] Provisioned Concurrency utilization < 80%
- [ ] Cost Lambda < 50% ECS bill
- [ ] YOLO cold start < 500ms (do o CloudWatch `Initializer Duration`)
- [ ] Drift job chay thanh cong 100% qua EventBridge
- [ ] API Gateway 5xx < 0.1%
- [ ] `promote_and_mirror.py` da duoc test voi real model artifact
- [ ] S3 bucket `cooksmart-models` da co it nhat 1 version mirrored
- [ ] DynamoDB `cooksmart-model-versions` co entry cho alias `production`

## Rollback neu cleanup gay su co

Neu sau khi cleanup ma can rollback ve ECS, can:
1. `git revert` commit cleanup.
2. Restore `infra/envs/prod/main.tf.ecs` tu Git history.
3. Apply Terraform: `terraform apply` (se recreate ECS).
4. Update Route 53 tro ve ALB ECS.
5. Redeploy YOLO image qua `deploy-ecs.yml` (neu workflow con).
