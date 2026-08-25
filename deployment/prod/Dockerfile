# syntax=docker/dockerfile:1

FROM node:24.16-slim AS build

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 npm ci

COPY --chown=node:node . .
RUN npm run build && npm prune --omit=dev

FROM node:24.16-slim AS production

ENV TINI_VERSION=v0.19.0
ADD --chmod=755 \
    --checksum=sha256:93dcc18adc78c65a028a84799ecf8ad40c936fdfc5f2a57b1acda5a8117fa82c \
    https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini

# Scoped Fog restore runs tar, zstd, and mongosh inside the backend container.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg tar zstd; \
    curl -fsSL https://pgp.mongodb.com/server-8.0.asc \
      | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg; \
    echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/debian bookworm/mongodb-org/8.0 main" \
      > /etc/apt/sources.list.d/mongodb-org-8.0.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends mongodb-mongosh; \
    apt-get purge -y --auto-remove curl gnupg; \
    rm -rf /var/lib/apt/lists/*; \
    mkdir -p /cloud_shared_backups; \
    chown node:node /cloud_shared_backups

WORKDIR /app
RUN chown node:node /app

COPY --chown=node:node --chmod=555 --from=build /app/dist ./dist
COPY --chown=node:node --chmod=555 --from=build /app/node_modules ./node_modules
COPY --chown=node:node --chmod=444 --from=build /app/package.json ./package.json
COPY --chown=node:node --chmod=555 scripts/mongo-restore.sh /app/scripts/mongo-restore.sh
COPY --chmod=555 deployment/prod/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER node
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

EXPOSE 5555
ENTRYPOINT ["/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/src/main"]
