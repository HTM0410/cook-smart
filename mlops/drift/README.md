# Drift Detection Service

FastAPI service phát hiện 3 loại drift cho YOLO inference:

- **Data drift**: KS-test trên PCA của embedding input. So sánh baseline (từ validation split) với live (scrape từ YOLO `/embed`).
- **Prediction drift**: Jensen-Shannon divergence giữa baseline class counts và live `yolo_detections_total{class_name}`.
- **Concept drift**: KS-test giữa confidence histogram của baseline (test split) và live (scrape `yolo_detection_confidence`).

## Endpoints

- `GET  /health` – liveness
- `POST /drift/run` – chạy 3 kênh, đẩy metric lên Pushgateway
- `GET  /drift/reports` – danh sách lần chạy gần nhất (in-memory ring buffer 20 mục)
- `GET  /metrics` – Prometheus exposition (chỉ metric của service này)
- `POST /metrics/push` – manual trigger đẩy metric lên Pushgateway

## Cấu hình

| ENV                       | Default                       | Mô tả |
|--------------------------|-------------------------------|-------|
| `PORT`                   | `8100`                        | Cổng FastAPI |
| `YOLO_METRICS_URL`       | `http://localhost:8000/metrics` | URL Prometheus metrics của YOLO |
| `PUSHGATEWAY_URL`        | `http://localhost:9091`       | Pushgateway URL (rỗng = tắt push) |
| `METRICS_TOKEN`          | rỗng                          | Bearer token cho YOLO `/metrics` nếu bật |
| `BASELINE_EMBEDDINGS_PATH` | `mlops/artifacts/baseline_embeddings.npy` | File embedding baseline |
| `BASELINE_COUNTS_PATH`   | `mlops/artifacts/baseline_class_counts.json` | Class count baseline |
| `BASELINE_CONFIDENCE_PATH` | `mlops/artifacts/baseline_confidence.npy` | Confidence histogram baseline |
| `DRIFT_DATA_KS_P`        | `0.01`                        | Threshold p-value cho data drift |
| `DRIFT_PREDICTION_JSD`   | `0.1`                         | Threshold JSD cho prediction drift |
| `DRIFT_CONCEPT_KS_P`     | `0.05`                        | Threshold p-value cho concept drift |
| `DRIFT_PCA_COMPONENTS`   | `8`                           | Số chiều PCA cho data drift |
| `DRIFT_HISTORY_SIZE`     | `20`                          | Số report giữ trong RAM |
| `EMBEDDING_ENABLED`      | `false`                       | Nếu true, có thể scrape embedding từ YOLO |

## Chạy local

```bash
cd mlops/drift
docker compose up --build drift
curl http://localhost:8100/health
curl -X POST http://localhost:8100/drift/run -H 'Content-Type: application/json' \
  -d '{"channels":["prediction","concept"]}'
```

## Tích hợp Prometheus

Add scrape config trong `monitoring/prometheus/prometheus.yml`:

```yaml
scrape_configs:
  - job_name: cooksmart-drift
    metrics_path: /metrics
    static_configs:
      - targets: ['drift_service:8100']
```

Alert rule:

```yaml
- alert: IngredientDriftDetected
  expr: drift_alert >= 1
  for: 10m
  labels: { severity: warning }
  annotations:
    summary: "Phát hiện drift trên YOLO service"
```

## Đẩy metric lên Pushgateway

Service tự động push metrics qua `PUSHGATEWAY_URL` sau mỗi lần `POST /drift/run`. Prometheus sẽ scrape Pushgateway với `honor_labels: true` để giữ job/instance label.
