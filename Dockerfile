# Stage 0: Base image
FROM node:22-alpine3.19 AS base

# BuildKit Platform Context (used for metadata, not to alter FROM)
ARG BUILDPLATFORM
ARG TARGETPLATFORM

# Optional diagnostics (doesn't affect final image)
RUN echo "Build Platform: ${BUILDPLATFORM} -> Target Platform: ${TARGETPLATFORM}"

# Stage 1: Dependencies
FROM base AS deps
RUN apk update && apk upgrade --no-cache && apk add --no-cache libc6-compat

WORKDIR /app
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# Stage 2: Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time args from docker-compose or GitHub Actions
ARG NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ARG NEXT_PUBLIC_BACKEND_SERVICE_HOST
ARG NEXT_PUBLIC_BACKEND_SERVICE_PORT
ARG NEXT_PUBLIC_BACKEND_API_VERSION
ARG FRONTEND_SERVICE_INTERFACE
ARG FRONTEND_SERVICE_PORT

# Pass them as ENV so Next.js static build can access
ENV NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL=$NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ENV NEXT_PUBLIC_BACKEND_SERVICE_HOST=$NEXT_PUBLIC_BACKEND_SERVICE_HOST
ENV NEXT_PUBLIC_BACKEND_SERVICE_PORT=$NEXT_PUBLIC_BACKEND_SERVICE_PORT
ENV NEXT_PUBLIC_BACKEND_API_VERSION=$NEXT_PUBLIC_BACKEND_API_VERSION

RUN echo "=== ALL BUILD ARGS ===" && env | sort

# Optional: Print the values to verify they are set correctly
RUN echo "Building with the following environment variables:" && \
    echo "NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL: ${NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL}" && \
    echo "NEXT_PUBLIC_BACKEND_SERVICE_HOST: ${NEXT_PUBLIC_BACKEND_SERVICE_HOST}" && \
    echo "NEXT_PUBLIC_BACKEND_SERVICE_PORT: ${NEXT_PUBLIC_BACKEND_SERVICE_PORT}" && \
    echo "NEXT_PUBLIC_BACKEND_API_VERSION: ${NEXT_PUBLIC_BACKEND_API_VERSION}" && \
    echo "FRONTEND_SERVICE_INTERFACE: ${FRONTEND_SERVICE_INTERFACE}" && \
    echo "FRONTEND_SERVICE_PORT: ${FRONTEND_SERVICE_PORT}"

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

ARG NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ARG NEXT_PUBLIC_BACKEND_SERVICE_HOST
ARG NEXT_PUBLIC_BACKEND_SERVICE_PORT
ARG NEXT_PUBLIC_BACKEND_API_VERSION
ARG FRONTEND_SERVICE_INTERFACE
ARG FRONTEND_SERVICE_PORT

ENV NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL=$NEXT_PUBLIC_BACKEND_SERVICE_PROTOCOL
ENV NEXT_PUBLIC_BACKEND_SERVICE_HOST=$NEXT_PUBLIC_BACKEND_SERVICE_HOST
ENV NEXT_PUBLIC_BACKEND_SERVICE_PORT=$NEXT_PUBLIC_BACKEND_SERVICE_PORT
ENV NEXT_PUBLIC_BACKEND_API_VERSION=$NEXT_PUBLIC_BACKEND_API_VERSION

# Runtime ENV for Compose
ENV HOSTNAME=$FRONTEND_SERVICE_INTERFACE
ENV PORT=$FRONTEND_SERVICE_PORT

# executable that will run the application
ENTRYPOINT ["node"]

# default args to the ENTRYPOINT that can be overridden at runtime
CMD ["server.js"]
