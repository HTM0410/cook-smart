# MLOps Pipeline Documentation

## Overview

This document describes the complete MLOps pipeline for the CookSmart YOLO model, including training, deployment, monitoring, and automated retraining.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              MLOps PIPELINE ARCHITECTURE                         │
└─────────────────────────────────────────────────────────────────────────────────┘

TRAINING PIPELINE                          INFERENCE PIPELINE
═══════════════════                        ═══════════════════

┌─────────────┐                           ┌──────────────────────────────────────┐
│ Data        │                           │  MODEL REGISTRY                      │
│ Validation  │                           │  ┌────────────────────────────────┐ │
└──────┬──────┘                           │  │ S3 (primary)                    │ │
       │                                  │  │  └── ingredient-detector/v14/  │ │
       ▼                                  │  │      ├── best.pt              │ │
┌─────────────┐      ┌─────────────┐     │  │      └── manifest.json          │ │
│ YOLO        │─────►│ Register    │     │  ├────────────────────────────────┤ │
│ Train       │      │ to S3/W&B   │     │  │ W&B (backup)                   │ │
└──────┬──────┘      └──────┬──────┘     │  │  └── artifact: ingredient-detector│ │
       │                    │             │  ├────────────────────────────────┤ │
       ▼                    ▼             │  │ DynamoDB (version tracking)   │ │
┌─────────────┐      ┌─────────────┐     │  │  └── ALIAS#production → v14   │ │
│ Unit Tests  │      │ Update      │     │  └────────────────────────────────┘ │
│ Integration │      │ DynamoDB    │     └──────────────┬───────────────────────┘
│ Benchmark   │      └──────┬──────┘                    │
└──────┬──────┘             │                          │
       │                    ▼                          ▼
       ▼          ┌─────────────────┐       ┌──────────────────────────────┐
┌─────────────┐    │ Candidate Alias │       │  YOLO INFERENCE SERVICE      │
│ Staging     │◄───│ (v{timestamp}) │       │  (ECS Fargate)               │
│ Deploy      │    └─────────────────┘       │  • FastAPI                   │
└──────┬──────┘                             │  • Prometheus metrics        │
       │                                    │  • Confidence threshold       │
       ▼                                    └──────────────┬───────────────┘
┌─────────────┐                                      │  │
│ Smoke Test  │                                      │  ▼
└──────┬──────┘                              ┌──────────────────────────────┐
       │                                       │  CloudWatch Dashboard        │
       ▼                                       │  • ECS metrics               │
┌─────────────┐     ┌─────────────────┐       │  • Pipeline status          │
│ Manual      │────►│ Production      │       │  • Drift alerts             │
│ Approval    │     │ (Canary 10%)    │       │  • Deployment status        │
└─────────────┘     └────────┬────────┘       └──────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Production      │
                    │ Alias Update   │
                    └─────────────────┘


AUTOMATED RETRAIN FLOW
══════════════════════

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Drift Job    │────►│ Check       │────►│ Start        │────►│ Monitor      │
│ (every 6h)  │     │ Alert Level │     │ Pipeline     │     │ Pipeline     │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │                                        │
                     alert_level < 1                         pipeline completes
                            │                                        │
                            ▼                                        ▼
                     Skip retrain                            Deploy to prod
```

## Components

### 1. Training Pipeline

| Component | File | Description |
|-----------|------|-------------|
| Validation | `mlops/buildspec/validate.yml` | Validates train.yaml, params.yaml, data split |
| Training | `mlops/buildspec/train.yml` | Trains YOLO model with wandb logging |
| Testing | GitHub Actions | Unit tests, integration tests, benchmarks |
| Registration | CodeBuild | Uploads model to S3, updates DynamoDB |

### 2. Model Registry

| Storage | Purpose | Versioning |
|---------|---------|------------|
| S3 | Primary model storage | `s3://cooksmart-models/ingredient-detector/{version}/best.pt` |
| W&B | Training artifacts & logs | Artifact `ingredient-detector:latest` |
| DynamoDB | Version tracking | `ALIAS#production` → `VERSION#{version}` |

### 3. Deployment

| Stage | Strategy | Traffic |
|-------|----------|---------|
| Staging | Rolling update | 100% |
| Production | Canary 10% | 10% → 100% over 5 minutes |

### 4. Monitoring

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Inference latency (p95) | CloudWatch | > 3s |
| Error rate (5xx) | CloudWatch | > 5% |
| Drift alert level | CloudWatch | >= 1 |
| Data drift (min p-value) | Custom metric | < 0.01 |

### 5. Drift Detection

| Channel | Method | Trigger |
|---------|--------|---------|
| Data Drift | KS-test on PCA embeddings | min p < 0.01 |
| Concept Drift | KS-test on confidence histogram | p < 0.05 |
| Prediction Drift | Jensen-Shannon divergence | JSD > 0.1 |

## Workflows

### Manual Training (GitHub Actions)

```yaml
# .github/workflows/ml-training.yml
on:
  push:
    branches: [main, 'ml/**']
  workflow_dispatch:
    inputs:
      epochs: 100
```

**Flow:**
1. Validate configuration
2. Train model
3. Run tests
4. Deploy to staging
5. Smoke test
6. Manual approval
7. Deploy to production (canary)

### Automated Retraining (Drift-Triggered)

```python
# mlops/scripts/trigger_retrain.py
if alert_level >= DRIFT_THRESHOLD:
    start_pipeline("cooksmart-ml-training-pipeline")
```

**Flow:**
1. Drift job runs every 6 hours
2. Check alert_level >= 1
3. Start CodePipeline
4. Pipeline runs through all stages
5. Notify via SNS

## Deployment Commands

### Deploy Infrastructure

```bash
# Deploy all ML infrastructure
python .aws/deploy_ml_infrastructure.py --region ap-southeast-1

# Dry run to see what would be created
python .aws/deploy_ml_infrastructure.py --dry-run
```

### Setup Drift Cron

```bash
# Enable drift detection every 6 hours
python .aws/enable_drift_cron.py
```

### Setup Drift-to-Retrain

```bash
# Enable automatic retrain when drift detected
python .aws/enable_drift_retrain.py
```

### Manual Pipeline Trigger

```bash
# Start pipeline manually
aws codepipeline start-pipeline-execution \
  --name cooksmart-ml-training-pipeline
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | ap-southeast-1 | AWS region |
| `S3_BUCKET` | cooksmart-models | Model storage bucket |
| `DYNAMODB_TABLE` | cooksmart-model-versions | Version tracking table |
| `WANDB_API_KEY` | - | W&B API key |
| `WANDB_ENTITY` | cooksmart | W&B entity |
| `DRIFT_THRESHOLD` | 1 | Alert level to trigger retrain |

### Training Parameters

```yaml
# mlops/params.yaml
train:
  base_model: yolov8m.pt
  epochs: 100
  imgsz: 640
  batch: 16
  device: cuda
  optimizer: SGD
  lr0: 0.01
```

## Canary Deployment Strategy

```
Time (minutes):  0    5    10   15
Traffic:          0%  10%  100% 100%
                 ├────┤
                 Canary
```

**Rollback Triggers:**
- Smoke test failure
- Error rate > 5%
- P95 latency > 3s
- CloudWatch alarm triggered

## Monitoring Dashboards

### CloudWatch Dashboard

Access at: AWS Console → CloudWatch → Dashboards → `cooksmart-mlops-dashboard-v2`

Metrics monitored:
- ECS CPU/Memory (YOLO + Backend)
- Inference latency (p95)
- Error rates (2xx vs 5xx)
- Drift detection alerts
- Pipeline execution status
- CodeDeploy canary traffic

## Security

### IAM Roles

| Role | Permissions |
|------|-------------|
| `codepipeline-ml-training-role` | CodePipeline, CodeBuild, S3, DynamoDB |
| `codepipeline-ml-build-role` | CodeBuild, ECR, ECS |
| `cooksmart-drift-events-role` | Lambda invoke |
| `cooksmart-drift-retrain-events-role` | Lambda invoke, CodePipeline start |

### Secrets

| Secret | Storage | Usage |
|--------|---------|-------|
| `WANDB_API_KEY` | GitHub Secrets | Training logging |
| `AWS_ACCESS_KEY_ID` | GitHub Secrets | AWS CLI |
| `AWS_SECRET_ACCESS_KEY` | GitHub Secrets | AWS CLI |
| `github-token` | AWS Secrets Manager | CodePipeline GitHub source |

## Troubleshooting

### Pipeline Fails at Training Stage

```bash
# Check CloudWatch logs
aws logs tail /aws/codebuild/cooksmart-ml-train --follow

# Check W&B run
wandb run [run-id]
```

### Drift Detection Not Working

```bash
# Test Lambda manually
aws lambda invoke \
  --function-name cooksmart-drift-retrain \
  --payload '{"action":"run"}' \
  response.json

# Check drift reports
curl http://localhost:8100/drift/reports
```

### Model Not Loading in Production

```bash
# Check ECS service events
aws ecs describe-services \
  --cluster cooksmart-prod-v2 \
  --services cooksmart-prod-v2-yolo-svc

# Check model loading logs
aws logs filter-log-events \
  --log-group-name /ecs/cooksmart-prod-v2-yolo \
  --filter-pattern "best.pt"
```

## Maintenance

### Rotate Model Alias

```python
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('cooksmart-model-versions')

table.put_item(Item={
    'PK': 'ALIAS#production',
    'SK': 'POINTER',
    'version': 'v20250719_120000-abc123',
    'updated_at': '2025-07-19T12:00:00Z'
})
```

### Clean Up Old Model Versions

```python
import boto3
from datetime import datetime, timedelta

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('cooksmart-model-versions')

# Delete versions older than 90 days
cutoff = datetime.utcnow() - timedelta(days=90)
response = table.scan(
    FilterExpression='created_at < :cutoff',
    ExpressionAttributeValues={':cutoff': cutoff.isoformat()}
)

for item in response['Items']:
    table.delete_item(Key={'PK': item['PK'], 'SK': item['SK']})
```

## References

- [AWS CodePipeline Documentation](https://docs.aws.amazon.com/codepipeline/)
- [AWS CodeDeploy Documentation](https://docs.aws.amazon.com/codedeploy/)
- [Ultralytics YOLO Documentation](https://docs.ultralytics.com/)
- [Weights & Biases Documentation](https://docs.wandb.ai/)
