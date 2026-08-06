# CookSmart (Food Suggest) — Hướng dẫn cài đặt & vận hành

Hệ thống gợi ý món ăn thông minh sử dụng AI, gồm:

- **Frontend**: React 19 + Vite + TypeScript (deploy trên Netlify)
- **Backend**: Node.js 20 + Express 5 + TypeScript (deploy trên AWS ECS Fargate hoặc AWS Lambda)
- **Database**: Supabase PostgreSQL
- **ML/YOLO**: Ultralytics YOLO (Python FastAPI) — 59 lớp nguyên liệu
- **RAG/Chatbot**: Google Gemini + LangChain
- **MLOps**: Weights & Biases + DVC + S3 + DynamoDB
- **Monitoring**: Prometheus + Grafana + Alertmanager

> Remote: `https://github.com/HTM0410/cook-smart.git`
> Branch mặc định: `main`

---

## Mục lục

1. [Yêu cầu môi trường](#1-yêu-cầu-môi-trường)
2. [Clone dự án từ Git](#2-clone-dự-án-từ-git)
3. [Cài đặt dependencies](#3-cài-đặt-dependencies)
4. [Cấu hình biến môi trường](#4-cấu-hình-biến-môi-trường)
5. [Khởi tạo database](#5-khởi-tạo-database)
6. [Chạy môi trường dev](#6-chạy-môi-trường-dev)
7. [Chạy bằng Docker](#7-chạy-bằng-docker)
8. [MLOps: dữ liệu, training, model registry](#8-mlops-dữ-liệu-training-model-registry)
9. [Deploy AWS (ECS / Lambda)](#9-deploy-aws-ecs--lambda)
10. [Troubleshooting](#10-troubleshooting)
11. [Phục hồi: xoá source local rồi đẩy lại lên git](#11-phục-hồi-xoá-source-local-rồi-đẩy-lại-lên-git)
12. [Cấu trúc thư mục](#12-cấu-trúc-thư-mục)

---

## 1. Yêu cầu môi trường

| Tool | Phiên bản | Ghi chú |
|------|-----------|---------|
| Node.js | **20.x LTS** | Backend + Frontend |
| npm | 10.x | đi kèm Node 20 |
| Python | **3.10** | YOLO inference service |
| Git | 2.40+ | |
| Docker Desktop | 4.x | tuỳ chọn (chạy full stack bằng Docker) |
| PowerShell | 7+ | Windows (các script `.ps1`) |
| AWS CLI v2 | 2.x | chỉ cần khi deploy |

Kiểm tra nhanh:

```powershell
node --version    # v20.x
npm --version     # 10.x
python --version  # Python 3.10.x
git --version
docker --version
```

---

## 2. Clone dự án từ Git

```powershell
# Đặt vào thư mục tuỳ ý, ví dụ D:\2025.2\DA
cd D:\2025.2\DA

# Clone (mặc định branch main)
git clone https://github.com/HTM0410/cook-smart.git food_suggest

cd food_suggest
```

Khuyến nghị giữ đúng tên thư mục `food_suggest` vì một số script và đường dẫn tương đối trong `docs/` tham chiếu tới tên này.

### (Tuỳ chọn) Checkout đúng branch làm việc

```powershell
git branch -a                         # liệt kê các branch
git checkout feature/ingredient-search-improvement
```

---

## 3. Cài đặt dependencies

### 3.1. Root (chỉ chứa script orchestration)

```powershell
cd D:\2025.2\DA\food_suggest
npm install
```

### 3.2. Backend (`src/backend`)

```powershell
cd D:\2025.2\DA\food_suggest\src\backend
npm install
```

> Nếu gặp cảnh báo peer dependency, dùng:
>
> ```powershell
> npm install --legacy-peer-deps
> ```

### 3.3. Frontend (`src/frontend`)

```powershell
cd D:\2025.2\DA\food_suggest\src\frontend
npm install
```

### 3.4. YOLO inference service (Python)

```powershell
cd D:\2025.2\DA\food_suggest\src\backend\src\model_detection\yolo_inference_service

python -m venv venv
.\venv\Scripts\Activate.ps1

pip install --upgrade pip
pip install -r requirements.txt
```

### 3.5. MLOps Python package (training / drift)

Không có `requirements-mlops.txt` trong repo, cài thủ công:

```powershell
pip install ultralytics wandb pyyaml numpy boto3 scipy scikit-learn `
            fastapi uvicorn httpx prometheus-client click dvc dvc-s3
```

> DVC cần cấu hình remote S3 trước khi `dvc pull` (xem mục 8).

---

## 4. Cấu hình biến môi trường

Mỗi package có file `.env.example` đi kèm — copy và điền giá trị thật.

### 4.1. Backend — `src/backend/.env`

```powershell
cd D:\2025.2\DA\food_suggest\src\backend
Copy-Item .env.example .env
notepad .env
```

Biến bắt buộc:

| Biến | Mô tả | Ví dụ |
|------|-------|-------|
| `SUPABASE_DB_URL` | connection string Postgres | `postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres` |
| `JWT_SECRET` | chữ ký JWT | `chuoi-bi-mat-dai-32-ky-tu` |
| `GEMINI_API_KEY` | API key Google Gemini (dùng cho cả embedding + RAG) | `AIzaSy...` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | upload ảnh | (đăng ký cloudinary.com) |

Biến tuỳ chọn nhưng hay dùng:

| Biến | Mặc định | Ghi chú |
|------|----------|---------|
| `NODE_ENV` | `development` | |
| `PORT` | `3000` | |
| `DB_SYNC_ALTER` | `false` | `true` để sequelize tự sync schema (chỉ dev) |
| `REDIS_ENABLED` | `false` | `true` + `REDIS_URL` để bật cache |
| `ELASTICSEARCH_ENABLED` | `false` | bật autocomplete |
| `CLIENT_URL` | | URL frontend, dùng cho CORS |
| `CORS_ORIGIN` | | comma-separated |
| `LOG_LEVEL` | `info` | winston |
| `YOLO_SERVICE_URL` | `http://localhost:8000` | URL YOLO inference |
| `METRICS_TOKEN` | | bearer token cho `/metrics` (bắt buộc ở prod) |

### 4.2. Frontend — `src/frontend/.env`

```powershell
cd D:\2025.2\DA\food_suggest\src\frontend
Copy-Item .env.example .env
notepad .env
```

Ví dụ khi dev local:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

Khi dev có backend thật (staging/prod):

```env
VITE_API_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com
```

> Vite proxy trong `vite.config.ts` đã map `/api`, `/socket.io`, `/uploads` → `http://localhost:3000`, nên dev local có thể bỏ trống `VITE_API_URL`.

### 4.3. YOLO inference service — `src/backend/src/model_detection/yolo_inference_service/.env`

```powershell
cd D:\2025.2\DA\food_suggest\src\backend\src\model_detection\yolo_inference_service
Copy-Item .env.example .env
notepad .env
```

Biến chính:

| Biến | Mặc định | Ghi chú |
|------|----------|---------|
| `YOLO_MODEL_PATH` | `./best59.pt` | model local |
| `YOLO_LABEL_MAPPING_PATH` | `./label_mapping.json` | ánh xạ nhãn |
| `CONF_INFERENCE_FLOOR` | `0.25` | ngưỡng confidence |
| `CUDA_VISIBLE_DEVICES` | (rỗng) | để trống = CPU |
| `EMBEDDING_MODEL` | `BAAI/bge-m3` | sentence-transformers |
| `MLOPS_ENABLED` | `false` | `true` để load model từ W&B |
| `WANDB_API_KEY` / `WANDB_ENTITY` / `WANDB_PROJECT` | | bắt buộc nếu `MLOPS_ENABLED=true` |
| `WANDB_MODEL_ALIAS` | `production` | alias model trên W&B |
| `PORT` / `HOST` | `8000` / `0.0.0.0` | |

### 4.4. Root — `.env` (MLOps)

```powershell
cd D:\2025.2\DA\food_suggest
Copy-Item .env.example .env
notepad .env
```

Bắt buộc cho huấn luyện/registry:

```env
WANDB_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxx
WANDB_ENTITY=your-wandb-team
WANDB_PROJECT=ingredient-detection
DVC_S3_REMOTE_URL=s3://cooksmart-dvc/food-suggest
AWS_DEFAULT_REGION=ap-southeast-1
```

### 4.5. Monitoring — `monitoring/.env`

```powershell
cd D:\2025.2\DA\food_suggest
Copy-Item monitoring\.env.example monitoring\.env
notepad monitoring\.env
```

**Nhớ đổi `GRAFANA_ADMIN_PASSWORD`** (mặc định `change-me-now`).

---

## 5. Khởi tạo database

Backend dùng Supabase Postgres. Có hai cách:

### 5.1. Dùng Supabase Cloud (khuyến nghị)

1. Tạo project tại [supabase.com](https://supabase.com).
2. Lấy connection string ở **Settings → Database → Connection string → URI**.
3. Dán vào `SUPABASE_DB_URL` trong `src/backend/.env`.

### 5.2. Dùng Postgres local

Khởi chạy Postgres bất kỳ (Docker, native, Neon, …), rồi set URL:

```env
SUPABASE_DB_URL=postgresql://postgres:postgres@localhost:5432/cooksmart
```

### 5.3. Tạo schema + seed

Sequelize tự tạo schema khi backend boot (nhờ `sequelize.sync()`). Để tự động cập nhật schema khi model thay đổi (chỉ dùng dev):

```env
DB_SYNC_ALTER=true
```

Seed dữ liệu nền (ingredient conflicts):

```powershell
cd D:\2025.2\DA\food_suggest\src\backend
npm run db:seed
```

Các lệnh DB khác:

```powershell
npm run db:migrate      # chạy sequelize migrations (nếu có)
npm run db:reset        # undo + migrate + seed
```

---

## 6. Chạy môi trường dev

### 6.1. Một lệnh duy nhất (khuyến nghị)

```powershell
cd D:\2025.2\DA\food_suggest
npm run dev
```

Script `scripts/start-all.js` sẽ chạy **đồng thời**:

- Backend (`npm run dev` ở `src/backend`) — Express port `:3000`
- YOLO inference service (PowerShell `start-yolo.ps1`) — FastAPI port `:8000`
- Frontend (`npm run dev` ở `src/frontend`) — Vite port `:5173`

### 6.2. Chạy thủ công từng service

```powershell
# Terminal 1 — YOLO service
cd D:\2025.2\DA\food_suggest\src\backend
.\start-yolo.ps1
# hoặc: uvicorn app:app --host 0.0.0.0 --port 8000 (sau khi activate venv)

# Terminal 2 — Backend API
cd D:\2025.2\DA\food_suggest\src\backend
npx ts-node src/server.ts

# Terminal 3 — Frontend
cd D:\2025.2\DA\food_suggest\src\frontend
npm run dev
```

### 6.3. Truy cập

| Service | URL |
|---------|-----|
| Frontend (Vite) | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Swagger docs | http://localhost:3000/api/docs |
| YOLO inference | http://localhost:8000/docs |
| Health check | http://localhost:3000/health |

---

## 7. Chạy bằng Docker

### 7.1. Full MLOps stack (backend + yolo + drift + prometheus + grafana)

```powershell
cd D:\2025.2\DA\food_suggest
docker compose -f docker-compose.mlops.yml up --build
```

| Service | Port |
|---------|------|
| backend | 3000 |
| yolo | 8000 |
| drift | 8100 |
| pushgateway | 9091 |
| prometheus | 9090 |
| grafana | 3001 (`admin` / password trong `monitoring/.env`) |

### 7.2. Stack monitoring riêng

```powershell
cd D:\2025.2\DA\food_suggest
docker compose --env-file monitoring\.env -f monitoring\docker-compose.monitoring.yml up -d
```

### 7.3. Smoke test Lambda Dockerfiles (trước khi push ECR)

```powershell
cd D:\2025.2\DA\food_suggest
docker compose -f docker-compose.lambda.yml up --build
```

---

## 8. MLOps: dữ liệu, training, model registry

### 8.1. Pull dữ liệu từ DVC

```powershell
cd D:\2025.2\DA\food_suggest
pip install dvc dvc-s3
dvc remote modify myremote url $env:DVC_S3_REMOTE_URL    # đã set trong .env
dvc pull
```

### 8.2. Train mới

```powershell
cd D:\2025.2\DA\food_suggest\mlops\ingredient_detection
# Sửa configs/params.yaml nếu cần
python prepare.py
python train.py
python evaluate.py
```

### 8.3. Promote model lên production alias

```powershell
python promote.py --alias production
```

Script sẽ:

1. Upload artifact lên W&B.
2. Cập nhật DynamoDB `ALIAS#production` (Terraform đã tạo).
3. YOLO service (khi `MLOPS_ENABLED=true`) tự pull version mới.

### 8.4. Drift detection (cron 6h)

Cron chạy trong GitHub Actions (`.github/workflows/drift-cron.yml`). Trigger tay:

```powershell
curl -X POST -H "Authorization: Bearer $METRICS_TOKEN" $DRIFT_URL/api/v1/drift/run
```

Xem chi tiết: `docs/drift-runbook.md`.

---

## 9. Deploy AWS (ECS / Lambda)

Repo đang vận hành song song **hai stack**:

- **ECS Fargate** (legacy, đang chạy prod) — `infra/envs/prod/main.tf`
- **Lambda + API Gateway HTTP API** (mới, song song) — `infra/envs/prod/main.tf.lambda`

Tham chiếu chi tiết:
- `docs/production-deployment-runbook.md` — 9-phase deploy guide
- `docs/aws-deployment-preparation.md` — cách thu thập VPC/Subnet/ACM/CodeStar IDs
- `docs/rollback-procedure.md` — rollback 5 cấp
- `docs/mlops-blue-green.md` — blue/green cho ML pipeline

### 9.1. Một lần: tạo Terraform backend

```powershell
cd D:\2025.2\DA\food_suggest
.\infra\scripts\setup-backend.ps1 -BucketName cooksmart-tfstate -TableName cooksmart-tflock -Region ap-southeast-1
```

### 9.2. Cấu hình tfvars

```powershell
cd D:\2025.2\DA\food_suggest\infra\envs\prod
Copy-Item terraform.tfvars.example terraform.tfvars
notepad terraform.tfvars
```

### 9.3. Apply

```powershell
.\deploy.ps1 -Action apply -AutoApprove
```

### 9.4. Inject secrets vào AWS Secrets Manager

```powershell
cd D:\2025.2\DA\food_suggest
.\infra\scripts\setup-secrets.ps1 `
  -WandbApiKey "<WANDB_API_KEY>" `
  -DatabaseUrl "<SUPABASE_DB_URL>" `
  -GeminiApiKey "<GEMINI_API_KEY>" `
  -CloudinaryCloudName "<NAME>" `
  -CloudinaryApiKey "<KEY>" `
  -CloudinaryApiSecret "<SECRET>"
```

### 9.5. Frontend auto-deploy qua Netlify

Push lên `main` khi đổi `src/frontend/**` sẽ trigger `.github/workflows/deploy-frontend.yml`. Cần set GitHub Secrets:

- `NETLIFY_AUTH_TOKEN`
- `NETLIFY_SITE_ID`
- Biến repo: `VITE_API_URL`, `VITE_WS_URL`

### 9.6. Backend auto-deploy qua ECS

Push lên `main` khi đổi `src/backend/**` sẽ trigger `.github/workflows/deploy-backend.yml` → build → push ECR → ECS rolling deploy.

---

## 10. Troubleshooting

| Lỗi | Nguyên nhân | Cách xử lý |
|------|-----------|-----------|
| `YOLO service unavailable` trên backend | YOLO chưa chạy | chạy `start-yolo.ps1` hoặc `docker compose -f docker-compose.mlops.yml up yolo` |
| `password authentication failed for user "postgres"` | Sai `SUPABASE_DB_URL` | kiểm tra lại URL trong Supabase dashboard |
| Vite báo `EADDRINUSE :::5173` | port bị chiếm | đổi `server.port` trong `vite.config.ts` hoặc tắt tiến trình cũ |
| `Could not load embedding model` | thiếu RAM / chưa `pip install sentence-transformers` | `pip install -r requirements.txt` |
| `wandb: ERROR unauthorized` | sai `WANDB_API_KEY` | `wandb login` |
| Backend không auto-sync schema | `DB_SYNC_ALTER=false` | tạm bật `DB_SYNC_ALTER=true` (chỉ dev) |
| Lỗi `Cannot find module 'axios'` sau khi clone | chưa `npm install` | chạy lại `npm install` ở module tương ứng |
| ECS task fail `ImagePullBackOff` | ECR image chưa push | chạy `deploy-backend.yml` hoặc `.aws/deploy_ml_infrastructure.py` |
| Lambda alias không switch | thiếu IAM permission | xem `docs/rollback-procedure.md` |

---

## 11. Phục hồi: xoá source local rồi đẩy lại lên git

### 11.1. Trước khi xoá — backup những thứ Git bỏ qua

`git status` hiện tại có thể có file untracked quan trọng (log, task def mới, …). Có ba nhóm:

1. **Không mất** (đã commit hoặc đã push): toàn bộ code dưới `src/`, `docs/`, `infra/`, `mlops/`, `monitoring/`, `docker/`, scripts chính.
2. **Có thể mất** (untracked, nhưng có ích): `.aws/ecs-task-def-backend-v36.json`, `.aws/task35-log.*`, `.aws/task36-log.*`, `.aws/commit-msg.txt`, `.aws/commit_msg.txt`, `.aws/step3_restore.py`, `.aws/yolo-debug2.json`, v.v.
3. **Tự tái tạo được**: `node_modules/`, `__pycache__/`, `.venv/`, `dist/`, `build/`, `*.log`, `infra/envs/prod/terraform.tfvars` (có file `.example`).

### 11.2. Bước 1 — backup các file quan trọng

```powershell
cd D:\2025.2\DA\food_suggest

# Tạo một bản backup ngoài repo
$backup = "D:\cooksmart-backup-$(Get-Date -Format yyyyMMdd-HHmmss)"
mkdir $backup

# Copy toàn bộ thư mục .aws (chứa task def + log CloudWatch)
Copy-Item -Recurse .aws $backup\.aws

# Copy các file env đã điền (đÃ được gitignore, KHÔNG có trên git)
Copy-Item src\backend\.env $backup\backend.env
Copy-Item src\frontend\.env $backup\frontend.env
Copy-Item src\backend\src\model_detection\yolo_inference_service\.env $backup\yolo.env
Copy-Item .env $backup\root.env
Copy-Item monitoring\.env $backup\monitoring.env

# Terraform tfvars (nếu đã apply)
if (Test-Path infra\envs\prod\terraform.tfvars) {
  Copy-Item infra\envs\prod\terraform.tfvars $backup\terraform.tfvars
}

# Bất kỳ thứ gì untracked khác
git status --porcelain | Where-Object { $_.StartsWith("??") } | ForEach-Object {
  $path = $_.Substring(3)
  if (Test-Path $path) {
    $dest = Join-Path $backup "untracked"
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    Copy-Item -Recurse -Force $path $dest
  }
}

Write-Host "Backup xong tai $backup"
```

### 11.3. Bước 2 — xoá toàn bộ source local

```powershell
# Tắt mọi tiến trình dev đang chạy (powershell start-yolo, vite, ts-node, docker)
Get-Process node, python, docker -ErrorAction SilentlyContinue | Stop-Process -Force

# Xoá thư mục dự án
cd D:\2025.2\DA
Remove-Item -Recurse -Force food_suggest
```

### 11.4. Bước 3 — clone lại từ git

```powershell
cd D:\2025.2\DA
git clone https://github.com/HTM0410/cook-smart.git food_suggest
cd food_suggest
```

### 11.5. Bước 4 — phục hồi cấu hình

```powershell
# Khôi phục file env
Copy-Item $backup\backend.env  src\backend\.env -Force
Copy-Item $backup\frontend.env src\frontend\.env -Force
Copy-Item $backup\yolo.env     src\backend\src\model_detection\yolo_inference_service\.env -Force
Copy-Item $backup\root.env     .\.env -Force
Copy-Item $backup\monitoring.env monitoring\.env -Force

# Khôi phục tfvars
if (Test-Path $backup\terraform.tfvars) {
  Copy-Item $backup\terraform.tfvars infra\envs\prod\terraform.tfvars -Force
}

# Khôi phục thư mục .aws (không commit, chỉ dùng nội bộ)
Copy-Item -Recurse $backup\.aws .aws
```

### 11.6. Bước 5 — cài lại dependencies

```powershell
# Root
npm install

# Backend
cd src\backend
npm install
cd ..\..

# Frontend
cd src\frontend
npm install
cd ..\..

# YOLO Python
cd src\backend\src\model_detection\yolo_inference_service
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
deactivate
cd D:\2025.2\DA\food_suggest
```

### 11.7. Bước 6 — chạy lại dev

```powershell
cd D:\2025.2\DA\food_suggest
npm run dev
```

---

## 12. Cấu trúc thư mục

```
food_suggest/
├── .aws/                      # Script vận hành AWS (KHÔNG commit; .gitignore)
│   ├── deploy_ml_infrastructure.py
│   ├── enable_drift_cron.py
│   ├── deploy_service.py
│   ├── ecs-task-def-*.json
│   └── ...
├── .github/workflows/         # CI/CD: backend-ci, deploy-backend, deploy-frontend,
│                              #       ml-training, drift-cron, mlops-checks, ...
├── docs/                      # 13 file tài liệu vận hành (tiếng Việt + Anh)
├── docker/                    # Dockerfiles cho backend, yolo, drift (Lambda + ECS)
├── infra/                     # Terraform IaC
│   ├── envs/prod/             # entry point (deploy.ps1, terraform.tfvars.example)
│   ├── modules/               # alb, ecs_blue_green, lambda, secrets, monitoring, ...
│   └── scripts/               # setup-backend, setup-secrets, deploy-lambda
├── mlops/                     # training + drift + serving
│   ├── ingredient_detection/  # prepare / train / evaluate / promote
│   ├── drift/                 # 3-channel drift service
│   ├── data/yolo_dataset/     # DVC-tracked (git pull required)
│   └── configs/ (params.yaml)
├── monitoring/                # Prometheus + Grafana + Alertmanager
├── src/
│   ├── frontend/              # React 19 + Vite + TS (deploy Netlify)
│   └── backend/               # Node 20 + Express5 + TS (deploy ECS / Lambda)
│       └── src/model_detection/yolo_inference_service/   # Python FastAPI YOLO
├── tests/                     # Integration tests (MLOps)
├── scripts/start-all.js       # Root launcher
├── docker-compose.mlops.yml   # local full stack
├── docker-compose.lambda.yml  # local Lambda smoke test
├── package.json               # root scripts
├── .env.example               # root MLOps env
└── README.md                  # file này
```

---

## Tài liệu tham chiếu nhanh

| Tài liệu | Mục đích |
|----------|----------|
| `docs/production-deployment-runbook.md` | 9-phase deploy AWS |
| `docs/aws-deployment-preparation.md` | Thu thập VPC/Subnet/ACM/CodeStar IDs |
| `docs/rollback-procedure.md` | Rollback 5 cấp (Lambda + ECS) |
| `docs/MLOPS_PIPELINE.md` | Pipeline huấn luyện & promotion |
| `docs/mlops-blue-green.md` | Blue/green cho ML model |
| `docs/drift-runbook.md` | Vận hành drift detection |
| `docs/intent-classifier-runbook.md` | Phân loại ý định (Gemini) |
| `docs/kien-truc-he-thong-rag.md` | Kiến trúc RAG |
| `infra/README.md` | Terraform modules overview |
| `mlops/README.md` | MLOps training + serving |
| `monitoring/README.md` | Prometheus + Grafana setup |
| `BAO_CAO_MLOPS.md` | Báo cáo MLOps (tiếng Việt) |
| `CLEANUP_PLAN.md` | Post-Lambda cleanup checklist |

---

## License

MIT License — xem [`LICENSE`](./LICENSE) (nếu có trong repo).
