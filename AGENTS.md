# AGENTS.md — cloud-surveillance-camera

NestJS 11 backend for Sanaw's cloud surveillance platform. Uses CQRS (`@nestjs/cqrs`), MongoDB (Mongoose), TDengine (time-series via `@tdengine/websocket`), Redis (BullMQ + caching), MQTT, WebSocket (socket.io), Keycloak auth. README is the stock NestJS starter — ignore it; this file is authoritative. This is the canonical, tool-agnostic reference; `CLAUDE.md` is a short pointer to it plus a few Claude-Code-specific notes.

## Commands

- `npm install` — install (runs husky via `prepare`).
- `npm run start:dev` — dev watch mode. **Runs `sudo kill -9` on any running nest process first**; use `npm start` if that's undesirable.
- `npm run test` — unit tests (`*.spec.ts` under `src/**/tests/`, jest `rootDir: src`). See "Test layout" for where a test file goes.
- `npm run test:e2e` — uses `test/jest-e2e.json` (separate config, `rootDir: test`, `*.e2e-spec.ts`).
- Single test: `npm run test -- path/to/file.spec.ts`.
- `npm run lint` — eslint **with `--fix`** (mutates files). ESLint flat config is NOT used — config is legacy `.eslintrc.js`.
- No separate typecheck script; typecheck via `npm run build` (`nest build`, output `dist/`).
- Commits: conventional commits enforced by husky `commit-msg` + commitlint (see git log, e.g. `feat(videoDevices): ...`). Branch: `develop` (default working branch), `master` for releases.
- Pre-commit hook (`husky` + lint-staged in `.lintstagedrc.json`): eslint --fix + prettier on staged `*.{ts,js}`.

## Environment & runtime prerequisites

- Config is **env-driven and strict**: `configs/app.config.ts` uses `env-var` with `.required()` on everything — the app crashes on boot if any var is missing.
- Env file is selected by `NODE_ENV`: `.env.${NODE_ENV}` (files: `.env.development`, `.env.production`, `.env.test`). All entrypoint scripts set `NODE_ENV` via `cross-env`.
- **Note:** `.env.test` sets `NODE_ENV=production` inside the file — don't rely on it reflecting real test values; keys listed there exist but many values are blank.
- External services expected when running the full app: MongoDB (:27017), Redis (:6379), EMQX/MQTT broker (:1883 + REST API :18083), TDengine, Keycloak. There is **no docker-compose in this repo** — infra must be provided externally. Tests must not implicitly require these unless they already do.
- `AppModule` connects to TDengine at boot via a top-level provider factory — providers/mocks for `TDENGINE_CLIENT` / `TDENGINE_RESTFULL_OPTIONS`/`TimeseriesRepository` are needed to boot the app in tests.

## Test layout

**One rule: a test lives under the nearest area's `tests/` root, at a path that mirrors the production file it covers.** Never colocate a `*.spec.ts` beside production code.

| Level | Location | Suffix | Config |
|---|---|---|---|
| Unit | `src/modules/<module>/tests/**` · `src/extensions/<extension>/tests/**` · `src/dddLib/tests/**`, `src/utilities/tests/**` | `*.spec.ts` | default `jest` block in `package.json` (`rootDir: src`) |
| Integration | `test/integration/**` (Testcontainers; none yet) | `*.int-spec.ts` | `test/jest-integration.json` (not created yet) |
| E2E | `test/**` | `*.e2e-spec.ts` | `test/jest-e2e.json` |
| Support | `test/support/**` (harness, factories, mocks) | — | — |

- **Mirroring:** `src/modules/videoDevices/applicationService/commands/nvr/updateNvr.command.ts` → `src/modules/videoDevices/tests/applicationService/commands/nvr/updateNvr.command.spec.ts`.
- **Where the `tests/` segment goes — the area root.** An *area* is one self-contained unit: a module (`src/modules/<module>/`), **an individual extension** (`src/extensions/<extension>/`), or a standalone library (`src/dddLib/`, `src/utilities/`). The `tests/` dir sits directly inside that unit, and everything below it mirrors the source path:
  - `src/extensions/caching/cache.service.ts` → `src/extensions/caching/tests/cache.service.spec.ts` (**not** `src/extensions/tests/caching/…` — there is no `src/extensions/tests/`).
  - `src/extensions/sanawApi/services/sanawApiVideoDevice.service.ts` → `src/extensions/sanawApi/tests/services/sanawApiVideoDevice.service.spec.ts`.
  - `src/dddLib/core/businessId.vo.ts` → `src/dddLib/tests/core/businessId.vo.spec.ts` — `dddLib` and `utilities` are each **one** area (their subfolders are layers, not units), so they get a single `tests/` root at the top.
- **Filename:** `<source basename>.spec.ts`. When one source file needs several test files, add a facet: `<source basename>.<facet>.spec.ts` (e.g. `fogCommunicationManager.service.restore.spec.ts`, `actorLog.timeseriesRepository.dropByActor.spec.ts`, `tenantAccess.commands.hardDeleteTenantEmployee.spec.ts` — that last source file holds several handlers).
- **Cross-cutting tests** (one invariant asserted across sibling sources — tenant scoping, credential redaction) sit in the **deepest shared mirrored directory** under a descriptive group name: `tests/applicationService/queries/pageTenant.queries.spec.ts`, `tests/domain/deviceCredentials.vo.spec.ts`. Don't split these into per-source files; the grouping is the point.
- Naming inside a file: `describe('<unit under test>')`, `it('rejects <X> when <Y>')` — behavior first.
- Full standard (mocking policy, Testcontainers harness, coverage ratcheting): the shared Sanaw `testing` skill.

## Architecture

### System at a glance

- A NestJS **monolith** (not microservices-per-module) implementing Sanaw's cloud surveillance backend: manages NVRs/cameras at tenant sites, receives fog-edge telemetry/config over MQTT, stores time-series logs in TDengine, keeps tenant/employee data in MongoDB, pushes live updates over WebSocket, and calls out to sibling Sanaw microservices (employee/identity, notification, device-registry) over HTTP.
- Every module follows DDD/hexagonal layering (see "Module map"), built on shared base classes in `src/dddLib/` (see "dddLib" below).
- Multi-tenant with **shared infrastructure** — one Mongo DB, one Redis instance (2 logical DBs), one BullMQ, one EMQX broker, one TDengine DB, one Keycloak realm. Per-tenant infra was deliberately rejected; isolation is enforced entirely in application code (see "Multi-tenancy isolation strategy"). Full rationale: `MULTI_TENANCY_IMPLEMENTATION_PLAN.md`.
- CQRS via `@nestjs/cqrs`, but only `CommandBus`/`QueryBus` are used — `EventBus` is not wired up anywhere (see "Communication between modules").

### Boot & shutdown order

`app.module.ts`'s import list is commented as if registration order = shutdown order, but the real source of truth is `ShutdownOrchestratorService`'s static `SHUTDOWN_PRIORITY` table (`src/extensions/shutdown/shutdown.service.ts`):

**WebSocket(1) → Scheduler(2) → Queue[\*](3) → MQTT(4) → Cache(5) → TDengine(6) → MongoDB(7)**

Every stateful extension registers a named handler; each gets a 25s timeout; handlers run **sequentially** in priority order regardless of import order. `main.ts` calls the orchestrator directly on `SIGTERM`/`SIGINT` (bypassing Nest's own shutdown hooks), and has a separate `uncaughtException`/`unhandledRejection` emergency path that force-closes without racing the graceful path.

### Module map (`src/modules/*`)

| Module | Purpose | Shape | Aggregate(s) | Infra | Exposes to other modules |
|---|---|---|---|---|---|
| `tenants` | Tenant lifecycle — the multi-tenancy root entity | full DDD | `TenantEntity` | Mongo, Redis cache | events `tenantCreated/Updated/Deleted` |
| `tenantAccess` | Employee identity/roles, "who may act in which tenant" | full DDD, **`@Global`** | employee entity, `verifiedTenantContext` | Mongo | `ActiveTenantGuard`, `EmployeeRolesGuard` — used repo-wide |
| `videoDevices` | NVRs & cameras — the core hardware domain, largest module | full DDD | `CameraEntity`, `NvrEntity` | Mongo, Redis, MQTT, BullMQ, WS | `VideoDevicesApiFor{Dashboard,FogCommunicationManager,Trash}Service` |
| `dashboard` | Per-NVR "page" layout/config screens | full DDD | `PageEntity` | Mongo, Redis, MQTT, BullMQ | `DashboardApiFor{FogCommunicationManager,RuleChains,VideoDevices}Service` |
| `fogCommunicationManager` | Fog-edge backup/restore handshake | **flat, no domain layer** | — | HTTP controller, MQTT/WS relay | — |
| `systemLogs` | Central system-event log + fog-triggered notification relay | partial DDD (append-only, no entity class) | — | TDengine | `SystemLogApiService` |
| `actorLogs` | Audit trail of employee actions | partial DDD (append-only, no entity class) | — | TDengine | `ActorLogApiService` |
| `smsNotifier` | Per-employee SMS-notification subscriptions | full DDD (note: `applicatoinService/` folder is a real typo) | `SmsNotifierEntity` | Mongo | `EmployeeApiForSystemLogsService` |
| `systemMonitor` | Health check (`GET /health`, excluded from auth middleware) | **flat** | — | TDengine ping | — |
| `trash` | Soft-delete recovery view across other modules | **flat** | — | — | calls `VideoDevicesApiForTrashService` |
| `shared` | Tenant-scoped VOs/DTOs + shared repository base, used by many modules | **not a Nest module** — plain folder, no `.module.ts`, imported directly | — | — | `tenantFilter`, `deviceMqttTopics`, `parent.repository.ts` |

Cross-module dependency style: a producer module exports a narrow `*ApiFor<Consumer>Service` facade; the consumer imports that module and injects the facade. This is a deliberate anti-corruption-layer convention — **never** reach into another module's repository or Mongoose schema directly. `videoDevices` → `systemLogs` is the one exception found (imports concrete `NvrSystemLogService`/`CameraSystemLogService` directly rather than going through a facade).

The documented `applicationService/contracts/domain/infra` shape (below) is the norm but not universal: `fogCommunicationManager`, `systemMonitor`, `trash` are flat integration/read-only modules; `actorLogs`/`systemLogs` skip `domain/entities` and Mongo entirely (append-only TDengine logs); `shared` isn't a wired module at all. Don't "fix" these to match the template — they're intentionally thin, not incomplete.

```
src/modules/<name>/
  applicationService/   # commands/, queries/, services/  (CQRS handlers)
  contracts/            # request/response DTOs (validate with class-validator)
  domain/                # entities, aggregates, events/, exceptions/
  infra/                 # mongoose schemas, repositories, mappers
  <name>.module.ts
```

### Extensions (`src/extensions/*` — cross-cutting, wired in `AppModule`)

| Extension | Purpose | Scope | Shutdown priority | Tenant-isolation hook |
|---|---|---|---|---|
| `shutdown` | Central ordered shutdown registry (see above) | registered first in `AppModule` | is the orchestrator | — |
| `websocket` | Socket.io gateway | imports `tenantAccess` | 1 | joins every socket to room `tenant:{tenantId}`; re-checks access per send on sensitive channels |
| `scheduler` | Durable cron/interval, built on BullMQ (not native timers) | — | 2 | first-class `namespace` option for tenant/scheduler-group isolation |
| `queue` | Generic BullMQ wrapper; one instance per named queue (`Scope.TRANSIENT`, shared static Redis connection) | — | 3 per queue (`Queue[<name>]`) | tenant scoping is caller-supplied (queue name / tenant-tagged job id) |
| `mqtt` | MQTT client (pub/sub) + EMQX admin REST API (per-NVR user/ACL provisioning) | `@Global` | 4 | topic string carries `tenants/{tenantId}/nvrs/{nvrId}/...` |
| `caching` | Redis cache + distributed lock, own Redis **db 2** | `@Global` | 5 | key-prefix based (not enforced by the extension itself) |
| `tdengine` | TDengine client + lifecycle/schema bootstrap | — | 6 | tenant isolation lives in `TimeseriesRepository` (supertable/tag), not here |
| `mongo` | Single Mongo connection; guards `connection.close()` so only the orchestrator can close it | — | 7 (always last — domain modules read from it during shutdown) | schema/query level, not here |
| `bootChecks` | Fail-closed boot assertions (`main.ts`): no test-env in prod, MQTT prod security, Redis `noeviction` policy | plain functions, not a module | — | — |
| `http` | Generic Axios wrapper: retry (3x on 5xx/network errors), request/response logging, error normalization | `@Global` | — | — |
| `sanawApi` | Typed clients to sibling Sanaw microservices (employee/notification/device-registry), auth via `Workspace-<key>` header | — | — | `tenantId` passed as `workstationId` upstream |
| `logger` | `nestjs-pino`; redacts auth headers/passwords/tokens; correlation-id from request headers | `@Global` | — | — |
| `serviceProvider` | Facade bundling `Serializer/UserInfo/Logger/EventEmitter2/CommandBus/QueryBus/Translator/Scheduler/Http` into one injectable — the de facto shared kernel, used as `this.serviceProvider.*` throughout infra services | `@Global` | — | — |
| `serialization` | `serialize/deserialize` interface | `@Global` | — | — |
| `translation` | i18n for user-facing strings (Arabic/English/Farsi/Kurdish) | via `serviceProvider` | — | per-recipient `lang` |
| `userInfo` | AsyncLocalStorage request-context accessor | `@Global` | — | **the tenant-propagation backbone** — `requireTenantId()` |
| `messanger` *(sic — real typo, keep as-is; do not rename)* | SMS/voice/email/Telegram dispatch | — | — | **stub** — all four methods just `console.log(body)`, not wired to any real provider (kavenegar/Telegram) despite them being expected external deps |

Three logically separate Redis "databases" share one instance: cache (`db 2`), BullMQ (`db 1`, `AppConfig().redis.db`), and an unallocated default (`db 0`) — deliberate, so a cache flush never touches queue data.

### `src/dddLib` — the shared DDD framework

Every module builds on these; don't reinvent them.

- **`core/`** — `Entity<VOs,Props>` (validates props in the constructor, `toObject()` recursively unwraps value objects for logging/testing); `AggregateRoot extends Entity` (buffers `DomainEvent[]`; `publishEvents(logger, eventEmitter)` — called by the repository after a successful write — fires each event via `EventEmitter2.emitAsync(EventClassName, event)`; **the event name is the class name**, not a static topic string); `ValueObject<T>` (structural equality via `JSON.stringify`); `BusinessId` (UUIDv4-validated id VO — the pattern modules follow for aggregate ids); `DomainEvent` (auto-generated `id`; `correlationId`/`causationId` default from the current request context, threading request tracing into events); `exceptions/` (`ExceptionBase` auto-attaches `correlationId` and serializes via `toJSON()`; concrete: `ArgumentInvalid/NotProvided/OutOfRange`, `Conflict`, `WrongState` (reuses the `CONFLICT` error code — a latent bug, not a distinct code), `NotFound`, `InternalServerError`).
- **`applicationService/`** — `Command` base (auto `id` + `metadata{correlationId,causationId,timestamp,userId}`, plus optional `actorProps: ActorDto` so actor identity flows into handlers for `actorLogs`); `QueryBase`/`PaginatedQueryBase` (default `limit 15`/`page 1`); `TimeseriesQueryBase`/`PaginatedTimeseriesQueryBase` (TDengine-flavored).
- **`infra/`** — `RepositoryBase<Entity>` (`insert/findById/findOne/findAll/update/delete`, optional `findAllPaginated`/cache-warm hook; **no optimistic-concurrency field** — concurrency control isn't part of the base contract, don't assume it exists); `Mapper<DomainEntity,DbRecord,Response>` (every module's mapper implements this to cross the domain/Mongoose boundary); `CacheBase<T>`; `TimeseriesRepositoryBase` (TDengine parallel of `RepositoryBase`; its `InsertDataParams` doc comment states table names are optional because *"tenant-isolated repositories derive them server-side from validated identity and ignore caller values"* — a multi-tenancy invariant baked into the base type).
- **`contracts/`** — `ResponseBase`, `PaginatedResponseDto`, `ApiErrorResponse` (Swagger-documented, includes `correlationId`), `PaginatedQueryRequestDto`, `DashboardPageProjection`.
- **`utils/`** — `RequestContextService` (AsyncLocalStorage-based; carries `requestId`, `user`, and **`tenant: VerifiedTenantContext`**; `requireTenantId()` throws `UnauthorizedException` if unset — this is how tenant id reaches deep call stacks without being threaded through every method signature); `Guard` (validation primitives — `isEmpty`, `isUUIDv4`, `isMacAddress`, `isPort`, etc. — used in every entity/VO `validate()`); `TimeSeriesDbExtension` (the *only* place allowed to build raw TDengine SQL / quote string literals — the SQL-injection guard for the time-series layer); `deviceMessageId.ts` (`buildDeviceJobId(tenantId, nvrId, msgId) = "t-{tenantId}-n-{nvrId}-m-{msgId}"` — the canonical tenant-scoped job/message id format shared by MQTT and BullMQ).

### Communication between modules

The primary in-process mechanism is **not** an event bus — it's explicit facades:

1. **`*ApiFor<Consumer>Service` facades (primary).** A producer module exports a narrow service named for its consumer (e.g. `VideoDevicesApiForDashboardService`, `EmployeeApiForSystemLogsService`); the consumer imports that module and injects the facade. See "Module map" above for the full list per module.
2. **Domain events — published, not (yet) consumed cross-module.** Every aggregate write publishes its `DomainEvent`s via `EventEmitter2.emitAsync`, but there are **zero** `@OnEvent` handlers anywhere keyed on a domain-event class name. Treat this as a scaffold (or in-module audit-trail hook), not an active cross-module pub/sub bus — don't assume publishing an event will trigger a handler elsewhere without adding one. `@nestjs/cqrs`'s own `EventBus` isn't used at all, only `CommandBus`/`QueryBus`.
3. **MQTT ↔ EventEmitter2 bridge.** `extensions/mqtt` is the sole MQTT client; inbound broker messages are re-emitted on the *same* `EventEmitter2` instance keyed by a topic-derived enum, and module controllers subscribe with `@OnEvent(SomeMqttTopicEnum.x)` (e.g. `videoDeviceConfigs.mqtt.controller.ts`, `page.mqtt.controller.ts`). Only topics with a live `@OnEvent` handler get subscribed at boot. Topic shape: `tenants/{tenantId}/nvrs/{nvrId}/{resource}/{to-fog|to-cloud}`, UUIDv4-validated segments (source of truth: `videoDevices`' `shared/deviceMqttTopics.ts`).
4. **BullMQ queues.** Each domain queue is its own injected `QueueService<T>` instance (not a fixed registry) — e.g. `videoDeviceConfigQueue`, `pageConfigQueue`. Job ids use the tenant-scoped `buildDeviceJobId()` format, so entries are tenant-tagged even though the queue itself is shared infra.
5. **WebSocket.** Tenant isolation = room membership: every authenticated socket joins `tenant:{tenantId}`; broadcasts only ever target that room; access is re-verified per send on sensitive channels (e.g. system-logs), force-disconnecting sockets that fail the check.
6. **HTTP out to sibling Sanaw services.** `sanawApi` (typed clients, `Workspace-<key>` auth) for known Sanaw platform services; the generic `http` extension for anything without a typed client yet.
7. **TDengine.** One shared database; tenant isolation is by supertable/tag + tenant-namespaced sub-table names (`ensureSuperTable(tenantId)`, `systemLogSubTableName(tenantId, type)`), not per-tenant databases.

### Multi-tenancy isolation strategy

Shared infrastructure everywhere (one Mongo, one Redis, one BullMQ, one Keycloak realm, one EMQX broker, one TDengine DB) was a deliberate platform decision — per-tenant infra was explicitly rejected (`MULTI_TENANCY_IMPLEMENTATION_PLAN.md`). Isolation is enforced by application-level controls instead:

1. Verified active tenant required on every synchronous operation (`RequestContextService.requireTenantId()`).
2. Explicit tenant id in every async message (queue jobs, MQTT topics).
3. Tenant-scoped role checks at controllers (`ActiveTenantGuard`, `EmployeeRolesGuard`).
4. Mandatory tenant filters on every tenant-owned persistence operation.
5. MQTT ACLs (per-NVR EMQX users) + app-level ownership checks.
6. Tenant-scoped WebSocket rooms.
7. Tenant tags/sub-tables in TDengine.
8. Two-tenant isolation tests expected at every boundary.

Central rule (quoted from the plan doc): *"Employee roles determine what an actor may do. The tenant ID in commands, queries, storage filters, topics, and messages determines whose data the operation may affect."*

## Quirks / gotchas

- tsconfig has **`noImplicitAny: false`** and `strictNullChecks: true` — don't enable stricter flags repo-wide; follow existing style.
- `typeRoots: ["./types"]` — custom global type declarations live in `types/`.
- Absolute-ish imports from project root work via `baseUrl: "./"` (e.g. `configs/app.config`).
- Known typos preserved as real paths/names: `src/extensions/messanger`, `cacheing.module.ts` — match imports to the actual filenames, don't "fix" them casually. (`smsNotifier`'s `applicatoinService/` folder **was** renamed to `applicationService/` — that one is done.)
- Dates use `jalali-moment` (Persian calendar); timezone `TZ=Asia/Tehran` in env files.
- `app.module.ts`'s "registration order = shutdown order" comment is misleading — the real order comes from `ShutdownOrchestratorService`'s static priority table (see "Boot & shutdown order").
- `messanger` extension is a stub (all four send methods just `console.log`) — before trusting that notifications actually go out, check whether `smsNotifier`/`systemLogs`' fog-notification path routes through it or implements its own integration.
- Domain events are published on every write but have no cross-module subscribers today — adding an `@OnEvent` handler elsewhere for an existing domain event is new wiring, not activating dormant wiring.
- `RepositoryBase` has no optimistic-concurrency (version/etag) field — concurrent-write races aren't guarded by the base contract; add your own if a module needs it.
