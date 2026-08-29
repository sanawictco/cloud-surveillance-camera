/**
 * Merge trusted tenant ownership with an untrusted caller filter using `$and`
 * so a caller-supplied filter can never override `tenantId`.
 *
 * Do NOT use `{ tenantId, ...filter }` for tenant scoping: a caller filter
 * could re-declare `tenantId` and silently widen the scope to another tenant.
 */
export function buildTenantFilter(
  tenantId: string,
  filter: object = {},
): { $and: object[] } {
  if (!tenantId) throw new Error('tenantId is required');
  return { $and: [{ tenantId }, filter] };
}
