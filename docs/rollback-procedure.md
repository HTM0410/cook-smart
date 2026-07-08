# Rollback Procedure

## Khi nào cần rollback

- Smoke test fail ngay sau deploy.
- `IngredientDriftAlertHigh` (severity critical) kéo dài > 15 phút.
- 5xx rate > 5% trong 5 phút sau deploy.
- Schema mismatch (`yolo_model_schema_compatible == 0`).
- Bất kỳ lỗi nào ảnh hưởng user-facing detection.

## Các cấp rollback

### Cấp 1: Rollback trong CodeDeploy (Blue/Green)

Áp dụng khi: deployment vừa xong, có vấn đề, chưa ai dùng version mới lâu.

CodeDeploy tự động rollback nếu:

- `validate_service.sh` exit code != 0.
- Health check fail trong 5 phút sau switch.
- Auto rollback event triggered (`DEPLOYMENT_FAILURE`, alarm, manual stop).

Manual rollback qua console:

```bash
# CodePipeline chạy lại artifact truoc do
aws deploy stop-deployment \
    --deployment-id <id> \
    --auto-rollback-enabled
```

Hoặc:

```bash
# Trong AWS Console:
# CodeDeploy > Applications > cooksmart-yolo > Deployment groups > cooksmart-yolo-dg
# Chon deployment > Stop. CodeDeploy se revert traffic ve blue (production version truoc).
```

### Cấp 2: Rollback ECS Task Definition

Áp dụng khi: container cũ vẫn chạy ổn nhưng deployment mới không trigger được rollback tự động.

```bash
# Lay danh sach task definition
aws ecs list-task-definitions --family-prefix cooksmart-prod-yolo --sort DESC

# Update service ve task definition cu
aws ecs update-service \
    --cluster cooksmart-prod \
    --service cooksmart-prod-yolo-svc \
    --task-definition cooksmart-prod-yolo:<revision-old> \
    --force-new-deployment
```

### Cấp 3: Swap ALB Target Group thủ công

Áp dụng khi: cả 2 task set đều unhealthy, cần swap về version cũ bằng tay.

```bash
# Lay ARN cua production listener
LISTENER_ARN=$(aws elbv2 describe-listeners \
    --load-balancer-arn <alb-arn> \
    --query 'Listeners[?Port==`443`].ListenerArn' \
    --output text)

# Lay ARN target group blue (production version cu)
BLUE_TG=$(aws elbv2 describe-target-groups \
    --names cooksmart-prod-blue-tg \
    --query 'TargetGroups[0].TargetGroupArn' \
    --output text)

# Force forward ve blue
aws elbv2 modify-listener \
    --listener-arn $LISTENER_ARN \
    --default-actions Type=forward,TargetGroupArn=$BLUE_TG
```

### Cấp 4: Rollback W&B alias

Áp dụng khi: model mới bị lỗi logic mà version container vẫn work, cần revert về artifact cũ.

```python
import wandb
api = wandb.Api()

# Dat alias production ve version cu
artifact_path = "htm0410/ingredient-detection/ingredient-detector"
art = api.artifact(f"{artifact_path}:v_old_hash")
art.aliases.append("production")
art.save()
```

Hoặc qua W&B web UI: Artifacts → ingredient-detector → chọn version → Set alias.

Sau khi đổi alias, **trigger thêm một deployment**:

```bash
python -m mlops.serving.promotion trigger-pipeline \
    --pipeline-name cooksmart-prod-pipeline \
    --region us-east-1
```

YOLO service khi khởi động lại task set sẽ pull artifact từ W&B với alias mới.

### Cấp 5: Rollback toàn bộ (disaster)

Trong tình huống nghiêm trọng (downtime > 5 phút, rollback automatic không work):

1. Gọi team SRE ngay lập tức.
2. Mở war room: gọi conference bridge, pin status updates vào Slack `#incidents`.
3. Nếu Blue/Green ECS service failed: scale toàn bộ về 0, sau đó chạy task definition gốc với image `cooksmart-yolo:git-revision-before`.
4. Nếu ALB/CodeDeploy có vấn đề: dùng Route 53 health check để reroute traffic về static S3 + CloudFront page "We're back soon".

## Post-rollback checklist

- [ ] Xác nhận tất cả traffic production trỏ về blue task cũ (hoặc pre-rollback version).
- [ ] Verify Grafana hiển thị model metric ổn định.
- [ ] Tạo incident report: timeline, root cause, impact, mitigation.
- [ ] Update `BAO_CAO_MLOPS.md` với section "Sự cố & phản hồi" ghi nhận vụ này.
- [ ] Mở ticket để fix root cause → schedule retrain pipeline.

## Vai trò khi rollback

| Người | Hành động |
|-------|-----------|
| SRE primary | Thực hiện rollback, kiểm tra metrics |
| ML Engineer | Verify W&B alias revert, prepare fix |
| Product Owner | Approve communication tới users (nếu cần) |
| Incident Commander | Coordinate, lead war room |
