# syntax=docker/dockerfile:1.6
# =============================================================================
# CookSmart Drift Detection - AWS Lambda Container Image
# Triggered by EventBridge rule (rate(6 hours))
# Push metrics len CloudWatch (EMF) thay vi Pushgateway
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: builder - cai dependencies
# -----------------------------------------------------------------------------
FROM public.ecr.aws/lambda/python:3.12-arm64 AS builder

ENV PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /tmp
COPY mlops/drift/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

# -----------------------------------------------------------------------------
# Runtime
# -----------------------------------------------------------------------------
FROM public.ecr.aws/lambda/python:3.12-arm64

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/var/task:/var/task/drift

# AWS Lambda Web Adapter (drift service cung la FastAPI app)
COPY --from=public.ecr.aws/awslabs/aws-lambda-web-adapter:0.8.4-arm64 \
     /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /var/task

# Drift service code (ca package: service.py, data_drift.py, concept_drift.py, prediction_drift.py, __init__.py, lambda_handler.py)
COPY mlops/drift/ ./drift/

# Python packages tu builder
COPY --from=builder /var/lang/lib/python3.12/site-packages /var/lang/lib/python3.12/site-packages
COPY --from=builder /var/lang/bin /var/lang/bin

# Healthcheck (chi dung cho local; Lambda khong can)
HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=2 \
  CMD curl -fsS http://localhost:8100/health || exit 1

EXPOSE 8100

# Drift job se duoc trigger boi EventBridge voi payload {"action": "run"}
# Web adapter se forward HTTP request den uvicorn o port 8100
# Tra ve 200 mac dinh cho Lambda runtime; web-adapter proxy HTTP request den uvicorn
CMD [ "drift.lambda_handler.handler" ]
