# syntax=docker/dockerfile:1

FROM node:24.16-slim AS build

WORKDIR /app
RUN chown -R node:node /app
USER node

COPY --chown=node:node package*.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 npm ci

COPY --chown=node:node . .
RUN npm run build && npm prune --omit=dev

# ---- TDengine restore-tooling stage ---------------------------------------
# The cloud-recovery restore runs `taosdump -i` from the BACKEND itself (no
# Docker socket). Extract taosdump + the native client libs from the SAME
# TDengine image the stack runs, so client and server can never drift. Keep
# this tag in lockstep with the tdengine-cloud service image.
FROM registry.sanawict.ir/library/tdengine:3.3.6.3 AS taos-tools
RUN set -eux; \
    mkdir -p /opt/taos/lib /opt/taos/bin; \
    cp -av "$(readlink -f /usr/bin/taosdump)" /opt/taos/bin/taosdump; \
    cp -avL /usr/lib/libtaos*.so* /opt/taos/lib/; \
    chmod +x /opt/taos/bin/taosdump; \
    test -x /opt/taos/bin/taosdump

FROM node:24.16-slim AS production

ENV TINI_VERSION=v0.19.0
ADD --chmod=755 \
    --checksum=sha256:93dcc18adc78c65a028a84799ecf8ad40c936fdfc5f2a57b1acda5a8117fa82c \
    https://github.com/krallin/tini/releases/download/${TINI_VERSION}/tini /tini

# Scoped Fog restore runs tar, zstd, and mongosh inside the backend container.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl gnupg tar zstd liblzma5; \
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

# taosdump + the native client lib. The runtime DB driver stays pure-JS; these
# exist only for the backup path, which has no pure-JS equivalent.
COPY --from=taos-tools /opt/taos/lib/ /usr/lib/
COPY --from=taos-tools /opt/taos/bin/taosdump /usr/local/bin/taosdump
RUN ldconfig

# taosdump writes a log under /var/log/taos and reads config from /etc/taos. As
# the non-root `node` user it cannot create either, and dies at init with
# "Create taoslog failed: Permission denied" BEFORE it connects.
RUN set -eux; \
    mkdir -p /var/log/taos /etc/taos; \
    printf 'logDir /var/log/taos\n' > /etc/taos/taos.cfg; \
    chown -R node:node /var/log/taos /etc/taos

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
