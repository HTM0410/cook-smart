# syntax=docker/dockerfile:1.6
# =============================================================================
# CookSmart Backend - Production Dockerfile
# Multi-stage build: TypeScript compile -> lean runtime image
# =============================================================================
# Context: project root (.)
# Files are in src/backend/

# -----------------------------------------------------------------------------
# Stage 1: build - compile TypeScript
# -----------------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Copy from src/backend/ since context is project root
# Phải copy TRƯỚC npm ci vì postinstall chạy tsc ngay
COPY src/backend/package.json src/backend/package-lock.json* ./
COPY src/backend/tsconfig.json ./
COPY src/backend/src ./src

RUN npm ci --no-audit --no-fund --legacy-peer-deps --ignore-scripts

# Build TypeScript sau khi đã có đủ source
RUN npx tsc

# -----------------------------------------------------------------------------
# Stage 2: runtime - chỉ giữ production deps, skip postinstall
# -----------------------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Cài đặt curl cho healthcheck (wget có sẵn trên busybox alpine)
RUN apk add --no-cache curl

# Cài production dependencies - KHÔNG chạy postinstall/scripts
COPY src/backend/package.json src/backend/package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund --legacy-peer-deps --ignore-scripts \
    && npm cache clean --force

# Copy compiled output
COPY --from=build /app/dist ./dist

# Tạo user không root
USER node

EXPOSE 3000

# Healthcheck gọi /health để ALB kiểm tra
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
