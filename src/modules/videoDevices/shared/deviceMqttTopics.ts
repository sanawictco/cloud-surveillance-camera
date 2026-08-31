/**
 * Single owner of every cloud<->fog device MQTT topic.
 *
 * Producers (NVR/camera/page entities), the queue workers that validate a job
 * before publishing, and the MQTT controllers that parse an inbound topic all
 * build/parse from here, so the writer and the validator cannot drift.
 *
 * Topic shape: `tenants/{tenantId}/nvrs/{nvrId}/...` with an explicit
 * direction suffix — `to-fog` topics are published by the cloud and
 * subscribed by the fog; `to-cloud` topics are published by the fog and
 * subscribed by the cloud. The fog client is not deployed yet, so this is the
 * only topic hierarchy: there is no legacy shape and no version prefix.
 */
import { isUuidV4 } from 'src/modules/shared/uuid';

// ---------------------------------------------------------------------------
// Cloud -> fog (fog subscribes; cloud publishes)
// ---------------------------------------------------------------------------

export function videoDeviceConfigPubTopic(
  tenantId: string,
  nvrId: string,
): string {
  return `tenants/${tenantId}/nvrs/${nvrId}/config/to-fog`;
}

export function pageConfigPubTopic(tenantId: string, nvrId: string): string {
  return `tenants/${tenantId}/nvrs/${nvrId}/pages/to-fog`;
}

/**
 * Camera hardware commands are addressed to the NVR, not to a camera: fog is
 * one principal that owns every camera under its NVR, and the payload carries
 * the camera ID. Per-camera topics would only matter with per-camera
 * principals or routing, which are explicitly deferred.
 */
export function cameraDataPubTopic(tenantId: string, nvrId: string): string {
  return `tenants/${tenantId}/nvrs/${nvrId}/cameras/to-fog`;
}

export function cloudIsAvailablePubTopic(
  tenantId: string,
  nvrId: string,
): string {
  return `tenants/${tenantId}/nvrs/${nvrId}/cloud-status/to-fog`;
}

export function cloudRecoveryDataAckPubTopic(
  tenantId: string,
  nvrId: string,
): string {
  return `tenants/${tenantId}/nvrs/${nvrId}/cloud-recovery/to-fog`;
}

// ---------------------------------------------------------------------------
// Fog -> cloud response topics (cloud subscribes and parses; fog publishes)
// ---------------------------------------------------------------------------

export interface ParsedDeviceResponseTopic {
  tenantId: string;
  nvrId: string;
}

/**
 * Parses an NVR/camera config response topic
 * (`tenants/{tenantId}/nvrs/{nvrId}/config/to-cloud`). Tenant and NVR must be
 * whole UUIDs, so a wildcard or separator injected by a foreign publisher can
 * never reach the ownership checks as a usable identity.
 */
export function parseNvrConfigResponseTopic(
  topic: string,
): ParsedDeviceResponseTopic {
  return parseResponseTopic(topic, 'config');
}

/**
 * Parses a page config response topic
 * (`tenants/{tenantId}/nvrs/{nvrId}/pages/to-cloud`).
 */
export function parsePageConfigResponseTopic(
  topic: string,
): ParsedDeviceResponseTopic {
  return parseResponseTopic(topic, 'pages');
}

function parseResponseTopic(
  topic: string,
  resource: 'config' | 'pages',
): ParsedDeviceResponseTopic {
  const segments = topic.split('/');
  const shapeMatches =
    segments.length === 6 &&
    segments[0] === 'tenants' &&
    segments[2] === 'nvrs' &&
    segments[4] === resource &&
    segments[5] === 'to-cloud';
  if (!shapeMatches || !isUuidV4(segments[1]) || !isUuidV4(segments[3])) {
    throw new Error(`invalid device response topic: ${topic}`);
  }
  return { tenantId: segments[1]!, nvrId: segments[3]! };
}
