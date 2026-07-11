# YOLO Inference Service Dockerfile
# Multi-stage build for optimized production image

# ===========================================
# Stage 1: Builder - Install dependencies
# ===========================================
FROM python:3.10-slim AS builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES="" \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
# retry once on transient mirror failures, then fall back to deb.debian.org
RUN for i in 1 2 3; do \
      apt-get update && break || sleep 5; \
    done && \
    apt-get install -y --no-install-recommends --fix-missing \
      build-essential \
      libgomp1 \
      libgl1 \
      libglib2.0-0 \
      && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ===========================================
# Stage 2: Production
# ===========================================
FROM python:3.10-slim AS production

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES="" \
    PYTHONFAULTHANDLER=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Install runtime dependencies only
RUN for i in 1 2 3; do \
      apt-get update && break || sleep 5; \
    done && \
    apt-get install -y --no-install-recommends --fix-missing \
      libgomp1 \
      libgl1 \
      libglib2.0-0 \
      libsm6 \
      libxext6 \
      libxrender1 \
      curl \
      && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create non-root user for security
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

# Set working directory
WORKDIR /app

# Copy application code
COPY --chown=appuser:appgroup app.py .
COPY --chown=appuser:appgroup wandb_loader.py .

# Copy model downloader script
COPY --chown=appuser:appgroup download_model.py .

# Create models directory
RUN mkdir -p /app/models && chown -R appuser:appgroup /app/models

# Copy model weights if exists (can be mounted as volume)
# RUN mkdir -p /app/models && mv best.pt /app/models/ 2>/dev/null || true

# Expose port
EXPOSE ${PORT}

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Switch to non-root user
USER appuser

# Run the application
CMD ["sh", "-c", "python download_model.py && uvicorn app:app --host 0.0.0.0 --port 8000"]
