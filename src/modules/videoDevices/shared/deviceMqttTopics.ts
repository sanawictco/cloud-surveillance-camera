/**
 * Single owner of every cloud->fog publish topic.
 *
 * Producers (NVR/camera/page entities) and the queue workers that validate a
 * job before publishing both build topics from here, so the writer and the
 * validator cannot drift and quietly accept a topic nobody can produce.
 *
 * Topic normalization to the versioned `v1/tenants/...` hierarchy is Phase 5;
 * these builders keep the currently deployed shapes.
 */
export function videoDeviceConfigPubTopic(
  tenantId: string,
  nvrId: string,
): string {
  return `${tenantId}/${nvrId}/videoDevice/Config/pub`;
}

export function pageConfigPubTopic(tenantId: string, nvrId: string): string {
  return `${tenantId}/${nvrId}/page/config/pub`;
}

export function cloudRecoveryDataAckPubTopic(
  tenantId: string,
  nvrId: string,
): string {
  return `${tenantId}/${nvrId}/cloudRecoveryData/pub`;
}

export function cloudIsAvailablePubTopic(
  tenantId: string,
  nvrId: string,
): string {
  return `${tenantId}/${nvrId}/cloudIsAvailable/pub`;
}

/**
 * The camera hardware-command topic carries no tenant segment. Tenant binding
 * for camera-data jobs therefore comes from the scoped BullMQ job ID and the
 * persisted camera->NVR->tenant relationship, not from this topic.
 */
export function cameraDataPubTopic(nvrId: string, cameraId: string): string {
  return `${nvrId}/${cameraId}/camera/data/pub`;
}
