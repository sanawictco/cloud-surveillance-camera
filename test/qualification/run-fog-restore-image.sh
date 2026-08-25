#!/bin/bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
image="${FOG_RESTORE_QUALIFICATION_IMAGE:-cloud-surveillance-camera:phase0-qualified}"
mongo_image="${TEST_MONGO_IMAGE:-mongo:8}"
redis_image="${TEST_REDIS_IMAGE:-redis:7-alpine}"
suffix="$(date +%s)-$$"
network="fog-restore-qualification-${suffix}"
mongo_name="fog-restore-mongo-${suffix}"
redis_name="fog-restore-redis-${suffix}"
mongo_username="fog_restore_qualifier"
mongo_password="fog-restore-qualification-password"

cleanup() {
  docker rm -f "$mongo_name" "$redis_name" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! docker image inspect "$image" >/dev/null 2>&1; then
  docker build -f "$repo_root/deployment/prod/Dockerfile" -t "$image" "$repo_root"
fi

docker network create "$network" >/dev/null
docker run -d --rm --name "$mongo_name" --network "$network" \
  --network-alias mongo \
  -e MONGO_INITDB_ROOT_USERNAME="$mongo_username" \
  -e MONGO_INITDB_ROOT_PASSWORD="$mongo_password" \
  "$mongo_image" --bind_ip_all >/dev/null
docker run -d --rm --name "$redis_name" --network "$network" \
  --network-alias redis "$redis_image" redis-server --save "" --appendonly no \
  >/dev/null

docker run --rm \
  --network "$network" \
  --entrypoint node \
  -e NODE_PATH=/app/node_modules:/app/dist \
  -e FOG_BACKUP_ROOT=/cloud_shared_backups \
  -e MONGO_DB_HOST=mongo \
  -e MONGO_DB_PORT=27017 \
  -e MONGO_DB_NAME=fog_restore_image_qualification \
  -e MONGO_DB_USERNAME="$mongo_username" \
  -e MONGO_DB_PASSWORD="$mongo_password" \
  -e MONGO_DB_AUTH_SOURCE=admin \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  -e QUALIFICATION_REPO_ROOT=/app \
  -v "$repo_root/test/qualification/fog-restore-http.js:/qualification/fog-restore-http.js:ro" \
  "$image" /qualification/fog-restore-http.js
