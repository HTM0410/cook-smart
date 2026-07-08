# Blue/Green Deployment cho Ingredient Detection

Tài liệu này mô tả cách chúng tôi triển khai **zero-downtime** model mới lên production thông qua AWS ECS Fargate + CodeDeploy Blue/Green.

## Kiến trúc tổng quan

```
                          AWS Region (us-east-1)
                          +------------------------------------------------+
                          |  VPC                                            |
                          |  +-----------+    +-------------+             |
                          |  | ALB       |    | ALB test    |             |
                          |  | :443/80   |    | :9000       |             |
                          |  +-----------+    +-------------+             |
                          |       |                |                       |
                          |  +----v-----+      +---v----+                   |
                          |  | blue-tg  |      |green-tg|                   |
                          |  +----+-----+      +---+----+                   |
                          |       |                |                        |
                          |  +----v-----+      +---v----+                   |
                          |  | ECS task |      | ECS    |                   |
                          |  | BLUE (prod)|    | GREEN  |                   |
                          |  | yolo:v1.x  |   | yolo:v2 |                   |
                          |  +-----------+      +--------+                   |
                          +------------------------------------------------+
```

Khi CodePipeline triển khai:

1. Build image mới → đẩy ECR.
2. Approval stage chờ admin duyệt.
3. CodeDeploy khởi chạy task set mới ở **green target group**, ALB test listener (port 9000) route traffic vào đây.
4. CodeDeploy chạy `validate_service.sh`: kiểm tra `/health/detailed` của green service 30 lần (mỗi 10s).
5. Nếu health OK → CodeDeploy đổi production listener (port 443) trỏ về green target group; traffic từ user bắt đầu đi vào version mới.
6. Sau 5 phút, blue task set bị terminate.
7. Nếu health fail → CodeDeploy rollback, traffic vẫn ở blue, team nhận alert Prometheus.

## Các file liên quan

- `infra/modules/alb/main.tf` – khai báo 2 target group + 2 listener.
- `infra/modules/ecs_blue_green/main.tf` – ECS service + CodeDeploy deployment group.
- `infra/modules/pipeline/main.tf` – CodePipeline với approval stage.
- `infra/scripts/validate_service.sh` – script validate green service.
- `appspec.yml` – mô tả task set + hooks lifecycle.
- `buildspec.yml` – build image backend + yolo + drift, đẩy ECR.
- `docker/*.Dockerfile` – production images.

## Validate cục bộ (không AWS)

Script `mlops/scripts/local_blue_green.sh` chạy 2 container YOLO local và minh họa việc switch traffic. Hữu ích cho việc demo flow mà không tốn chi phí AWS.

```bash
cd mlops/scripts
chmod +x local_blue_green.sh
./local_blue_green.sh
```

Script sẽ:
1. Khởi chạy blue container ở port 8001.
2. Khởi chạy green container ở port 8002.
3. Validate `/health/detailed` của cả 2.
4. Stop blue → mô phỏng traffic switch sang green.

## Checklist production rollout

- [ ] `terraform plan` đối chiếu không có drift.
- [ ] `terraform apply` thành công, outputs lộ ra `alb_dns_name`, `pipeline_name`.
- [ ] CodeStar connection ARN đã cập nhật trong `terraform.tfvars`.
- [ ] ECR repos đã có ít nhất 1 image (từ lần build trước).
- [ ] W&B artifact `ingredient-detector` đã có alias `production` chỉ định version mới nhất.
- [ ] Approval SNS topic đã subscribe email team on-call.
- [ ] Sẵn sàng rollback: biết trước version W&B production trước đó để revert alias.

## Vai trò

- **DevOps/SRE**: Apply Terraform, debug CodePipeline, manage secrets.
- **ML Engineer**: Promote candidate → production, đảm bảo metrics mAP ≥ 0.5.
- **Admin Reviewer**: Approve trong CodePipeline UI / CLI sau khi xác nhận Grafana không có alert đỏ.

## Liên kết với các doc khác

- [promotion-runbook.md](promotion-runbook.md): Cách promote W&B alias an toàn.
- [rollback-procedure.md](rollback-procedure.md): Hướng dẫn abort và rollback.
- [drift-runbook.md](drift-runbook.md): Cách đọc metric drift, khi nào trigger retrain.
