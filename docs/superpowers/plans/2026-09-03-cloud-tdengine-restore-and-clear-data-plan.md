# Cloud-side TDengine Restore & Fog clearData Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fog's cloud-recovery process actually complete end-to-end: fix a real cross-repo schema bug in fog's exported actor-log statements, teach `cloud-surveillance-camera` to import the TDengine half of a fog backup (today it silently discards it), and only then wire fog's local `clearData()`-on-ack so it's safe to delete the local audit trail after a real, verified cloud import.

**Architecture:** No new subsystems. A small, targeted fix to an existing export method (fog), an extension to an existing archive-selection function (cloud), one new restore step on an existing service (cloud) that parses/validates/rebuilds/executes SQL statements rather than trusting fog's literal text, and a small wiring addition to an already-tested ack handler (fog).

**Tech Stack:** NestJS, TypeScript, Jest. Cloud-side unit tests are plain-mock Jest (no Testcontainers, no `jest-integration.json` exists in this repo — confirmed by reading its actual test suite and `package.json`). Fog-side tests follow the same plain-mock-Jest convention already established in that repo.

**Spec:** `fog-surveillance-camera/docs/superpowers/specs/2026-09-03-cloud-tdengine-restore-and-clear-data-design.md` (this plan implements its §2 through §8 in full; §9's rollout order is followed as this plan's task order).

## Global Constraints

- **Repo scope:** Task 1 and Task 5 touch `fog-surveillance-camera` only. Tasks 2-4 touch `cloud-surveillance-camera` only. No file outside these two repos.
- **Never trust fog's literal SQL text for table qualification or column order** — the cloud-side importer re-derives supertable/subtable names from the authenticated `tenantId` and rebuilds the executable statement using cloud's own `TimeSeriesDbExtension`/column-name constants. Only the `TAGS (...)` and `VALUES (...)` data payloads are reused verbatim from fog's statement.
- **Restore writes go through `tdengineClient.exec()` directly, never through `ActorLogRepository.insert()`/`SystemLogRepository.insert()`** — those methods apply a `MonotonicTimestampAllocator` meant for live writes that would distort restored historical timestamps.
- **`nvrId` is accepted by the new restore method for signature symmetry but is not part of the tenant-scope validation** — cloud's actor/system-log schema scopes by tenant only (one supertable per tenant, shared across that tenant's NVRs), confirmed by reading `actorLogSuperTableName`/`systemLogSuperTableName`'s own doc comments.
- **No `ruleChainApiForCloudConnectionService.clearData()` call on the fog side** — fog has no `ruleChains` module; that call is gateway-only and does not apply here.
- **Test placement/style:**
  - Fog: `src/modules/<module>/tests/<path>/<name>.spec.ts`, mirroring production path, direct class instantiation with plain-object mocks cast `as never`/`as any`, `jest.mock('configs/app.config', ...)` — same convention used throughout the prior plan in this repo.
  - Cloud: `src/modules/<module>/tests/<name>.spec.ts` (flatter than fog's — confirmed by reading `fogCommunicationManager/tests/*.spec.ts`), direct class instantiation with plain-object mocks cast `as never`, no `@nestjs/testing` `TestingModule`, no Testcontainers. `jest.mock('configs/app.config', ...)` only where the class under test actually calls `AppConfig()` directly.
- **Commit after every task**, scoped `git add` of only the files each task names — never `git add -A`/`git add .`.

---

## Task 1: Fix fog's actor-log export (missing `actorId` column value)

**Repo:** `fog-surveillance-camera`

**Files:**
- Modify: `src/modules/cloudConnection/applicationService/services/cloudRecovery.service.ts`
- Modify: `src/modules/cloudConnection/tests/applicationService/services/cloudRecovery.service.spec.ts`

**Interfaces:**
- Produces: `CloudRecoveryService['exportTimeSeriesInserts']` (private) now emits actor-log INSERT statements with an explicit `(createdAt, actorLogType, actorId, messageKey, messageParams)` column list and 5 VALUES (previously 4, missing `actorId`); system-log statements gain the equivalent explicit `(createdAt, messageKey, messageParams, section, entityId)` column list (values unchanged — already correct, this is a robustness-only change for that half).
- Consumes: nothing new — `actorLogRepository`/`systemLogRepository`/`TimeSeriesDbExtension` are already injected/imported in this file.

- [ ] **Step 1: Write the failing test**

Add to the end of the existing `describe('CloudRecoveryService.startCloudRecoveryProcess', ...)` block's file (as a new top-level `describe`), in `src/modules/cloudConnection/tests/applicationService/services/cloudRecovery.service.spec.ts`:

First, update the file's existing `jest.mock('configs/app.config', ...)` at the top (currently `default: () => ({ nvrId: 'nvr-1', tenantId: 'tenant-1' })`) to:

```ts
jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({
    nvrId: 'nvr-1',
    tenantId: '11111111-1111-4111-8111-111111111111',
    timeseriesDb: { dbName: 'fog-timeseries-db' },
  }),
}));
```

`tenantId` changes from `'tenant-1'` to a real UUID because `actorLogSuperTableName`/`systemLogSuperTableName` (real functions, not mocked) require one — `assertActorLogTenantId`/`assertSystemLogTenantId` call `isUUID(tenantId, '4')` and throw otherwise. This is safe to change file-wide: confirmed by reading the full file — the other two `describe` blocks (`getCloudRecoveryAck`'s 2 tests, `startCloudRecoveryProcess`'s 1 test) only assert on `nvrId`/`id: 'nvr-1'` and never read or assert `AppConfig().tenantId`.

With that tenantId, `actorLogSuperTableName` produces `actor_log_t_11111111111141118111111111111111` and `systemLogSuperTableName` produces `system_log_t_11111111111141118111111111111111` (dashes stripped, lowercased — the UUID has no uppercase hex digits here so lowercasing is a no-op).

Then add this new `describe` block to the end of the file:

```ts
describe('CloudRecoveryService.exportTimeSeriesInserts', () => {
  it('includes actorId as a column value and an explicit column list for both statement types', async () => {
    const actorLogRepository = {
      restQuery: jest.fn().mockResolvedValue([
        [
          'actor_log_t_sometable',
          1735689600000,
          'EMPLOYEE',
          '55555555-5555-4555-8555-555555555555',
          'some.key',
          'p1,p2',
        ],
      ]),
    };
    const systemLogRepository = {
      restQuery: jest.fn().mockResolvedValue([
        [
          'system_log_t_sometable',
          1735689600000,
          'system.key',
          '',
          'SYSTEM_LOG_SECTION_PAGE',
          'entity-1',
          'error',
        ],
      ]),
    };
    const service = new CloudRecoveryService(
      {} as never,
      actorLogRepository as never,
      systemLogRepository as never,
    );

    const statements = await (
      service as unknown as { exportTimeSeriesInserts(): Promise<string[]> }
    ).exportTimeSeriesInserts();

    expect(statements[0]).toBe(
      "INSERT INTO fog-timeseries-db.`actor_log_t_sometable` " +
        "USING fog-timeseries-db.actor_log_t_11111111111141118111111111111111 (tenantId, actorId) " +
        "TAGS ( '11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555') " +
        "(createdAt, actorLogType, actorId, messageKey, messageParams) " +
        "VALUES ( 1735689600000, 'EMPLOYEE', '55555555-5555-4555-8555-555555555555', 'some.key', 'p1,p2');",
    );
    expect(statements[1]).toBe(
      "INSERT INTO fog-timeseries-db.`system_log_t_sometable` " +
        "USING fog-timeseries-db.system_log_t_11111111111141118111111111111111 (tenantId, groupId) " +
        "TAGS ( '11111111-1111-4111-8111-111111111111', 'error') " +
        "(createdAt, messageKey, messageParams, section, entityId) " +
        "VALUES ( 1735689600000, 'system.key', '', 'SYSTEM_LOG_SECTION_PAGE', 'entity-1');",
    );
  });
});
```

(The single leading space inside `TAGS ( '...'` and `VALUES ( 1735...` above is not a typo — `TimeSeriesDbExtension.getValuesInsertFormat` prefixes every value with a space, including the first, by design; match it exactly or the assertion will fail on whitespace.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest cloudRecovery.service.spec.ts`
Expected: FAIL — current `actorLogValues` produces only 4 values with no `actorId`, and neither statement type has an explicit column list yet.

- [ ] **Step 3: Fix `exportTimeSeriesInserts` and `actorLogValues`**

Replace in `src/modules/cloudConnection/applicationService/services/cloudRecovery.service.ts`:

```ts
    for (const row of actorRows) {
      const [tbname, createdAt, actorLogType, actorId, messageKey, messageParams] =
        row.map(this.exportCellValue);
      statements.push(
        `INSERT INTO ${dbName}.\`${tbname}\` ` +
          `USING ${dbName}.${actorSuperTable} (tenantId, actorId) ` +
          `TAGS (${TimeSeriesDbExtension.getValuesInsertFormat([tenantId, actorId])}) ` +
          `(createdAt, actorLogType, actorId, messageKey, messageParams) ` +
          `VALUES (${this.actorLogValues(createdAt, actorLogType, actorId, messageKey, messageParams)});`,
      );
    }
    for (const row of systemRows) {
      const [tbname, createdAt, messageKey, messageParams, section, entityId, groupId] =
        row.map(this.exportCellValue);
      statements.push(
        `INSERT INTO ${dbName}.\`${tbname}\` ` +
          `USING ${dbName}.${systemSuperTable} (tenantId, groupId) ` +
          `TAGS (${TimeSeriesDbExtension.getValuesInsertFormat([tenantId, groupId])}) ` +
          `(createdAt, messageKey, messageParams, section, entityId) ` +
          `VALUES (${this.systemLogValues(createdAt, messageKey, messageParams, section, entityId)});`,
      );
    }
```

And replace the `actorLogValues` method (removing the now-inaccurate doc comment about `actorId` being absent, and adding it as a parameter):

```ts
  /**
   * actorId is included as both a TAG (for stable-level filtering) and a
   * regular column, matching cloud's schema — see
   * docs/superpowers/specs/2026-09-03-cloud-tdengine-restore-and-clear-data-design.md §2.
   */
  private actorLogValues(
    createdAt: unknown,
    actorLogType: unknown,
    actorId: unknown,
    messageKey: unknown,
    messageParams: unknown,
  ): string {
    return TimeSeriesDbExtension.getValuesInsertFormat([
      Number(createdAt),
      String(actorLogType ?? ''),
      String(actorId ?? ''),
      String(messageKey ?? ''),
      String(messageParams ?? ''),
    ]);
  }
```

(`systemLogValues` is unchanged — only its call site above now has an explicit column list.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest cloudRecovery.service.spec.ts`
Expected: PASS (all tests in the file, including the pre-existing `getCloudRecoveryAck`/`startCloudRecoveryProcess` suites)

- [ ] **Step 5: Run the full unit suite**

Run: `npx jest`
Expected: PASS (no new regressions; same pre-existing unrelated failures this repo already has)

- [ ] **Step 6: Commit**

```bash
git add src/modules/cloudConnection/applicationService/services/cloudRecovery.service.ts \
        src/modules/cloudConnection/tests/applicationService/services/cloudRecovery.service.spec.ts
git commit -m "fix(cloudConnection): include actorId value and explicit column lists in TDengine export"
```

---

## Task 2: Cloud archive selection recognizes `tdengine/dbs.sql`

**Repo:** `cloud-surveillance-camera`

**Files:**
- Modify: `src/modules/fogCommunicationManager/fogBackupArchive.ts`
- Modify: `src/modules/fogCommunicationManager/tests/fogBackupArchive.spec.ts`
- Modify (import/type rename only, no logic change): `src/modules/fogCommunicationManager/fogCommunicationManager.service.ts`

**Interfaces:**
- Produces: `FogBackupMembers { nvrs?: string; cameras?: string; pages?: string; tdengine?: string }` (renamed from `MongoBackupMembers`, one new optional field). `selectMongoBackupMembers(listing: string): FogBackupMembers` (function name unchanged — only its return type interface is renamed, to avoid a churn-y rename of the well-established function name for a plan this scoped; the interface rename reflects that it now covers both archive halves).
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

Replace the full contents of `src/modules/fogCommunicationManager/tests/fogBackupArchive.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { selectMongoBackupMembers } from '../fogBackupArchive';

describe('selectMongoBackupMembers', () => {
  it('selects supported Mongo files and the TDengine backup from a nested backup', () => {
    expect(
      selectMongoBackupMembers(
        [
          'backups/',
          'backups/mongo/',
          'backups/mongo/nvrs.json',
          'backups/mongo/cameras.json',
          'backups/mongo/pages.json',
          'backups/mongo/autoProvisioningOperations.json',
          'backups/mongo/cameraNetworkBindings.json',
          'backups/tdengine/',
          'backups/tdengine/dbs.sql',
        ].join('\n'),
      ),
    ).toEqual({
      nvrs: 'backups/mongo/nvrs.json',
      cameras: 'backups/mongo/cameras.json',
      pages: 'backups/mongo/pages.json',
      tdengine: 'backups/tdengine/dbs.sql',
    });
  });

  it('omits tdengine from the result when the archive has no TDengine backup', () => {
    expect(
      selectMongoBackupMembers('backups/mongo/nvrs.json'),
    ).toEqual({ nvrs: 'backups/mongo/nvrs.json' });
  });

  it.each([
    '../mongo/cameras.json',
    '/mongo/cameras.json',
    'backups/mongo/../../cameras.json',
    'backups/mongo/employees.json',
    'backups/other.json',
    'backups/tdengine/data.sql',
    'backups/tdengine/nested/dbs.sql',
  ])('rejects unsafe or unsupported entry %s', (entry) => {
    expect(() => selectMongoBackupMembers(entry)).toThrow(BadRequestException);
  });

  it('rejects duplicate aliases for the NVR collection', () => {
    expect(() =>
      selectMongoBackupMembers(
        'backups/mongo/nvrs.json\nbackups/mongo/gateways.json',
      ),
    ).toThrow('duplicate nvrs data');
  });

  it('rejects duplicate TDengine backup entries', () => {
    expect(() =>
      selectMongoBackupMembers(
        'backups/mongo/nvrs.json\n' +
          'backups/tdengine/dbs.sql\n' +
          'other/tdengine/dbs.sql',
      ),
    ).toThrow('duplicate TDengine data');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest fogBackupArchive.spec.ts`
Expected: FAIL — `backups/tdengine/dbs.sql` is currently silently ignored (not selected), and `backups/tdengine/data.sql`/`backups/tdengine/nested/dbs.sql` currently do NOT throw (silently ignored too, since today's code only checks `segments.includes('tdengine')`).

- [ ] **Step 3: Update `fogBackupArchive.ts`**

Replace the full contents of `src/modules/fogCommunicationManager/fogBackupArchive.ts`:

```ts
import { BadRequestException } from '@nestjs/common';

export interface FogBackupMembers {
  nvrs?: string;
  cameras?: string;
  pages?: string;
  tdengine?: string;
}

const ALLOWED_MONGO_FILES: Record<string, 'nvrs' | 'cameras' | 'pages'> = {
  'nvrs.json': 'nvrs',
  'gateways.json': 'nvrs',
  'cameras.json': 'cameras',
  'pages.json': 'pages',
};
const IGNORED_LOCAL_MONGO_FILES = new Set([
  'autoProvisioningOperations.json',
  'cameraNetworkBindings.json',
]);
const TDENGINE_BACKUP_FILE_NAME = 'dbs.sql';

export function selectMongoBackupMembers(listing: string): FogBackupMembers {
  const selected: FogBackupMembers = {};

  for (const rawName of listing.split('\n')) {
    const name = rawName.trim();
    if (!name) continue;
    if (name.startsWith('/') || name.includes('\\')) {
      throw new BadRequestException('Fog backup contains an unsafe path');
    }
    const segments = name.split('/').filter(Boolean);
    if (segments.includes('..')) {
      throw new BadRequestException('Fog backup contains an unsafe path');
    }
    if (name.endsWith('/')) continue;

    const mongoIndex = segments.indexOf('mongo');
    if (mongoIndex >= 0) {
      if (segments.length !== mongoIndex + 2) {
        throw new BadRequestException('Fog backup Mongo layout is invalid');
      }
      const fileName = segments[mongoIndex + 1]!;
      if (IGNORED_LOCAL_MONGO_FILES.has(fileName)) continue;
      const key = ALLOWED_MONGO_FILES[fileName];
      if (!key) {
        throw new BadRequestException(
          `Fog backup collection is not allowed: ${fileName}`,
        );
      }
      if (selected[key]) {
        throw new BadRequestException(
          `Fog backup contains duplicate ${key} data`,
        );
      }
      selected[key] = name;
      continue;
    }

    const tdengineIndex = segments.indexOf('tdengine');
    if (tdengineIndex >= 0) {
      if (segments.length !== tdengineIndex + 2) {
        throw new BadRequestException('Fog backup TDengine layout is invalid');
      }
      const fileName = segments[tdengineIndex + 1]!;
      if (fileName !== TDENGINE_BACKUP_FILE_NAME) {
        throw new BadRequestException(
          `Fog backup TDengine entry is not allowed: ${fileName}`,
        );
      }
      if (selected.tdengine) {
        throw new BadRequestException(
          'Fog backup contains duplicate TDengine data',
        );
      }
      selected.tdengine = name;
      continue;
    }

    throw new BadRequestException(`Fog backup entry is not allowed: ${name}`);
  }

  if (!selected.nvrs && !selected.cameras && !selected.pages) {
    throw new BadRequestException(
      'Fog backup contains no restorable Mongo data',
    );
  }
  return selected;
}
```

- [ ] **Step 4: No other call site needs updating**

Confirmed (`grep -rn "MongoBackupMembers" src/`): the `MongoBackupMembers` interface name is referenced only inside `fogBackupArchive.ts` itself, never imported or named elsewhere in the codebase — `fogCommunicationManager.service.ts` and the test file both only call the `selectMongoBackupMembers` function (unchanged name) and rely on its inferred return type. No edit needed in this step; it exists only to record that this was checked, not skipped.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest fogBackupArchive.spec.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Run the full unit suite**

Run: `npx jest`
Expected: PASS — `fogCommunicationManager.service.restore.spec.ts`'s existing tests use tar listings containing only `backups/mongo/cameras.json` (no `tdengine` entry), so `selected.tdengine` stays `undefined` for them; unaffected by this change.

- [ ] **Step 7: Commit**

```bash
git add src/modules/fogCommunicationManager/fogBackupArchive.ts \
        src/modules/fogCommunicationManager/tests/fogBackupArchive.spec.ts
git commit -m "feat(fogCommunicationManager): recognize tdengine/dbs.sql in fog backup archives"
```

---

## Task 3: `restoreTimeSeriesInserts` — parse, validate, rebuild, execute

**Repo:** `cloud-surveillance-camera`

**Files:**
- Modify: `src/modules/actorLogs/infra/actorLog.timeseriesRepository.ts` (visibility change only)
- Modify: `src/modules/actorLogs/actorLog.module.ts` (export the repository token)
- Modify: `src/modules/systemLogs/systemLog.module.ts` (export the repository token)
- Modify: `src/modules/fogCommunicationManager/fogCommunicationManager.module.ts` (import the two modules above, plus `TDengineModule`)
- Modify: `src/modules/fogCommunicationManager/fogCommunicationManager.service.ts` (new method + constructor params)
- Create: `src/modules/fogCommunicationManager/tests/fogCommunicationManager.service.tdengineRestore.spec.ts`

**Interfaces:**
- Produces: `FogCommunicationManagerService.restoreTimeSeriesInserts(tenantId: string, nvrId: string, sqlFilePath: string): Promise<void>` (public — Task 4 calls it from `restoreFogBackupToCloud`).
- Consumes: `ActorLogRepository.ensureSuperTable(tenantId: string): Promise<void>` (now public), `SystemLogRepository.ensureSuperTable(tenantId: string): Promise<void>` (already public), `TdengineClient.exec(query: string): Promise<unknown>` (from `src/modules/shared/timeseriesRepository.ts`), `TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(superTableName: string, subTableName?: string): { superTableInsertFormat: string; subTableInsertFormat: string }`, `actorLogSuperTableName(tenantId: string): string`, `systemLogSuperTableName(tenantId: string): string`, `actorLogColumnNames: string[]`, `systemLogColumnNames: string[]`.

- [ ] **Step 1: Make `ActorLogRepository.ensureSuperTable` public**

In `src/modules/actorLogs/infra/actorLog.timeseriesRepository.ts`, change:
```ts
  private async ensureSuperTable(tenantId: string): Promise<void> {
```
to:
```ts
  /**
   * Public so the fog-backup TDengine restore path can guarantee the stable
   * exists before writing into it — mirrors SystemLogRepository's own
   * ensureSuperTable, public for the identical reason.
   */
  async ensureSuperTable(tenantId: string): Promise<void> {
```
(No other change — same body, same `CREATE STABLE IF NOT EXISTS` idempotency via `ensuredStables`.)

- [ ] **Step 2: Export both repository tokens from their modules**

In `src/modules/actorLogs/actorLog.module.ts`, change:
```ts
  exports: [ActorLogApiService],
```
to:
```ts
  exports: [ActorLogApiService, ACTOR_LOG_REPOSITORY],
```

In `src/modules/systemLogs/systemLog.module.ts`, change:
```ts
  exports: [SystemLogService, SystemLogApiService],
```
to:
```ts
  exports: [SystemLogService, SystemLogApiService, SYSTEM_LOG_REPOSITORY],
```

- [ ] **Step 3: Write the failing tests**

Create `src/modules/fogCommunicationManager/tests/fogCommunicationManager.service.tdengineRestore.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { FogCommunicationManagerService } from '../fogCommunicationManager.service';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// TIME_SERIES_DB_NAME is not set in .env.test and this repo's plain-Jest unit
// tests never boot Nest's ConfigModule, so any code path that calls AppConfig()
// (TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat does) needs this
// mocked — exact convention already established in
// src/modules/systemLogs/tests/infra/repositories/systemLog.timeseriesRepository.spec.ts.
jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({ timeseriesDb: { dbName: 'surveillance' } }),
}));

describe('FogCommunicationManagerService.restoreTimeSeriesInserts', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const nvrId = '22222222-2222-4222-8222-222222222222';
  const actorSuperTable = 'actor_log_t_11111111111141118111111111111111';
  const systemSuperTable = 'system_log_t_11111111111141118111111111111111';

  function buildService(overrides?: {
    exec?: jest.Mock;
    ensureActorSuperTable?: jest.Mock;
    ensureSystemSuperTable?: jest.Mock;
  }) {
    const tdengineClient = { exec: overrides?.exec ?? jest.fn().mockResolvedValue(undefined) };
    const actorLogRepository = {
      ensureSuperTable: overrides?.ensureActorSuperTable ?? jest.fn().mockResolvedValue(undefined),
    };
    const systemLogRepository = {
      ensureSuperTable: overrides?.ensureSystemSuperTable ?? jest.fn().mockResolvedValue(undefined),
    };
    const service = new FogCommunicationManagerService(
      {} as never,
      {} as never,
      actorLogRepository as never,
      systemLogRepository as never,
      tdengineClient as never,
    );
    return { service, tdengineClient, actorLogRepository, systemLogRepository };
  }

  async function writeSqlFile(content: string): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'tdengine-restore-'));
    const filePath = join(dir, 'dbs.sql');
    await writeFile(filePath, content);
    return filePath;
  }

  it('is a no-op on an empty file', async () => {
    const { service, tdengineClient, actorLogRepository } = buildService();
    const filePath = await writeSqlFile('');

    await service.restoreTimeSeriesInserts(tenantId, nvrId, filePath);

    expect(tdengineClient.exec).not.toHaveBeenCalled();
    expect(actorLogRepository.ensureSuperTable).not.toHaveBeenCalled();
  });

  it('rebuilds and executes a valid actor-log statement for the authenticated tenant', async () => {
    const { service, tdengineClient, actorLogRepository } = buildService();
    const tbname = `${actorSuperTable}_555555555555455585555555555555555`;
    const line =
      `INSERT INTO fogdb.\`${tbname}\` USING fogdb.${actorSuperTable} (tenantId, actorId) ` +
      `TAGS ( '${tenantId}', '55555555-5555-4555-8555-555555555555') ` +
      `(createdAt, actorLogType, actorId, messageKey, messageParams) ` +
      `VALUES ( 1735689600000, 'EMPLOYEE', '55555555-5555-4555-8555-555555555555', 'some.key', 'p1,p2');`;
    const filePath = await writeSqlFile(`${line}\n`);

    await service.restoreTimeSeriesInserts(tenantId, nvrId, filePath);

    expect(actorLogRepository.ensureSuperTable).toHaveBeenCalledWith(tenantId);
    expect(tdengineClient.exec).toHaveBeenCalledTimes(1);
    const executed = tdengineClient.exec.mock.calls[0]![0] as string;
    expect(executed).toContain(`USING surveillance.${actorSuperTable}`);
    expect(executed).toContain('(createdAt, actorLogType, actorId, messageKey, messageParams)');
    expect(executed).toContain(
      "VALUES ( 1735689600000, 'EMPLOYEE', '55555555-5555-4555-8555-555555555555', 'some.key', 'p1,p2')",
    );
    // fog's own db-name prefix ("fogdb") must not survive into the executed statement
    expect(executed).not.toContain('fogdb');
  });

  it('rebuilds and executes a valid system-log statement for the authenticated tenant', async () => {
    const { service, tdengineClient, systemLogRepository } = buildService();
    const tbname = `${systemSuperTable}_error`;
    const line =
      `INSERT INTO fogdb.\`${tbname}\` USING fogdb.${systemSuperTable} (tenantId, groupId) ` +
      `TAGS ( '${tenantId}', 'error') ` +
      `(createdAt, messageKey, messageParams, section, entityId) ` +
      `VALUES ( 1735689600000, 'system.key', '', 'SYSTEM_LOG_SECTION_PAGE', 'entity-1');`;
    const filePath = await writeSqlFile(`${line}\n`);

    await service.restoreTimeSeriesInserts(tenantId, nvrId, filePath);

    expect(systemLogRepository.ensureSuperTable).toHaveBeenCalledWith(tenantId);
    expect(tdengineClient.exec).toHaveBeenCalledTimes(1);
    const executed = tdengineClient.exec.mock.calls[0]![0] as string;
    expect(executed).toContain(`USING surveillance.${systemSuperTable}`);
    expect(executed).toContain('(createdAt, messageKey, messageParams, section, entityId)');
  });

  it('rejects a statement targeting a foreign tenant supertable', async () => {
    const { service, tdengineClient } = buildService();
    const foreignSuperTable = 'actor_log_t_99999999999949998999999999999999';
    const line =
      `INSERT INTO fogdb.\`${foreignSuperTable}_x\` USING fogdb.${foreignSuperTable} (tenantId, actorId) ` +
      `TAGS ( '99999999-9999-4999-8999-999999999999', 'x') ` +
      `(createdAt, actorLogType, actorId, messageKey, messageParams) ` +
      `VALUES ( 1, 'EMPLOYEE', 'x', 'k', '');`;
    const filePath = await writeSqlFile(`${line}\n`);

    await expect(
      service.restoreTimeSeriesInserts(tenantId, nvrId, filePath),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tdengineClient.exec).not.toHaveBeenCalled();
  });

  it('rejects an unrecognized statement line', async () => {
    const { service } = buildService();
    const filePath = await writeSqlFile('DROP TABLE something;\n');

    await expect(
      service.restoreTimeSeriesInserts(tenantId, nvrId, filePath),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

The `jest.mock('configs/app.config', ...)` at the top of this file makes `dbName` a fixed, known `'surveillance'` regardless of environment — this is required, not optional: without it, `TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat` calls `AppConfig().timeseriesDb.dbName`, which reads `TIME_SERIES_DB_NAME` via `env.get(key).required()` — a var that is genuinely unset in `.env.test` and never loaded into a plain Jest unit test's `process.env` in this repo (confirmed: no `dotenv`/`setupFiles` wiring in this repo's Jest config) — so an unmocked test would throw immediately on the first call.

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx jest fogCommunicationManager.service.tdengineRestore.spec.ts`
Expected: FAIL — `FogCommunicationManagerService` doesn't have a `restoreTimeSeriesInserts` method or the new constructor parameters yet.

- [ ] **Step 5: Add the new method and constructor params**

In `src/modules/fogCommunicationManager/fogCommunicationManager.service.ts`, add imports:

```ts
import { BadRequestException, ConflictException, Injectable, OnApplicationBootstrap } from '@nestjs/common';
// ...existing imports...
import { ACTOR_LOG_REPOSITORY } from '../actorLogs/infra/actorLog.diToken';
import { ActorLogRepository } from '../actorLogs/infra/actorLog.timeseriesRepository';
import { actorLogSuperTableName, actorLogColumnNames } from '../actorLogs/domain/actorLog.type';
import { SYSTEM_LOG_REPOSITORY } from '../systemLogs/infra/diToken/systemLog.diToken';
import { SystemLogRepository } from '../systemLogs/infra/repositories/systemLog.timeseriesRepository';
import { systemLogSuperTableName, systemLogColumnNames } from '../systemLogs/domain/systemLog.type';
import { TDENGINE_CLIENT, TdengineClient } from '../shared/timeseriesRepository';
import { TimeSeriesDbExtension } from 'src/dddLib/utils/timeSeriesDbExtension';
```

(These paths are confirmed correct: `fogCommunicationManager.service.ts` lives at `src/modules/fogCommunicationManager/`, and its existing sibling import `import { pageCacheKey } from '../dashboard/infra/schemas/page.schema';` confirms `../` reaches `src/modules/` — so `../actorLogs/...`, `../systemLogs/...`, `../shared/...` above are exactly right, no adjustment needed.)

Add to the constructor:

```ts
  constructor(
    private readonly videoDevicesApiForFogCommunicationManagerService: VideoDevicesApiForFogCommunicationManagerService,
    private readonly cacheService: CacheService<unknown>,
    @Inject(ACTOR_LOG_REPOSITORY)
    private readonly actorLogRepository: ActorLogRepository,
    @Inject(SYSTEM_LOG_REPOSITORY)
    private readonly systemLogRepository: SystemLogRepository,
    @Inject(TDENGINE_CLIENT)
    private readonly tdengineClient: TdengineClient,
  ) {}
```

Confirmed: the file's current `@nestjs/common` import is `import { BadRequestException, ConflictException, Injectable, OnApplicationBootstrap } from '@nestjs/common';` — `Inject` is not yet there. Add it to that same import line.

Add the regexes as module-level constants (near the top of the file, alongside `RESTORE_TIMEOUT_MS` etc.):

```ts
const ACTOR_LOG_INSERT =
  /^INSERT INTO \S+\.`([^`]+)` USING \S+\.(actor_log_t_[0-9a-f]+) \(tenantId, actorId\) TAGS \(([^)]*)\) \(createdAt, actorLogType, actorId, messageKey, messageParams\) VALUES \((.*)\);$/;
const SYSTEM_LOG_INSERT =
  /^INSERT INTO \S+\.`([^`]+)` USING \S+\.(system_log_t_[0-9a-f]+) \(tenantId, groupId\) TAGS \(([^)]*)\) \(createdAt, messageKey, messageParams, section, entityId\) VALUES \((.*)\);$/;
```

Add the new public method (place it near `restoreFogBackupToCloud`, before the `private` helpers section):

```ts
  async restoreTimeSeriesInserts(
    tenantId: string,
    nvrId: string,
    sqlFilePath: string,
  ): Promise<void> {
    const content = await readFile(sqlFilePath, 'utf8');
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const expectedActorSuperTable = actorLogSuperTableName(tenantId);
    const expectedSystemSuperTable = systemLogSuperTableName(tenantId);
    const actorTenantPrefix = `${expectedActorSuperTable}_`;
    const systemTenantPrefix = `${expectedSystemSuperTable}_`;

    for (const line of lines) {
      const actorMatch = ACTOR_LOG_INSERT.exec(line);
      const systemMatch = actorMatch ? null : SYSTEM_LOG_INSERT.exec(line);
      if (!actorMatch && !systemMatch) {
        throw new BadRequestException(
          'Fog TDengine backup contains an unrecognized statement',
        );
      }

      if (actorMatch) {
        const [, tbname, superTable, tagsRaw, values] = actorMatch;
        if (
          superTable !== expectedActorSuperTable ||
          !tbname!.startsWith(actorTenantPrefix)
        ) {
          throw new BadRequestException(
            'Fog TDengine backup statement targets a foreign tenant',
          );
        }
        await this.actorLogRepository.ensureSuperTable(tenantId);
        const { superTableInsertFormat, subTableInsertFormat } =
          TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
            expectedActorSuperTable,
            tbname,
          );
        await this.tdengineClient.exec(
          `INSERT INTO ${subTableInsertFormat} USING ${superTableInsertFormat} (tenantId, actorId) ` +
            `TAGS (${tagsRaw}) (${actorLogColumnNames.join(', ')}) VALUES (${values});`,
        );
      } else {
        const [, tbname, superTable, tagsRaw, values] = systemMatch!;
        if (
          superTable !== expectedSystemSuperTable ||
          !tbname!.startsWith(systemTenantPrefix)
        ) {
          throw new BadRequestException(
            'Fog TDengine backup statement targets a foreign tenant',
          );
        }
        await this.systemLogRepository.ensureSuperTable(tenantId);
        const { superTableInsertFormat, subTableInsertFormat } =
          TimeSeriesDbExtension.getSuperTableAndSubTableInsertFormat(
            expectedSystemSuperTable,
            tbname,
          );
        await this.tdengineClient.exec(
          `INSERT INTO ${subTableInsertFormat} USING ${superTableInsertFormat} (tenantId, groupId) ` +
            `TAGS (${tagsRaw}) (${systemLogColumnNames.join(', ')}) VALUES (${values});`,
        );
      }
    }
  }
```

`nvrId` is intentionally unused in the body (accepted for signature symmetry with the mongo restore step, per this plan's Global Constraints) — if the linter flags an unused parameter, prefix it `_nvrId` instead; check this repo's lint config for its convention on unused-but-intentional parameters before choosing.

- [ ] **Step 6: Wire the two new module imports**

In `src/modules/fogCommunicationManager/fogCommunicationManager.module.ts`, add to `imports`:

```ts
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { SystemLogModule } from '../systemLogs/systemLog.module';
import { TDengineModule } from 'src/extensions/tdengine/tdengine.module';
// ...
@Module({
  imports: [
    MulterModule.register({ dest: process.env.FOG_BACKUP_ROOT ?? '/cloud_shared_backups' }),
    ConfigModule,
    VideoDevicesModule,
    CqrsModule,
    MqttModule,
    WsModule,
    ActorLogModule,
    SystemLogModule,
    TDengineModule,
  ],
  ...
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest fogCommunicationManager.service.tdengineRestore.spec.ts`
Expected: PASS (6 tests)

- [ ] **Step 8: Run the full unit suite**

Run: `npx jest`
Expected: this WILL fail on `fogCommunicationManager.service.restore.spec.ts` — its existing `buildService()` constructs `new FogCommunicationManagerService(fogApi as never, cache as never)` with only 2 args against the new 5-param constructor. This repo's Jest config transforms via plain `ts-jest` with no `isolatedModules` override, so `ts-jest` type-checks each file by default — the under-supplied constructor call is a compile error, not just a runtime `undefined`, and will fail the whole file. Fix it now (Task 4 will flesh these out properly with real mocks, but this task must not leave the suite red): in `fogCommunicationManager.service.restore.spec.ts`'s `buildService()`, change the constructor call to
```ts
    const service = new FogCommunicationManagerService(
      fogApi as never,
      cache as never,
      {} as never,
      {} as never,
      {} as never,
    );
```
and commit this one-line fix as part of this task's own commit (see Step 9's `git add` list, which already includes this file for exactly this reason). Re-run `npx jest` after this fix and confirm PASS — the 2 existing tests never reach the TDengine-dependent code path (their tar listings contain no `tdengine` entry, so `members.tdengine` is `undefined` and neither `ensureSuperTable` nor `restoreTimeSeriesInserts` executes for them), so the `{} as never` placeholders are never actually invoked in this task's test run.

- [ ] **Step 9: Commit**

```bash
git add src/modules/actorLogs/infra/actorLog.timeseriesRepository.ts \
        src/modules/actorLogs/actorLog.module.ts \
        src/modules/systemLogs/systemLog.module.ts \
        src/modules/fogCommunicationManager/fogCommunicationManager.module.ts \
        src/modules/fogCommunicationManager/fogCommunicationManager.service.ts \
        src/modules/fogCommunicationManager/tests/fogCommunicationManager.service.tdengineRestore.spec.ts \
        src/modules/fogCommunicationManager/tests/fogCommunicationManager.service.restore.spec.ts
git commit -m "feat(fogCommunicationManager): add tenant-scoped TDengine restore step"
```

---

## Task 4: Wire extraction + restore into `restoreFogBackupToCloud`

**Repo:** `cloud-surveillance-camera`

**Files:**
- Modify: `src/modules/fogCommunicationManager/fogCommunicationManager.service.ts`
- Modify: `src/modules/fogCommunicationManager/tests/fogCommunicationManager.service.restore.spec.ts`

**Interfaces:**
- Consumes: `FogBackupMembers.tdengine?: string` (Task 2), `restoreTimeSeriesInserts(tenantId, nvrId, sqlFilePath): Promise<void>` (Task 3).
- Produces: `restoreFogBackupToCloud` now extracts and restores the TDengine half when present, before evicting cache / acking; a TDengine failure follows the exact same `resetFogCloudRecovery`/no-ack path a Mongo failure already does.

- [ ] **Step 1: Update `buildService()` in the existing test file for the new constructor shape**

In `src/modules/fogCommunicationManager/tests/fogCommunicationManager.service.restore.spec.ts`, update `buildService()`:

```ts
  function buildService(overrides?: {
    actorLogRepository?: { ensureSuperTable: jest.Mock };
    systemLogRepository?: { ensureSuperTable: jest.Mock };
    tdengineClient?: { exec: jest.Mock };
  }) {
    const fogApi = {
      findFogNvrBySerialNumber: jest.fn().mockResolvedValue({
        id: nvrId,
        tenantId,
        serialNumber,
        accessToken,
        cloudIsRecovering: false,
      }),
      startFogCloudRecovery: jest.fn().mockResolvedValue(undefined),
      completeFogCloudRecovery: jest.fn().mockResolvedValue(undefined),
      resetFogCloudRecovery: jest.fn().mockResolvedValue(undefined),
    };
    const cache = {
      acquireLock: jest.fn().mockResolvedValue('lock-token'),
      releaseLock: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const actorLogRepository =
      overrides?.actorLogRepository ?? { ensureSuperTable: jest.fn().mockResolvedValue(undefined) };
    const systemLogRepository =
      overrides?.systemLogRepository ?? { ensureSuperTable: jest.fn().mockResolvedValue(undefined) };
    const tdengineClient = overrides?.tdengineClient ?? { exec: jest.fn().mockResolvedValue(undefined) };
    const service = new FogCommunicationManagerService(
      fogApi as never,
      cache as never,
      actorLogRepository as never,
      systemLogRepository as never,
      tdengineClient as never,
    );
    const file = { path: uploadPath } as Express.Multer.File;
    const nvr = { id: nvrId, tenantId, serialNumber, accessToken, cloudIsRecovering: false };
    return { service, fogApi, cache, actorLogRepository, systemLogRepository, tdengineClient, file, nvr };
  }
```

- [ ] **Step 2: Write the failing tests**

Add two new `it` blocks to the `describe('FogCommunicationManagerService restore', ...)` block, after the existing "passes authenticated scope..." test:

```ts
  it('restores the TDengine backup when the archive includes one, before completing recovery', async () => {
    const context = buildService();
    const restoreTimeSeriesInserts = jest
      .spyOn(context.service, 'restoreTimeSeriesInserts')
      .mockResolvedValue(undefined);
    jest
      .spyOn(context.service as never, 'extractArchiveMember')
      .mockResolvedValue(undefined);
    jest
      .spyOn(context.service as never, 'runCommand')
      .mockResolvedValueOnce('backups/mongo/cameras.json\nbackups/tdengine/dbs.sql\n')
      .mockImplementationOnce(
        async (_command: string, _args: string[], env: NodeJS.ProcessEnv) => {
          await require('node:fs/promises').writeFile(
            env.MONGO_RESTORE_RESULT_FILE!,
            JSON.stringify({
              completed: true,
              nvrIds: [nvrId],
              cameraIds: [],
              pageIds: [],
            }),
          );
          return '';
        },
      );

    await context.service.restoreFogBackupToCloud(context.nvr, context.file);

    expect(restoreTimeSeriesInserts).toHaveBeenCalledWith(
      tenantId,
      nvrId,
      expect.stringContaining('dbs.sql'),
    );
    expect(context.fogApi.completeFogCloudRecovery).toHaveBeenCalledWith(serialNumber);
    // The TDengine restore must run before the ack — never ack on a half-imported backup.
    const restoreCallOrder = restoreTimeSeriesInserts.mock.invocationCallOrder[0]!;
    const ackCallOrder = context.fogApi.completeFogCloudRecovery.mock.invocationCallOrder[0]!;
    expect(restoreCallOrder).toBeLessThan(ackCallOrder);
  });

  it('does not ack when the TDengine restore fails, and resets recovery instead', async () => {
    const context = buildService();
    jest
      .spyOn(context.service, 'restoreTimeSeriesInserts')
      .mockRejectedValue(new Error('bad statement'));
    jest
      .spyOn(context.service as never, 'extractArchiveMember')
      .mockResolvedValue(undefined);
    jest
      .spyOn(context.service as never, 'runCommand')
      .mockResolvedValueOnce('backups/mongo/cameras.json\nbackups/tdengine/dbs.sql\n')
      .mockImplementationOnce(
        async (_command: string, _args: string[], env: NodeJS.ProcessEnv) => {
          await require('node:fs/promises').writeFile(
            env.MONGO_RESTORE_RESULT_FILE!,
            JSON.stringify({ completed: true, nvrIds: [nvrId], cameraIds: [], pageIds: [] }),
          );
          return '';
        },
      );

    await expect(
      context.service.restoreFogBackupToCloud(context.nvr, context.file),
    ).rejects.toThrow('bad statement');

    expect(context.fogApi.completeFogCloudRecovery).not.toHaveBeenCalled();
    expect(context.fogApi.resetFogCloudRecovery).toHaveBeenCalledWith(tenantId, nvrId);
  });

  it('skips the TDengine restore entirely when the archive has no TDengine backup', async () => {
    const context = buildService();
    const restoreTimeSeriesInserts = jest
      .spyOn(context.service, 'restoreTimeSeriesInserts')
      .mockResolvedValue(undefined);
    jest
      .spyOn(context.service as never, 'extractArchiveMember')
      .mockResolvedValue(undefined);
    jest
      .spyOn(context.service as never, 'runCommand')
      .mockResolvedValueOnce('backups/mongo/cameras.json\n')
      .mockImplementationOnce(
        async (_command: string, _args: string[], env: NodeJS.ProcessEnv) => {
          await require('node:fs/promises').writeFile(
            env.MONGO_RESTORE_RESULT_FILE!,
            JSON.stringify({ completed: true, nvrIds: [nvrId], cameraIds: [], pageIds: [] }),
          );
          return '';
        },
      );

    await context.service.restoreFogBackupToCloud(context.nvr, context.file);

    expect(restoreTimeSeriesInserts).not.toHaveBeenCalled();
    expect(context.fogApi.completeFogCloudRecovery).toHaveBeenCalledWith(serialNumber);
  });
```

(Prefer a top-level `import { writeFile } from 'node:fs/promises';` — already imported at the top of this file — over the inline `require(...)` shown above; the inline form is only to keep this brief's diff minimal to read. Use the already-imported `writeFile` directly instead of `require('node:fs/promises').writeFile` when actually writing the file.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest fogCommunicationManager.service.restore.spec.ts`
Expected: FAIL — `restoreFogBackupToCloud` doesn't call `restoreTimeSeriesInserts` yet, so it's never invoked and the new assertions fail.

- [ ] **Step 4: Wire the extraction and restore call**

In `src/modules/fogCommunicationManager/fogCommunicationManager.service.ts`'s `restoreFogBackupToCloud`, replace:

```ts
      const restoreId = randomUUID();
      const stagingRoot = join(BACKUP_ROOT, `restore-${restoreId}`);
      const mongoDirectory = join(stagingRoot, 'mongo');
      const resultFile = join(stagingRoot, 'result.json');

      try {
        await mkdir(mongoDirectory, { recursive: true });
        const listing = await this.runCommand('tar', ['-I', 'zstd', '-tf', file.path]);
        const members = selectMongoBackupMembers(listing);
        for (const [collection, member] of Object.entries(members)) {
          if (!member) continue;
          await this.extractArchiveMember(
            file.path,
            member,
            join(mongoDirectory, `${collection}.json`),
          );
        }

        try {
          await this.videoDevicesApiForFogCommunicationManagerService.startFogCloudRecovery(
            nvr.tenantId,
            nvr.id,
          );
          await this.runCommand('bash', [...], this.mongoRestoreEnv({...}));
          const result = await this.readRestoreResult(resultFile, nvr.id, true);
          await this.evictRestoredRecords(nvr.tenantId, result);
          await this.videoDevicesApiForFogCommunicationManagerService.completeFogCloudRecovery(
            nvr.serialNumber,
          );
        } catch (error) {
```

with:

```ts
      const restoreId = randomUUID();
      const stagingRoot = join(BACKUP_ROOT, `restore-${restoreId}`);
      const mongoDirectory = join(stagingRoot, 'mongo');
      const tdengineDirectory = join(stagingRoot, 'tdengine');
      const resultFile = join(stagingRoot, 'result.json');
      const tdengineSqlFile = join(tdengineDirectory, 'dbs.sql');

      try {
        await mkdir(mongoDirectory, { recursive: true });
        const listing = await this.runCommand('tar', ['-I', 'zstd', '-tf', file.path]);
        const members = selectMongoBackupMembers(listing);
        for (const [collection, member] of Object.entries(members)) {
          if (!member || collection === 'tdengine') continue;
          await this.extractArchiveMember(
            file.path,
            member,
            join(mongoDirectory, `${collection}.json`),
          );
        }
        if (members.tdengine) {
          await mkdir(tdengineDirectory, { recursive: true });
          await this.extractArchiveMember(file.path, members.tdengine, tdengineSqlFile);
        }

        try {
          await this.videoDevicesApiForFogCommunicationManagerService.startFogCloudRecovery(
            nvr.tenantId,
            nvr.id,
          );
          await this.runCommand('bash', [...], this.mongoRestoreEnv({...}));
          const result = await this.readRestoreResult(resultFile, nvr.id, true);
          if (members.tdengine) {
            await this.restoreTimeSeriesInserts(nvr.tenantId, nvr.id, tdengineSqlFile);
          }
          await this.evictRestoredRecords(nvr.tenantId, result);
          await this.videoDevicesApiForFogCommunicationManagerService.completeFogCloudRecovery(
            nvr.serialNumber,
          );
        } catch (error) {
```

(The `[...]`/`{...}` above are the existing, unchanged `runCommand('bash', ...)` call and `mongoRestoreEnv({...})` arguments already in the file — do not alter those, only the surrounding structure shown.) The outer `catch (error)` block (calling `evictPartialRestoreRecords` + `resetFogCloudRecovery` + rethrow) is completely unchanged — a `restoreTimeSeriesInserts` throw is caught by this same existing handler, exactly like a mongo-restore failure already is.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest fogCommunicationManager.service.restore.spec.ts`
Expected: PASS (5 tests: the 2 pre-existing + 3 new)

- [ ] **Step 6: Run the full unit suite**

Run: `npx jest`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/modules/fogCommunicationManager/fogCommunicationManager.service.ts \
        src/modules/fogCommunicationManager/tests/fogCommunicationManager.service.restore.spec.ts
git commit -m "feat(fogCommunicationManager): restore TDengine backup before completing fog cloud recovery"
```

---

## Task 5: Wire fog's `clearData()`-on-ack

**Repo:** `fog-surveillance-camera`

**Files:**
- Modify: `src/modules/cloudConnection/applicationService/services/cloudRecovery.service.ts`
- Modify: `src/modules/cloudConnection/tests/applicationService/services/cloudRecovery.service.spec.ts`

**Interfaces:**
- Consumes: `ActorLogApiForCloudConnectionService.clearData(): Promise<void>` (`src/modules/actorLogs/applicationService/services/actorLogApiForCloudConnectionservice.ts`, already exists, already exported from `ActorLogModule`), `SystemLogApiForCloudConnectionService.clearData(): Promise<void>` (`src/modules/systemLogs/applicationService/apiForAnotherServices/systemLogApiForCloudConnection.service.ts`, already exists, already exported from `SystemLogModule`). Both modules are already imported into `CloudConnectionModule` (confirmed — no module-wiring change needed for this task, only the constructor/call-site change below).

- [ ] **Step 1: Write the failing test**

In `src/modules/cloudConnection/tests/applicationService/services/cloudRecovery.service.spec.ts`, update the first test in `describe('CloudRecoveryService.getCloudRecoveryAck', ...)`:

```ts
  it('resets cloudFailedAt to 0, marks the cloud available again, and clears local audit-trail data', async () => {
    CloudRecoveryService.RECOVERY_PROCESS_INITIALIZED = true;
    let cloudIsAvailableWhenCommandDispatched: boolean | undefined;
    const commandBus = {
      execute: jest.fn().mockImplementation(async () => {
        cloudIsAvailableWhenCommandDispatched = CloudConnectionService.CLOUD_IS_AVAILABLE;
      }),
    };
    const serviceProvider = {
      commandBus,
      eventEmitter: { on: jest.fn(), emit: jest.fn() },
      logger: { error: jest.fn() },
    };
    const actorLogApiForCloudConnectionService = { clearData: jest.fn().mockResolvedValue(undefined) };
    const systemLogApiForCloudConnectionService = { clearData: jest.fn().mockResolvedValue(undefined) };
    const service = new CloudRecoveryService(
      serviceProvider as never,
      {} as never,
      {} as never,
      actorLogApiForCloudConnectionService as never,
      systemLogApiForCloudConnectionService as never,
    );
    jest.spyOn(service as any, 'cleanBackup').mockResolvedValue(undefined);

    await service.getCloudRecoveryAck({ topic: 't', message: 'ok' });

    expect(cloudIsAvailableWhenCommandDispatched).toBe(false);
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'nvr-1', cloudFailedAt: 0 }),
    );
    expect(CloudConnectionService.CLOUD_IS_AVAILABLE).toBe(true);
    expect(CloudRecoveryService.RECOVERY_PROCESS_INITIALIZED).toBe(false);
    expect(actorLogApiForCloudConnectionService.clearData).toHaveBeenCalledTimes(1);
    expect(systemLogApiForCloudConnectionService.clearData).toHaveBeenCalledTimes(1);
  });
```

Update the second test (`'does nothing when no recovery process is in flight'`) to pass 2 additional `{} as never` args to the constructor (now 5 total), and update the `startCloudRecoveryProcess` describe block's `new CloudRecoveryService(...)` calls the same way — this constructor now takes 5 arguments everywhere it's instantiated in this file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest cloudRecovery.service.spec.ts`
Expected: FAIL — `clearData` is never called today, and the constructor doesn't accept the 2 new params.

- [ ] **Step 3: Wire the two services**

In `src/modules/cloudConnection/applicationService/services/cloudRecovery.service.ts`, add imports:

```ts
import { ActorLogApiForCloudConnectionService } from 'src/modules/actorLogs/applicationService/services/actorLogApiForCloudConnectionservice';
import { SystemLogApiForCloudConnectionService } from 'src/modules/systemLogs/applicationService/apiForAnotherServices/systemLogApiForCloudConnection.service';
```

Update the constructor:

```ts
  constructor(
    private readonly serviceProvider: ServiceProvider,
    @Inject(ACTOR_LOG_REPOSITORY)
    private readonly actorLogRepository: ActorLogRepository,
    @Inject(SYSTEM_LOG_REPOSITORY)
    private readonly systemLogRepository: SystemLogRepository,
    private readonly actorLogApiForCloudConnectionService: ActorLogApiForCloudConnectionService,
    private readonly systemLogApiForCloudConnectionService: SystemLogApiForCloudConnectionService,
  ) {}
```

Update `getCloudRecoveryAck`:

```ts
  async getCloudRecoveryAck(_mqttMsg: MqttEventDataDto): Promise<void> {
    if (!CloudRecoveryService.RECOVERY_PROCESS_INITIALIZED) return;
    try {
      await this.serviceProvider.commandBus.execute(
        new UpdateNvrCommand({
          id: AppConfig().nvrId,
          cloudFailedAt: CloudFailedAt.init().unpack(),
        }),
      );
      CloudConnectionService.CLOUD_IS_AVAILABLE = true;
      CloudRecoveryService.RECOVERY_PROCESS_INITIALIZED = false;
      await this.cleanBackup();
      await this.actorLogApiForCloudConnectionService.clearData();
      await this.systemLogApiForCloudConnectionService.clearData();
    } catch (error) {
      this.serviceProvider.eventEmitter.emit(GLOBAL_ERROR_EVENT, error);
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest cloudRecovery.service.spec.ts`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Run the full unit suite**

Run: `npx jest`
Expected: PASS (no new regressions beyond this repo's already-known pre-existing unrelated failures)

- [ ] **Step 6: Commit**

```bash
git add src/modules/cloudConnection/applicationService/services/cloudRecovery.service.ts \
        src/modules/cloudConnection/tests/applicationService/services/cloudRecovery.service.spec.ts
git commit -m "feat(cloudConnection): clear local actor/system log audit trail after a verified cloud ack"
```

---

## Final verification (after Task 5)

- [ ] `cloud-surveillance-camera`: run `npx jest` — full pass, same pre-existing unrelated baseline as before this plan.
- [ ] `cloud-surveillance-camera`: run `npx tsc --noEmit` (or this repo's equivalent build/typecheck script) — confirm no new type errors in any file this plan touched.
- [ ] `fog-surveillance-camera`: run `npx jest` — full pass, same pre-existing unrelated baseline as before this plan.
- [ ] Re-read spec §2 through §8 and confirm each requirement has a corresponding task above with no gaps.
- [ ] Per the spec's §9 rollout note: Task 5 (fog `clearData()` wiring) should not be considered safe to run in production until Tasks 2-4 have been exercised against a real TDengine instance (this repo's own `test/qualification/` bash scripts, or a manual end-to-end fog→cloud recovery test) — unit tests passing is necessary but the spec is explicit that this repo has no integration-level Jest coverage for this module.
