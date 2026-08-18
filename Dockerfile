# Stage 0: Base image
# Pinned by digest, not by the floating `node:24-alpine` tag. A Docker Hub push
# to that tag can otherwise change the build environment with no commit on our
# side, which turned a green branch red on PR #449: 13 Turbopack errors
# (`__turbopack_context__.a is not a function`) evaluating postcss.config.js,
# where the same `npm run build` had passed on the runner in the same workflow
# run and a plain re-run went green. This is the multi-arch index digest, so
# both the amd64 and the ARM64 self-hosted runner still resolve correctly.
# To bump: docker manifest inspect node:24-alpine  (take the index digest)
FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS base

# BuildKit Platform Context (used for metadata, not to alter FROM)
ARG BUILDPLATFORM
ARG TARGETPLATFORM

# Build-time args from docker-compose or GitHub Actions
ARG NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ARG NEXT_PUBLIC_BACKEND_SERVICE_HOST
ARG NEXT_PUBLIC_BACKEND_SERVICE_PORT
ARG NEXT_PUBLIC_BACKEND_SERVICE_API_PATH
ARG NEXT_PUBLIC_BACKEND_API_VERSION
ARG NEXT_PUBLIC_TIPTAP_APP_ID
ARG NEXT_PUBLIC_BASE_PATH
ARG GIT_COMMIT_SHA
ARG FRONTEND_SERVICE_INTERFACE
ARG FRONTEND_SERVICE_PORT

# Optional diagnostics (doesn't affect final image)
RUN echo "Build Platform: ${BUILDPLATFORM} -> Target Platform: ${TARGETPLATFORM}"

# Stage 1: Dependencies
# `npm ci --prefer-offline --no-audit` is deterministic (matches package-lock
# exactly) and skips the audit/network round-trip. The buildkit cache mount
# at /root/.npm preserves the npm cache across layers, so warm rebuilds skip
# the cold tarball fetch entirely.
FROM base AS deps
RUN apk update && apk upgrade --no-cache && apk add --no-cache libc6-compat

WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit

# Stage 2: Builder
FROM base AS builder

RUN apk update && apk upgrade --no-cache && apk add --no-cache bash vim

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Redeclare ARGs for this stage (Docker ARGs don't cross FROM boundaries)
ARG NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ARG NEXT_PUBLIC_BACKEND_SERVICE_HOST
ARG NEXT_PUBLIC_BACKEND_SERVICE_PORT
ARG NEXT_PUBLIC_BACKEND_SERVICE_API_PATH
ARG NEXT_PUBLIC_BACKEND_API_VERSION
ARG NEXT_PUBLIC_TIPTAP_APP_ID
ARG NEXT_PUBLIC_BASE_PATH
ARG GIT_COMMIT_SHA

# Pass them as ENV so Next.js static build can access
ENV NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL=$NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ENV NEXT_PUBLIC_BACKEND_SERVICE_HOST=$NEXT_PUBLIC_BACKEND_SERVICE_HOST
ENV NEXT_PUBLIC_BACKEND_SERVICE_PORT=$NEXT_PUBLIC_BACKEND_SERVICE_PORT
ENV NEXT_PUBLIC_BACKEND_SERVICE_API_PATH=$NEXT_PUBLIC_BACKEND_SERVICE_API_PATH
ENV NEXT_PUBLIC_BACKEND_API_VERSION=$NEXT_PUBLIC_BACKEND_API_VERSION
ENV NEXT_PUBLIC_TIPTAP_APP_ID=$NEXT_PUBLIC_TIPTAP_APP_ID
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA

# Build the Next.js application
# Note: Use `next build` to build the application for production
RUN npm run build

# Stage 3: Runtime Image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder /app/package.json ./

USER nextjs

# Expose the port
EXPOSE 3000

# Redeclare ARGs for this stage
ARG NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ARG NEXT_PUBLIC_BACKEND_SERVICE_HOST
ARG NEXT_PUBLIC_BACKEND_SERVICE_PORT
ARG NEXT_PUBLIC_BACKEND_SERVICE_API_PATH
ARG NEXT_PUBLIC_BACKEND_API_VERSION
ARG NEXT_PUBLIC_TIPTAP_APP_ID
ARG NEXT_PUBLIC_BASE_PATH
ARG GIT_COMMIT_SHA
ARG FRONTEND_SERVICE_INTERFACE
ARG FRONTEND_SERVICE_PORT

ENV NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL=$NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ENV NEXT_PUBLIC_BACKEND_SERVICE_HOST=$NEXT_PUBLIC_BACKEND_SERVICE_HOST
ENV NEXT_PUBLIC_BACKEND_SERVICE_PORT=$NEXT_PUBLIC_BACKEND_SERVICE_PORT
ENV NEXT_PUBLIC_BACKEND_SERVICE_API_PATH=$NEXT_PUBLIC_BACKEND_SERVICE_API_PATH
ENV NEXT_PUBLIC_BACKEND_API_VERSION=$NEXT_PUBLIC_BACKEND_API_VERSION
ENV NEXT_PUBLIC_TIPTAP_APP_ID=$NEXT_PUBLIC_TIPTAP_APP_ID
ENV NEXT_PUBLIC_BASE_PATH=$NEXT_PUBLIC_BASE_PATH
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA

# Runtime ENV for Compose
ENV HOSTNAME=$FRONTEND_SERVICE_INTERFACE
ENV PORT=$FRONTEND_SERVICE_PORT

# executable that will run the application
ENTRYPOINT ["node"]

# default args to the ENTRYPOINT that can be overridden at runtime
CMD ["server.js"]
