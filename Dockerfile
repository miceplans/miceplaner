# MICEPLANS API 이미지. 워크스페이스 패키지가 TS 소스를 직접 export하므로 빌드 없이 tsx로 실행한다.
# 빌드: docker build -t miceplans-api .
# 마이그레이션: docker build --target migrate -t miceplans-migrate .

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/ai/package.json packages/ai/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/knowledge/package.json packages/knowledge/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @miceplans/api...

FROM base AS api
ENV NODE_ENV=production PORT=3200
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml ./
COPY packages/config packages/config
COPY packages/ai/src packages/ai/src
COPY packages/ai/tsconfig.json packages/ai/
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/db/src packages/db/src
COPY packages/db/tsconfig.json packages/db/
COPY packages/domain/src packages/domain/src
COPY packages/domain/tsconfig.json packages/domain/
COPY packages/knowledge/src packages/knowledge/src
COPY packages/knowledge/tsconfig.json packages/knowledge/
COPY packages/queue/src packages/queue/src
COPY packages/queue/tsconfig.json packages/queue/
COPY packages/storage/src packages/storage/src
COPY packages/storage/tsconfig.json packages/storage/
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/
USER node
WORKDIR /app/apps/api
EXPOSE 3200
CMD ["node_modules/.bin/tsx", "src/main.ts"]

# 위키 협업 서버(Hocuspocus). 단일 task로 운영한다(ADR: 협업 서버를 둘 이상 운영하기 전까지 Redis 없음).
# 빌드: docker build --target collab -t miceplans-collab .
FROM base AS collab-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/collaboration/package.json apps/collaboration/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/editor-schema/package.json packages/editor-schema/
COPY packages/knowledge/package.json packages/knowledge/
COPY packages/queue/package.json packages/queue/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @miceplans/collaboration...

FROM base AS collab
ENV NODE_ENV=production COLLAB_PORT=3300
COPY --from=collab-deps /app/node_modules ./node_modules
COPY --from=collab-deps /app/apps/collaboration/node_modules ./apps/collaboration/node_modules
COPY --from=collab-deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml ./
COPY packages/config packages/config
COPY packages/db/src packages/db/src
COPY packages/db/tsconfig.json packages/db/
COPY packages/domain/src packages/domain/src
COPY packages/domain/tsconfig.json packages/domain/
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/editor-schema/src packages/editor-schema/src
COPY packages/editor-schema/tsconfig.json packages/editor-schema/
COPY packages/knowledge/src packages/knowledge/src
COPY packages/knowledge/tsconfig.json packages/knowledge/
COPY packages/queue/src packages/queue/src
COPY packages/queue/tsconfig.json packages/queue/
COPY apps/collaboration/package.json apps/collaboration/
COPY apps/collaboration/src apps/collaboration/src
COPY apps/collaboration/tsconfig.json apps/collaboration/
USER node
WORKDIR /app/apps/collaboration
EXPOSE 3300
CMD ["node_modules/.bin/tsx", "src/main.ts"]

# 파일 변환·임베딩 worker(pg-boss). 작업이 없을 때도 큐를 폴링하므로 단일 task로 운영한다.
# 빌드: docker build --target worker -t miceplans-worker .
# 배포 때 한 번: 마이그레이션 소유자 DATABASE_URL로 `node_modules/.bin/tsx ../../packages/queue/src/migrate.ts` (pgboss 스키마·큐 생성)
FROM base AS worker-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/worker/package.json apps/worker/
COPY packages/config/package.json packages/config/
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/domain/package.json packages/domain/
COPY packages/knowledge/package.json packages/knowledge/
COPY packages/queue/package.json packages/queue/
COPY packages/storage/package.json packages/storage/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @miceplans/worker...

FROM base AS worker
ENV NODE_ENV=production
COPY --from=worker-deps /app/node_modules ./node_modules
COPY --from=worker-deps /app/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=worker-deps /app/packages ./packages
COPY package.json pnpm-workspace.yaml ./
COPY packages/config packages/config
COPY packages/contracts/src packages/contracts/src
COPY packages/contracts/tsconfig.json packages/contracts/
COPY packages/db/src packages/db/src
COPY packages/db/tsconfig.json packages/db/
COPY packages/domain/src packages/domain/src
COPY packages/domain/tsconfig.json packages/domain/
COPY packages/knowledge/src packages/knowledge/src
COPY packages/knowledge/tsconfig.json packages/knowledge/
COPY packages/queue/src packages/queue/src
COPY packages/queue/tsconfig.json packages/queue/
COPY packages/storage/src packages/storage/src
COPY packages/storage/tsconfig.json packages/storage/
COPY apps/worker/src apps/worker/src
COPY apps/worker/tsconfig.json apps/worker/
USER node
WORKDIR /app/apps/worker
CMD ["node_modules/.bin/tsx", "src/main.ts"]

# 마이그레이션 전용(소유자 역할로 접속). 배포 파이프라인에서 일회성 task로 실행한다.
FROM debian:bookworm-slim AS migrate
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*
COPY packages/db/scripts /app/scripts
COPY packages/db/migrations /app/migrations
WORKDIR /app/scripts
ENTRYPOINT ["bash", "migrate.sh"]

# 기본 타깃은 api
FROM api
