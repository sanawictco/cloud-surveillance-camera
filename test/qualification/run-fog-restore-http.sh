#!/bin/bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
mongo_image="${TEST_MONGO_IMAGE:-mongo:8}"
redis_image="${TEST_REDIS_IMAGE:-redis:7-alpine}"
suffix="$(date +%s)-$$"
mongo_name="fog-restore-mongo-${suffix}"
redis_name="fog-restore-redis-${suffix}"
backup_root="/tmp/opencode/fog-restore-http-${suffix}"
mongo_username="fog_restore_qualifier"
mongo_password="fog-restore-qualification-password"

cleanup() {
  docker rm -f "$mongo_name" "$redis_name" >/dev/null 2>&1 || true
  rm -rf "$backup_root"
}
trap cleanup EXIT

required=(docker node npm tar zstd mongosh)
for command_name in "${required[@]}"; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing qualification prerequisite: $command_name" >&2
    exit 1
  fi
done

mkdir -p "$backup_root"

docker run -d --rm --name "$mongo_name" -p 127.0.0.1::27017 \
  -e MONGO_INITDB_ROOT_USERNAME="$mongo_username" \
  -e MONGO_INITDB_ROOT_PASSWORD="$mongo_password" \
  "$mongo_image" \
  --bind_ip_all >/dev/null
docker run -d --rm --name "$redis_name" -p 127.0.0.1::6379 "$redis_image" \
  redis-server --save "" --appendonly no >/dev/null

mongo_port="$(docker port "$mongo_name" 27017/tcp | sed 's/.*://')"
redis_port="$(docker port "$redis_name" 6379/tcp | sed 's/.*://')"

npm run build --prefix "$repo_root" >/dev/null

env \
  NODE_PATH="$repo_root/dist" \
  FOG_BACKUP_ROOT="$backup_root" \
  MONGO_DB_HOST=127.0.0.1 \
  MONGO_DB_PORT="$mongo_port" \
  MONGO_DB_NAME=fog_restore_http_qualification \
  MONGO_DB_USERNAME="$mongo_username" \
  MONGO_DB_PASSWORD="$mongo_password" \
  MONGO_DB_AUTH_SOURCE=admin \
  REDIS_HOST=127.0.0.1 \
  REDIS_PORT="$redis_port" \
  QUALIFICATION_REPO_ROOT="$repo_root" \
  node "$repo_root/test/qualification/fog-restore-http.js"
