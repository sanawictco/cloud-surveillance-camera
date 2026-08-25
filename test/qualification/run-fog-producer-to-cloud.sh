#!/bin/bash
set -euo pipefail

cloud_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
fog_root="${FOG_SURVEILLANCE_CAMERA_ROOT:-$(cd -- "$cloud_root/../fog-surveillance-camera" && pwd)}"
fog_image="${FOG_QUALIFICATION_IMAGE:-fog-surveillance-camera:phase0-qualified}"
mongo_image="${TEST_MONGO_IMAGE:-mongo:8}"
redis_image="${TEST_REDIS_IMAGE:-redis:7-alpine}"
suffix="$(date +%s)-$$"
source_mongo="fog-producer-mongo-${suffix}"
target_mongo="fog-target-mongo-${suffix}"
redis_name="fog-target-redis-${suffix}"
backup_root="/tmp/opencode/fog-producer-${suffix}"
target_backup_root="/tmp/opencode/fog-target-${suffix}"
mongo_username="fog_restore_qualifier"
mongo_password="fog-restore-qualification-password"

cleanup() {
  docker rm -f "$source_mongo" "$target_mongo" "$redis_name" >/dev/null 2>&1 || true
  rm -rf "$backup_root" "$target_backup_root"
}
trap cleanup EXIT

if ! docker image inspect "$fog_image" >/dev/null 2>&1; then
  docker build -f "$fog_root/deployment/prod/Dockerfile" -t "$fog_image" "$fog_root"
fi

mkdir -p "$backup_root" "$target_backup_root"

start_mongo() {
  local name="$1"
  docker run -d --rm --name "$name" -p 127.0.0.1::27017 \
    -e MONGO_INITDB_ROOT_USERNAME="$mongo_username" \
    -e MONGO_INITDB_ROOT_PASSWORD="$mongo_password" \
    "$mongo_image" --bind_ip_all >/dev/null
}

start_mongo "$source_mongo"
start_mongo "$target_mongo"
docker run -d --rm --name "$redis_name" -p 127.0.0.1::6379 "$redis_image" \
  redis-server --save "" --appendonly no >/dev/null

source_port="$(docker port "$source_mongo" 27017/tcp | sed 's/.*://')"
target_port="$(docker port "$target_mongo" 27017/tcp | sed 's/.*://')"
redis_port="$(docker port "$redis_name" 6379/tcp | sed 's/.*://')"
source_uri="mongodb://${mongo_username}:${mongo_password}@127.0.0.1:${source_port}/admin?authSource=admin"

for attempt in $(seq 1 60); do
  if mongosh "$source_uri" --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; then
    break
  fi
  if [ "$attempt" = 60 ]; then
    echo "Fog source Mongo did not become ready" >&2
    exit 1
  fi
  sleep 0.25
done

mongosh "$source_uri" --quiet --eval '
db = db.getSiblingDB("surveillance-fog");
db.nvrs.insertOne({id:"22222222-2222-4222-8222-222222222222",workstationId:"legacy-workstation",name:"Restored NVR",maxCameras:16,serialNumber:"NVR00001",accessToken:"11111111111111111111111111111111",password:"restored-pass",lang:"en",isActive:true,liveSignalStatus:1,cloudFailedAt:123,runningConfigs:{legacy:"12"}});
db.cameras.insertOne({id:"33333333-3333-4333-8333-333333333333",name:"Restored Camera",productModel:"CAM-1",serialNumber:"CAM00001",username:"admin",password:"camera-password",macAddress:"AA:BB:CC:DD:EE:FF",port:554,streams:{recordStream:{token:"record",path:"/record",resolutions:[]},liveStream:{token:"live",path:"/live",resolutions:[]}},hasPtz:true,hasAudio:false,nvrId:"22222222-2222-4222-8222-222222222222",isActive:true,liveSignalStatus:1,runningConfigs:{legacy:"11"}});
db.pages.insertOne({id:"44444444-4444-4444-8444-444444444444",name:"Restored Page",nvrId:"22222222-2222-4222-8222-222222222222",type:"widget",pageIndex:0,content:[{id:"33333333-3333-4333-8333-333333333333"}],runningConfigs:{legacy:"13"}});
db.autoProvisioningOperations.insertOne({tenantId:"11111111-1111-4111-8111-111111111111",nvrId:"22222222-2222-4222-8222-222222222222",msgId:"ignored"});
db.cameraNetworkBindings.insertOne({tenantId:"11111111-1111-4111-8111-111111111111",nvrId:"22222222-2222-4222-8222-222222222222",macAddress:"AA:BB:CC:DD:EE:FF"});
'

docker run --rm --network host --entrypoint sh \
  -e MONGO_BACKUP_HOST=127.0.0.1 \
  -e MONGO_BACKUP_PORT="$source_port" \
  -e MONGO_BACKUP_DB=surveillance-fog \
  -e MONGO_BACKUP_USER="$mongo_username" \
  -e MONGO_BACKUP_PASSWORD="$mongo_password" \
  -e MONGO_BACKUP_AUTHDB=admin \
  -e MONGO_BACKUP_DIR=/fog_shared_backups/mongo \
  -v "$backup_root:/fog_shared_backups" \
  "$fog_image" -c '
    set -eu
    /app/scripts/mongo-backup.sh
    tar -I "zstd -12" -cf /fog_shared_backups/backups.tar.zst -C /fog_shared_backups mongo
  '

archive="$backup_root/backups.tar.zst"
test -s "$archive"

npm run build --prefix "$cloud_root" >/dev/null
env \
  NODE_PATH="$cloud_root/dist" \
  FOG_BACKUP_ROOT="$target_backup_root" \
  MONGO_DB_HOST=127.0.0.1 \
  MONGO_DB_PORT="$target_port" \
  MONGO_DB_NAME=fog_restore_producer_qualification \
  MONGO_DB_USERNAME="$mongo_username" \
  MONGO_DB_PASSWORD="$mongo_password" \
  MONGO_DB_AUTH_SOURCE=admin \
  REDIS_HOST=127.0.0.1 \
  REDIS_PORT="$redis_port" \
  QUALIFICATION_REPO_ROOT="$cloud_root" \
  QUALIFICATION_SUCCESS_ARCHIVE="$archive" \
  node "$cloud_root/test/qualification/fog-restore-http.js"
