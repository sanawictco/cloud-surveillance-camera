import {
  buildDeviceJobId,
  isValidDeviceMsgId,
} from 'src/dddLib/utils/deviceMessageId';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

/**
 * Anchored UUID check. `Guard.isUUIDv4` is deliberately not reused here: its
 * regex is unanchored, so `"x<uuid>y"` passes. Tenant and NVR identity is used
 * to build the scoped queue key, so it must match the whole string.
 */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The tenant-owned fields every device/page queue message must carry.
 *
 * Queue payloads are produced internally, but a worker still validates them at
 * its boundary: a stale job written by an older deploy, a migrated Redis
 * database, or an incorrectly-produced job would otherwise cross a tenant
 * boundary with no other control in the path (multi-tenancy plan, Phase 3).
 */
export interface TenantQueueMessage {
  msgId: string;
  configType: string;
  tenantId: string;
  nvrId: string;
  metadata: {
    topic: string;
    entityId: string;
    entityType: EntityTypes;
    retryCount: number;
    retryPeriodInSecond: number;
    issuedAt?: number;
    expiresAt?: number;
  };
}

export class TenantQueueMessageError extends Error {}

export interface ValidatedTenantQueueScope {
  tenantId: string;
  nvrId: string;
  msgId: string;
  configType: string;
  entityId: string;
  entityType: EntityTypes;
  topic: string;
  jobId: string;
}

interface AssertTenantQueueMessageOptions {
  /**
   * Entity types this queue may act on. A page job appearing on a video-device
   * queue (or the reverse) is rejected rather than processed.
   */
  allowedEntityTypes: readonly EntityTypes[];
  /**
   * Derives the only topic this message may be published to, from the
   * message's own validated identity. The queued topic must equal it, so a
   * forged or stale topic cannot redirect a payload at another device.
   *
   * Note: the legacy camera-data topic does not contain a tenant segment
   * (topic-hierarchy normalization is Phase 5). Tenant binding for every queue
   * therefore comes from the scoped job ID below, not from the topic alone.
   */
  expectedTopic: (scope: {
    tenantId: string;
    nvrId: string;
    entityId: string;
    entityType: EntityTypes;
  }) => string;
  /**
   * BullMQ job name the message was stored under. When provided it must equal
   * the scoped job ID rebuilt from the message body, which is what proves the
   * payload still belongs to the tenant slot it was read from.
   */
  jobId?: string;
  now?: number;
  /**
   * Skip only the "already expired" check, keeping every structural and
   * lifetime-consistency check. Expiry handlers run *after* the final retry, so
   * the window is closed by definition there; without this they would have to
   * fake a clock to validate at all.
   */
  allowExpired?: boolean;
}

/**
 * Fail-closed validation of a tenant queue message before any side effect.
 *
 * Returns the validated scope so callers pass explicit, verified identity into
 * commands and queries instead of re-reading unvalidated payload fields.
 */
export function assertTenantQueueMessage(
  message: unknown,
  options: AssertTenantQueueMessageOptions,
): ValidatedTenantQueueScope {
  const now = options.now ?? Date.now();
  if (!message || typeof message !== 'object') {
    throw new TenantQueueMessageError('queue message structure is invalid');
  }
  const { msgId, configType, tenantId, nvrId, metadata } =
    message as Partial<TenantQueueMessage>;

  if (typeof configType !== 'string' || configType.length === 0) {
    throw new TenantQueueMessageError('queue message structure is invalid');
  }
  if (typeof msgId !== 'string' || !isValidDeviceMsgId(msgId)) {
    throw new TenantQueueMessageError('queue message ID is invalid');
  }
  if (typeof tenantId !== 'string' || !UUID_V4.test(tenantId)) {
    throw new TenantQueueMessageError('queue message tenant is invalid');
  }
  if (typeof nvrId !== 'string' || !UUID_V4.test(nvrId)) {
    throw new TenantQueueMessageError('queue message NVR is invalid');
  }
  if (!metadata || typeof metadata !== 'object') {
    throw new TenantQueueMessageError('queue message structure is invalid');
  }

  const { topic, entityId, entityType, issuedAt, expiresAt } = metadata;
  // `entityId` is interpolated into the derived publish topic (the camera-data
  // topic contains the camera ID), so it must be a whole UUID. A non-UUID value
  // such as `aaa/#` would otherwise inject MQTT topic separators and a wildcard
  // into the address the payload is published to.
  if (
    typeof entityId !== 'string' ||
    !UUID_V4.test(entityId) ||
    typeof entityType !== 'string' ||
    !options.allowedEntityTypes.includes(entityType as EntityTypes)
  ) {
    throw new TenantQueueMessageError('queue message entity is invalid');
  }
  const expectedTopic = options.expectedTopic({
    tenantId,
    nvrId,
    entityId,
    entityType: entityType as EntityTypes,
  });
  if (typeof topic !== 'string' || topic !== expectedTopic) {
    throw new TenantQueueMessageError('queue message topic is invalid');
  }
  if (
    typeof issuedAt !== 'number' ||
    typeof expiresAt !== 'number' ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    issuedAt > now ||
    expiresAt <= issuedAt
  ) {
    throw new TenantQueueMessageError('queue message lifetime is invalid');
  }
  if (!options.allowExpired && expiresAt < now) {
    throw new TenantQueueMessageError('queue message has expired');
  }

  // The scoped job ID is the queue's tenant boundary. Rebuilding it from the
  // validated body and comparing it against the key the job was stored under
  // rejects a payload whose tenant/NVR/msgId no longer matches its queue slot.
  const jobId = buildDeviceJobId(tenantId, nvrId, msgId);
  if (options.jobId !== undefined && options.jobId !== jobId) {
    throw new TenantQueueMessageError('queue message scope is invalid');
  }

  return {
    tenantId,
    nvrId,
    msgId,
    configType,
    entityId,
    entityType: entityType as EntityTypes,
    topic: expectedTopic,
    jobId,
  };
}

/**
 * Tenant-identifying, secret-free description of a failed job. Queue payloads
 * carry device configuration, so a failure record must never echo the payload.
 */
export function describeTenantQueueFailure(
  message: unknown,
  attemptsMade?: number,
): string {
  const candidate = (message ?? {}) as Partial<TenantQueueMessage>;
  return (
    `tenantId=${candidate.tenantId ?? 'unknown'} ` +
    `nvrId=${candidate.nvrId ?? 'unknown'} ` +
    `msgId=${candidate.msgId ?? 'unknown'} ` +
    `operation=${candidate.configType ?? 'unknown'} ` +
    `entityType=${candidate.metadata?.entityType ?? 'unknown'} ` +
    `entityId=${candidate.metadata?.entityId ?? 'unknown'} ` +
    `attempts=${attemptsMade ?? 0}`
  );
}
