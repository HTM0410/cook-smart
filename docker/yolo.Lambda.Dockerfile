# syntax=docker/dockerfile:1.6
# =============================================================================
# CookSmart YOLO Inference - AWS Lambda Container Image
# Base: AWS Lambda Python 3.12 (arm64 / Graviton)
# Wrap FastAPI/uvicorn qua aws-lambda-web-adapter (Lambda function URL / API Gateway HTTP API)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: builder - cai dat torch CPU + dependencies
# -----------------------------------------------------------------------------
FROM public.ecr.aws/lambda/python:3.12-arm64 AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy chi requirements truoc de cache tot khi chi sua code
COPY src/backend/src/model_detection/yolo_inference_service/requirements.txt /tmp/requirements.txt

# Cai torch CPU-only truoc (layer lon nhat, thay doi it) tu pytorch index
RUN pip install --no-cache-dir \
        --index-url https://download.pytorch.org/whl/cpu \
        torch==2.3.1 torchvision==0.18.1

# Cai phan con lai
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# -----------------------------------------------------------------------------
# Stage 2: runtime - lean image, copy artifacts tu builder
# -----------------------------------------------------------------------------
FROM public.ecr.aws/lambda/python:3.12-arm64

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    OMP_NUM_THREADS=6 \
    MKL_NUM_THREADS=6 \
    CUDA_VISIBLE_DEVICES="" \
    PYTHONPATH=/var/task

# AWS Lambda Web Adapter (chuyen ASGI/WSGI app thanh Lambda handler)
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.8.4 \
     /lambda-adapter /opt/extensions/lambda-adapter

ENV PORT=8000
ENV HOST=0.0.0.0

# Copy application code vao $LAMBDA_TASK_ROOT (mac dinh /var/task)
WORKDIR /var/task
COPY src/backend/src/model_detection/yolo_inference_service/ ./

# Copy installed Python packages tu builder
COPY --from=builder /var/lang/lib/python3.12/site-packages /var/lang/lib/python3.12/site-packages
COPY --from=builder /var/lang/bin /var/lang/bin

# Healthcheck cho Lambda container (chi cho local)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

EXPOSE 8000

# Web-adapter se forward HTTP request den uvicorn o port 8000
# Handler la stub de Lambda runtime resolve CMD
CMD [ "lambda_handler.handler" ]
