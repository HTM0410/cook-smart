# syntax=docker/dockerfile:1.6
# =============================================================================
# CookSmart Backend (Node.js/TypeScript) - AWS Lambda Container Image
# Base: AWS Lambda Node.js 20 (arm64 / Graviton)
# Wrap Express qua aws-lambda-web-adapter
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: build - compile TypeScript
# -----------------------------------------------------------------------------
FROM public.ecr.aws/lambda/nodejs:20-arm64 AS build

WORKDIR /var/task

# Cache layer: chi copy lockfile truoc
COPY src/backend/package*.json ./
RUN npm ci --no-audit --no-fund

# Build source
COPY src/backend/tsconfig.json ./
COPY src/backend/src ./src
RUN npm run build && npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: runtime - chi giu dist + production deps
# -----------------------------------------------------------------------------
FROM public.ecr.aws/lambda/nodejs:20-arm64

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# AWS Lambda Web Adapter
COPY --from=public.ecr.aws/awslabs/aws-lambda-web-adapter:0.8.4-arm64 \
     /lambda-adapter /opt/extensions/lambda-adapter

WORKDIR /var/task

# Copy production deps + compiled code
COPY --from=build /var/task/node_modules ./node_modules
COPY --from=build /var/task/dist ./dist
COPY src/backend/package*.json ./

# YOLO service URL mac dinh (cung region, can route through API Gateway)
# Override qua env var trong Terraform
ENV YOLO_SERVICE_URL=""

# Healthcheck (chi cho local test)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

EXPOSE 3000

# Lambda entry: import ca server (start express port 3000) lan lambda_handler
# aws-lambda-web-adapter se forward HTTP request den port 3000
CMD [ "dist/lambda_entry.handler" ]
