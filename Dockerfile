FROM oven/bun:1.0.15-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun --bun install --prod

FROM base AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

FROM base
WORKDIR /app
RUN mkdir -p /app/logs
COPY --from=deps /app/node_modules /app/node_modules
COPY --from=build /app/build /app/build
ENV NODE_ENV production
CMD ["bun", "run", "./build/sse-server.js"]
EXPOSE 10203
