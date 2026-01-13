# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/network-adapters/package.json ./packages/network-adapters/
COPY packages/api-gateway/package.json ./packages/api-gateway/
COPY packages/webhook-service/package.json ./packages/webhook-service/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/demo-app/package.json ./packages/demo-app/

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig*.json ./
COPY packages/ ./packages/

# Build
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files
COPY package*.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/network-adapters/package.json ./packages/network-adapters/
COPY packages/api-gateway/package.json ./packages/api-gateway/

# Install production dependencies only
RUN npm ci --only=production

# Copy built artifacts
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/network-adapters/dist ./packages/network-adapters/dist
COPY --from=builder /app/packages/api-gateway/dist ./packages/api-gateway/dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD wget -q --spider http://localhost:4000/health || exit 1

CMD ["node", "packages/api-gateway/dist/index.js"]
