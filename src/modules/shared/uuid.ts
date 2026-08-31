/**
 * Anchored UUID v4 check. `Guard.isUUIDv4` is deliberately not reused: its
 * regex is unanchored, so `"x<uuid>y"` passes it. Tenant identity becomes a
 * topic segment and a Redis key segment, so it must match the whole string.
 */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4.test(value);
}
