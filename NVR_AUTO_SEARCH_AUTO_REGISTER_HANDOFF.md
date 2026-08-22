# NVR Auto-Search And Auto-Register Implementation Handoff

## Purpose

This document is the authoritative handoff for implementing NVR `autoSearch` and
`autoRegister` in a new session. It captures the accepted design decisions,
cross-service contracts, safety requirements, known defects, implementation order,
tests, and exclusions.

No feature implementation was performed during the planning session. This handoff is
the only file intentionally added by that session.

## Target Repositories

Implement the complete flow across all four repositories:

```text
/home/michael/sanawProjects/newVersion/platform-sanaw/admin-api-v2
/home/michael/sanawProjects/newVersion/platform-sanaw/workspacesAndGatewaysAdminApi
/home/michael/sanawProjects/newVersion/cloud-surveillance-camera
/home/michael/sanawProjects/newVersion/fog-surveillance-camera
```

Use these repositories only as behavioral or implementation references:

```text
/home/michael/sanawProjects/newVersion/platform-sanaw/workspace-backend-v2
/home/michael/sanawProjects/newVersion/platform-sanaw/gateway-backend-v2
```

Primary gateway behavior references:

```text
workspace-backend-v2/src/modules/devices/controllers/http/gateway.http.controller.ts
workspace-backend-v2/src/modules/devices/applicationService/services/http/gateway.http.service.ts
workspace-backend-v2/src/modules/devices/applicationService/validators/gateway.validator.ts
workspace-backend-v2/src/modules/devices/controllers/mqtt/deviceSoftwareConfigs.mqtt.controller.ts
workspace-backend-v2/src/modules/devices/applicationService/services/mqtt/gatewaySoftwareConfigs.mqtt.service.ts
workspace-backend-v2/src/modules/devices/controllers/mqtt/gatewayCommands.mqtt.controller.ts
workspace-backend-v2/src/modules/devices/applicationService/services/mqtt/gatewayCommands.mqtt.service.ts
```

Scanner reference:

```text
gateway-backend-v2/src/modules/devices/infra/ethernet/ethernetScanner.service.ts
```

Do not copy the gateway registration or scanner implementations blindly. Their unsafe
or incompatible behaviors are documented below.

## First Actions In The New Session

Before editing code:

1. Read the repository-local `AGENTS.md`, `CLAUDE.md`, parent instructions, and
   architecture rules for every target repository.
2. Check for `.codegraph/` and use CodeGraph first where available.
3. Run `git status --short` in all four repositories.
4. Inspect relevant current diffs and recent commits before changing any file.
5. Preserve all existing modified and untracked work. Never revert or overwrite user
   changes.
6. Load the Sanaw `testing` skill before writing or reviewing tests.
7. Follow each repository's OpenSpec or contract-first workflow for new HTTP, MQTT,
   gRPC, module-level, or externally observable behavior.
8. Create a structured todo list covering management, facade, Cloud, Fog, deployment,
   tests, and verification.
9. Implement in verified checkpoints. Build and test after each checkpoint instead of
   making one unverified four-repository change.

The working trees are already heavily modified. Several Cloud NVR files are untracked
or modified and must be treated as active user work.

## Explicit Exclusions

Do not do any of the following as part of this implementation:

- Do not design TypeORM migration files.
- Do not create migration files.
- Do not create migration or backfill scripts.
- Do not run database migrations.
- Do not change production TypeORM `synchronize` behavior.
- Do not run a real LAN scan.
- Do not publish to real device-control MQTT topics.
- Do not run a production deployment.
- Do not introduce Vault, KMS, AES, or a credential-reference abstraction.
- Do not add manual scan CIDR or network-interface environment variables.
- Do not add `searchMsgId` to the public auto-register request.
- Do not add generic `status`, `requestIndex`, or `assignmentStatus` fields to the
  frontend search response.
- Do not expose MAC addresses, IP addresses, camera credentials, ports, or stream
  secrets to the frontend.

The user will add production database migrations later. Application entities,
repositories, mappings, services, DTOs, and contracts may be implemented now, but the
management schema will not be production-deployable until the user adds migrations.

## Confirmed Business Decisions

- The feature spans all four target repositories.
- NVR MQTT config topics include both tenant ID and NVR ID.
- NVR readiness requires active and connected state. There is no NVR HAT check.
- Search is asynchronous and gateway-compatible.
- Auto-register frontend selection uses generated camera inventory serial numbers.
- MAC addresses are transport-only and never cross the browser boundary.
- Camera username/password remain plaintext in Admin, Cloud, and Fog by explicit user
  decision.
- Credentials remain internal and are persisted only after auto-register, not after
  auto-search.
- Fog scans automatically derived physical Ethernet NIC networks. No manual scan scope
  environment is used.
- Unknown LAN MAC addresses are skipped and do not fail the whole search.
- A management catalog MAC match is sufficient search eligibility.
- ONVIF/RTSP evidence is diagnostic/readiness evidence, not enrollment authorization.
- Registration is serialized per NVR and idempotent.
- Fog applies camera changes first; Cloud mirrors only successful Fog results.
- One physical camera may have only one active or reserved NVR assignment.
- Fog persists camera IP privately; Admin and Cloud do not persist it.
- Fog deployment assets are added in `fog-surveillance-camera` with host networking,
  pinned/controlled nmap, and only the capabilities proven necessary.

## Domain Model

Use these management entities:

```text
CameraModel
RegisteredCamera
NvrCameraRegistration
```

Do not name a third-party camera `ManufacturedCamera`. Sanaw does not manufacture these
units. Preserve the designed/manufactured structural separation without using
incorrect provenance terminology.

### CameraModel

Represents reusable product/model metadata.

Minimum responsibilities:

```text
id
productModel
hasPtz
hasAudio
createdAt
updatedAt
```

Add vendor/manufacturer or protocol-profile fields only when required by existing data
or the minimal auto-search/register flow. Avoid unrelated catalog expansion.

### RegisteredCamera

Represents one physical third-party camera known to Sanaw inventory.

Minimum responsibilities:

```text
id
inventorySerialNumber
macAddress
username
password
port
streams
cameraModel relation
createdAt
updatedAt
```

Invariants:

- `inventorySerialNumber` is generated by Sanaw.
- It is exactly 8 uppercase alphanumeric characters.
- It is unique.
- `macAddress` is normalized and unique.
- Username and password belong to the physical camera.
- Username and password remain plaintext for now.
- Credentials must be excluded from frontend responses, logs, errors, scanner results,
  and MQTT acknowledgements.

If a real vendor serial is introduced later, name it separately, such as
`manufacturerSerialNumber`. Never call the generated Sanaw value a manufacturer
serial.

### NvrCameraRegistration

Represents assignment of a physical camera to an NVR/workspace.

Minimum internal states:

```text
RESERVED
ACTIVE
RELEASE_PENDING
RELEASED
```

Invariants:

- One registered camera can have at most one active or reserved NVR assignment.
- Reservation prevents two workspaces from registering the same camera concurrently.
- Reservation happens before Fog mutation.
- Reservation is a safety lock, not Cloud camera persistence.
- Fog applies local camera changes before Cloud mirrors them.
- Assignment becomes active after required Fog and Cloud work succeeds.
- Assignment state remains internal and is not included in frontend search responses.

## Credential Rules

Plaintext credential storage is an explicit accepted limitation for this iteration.

The required lifecycle is:

1. Admin stores each registered camera username/password in plaintext.
2. Management search returns credentials only over trusted internal service
   communication to Cloud.
3. Cloud stores the full result only in its private 30-minute search cache.
4. Auto-search does not persist newly discovered cameras in Cloud or Fog.
5. After the user selects cameras and calls auto-register, Cloud sends the selected
   full internal records through the authenticated Fog config retrieval channel.
6. Fog persists credentials for successful additions.
7. Cloud mirrors successful Fog additions and persists credentials.

Never include credentials in:

```text
Frontend HTTP responses
Frontend WebSocket responses
Fog MQTT acknowledgements
Scanner responses
Normal application logs
Error messages
Actor-log message text
System-log message text
```

Do not log raw management search responses or queued auto-register payloads.

## Public Cloud HTTP Contracts

### Auto-Search

Use gateway-compatible asynchronous behavior:

```http
GET /video-devices/nvrs/:id/auto-search
HTTP 202 Accepted
Response body: "<search-msg-id>"
```

Cloud validates:

```text
NVR exists
NVR is active
NVR is connected
Caller has the camera/device management role
No conflicting search/register operation is running for the NVR
```

Use the established camera-management role, likely
`EmployeeRoles.Camera_RuleChain_Dashboard`, after verifying existing conventions.

Remove the current HAT readiness check. `isHatConnected` is not part of the NVR domain
or persistence model and currently rejects normal NVRs.

### Auto-Register

```http
POST /video-devices/nvrs/auto-register
HTTP 202 Accepted
```

Request DTO:

```ts
{
  nvrId: string;
  addedCameras: string[];
  deletedCameras: string[];
}
```

Both arrays contain 8-character uppercase Sanaw camera inventory serial numbers.

The DTO must not validate these fields as MAC addresses.

Do not add `searchMsgId` to this request. Auto-register uses the latest valid private
search cache for the NVR, matching the gateway workflow.

## Search Correlation And Cache

The SEARCH `msgId` remains necessary internally. It is not required in the public
auto-register body.

Use it to:

```text
Correlate the Fog response with the pending queue message
Validate the NVR running config
Reject duplicate or unsolicited MQTT responses
Remove the correct queue message after processing
Unlock runningConfigs.search
Send the final WebSocket metadata.msgId
```

`nvr.runningConfigs.search` exists only while search is in progress. It is not the
stored search result.

After successful processing:

```text
Delete/unlock runningConfigs.search
Store latest private search data under the NVR cache key
Keep it for 1800 seconds
```

Use the existing NVR-scoped key unless a concrete repository constraint requires a
minimal rename:

```text
autoSearchNvr-{nvrId}
```

A newer successful search replaces the old cache. A terminal auto-register result
invalidates the search cache and related camera-name cache.

## Canonical MQTT Topics

```text
Cloud to Fog:
{tenantId}/{nvrId}/videoDevice/Config/pub

Fog to Cloud:
{tenantId}/{nvrId}/videoDevice/Config/sub
```

The `Config` capitalization is intentional and must match on both sides.

Cloud already follows the tenant-plus-NVR structure. Fog currently uses only NVR ID and
must be updated.

Fog still needs trusted tenant identity for topic construction. This is unrelated to
network scan scope. The scan itself must not require a configured CIDR or NIC.

## Cloud-To-Fog Trigger And Config Fetch

Cloud stores the complete configuration in its queue but publishes only the opaque
string `msgId` over MQTT:

```text
payload: "<opaque-msg-id>"
```

Do not convert `msgId` to a number.

Fog receives the string and retrieves the complete queued configuration from Cloud over
authenticated HTTP.

Add or complete:

```http
POST /fog-communication-manager/configs
```

Request body:

```ts
{
  serialNumber: string;
  accessToken: string;
  msgId: string;
  configType: 'videoDevice';
}
```

Cloud must authenticate the NVR before queue lookup.

Authorization invariant:

```text
Submitted serialNumber resolves to an NVR
Submitted accessToken matches that NVR
Queued tenantId equals authenticated NVR tenantId
Queued nvrId equals authenticated NVR id
Queued entityId equals authenticated NVR id
Queued entityType equals NVR
Queued configType is SEARCH or REGISTER
```

An opaque `msgId` is correlation, not authorization.

Externally, wrong credentials, wrong NVR, missing/expired msgId, and cross-NVR access
should not reveal sensitive distinctions.

Return only the protocol-required config. Do not return actor props, retry policy,
internal MQTT topics, or unnecessary queue metadata.

## Minimal Fog Search Response

Fog-to-Cloud SEARCH payload:

```ts
{
  msgId: string;
  macAddresses: string[];
}
```

Do not add:

```text
status
configType
tenantId
nvrId
requestIndex
assignmentStatus
IP addresses
scanner evidence
```

Cloud derives config type from the pending queue record and tenant/NVR identity from the
topic, then verifies both against the pending record and persisted NVR.

A successful scan with zero discovered devices sends:

```json
{
  "msgId": "...",
  "macAddresses": []
}
```

If scanning fails operationally:

- Do not send a successful empty result.
- Keep the Cloud queue message pending.
- Let the existing queue policy retry SEARCH.
- On final expiry, use the existing unlock and system-log failure path.

This distinguishes a valid empty network from a scanner failure without adding a
generic status field.

## Cloud MQTT Response Admission Order

Create an NVR video-device config MQTT controller listening on the NVR config response
topic.

Required processing order:

1. Parse the MQTT topic.
2. Require the exact tenant/NVR config topic shape.
3. Parse JSON.
4. Validate the payload with a runtime DTO before side effects.
5. Read the pending queue message without deleting it.
6. Reject unknown, duplicate, expired, or unsolicited msgIds.
7. Require topic NVR ID to equal queued NVR ID.
8. Load the NVR.
9. Require topic tenant ID to equal persisted NVR tenant ID.
10. Require queued tenant, NVR, entity, and config identities to match.
11. Acquire per-NVR serialization.
12. Recheck pending/idempotency state while serialized.
13. Process SEARCH or REGISTER.
14. Delete/ack the queue record only after successful processing.
15. Unlock the running config.
16. Emit the sanitized WebSocket result last.

Do not copy controller patterns that delete queue entries before ownership validation
and business processing.

Malformed or cross-NVR responses must cause no queue deletion, database mutation, or
WebSocket response.

## Management Camera Search

The current live facade route is:

```http
POST /video-devices/manufactured-nvrs/search
```

Use the live route, not obsolete routes such as:

```text
/get-auto-scan-all-cameras-information
/get-auto-register-information
```

The trusted internal management response may contain:

```text
inventorySerialNumber
productModel
username
password
macAddress
port
streams
hasPtz
hasAudio
internal assignment data required for validation/reservation
```

The Cloud frontend formatter must redact all sensitive fields.

### Unknown MAC Behavior

The current admin gRPC service throws when any MAC is unknown. Replace that behavior:

- Return recognized registered cameras.
- Skip unknown MACs.
- Do not fail the complete search because one or more MACs are unknown.
- Do not send unknown MAC details to the frontend.
- Aggregate unknown counts may be used internally but are not required in the browser
  DTO.

### Management Authorization

Restrict NVR camera search and reservation to the Workspace API-key caller type.

A Gateway or GSM access token must not authorize NVR camera inventory operations.

Use workspace identity derived from validated API credentials. Do not trust a workspace
ID supplied by the browser.

Admin must verify that the target manufactured NVR belongs to that workspace before
returning registration material or allowing a camera reservation.

## Camera Recognition Rule

An open port does not identify or authorize a camera.

| Evidence | Meaning |
| --- | --- |
| Port 80/443 | Generic web service |
| Port 554/8554 | RTSP/media endpoint; may be camera, NVR, encoder, or media server |
| Port 8000 | Vendor-dependent and widely reused |
| MAC OUI | Vendor hint only |
| ONVIF response | Strong video-device evidence but may be NVR/encoder |
| RTSP response | Confirms media service, not ownership |
| Management catalog MAC match | Authoritative eligibility for this workflow |

Confirmed rule:

```text
A management catalog MAC match is sufficient to show a sanitized candidate.
ONVIF/RTSP evidence is diagnostic/readiness evidence, not authorization.
```

A catalog camera remains visible even when ONVIF or RTSP probing fails.

## Fog Scanner Scope

Do not require manual scan CIDR or interface configuration.

Fog automatically identifies active physical Ethernet NICs at runtime and derives each
directly connected IPv4 network from NIC address and netmask.

Requirements:

- Detect active, non-loopback physical Ethernet NICs.
- Exclude Wi-Fi interfaces.
- Exclude Docker bridges and other virtual bridges.
- Exclude `veth` interfaces.
- Exclude loopback.
- Exclude inactive interfaces.
- Derive exact network CIDR from IPv4 address and contiguous netmask.
- Scan only directly connected Ethernet networks.
- If multiple physical Ethernet NICs are active, scan each network and deduplicate by
  normalized MAC.
- Do not default every network to `/24`.
- Do not scan only `.10` through `.254`.
- Do not skip valid `.1` through `.9` addresses.
- Exclude only network address, broadcast address, the Fog host address, and concrete
  safety exclusions.
- Enforce an internal hard host-count limit to prevent accidental unbounded `/16` or
  larger scans.
- If a derived network exceeds that limit, fail the scan clearly rather than silently
  truncating or scanning an arbitrary subset.

No environment variable should specify scan CIDR or network interface.

## Fog Scanner Stages

Use this sequence:

1. Inspect active physical Ethernet NIC addresses.
2. Read the passive neighbor table for existing IP/MAC observations.
3. Send ONVIF WS-Discovery probes bound to each Ethernet NIC.
4. Run pinned/controlled nmap ARP host discovery on each exact derived network.
5. Parse machine-readable nmap XML.
6. Merge observations by normalized MAC.
7. Reject ambiguous IP/MAC conflicts.
8. Return normalized MAC addresses to Cloud.
9. Retain the IP/MAC mapping privately in Fog for subsequent registration.
10. Optionally perform bounded ONVIF or RTSP readiness checks after catalog
    authorization.

### Nmap Process Safety

Use `execFile` or `spawn` with:

```text
shell: false
fixed executable
fixed flags
validated detected interface
validated derived CIDR
stdout size limit
stderr size limit
abort support
```

Conceptual invocation:

```text
nmap
-sn
-PR
-n
-e <detected-interface>
--max-retries 1
--host-timeout 1s
-oX -
<derived-cidr>
```

Do not parse human-readable nmap output. Do not start hundreds of ping subprocesses.
Do not treat missing nmap, permission failure, timeout, and zero discovered devices as
the same outcome.

## Fog Deployment Assets

`fog-surveillance-camera` currently has no Dockerfile or Compose deployment assets.
Add reviewed production deployment assets in that repository.

Requirements:

- Pinned base image.
- Pinned or controlled nmap package version.
- Application runs as non-root.
- Host networking for Ethernet L2 visibility.
- Add only `CAP_NET_RAW` unless a proven operation requires another capability.
- Do not use privileged mode.
- Do not add `CAP_NET_ADMIN` without a demonstrated need.
- Supply trusted tenant identity for MQTT topics.
- Preserve existing NVR identity/credentials and infrastructure configuration.
- Add startup preflight for nmap availability and scanner capability.
- Fail clearly when scanner prerequisites are not available.

Do not execute a real scan during implementation tests or verification.

## Fog-Only Camera IP

Persist camera IP only in Fog.

Requirements:

- Add a Fog-only `ipAddress` field or dedicated Fog network-binding model.
- Validate it as IPv4.
- Bind it to the registered camera/MAC.
- Never send it to the browser.
- Never include it in Fog MQTT acknowledgement.
- Do not store it in Admin camera inventory.
- Do not store it in the Cloud camera aggregate.
- Refresh it by MAC after DHCP/IP changes.
- Reject ambiguous same-MAC/multiple-IP observations rather than guessing.
- Keep a previous binding as stale diagnostic state after scan failure instead of
  immediately deleting it.

A dedicated Fog-only network binding is preferable if it avoids contaminating shared
Cloud/Fog camera contracts. A Fog-only camera field is acceptable if it is the smallest
coherent implementation.

## Gateway-Compatible Public Search WebSocket

Do not add a generic status field, request index, or assignment status.

Target envelope:

```ts
{
  type: WebSocketTypes.CONFIG,
  data: {
    nvrId,
    videoDevices: [
      {
        addedCameras: [
          {
            productModel,
            serialNumber,
            name,
            hasPtz,
            hasAudio,
          },
        ],
        deletedCameras: [
          {
            id,
            serialNumber,
            productModel,
            name,
          },
        ],
      },
    ],
  },
  metadata: {
    configType: NvrWebSocketConfigTypes.SEARCH,
    msgId,
  },
}
```

Do not include:

```text
MAC address
IP address
Username
Password
Port
Raw streams
Scanner evidence
Assignment status
Request index
Generic status
```

### No-Changes WebSocket

Use the gateway-compatible message:

```ts
{
  type: WebSocketTypes.CONFIG,
  data: { nvrId },
  message: {
    msgKey: LanguageKeys.nvr.response.socket.allConnectedCamerasAreUpToDate,
  },
  metadata: {
    configType: NvrWebSocketConfigTypes.SEARCH,
    msgId,
  },
}
```

## Search Reconciliation

Cloud processing sequence:

1. Normalize and deduplicate Fog MACs.
2. Compare discovered MACs with cameras currently attached to this NVR.
3. Existing NVR cameras absent from a successful complete scan become deletion
   candidates.
4. Send new discovered MACs to management for catalog lookup.
5. Skip unknown catalog MACs.
6. Recognized catalog cameras not already registered to this NVR become addition
   candidates.
7. A camera active or reserved for another NVR must not be addable.
8. Generate display names using existing camera naming conventions.
9. Cache full recognized records privately for 30 minutes.
10. Emit only sanitized additions and deletions.

The private cache may contain:

```text
MAC
Inventory serial
Username/password
Port
Streams
Model and capabilities
Generated display name
Management camera ID
Internal assignment information
```

Never serialize the private cache object directly to WebSocket.

## Auto-Register Validation

Validation must:

- Require at least one addition or deletion.
- Reject duplicate inventory serials.
- Require an unexpired NVR search cache.
- Require every addition to exist in cached addable results.
- Require every deletion to exist under this NVR and in cached deletion candidates.
- Reject a camera belonging to another NVR.
- Recheck central assignment immediately before reservation.
- Recheck current Cloud state before dispatch.
- Calculate capacity as:

```text
current camera count
- selected valid deletions
+ selected valid additions
<= nvr.maxCameras
```

Do not preserve the current incorrect calculation that ignores selected deletions.

Build internal camera creation data from the private cache. The frontend never supplies
MAC, credentials, port, IP, or stream configuration.

## Auto-Register Serialization And Idempotency

Process one auto-register batch at a time per NVR.

Do not use detached `setTimeout()` scheduling.

Do not preserve unrestricted non-locking REGISTER behavior from the gateway.

Use durable per-NVR coordination and idempotency. A practical minimal design is one
REGISTER config per HTTP request, containing selected additions and deletions. Fog
processes individual camera records serially inside the batch.

Use the config `msgId` as the batch idempotency key.

Fog must store a processed result before publishing acknowledgement.

Duplicate delivery of the same `msgId`:

- Must not rescan.
- Must not recreate cameras.
- Must not repeat deletions.
- Must republish the stored acknowledgement.

Cloud duplicate callback processing must be a no-op after successful consumption.

## Central Assignment And Fog-First Mutation

### Addition

1. Cloud validates the selected inventory serial against private search cache.
2. Cloud requests central `NvrCameraRegistration` reservation.
3. Management atomically rejects another active/reserved NVR assignment.
4. Cloud queues one serialized REGISTER batch.
5. Fog fetches the full config.
6. Fog resolves selected camera MAC to its private discovered IP.
7. Fog creates local camera data, including credentials and Fog-only IP.
8. Fog stores the batch result durably.
9. Fog publishes acknowledgement.
10. Cloud applies only successful Fog additions using the same stable aggregate ID.
11. Cloud persists credentials.
12. Cloud applies existing MQTT ACL/topic side effects through established commands.
13. Management marks successful reservations ACTIVE.
14. Management releases failed/unregistered reservations.
15. Cloud invalidates private search cache.
16. Cloud emits sanitized completion.

### Deletion

1. Cloud validates the camera belongs to this NVR.
2. Management marks assignment RELEASE_PENDING.
3. Fog idempotently removes local camera state and Fog-owned dependencies.
4. Already-absent Fog camera counts as successful idempotent deletion.
5. Fog publishes acknowledgement.
6. Cloud idempotently executes its existing `DeleteCameraCommand`.
7. Cloud removes Cloud-owned dependencies, running configs, logs, and MQTT ACL/topic
   state through existing behavior.
8. Management marks assignment RELEASED.
9. Cloud invalidates search cache.
10. Cloud emits sanitized completion.

Fog-first means Fog applies camera persistence before Cloud camera persistence. Central
reservation before Fog is only a concurrency/ownership guard.

## Minimal Fog Register Acknowledgement

Keep the response small and compatible with the gateway approach:

```ts
{
  msgId: string;
  unRegisteredCameraSerialNumbers: string[];
}
```

Cloud retains the intended add/delete plan in the pending queue record.

Semantics:

- Selected additions not listed as unregistered succeeded on Fog.
- Listed additions must not be persisted in Cloud.
- Deletion is idempotent; an already-absent Fog camera is successfully deleted.
- Operational failure should not produce a successful acknowledgement; leave the
  message retryable.

Do not include credentials, MACs, IPs, streams, or generic status.

## Public Auto-Register WebSocket

Return sanitized results only:

```ts
{
  nvrId: string;
  addedCameras: SanitizedCameraDto[];
  deletedCameras: SanitizedCameraDto[];
  unRegisteredCameraSerialNumbers: string[];
}
```

Metadata:

```ts
{
  configType: NvrWebSocketConfigTypes.REGISTER;
  msgId: string;
}
```

Public camera fields must exclude MAC, IP, username, password, port, and raw stream
configuration.

## Current Cloud Defects

Primary files:

```text
src/modules/videoDevices/applicationService/services/http/nvr.http.service.ts
src/modules/videoDevices/applicationService/services/validators/nvr.validator.ts
src/modules/videoDevices/domain/nvr/nvr.entity.ts
src/modules/videoDevices/domain/nvr/nvr.type.ts
src/modules/videoDevices/videoDevices.module.ts
```

Known defects:

- No NVR HTTP controller exists.
- `NvrsHttpService` is not provider-wired.
- No NVR MQTT config response controller exists.
- `NvrConfigs.SEARCH` has no `generateFogConfig()` case.
- Auto-register calls a missing validator method.
- `AutoRegisterNvrWsResponseDto` is used without import.
- Duplicate incompatible `AutoRegisterFullContent` types exist.
- Request DTO uses MACs while validator helpers treat values as serials.
- Delete validation is not scoped safely by NVR.
- Capacity validation ignores planned deletions.
- Search cache has no writer/TTL.
- Management client uses obsolete routes.
- HAT readiness check is invalid.
- Existing WebSocket types risk using camera response shapes containing MAC.
- `VideoDevicesModule` service/controller arrays are empty.
- Verify and repair the root module import graph before assuming VideoDevices is
  reachable.

## Current Fog Defects

Primary files:

```text
src/modules/videoDevices/domain/nvr/nvr.entity.ts
src/modules/videoDevices/domain/nvr/nvr.type.ts
src/modules/videoDevices/videoDevices.module.ts
src/modules/shared/getFogConfigFromCloud.ts
src/modules/dashboard/controllers/page.mqtt.controller.ts
src/modules/dashboard/applicationService/services/dashboardCloudCommunicationService.ts
```

Known defects:

- Config topics omit tenant ID.
- No NVR video-device config MQTT controller exists.
- No SEARCH/REGISTER dispatcher exists.
- No suitable typed Cloud config client exists for video devices.
- Generic helper uses wrong `GATEWAY_*` variables.
- Generic helper converts msgId to a number.
- Generic helper can leave promises unresolved.
- No scanner or ONVIF discovery exists.
- No nmap runtime dependency exists.
- No operation ledger or per-NVR serialization exists.
- No auto-register acknowledgement publisher exists.
- No Fog-only camera IP persistence exists.
- Camera natural-key indexes are missing.
- Current camera update path cannot safely update registration metadata.
- VideoDevices MQTT controller wiring is empty.
- No deployment Dockerfile/Compose assets exist.

Use the page config flow only as a raw-msgId/fetch-config architecture reference. Do not
copy numeric msgId conversion or unsafe queue behavior.

## Gateway Scanner Behaviors Not To Copy

From `gateway-backend-v2/src/modules/devices/infra/ethernet/ethernetScanner.service.ts`:

- Ping fallback assumes `/24`.
- Ping fallback scans only `.10` through `.254`.
- Valid `.1` through `.9` addresses are skipped.
- Up to 245 ping subprocesses start concurrently.
- ICMP-blocked devices are missed.
- ARP fallback is sequential.
- Nmap human-readable output is parsed.
- Parser assumes the MAC appears on the next line.
- Missing nmap and timeout become an empty result.
- All scanner failures become empty success.
- Interface selection relies on fragile names only.
- Duplicate/conflicting MAC/IP mappings are not handled.
- Production gateway image does not actually provision nmap/ping/arp.
- Production backend lacks `CAP_NET_RAW`.

Preserve only the safe principle of no shell interpolation (`execFile`/argv).

## Expected Management Changes

In `admin-api-v2`, focus on:

```text
src/videoDevices/cameras/**
src/videoDevices/nvrs/grpc/**
src/videoDevices/videoDevices.module.ts
src/shares/database.config.ts
protos/manufacturedNvr.proto
```

Required behavior:

- Add CameraModel/RegisteredCamera/NvrCameraRegistration application entities and
  persistence mappings.
- Generate 8-character inventory serials server-side.
- Keep username/password per registered camera.
- Add partial MAC search.
- Add reservation, activation, release-pending, and release application operations.
- Enforce one active/reserved NVR per camera in application logic and database mappings
  where possible without migration work.
- Return full internal records only to authorized Workspace-scoped callers.
- Do not expose credentials through ordinary browser/admin list APIs.
- Do not create migration artifacts.

In `workspacesAndGatewaysAdminApi`, focus on:

```text
src/videoDevices/nvrs/**
src/shares/auth.guard.ts
protos/manufacturedNvr.proto
```

Required behavior:

- Mirror the gRPC contract exactly.
- Restrict NVR camera operations to Workspace API keys.
- Forward trusted workspace identity.
- Preserve partial recognized results.
- Preserve full internal camera data for trusted Cloud communication.
- Avoid exposing this credential-bearing internal contract to browser management APIs
  without sanitization.

Both handwritten proto copies must remain synchronized. Use only additive protobuf
field numbers; never reuse existing tags.

## Expected Cloud Changes

Likely implementation areas:

```text
src/modules/videoDevices/controllers/nvr.http.controller.ts
src/modules/videoDevices/controllers/videoDeviceConfigs.mqtt.controller.ts
src/modules/videoDevices/applicationService/services/http/nvr.http.service.ts
src/modules/videoDevices/applicationService/services/validators/nvr.validator.ts
src/modules/videoDevices/applicationService/services/nvrAutoProvisioning.service.ts
src/modules/videoDevices/applicationService/services/runningConfigs/nvrRunningConfig.service.ts
src/modules/videoDevices/applicationService/services/queues/videoDeviceConfig/videoDeviceQueue.service.ts
src/modules/videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service.ts
src/modules/videoDevices/contracts/nvr/**
src/modules/videoDevices/domain/nvr/nvr.entity.ts
src/modules/videoDevices/domain/nvr/nvr.type.ts
src/modules/videoDevices/domain/videoDeviceFogMessage.type.ts
src/modules/videoDevices/videoDevices.module.ts
src/extensions/sanawApi/services/sanawApiVideoDevice.service.ts
```

Keep controllers thin. Do not place catalog calls, reconciliation, persistence, cache,
and WebSocket formatting directly in the MQTT controller.

## Expected Fog Changes

Likely implementation areas:

```text
configs/app.config.ts
src/modules/videoDevices/controllers/videoDeviceConfigs.mqtt.controller.ts
src/modules/videoDevices/applicatonService/services/videoDeviceCloudConfig.service.ts
src/modules/videoDevices/applicatonService/services/nvrAutoProvisioning.service.ts
src/modules/videoDevices/infra/networkScanner/**
src/modules/videoDevices/contracts/mqtt/**
src/modules/videoDevices/domain/nvr/nvr.entity.ts
src/modules/videoDevices/domain/nvr/nvr.type.ts
src/modules/videoDevices/domain/camera/**
src/modules/videoDevices/infra/camera/**
src/modules/videoDevices/videoDevices.module.ts
deployment/prod/**
```

The repository uses the misspelled path `applicatonService`. Match real paths unless a
separate repository-wide correction is explicitly requested.

## Required Tests

Follow the Sanaw testing standard and each repository's test layout.

### Admin Tests

- Inventory serial is exactly 8 uppercase alphanumeric characters.
- Serial collision handling is safe.
- Registered camera MAC is unique.
- Camera model relation works.
- Unknown MACs are skipped.
- One unknown MAC does not fail recognized results.
- Trusted internal response includes required credentials.
- Credentials are absent from public/admin responses where not required.
- Concurrent reservations for one camera allow only one NVR.
- Active/reserved camera is unavailable to another workspace.
- Release permits later reassignment.

### Facade Tests

- Workspace API key is accepted.
- Gateway API key is rejected for NVR camera search/reservation.
- GSM API key is rejected.
- Trusted workspace identity is forwarded.
- Mirrored proto includes inventory serial and internal registration data.
- Unknown MAC behavior remains partial.
- gRPC errors map correctly to HTTP errors.

### Cloud Tests

- SEARCH config generation succeeds.
- SEARCH topic includes tenant ID and NVR ID.
- Active/connected readiness checks execute.
- No HAT check remains.
- Auto-register accepts inventory serials rather than MACs.
- Missing/expired search cache rejects auto-register.
- Capacity subtracts selected deletions.
- Addition must exist in private search cache.
- Deletion must belong to the same NVR.
- Management receives MACs but frontend does not.
- Browser search output contains no MAC, IP, username, password, port, streams,
  status, requestIndex, or assignmentStatus.
- Topic tenant mismatch is rejected before queue consumption.
- Topic NVR mismatch is rejected before queue consumption.
- Unknown msgId causes no side effects.
- Duplicate callback creates/deletes once.
- One register batch runs at a time per NVR.
- Successful register invalidates private search cache.
- No-change response uses the established translation key.

### Fog Tests

- Raw MQTT msgId remains a string.
- Topic includes tenant and NVR IDs.
- Cross-NVR config retrieval is rejected.
- Physical Ethernet detection excludes virtual, loopback, inactive, and Wi-Fi NICs.
- CIDR is derived correctly from NIC address/netmask.
- Safe non-`/24` networks work.
- `.1` through `.9` are not arbitrarily skipped.
- Oversized networks fail safely.
- Nmap uses no shell.
- Nmap XML parser tolerates valid field ordering/missing optional fields.
- Scanner failure differs from valid zero devices.
- ONVIF evidence does not replace catalog authorization.
- Open RTSP/HTTP port alone does not authorize a camera.
- MAC/IP conflicts are rejected.
- IP remains Fog-only.
- Duplicate REGISTER msgId replays stored acknowledgement.
- Add/delete operations are idempotent.
- Already-absent deletion succeeds.
- Credentials persist internally but do not appear in acknowledgements or logs.

### Contract And Integration Tests

- Both manufactured-NVR proto copies remain compatible.
- MQTT SEARCH response validates before side effects.
- MQTT REGISTER response validates before side effects.
- Full search handles known and unknown LAN MACs.
- Full add flow tolerates duplicate MQTT delivery.
- Fog success followed by Cloud retry does not recreate the Fog camera.
- Two workspaces racing for one camera produce one reservation winner.
- Browser-facing serialization contains no private camera fields.

Use fake scanner/process adapters in tests. Never execute nmap against the real network.

## Verification

Confirm package scripts before running commands. Some lint scripts mutate files with
`--fix`, which is unsafe to run blindly in dirty repositories.

Typical final gates:

```text
admin-api-v2:
npm run build
npm test -- --runInBand
focused integration tests when Docker prerequisites are available

workspacesAndGatewaysAdminApi:
npm run build
npm test -- --runInBand
focused adapter/E2E tests

cloud-surveillance-camera:
npm run build
npm test -- --runInBand

fog-surveillance-camera:
npm run build
npm test -- --runInBand
```

Do not execute:

```text
TypeORM migrations
real nmap scans
real device-control MQTT publishes
production Compose startup
production deployment
```

## Implementation Checkpoints

1. Management CameraModel/RegisteredCamera/NvrCameraRegistration application model.
2. Management partial search and assignment reservation behavior.
3. Facade authorization and synchronized gRPC contract.
4. Cloud NVR HTTP/controller/validator/SEARCH generation wiring.
5. Cloud private search reconciliation and MQTT response validation.
6. Fog tenant-scoped topic and secure config-fetch wiring.
7. Fog scanner and Fog-only IP binding.
8. Fog serialized/idempotent auto-register mutation.
9. Cloud Fog-result persistence and assignment finalization.
10. Fog deployment assets.
11. Focused tests and all four builds.

If the implementation session grows too large, stop only at a built/tested checkpoint
and write a smaller remaining-work handoff.

## Definition Of Done

The implementation is complete only when:

- All four target repositories build.
- Focused tests pass.
- Cloud exposes working NVR auto-search and auto-register HTTP routes.
- Fog processes SEARCH and REGISTER.
- Tenant-scoped MQTT topics agree on both sides.
- Cloud serves queued configs only to the owning authenticated NVR.
- Fog scanner derives scope automatically from active physical Ethernet NICs.
- No manual scan CIDR/interface environment variable exists.
- Unknown LAN devices do not fail the complete search.
- Catalog MAC match controls candidate eligibility.
- Public search response remains gateway-compatible.
- Public auto-register uses camera inventory serial numbers.
- Public auto-register does not require `searchMsgId`.
- Public search has no generic status, request index, or assignment status.
- MAC and IP never reach the frontend.
- Credentials never reach frontend responses, logs, or acknowledgements.
- Auto-search caches credentials privately but does not persist new cameras.
- Auto-register persists selected successful cameras in Fog and Cloud.
- Fog persists camera IP privately.
- Registration is serialized and idempotent.
- One camera cannot be active or reserved for two NVRs.
- Fog applies local mutation before Cloud camera persistence.
- Queue messages are consumed only after identity validation and successful processing.
- No migration files, migration design, or migration tooling were added.
- No real scan, device-control publish, or production operation was run.
- No existing user changes were reverted or overwritten.
