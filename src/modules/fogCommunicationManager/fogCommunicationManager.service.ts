import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
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
      const resultFile = join(stagingRoot, 'result.json');

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

  private async extractArchiveMember(
    archive: string,
    member: string,
    destination: string,
  ): Promise<void> {
    const child = spawn('tar', ['-I', 'zstd', '-xOf', archive, '--', member], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    let extractedBytes = 0;
    const timeout = setTimeout(() => child.kill('SIGKILL'), RESTORE_TIMEOUT_MS);
    child.stdout.on('data', (chunk: Buffer) => {
      extractedBytes += chunk.length;
      if (extractedBytes > MAX_EXTRACTED_MONGO_FILE_SIZE) {
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
    await Promise.all([
      pipeline(child.stdout, createWriteStream(destination, { flags: 'wx' })),
      completed,
    ]);
  }
}
