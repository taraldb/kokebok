# ── Builder ───────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Build tools for better-sqlite3 native compilation
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install ALL deps (including devDeps for Vite build)
COPY package.json package-lock.json ./
RUN npm ci

# Build admin frontend
COPY admin/ ./admin/
COPY public/assets/recipe-shared.css ./public/assets/recipe-shared.css
RUN npm run build:admin

# Prune to production deps
RUN npm prune --omit=dev

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy production node_modules (already pruned + compiled)
COPY --from=builder /app/node_modules ./node_modules

# Copy server source
COPY server/ ./server/

# Copy built admin frontend
COPY --from=builder /app/admin/dist ./admin/dist/

# Copy public assets (CSS, theme.js, etc.)
COPY public/ ./public/

# Copy package.json (needed for npm scripts and metadata)
COPY package.json ./

ENV DATA_DIR=/data
ENV RECIPES_DIR=/data/recipes
ENV PORT=8080

VOLUME /data
EXPOSE 8080

# Unraid runs containers as uid 99 (nobody) — ensure /data is writable
# Run: chown -R 99:100 /mnt/user/appdata/kokebok on Unraid before first start

CMD ["node", "server/index.js"]
