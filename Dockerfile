# syntax=docker/dockerfile:1

# ---- build stage ------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---- runtime stage ----------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# NITRO_PORT / NUXT_APP_BASE_URL / NUXT_TGBP_* are injected per container
# by docker-compose (see docker-compose.yml and .env.staging/.env.production).

COPY --from=build /app/.output ./.output

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
