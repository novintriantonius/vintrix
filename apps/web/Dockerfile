# syntax=docker/dockerfile:1
FROM oven/bun:1.2-alpine AS builder
WORKDIR /app

# Copy package descriptors
COPY package.json bun.lock* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

# Build static assets
WORKDIR /app/apps/web
RUN bun run build

FROM nginx:1.27-alpine AS runner
# Copy custom nginx config for web SPA
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
# Copy built static artifacts
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
