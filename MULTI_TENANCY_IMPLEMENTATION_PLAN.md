# Cloud Surveillance Multi-Tenancy Implementation Plan

## Document Status

| Field                     | Decision                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Service                   | `cloud-surveillance-camera`                                                                                                                       |
| Architecture              | NestJS 11, CQRS, MongoDB, TDengine, Redis, BullMQ, MQTT, Socket.IO, Keycloak                                                                      |
| Current safety level      | Treat as single-tenant until the isolation gates in this document pass                                                                            |
| Target isolation          | Shared infrastructure with strict logical tenant isolation                                                                                        |
| Identity authority        | Keycloak SSO                                                                                                                                      |
| Membership authority      | MongoDB in this service                                                                                                                           |
| User membership           | One SSO user may belong to multiple tenants                                                                                                       |
| Active tenant             | Explicitly selected and validated for each HTTP request or WebSocket connection                                                                   |
| Authorization             | Tenant-scoped `EmployeeRoles` enforced at controllers; all tenants have the same features                                                         |
| Database authorization    | No per-user database accounts or ordinary per-user CRUD limits                                                                                    |
| MongoDB                   | Shared collections with mandatory tenant filters                                                                                                  |
| Redis and BullMQ          | Shared infrastructure with tenant-aware keys and messages                                                                                         |
| MQTT                      | Shared EMQX broker with per-NVR credentials and exact topic ACLs                                                                                  |
| TDengine                  | Shared databases; one child table per tenant for each log/report supertable                                                                       |
| Fog recovery              | Tenant/NVR-scoped domain import, not whole-database restore                                                                                       |
| Deployment                | One application instance initially                                                                                                                |
| Report retention          | 90 days detailed data and 2 years summarized data                                                                                                 |
| Device `msgId`            | Canonical decimal string containing a random unsigned 32-bit value, scoped by tenant and NVR                                                      |
| Last updated              | 2026-08-29                                                                                                                                        |
| Phase 0 status            | Complete and runtime-qualified on 2026-08-25                                                                                                      |
| Phase 1 status            | Complete and unit-qualified on 2026-08-26; revised 2026-08-29 (see Phase 1 revision note)                                                         |
| Phase 2 status            | Page slice unit-qualified 2026-08-29; NVR/Camera/Tenant scope, device-secret caching, and legacy backfill still open                              |
| Phase 3 status            | Implemented and unit-qualified on 2026-08-30                                                                                                      |
| Phase 4 status            | Implemented and unit-qualified on 2026-08-30                                                                                                      |
| Phase 5 status            | Topic hierarchy, ACL provisioning, validation, and idempotent consumers implemented and unit-qualified on 2026-08-31; credential split still open |
| Phase 6 status            | Actor-log v2 tenant isolation implemented and unit-qualified on 2026-08-31; UTC time ranges; legacy backfill, retention, and rollups still open |
| Next implementation phase | The open Phase 5 slice (credential split), the open Phase 2 slices, and the `test/integration/**` two-tenant suites                               |
| System-log visibility     | Any active tenant member (no special role); `Report` role reserved for a future camera-event reporting feature                                    |

## Purpose

This document is the implementation source of truth for converting the service from an effectively single-tenant workspace into a shared multi-tenant cloud service.

It is designed as a handoff for future implementation sessions. Each phase is intended to be implemented and verified independently. Do not implement all phases in one change.

The plan covers tenant preservation across:

- Keycloak authentication
- Tenant membership and active tenant selection
- Tenant-scoped employee roles
- CQRS commands and queries
- MongoDB
- Redis cache and distributed locks
- BullMQ queues and schedulers
- MQTT and EMQX ACLs
- Socket.IO
- TDengine and reports
- Fog HTTP APIs and backup import
- Notifications and external APIs
- Secrets
- Logging and audit records
- Tenant suspension and deletion
- Targeted limits for expensive operations

## Executive Decision

Shared infrastructure is the correct low-cost architecture for this service. Do not create a MongoDB database, Redis database, BullMQ queue set, Keycloak realm, EMQX broker, or TDengine database for every tenant.

Isolation must instead be enforced through these independent controls:

1. A verified active tenant for every synchronous tenant operation.
2. Explicit tenant identity in every asynchronous message.
3. Tenant-scoped employee-role checks at controllers.
4. Mandatory tenant ownership in every tenant-owned persistence operation.
5. Broker-side MQTT ACLs plus application ownership validation.
6. Tenant-scoped WebSocket rooms.
7. Tenant tags and child-table selection in TDengine.
8. Automated two-tenant isolation tests at every boundary.

The central rule is:

> Employee roles determine what an actor may do. The tenant ID in commands, queries, storage filters, topics, and messages determines whose data the operation may affect.

Controller authorization does not replace tenant filters. Tenant filters do not replace controller authorization. Both are required.

## Explicitly Deferred Complexity

The first multi-tenant implementation does not require:

- A database account per user
- A database account per tenant
- Per-user MongoDB CRUD quotas
- Per-tenant MongoDB databases
- Per-tenant Redis databases
- Per-tenant BullMQ queues
- Fine-grained per-camera user grants
- Per-camera MQTT topics and per-camera ACL rules (camera commands are addressed to the NVR-level `cameras` topic; the payload carries the camera ID, and per-camera topics would only matter with per-camera principals or routing)
- A policy engine such as OpenFGA
- A Socket.IO Redis adapter while the service has one instance
- Dedicated TDengine infrastructure per tenant
- Automatic TDengine sharding for normal system and actor logs

Apply targeted limits only where an operation can create significant cost or shared-service pressure:

- Fog upload size and frequency
- MQTT message rate and payload size
- Notification count
- Report time range and concurrency
- Outstanding physical device commands
- Import staging size

## Current Verified Risks

The following code conditions were verified during the audit and motivate the phases in this document.

| Severity | Finding                                                                                                                           | Evidence                                                                                                                                                            |
| -------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Critical | Authenticated user and request context contain no tenant                                                                          | `src/utilities/auth/protection.middleware.ts:143-152`, `src/extensions/userInfo/userInfo.dto.ts:5-10`, `src/dddLib/utils/appRequestContext.ts:4-21`                 |
| Critical | NVR creation assumes exactly one tenant and uses the first tenant                                                                 | `src/modules/videoDevices/applicationService/services/http/nvr.http.service.ts:64-86`                                                                               |
| Critical | Generic Mongo reads, writes, deletes, counts, and aggregates do not require tenant                                                | `src/modules/shared/parent.repository.ts:40-60`, `65-113`, `115-150`                                                                                                |
| Critical | Socket.IO sends business messages to every cached connected client                                                                | `src/extensions/websocket/websocket.service.ts:120-166`                                                                                                             |
| Critical | WebSocket sessions contain no tenant and join no tenant room                                                                      | `src/extensions/websocket/websocketClientCachedModel.ts:3-9`, `src/extensions/websocket/websocket.service.ts:101-105`                                               |
| Critical | TDengine system and actor logs contain no tenant dimension                                                                        | `src/modules/systemLogs/domain/systemLog.type.ts`, `src/modules/actorLogs/domain/actorLog.type.ts`                                                                  |
| Critical | Actor child tables are keyed only by user ID, mixing the same SSO user across tenants                                             | `src/modules/actorLogs/applicationService/commands/createActorLog.command.ts:43-56`                                                                                 |
| Critical | Membership deletion can drop the actor table for the user across all tenants                                                      | `src/modules/actorLogs/applicationService/commands/deleteActorLogSubTable.command.ts:28-30`                                                                         |
| Critical | Two controllers register `POST /fog-communication-manager/configs` with different validation                                      | `src/modules/fogCommunicationManager/fogCommunicationManager.controller.ts:26-32`, `src/modules/videoDevices/controllers/fogCommunication.http.controller.ts:11-19` |
| Critical | The legacy fog configuration flow can retrieve a queue message by supplied `msgId` without complete ownership checks              | `src/modules/fogCommunicationManager/fogCommunicationManager.service.ts:59-83`                                                                                      |
| Critical | An NVR-authenticated endpoint can invoke whole MongoDB and TDengine restore tools                                                 | `src/modules/fogCommunicationManager/fogCommunicationManager.service.ts:119-155`, `235-274`                                                                         |
| Critical | TDengine values, filters, columns, and identifiers are assembled through raw SQL strings                                          | `src/dddLib/utils/timeSeriesDbExtension.ts`, `src/modules/systemLogs/infra/repositories/systemLog.timeseriesRepository.ts`                                          |
| High     | Employees, pages, and SMS notifiers have no tenant field                                                                          | `src/modules/employees/infra/schemas/employee.schema.ts`, `smsNotifier.schema.ts`, `src/modules/dashboard/infra/schemas/page.schema.ts`                             |
| High     | Current Keycloak/Sanaw employee roles are global rather than tenant-membership roles                                              | `src/modules/shared/roles.guard.ts`, `src/modules/employees/applicatoinService/services/employee.service.ts`                                                        |
| High     | Page MQTT entities and messages do not carry or validate tenant ownership                                                         | `src/modules/dashboard/domain/page.entity.ts`, `src/modules/dashboard/controllers/page.mqtt.controller.ts`                                                          |
| High     | Existing `msgId` generation has only 16 bits                                                                                      | `src/dddLib/utils/randomIdGenerator.ts:7-10`                                                                                                                        |
| High     | Device secrets are stored and cached in plaintext, and the NVR password is returned over HTTP                                     | `src/modules/videoDevices/infra/nvr/nvr.schema.ts:23-30`, `src/modules/videoDevices/contracts/nvr/http/response/nvr.response.dto.ts`                                |
| High     | SMS notification recipients are selected globally                                                                                 | `src/modules/systemLogs/applicationService/services/systemLog.service.ts:130-157`                                                                                   |
| Medium   | Cache keys omit tenant, and cache-wide operations affect all tenants                                                              | `src/extensions/caching/cache.service.ts:27`, `327-369`                                                                                                             |
| Medium   | ~~Queue workers establish no tenant context and trust their payload structure~~ Resolved in Phase 3 by `assertTenantQueueMessage` | `src/modules/shared/tenantQueueMessage.ts`                                                                                                                          |
| Medium   | ~~Scheduler tenant namespace support exists but is unused~~ Resolved in Phase 3 by tenant-scoped scheduler IDs                    | `src/extensions/scheduler/schedulerIds.ts`                                                                                                                          |
| Medium   | TDengine query errors can be returned as empty results                                                                            | `src/modules/shared/timeseriesRepository.ts:183-203`                                                                                                                |
| Medium   | TDengine has no configured detail retention or summary rollups                                                                    | No retention or rollup implementation exists                                                                                                                        |

## Existing Controls To Preserve

The following code is useful and should be generalized rather than discarded:

- `NvrModel` and `CameraModel` already contain `tenantId`.
- NVR MQTT topics already contain tenant and NVR segments.
- EMQX users and concrete ACL rules are provisioned per NVR.
- MQTT payload validation uses `class-validator` with strict options.
- `VideoDevicesConfigsMqttController` validates topic, queue, NVR, camera, tenant, entity, and response type.
- `CameraEntity.assertTenantMatches()` provides a useful domain invariant.
- HTTP production CORS uses configured origins.
- Cache and BullMQ use separate Redis logical databases.

## Non-Negotiable Invariants

These invariants must be represented in code and tests.

1. Every tenant-owned operation has one verified tenant ID.
2. A tenant ID supplied by a browser, device payload, or queue payload is not trusted without validation.
3. A user can have different roles in different tenants.
4. A role in Tenant A grants nothing in Tenant B.
5. Every tenant-owned Mongo record contains `tenantId`.
6. Every tenant-owned Mongo read, count, aggregate, update, and delete includes `tenantId` in the actual database filter.
7. Entity UUID uniqueness is never treated as authorization.
8. Every tenant-owned asynchronous message contains `tenantId`.
9. Every asynchronous command or query receives `tenantId` explicitly.
10. An MQTT handler validates message tenant against topic, queue, persisted NVR, and target entity before side effects.
11. A WebSocket business event has an explicit target tenant.
12. Every TDengine child table has a tenant tag, and normal report queries use the child table derived from validated tenant identity.
13. Missing tenant input in a normal tenant operation fails closed.
14. A global operation is separately named and cannot be reached accidentally by omitting tenant.
15. A foreign-tenant resource and a nonexistent resource produce equivalent external behavior.
16. Tenant suspension applies consistently to HTTP, device ingress, jobs, and WebSocket delivery.
17. Tenant deletion cannot modify another tenant.

## Identity, Employee, And Role Model

### Identity

Keycloak authenticates the global user and provides a stable `sub`.

Keycloak should continue to hold only identity and true platform roles such as:

```text
platform.admin
platform.support
```

Normal tenant business roles must not be global Keycloak client roles.

### Employee

MongoDB in this service is authoritative for tenant employees and tenant-scoped roles. `EmployeeModel` is the membership record; there is no separate membership collection.

Preferred model:

```typescript
interface Employee {
  id: string;
  tenantId: string;
  userId: string; // Keycloak sub
  roles: EmployeeRoles[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Required unique index:

```typescript
{ tenantId: 1, userId: 1 }
```

A user may have employee records such as:

```text
User X in Tenant A: Device_Dashboard
User X in Tenant B: Only_View
```

Removing the Tenant A employee must not delete or disable the global Keycloak identity or the Tenant B employee. Tenant ownership is derived from `TenantModel.ownerId`; it is not represented by a synthetic employee role.

All tenants have the same application features. Do not add tenant plans, feature arrays, subscriptions, or feature guards unless product requirements change.

### Controller Authorization

The normal HTTP guard order should be:

```text
Authentication
Active tenant membership
Tenant status
Tenant-scoped employee role
Application service
Tenant-scoped command/query
Tenant-scoped persistence
```

Conceptual controller usage:

```typescript
@RequireEmployeeRoles(EmployeeRoles.Report)
@Get('/reports')
findReports() {}
```

Do not implement per-user MongoDB accounts or ordinary per-user CRUD quotas. Controller employee-role guards are sufficient for deciding which operation a user may request.

The repository still must restrict the operation to the active tenant.

## Active Tenant Selection

### HTTP

The client sends the requested tenant on every tenant API request:

```http
X-Tenant-Id: <tenant UUID>
```

The value is a selector only. The API must validate:

- Keycloak token
- Keycloak `sub`
- Tenant existence
- Tenant status
- Active employee existence for `(tenantId, userId)`
- Tenant-scoped employee roles

The verified tenant must then be stored in the synchronous request context.

### Tenant List Endpoint

Add an identity-scoped endpoint that does not require an active tenant:

```http
GET /me/tenants
```

Suggested response:

```typescript
interface MyTenantResponse {
  tenantId: string;
  name: string;
  slug: string;
  status: TenantStatuses;
  employeeId: string;
  roles: EmployeeRoles[];
  isOwner: boolean;
}
```

### Employee Access Reads

MongoDB is authoritative. Active tenant employee access is read directly for each tenant HTTP request so role removal, employee deletion, and tenant suspension take effect immediately without cache invalidation races.

## Tenant Propagation Through CQRS

### Core Decision

Tenant identity must be an explicit part of tenant-owned commands and queries.

Ambient context is convenient for synchronous HTTP services, translation, and logging, but handlers should not require ambient HTTP context for data correctness.

### Synchronous Operation

For HTTP operations:

```text
HTTP request
  -> authenticate user
  -> validate X-Tenant-Id employee access
  -> set context.tenantId
  -> check employee role
  -> create command/query with context.tenantId
  -> handler passes tenantId to repository
```

Example:

```typescript
await commandBus.execute(
  new UpdateCameraCommand({
    tenantId: context.requireTenantId(),
    id: cameraId,
    name: body.name,
  }),
);
```

The controller or application service derives tenant from verified context. Do not accept a request-body tenant as the command tenant.

### Asynchronous Operation

MQTT, BullMQ, scheduler, timeout, and event callbacks do not have a valid HTTP tenant context.

For asynchronous operations:

```text
Async message
  -> validate message structure
  -> validate tenant against trusted server-owned relationships
  -> pass queueMsg.tenantId explicitly to commands and queries
  -> handler passes tenantId to repository
```

The asynchronous tenant source depends on the producer:

| Producer           | Tenant source                                                      |
| ------------------ | ------------------------------------------------------------------ |
| HTTP-created job   | Verified synchronous `context.tenantId` copied into queue message  |
| NVR scheduler      | Persisted `nvr.tenantId` copied into queue message                 |
| MQTT response      | Topic tenant cross-checked against queue message and persisted NVR |
| Global scheduler   | Persisted tenant from each entity being processed                  |
| Platform operation | Explicit platform-authorized target tenant                         |

After validation, asynchronous code should call:

```typescript
new UpdateCameraCommand({
  tenantId: queueMsg.tenantId,
  id: queueMsg.entityId,
  // operation fields
});
```

Ambient `AsyncLocalStorage` context may be established around the handler for logs and translation, but it must not be the only source used by commands or repositories.

## Unsigned 32-Bit Device Message IDs

### Decision

Use a canonical decimal string containing a random 4-byte unsigned integer for device `msgId`.

Reserve `0` as no correlation value. Valid generated values are:

```text
1 through 4,294,967,295
```

Recommended generator:

```typescript
import { randomBytes } from 'node:crypto';

export function generateRandomMsgId(): string {
  let msgId = 0;
  while (msgId === 0) {
    msgId = randomBytes(4).readUInt32BE(0);
  }
  return String(msgId);
}
```

DTO validation:

```typescript
@IsDeviceMsgId()
msgId!: string;
```

### Scope

A decimal-string `msgId` is not globally unique. Its identity is:

```text
(tenantId, nvrId, msgId)
```

The same numeric value may safely exist under another NVR or tenant.

### Active Collision Handling

When creating a command:

1. Generate a random unsigned 32-bit value.
2. Construct the scoped queue job ID.
3. Check whether that scoped active job already exists.
4. Generate another value if it exists.
5. Limit retries and fail clearly if generation repeatedly collides.

### BullMQ Job ID

Do not use the raw number as a BullMQ job ID.

Use a BullMQ-safe composite string without colon separators:

```typescript
function buildDeviceJobId(
  tenantId: string,
  nvrId: string,
  msgId: string,
): string {
  return `t-${tenantId}-n-${nvrId}-m-${msgId}`;
}
```

Queue APIs must move from:

```typescript
getRepeatableMsg(msgId);
```

to:

```typescript
getRepeatableMsg(tenantId, nvrId, msgId);
```

Fog HTTP must derive tenant and NVR from authenticated serial number before constructing the queue key.

MQTT must parse tenant and NVR from the topic and validate both before constructing the queue key.

Do not confuse device `msgId` with a durable report or audit event ID. TDengine event idempotency may use a different, larger identifier.

## MongoDB Isolation

### Shared Collections

Use shared collections. Add `tenantId` to every tenant-owned model, including:

- Tenant membership or employee membership
- SMS notifier
- Page
- NVR
- Camera
- Future alert configuration
- Future report configuration
- Future export metadata
- Future webhook configuration
- Future object-storage metadata

`TenantModel` remains a platform/identity-scoped collection and should not use the same tenant-scoped repository behavior as tenant-owned resources.

### Explicit Repository Contract

Tenant scope should be explicit in tenant repository methods:

```typescript
interface TenantRepository<Entity> {
  findById(tenantId: string, id: string): Promise<Entity | undefined>;
  findOne(tenantId: string, filter: object): Promise<Entity | undefined>;
  findAll(tenantId: string, query: QueryBase<any>): Promise<Entity[]>;
  findAllPaginated(
    tenantId: string,
    query: PaginatedQueryBase<any>,
  ): Promise<Paginated<Entity>>;
  update(tenantId: string, entity: Entity): Promise<void>;
  delete(tenantId: string, entity: Entity): Promise<void>;
}
```

This works identically for synchronous commands using `context.tenantId` and asynchronous commands using validated `queueMsg.tenantId`.

### Filter Construction

Merge tenant ownership with caller filters using `$and`:

```typescript
function buildTenantFilter(tenantId: string, filter: object = {}): object {
  return {
    $and: [{ tenantId }, filter],
  };
}
```

Do not merge with:

```typescript
{ tenantId, ...filter }
```

because a caller filter could override `tenantId`.

### Required Scope For Every Operation

Tenant must be part of:

- `insert`
- `findById`
- `findOne`
- `findAll`
- `findAllPaginated`
- `countDocuments`
- `aggregate`
- `findOneAndUpdate`
- `updateOne`
- `updateMany`
- `deleteOne`
- `deleteMany`
- Bulk writes
- Soft delete
- Recovery
- Running configuration claim/reset/unset operations

Examples:

```typescript
findOne({ tenantId, id });

updateOne({ tenantId, id: entity.id }, update);

deleteOne({ tenantId, id: entity.id });
```

If an update or delete matches zero rows, it must not silently appear successful.

### Aggregation

Every tenant-owned aggregation must begin with an unavoidable tenant match:

```typescript
{
  $match: {
    tenantId;
  }
}
```

The pagination count must use the exact same tenant filter as the data query.

### Cache Before Database

A cache hit must not bypass tenant ownership.

Use tenant-prefixed cache keys or verify the cached record tenant. Prefer tenant-prefixed keys.

### Explicit Global Operations

Do not interpret missing tenant as all tenants.

Global boot and platform operations must be separately named, for example:

```typescript
findAllActiveNvrsAsSystem();
restoreAllNvrsToCacheAsSystem();
deleteTenantDataAsPlatform(tenantId);
```

These methods must not be callable accidentally from normal tenant controllers.

### Page Ownership

Add `tenantId` directly to:

- `PageModel`
- `PageProps`
- `PageEntity`
- Page mapper
- Page commands and queries
- Page queue messages
- Page MQTT topic generation

Do not rely only on joining through `nvrId`.

### Membership And SMS Ownership

Add tenant to SMS notifier records and enforce unique:

```typescript
{ tenantId: 1, userId: 1 }
```

SMS recipients for a system event must be selected from the event tenant only.

### Recommended Indexes

| Collection   | Index                                              | Purpose                            |
| ------------ | -------------------------------------------------- | ---------------------------------- |
| NVR          | `{ tenantId: 1, id: 1 }`                           | Tenant ID lookup                   |
| NVR          | `{ tenantId: 1, name: 1 }`                         | Tenant name uniqueness if required |
| NVR          | `{ serialNumber: 1 }`                              | Global hardware serial uniqueness  |
| Camera       | `{ tenantId: 1, id: 1 }`                           | Tenant ID lookup                   |
| Camera       | `{ tenantId: 1, nvrId: 1, serialNumber: 1 }`       | Unique device under NVR            |
| Camera       | `{ tenantId: 1, nvrId: 1, macAddress: 1 }`         | Unique device under NVR            |
| Page         | `{ tenantId: 1, nvrId: 1, type: 1, pageIndex: 1 }` | Ordered page query                 |
| Page         | `{ tenantId: 1, nvrId: 1, name: 1 }`               | Name uniqueness if required        |
| Membership   | `{ tenantId: 1, userId: 1 }`                       | Unique membership                  |
| Membership   | `{ userId: 1, status: 1 }`                         | User tenant list                   |
| SMS notifier | `{ tenantId: 1, userId: 1 }`                       | Unique preference                  |

## Redis Cache And Locks

### Shared Redis

Keep the current shared Redis deployment and logical separation between cache and BullMQ.

Redis logical databases are operational namespaces, not security boundaries.

### Key Format

Use versioned tenant prefixes:

```text
cache:v1:tenant:{tenantId}:NvrModel:{id}
cache:v1:tenant:{tenantId}:CameraModel:{id}
cache:v1:tenant:{tenantId}:PageModel:{id}
cache:v1:tenant:{tenantId}:SmsNotifierModel:{id}
cache:v1:tenant:{tenantId}:lock:{resource}:{id}
cache:v1:system:{key}
```

### Rules

- Tenant code scans or deletes only its own prefix.
- `clearAll()` remains platform/system-only.
- Cache failure falls back to MongoDB where existing behavior permits.
- Cache parse failure evicts the key.
- Do not cache plaintext NVR, MQTT, or camera credentials.
- A lock key for a tenant-owned operation includes tenant and resource identity.

## BullMQ Queues

### Shared Workload Queues

Keep shared queues by workload:

```text
videoDeviceConfigQueue
videoDeviceDataQueue
pageConfigQueue
schedulerQueue
```

Do not create one queue per tenant.

### Minimal Tenant Queue Message

Use an explicit message contract without introducing unnecessary generic infrastructure:

```typescript
interface TenantQueueMessage<T> {
  tenantId: string;
  nvrId: string;
  msgId: string;
  operation: string;
  entityType: string;
  entityId: string;
  data: T;
  actor?: {
    type: 'user' | 'nvr' | 'system';
    id: string;
  };
  issuedAt: number;
  expiresAt?: number;
}
```

### Worker Rules

Before a worker side effect:

1. Validate queue message structure.
2. Validate unsigned 32-bit `msgId`.
3. Validate expiry when present.
4. Load the NVR using `(tenantId, nvrId)`.
5. Load the target entity using `(tenantId, entityId)`.
6. Verify entity-to-NVR relationship.
7. Verify operation type.
8. Pass `queueMsg.tenantId` explicitly to commands and queries.
9. Perform the side effect idempotently.

Queue payloads are internally produced but still require validation at worker boundaries because stale, malformed, migrated, or incorrectly produced jobs can otherwise cross tenant boundaries.

### Page Queue

Add `tenantId`, `nvrId`, canonical uint32-string `msgId`, `entityType`, `issuedAt`, and optional `expiresAt` to page queue messages.

### Camera Hardware Queue

Add `tenantId` and `nvrId` to camera hardware command messages. A camera ID alone is insufficient for asynchronous ownership.

### Failures

Keep failed-job diagnostic information with:

- Tenant ID
- NVR ID
- Canonical uint32-string message ID
- Operation
- Entity ID
- Failure reason
- Attempt count
- First and last failure timestamps

Do not include plaintext secrets.

### Concurrency

Review the current queue worker default concurrency of `1000`. Set explicit concurrency by workload based on Mongo pool size, MQTT capacity, external API quotas, and physical side-effect behavior.

This is shared workload safety, not per-user database limiting.

## Schedulers

Use tenant-aware scheduler identifiers:

```text
tenant-{tenantId}-nvr-{nvrId}-live-signal
tenant-{tenantId}-report-{date}
system-cloud-availability
```

Scheduler callbacks must pass persisted tenant IDs into commands and queue messages.

A global scheduler may enumerate all NVRs as a system operation, but each NVR operation must use that NVR's persisted tenant.

## MQTT And EMQX

### Shared Cloud Consumer

A shared cloud MQTT client with wildcard subscriptions across tenants is acceptable when:

- EMQX denies device access by default.
- Every NVR has unique credentials.
- Device ACLs contain concrete allowed topics.
- Every application handler validates topic ownership.
- Duplicate delivery is idempotent.

### Topic Hierarchy

Normalize topics to (decision 2026-08-31: no version prefix and no legacy
shapes — the fog client does not exist yet, so a single hierarchy is adopted
directly and the dual-run steps were dropped):

```text
tenants/{tenantId}/nvrs/{nvrId}/config/to-fog
tenants/{tenantId}/nvrs/{nvrId}/config/to-cloud
tenants/{tenantId}/nvrs/{nvrId}/pages/to-fog
tenants/{tenantId}/nvrs/{nvrId}/pages/to-cloud
tenants/{tenantId}/nvrs/{nvrId}/cameras/to-fog
tenants/{tenantId}/nvrs/{nvrId}/system-logs/to-cloud
tenants/{tenantId}/nvrs/{nvrId}/cloud-status/to-fog
```

Direction suffixes: `to-fog` = cloud publishes, fog subscribes; `to-cloud` =
fog publishes, cloud subscribes. Camera commands are addressed to the
NVR-level `cameras` topic: fog is one principal owning every camera under its
NVR and the payload carries the camera ID; per-camera topics are deferred
(see Explicitly Deferred Complexity).

Avoid case differences such as `Config` and `config`.

### Broker Requirements

- Anonymous access disabled
- Deny by default
- One MQTT principal per NVR
- Exact NVR topic allow rules
- NVR cannot subscribe using arbitrary `+` or `#`
- TLS required in production
- Connection, publish-rate, payload-size, and inflight limits per NVR
- Retained messages disabled for transient commands
- ACL and credential changes audited

### Credential Separation

Use separate credentials for:

```text
Fog HTTP authentication
MQTT broker authentication
Import bundle signing
```

Do not reuse the current NVR access token as the MQTT password and HTTP credential indefinitely.

### Inbound MQTT Validation

For each message:

1. Parse and validate complete topic shape.
2. Extract tenant and NVR from topic.
3. Validate payload DTO before side effects.
4. Load queue message by `(topicTenantId, topicNvrId, msgId)`.
5. Compare queue tenant with topic tenant.
6. Compare queue NVR with topic NVR.
7. Load persisted NVR using tenant and NVR.
8. Compare persisted NVR tenant.
9. Load target page/camera using queue tenant.
10. Verify target belongs to NVR and tenant.
11. Verify queued and response operation types match.
12. Pass validated queue tenant to commands and queries.
13. Consume the response idempotently.
14. Emit only to the validated tenant's WebSocket room.

Generalize the strong validation pattern already present in:

```text
src/modules/videoDevices/controllers/videoDeviceConfigs.mqtt.controller.ts
```

Apply it to page, camera-data, system-log, and future MQTT handlers.

### ACL Lock

If the distributed MQTT ACL lock cannot be acquired, abort the read-modify-write operation. Do not continue without the lock.

Decision 2026-08-31: with camera commands addressed to the NVR-level topic
there are no per-camera ACL rules, so the read-modify-write paths
(`createCameraTopics`, `deleteCameraTopics`) and the NVR ACL lock were
removed. NVR provisioning is a single create/delete of the EMQX user plus its
whole rule set (`createNvrTopics` / `deleteNvrTopics`), which needs no lock.
Reintroduce the lock with the per-camera ACL rules if they are ever added.

## WebSocket Isolation

### Handshake

During the Socket.IO handshake:

1. Validate Keycloak token.
2. Read requested tenant from `handshake.auth.tenantId`.
3. Validate tenant status and the tenant employee record.
4. Load tenant-scoped `EmployeeRoles`.
5. Store validated data on `socket.data`.
6. Join the tenant room.

Suggested socket data:

```typescript
interface TenantSocketData {
  tenantId: string;
  userId: string;
  employeeId: string;
  roles: EmployeeRoles[];
  isOwner: boolean;
  lang: LanguageCode;
}
```

### Rooms

Use:

```text
tenant:{tenantId}
tenant:{tenantId}:lang:{language}
tenant:{tenantId}:nvr:{nvrId}
```

The first implementation only requires the base tenant room. Add narrower rooms when a real subscription need exists.

### Send API

Replace global room iteration with an explicit tenant target:

```typescript
sendTenantMessage(
  tenantId: string,
  channel: WsChannels,
  message: WebsocketMsgBaseDto,
): void;
```

Provide a separately named platform broadcast only if a truly global event exists:

```typescript
sendPlatformMessage(channel, message): void;
```

Every asynchronous caller uses validated queue or persisted entity tenant. Every synchronous caller uses verified context or the command result's tenant.

### CORS

Use the configured production HTTP origin allowlist for Socket.IO. Do not use `origin: '*'` in production.

### Scaling

Do not add the Socket.IO Redis adapter while there is one application instance.

Before multiple replicas:

- Add Socket.IO Redis adapter.
- Use MQTT shared subscriptions or one MQTT ingestion leader.
- Ensure schedulers do not duplicate.
- Preserve queue idempotency.

## TDengine Tenant Design

### Decision

For normal logs and reports, create one child table per tenant under each supertable.

Example:

```text
system_log_t_<tenant-a> (one supertable per tenant)
  -> system_log_t_<tenant-a>_error
  -> system_log_t_<tenant-a>_warning
  -> system_log_t_<tenant-a>_information

actor_log_t_<tenant-a> (one supertable per tenant)
  -> actor_log_t_<tenant-a>_<actor-1>
  -> actor_log_t_<tenant-a>_<actor-2>

daily_report_v1
  -> daily_report_t_<tenant-a>
  -> daily_report_t_<tenant-b>
```

Decision 2026-08-31: supertable names carry no version suffix. Actor logs
and system logs use one supertable per tenant (`actor_log_t_<tenant>`,
`system_log_t_<tenant>`) with child tables per (tenant, actor) and
(tenant, severity) respectively and tags `(tenantId, ...)` on every child:
tenant identity is the supertable, so per-tenant backup, deletion
(`DROP STABLE`), and provisioning are single-table operations, per-actor
and per-severity reports tag-prune to an exact child table, and a member's
or a severity's history is removable with one `DROP TABLE`. The tenant tag
is still present on every child table (invariant 12) and all reads run
against the tenant's own supertable with a tenant predicate. Development
has no legacy data to preserve; a dev TDengine still holding tables of the
old shape must be dropped or recreated, because
`CREATE STABLE IF NOT EXISTS` cannot upgrade an existing supertable.

This is appropriate for:

- System logs
- Actor logs
- Notification history
- Ordinary business events
- Hourly or daily report summaries

### Tenant Tag

Each child table has a fixed tenant tag:

```sql
TAGS (
  tenant_id VARCHAR(36)
)
```

Keep the tag even when normal tenant reads query the child table directly. It supports platform queries, diagnostics, migration reconciliation, and tenant cleanup.

### Child Table Naming

Clients never provide table names.

Derive names only from a validated, server-owned tenant UUID:

```typescript
function tenantTableSuffix(tenantId: string): string {
  assertUuid(tenantId);
  return tenantId.replaceAll('-', '').toLowerCase();
}

function systemLogTableName(tenantId: string): string {
  return `system_log_t_${tenantTableSuffix(tenantId)}`;
}
```

The implementation must validate TDengine identifier length and character rules for the deployed version.

### Detailed Databases And Retention

Use:

```text
surveillance_detail: 90-day retention
surveillance_summary: 730-day retention
```

Configure retention at database level where supported.

### System Log Supertable

Suggested logical columns:

```text
timestamp
eventId
severity
section
entityType
entityId
messageKey
messageParams
metadata
```

All system events for one tenant may initially use one child table.

### Actor Log Supertable

Suggested logical columns:

```text
timestamp
eventId
actorType
actorId
action
messageKey
messageParams
metadata
```

All actor events for one tenant may initially use one child table. The same SSO user in two tenants is separated because the records are written to different tenant child tables.

Deleting a membership must delete only records associated with that membership and tenant according to retention policy. Do not drop a user-global child table.

### Timestamp Collision Gate

One child table may receive concurrent events with the same millisecond timestamp. Before using one table for all tenant events, verify row identity behavior in the deployed TDengine version.

Choose one tested solution:

1. Nanosecond timestamp precision.
2. Composite primary key with event ID if supported by the deployed version.
3. A monotonic timestamp allocator per tenant/table.
4. Another TDengine-supported mechanism that prevents same-timestamp overwrites.

Do not assume `Date.now()` is unique within one tenant child table.

`eventId` is independent from the 32-bit NVR `msgId` and should support report-event idempotency.

### High-Rate Telemetry

One child table per tenant may become a hot table for high-rate camera telemetry.

If high-rate telemetry is introduced, use one child table per tenant and data source, for example:

```text
camera_metric_t_<tenant>_c_<camera>
```

Suggested tags:

```text
tenant_id
nvr_id
camera_id
metric_type
```

Do not introduce this sharding for ordinary logs before volume requires it.

### Tenant Queries

Normal tenant report queries:

1. Receive tenant explicitly in the query object.
2. Tenant comes from verified HTTP context or validated async message.
3. Repository derives the child table from tenant.
4. Client input never includes a table name.
5. Filters are represented by typed fields.

Platform-wide queries may use the supertable with an explicit tenant-tag condition.

### Typed Query Contracts

Remove raw SQL filter strings from application contracts.

Example:

```typescript
interface SystemLogQuery {
  tenantId: string;
  entityIds?: string[];
  entityTypes?: string[];
  severities?: SystemLogTypes[];
  sections?: SystemLogSections[];
  from: number;
  to: number;
  order: 'ASC' | 'DESC';
  page: number;
  limit: number;
}
```

### SQL Safety

The TDengine layer must:

- Bind values where supported.
- Centrally escape values where binding is unavailable.
- Allowlist selected columns.
- Allowlist order columns and direction.
- Validate generated identifiers.
- Reject raw caller filters.
- Validate range and pagination bounds.
- Never interpolate unvalidated client data into identifiers or SQL fragments.

Keyword blacklists alone are not sufficient.

### Time Handling

- Store UTC timestamps.
- Query in UTC.
- Remove the hardcoded Tehran `+03:30` adjustment.
- Convert display boundaries using tenant or user IANA timezone.

### Report Summaries

Create idempotent hourly or daily rollups before detailed data expires.

Initial summary dimensions should be limited to known report requirements, such as:

```text
tenantId
date
severity
section
entityType
entityId or NVR
eventCount
firstSeen
lastSeen
```

Summary rollups use one child table per tenant under the summary supertable.

### Error Handling

TDengine repository methods must distinguish:

```text
No rows
Invalid query
Connection unavailable
Authentication failure
Timeout
Server error
```

Do not convert TDengine failures to empty reports.

## Fog HTTP APIs

### Device Principal

Fog APIs use an NVR principal, not a user tenant context.

Safe flow:

1. Authenticate serial number and HTTP-specific credential.
2. Load NVR by serial number.
3. Derive tenant and NVR from the persisted record.
4. Check tenant and NVR status.
5. Validate target queue or resource ownership.
6. Pass persisted tenant to commands and queries.

Do not trust tenant from the device body.

### Duplicate Configuration Route

Remove the duplicate `POST /fog-communication-manager/configs` registration and keep one implementation.

The surviving implementation must validate:

- Authenticated NVR
- Queue tenant
- Queue NVR
- Queue entity
- Queue operation
- Canonical uint32-string message ID
- Message expiry where used
- Page/camera ownership where applicable

Return only the configuration payload needed by fog. Do not return actor metadata or internal retry details.

### Notification Endpoints

Fog notification endpoints must validate that the target user has an active employee record in the authenticated NVR's tenant.

## Fog Tenant Import

### Decision

Replace whole-database restore with an application-level tenant/NVR domain import.

An NVR secret must never invoke `mongorestore`, unrestricted `mongoimport`, or `taosdump -i` against shared databases.

### Default Scope

An authenticated NVR may import only:

- Its own NVR configuration
- Its own cameras
- Its own pages
- Its own device state
- Its own supported time-series records

It may not import:

- Tenant employees
- Tenant settings
- Sibling NVRs
- Sibling cameras
- Another tenant
- MQTT administration state
- Platform configuration
- Database metadata or users

### Bundle

Use a versioned signed bundle, for example:

```text
manifest.json
nvrs.jsonl
cameras.jsonl
pages.jsonl
system-logs.jsonl
checksums.json
signature
```

Tenant ID in the archive is never trusted. The server stamps the tenant derived from authenticated NVR identity.

### Import Flow

1. Authenticate before accepting a large upload.
2. Derive tenant and NVR from MongoDB.
3. Apply upload rate and size limits.
4. Acquire a tenant/NVR import lock.
5. Allocate a unique import ID and staging path.
6. Verify checksum and signature.
7. Validate archive paths before extraction.
8. Enforce compressed size, expanded size, file count, and path depth.
9. Reject links, executable files, and unknown types.
10. Validate all schemas and relationships without production writes.
11. Ignore payload tenant and stamp trusted tenant.
12. Reject records owned by another NVR.
13. Apply idempotent Mongo upserts through tenant repositories.
14. Apply TDengine records through tenant-aware repositories.
15. Reconcile imported counts.
16. Write an audit result.
17. Remove staging data.
18. Release the lock.

### Phase 0 Compatibility Import

The retained `POST /fog-communication-manager/restore-fog-backup-to-cloud`
route is a compatibility bridge for the current `fog-surveillance-camera`
producer. It does not provide the final signed bundle described above.

Current request contract:

```text
X-Tenant-Id
X-Nvr-Serial-Number
X-Nvr-Access-Token
multipart file=backups.tar.zst
```

The guard validates these headers before Multer accepts the large upload. The
server derives the NVR ID and tenant from persisted NVR identity; archive
ownership fields are consistency assertions only.

The compatibility importer:

- Accepts `nvrs.json`, `cameras.json`, and `pages.json` from the surveillance Fog archive.
- Ignores Fog-local `autoProvisioningOperations.json`, `cameraNetworkBindings.json`, and TDengine content.
- Rejects arbitrary Mongo collections, unsafe archive paths, duplicate identities, and foreign-scope collisions.
- Preflights records before writes and stamps authenticated tenant/NVR ownership.
- Cancels only the authenticated NVR's active NVR/camera/page operations before import.
- Uses idempotent scoped upserts and targeted cache eviction, including partial-write failure cleanup.
- Does not invoke `mongorestore`, unrestricted `mongoimport`, or `taosdump -i`.

The later Fog Import phase still adds bundle signing, checksums, durable import
status/audit records, and tenant-scoped TDengine import.

### Idempotency

Use export ID, source NVR, origin record ID, and record version. Re-uploading a bundle must not duplicate records or physical side effects.

## Secrets

### Required Changes

- Store fog HTTP tokens as hashes where token retrieval is not required.
- Use a separate MQTT credential.
- Encrypt reversible camera and NVR credentials at application level.
- Do not cache plaintext credentials.
- Do not put plaintext credentials in BullMQ payloads or failed-job records.
- Do not include device credentials in HTTP or WebSocket responses.
- Add independent rotation and revocation workflows.
- Redact all credential fields from logs and errors.

### Future Encryption Model

Prefer envelope encryption:

```text
KMS master key
per-tenant data encryption key
ciphertext and key version stored in MongoDB
```

If KMS is unavailable initially, use a versioned application key from a secret manager. Do not store it in source control.

## External APIs And Notifications

### Membership Semantics

Sanaw and Keycloak identities are global. Tenant membership changes are local tenant operations.

Normal tenant actions must not delete the global user identity.

### Outbound Metadata

Where downstream APIs support it, include:

```text
tenantId
actor or NVR principal ID
correlation ID
idempotency key
source service
```

The receiving service must independently authorize tenant use. A shared API key plus an arbitrary tenant header is not sufficient by itself.

### Targeted Notification Limits

Apply tenant/channel limits because notifications have direct cost. This is an external-side-effect limit, not a general database operation limit.

## Logging And Audit

### Structured Fields

Include where applicable:

```text
tenantId
principalType
principalId
employeeId
requestId
correlationId
msgId
jobId
nvrId
entityType
entityId
operation
result
duration
```

### Rules

- Replace business-path `console.log` calls with structured logger calls.
- Never log credentials or full sensitive configuration payloads.
- Include tenant in HTTP, queue, MQTT, import, report, and WebSocket failure logs.
- Do not use tenant ID as an unbounded label in every Prometheus metric.

### Audit Events

Persist audit records for:

- Membership creation, suspension, and removal
- Tenant role changes
- Plan changes
- Tenant status changes
- NVR provisioning
- Credential rotation
- MQTT ACL changes
- Fog imports
- Report exports
- Tenant deletion
- Platform support access
- Explicit cross-tenant operations

## Tenant Lifecycle

### Statuses

Use or preserve:

```text
PROVISIONING
ACTIVE
SUSPENDED
DELETING
DELETED
```

### Enforcement

| Status       | User API       | Fog/MQTT          | Reads            | Jobs                      |
| ------------ | -------------- | ----------------- | ---------------- | ------------------------- |
| Provisioning | Limited        | Limited           | Limited          | Setup only                |
| Active       | Allowed        | Allowed           | Allowed          | Allowed                   |
| Suspended    | Writes blocked | Blocked by policy | Policy dependent | Nonessential jobs stopped |
| Deleting     | Blocked        | Blocked           | Export only      | Cleanup only              |
| Deleted      | Blocked        | Blocked           | Blocked          | None                      |

### Tenant Deletion

Implement an idempotent state machine:

1. Mark tenant `DELETING`.
2. Block new user and device operations.
3. Disconnect tenant sockets.
4. Revoke NVR HTTP credentials.
5. Revoke MQTT users and ACLs.
6. Stop tenant schedulers.
7. Cancel or finish tenant jobs according to operation safety.
8. Delete or anonymize tenant employee records.
9. Delete SMS notifier settings.
10. Delete pages.
11. Delete cameras.
12. Delete NVRs.
13. Delete tenant cache keys and locks.
14. Drop or delete tenant TDengine detail child tables.
15. Drop or delete tenant TDengine summary child tables.
16. Delete import/export artifacts.
17. Release external NVR assignments.
18. Remove tenant encryption keys after required retention.
19. Mark tenant `DELETED`.
20. Preserve required audit tombstone.

Every step must be tenant-filtered, retryable, idempotent, and audited.

## Implementation Phases

## Phase 0: Critical Containment

### Goal

Remove immediately dangerous global and ambiguous paths before adding a second tenant.

### Tasks

- [x] Replace `POST /fog-communication-manager/restore-fog-backup-to-cloud` with an authenticated tenant/NVR-scoped Mongo import. The route does not restore TDengine or arbitrary collections.
- [x] Remove all whole-database restore execution from NVR-accessible code.
- [x] Remove the duplicate fog `/configs` controller route.
- [x] Keep one fog configuration implementation with complete ownership validation for device and page messages.
- [x] Replace 16-bit `msgId` generation with unsigned 32-bit generation.
- [x] Change affected DTOs and message contracts to canonical decimal-string `msgId` with `1..0xffffffff` validation.
- [x] Add scoped BullMQ job IDs based on tenant, NVR, and the uint32-string message ID.
- [x] Add active scoped collision checks.
- [x] Remove NVR/device secrets from normal HTTP and WebSocket responses, except the NVR password explicitly required by users for Fog-side login.
- [x] Make MQTT ACL mutation fail when its distributed lock cannot be acquired.
- [x] Verify EMQX deny-by-default, authentication/anonymous rejection, TLS 1.2/1.3, and disabled WS/WSS listeners. Re-run with `npm run qualify:emqx`; production startup also requires TLS URLs and non-empty cloud MQTT credentials.

### Completion Gate

- Whole-database device restore is inaccessible; the retained route imports only server-scoped NVR, camera, and page records.
- Exactly one fog configuration route exists.
- Message IDs contain 32-bit values as strings and are scoped in queue storage.
- Fog cannot retrieve another NVR's queue message.
- Normal APIs expose no device credential except the explicitly approved NVR Fog-login password.

### Phase 0 Qualification Evidence

The following executable gates passed on 2026-08-25:

```text
npm run qualify:fog-restore
npm run qualify:fog-restore:image
npm run qualify:fog-restore:producer
npm run qualify:emqx
npm run test -- --runInBand
npm run build
bash -n scripts/mongo-restore.sh
```

Fog restore qualification uses fresh Docker Mongo and Redis instances with
Mongo authentication enabled. It boots the real Nest controller, guard, Multer
interceptor, restore service, Redis lock, archive parser, tar/zstd extraction,
and mongosh importer. It uploads the exact `fog-surveillance-camera` archive
layout, verifies scoped NVR/camera/page writes and cleanup, then uploads a
foreign-scope collision archive and verifies rejection and preservation.

The production-image gate builds `deployment/prod/Dockerfile` and runs the same
HTTP workflow inside the unprivileged runtime image over an isolated Docker
network. It verifies `mongosh`, `tar`, `zstd`, the read-only vetted importer,
and the writable `/cloud_shared_backups` path.

The producer-to-cloud gate builds the matching `fog-surveillance-camera`
production image, exports the five surveillance Fog collections from an
authenticated source Mongo using its actual `mongo-backup.sh`, creates the
actual `backups.tar.zst`, and uploads it through the cloud HTTP route into a
separate authenticated target Mongo. It verifies local-only collection ignores,
scoped writes, cleanup, and foreign-collision rejection.

Runtime EMQX qualification verifies effective broker configuration and
anonymous rejection over TCP and MQTTS.

Phase 0 is complete. The next implementation session should start Phase 1 only.
Do not enable a second production tenant until the later required isolation
gates in this document also pass.

## Phase 1: Employee, Role, And Context

### Tasks

- [x] Add tenant ID to `EmployeeModel` and use employees as the only tenant-membership records.
- [x] Add unique `(tenantId, userId)` index.
- [x] Add `GET /me/tenants`.
- [x] Require and validate `X-Tenant-Id` for tenant HTTP APIs.
- [x] Validate employee access directly from MongoDB for each tenant HTTP request.
- [x] Reuse tenant-scoped `EmployeeRoles` at controllers.
- [x] Extend request context with verified tenant and employee fields.
- [x] Add tenant ID to all tenant-owned CQRS command/query contracts touched by HTTP.
- [x] Remove `tenants[0]` from NVR creation.
- [x] Refactor employee removal so it removes one tenant employee, not global identity.

### Completion Gate

- The same user can operate in two tenants with different roles.
- Employee-role guards use the active tenant employee.
- Every normal synchronous command/query has explicit tenant ID.
- Missing or deleted tenant employee access fails closed.

### Phase 1 Qualification Evidence

The following gates passed on 2026-08-26:

```text
npm run test -- --runInBand
npm run build
git diff --check
```

The unit suite contains two-tenant employee roles, active-tenant guard,
tenant-list, employee-removal, compound-index, and explicit tenant
query-filter coverage. Direct tenant fields for page records remain Phase 2
work; SMS notifier records are now directly tenant-owned and repository-scoped.
Asynchronous CQRS strictness,
full tenant-scoped WebSocket rooms and MQTT changes remain in their later
phases. System-log writes, reads, counts, cleanup, SMS notifier selection, and
WebSocket delivery now carry an explicit verified tenant as described in the
partial Phase 4 and Phase 6 implementation notes below.

### Phase 1 Revision Note (2026-08-29)

Re-qualified after three deliberate changes. Gates re-run green:
`npm run build` clean; `npm run test` **63 suites / 208 tests** (was 213).

1. **System-log visibility is no longer role-gated.** Viewing system logs now
   requires only a valid, active tenant membership — no special employee role —
   on both the HTTP read (`GET /system-logs`) and the WebSocket push
   (`SYSTEM_LOGS_SOCKET`). Tenant isolation and per-recipient active-membership
   revalidation are unchanged; only the `Report`/owner role check was removed so
   the two delivery paths agree. The `EmployeeRoles.Report` value is retained,
   unused today, and reserved for a future camera-event reporting feature.
2. **Startup employee migration removed.** `EmployeeInitService`,
   `MigrateEmployeePersistenceCommand`, and `employeeMigration.repository.ts`
   were removed. This service targets fresh development databases with no
   legacy tenant-membership data to migrate. A one-time migration of any real
   legacy data (memberships, legacy roles, `plan`/`features`, legacy SMS
   notifiers) is deferred to the Phase 2 backfill task and the Data Migration
   Strategy; it must be re-introduced and rehearsed before production rollout.
3. **Module boundaries clarified.** The employee/tenant-membership aggregate
   (schema, repository, domain types, contracts, controller) now lives in the
   `tenantAccess` module that owns and operates it. The former `employees`
   module was renamed `smsNotifier` and now owns only the SMS notifier feature.
   No module registers another module's schema.

## Phase 2: MongoDB And Cache Isolation

### Tasks

- [x] Add tenant ID to page models, domain types, commands, queries, and mappers.
- [x] Add tenant ID to SMS notifier models, domain types, commands, queries, and mappers.
- [ ] Backfill legacy data into the existing tenant. (The Phase 1 startup migration was removed on 2026-08-29 for fresh dev databases; re-introduce and rehearse a one-time legacy migration here before production — see the Phase 1 Revision Note.)
- [x] Add tenant-aware repository contracts. (Page done; NVR/Camera/Tenant still on the shared `ParentRepository` and remain open — see the partial note.)
- [x] Scope find, count, aggregate, update, delete, and running-config mutations. (Page done.)
- [x] Use `$and` for trusted tenant plus caller filter. (Shared `buildTenantFilter` helper; Page repository uses it.)
- [x] Introduce explicit global/system repository methods for boot scans. (Page `findAllAsSystem`, `restoreAllPagesToCacheAsSystem`, `FindAllPagesAsSystemQuery`.)
- [x] Add compound indexes. (Page: `{tenantId,id}`, `{tenantId,nvrId,type,pageIndex}`, `{tenantId,nvrId,name}`.)
- [x] Prefix tenant-owned cache keys with tenant. (Page cache keys are `tenant:{tenantId}:PageModel:{id}`; NVR/Camera still unprefixed and remain open.)
- [x] Ensure cache hits cannot return another tenant. (Page cache reads verify the cached record tenant and fall through to a tenant-filtered DB read.)
- [ ] Stop caching plaintext device secrets.

### Partial Page Isolation Implementation

Implemented on 2026-08-29 (Page aggregate slice only):

- `tenantId` is a required, UUID-validated field on `PageModel`, `PageProps`,
  `PageValueObjects`, `PageEntity`, the page mapper, `PageCreatedDomainEvent`,
  and `CreatePageProps`. (Also fixed a latent mapper bug that persisted
  `nvrId: copy.id`.)
- `PageRepository` no longer extends the unscoped `ParentRepository`. It is a
  standalone tenant-scoped repository: `findById`, `findOne`, `findAll`,
  `aggregate`, `update`, `delete`, and `unlockRunningConfig` all require a
  tenant and merge it with the caller filter via the shared `buildTenantFilter`
  `$and` helper. `update`/`delete` throw when they match zero tenant rows
  instead of silently succeeding.
- Page cache keys are tenant-prefixed (`tenant:{tenantId}:PageModel:{id}`); a
  cached record whose tenant does not match is ignored and the read falls
  through to a tenant-filtered DB query.
- Cross-tenant page work is done only through explicitly named system methods:
  `findAllAsSystem`, `restoreAllPagesToCacheAsSystem`, and the
  `FindAllPagesAsSystemQuery` handler used by the rule-chain widget cleanup
  (which stamps each page's persisted tenant into the resulting command).
- Every page command requires a tenant: `CreatePageCommand`,
  `UpdatePageCommand`, and `DeletePageCommand` fail closed when tenant is
  absent. The async MQTT write path (`PagesMqttService.create/update/delete`)
  now derives tenant and NVR from the validated topic and threads them into the
  commands and tenant-scoped read-back queries.
- The unscoped `FindPageByIdQuery`, `FindPageByNameQuery`, and
  `FindPageByNameAndNvrIdQuery` handlers (isolation-bypass reads with no
  callers) were removed; only the tenant-scoped variants remain.
- Compound indexes added: `{tenantId,id}`, `{tenantId,nvrId,type,pageIndex}`,
  `{tenantId,nvrId,name}`.
- The page cache key has one owner, `pageCacheKey()` in `page.schema.ts`. The
  fog-restore evictor in `fogCommunicationManager.service.ts` uses the same
  helper, so the writer and the evictor cannot drift and silently leave stale
  pre-restore pages in cache.
- `insert` keeps the deterministic `_id` derived from the aggregate UUID that
  the shared `ParentRepository` sets, because fog cloud-recovery upserts depend
  on a stable `_id`.

Still open in Phase 2 for a later slice: converting NVR, Camera, and Tenant
repositories and their cache keys to the same tenant-scoped/`buildTenantFilter`
pattern, no-longer caching plaintext device secrets, and the one-time legacy
backfill migration.

### Completion Gate

- Cross-tenant access by known UUID returns not found.
- Pagination totals and aggregates are tenant-specific.
- Warm and cold cache paths have identical isolation.
- Global behavior is explicit rather than caused by missing tenant.

Gate status: **not met.** The Page slice is only _unit_-qualified (2026-08-29 —
`npm run build` clean; `npm run test` 68 suites / 235 tests, all mock-based).

Mock assertions prove the repository _builds_ tenant-scoped filters; they do
not prove MongoDB enforces isolation, that the new compound indexes are valid,
or that a cross-tenant read by known UUID returns not found end to end. Per the
Testing Strategy, closing this gate requires the two-tenant fixture and
Testcontainers integration suites under `test/integration/**`, which do not
exist yet. NVR/Camera cache scope, device-secret caching, and the legacy
backfill also remain.

## Phase 3: Async CQRS, Queues, And Schedulers

### Tasks

- [x] Add tenant and NVR to every tenant queue message.
- [x] Add tenant and NVR to page queue messages.
- [x] Add tenant and NVR to camera hardware queue messages.
- [x] Change queue lookup APIs to `(tenantId, nvrId, msgId)`. (Done in Phase 0.)
- [x] Validate queue message structure and ownership before worker side effects.
- [x] Pass `queueMsg.tenantId` explicitly to async commands and queries.
- [x] Add tenant-aware failure and expiry handling.
- [x] Add tenant scheduler identifiers.
- [x] Make global schedulers pass each persisted entity tenant explicitly.
- [x] Review queue concurrency and failed-job retention.

### Phase 3 Implementation Notes

Implemented on 2026-08-30.

**Shared queue envelope.** `src/modules/shared/tenantQueueMessage.ts` adds
`assertTenantQueueMessage`, one fail-closed validator used by all three device
queue workers before any side effect. It rejects a job whose structure, tenant
UUID, NVR UUID, uint32 `msgId`, entity type, derived topic, or issued/expiry
window is invalid or absent, and returns a `ValidatedTenantQueueScope` that
handlers use instead of re-reading unvalidated payload fields.

Two properties are load-bearing:

- The **scoped job ID is the tenant boundary.** The validator rebuilds
  `t-{tenantId}-n-{nvrId}-m-{msgId}` from the message body and compares it to
  the BullMQ key the job was stored under. A payload whose tenant, NVR, or
  `msgId` no longer matches its queue slot is rejected. This is what binds the
  camera-data queue to a tenant at all, because the legacy camera hardware topic
  has no tenant segment (topic normalization is Phase 5).
- The **publish target is derived, never echoed.** Workers publish to the topic
  computed from the validated tenant/NVR, not to the stored `metadata.topic`, so
  a stale or forged job cannot redirect a payload at another tenant's device.
  `src/modules/videoDevices/shared/deviceMqttTopics.ts` is now the single owner
  of every cloud→fog publish topic, so the producer entities and the validator
  cannot drift.

The validator deliberately does **not** reuse `Guard.isUUIDv4`: that regex is
unanchored, so `"x<uuid>y"` passes it. Tenant identity becomes a Redis key
segment here, so it is matched against the whole string.

`entityId` is validated as a whole UUID for the same reason: on the camera-data
queue it is interpolated into the derived publish topic, so a value such as
`aaa/#` would otherwise inject MQTT topic separators and a wildcard into the
address a payload is published to. (This also contains a non-UUID page
`originId`, which `PageEntity.create` does not itself constrain — such a page
fails closed at the worker boundary instead of reaching a topic.)

Expiry handlers pass an explicit `allowExpired: true` rather than faking a
clock. It relaxes _only_ the "already expired" comparison — an absent lifetime
or a foreign queue key is still rejected there — because expiry runs after the
final retry, when the window is closed by definition.

**Async tenant propagation.** Expiry handlers, the video-device MQTT
controller, and `NvrMqttService`/`CameraMqttService` now resolve entities with
`FindNvrByIdForTenantQuery` / `FindCameraByIdForTenantQuery` /
`FindAllCamerasForTenantQuery` / the new
`FindCameraBySerialNumberForTenantQuery`, instead of reading by ID and then
comparing tenants — the latter makes the check an assertion rather than an
isolation boundary. `UpdateNvrCommand`, `ActiveNvrCommand`, `InActiveNvrCommand`,
`ActiveCameraCommand`, `InActiveCameraCommand`, and `SoftDeleteCameraCommand`
accept an optional verified `tenantId` and fail closed on a foreign entity when
it is supplied (optional only until the remaining synchronous call sites are
migrated). `NvrMqttService` also re-verifies that each queued camera ID belongs
to the validated NVR, and stamps the NVR's persisted tenant/ID on newly
registered cameras rather than trusting the per-camera fields in the queued
batch. `VideoDevicesApiBaseService.findCameraWithId` was removed: an unscoped
read by ID with no callers.

**Schedulers.** `src/extensions/scheduler/schedulerIds.ts` owns scheduler
identity. The NVR live-signal interval moved from a bare, tenant-ambiguous
`nvrId` key to `tenant-{tenantId}-nvr-{nvrId}-live-signal`; `stop()` also clears
the legacy key so a deploy does not orphan the old interval. Its callback now
re-reads the NVR under its persisted tenant on every tick and stops the schedule
if it is gone, instead of acting on a long-lived closure capture. The
cloud-availability sweep is explicitly named `system-cloud-availability` and
derives each publish target from that NVR's own persisted tenant.

**Concurrency and failures.** The three device queues set explicit worker
concurrency (50) instead of inheriting the shared rule-engine default of 1000,
which is far above what an MQTT broker plus a physical NVR can absorb. Each has
a failure handler that logs tenant, NVR, `msgId`, operation, entity, and attempt
count — and never the payload, which carries device credentials.

`IQueue.createQueue` previously declared a one-argument failure handler while
`QueueService` passed `(msg, err)`; the interface now matches the
implementation.

### Completion Gate

- No async handler relies on HTTP context for data correctness.
- Forged or inconsistent queue tenant data is rejected.
- The same uint32-string `msgId` in different NVR scopes does not collide.

Gate status: **unit-qualified only** (2026-08-30 — `npm run build` clean;
`npm run test` 72 suites / 288 tests). The suites cover envelope rejection
(foreign tenant/NVR queue key, mismatched topic, wrong entity type, expired and
unstamped lifetime, out-of-range `msgId`, embedded-UUID tenant), no-publish on
every rejection, tenant-scoped expiry resolution, camera-to-NVR mismatch,
scheduler identity, and secret-free failure descriptions.

As in Phase 2, these are mock-based: they prove the handlers _build_ and enforce
tenant-scoped calls, not that Redis/BullMQ and MongoDB enforce isolation end to
end. Closing this gate needs the `test/integration/**` Testcontainers suites
with the two-tenant fixture, which still do not exist.

## Phase 4: WebSocket Isolation

### Tasks

- [x] Validate requested tenant during WebSocket handshake.
- [x] Store verified tenant access in socket cache data.
- [x] Join verified tenant rooms.
- [x] Replace global broadcast iteration with `sendTenantMessage()`.
- [x] Update every WebSocket caller to provide tenant.
- [x] Filter tenant-targeted system-log events against the verified socket tenant.
- [x] Restrict production WebSocket origins.
- [x] Disconnect sockets after tenant or membership suspension where practical.

### Phase 4 Implementation Notes

Implemented on 2026-08-30.

**Tenant rooms.** `src/extensions/websocket/tenantRooms.ts` owns the room name
`tenant:{tenantId}`. A connection that passes `WsAuthService` validation
(token, tenant status, active employee) joins that room during
`handleConnection`, and its verified identity is cached per socket as before.
An unverified connection is disconnected before joining anything.

**Send API.** The old `WebsocketService.sendMessage`, which iterated every
room in the adapter and matched tenants afterwards, is gone. The only business
send is `sendTenantMessage(tenantId, channel, message)`:

- It fails closed on a missing or non-UUID tenant by logging and returning
  without delivering; it never throws, because several callers fire from
  detached timers where a synchronous throw would surface as an unhandled
  rejection.
- Delivery iterates only the sockets inside `tenant:{tenantId}`, so a tenant A
  event can never be emitted to a socket that did not join tenant A's room.
- A cached socket record whose tenant does not equal the target tenant is
  skipped (defense in depth), and system-log delivery keeps revalidating active
  tenant access per recipient, so revocation takes effect without waiting for
  reconnection. A socket that fails that revalidation is now force-disconnected
  instead of left open.
- Per-recipient translation in the recipient's language is preserved.
- The ops-only `server:shutdown` emit remains the sole non-tenant broadcast; it
  is a platform message, not a business event.

All senders were migrated: the system-log, page, and video-device MQTT, HTTP,
live-signal, and cloud-recovery services pass the verified context tenant
(HTTP paths) or the persisted NVR/camera/page tenant (async paths) explicitly.
The old method no longer exists, so a caller cannot bypass the tenant target.

**Suspension.** `disconnectTenantSockets(tenantId)` is the separately named
platform operation that force-disconnects a whole tenant; the Phase 9
lifecycle work wires tenant status changes and membership removal to it.
Within this phase, suspended or revoked sockets are caught at every handshake
and at the next system-log send.

**CORS.** The gateway origin now mirrors the HTTP policy in `main.ts`: the
configured `CORS_ORIGINS` allowlist in production, open origin elsewhere.
Gateway options are static, so the origin is resolved once at module load
behind a guarded read; production still fails fast on a missing `CORS_ORIGINS`
through `main.ts`'s strict read of the same allowlist.

### Completion Gate

- Tenant A messages never reach Tenant B sockets.
- The same SSO user can open independent tenant connections.
- Business events cannot be sent without an explicit tenant target.

Gate status: **unit-qualified only** (2026-08-30 — `npm run build` clean;
`npm run test` 72 suites / 300 tests). The suites cover tenant-room-scoped
delivery (tenant B socket untouched), rejected sends without a valid tenant
target, revoked-membership skip plus force-disconnect, cached-tenant mismatch
skip, per-recipient translation, tenant-room join and unverified-connection
disconnect at the gateway, and scoped `disconnectTenantSockets`. As in Phases
2 and 3 these are mock-based: they prove the service targets only the verified
tenant room, not that a real socket.io deployment enforces isolation end to
end. Closing the gate needs the `test/integration/**` two-tenant WebSocket
suites (tenant A event reaches A but not B, shared user connects separately to
A and B, suspended tenant connection rejected or disconnected, unapproved
production origin rejected), which still do not exist.

## Phase 5: MQTT Topic And Device Isolation

### Tasks

- [x] Introduce tenant/NVR topic hierarchy. (No version prefix and no legacy shapes: the fog client does not exist yet, decided 2026-08-31.)
- [x] Add tenant to camera and page topic generation.
- [ ] Split HTTP and MQTT device credentials.
- [x] Apply concrete EMQX ACLs for tenant topics.
- [x] Generalize topic/queue/NVR/entity validation to every MQTT handler.
- [x] Remove unused subscriptions with no handler.
- [x] Make consumers idempotent.
- [x] ~~Dual-run legacy topics only for deployed fog compatibility.~~ N/A — no fog is deployed; a single hierarchy was adopted directly.

### Completion Gate

- NVR A cannot publish or subscribe to Tenant B topics.
- Forged topic and queue combinations cause no side effects.
- Every MQTT operation passes validated tenant into CQRS.

### Phase 5 Implementation Notes

Implemented on 2026-08-31. Because the fog client does not exist yet, the
original dual-run/legacy-compatibility steps were dropped by decision and the
hierarchy was adopted directly, without a version prefix.

- `src/modules/videoDevices/shared/deviceMqttTopics.ts` is the single owner of
  every cloud<->fog topic: the builders (`tenants/{tenantId}/nvrs/{nvrId}/
config|pages|cloud-status|cloud-recovery/to-fog` and
  `tenants/{tenantId}/nvrs/{nvrId}/cameras/{cameraId}/commands/to-fog`) and
  strict fog->cloud response topic parsers (`parseNvrConfigResponseTopic`,
  `parsePageConfigResponseTopic`) that validate the complete topic shape and
  require whole-UUID tenant/NVR segments, so a wildcard, separator, or
  traversal injected by a foreign publisher can never reach the ownership
  checks as a usable identity. The anchored UUID check moved to
  `src/modules/shared/uuid.ts` and is reused by the Phase 3 queue validator.
  Direction suffixes: `to-fog` = cloud publishes/fog subscribes, `to-cloud` =
  fog publishes/cloud subscribes.
- Camera and page topics carry the tenant. The camera hardware-command topic
  is NVR-level (`.../cameras/to-fog`) because fog is one principal owning all
  its cameras and the payload carries the camera ID; per-camera topics are
  explicitly deferred. The queued `metadata.topic` stamped by the entities and
  the queue envelope validator's expected topic are the same builder output,
  so a forged or stale job cannot redirect a payload at another tenant's
  device.
- EMQX ACLs. `NvrEntity.getCloudSubOnFogMqttTopics()` and
  `getCloudPubToFogMqttTopics()` provision the fog-publish (response) and
  fog-subscribe (command) exact topics, so `createNvrTopics` grants an NVR
  exactly its own tenant/NVR topics. Because there are no per-camera topics
  and therefore no per-camera ACL rules, the read-modify-write methods
  `createCameraTopics`/`deleteCameraTopics` and the NVR ACL lock were removed;
  provisioning is a whole rule-set create/delete.
- Unused subscriptions removed. The cloud subscribes only to response topics
  with a live `@OnEvent` handler (config and page responses). The handlerless
  `camera/data/sub` and `videoDevices/systemLogs/sub` wildcards are gone.
- Idempotent consumers. An unknown or already-consumed `msgId` in either MQTT
  controller is a debug-level skip with no side effects and no error event
  (duplicates and late responses after expiry-handler consumption are
  expected); every structural, ownership, lifetime, and operation-type
  mismatch still fails closed.
- Still open in this phase: splitting the HTTP and MQTT device credentials
  (deferred — the fog device receives its MQTT password from the Sanaw
  registration flow, so the split needs a coordinated fog/Sanaw change; see
  the Secrets phase) and the `test/integration/**` two-tenant EMQX/MQTT
  isolation suites.

### Phase 5 Qualification Evidence

The following gates passed on 2026-08-31:

```text
npm run test  (73 suites / 320 tests)
npm run build
```

New unit coverage: tenant/NVR topic builders, response topic parsers
(rejection of wrong resources, reversed direction, wildcards, traversal,
embedded UUIDs, and non-UUID identity), single-hierarchy publish targets
derived from the validated queue scope in all three device queue workers,
response-topic handling in both MQTT controllers, and idempotent unknown-msgId
skips. As in Phases 2–4 these are mock-based unit gates; the two-tenant EMQX
isolation suites remain open before the completion gate can close.

## Phase 6: TDengine V2 And Reports

### Tasks

- [ ] Verify deployed TDengine row identity and same-timestamp behavior. (Requires a live TDengine session; the process-local allocator below is the selected mitigation for the single-instance deployment in the meantime.)
- [x] Select and unit-test a per-child monotonic millisecond allocator for the current single-instance deployment.
- [ ] Create detail and summary databases with configured retention.
- [x] Create tenant-tagged system-log supertables. (One supertable per tenant — `system_log_t_<tenant>` with `(tenantId, groupId)` tags; no version suffix, decision 2026-08-31.)
- [x] Create tenant-tagged actor-log supertable. (One supertable per tenant — `actor_log_t_<tenant>` with `(tenantId, actorId)` tags; no version suffix, decision 2026-08-31.)
- [x] Create deterministic per-(tenant, severity) system-log child tables under each tenant's own supertable.
- [x] Create one child table per tenant under each log supertable. (Actor logs: one child per (tenant, actor) under the tenant's supertable; system logs: one child per (tenant, severity) under the tenant's supertable, decision 2026-08-31.)
- [ ] Create one child table per tenant under each summary supertable.
- [x] Replace raw filters with typed query contracts. (Actor-log queries take no caller filters or table names at all; system-log queries take typed fields only. The shared `FindDataParams.filter` remains as an infra-internal detail — no application caller passes a raw filter.)
- [x] Validate or bind every value and identifier. (All filter literals now pass the central `TimeSeriesDbExtension.quoteStringLiteral` escaper; identifiers are server-derived validated UUIDs. Remaining hardening: allowlist order-by columns in the shared repository.)
- [x] Remove hardcoded timezone offset and use UTC.
- [x] Add required tenant to system-log commands, queries, counts, and cleanup.
- [x] Add explicit tenant to actor-log commands and queries.
- [ ] Add idempotent rollup jobs.
- [x] Stop swallowing TDengine query errors.
- [ ] Dual-write and reconcile before switching reads. (Moot for actor logs today: no legacy reader exists and the tenant-tagged table is the only write target, mirroring the accepted system-log approach. Revisit if a legacy consumer appears.)
- [ ] Backfill legacy records to the known legacy tenant.

### Partial System-Log V2 Implementation

Implemented on 2026-08-27:

- `tenantId` is required and UUID-validated by every system-log create, read,
  count, and cleanup contract.
- Creation checks that the tenant exists before writing.
- New records are written to the tenant's own supertable
  (`system_log_t_<tenant>`, tags `tenantId` + `groupId`), ensured once per
  process on the tenant's first write (mirroring `ActorLogRepository`), into
  a child table per (tenant, severity) (`system_log_t_<tenant>_<severity>`)
  created implicitly by `INSERT ... USING`. Child names are derived only from
  the validated tenant UUID and enum severity; severity travels inside the
  record tuple and callers never supply table names.
- Reads, pagination totals, and cleanup query the tenant's own supertable and
  still include the tenant tag predicate and severity filters as
  defense-in-depth.
- Cleanup operates only on deterministic child tables for the requested tenant.
- Writes allocate strictly increasing timestamps per tenant/severity child in
  the current process, preventing same-millisecond overwrite while the service
  runs as one application instance.
- Asynchronous NVR, camera, page, and fog-recovery producers pass persisted or
  queue-owned tenant identity explicitly rather than relying on HTTP context.
- SMS notifier records use required `tenantId`, unique `(tenantId, userId)`, and
  tenant-scoped reads, updates, and deletion. Legacy rows are backfilled only
  when one employee tenant can be proven; shared-user ambiguity fails startup.
- System-log WebSocket delivery revalidates active tenant access for every
  recipient, so revocation takes effect without waiting for socket
  reconnection. Delivery requires only an active tenant membership; the earlier
  `Report`/owner role gate was removed on 2026-08-29 so the WebSocket push and
  the `GET /system-logs` HTTP read share the same visibility rule (see the
  Phase 1 Revision Note).

The child topology is one table per tenant and severity, under the tenant's
own supertable. This keeps the severity partition and avoids combining
concurrent severities in one timestamp-keyed child. The process-local
monotonic allocator covers the documented single-instance deployment. Before
multiple application replicas, replace it with a distributed monotonic
allocator, nanosecond timestamps, or a verified TDengine composite-key
solution. Boot-time supertable creation is gone: no stable exists before its
tenant's first write.

Legacy unscoped rows remain untouched in the legacy `systemLogSuperTable`
v1 stable. Normal tenant APIs do not read that table, because assigning or
exposing those rows without a proven tenant would violate isolation. Backfill
and reconciliation remain open Phase 6 work.

### Partial Actor-Log V2 Implementation

Implemented on 2026-08-31:

- `tenantId` is required and UUID-validated by the actor-log create command and
  every actor-log query; creation checks that the tenant exists before writing
  (mirroring `CreateSystemLogCommandHandler`).
- New records are written to the tenant's own supertable
  (`actor_log_t_<tenant>`, tags `tenantId` + `actorId`) into a child table
  per (tenant, actor) (`actor_log_t_<tenant>_<actor>`), created implicitly by
  `INSERT ... USING`. The stable is ensured once per process on the tenant's
  first write; boot-time `initSuperTables` no longer creates any actor-log
  stable. Names are always derived server-side from validated UUIDs;
  caller-supplied super/sub table names are ignored by the repository. This
  replaces the legacy `<actorId>-actorLog` per-user child tables under one
  global supertable, which mixed the same SSO user across tenants (both audit
  Critical findings: user-keyed child tables, and membership deletion
  dropping a user-global actor table).
- Naming decision 2026-08-31: no version suffix; per-tenant supertables and
  per-(tenant, actor) children. Reads run against the tenant's supertable
  with a `tenantId` predicate; per-user reads add an `actorId` predicate that
  TDengine resolves by tag pruning before scanning. Tenant-wide backup,
  deletion (`DROP STABLE`), and provisioning are single-table operations.
- `CreateActorLogSubTableCommand` and `DeleteActorLogSubTableCommand` were
  removed with their API-service methods and the empty `actorLogsDataReport`
  stub. There is no per-user child table anymore; v2 child tables are created
  implicitly by `INSERT ... USING`.
- Same-millisecond collision safety: the per-child monotonic millisecond
  allocator was extracted from the system-log repository into
  `src/modules/shared/monotonicTimestamp.ts` and is now shared by both log
  repositories, so the two implementations cannot drift.
- Every `registerActorLog` call site now passes a verified tenant explicitly:
  NVR/camera/page actor services derive it from the persisted entity's
  `tenantId`, SMS-notifier commands pass `command.tenantId`, and the tenant
  rename passes the targeted tenant ID (platform-authorized target, not
  ambient context). `ActorLogApiService.registerActorLog` requires `tenantId`
  and fails closed without it; the existing no-actor skip for system-driven
  cloud-recovery flows is preserved. Legacy ambient-context tenant resolution
  is gone.
- Actor-log reads (`findAll`, `findAllPaginated` + implicit count, `count`)
  accept typed fields only — tenant, optional actor types, optional UTC time
  range — and always query the tenant-derived child table plus a tenant tag
  predicate. Callers never supply a table name or a raw filter. (No production
  reader existed before; these are the future report surface.)
- Kiosk identity preserved: `SANAW_KIOSK_USER_ID` (`00000000-...`) stays in
  the actor-log domain. During fog-only operation the kiosk is the only user;
  when cloud access returns, its actor logs restore to the cloud under this
  actor ID and remain reportable by filtering on the actor ID within the
  tenant child table — never by table name.
- Membership hard delete removes actor logs (decision 2026-08-31):
  `HardDeleteTenantEmployeeCommand` now calls `DeleteTenantActorLogsCommand`,
  which requires explicit actor IDs (an absent filter can never wipe a
  tenant's history), and `ActorLogRepository.dropByActor` executes one
  `DROP TABLE IF EXISTS` against the actor's child table inside the tenant's
  own supertable — instant, tenant-scoped by construction. The same SSO
  user's records in other tenants live under different supertables and are
  untouched. Whole-tenant actor-log deletion stays a separately named,
  platform-authorized Phase 9 lifecycle operation (`DROP STABLE`).
- Per-user report shape: the typed queries accept optional `actorIds` and
  `actorTypes` plus a UTC time range, and always read the tenant's own
  supertable. The `actorId` predicate is carried by the child-table tag, so
  TDengine prunes to the matching child tables before scanning — per-user
  reports touch only that user's rows; tenant-wide reports scan exactly the
  tenant's data.
- SQL literals: `TimeSeriesDbExtension.quoteStringLiteral` is the single
  escaper for every filter literal; the system-log query handlers and
  `deleteAll` now build filters through it as well. Backfill of pre-existing
  actor-log rows to the legacy tenant remains open Phase 6 work.
- UTC: the hardcoded +03:30 offset was removed from
  `TimeSeriesDbExtension.createFindAllQuery`/`createCountQuery`. Time ranges
  are compared as numeric UTC epoch milliseconds with integer and ordering
  validation; no caller passed the old string/offset path at change time.

### Phase 6 Qualification Evidence

The following gates passed on 2026-08-31 (actor-log slice):

```text
npm run test  (79 suites / 352 tests)
npm run build
git diff --check
```

New unit coverage: tenant-derived actor child-table selection (same actor in
two tenants lands in different tables), ignored caller-controlled table names,
central literal escaping, same-millisecond monotonic allocation, fail-closed
missing/foreign/malformed tenant at the command, repository, query, and API
facade layers, no-actor skip preservation, UTC numeric time-range bounds and
rejections, supertable creation including legacy-table non-creation, and the
shared allocator's per-table independence. As in prior phases these are
mock-based unit gates; the `test/integration/**` two-tenant TDengine suites
(tenant A insert invisible to tenant B query, same actor separated across
tenants, tenant A delete leaves tenant B unchanged) remain open before the
completion gate can close.

### Completion Gate

- Tenant A cannot read, count, update, or delete Tenant B time-series data.
- Same SSO actor is separated across tenants.
- Detail retention is 90 days and summary retention is 2 years.
- TDengine outages are distinguishable from empty data.

## Phase 7: Tenant-Scoped Fog Import

### Tasks

- [ ] Define a versioned signed domain bundle.
- [ ] Authenticate NVR before accepting large upload data.
- [ ] Add isolated staging paths per tenant, NVR, and import.
- [ ] Add compressed and expanded size limits.
- [ ] Validate paths, checksums, signatures, schema, and record count.
- [ ] Stamp server-derived tenant and NVR.
- [ ] Reject employee records, sibling NVRs, and platform records.
- [ ] Apply idempotent Mongo upserts through tenant repositories.
- [ ] Apply time-series records through tenant TDengine repositories.
- [ ] Add import status, retry, audit, and cleanup.

### Completion Gate

- No NVR-accessible whole-database restore exists.
- NVR import cannot affect a sibling NVR or another tenant.
- Repeated import does not duplicate records.

## Phase 8: Secrets, Notifications, And External APIs

### Tasks

- [ ] Hash non-retrievable HTTP device credentials.
- [ ] Encrypt reversible device and camera credentials.
- [ ] Add credential rotation and revocation.
- [ ] Remove credentials from Redis, jobs, logs, and responses.
- [ ] Scope notification recipients by tenant membership.
- [ ] Verify fog target user belongs to authenticated NVR tenant.
- [ ] Include tenant and correlation metadata in downstream calls where supported.
- [ ] Add tenant notification limits.

### Completion Gate

- Compromise of one protocol credential does not grant another protocol.
- Tenant events notify only users in that tenant.
- Membership removal does not delete global identity.

## Phase 9: Audit, Lifecycle, And Operational Hardening

### Tasks

- [ ] Add tenant fields to structured logs.
- [ ] Replace business-path console logging.
- [ ] Add immutable tenant audit events.
- [ ] Enforce tenant suspension at all boundaries.
- [ ] Implement idempotent tenant deletion workflow.
- [ ] Add targeted limits for imports, reports, notifications, MQTT, and outstanding device commands.
- [ ] Document platform support and cross-tenant access procedures.

### Completion Gate

- Tenant operations are traceable without exposing secrets.
- Suspension is consistent.
- Tenant deletion removes all owned resources without affecting another tenant.

## Data Migration Strategy

### MongoDB

1. Confirm the existing deployment has exactly one tenant.
2. Record that tenant as the legacy tenant.
3. Add optional tenant fields.
4. Backfill membership/employee records.
5. Backfill SMS notifier records.
6. Backfill pages from their NVR ownership.
7. Validate every page NVR exists.
8. Validate every camera tenant matches its NVR.
9. Quarantine invalid records.
10. Create non-unique compound indexes.
11. Detect and resolve duplicate compound keys.
12. Create unique compound indexes.
13. Make tenant fields required.
14. Enable tenant-scoped repositories.
15. Remove temporary unscoped code.

### TDengine

1. Create v2 detail and summary structures.
2. Add tenant-aware repositories.
3. Enable dual-write.
4. Reconcile counts and samples.
5. Backfill legacy data to the legacy tenant.
6. Switch reads to v2.
7. Switch deletes to v2.
8. Stop legacy writes.
9. Keep a defined rollback window.
10. Remove legacy tables after approval.

Legacy system and actor logs do not contain sufficient tenant information for arbitrary multi-tenant inference. Assign them only to the verified legacy tenant unless ownership can be proven through persisted relationships.

## Testing Strategy

Follow the Sanaw testing standard.

### Test Levels

| Level       | Location                                                          | Main use                                                                |
| ----------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Unit        | `src/modules/<module>/tests/**` and mirrored extension test trees | Context, employee-role guards, topic parser, SQL builder, ID generation |
| Integration | `test/integration/**`                                             | Real MongoDB, Redis/BullMQ, TDengine, and EMQX through Testcontainers   |
| E2E         | `test/**/*.e2e-spec.ts`                                           | Critical HTTP tenant switching and fog-to-cloud flow                    |
| Contract    | Pact message tests where contracts cross services                 | MQTT and external contracts when introduced                             |

### Two-Tenant Fixture

Every isolation suite should create:

```text
Tenant A
Tenant B
Shared User: employee of A and B with different roles
User A: employee only of A
User B: employee only of B
NVR A and NVR B
Camera A and Camera B
Page A and Page B
SMS notifier A and SMS notifier B
```

### HTTP And Authorization Tests

- [ ] Missing active tenant is rejected.
- [ ] Unknown tenant is rejected.
- [ ] Missing employee is rejected.
- [ ] Deleted employee is rejected.
- [ ] Suspended tenant is rejected.
- [ ] Missing employee role is rejected.
- [ ] Shared user has different roles in two tenants.
- [ ] Role in Tenant A grants nothing in Tenant B.
- [ ] Foreign object and nonexistent object have equivalent responses.

### Mongo And Cache Tests

- [ ] `findById` includes tenant.
- [ ] `findOne` includes tenant.
- [ ] `findAll` includes tenant.
- [ ] Pagination count includes tenant.
- [ ] Aggregate includes tenant.
- [ ] Update includes tenant.
- [ ] Delete includes tenant.
- [ ] Running-config mutation includes tenant.
- [ ] Caller filter cannot override tenant.
- [ ] Warm and cold cache paths preserve isolation.
- [ ] Tenant A cache invalidation leaves Tenant B unchanged.

### Message ID And Queue Tests

- [x] Generator produces canonical decimal strings from `1` through `0xffffffff`.
- [x] Generator never returns `0`.
- [x] Same uint32-string ID under different NVRs creates different queue keys.
- [x] Active scoped collision causes regeneration.
- [x] Queue lookup requires tenant, NVR, and uint32-string ID.
- [x] Missing queue tenant is rejected.
- [x] Queue tenant inconsistent with persisted NVR is rejected.
- [x] Worker passes queue tenant to command/query.
- [x] Failure and expiry handlers preserve tenant.

### MQTT Tests

- [ ] NVR A cannot use Tenant B topic.
- [ ] Topic tenant and queue tenant mismatch is rejected.
- [ ] Topic NVR and queue NVR mismatch is rejected.
- [ ] Queue entity and camera/page mismatch is rejected.
- [ ] Payload validation occurs before side effects.
- [ ] Duplicate delivery is idempotent.
- [x] ~~ACL lock failure aborts mutation.~~ Superseded 2026-08-31: the read-modify-write ACL paths and the lock were removed (see ACL Lock); provisioning is a whole rule-set create/delete.

### Fog Restore Qualification Tests

- [x] Authentication occurs before multipart upload handling.
- [x] Tenant/NVR mismatch is rejected.
- [x] Unsupported collections and unsafe archive paths are rejected.
- [x] Exact surveillance Fog archive layout imports successfully.
- [x] The actual surveillance Fog production image generates an archive that imports successfully.
- [x] Foreign-scope ID collisions are rejected without modifying the foreign record.
- [x] Redis restore lock is fail-closed and released after success/failure.
- [x] Uploaded files, staging files, and targeted cache entries are cleaned.
- [x] Authenticated Mongo import works on host and inside the production image.
- [x] Production image contains the required unprivileged restore tooling.

### WebSocket Tests

- [ ] Tenant A event reaches Tenant A socket.
- [ ] Tenant A event does not reach Tenant B socket.
- [ ] User without membership cannot join tenant room.
- [ ] Shared user can connect separately to A and B.
- [ ] Suspended tenant connection is rejected or disconnected.
- [ ] Unapproved production origin is rejected.

### TDengine Tests

- [ ] Tenant A insert is invisible to Tenant B query.
- [ ] Tenant count excludes another tenant.
- [ ] Same actor in two tenants remains separate.
- [ ] Tenant A delete leaves Tenant B unchanged.
- [ ] Same-timestamp events are both preserved under the selected schema.
- [ ] Identifier and SQL metacharacters cannot alter query structure.
- [ ] Invalid order columns are rejected.
- [ ] UTC date boundaries are correct.
- [ ] Rollup rerun is idempotent.
- [ ] Detail expiry does not delete summaries.
- [ ] TDengine outage returns an operational error, not empty data.

### Import Tests

- [ ] Authentication occurs before large upload acceptance.
- [ ] Archive traversal is rejected.
- [ ] Expanded-size limit is enforced.
- [ ] Invalid signature is rejected.
- [ ] Payload tenant is ignored and trusted tenant is stamped.
- [ ] NVR A cannot import NVR B records.
- [ ] Membership records are rejected.
- [ ] Retry is idempotent.
- [ ] Partial failure can resume.
- [ ] Staging cleanup runs.
- [ ] Tenant A import leaves Tenant B unchanged.

### Lifecycle Tests

- [ ] Suspension blocks tenant HTTP writes.
- [ ] Suspension blocks fog operations.
- [ ] Suspension blocks MQTT processing.
- [ ] Tenant deletion removes cache keys and locks.
- [ ] Tenant deletion removes jobs and schedulers.
- [ ] Tenant deletion removes MQTT ACLs.
- [ ] Tenant deletion removes TDengine child tables.
- [ ] Tenant A deletion leaves Tenant B unchanged.
- [ ] Deletion can resume after partial failure.

## Rollout Strategy

### Sequence

1. Deploy Phase 0 containment.
2. Add `tenantId` to the employee schema additively.
3. Backfill the existing tenant employees.
4. Add active tenant validation behind a temporary feature flag.
5. Update clients to send `X-Tenant-Id`.
6. Enable controller employee-role checks.
7. Add tenant fields and backfill Mongo data.
8. Enable tenant-scoped repositories and cache keys.
9. Run two-tenant staging isolation tests.
10. Enable async tenant propagation and scoped uint32-string message IDs.
11. Enable tenant WebSocket rooms.
12. Provision fog clients on the tenant/NVR topic hierarchy.
13. Enable TDengine v2 dual-write.
14. Backfill and reconcile TDengine.
15. Switch report reads to v2.
16. Deploy tenant-scoped fog import.
17. Enable a second production tenant only after all required gates pass.
18. Remove temporary compatibility paths and feature flags.

### Feature Flags

Temporary flags may include:

```text
TENANT_CONTEXT_REQUIRED
TENANT_REPOSITORY_SCOPE_ENABLED
TENANT_WEBSOCKET_ROOMS_ENABLED
TDENGINE_V2_DUAL_WRITE
TDENGINE_V2_READS
FOG_DOMAIN_IMPORT_ENABLED
```

Every temporary flag needs an owner and removal condition. A feature flag must not become a permanent isolation bypass.

### Rollback Rules

- Add schema fields before requiring them.
- Reconcile all dual writes.
- Never roll back to unscoped reads after multiple tenants exist.
- Disable affected traffic rather than restoring unsafe behavior.
- Keep legacy TDengine data read-only during the rollback window.
- Keep platform disaster recovery separate from fog import.

## Definition Of Done

Multi-tenancy is complete only when all of the following are true.

### Identity And Authorization

- [ ] A user can belong to multiple tenants.
- [ ] Active tenant is explicit and verified per HTTP request and WebSocket connection.
- [ ] Tenant-scoped employee roles are enforced at controllers.
- [ ] Roles are employee-record-specific.
- [ ] Missing tenant fails closed.

### CQRS And MongoDB

- [ ] Every tenant-owned command/query contains tenant ID.
- [ ] Synchronous commands use verified context tenant.
- [ ] Async commands use validated message tenant.
- [ ] Every tenant-owned Mongo operation filters by tenant.
- [ ] Cache cannot bypass tenant scope.
- [ ] Global operations are explicit and separately named.

### Device Messages And MQTT

- [x] Device message ID is unsigned 32-bit and nonzero.
- [x] Queue identity is scoped by tenant, NVR, and uint32-string message ID.
- [ ] MQTT topic, queue, persisted NVR, and target entity are cross-validated.
- [ ] NVR credentials and ACLs cannot cross tenants.

### WebSocket

- [x] Clients join verified tenant rooms.
- [x] Business sends require an explicit tenant.
- [x] Global client iteration is removed.
- [ ] Cross-tenant delivery tests pass.

### TDengine

- [ ] Each log/report supertable has one tenant-tagged child table per tenant.
- [ ] Same-timestamp row behavior is tested and safe.
- [ ] Queries receive explicit tenant and never accept client table names.
- [ ] Detail and summary retention are configured.
- [ ] Actor logs are separated for the same SSO user across tenants.
- [ ] SQL construction accepts no arbitrary raw filters.

### Fog Import And Operations

- [x] Whole-database device restore is removed.
- [ ] Fog import is tenant/NVR scoped, signed, validated, idempotent, and audited.
- [ ] Notifications are tenant-scoped.
- [ ] Secrets are not returned, logged, cached, or queued in plaintext.
- [ ] Suspension and deletion are enforced across every boundary.

## Required Gates Before A Second Production Tenant

Do not enable a second production tenant until:

```text
Phase 0 complete
Phase 1 complete
Phase 2 complete
Phase 3 complete
Phase 4 complete
HTTP two-tenant tests pass
Mongo/cache two-tenant tests pass
Queue numeric ID scope tests pass
WebSocket two-tenant tests pass
EMQX and application MQTT isolation tests pass
```

TDengine must also be tenant-safe before exposing multi-tenant reports or logs, even if general device CRUD is enabled earlier.

## Instructions For Future Implementation Sessions

Before editing:

1. Read `AGENTS.md`.
2. Inspect `git status` and preserve unrelated changes.
3. Load the Sanaw `testing` skill before writing or reviewing tests.
4. Implement one phase or one small slice only.
5. Add tests in the locations required by the testing standard.
6. Run targeted tests.
7. Run `npm run build` for type checking.
8. Remember that `npm run lint` mutates files.
9. Do not commit or push unless explicitly requested.

Implementation priority:

```text
Critical fog containment
32-bit scoped message IDs
Employee role and active tenant context
MongoDB and cache tenant scope
Async CQRS and queue propagation
WebSocket tenant rooms
MQTT normalization and credential separation
TDengine tenant child tables and reports
Fog tenant import
Lifecycle and audit hardening
```

## Recommended First Implementation Session Prompt

```text
Implement Phase 0 of MULTI_TENANCY_IMPLEMENTATION_PLAN.md.

Scope:
- Keep the authenticated restore route limited to tenant/NVR-scoped NVR, camera, and page Mongo imports; do not expose whole MongoDB/TDengine restore execution.
- Remove the duplicate POST /fog-communication-manager/configs route.
- Keep one fog configuration implementation and enforce NVR, tenant, queue,
  entity, operation, numeric msgId, and expiry ownership checks for video-device
  and page messages.
- Change generateRandomMsgId from a 16-bit string to a nonzero unsigned 32-bit decimal string.
- Scope BullMQ device job IDs and lookups by tenantId, nvrId, and string msgId.
- Detect collisions among active jobs in that scope and regenerate.
- Remove NVR/device secrets from ordinary HTTP and WebSocket responses.
- Make MQTT ACL updates fail closed when the lock cannot be acquired.
- Add focused tests following the Sanaw testing standard.
- Run targeted tests and npm run build.

Do not implement later multi-tenancy phases in the same change.
Preserve unrelated worktree changes.
```

## Final Safety Rule

After more than one production tenant exists, no code path may interpret absent tenant identity as permission to access all tenants.

Synchronous tenant operations receive tenant from verified request context. Asynchronous tenant operations receive tenant from a validated queue, topic, NVR, or persisted entity relationship. Global operations must always be explicit, separately named, platform-authorized, and audited.
