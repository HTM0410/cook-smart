# Promotion Runbook – W&B candidate → production

## Mục tiêu

Đưa model candidate (đã qua quality gate trong `evaluate.py` với mAP50 ≥ 0.5, mAP50-95 ≥ 0.3) lên alias `production` của W&B registry, đồng thời kích hoạt CodePipeline để deploy Blue/Green.

## Quy trình chuẩn

```
┌─────────────────┐    ┌─────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Train trên      │───►│ W&B artifact    │───►│ Admin review trên│───►│ Promote + trigger│
│ Kaggle GPU      │    │ tagged candidate│    │ AdminMlops       │    │ CodePipeline     │
└─────────────────┘    └─────────────────┘    └──────────────────┘    └──────────────────┘
```

## Bước 1: Train (Kaggle)

```bash
# Repo: mlops/kaggle/kaggle_train.ipynb
# Required secrets trong Kaggle environment:
#   - WANDB_API_KEY
#   - WANDB_ENTITY
#   - WANDB_PROJECT=ingredient-detection
#   - DVC_S3_REMOTE_URL, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# Sau khi run xong, W&B artifact ingredient-detector:<hash> se co alias 'candidate'
```

## Bước 2: Admin review

Vào AdminMlops:

1. Xem **Tổng quan**: kiểm tra `metrics/mAP50(B) >= 0.5` và `metrics/mAP50-95(B) >= 0.3`.
2. Xem **Phản hồi**: nếu `modificationRate > 30%` thì chưa nên promote.
3. Xem **Lớp nhận diện**: schema phải `compatible: true`.

## Bước 3: Promote & trigger pipeline

Có 3 cách:

### Cách A: Qua CLI backend (AdminMlops)

Click nút **"Promote W&B + trigger CodePipeline"** trong AdminFeedbackQueue.

- Nếu `WANDB_ENTITY` được set (env) → gọi W&B `promote.py` rồi trigger pipeline.
- Nếu chưa set → chỉ trigger pipeline (admin đã promote W&B thủ công).

### Cách B: Qua CLI ML

```bash
pip install boto3 click wandb
export WANDB_API_KEY=...
export WANDB_ENTITY=htm0410
export AWS_REGION=us-east-1

# Chi promote
python -m mlops.serving.promotion trigger-pipeline \
    --pipeline-name cooksmart-prod-pipeline \
    --region us-east-1

# Promote va trigger cung luc
python -m mlops.serving.promotion promote-and-deploy \
    --entity htm0410 \
    --project ingredient-detection \
    --artifact ingredient-detector \
    --pipeline-name cooksmart-prod-pipeline \
    --region us-east-1
```

### Cách C: GitHub Actions

Đẩy tag `v*.*.*`:

```bash
git tag v1.4.0
git push origin v1.4.0
```

Workflow `.github/workflows/deploy.yml` sẽ gọi `trigger-pipeline`. Nếu repo có `vars.WANDB_PROMOTE=true`, workflow sẽ chạy `promote-and-deploy`.

## Bước 4: Approval gate

Sau khi pipeline chạy Source → Build → sẽ dừng ở **Approval**. Mở AWS CodePipeline console, hoặc nhận email SNS:

```bash
aws codepipeline list-action-executions \
    --pipeline-name cooksmart-prod-pipeline \
    --max-results 1
```

Approve hoặc reject.

## Bước 5: Validate Green Service

CodeDeploy chạy `validate_service.sh` tối đa 5 phút:

- `/health/detailed` phải trả `model_loaded=true`.
- `class_count` phải là 59.
- `schema_compatible` phải là true.

Nếu fail → CodeDeploy tự động rollback theo `auto_rollback_configuration`.

## Bước 6: Smoke test production

```bash
ALB_DNS=$(terraform output -raw alb_dns_name)
curl -fsS "https://$ALB_DNS/yolo/health/detailed" | jq '.model_loaded, .class_count'
```

Mở Grafana: xem dashboard `food-suggest-mlops`, kiểm tra:
- Yolo inference p95 < 3s.
- 5xx rate < 1%.
- Model loaded / schema compatible = 1.
- Drift alerts = 0.

## Bước 7: Final report

Cập nhật `BAO_CAO_MLOPS.md` phiên bản 2.0 với:

- Ngày promote.
- Model version mới.
- mAP50 / mAP50-95.
- Kết quả smoke test.
- Bất kỳ vấn đề nào gặp phải.

## Lỗi thường gặp

| Lỗi | Nguyên nhân | Cách xử lý |
|------|-----------|------------|
| `artifact:codeploy get failed` | CodeDeploy IAM thiếu permission `GetDeployment` | Kiểm tra `aws:policy/service-role/AWSCodeDeployRoleForECS` đã attach đúng |
| `green service failed validation` | Image build thiếu model weights | Đảm bảo Docker build copy `model_detection/best (3).pt` hoặc dùng W&B loader |
| `listener_target_group_register_unhealthy` | Subnet/security group không cho phép traffic | Kiểm tra `aws_lb_target_group.blue` có subnet route đến ECS service |
| `Pipeline cannot start` | CodeStar connection lỗi | Vào console CodePipeline, bấm "Update connection" rồi authenticate lại GitHub |
| W&B `artifact not found` | Sai entity/project | Kiểm tra `WANDB_ENTITY` và `WANDB_PROJECT`, verify tại app.wandb.ai |
