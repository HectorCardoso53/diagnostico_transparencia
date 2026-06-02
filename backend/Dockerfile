# =============================================================
#  Backend — NestJS
#  Multi-stage: development | production
# =============================================================

# ── base ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ── development ───────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
EXPOSE 3001
CMD ["npm", "run", "start:dev"]

# ── build ─────────────────────────────────────────────────────
FROM base AS build
COPY package*.json ./
RUN npm ci
COPY . .
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
RUN npm run build

# ── production ────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npx prisma generate
EXPOSE 3001
CMD ["node", "dist/src/main"]
