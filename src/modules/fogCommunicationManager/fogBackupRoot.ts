/**
 * Filesystem root for Fog backup uploads and restore staging. Shared so the
 * upload destination and the restore staging directory can never drift apart.
 */
export const BACKUP_ROOT =
  process.env.FOG_BACKUP_ROOT ?? '/cloud_shared_backups';
