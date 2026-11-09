# syntax=docker/dockerfile:1

# ---------- build: web app + bundled server ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# ---------- production dependencies of the server only ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev --workspace apps/server --no-audit --no-fund

# ---------- runtime ----------
FROM node:22-alpine
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    WEB_DIST=/app/web \
    MIGRATIONS_DIR=/app/drizzle
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server/dist ./dist
COPY --from=build --chown=node:node /app/apps/server/drizzle ./drizzle
COPY --from=build --chown=node:node /app/apps/web/dist ./web
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
