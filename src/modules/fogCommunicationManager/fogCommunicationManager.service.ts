import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import AppConfig from 'configs/app.config';
import { CacheService } from 'src/extensions/caching/cache.service';
import { pageCacheKey } from '../dashboard/infra/schemas/page.schema';
import {
  FogNvrProjection,
  VideoDevicesApiForFogCommunicationManagerService,
} from '../videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { CameraModel } from '../videoDevices/infra/camera/camera.schema';
import { NvrModel } from '../videoDevices/infra/nvr/nvr.schema';
import { selectMongoBackupMembers } from './fogBackupArchive';
import { BACKUP_ROOT } from './fogBackupRoot';
const RESTORE_TIMEOUT_MS = 10 * 60 * 1000;
const RESTORE_LOCK_TTL_SECONDS = 60 * 60;
const MAX_EXTRACTED_MONGO_FILE_SIZE = 256 * 1024 * 1024;
/**
 * Shared across the WHOLE tdengine/ tree in one extraction, not reset per
 * file (see extractTdengineTree). This is the same 256 MiB bound that was the
 * genuine per-backup cap before Task 4 turned tdengine into a directory tree;
 * restoring it as a whole-tree total closes the N x 256 MiB hole a per-file
 * budget would otherwise leave. A real taosdump tree for two supertables is a
 * handful of files (dbs.sql plus a few avro/schema files per vgroup), so this
 * leaves enormous headroom for any legitimate restore.
 */
const MAX_EXTRACTED_TDENGINE_TREE_BYTES = 256 * 1024 * 1024;
/** How often extractTdengineTree polls total on-disk size against the budget
 * while the single tar process is running. */
const TDENGINE_EXTRACTION_POLL_MS = 50;
/**
 * dbs.sql is DDL text only (a handful of CREATE DATABASE/CREATE STABLE
 * lines); real output is at most a few KB even for dozens of stables. Capped
 * so an implausibly large dbs.sql is never pulled whole into a JS string —
 * basic robustness, not a security boundary (fog is a trusted device in this
 * system).
 */
const MAX_DBS_SQL_BYTES = 1024 * 1024;
// Leading character must be alphanumeric so a name can never look like a
// flag (e.g. `-e`) once interpolated into the `-W <name>=<dbName>` argv
// position — a malformed name should fail loudly, not mangle the argv.
const SAFE_DB_NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

interface FogRestoreResult {
  completed: boolean;
  nvrIds: string[];
  cameraIds: string[];
  pageIds: string[];
}

@Injectable()
export class FogCommunicationManagerService implements OnApplicationBootstrap {
  constructor(
    private readonly videoDevicesApiForFogCommunicationManagerService: VideoDevicesApiForFogCommunicationManagerService,
    private readonly cacheService: CacheService<unknown>,
  ) {}
  async onApplicationBootstrap() {
    await this.videoDevicesApiForFogCommunicationManagerService.sendCloudIsAvailableSignalToFog();
  }

  async restoreFogBackupToCloud(
    nvr: FogNvrProjection,
    file: Express.Multer.File | undefined,
  ): Promise<void> {
    if (!file) throw new BadRequestException('Fog backup file is required');

    try {
      if (nvr.cloudIsRecovering) {
        throw new ConflictException('Fog backup restore is already running');
      }

      const lockKey = `fog-restore:${nvr.tenantId}:${nvr.id}`;
      const lockToken = await this.cacheService.acquireLock(
        lockKey,
        RESTORE_LOCK_TTL_SECONDS,
      );
      if (!lockToken) {
        throw new ConflictException('Fog backup restore is already running');
      }

      const restoreId = randomUUID();
      const stagingRoot = join(BACKUP_ROOT, `restore-${restoreId}`);
      const mongoDirectory = join(stagingRoot, 'mongo');
      const tdengineDirectory = join(stagingRoot, 'tdengine');
      const resultFile = join(stagingRoot, 'result.json');
      let tdengineDumpDir: string | undefined;

      try {
        await mkdir(mongoDirectory, { recursive: true });
        const listing = await this.runCommand('tar', [
          '-I',
          'zstd',
          '-tf',
          file.path,
        ]);
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
          tdengineDumpDir = await this.extractTdengineTree(
            file.path,
            members.tdengine,
            tdengineDirectory,
            nvr.id,
          );
        }

        try {
          await this.videoDevicesApiForFogCommunicationManagerService.startFogCloudRecovery(
            nvr.tenantId,
            nvr.id,
          );
          await this.runCommand(
            'bash',
            [
              process.env.FOG_MONGO_RESTORE_SCRIPT ??
                join(process.cwd(), 'scripts', 'mongo-restore.sh'),
            ],
            this.mongoRestoreEnv({
              tenantId: nvr.tenantId,
              nvrId: nvr.id,
              serialNumber: nvr.serialNumber,
              mongoDirectory,
              resultFile,
            }),
          );
          const result = await this.readRestoreResult(
            resultFile,
            nvr.id,
            true,
          );
          if (members.tdengine) {
            await this.restoreTimeSeriesDump(tdengineDumpDir!, nvr.id);
          }
          await this.evictRestoredRecords(nvr.tenantId, result);
          await this.videoDevicesApiForFogCommunicationManagerService.completeFogCloudRecovery(
            nvr.serialNumber,
          );
        } catch (error) {
          await this.evictPartialRestoreRecords(
            resultFile,
            nvr.tenantId,
            nvr.id,
          );
          await this.videoDevicesApiForFogCommunicationManagerService.resetFogCloudRecovery(
            nvr.tenantId,
            nvr.id,
          );
          throw error;
        }
      } finally {
        await Promise.all([
          rm(stagingRoot, { recursive: true, force: true }),
          this.cacheService.releaseLock(lockKey, lockToken),
        ]);
      }
    } finally {
      await rm(file.path, { force: true });
    }
  }

  /**
   * Fog is a trusted device in this system: it backs up with taosdump and
   * cloud restores with taosdump — there is no per-tenant filtering or
   * staging to do. Fog and cloud derive IDENTICAL supertable names from the
   * same tenant id (`actor_log_t_<suffix>` / `system_log_t_<suffix>`), so a
   * plain `-i` import with `-W` renaming fog's database onto cloud's lands
   * every row in exactly the right table by construction.
   */
  async restoreTimeSeriesDump(dumpDir: string, nvrId: string): Promise<void> {
    const sourceDb = await this.readDumpSourceDatabase(dumpDir, nvrId);
    await this.runCommand('taosdump', [
      ...this.tdengineArgs(),
      '-e',
      '-i',
      dumpDir,
      '-W',
      `${sourceDb}=${AppConfig().timeseriesDb.dbName}`,
      // taosdump unconditionally writes dump_result.txt into its current
      // working directory; in production that's /app, which the
      // unprivileged node user cannot write to. dumpDir sits under
      // BACKUP_ROOT (/cloud_shared_backups), which is chown node:node — same
      // fix Task 3 applied on the fog side.
      '-r',
      join(dumpDir, 'dump_result.txt'),
    ]);
  }

  private tdengineArgs(): string[] {
    return [
      '-h', process.env.TIME_SERIES_DB_HOST ?? 'tdengine-cloud',
      '-P', process.env.TIME_SERIES_DB_NATIVE_PORT ?? '6030',
      '-u', process.env.TIME_SERIES_DB_USER ?? 'root',
      `-p${process.env.TIME_SERIES_DB_PASSWORD ?? ''}`,
    ];
  }

  /**
   * Reads the source database name out of the dump's `taosdump.<n>/dbs.sql`
   * (its `CREATE DATABASE` line) so `-W` can rename it onto cloud's own
   * database. This is basic robustness, not a security boundary — fog is
   * trusted here — so the only check is SAFE_DB_NAME: a malformed/absent
   * name must fail loudly rather than mangle the taosdump argv.
   */
  private async readDumpSourceDatabase(
    dumpDir: string,
    nvrId: string,
  ): Promise<string> {
    const entries = await readdir(dumpDir, { withFileTypes: true });
    const inner = entries.find(
      (entry) => entry.isDirectory() && entry.name.startsWith('taosdump.'),
    );
    if (!inner) {
      throw new BadRequestException(
        `Fog TDengine dump is missing its taosdump.<n> directory (nvr ${nvrId})`,
      );
    }
    const dbsSqlPath = join(dumpDir, inner.name, 'dbs.sql');
    let size: number;
    try {
      size = (await stat(dbsSqlPath)).size;
    } catch {
      throw new BadRequestException(
        `Fog TDengine dump has an unreadable dbs.sql (nvr ${nvrId})`,
      );
    }
    if (size > MAX_DBS_SQL_BYTES) {
      throw new BadRequestException(
        `Fog TDengine dump's dbs.sql is implausibly large (nvr ${nvrId})`,
      );
    }
    const content = await readFile(dbsSqlPath, 'utf8');
    const match = /CREATE DATABASE IF NOT EXISTS\s+`?([^`\s;]+)`?/i.exec(
      content,
    );
    const name = match?.[1];
    if (!name || !SAFE_DB_NAME.test(name)) {
      throw new BadRequestException(
        `Fog TDengine dump does not declare a usable database name (nvr ${nvrId})`,
      );
    }
    return name;
  }

  private mongoRestoreEnv(scope: {
    tenantId: string;
    nvrId: string;
    serialNumber: string;
    mongoDirectory: string;
    resultFile: string;
  }): NodeJS.ProcessEnv {
    const host = process.env.MONGO_DB_HOST ?? 'localhost';
    const port = process.env.MONGO_DB_PORT ?? '27017';
    const username = process.env.MONGO_DB_USERNAME ?? '';
    const password = process.env.MONGO_DB_PASSWORD ?? '';
    const authSource = process.env.MONGO_DB_AUTH_SOURCE ?? 'admin';
    const credentials =
      username && password
        ? `${encodeURIComponent(username)}:${encodeURIComponent(password)}@`
        : '';
    const authQuery = credentials
      ? `?authSource=${encodeURIComponent(authSource)}`
      : '';
    return {
      ...process.env,
      MONGO_RESTORE_HOST: host,
      MONGO_RESTORE_PORT: port,
      MONGO_RESTORE_DB: process.env.MONGO_DB_NAME,
      MONGO_RESTORE_URI: `mongodb://${credentials}${host}:${port}/${authQuery}`,
      MONGO_RESTORE_DIR: scope.mongoDirectory,
      MONGO_RESTORE_TENANT_ID: scope.tenantId,
      MONGO_RESTORE_NVR_ID: scope.nvrId,
      MONGO_RESTORE_SERIAL_NUMBER: scope.serialNumber,
      MONGO_RESTORE_RESULT_FILE: scope.resultFile,
    };
  }

  private async readRestoreResult(
    resultFile: string,
    nvrId: string,
    requireCompleted: boolean,
  ): Promise<FogRestoreResult> {
    const result = JSON.parse(await readFile(resultFile, 'utf8')) as unknown;
    if (!result || typeof result !== 'object') {
      throw new Error('Fog restore result is invalid');
    }
    const value = result as Partial<FogRestoreResult>;
    if (
      (requireCompleted && value.completed !== true) ||
      !Array.isArray(value.nvrIds) ||
      !Array.isArray(value.cameraIds) ||
      !Array.isArray(value.pageIds) ||
      value.nvrIds.length !== 1 ||
      value.nvrIds[0] !== nvrId ||
      value.cameraIds.length > 10_000 ||
      value.pageIds.length > 10_000 ||
      ![...value.nvrIds, ...value.cameraIds, ...value.pageIds].every(
        (id) =>
          typeof id === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            id,
          ),
      )
    ) {
      throw new Error('Fog restore did not complete safely');
    }
    return value as FogRestoreResult;
  }

  private async evictPartialRestoreRecords(
    resultFile: string,
    tenantId: string,
    nvrId: string,
  ): Promise<void> {
    try {
      const result = await this.readRestoreResult(resultFile, nvrId, false);
      await this.evictRestoredRecords(tenantId, result);
    } catch {
      // No manifest means validation failed before any write was attempted.
    }
  }

  private async evictRestoredRecords(
    tenantId: string,
    result: FogRestoreResult,
  ): Promise<void> {
    await Promise.all([
      ...result.nvrIds.map((id) =>
        this.cacheService.delete(`${NvrModel.name}:${id}`),
      ),
      ...result.cameraIds.map((id) =>
        this.cacheService.delete(`${CameraModel.name}:${id}`),
      ),
      // Pages are tenant-scoped in the cache; the key must be built with the
      // same helper the repository writes with or eviction silently no-ops
      // and stale pre-restore pages keep being served.
      ...result.pageIds.map((id) =>
        this.cacheService.delete(pageCacheKey(tenantId, id)),
      ),
    ]);
  }

  private runCommand(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv = process.env,
  ): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const child = spawn(command, args, {
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timeout = setTimeout(
        () => child.kill('SIGKILL'),
        RESTORE_TIMEOUT_MS,
      );

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
        if (stdout.length > 4 * 1024 * 1024) child.kill('SIGKILL');
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
        if (stderr.length > 1024 * 1024) child.kill('SIGKILL');
      });
      child.on('error', (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      });
      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (code === 0) resolve(stdout);
        else
          reject(new Error(`${command} failed: ${stderr || `exit ${code}`}`));
      });
    });
  }

  /**
   * Extracts one Mongo archive member, killing the child process the instant
   * more than `maxBytes` has streamed out. Returns the number of bytes
   * actually written. The tdengine/ tree is extracted separately, in one
   * shared invocation — see extractTdengineTree — precisely so it does NOT
   * pay the cost of one of these spawns (and one full archive decompression
   * pass) per member.
   */
  private async extractArchiveMember(
    archive: string,
    member: string,
    destination: string,
    maxBytes: number = MAX_EXTRACTED_MONGO_FILE_SIZE,
  ): Promise<number> {
    const child = spawn('tar', ['-I', 'zstd', '-xOf', archive, '--', member], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let extractedBytes = 0;
    let budgetExceeded = false;
    const timeout = setTimeout(() => child.kill('SIGKILL'), RESTORE_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => {
      extractedBytes += chunk.length;
      if (extractedBytes > maxBytes) {
        budgetExceeded = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    const completed = new Promise<void>((resolve, reject) => {
      child.on('error', (error) => {
        // Without this the 10-minute kill timer keeps the event loop alive
        // after a spawn failure.
        clearTimeout(timeout);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) resolve();
        else reject(new Error(`tar extraction failed: ${stderr || code}`));
      });
    });
    try {
      await Promise.all([
        pipeline(child.stdout, createWriteStream(destination, { flags: 'wx' })),
        completed,
      ]);
    } catch (error) {
      // A kill triggered by the byte cap surfaces as a generic stream/exit
      // error from tar or the write pipeline; report the real cause instead.
      if (budgetExceeded) {
        throw new BadRequestException(
          `Fog backup member exceeds the extraction size budget: ${member}`,
        );
      }
      throw error;
    }
    if (budgetExceeded) {
      throw new BadRequestException(
        `Fog backup member exceeds the extraction size budget: ${member}`,
      );
    }
    return extractedBytes;
  }

  /**
   * Extracts the WHOLE fog backup's tdengine/ tree in a single
   * `tar -I zstd -x` invocation, however many members it contains. A
   * per-member loop (the previous design) forces GNU tar to decompress from
   * the start of the archive for every single call, even the first member —
   * measured at ~9 CPU-minutes for an archive tuned to sit just under the
   * upload cap, and a large member count made that multiply. One invocation
   * means the archive is decompressed exactly once regardless of member
   * count, and RESTORE_TIMEOUT_MS's existing per-spawn kill timer is now
   * also the aggregate deadline for the whole tree, since there is only one
   * spawn.
   *
   * Because tar is given the explicit member list, every byte it writes
   * under `scratchDirectory` belongs to this tree (nothing else can land
   * there) — so the shared byte budget can be enforced by polling the
   * directory's total on-disk size rather than needing per-file streaming
   * hooks. Polling is real-time defense for a slow/large extraction; the
   * final check after the process exits is what makes small/fast
   * extractions (as in tests) deterministic regardless of poll timing.
   *
   * Returns the resolved directory that actually holds the dump (the
   * "tdengine" segment of the members' shared path, which may sit under an
   * arbitrary prefix — see selectMongoBackupMembers).
   */
  private async extractTdengineTree(
    archive: string,
    members: string[],
    scratchDirectory: string,
    nvrId: string,
    budget: number = MAX_EXTRACTED_TDENGINE_TREE_BYTES,
  ): Promise<string> {
    const rootSegments = this.tdengineRootSegments(members, nvrId);
    await mkdir(scratchDirectory, { recursive: true });

    const child = spawn(
      'tar',
      ['-I', 'zstd', '-x', '-f', archive, '-C', scratchDirectory, '--', ...members],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let stderr = '';
    let budgetExceeded = false;
    let settled = false;
    const timeout = setTimeout(() => child.kill('SIGKILL'), RESTORE_TIMEOUT_MS);
    const poll = setInterval(() => {
      void this.directorySize(scratchDirectory).then((size) => {
        if (!budgetExceeded && size > budget) {
          budgetExceeded = true;
          child.kill('SIGKILL');
        }
      });
    }, TDENGINE_EXTRACTION_POLL_MS);
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    try {
      await new Promise<void>((resolve, reject) => {
        child.on('error', (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        });
        child.on('close', (code) => {
          if (settled) return;
          settled = true;
          if (code === 0) resolve();
          else reject(new Error(`tar extraction failed: ${stderr || code}`));
        });
      });
    } catch (error) {
      if (!budgetExceeded) throw error;
      // fall through: report the budget as the cause below, not tar's exit.
    } finally {
      clearTimeout(timeout);
      clearInterval(poll);
    }

    // Authoritative regardless of whether any poll fired — covers the common
    // case in a small/fast extraction where the process exits before the
    // first poll interval elapses.
    const finalSize = await this.directorySize(scratchDirectory);
    if (budgetExceeded || finalSize > budget) {
      throw new BadRequestException(
        `Fog TDengine backup exceeds the total extraction size budget (nvr ${nvrId})`,
      );
    }
    return join(scratchDirectory, ...rootSegments);
  }

  /**
   * Every selected tdengine member's path must agree on where the "tdengine"
   * segment sits (see selectMongoBackupMembers, which tolerates an arbitrary
   * prefix before it). Using a plain substring search here (`indexOf('tdengine/')`)
   * would disagree with the segment-based check the selector uses — a path
   * like `x/mytdengine/y/tdengine/z` would resolve differently in each place.
   * Requiring every member to share the exact same prefix keeps this
   * deterministic and matches the selector's own segment semantics.
   */
  private tdengineRootSegments(members: string[], nvrId: string): string[] {
    let root: string[] | undefined;
    for (const member of members) {
      const segments = member.split('/').filter(Boolean);
      const tdengineIndex = segments.indexOf('tdengine');
      if (tdengineIndex < 0) {
        throw new BadRequestException(
          `Fog backup TDengine member has an invalid path (nvr ${nvrId})`,
        );
      }
      const candidate = segments.slice(0, tdengineIndex + 1);
      if (!root) {
        root = candidate;
      } else if (candidate.join('/') !== root.join('/')) {
        throw new BadRequestException(
          `Fog backup TDengine tree has inconsistent root paths (nvr ${nvrId})`,
        );
      }
    }
    // members.tdengine is only ever set (see selectMongoBackupMembers) when
    // it has at least one entry, so root is always defined by this point.
    return root!;
  }

  /** Recursively sums the size of every regular file under `dir`. */
  private async directorySize(dir: string): Promise<number> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return 0; // not created yet, or already cleaned up
    }
    let total = 0;
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        total += await this.directorySize(full);
      } else if (entry.isFile()) {
        try {
          total += (await stat(full)).size;
        } catch {
          // Transient: tar may still be writing or have just removed it.
        }
      }
    }
    return total;
  }
}
