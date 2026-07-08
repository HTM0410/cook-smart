# syntax=docker/dockerfile:1.6
# =============================================================================
# CookSmart Drift Detection Service
# FastAPI service kiem tra data/concept/prediction drift
# va day metric len Prometheus Pushgateway
# =============================================================================

FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

RUN groupadd -r app && useradd -r -g app app

# Cài đặt runtime dependencies - tách khỏi inference service để giữ image gọn
WORKDIR /app

COPY mlops/drift/requirements.txt /app/requirements.txt

RUN pip install -r /app/requirements.txt \
 && rm -rf /root/.cache

# Copy service code + drift modules + common
COPY mlops/drift/ /app/drift/
COPY mlops/ingredient_detection/common.py /app/_common.py
COPY mlops/ingredient_detection/__init__.py /app/__init__.py

RUN touch /app/__init__.py
ENV PYTHONPATH=/app

RUN chown -R app:app /app
USER app

EXPOSE 8100

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:8100/health || exit 1

CMD ["uvicorn", "drift.service:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "1"]
