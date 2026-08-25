# Production Restore Prerequisites

Build from the repository root:

```bash
docker build -f deployment/prod/Dockerfile -t cloud-surveillance-camera:local .
```

The runtime image includes `tar`, `zstd`, `mongosh`, and the vetted
`/app/scripts/mongo-restore.sh`. Run it with a writable volume mounted at:

```text
/cloud_shared_backups
```

The reverse proxy must allow the configured 1 GiB multipart request limit for
`POST /fog-communication-manager/restore-fog-backup-to-cloud`.

Run the complete local qualification before release:

```bash
npm run qualify:fog-restore
npm run qualify:fog-restore:image
npm run qualify:fog-restore:producer
```
