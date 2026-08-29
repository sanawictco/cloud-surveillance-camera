# MULTI_TENANCY Phase 1 — Session Handoff

> **Superseded in part (2026-08-29).** This is a point-in-time snapshot. Three
> items below were later changed: the startup employee migration was removed
> (fresh dev databases), system-log visibility is no longer `Report`-gated on
> HTTP or WebSocket (any active tenant member; `Report` reserved for future
> reporting), and the employee aggregate moved into `tenantAccess` while the old
> `employees` module became `smsNotifier`. Unit suite is now 208 tests, not 213.
> See the "Phase 1 Revision Note (2026-08-29)" in
> `MULTI_TENANCY_IMPLEMENTATION_PLAN.md` for the authoritative current state.

**Source session:** `ses_fc3b5f3edffevATtlUXbp2WZeI` ("Implement MULTI_TENANCY phase 1 in TypeScript")
**Service:** `cloud-surveillance-camera`
**Branch:** `develop` (last commit `cbfb78a feat(multi-tenancy): complete phase 0 containment`)
**Plan of record:** `MULTI_TENANCY_IMPLEMENTATION_PLAN.md`
**Status at handoff:** Phase 1 implemented, **uncommitted**, and now unit-qualified (build + tests + diff-check all green).

---

## 1. Goal of the session

Implement **only Phase 1** of `MULTI_TENANCY_IMPLEMENTATION_PLAN.md` — "Employee, Role, And Context" —
as clean, safe, simple, robust TypeScript. Explicit constraint from the user:

> clean code, safe and simple and robust typescript code (don't use complex types and utility types).

Phase 1 scope (from the plan):

- Add `tenantId` to `EmployeeModel`; employees are the **only** tenant-membership record.
- Unique `(tenantId, userId)` index.
- `GET /me/tenants`.
- Require + validate `X-Tenant-Id` for tenant HTTP APIs.
- Validate employee access directly from MongoDB per request (no cache races).
- Reuse tenant-scoped `EmployeeRoles` at controllers.
- Extend request context with verified tenant + employee fields.
- Add `tenantId` to all tenant-owned CQRS command/query contracts touched by HTTP.
- Remove `tenants[0]` assumption from NVR creation.
- Refactor employee removal to remove one tenant employee, not the global identity.

---

## 2. Key product decisions made during the session

These were explicitly agreed with the user and drove the simplification:

1. **No tenant plans, no feature arrays, no tenant roles.** All tenants have the same features;
   `EmployeeRoles` alone is sufficient for authorization. `plan` and `features` are stripped from
   the tenant on migration.
2. **Membership and Employee are merged into a single `Employee` record.** There is no separate
   membership collection. `EmployeeModel` is the tenant-membership record
   (`{ id, tenantId, userId, roles[], isDeleted, timestamps }`).
3. **Tenant ownership** derives from `TenantModel.ownerId`, not a synthetic employee role. The owner
   employee cannot be modified/removed as a normal employee.
4. **`tenantId` is forced (non-optional)** on tenant-owned system-log commands/queries. (Forcing
   `tenantId` on the remaining tenant-owned commands/queries was deferred to later phases — see §5.)
5. **Architectural rule (user-emphasized, applied):** application `*.service.ts` classes must **not**
   touch repositories directly — they may only forward to the CQRS layer (commands/queries).
   Repositories are injected **only** into command/query handlers (and infra lifecycle services).
6. **Fail-closed on bad legacy data:** startup migration must **throw** (block boot) on orphaned
   employee data, ambiguous shared-user SMS notifiers, or memberships referencing missing tenants —
   never auto-assign.

---

## 3. What was actually built (verified against the tree)

### New module: `src/modules/tenantAccess/` (Global module)

- `me.controller.ts` — `GET /me/tenants` (identity-scoped, no active tenant required).
- `applicationService/tenantAccess.service.ts` — thin **CQRS facade** over query/command buses
  (no repository access).
- `applicationService/queries/tenantAccess.queries.ts` — handlers:
  `ResolveActiveTenantAccess`, `FindMyTenants`, `FindEmployeesForTenant`, `FindEmployeeForUser`,
  `FindActiveEmployeeForUser`, `IsTenantOwner`, `TenantExists`, `FindAllActiveEmployeesAsSystem`.
- `applicationService/commands/tenantAccess.commands.ts` — handlers:
  `CreateTenantEmployee`, `CreateOwnerEmployee`, `UpdateTenantEmployeeRoles`,
  `SoftDeleteTenantEmployee`, `RecoverTenantEmployee`, `HardDeleteTenantEmployee`.
  Owner-employee protection lives in `requireMutableEmployee()`.
- `applicationService/employee.init.service.ts` — `OnApplicationBootstrap`; only **dispatches**
  `MigrateEmployeePersistenceCommand`.
- `applicationService/commands/migrateEmployeePersistence.command.ts` — command + handler delegating
  to the migration repository.
- `infra/employeeMigration.repository.ts` — the **startup migration** logic: backfill legacy
  employees (single-tenant only), migrate + drop `tenantMemberships`, normalize roles, strip
  `plan`/`features`, create owner employees, backfill legacy `smsNotifier` tenants, and fail closed
  on ambiguity/orphans.
- `infra/tenantAccess.repository.ts` — tenant lookups + `deleteSmsNotifier(tenantId, userId)`.
- `guards/activeTenant.guard.ts` — validates `X-Tenant-Id`: token, `sub`, tenant existence, tenant
  status, active employee for `(tenantId, userId)`, and stores a `VerifiedTenantContext`.
- `guards/employeeRoles.guard.ts` — tenant-scoped `EmployeeRoles` check using the active employee.
- `domain/verifiedTenantContext.ts`, `contracts/myTenant.response.dto.ts`.

### Removed (old employees layer — replaced by tenantAccess)

25 files deleted, including the entire old employee CQRS set (create/update/soft-delete/recover/
hard-delete/restore-to-cache commands, employee queries, `employee.entity.ts`, employee domain
events, `employee.mapper.ts`, `employee.service.ts`, `init.service.ts`, the
`apiForAnotherServices/*` employee adapters), and `src/modules/shared/roles.guard.ts`
(+ its spec) — replaced by the tenant-scoped `EmployeeRolesGuard`.

### Other tenant-scoping changes

- Employee schema gained `tenantId` + unique compound `(tenantId, userId)` index.
- SMS notifier records are now directly tenant-owned and repository-scoped.
- System-log writes/reads/counts/cleanup, SMS-notifier selection, and WebSocket delivery carry an
  explicit verified `tenantId` (partial Phase 4 / Phase 6 work pulled forward).
- `page.*` services refactored to the CQRS-only rule; atomic page unlock moved into
  `dashboard/applicationService/commands/unlockPageRunningConfig.command.ts`.
- `PageRunningConfigService` now dispatches `UnlockPageRunningConfigCommand` (no repo dependency).
- NVR creation no longer assumes `tenants[0]`.

**Diff size:** ~88 tracked files changed (~994 insertions / ~1781 deletions) plus new untracked
`tenantAccess/` module and 17 new `*.spec.ts` files.

---

## 4. Qualification status (re-verified this session)

The plan's Phase 1 gates:

| Gate | Result |
|---|---|
| `npm run build` | PASS (clean `nest build`) |
| `npm run test -- --runInBand` | PASS — **64 suites / 213 tests** |
| `git diff --check` | PASS |

**Fix applied this session:** the previous session left 3 unit-test files stale after services were
refactored into CQRS facades (they tested old constructors → `commandBus.execute is not a function`,
11 failures). They were rewritten to target where the logic actually moved, preserving all behavioral
assertions:

- `tenantAccess/tests/applicationService/employee.init.service.spec.ts` → now tests
  `EmployeeInitService` delegation **and** `EmployeeMigrationRepository.migrate()`.
- `tenantAccess/tests/applicationService/tenantAccess.service.spec.ts` → now tests the query/command
  handlers (`ResolveActiveTenantAccess`, `FindMyTenants`, `FindActiveEmployeeForUser`,
  `SoftDeleteTenantEmployee`).
- `dashboard/tests/applicationService/services/pageRunningConfig.service.spec.ts` → now tests the
  `commandBus`-based `doneAndUnLockConfig` flow (+ fail-closed on missing tenant, CREATE_PAGE short-circuit).

Also removed a stray junk file `et` (an accidental `git diff` capture) from the repo root.

> Integration/E2E against real TDengine/Mongo/EMQX were **not** run (no Docker/CI in this repo yet).
> Those remain part of the production-prerequisite list below.

---

## 5. Known gaps / deferred (do NOT assume these are done)

From the session's own analysis — inventory was **68 CQRS commands/queries**:

- **8** legitimately need no `tenantId` (tenant-catalog ops + globally-unique NVR serial).
- **4** bootstrap cache-restore commands are intentionally system-wide.
- **32 tenant-owned commands/queries still do NOT force `tenantId`** (actor logs, pages, NVRs,
  cameras) — these are corrected in **Phase 2/3**, not Phase 1. Only the **system-log** commands/queries
  force `tenantId` today.

Plan phases still open: **Phase 2** (Mongo + cache isolation — page `tenantId`, tenant-aware repo
contracts, `$and` filters, tenant cache prefixes, compound indexes; SMS-notifier tenant scoping
already `[x]`), **Phase 3** (async CQRS/queues/schedulers), **Phase 4** (WebSocket rooms — handshake
validation done, rooms + `sendTenantMessage` pending), **Phase 5** (MQTT topic/device isolation),
and later phases.

---

## 6. Production prerequisites before deploying Phase 1

1. **WebSocket clients must send `auth: { tenantId }`** on connect; old clients get disconnected.
2. **Single application replica only** — same-millisecond protection uses an in-process monotonic
   timestamp allocator; multiple replicas are not yet safe. Ensure NTP sync.
3. **Real TDengine validation** against the production version (stable creation, tenant tags,
   child-table creation, explicit-column inserts, tenant-filtered reads/counts, cleanup, SQL escaping).
4. **Legacy log decision** — old rows stay in `systemLogSuperTable`; tenant APIs read only
   `systemLogDetailV2`. Choose: backfill / archive / accept-hidden. Never expose unscoped legacy rows.
5. **MongoDB migration rehearsal** on a recent prod backup (memberships → existing tenants; notifiers
   map to exactly one tenant; no duplicate `(tenantId, userId)`; indexes build; owner employees created).
6. **Backup + rollback**: back up Mongo, preserve both system-log stables, verify rollback retains
   rows already written to `systemLogDetailV2`; do not drop either stable on first rollout.
7. **Staging smoke test** with two tenants + one shared user (cross-tenant read/count/delete denied;
   per-tenant roles/notifiers; non-`Report` employee gets no WS events; removal revokes immediately;
   page-queue expiry can't clear a newer op; NVR/camera deletion removes only matching-tenant logs;
   TDengine failure returns an observable error).
8. **Operational monitoring/alerts** on migration failures, ambiguous notifiers, WS tenant-authz
   failures, Mongo duplicate-key, system-log insert/cleanup failures, TDengine stable/child-table
   creation failures.

---

## 7. Immediate next actions

1. **Commit Phase 1** (nothing is committed yet). Suggested conventional-commit subject:
   `feat(multi-tenancy): phase 1 employee, role, and tenant context`. Review the deletions of the old
   employees layer in the diff before committing.
2. Update `MULTI_TENANCY_IMPLEMENTATION_PLAN.md` Phase 1 qualification note to reflect the corrected
   test count (**213 tests**) and that the stale specs were retargeted.
3. Run the production-prerequisite rehearsals in §6 before enabling a second tenant.
4. Begin **Phase 2** (Mongo + cache isolation).

---

## 8. Repo commands (from `AGENTS.md`)

- `npm run build` — typecheck (`nest build`).
- `npm run test -- --runInBand` — unit suite.
- `git diff --check` — whitespace/conflict-marker gate.
- Single test: `npm run test -- path/to/file.spec.ts`.
- Conventional commits enforced (husky + commitlint); lint-staged runs eslint --fix + prettier.
