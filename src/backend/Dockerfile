# ===========================================
# CookSmart Backend Dockerfile
# Node.js/TypeScript -> Production
# ===========================================

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev for build)
RUN npm ci --include=dev --legacy-peer-deps

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Prune dev dependencies
RUN npm prune --production --legacy-peer-deps

# ===========================================
# Stage 2: Production
FROM node:20-alpine AS production

# Create app user with HOME=/tmp (writable for non-root)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./

# Pre-create writable directories (uploads + logs) and give full ownership to nodejs
RUN mkdir -p /app/uploads /app/logs && chown -R nodejs:nodejs /app

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Expose port
EXPOSE ${PORT}

# Start server
CMD ["node", "dist/server.js"]
