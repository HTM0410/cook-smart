# Drift Detection Runbook

## Tổng quan

Drift service (`mlops/drift/`) giám sát 3 loại drift:

1. **Data drift**: phân phối embedding input thay đổi so với baseline.
2. **Prediction drift**: tỉ lệ class detect thay đổi so với baseline.
3. **Concept drift**: confidence histogram khác baseline.

## Các metric chính

| Metric | Ngưỡng | Ý nghĩa |
|--------|--------|---------|
| `drift_data_p_value_min` | < 0.01 (PCA KS-test) | Data drift nghiêm trọng |
| `drift_prediction_jsd` | > 0.1 (Jensen-Shannon) | Prediction drift |
| `drift_concept_p_value` | < 0.05 (KS-test) | Concept drift |
| `drift_alert` | = 1 (1 kênh) hoặc 2 (2+ kênh) | Tổng hợp cảnh báo |

## Khi nào chạy drift?

### Tự động

- Mỗi 6 giờ: GitHub Actions `drift-cron.yml` POST tới `/drift/run`.
- Sau mỗi deploy Blue/Green xong: có thể trigger thủ công một lần để xác nhận model mới không làm trầm trọng drift.

### Thủ công

```bash
python -m mlops.scripts.run_drift_job \
    --drift-url http://localhost:8100 \
    --metrics-token $METRICS_TOKEN \
    --channels data concept prediction
```

## Cách đọc báo cáo

```bash
curl -s "http://drift-service:8100/drift/reports?limit=10" | jq
```

Ví dụ output:

```json
[
  {
    "timestamp": "2026-07-07T10:48:13Z",
    "channels": {
      "data": { "min_p": 0.42, "drift": false },
      "prediction": { "jsd": 0.04, "drift": false },
      "concept": { "p_value": 0.18, "drift": false }
    },
    "alert_level": 0,
    "duration_seconds": 1.2
  }
]
```

## Khi `drift_alert >= 1`

### 1. Xác nhận cảnh báo

```bash
curl -s "$DRIFT_URL/drift/reports?limit=1" | jq '.[0]'
```

Xem kênh nào đang vượt ngưỡng.

### 2. Lấy context từ YOLO metrics

```bash
curl -s "$YOLO_URL/metrics" | grep yolo_detections_total | sort -k2 -n -r | head -20
curl -s "$YOLO_URL/metrics" | grep yolo_detection_confidence_count
```

### 3. Các nguyên nhân thường gặp

| Nguyên nhân | Cách xử lý |
|-------------|-----------|
| Thay đổi camera/lighting client | Không cần action. Đẩy thêm ảnh mới vào DVC increment và retrain. |
| Dataset drift (population shift) | Trigger retrain pipeline (`promote.py` với metric cải thiện). |
| Model regression | Rollback alias W&B về version trước. |
| Label mapping sai | Sửa mapping và redeploy, KHÔNG cần retrain. |

### 4. Khi nào rollback?

- `drift_alert == 2` (≥ 2 kênh) trong 15 phút liên tục → rollback và trigger retrain.
- `yolo_empty_results_total` tăng đột biến (>30%) → kiểm tra `CONF_INFERENCE_FLOOR` đang dùng.
- `yolo_model_schema_compatible == 0` → fix mapping trước khi tiếp tục.

### 5. Tạo dataset increment cho retrain

Sau khi retrain:

```bash
# Trong AdminFeedbackQueue > "Export feedback increment"
# Lay duong dan thu muc DVC, vd:
#   mlops/data/corrections/V_inc_2026-07-07T10-48-13Z/

cd $EXPORT_DIR
dvc add labels classes.txt
git add labels.dvc classes.txt.dvc .gitignore
git commit -m "Add feedback increment V_inc_<stamp>"
dvc push
```

Sau đó chạy lại pipeline `dvc repro train evaluate` với dataset mới.

## Tích hợp với Prometheus

Alert rules (đã có trong `monitoring/prometheus/alerts.yml`):

| Alert | Khi trigger |
|-------|------------|
| `IngredientDriftData` | `drift_data_p_value_min < 0.01` trong 10 phút |
| `IngredientDriftPrediction` | `drift_prediction_jsd > 0.1` trong 10 phút |
| `IngredientDriftConcept` | `drift_concept_p_value < 0.05` trong 10 phút |
| `IngredientDriftAlertHigh` | `drift_alert >= 2` trong 15 phút (`severity: critical`) |

Cấu hình Alertmanager sẽ gửi:
- Email tới team MLOps.
- Slack channel `#mlops-alerts`.
- PagerDuty nếu severity là `critical`.

## Baseline đặt ở đâu?

Baseline của 3 loại drift được lưu tại:

- `mlops/artifacts/baseline_embeddings.npy` – vector embedding từ val split.
- `mlops/artifacts/baseline_class_counts.json` – histogram `yolo_detections_total` của val split.
- `mlops/artifacts/baseline_confidence.npy` – confidence scores từ eval test split.

Các file này được generate mỗi lần chạy `mlops/ingredient_detection/evaluate.py` xong. Đẩy lên DVC:

```bash
dvc add mlops/artifacts/baseline_embeddings.npy \
       mlops/artifacts/baseline_class_counts.json \
       mlops/artifacts/baseline_confidence.npy
dvc push
```

Drift service sẽ tự động load baseline mới từ đường dẫn này nếu mount volume. Khi chạy container, set:

```yaml
volumes:
  - ../../mlops/artifacts:/app/artifacts:ro
```
