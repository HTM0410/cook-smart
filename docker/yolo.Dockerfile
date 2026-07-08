# syntax=docker/dockerfile:1.6
# =============================================================================
# CookSmart YOLO Inference - Production Dockerfile (CPU-only)
# Multi-stage build: wheel torch/ultralytics -> lean runtime
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: builder - download CPU-only wheels cho torch + ultralytics
# -----------------------------------------------------------------------------
FROM python:3.10-slim AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Cài đặt torch CPU-only + ultralytics vào local wheel dir
# Lưu ý: pin torch phiên bản CPU. Sentence-transformers sẽ kéo thêm torchvision.
RUN pip wheel \
      --wheel-dir /wheels \
      torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu

# -----------------------------------------------------------------------------
# Stage 2: runtime - chỉ giữ wheels + app code, không có compiler
# -----------------------------------------------------------------------------
FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# System dependency cho OpenCV + Pillow
RUN apt-get update \
 && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 curl \
 && rm -rf /var/lib/apt/lists/*

# Tạo non-root user
RUN groupadd -r app && useradd -r -g app app

# Copy wheels + cài đặt (cho phep pip fallback neu wheel local khong co).
# - --no-index chi dinh nghia wheel search path; neu packages khong co trong /wheels
#   pip se download tu PyPI (online). Neu can fully offline, hay pre-pin tat ca
#   packages trong /wheels.
COPY --from=builder /wheels /wheels
COPY src/backend/src/model_detection/yolo_inference_service/requirements.txt /tmp/requirements.txt

RUN pip install --find-links=/wheels -r /tmp/requirements.txt \
    && rm -rf /wheels /tmp/requirements.txt

WORKDIR /app

# Copy inference service code
COPY src/backend/src/model_detection/yolo_inference_service/ /app/

# Perms
RUN chown -R app:app /app
USER app

EXPOSE 8000

# Healthcheck cho ALB
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
  CMD curl -fsS http://localhost:8000/health || exit 1

# Single worker = single model load = consistent metrics
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
