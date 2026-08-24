import {
  BadRequestException,
  Injectable,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { DashboardApiForFogCommunicationManagerService } from '../dashboard/applicationService/apiForAnotherServices/dashboardApiForFogCommunicationManager.service';

import { UploadFileDto } from './contracts/fileUpload.request.dto';
import { FogConfigReqDto } from './contracts/fogConfig.dto';
import { FogConfigResponseDto } from './contracts/fogConfig.response.dto';
import { VideoDevicesApiForFogCommunicationManagerService } from '../videoDevices/applicationService/services/apiForAnotherServices/videoDevicesApiForFogCommunicationManager.service';
import { ApiNodeProxyService } from 'src/extensions/http/apiNodeProxy.service';
import { ApiNodeProxyRequestDto } from './contracts/apiNodeProxy.request.dto';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require('node:fs');

// Shared bind-mount where the multipart upload lands and the DB dumps are
// extracted (see fileUpload.ts: diskStorage destination + docker-compose backend
// volume /var/sanaw/cloud_shared_backups:/cloud_shared_backups).
const BACKUP_ROOT = '/cloud_shared_backups';
const BACKUP_ARCHIVE = `${BACKUP_ROOT}/backups.tar.zst`;
const MONGO_BACKUP_DIR = `${BACKUP_ROOT}/mongo`;
const TDENGINE_BACKUP_DIR = `${BACKUP_ROOT}/tdengine`;
// Vetted restore script shipped WITH the app, resolved relative to the process
// cwd so the SAME code works in production (Dockerfile COPYs it to /app/scripts;
// cwd=/app) and in dev via `npm run start:dev` (cwd = repo root → scripts/).
// Override with FOG_MONGO_RESTORE_SCRIPT if the process is launched elsewhere.
// Deliberately NOT run from BACKUP_ROOT, so a fog-supplied tarball can never get
// its own mongo-restore.sh executed.
const MONGO_RESTORE_SCRIPT =
  process.env.FOG_MONGO_RESTORE_SCRIPT ??
  join(process.cwd(), 'scripts', 'mongo-restore.sh');
// Per-step wall-clock cap, configurable via FOG_RESTORE_STEP_TIMEOUT_MS. The
// default is generous (10 min): unlike the previous SOFT timeout, hitting it now
// actually terminates the tool, so a hard 60s would kill a large dump mid-write.
// On timeout the child gets SIGTERM, then SIGKILL after the grace window, giving
// the tool a chance to flush/exit cleanly first.
const _parsedStepTimeout = Number(process.env.FOG_RESTORE_STEP_TIMEOUT_MS);
const RESTORE_STEP_TIMEOUT_MS =
  Number.isFinite(_parsedStepTimeout) && _parsedStepTimeout > 0
    ? _parsedStepTimeout
    : 600000;
const RESTORE_KILL_GRACE_MS = 10000;
const API_NODE_PROXY_DEADLINE_MS = 10000;

@Injectable()
export class FogCommunicationManagerService implements OnApplicationBootstrap {
  constructor(
    private readonly videoDevicesApiForFogCommunicationManagerService: VideoDevicesApiForFogCommunicationManagerService,
    private readonly dashboardApiForFogCommunicationManagerService: DashboardApiForFogCommunicationManagerService,
    private readonly apiNodeProxyService: ApiNodeProxyService,
  ) {}
  async onApplicationBootstrap() {
    await this.videoDevicesApiForFogCommunicationManagerService.sendCloudIsAvailableSignalToFog();
  }

  async deliverMqttConfigOverHttpToFog(
    body: FogConfigReqDto,
  ): Promise<FogConfigResponseDto> {
    const nvr =
      await this.videoDevicesApiForFogCommunicationManagerService.findFogNvrBySerialNumber(
        body.serialNumber,
      );
    if (!nvr) throw new BadRequestException('the nvr does not exist');
    if (nvr.accessToken !== body.accessToken)
      throw new BadRequestException('invalid nvr');
    let fogConfig: FogConfigResponseDto | undefined;
    if (body.configType === 'videoDevice') {
      fogConfig =
        await this.videoDevicesApiForFogCommunicationManagerService.getVideoDeviceConfigFromQueue(
          String(body.msgId),
        );
    } else if (body.configType === 'page') {
      fogConfig =
        await this.dashboardApiForFogCommunicationManagerService.getPageConfigFromQueue(
          String(body.msgId),
        );
    }

    if (!fogConfig) throw new BadRequestException('no msg with this msgId');
    return fogConfig;
  }

  async proxyApiNodeRequest(body: ApiNodeProxyRequestDto) {
    const deadlineAt = Date.now() + API_NODE_PROXY_DEADLINE_MS;
    let timeoutId: NodeJS.Timeout | undefined;
    const nvr = await Promise.race([
      this.videoDevicesApiForFogCommunicationManagerService.findFogNvrBySerialNumber(
        body.serialNumber,
      ),
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(
          () =>
            reject(
              new BadRequestException('apiNode proxy authentication timed out'),
            ),
          API_NODE_PROXY_DEADLINE_MS,
        );
      }),
    ]).finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });
    if (!nvr || nvr.accessToken !== body.accessToken)
      throw new BadRequestException('invalid nvr');

    return this.apiNodeProxyService.execute(
      {
        url: body.url,
        method: body.method,
        parameters: body.parameters,
        headers: body.headers,
      },
      deadlineAt,
    );
  }

  async restoreFogBackupToCloud(body: UploadFileDto) {
    const nvr =
      await this.videoDevicesApiForFogCommunicationManagerService.findFogNvrBySerialNumber(
        body.serialNumber,
      );
    if (!nvr) throw new BadRequestException('the nvr does not exist');
    if (nvr.accessToken !== body.accessToken)
      throw new BadRequestException(
        'no nvr with this accessToken is registered',
      );
    // start cloud recovery
    if (nvr.cloudIsRecovering) return;
    try {
      await this.videoDevicesApiForFogCommunicationManagerService.startFogCloudRecovery(
        nvr.id,
      );
      const extractResult = await this._extractBackup();
      // _extractBackup swallows its errors and returns undefined on failure;
      // abort here so the DB restore does not run on stale/partial files.
      if (!extractResult)
        throw new BadRequestException('failed to extract fog backup');
      await this._restoreMongoBackup();
      await this._restoreTdengineBackup();
      // finish cloud recovery
      await this.videoDevicesApiForFogCommunicationManagerService.completeFogCloudRecovery(
        body.serialNumber,
      );
    } catch (err) {
      // On failure, clear the recovering flag so the nvr is not left
      // permanently locked out of future restore attempts, then rethrow so the
      // caller still observes the error.
      await this.videoDevicesApiForFogCommunicationManagerService.resetFogCloudRecovery(
        nvr.id,
      );
      throw err;
    } finally {
      await this._cleanBackup();
    }
  }

  /**
   * Run a restore tool locally (inside THIS backend container) and stream its
   * stdout/stderr to the backend logs. Replaces the previous docker-exec
   * (dockerode over /var/run/docker.sock) approach — the tools now talk to
   * mongo/tdengine over the internal Docker network, so the backend no longer
   * needs the host Docker socket. Rejects on spawn error, non-zero exit, or the
   * per-step timeout (the child is SIGKILL'd so it cannot leak).
   */
  private _runCommand(
    command: string,
    args: string[],
    options: { env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
  ): Promise<void> {
    const timeoutMs = options.timeoutMs ?? RESTORE_STEP_TIMEOUT_MS;
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        env: options.env ? { ...process.env, ...options.env } : process.env,
        // stdin closed; stdout/stderr inherited so tool output lands in the logs
        // (same visibility the old demuxStream(stream, process.stdout/stderr) gave).
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      let settled = false;
      let killTimer: NodeJS.Timeout | undefined;
      // On timeout, ask the tool to stop (SIGTERM); force-kill only if it ignores
      // the grace window, so a long-but-legitimate restore is not torn apart
      // mid-write. The 'close' handler settles the promise in every case.
      const timeoutId = setTimeout(() => {
        child.kill('SIGTERM');
        killTimer = setTimeout(
          () => child.kill('SIGKILL'),
          RESTORE_KILL_GRACE_MS,
        );
      }, timeoutMs);
      const cleanup = () => {
        clearTimeout(timeoutId);
        if (killTimer) clearTimeout(killTimer);
      };
      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err);
      });
      child.on('close', (code, signal) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (code === 0) resolve();
        else
          reject(
            new Error(
              `${command} exited with ${code !== null ? `code ${code}` : `signal ${signal}`}`,
            ),
          );
      });
    });
  }

  /**
   * Connection params for mongo-restore.sh, read from the backend's own env (in
   * production MONGO_DB_PASSWORD is expanded from the Docker secret by
   * docker-entrypoint.sh). Username/password empty outside production → the
   * script connects without auth, matching app.config's mongo URL behavior.
   */
  private _mongoRestoreEnv(): NodeJS.ProcessEnv {
    return {
      MONGO_RESTORE_HOST: process.env.MONGO_DB_HOST,
      MONGO_RESTORE_PORT: process.env.MONGO_DB_PORT,
      MONGO_RESTORE_DB: process.env.MONGO_DB_NAME,
      MONGO_RESTORE_USER: process.env.MONGO_DB_USERNAME ?? '',
      MONGO_RESTORE_PASSWORD: process.env.MONGO_DB_PASSWORD ?? '',
      MONGO_RESTORE_AUTHDB: process.env.MONGO_DB_AUTH_SOURCE ?? 'admin',
      MONGO_RESTORE_DIR: MONGO_BACKUP_DIR,
    };
  }

  private async _restoreMongoBackup() {
    try {
      if (!fs.existsSync(MONGO_BACKUP_DIR))
        fs.mkdirSync(MONGO_BACKUP_DIR, { recursive: true });
      // Same restore logic as before (mongoimport --mode=merge + the nvrs
      // selective-upsert), but executed from the backend against mongo:27017
      // with auth, instead of via docker exec inside the mongo container.
      await this._runCommand('bash', [MONGO_RESTORE_SCRIPT], {
        env: this._mongoRestoreEnv(),
      });
      return { success: true, message: 'mongo restore completed successfully' };
    } catch (error) {
      console.error('Error during mongo restore:', error);
      throw error;
    }
  }

  private async _restoreTdengineBackup() {
    try {
      if (!fs.existsSync(TDENGINE_BACKUP_DIR))
        fs.mkdirSync(TDENGINE_BACKUP_DIR, { recursive: true });
      // taosdump -i, same as before, but run from the backend over the native
      // connection to the tdengine service (port 6030 by default) instead of via
      // docker exec inside the tdengine container. -p takes the password
      // attached (taosdump getopt form).
      const host = process.env.TIME_SERIES_DB_HOST ?? 'tdengine';
      const port = process.env.TIME_SERIES_DB_NATIVE_PORT ?? '6030';
      const user = process.env.TIME_SERIES_DB_USER ?? 'root';
      const password = process.env.TIME_SERIES_DB_PASSWORD ?? '';
      await this._runCommand('taosdump', [
        '-h',
        host,
        '-P',
        port,
        '-u',
        user,
        `-p${password}`,
        '-i',
        TDENGINE_BACKUP_DIR,
      ]);
      return {
        success: true,
        message: 'tdengine backup completed successfully',
      };
    } catch (error) {
      console.error('Error during tdengine backup:', error);
      throw error;
    }
  }

  private async _extractBackup(): Promise<
    { success: boolean; message: string } | undefined
  > {
    try {
      // Extract the uploaded archive locally (the backend image now ships tar +
      // zstd). --strip-components=1 drops the tarball's top dir so the dumps land
      // at /cloud_shared_backups/{mongo,tdengine} exactly as the restore steps
      // expect — identical to the previous in-container extraction.
      await this._runCommand('tar', [
        '-I',
        'zstd',
        '-xf',
        BACKUP_ARCHIVE,
        '--strip-components=1',
        '-C',
        BACKUP_ROOT,
      ]);
      return {
        success: true,
        message: 'extract backup completed successfully',
      };
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }

  private async _cleanBackup(): Promise<
    { message: string; success: boolean } | undefined
  > {
    try {
      // Remove the extracted dumps + the uploaded archive from the shared dir.
      // Local fs removal (the files live in this backend's mount) replaces the
      // previous docker-exec `rm -rf`. force:true → no error if already gone.
      await Promise.all(
        [MONGO_BACKUP_DIR, TDENGINE_BACKUP_DIR, BACKUP_ARCHIVE].map((target) =>
          fs.promises.rm(target, { recursive: true, force: true }),
        ),
      );
      return {
        success: true,
        message: 'clean backup completed successfully',
      };
    } catch (err) {
      console.log(err);
      return undefined;
    }
  }
}
