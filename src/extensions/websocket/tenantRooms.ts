/**
 * Name of the Socket.IO room carrying every business event of one tenant.
 * A socket is placed in it during the handshake only after its tenant access
 * has been verified, so room membership is the WebSocket isolation boundary.
 */
export function tenantRoomName(tenantId: string): string {
  return `tenant:${tenantId}`;
}
