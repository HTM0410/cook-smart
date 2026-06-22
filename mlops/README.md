# Ingredient Detection MLOps

## Architecture

1. Git versions code, `params.yaml`, DVC metadata, and the model manifest.
2. DVC versions the 59-class YOLO dataset and model outputs in Amazon S3.
3. Kaggle GPU runs `dvc repro`.
4. W&B tracks parameters, metrics, system usage, and model artifacts.
5. A model is logged with `candidate` and `latest` aliases.
6. After review, `promote.py` adds the `production` alias.
7. The FastAPI inference service downloads `production` on startup and falls
   back to the local `best59.pt` checkpoint when registry loading fails.

## Prerequisites

- An existing private S3 bucket with versioning, default encryption, and
  public access blocked.
- An IAM principal limited to the DVC prefix with `s3:ListBucket`,
  `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject`.
- A W&B account/entity.
- A Kaggle account with phone verification for GPU notebooks.
- The complete 59-class dataset. The repository currently contains only its
  schema and empty image/label directories.

## First-time data registration

Place the complete dataset under:

```text
mlops/data/yolo_dataset/V59-2/
  train/images
  train/labels
  valid/images
  valid/labels
  data.yaml
```

Validate it before registration:

```powershell
python -m mlops.ingredient_detection.prepare `
  --dataset-dir mlops/data/yolo_dataset/V59-2 `
  --source-yaml mlops/data/yolo_dataset/V59-2/data.yaml `
  --output-yaml mlops/artifacts/prepared/data.yaml `
  --report mlops/artifacts/reports/dataset.json
```

Then version the dataset:

```powershell
dvc add mlops/data/yolo_dataset/V59-2
git add mlops/data/yolo_dataset/V59-2.dvc mlops/data/yolo_dataset/.gitignore
```

If DVC asks to remove already tracked schema files, move `data.yaml`,
`README.md`, and `dataset-metadata.json` outside the DVC-tracked directory or
accept tracking the complete directory only. Do not keep duplicate sources of
truth.

## Configure S3

Set credentials through AWS environment variables, an AWS profile, or Kaggle
Secrets. Never write them to `.dvc/config`.

```powershell
$env:DVC_S3_REMOTE_URL="s3://YOUR_BUCKET/food-suggest/dvc"
$env:AWS_DEFAULT_REGION="ap-southeast-1"
$env:AWS_ACCESS_KEY_ID="..."
$env:AWS_SECRET_ACCESS_KEY="..."
python -m mlops.configure_dvc_s3
dvc push
```

## Run locally

```powershell
python -m pip install -r requirements-mlops.txt
$env:WANDB_API_KEY="..."
$env:WANDB_ENTITY="YOUR_ENTITY"
$env:WANDB_PROJECT="food-suggest-ingredient-detection"
dvc pull
dvc repro
dvc metrics show
dvc push
```

Use `train.device: cpu` in `params.yaml` for a CPU smoke run.

## Run on Kaggle

Create these Kaggle Secrets:

- `GIT_REPOSITORY_URL`
- `DVC_S3_REMOTE_URL`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_DEFAULT_REGION`
- `WANDB_API_KEY`
- `WANDB_ENTITY`

Upload or push `mlops/kaggle/kaggle_train.ipynb`, select a GPU accelerator,
enable internet, and run all cells. The notebook pulls data, runs the DVC DAG,
logs the W&B run/model, and pushes DVC outputs to S3.

## Promote and deploy

Review the evaluation metrics and sample predictions in W&B, then run:

```powershell
$env:WANDB_ENTITY="YOUR_ENTITY"
$env:WANDB_PROJECT="food-suggest-ingredient-detection"
python -m mlops.ingredient_detection.promote
```

Configure the inference service:

```text
MLOPS_ENABLED=true
MLOPS_REGISTRY=wandb
WANDB_API_KEY=...
WANDB_ENTITY=...
WANDB_PROJECT=food-suggest-ingredient-detection
WANDB_MODEL_ARTIFACT=ingredient-detector
WANDB_MODEL_ALIAS=production
```

Restart the service and verify `/health/detailed`.

## Remaining production work

- Add a real held-out test split; do not use validation metrics as the final
  release decision.
- Add image/label quality checks for duplicates, leakage, corrupt images, and
  class imbalance.
- Define approval ownership and rollback procedure for the `production` alias.
- Log inference latency, errors, confidence distribution, and user corrections.
- Add drift alerts and a retraining trigger after enough reviewed corrections.
- Export ONNX/TensorRT only after measuring the target deployment hardware.

Operational metrics, Grafana dashboards, and alert rules are documented in
`monitoring/README.md`.

The API key previously committed in the root `.env.example` must be revoked
and replaced at the provider; deleting it from the current file does not
remove it from Git history.
