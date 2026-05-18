# =============================================================
#  Frontend — Next.js
#  Multi-stage: development | production
# =============================================================

# ── base ──────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app

# ── development ───────────────────────────────────────────────
FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ── build ─────────────────────────────────────────────────────
FROM base AS build
ARG NEXT_PUBLIC_API_URL=http://localhost/api
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── production ────────────────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
