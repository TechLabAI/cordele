# Shared Dockerfile for every Node backend service in this pnpm workspace
# (imp-service, comp-service, pub-service, proj-service). Build context is
# `backend/` (this directory) so the pnpm workspace resolves correctly.
#
# Select the service with --build-arg SERVICE=<service-dir-name>, e.g.:
#   docker build -f backend/Dockerfile --build-arg SERVICE=imp-service backend/
#
# Each service generates its own isolated Prisma Client (schema.prisma
# `output = "../src/infrastructure/prisma-client"`) — this is required in a
# single pnpm workspace, since services on the same @prisma/client version
# would otherwise dedupe to the same physical file and collide when more
# than one container/process runs `prisma generate` (see
# .techlab/learning/signals.jsonl: be-prisma:shared-client-workspace-collision).

FROM node:22-alpine AS base
RUN apk add --no-cache openssl libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY services/imp-service/package.json services/imp-service/package.json
COPY services/comp-service/package.json services/comp-service/package.json
COPY services/pub-service/package.json services/pub-service/package.json
COPY services/proj-service/package.json services/proj-service/package.json
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
ARG SERVICE
COPY . .
RUN pnpm --filter "./services/${SERVICE}" exec prisma generate
RUN pnpm --filter "./services/${SERVICE}" run build

FROM build AS runtime
ARG SERVICE
ENV NODE_ENV=production
WORKDIR /app/services/${SERVICE}
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
