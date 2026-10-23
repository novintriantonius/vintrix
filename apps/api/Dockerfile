# syntax=docker/dockerfile:1
FROM oven/bun:1.2-alpine AS base
WORKDIR /app

# Install dependencies for building native bindings if any
RUN apk add --no-cache python3 make g++

FROM base AS builder
WORKDIR /app

# Copy root monorepo files
COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared & api
WORKDIR /app/apps/api
RUN bun run build

FROM oven/bun:1.2-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install minimal runtime deps
RUN apk add --no-cache curl

# Copy monorepo structures needed
COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

# Production install
RUN bun install --production --frozen-lockfile || bun install --production

# Copy built artifacts and database migrations
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src/db ./apps/api/src/db
COPY --from=builder /app/apps/api/drizzle.config.ts ./apps/api/drizzle.config.ts

WORKDIR /app/apps/api

EXPOSE 4000
CMD ["bun", "dist/index.js"]
