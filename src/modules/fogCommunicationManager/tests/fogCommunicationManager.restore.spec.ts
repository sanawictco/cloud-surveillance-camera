import { ConflictException } from '@nestjs/common';
import { writeFile } from 'node:fs/promises';
import { FogCommunicationManagerService } from '../fogCommunicationManager.service';
import { pageCacheKey } from '../../dashboard/infra/schemas/page.schema';

describe('FogCommunicationManagerService restore', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const nvrId = '22222222-2222-4222-8222-222222222222';
  const serialNumber = 'NVR00001';
  const accessToken = '1'.repeat(32);
  const uploadPath = '/tmp/opencode/fog-restore-upload.tar.zst';

  function buildService() {
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
    const service = new FogCommunicationManagerService(
      fogApi as never,
      cache as never,
    );
    const file = { path: uploadPath } as Express.Multer.File;
    const nvr = {
      id: nvrId,
      tenantId,
      serialNumber,
      accessToken,
      cloudIsRecovering: false,
    };
    return { service, fogApi, cache, file, nvr };
  }

  beforeEach(async () => {
    await writeFile(uploadPath, 'archive');
  });

  it('fails closed when the scoped restore lock is unavailable', async () => {
    const context = buildService();
    context.cache.acquireLock.mockResolvedValue(null);
    const runCommand = jest.spyOn(context.service as never, 'runCommand');

    await expect(
      context.service.restoreFogBackupToCloud(context.nvr, context.file),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(runCommand).not.toHaveBeenCalled();
  });

  it('passes authenticated scope to the importer and evicts only restored IDs', async () => {
    const context = buildService();
    jest
      .spyOn(context.service as never, 'extractArchiveMember')
      .mockResolvedValue(undefined);
    const runCommand = jest
      .spyOn(context.service as never, 'runCommand')
      .mockResolvedValueOnce('backups/mongo/cameras.json\n')
      .mockImplementationOnce(
        async (_command: string, _args: string[], env: NodeJS.ProcessEnv) => {
          await writeFile(
            env.MONGO_RESTORE_RESULT_FILE!,
            JSON.stringify({
              completed: true,
              nvrIds: [nvrId],
              cameraIds: ['33333333-3333-4333-8333-333333333333'],
              pageIds: ['44444444-4444-4444-8444-444444444444'],
            }),
          );
          return '';
        },
      );

    await context.service.restoreFogBackupToCloud(context.nvr, context.file);

    const importerEnv = runCommand.mock.calls[1]![2]!;
    expect(importerEnv).toEqual(
      expect.objectContaining({
        MONGO_RESTORE_TENANT_ID: tenantId,
        MONGO_RESTORE_NVR_ID: nvrId,
        MONGO_RESTORE_SERIAL_NUMBER: serialNumber,
      }),
    );
    // recovery is scoped by the authenticated NVR's persisted tenant, so the
    // NVR is re-read under that tenant rather than by ID alone
    expect(context.fogApi.startFogCloudRecovery).toHaveBeenCalledWith(
      tenantId,
      nvrId,
    );
    expect(context.fogApi.completeFogCloudRecovery).toHaveBeenCalledWith(
      serialNumber,
    );
    expect(context.cache.delete).toHaveBeenCalledTimes(3);
    // Pages are cached under a tenant-scoped key. Asserting the exact key (not
    // just the eviction count) is what catches the repository and the evictor
    // drifting apart and silently serving stale pre-restore pages.
    expect(context.cache.delete).toHaveBeenCalledWith(
      pageCacheKey(tenantId, '44444444-4444-4444-8444-444444444444'),
    );
    expect(context.cache.releaseLock).toHaveBeenCalledWith(
      `fog-restore:${tenantId}:${nvrId}`,
      'lock-token',
    );
  });
});
