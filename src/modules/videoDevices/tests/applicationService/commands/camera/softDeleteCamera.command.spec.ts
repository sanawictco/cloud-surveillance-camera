import {
  SoftDeleteCameraCommand,
  SoftDeleteCameraCommandHandler,
} from '../../../../applicationService/commands/camera/softDeleteCamera.command';
import { CameraEntity } from '../../../../domain/camera/camera.entity';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';

describe('SoftDeleteCameraCommandHandler', () => {
  it('updates the deleted camera without physically removing it', async () => {
    const nvr = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    const camera = CameraEntity.create({
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: nvr.getProps().tenantId,
      nvrId: nvr.id,
      name: 'Camera',
      productModel: 'CAM-1',
      serialNumber: 'CAM00001',
      username: 'private-user',
      password: 'private-password',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      port: 554,
      streams: {
        recordStream: { token: '', path: '', resolutions: [] },
        liveStream: { token: '', path: '', resolutions: [] },
      },
      hasPtz: true,
      hasAudio: false,
    });
    camera.update({ runningConfigs: { update: 'update-msg' } });
    const repository = {
      findById: jest.fn().mockResolvedValue(camera),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    const dashboard = {
      deleteCameraEffectFromWidgets: jest.fn().mockResolvedValue(undefined),
    };
    const runningConfigs = {
      stopAndRemoveAllRunningConfigs: jest.fn().mockResolvedValue(undefined),
    };
    const actorLogs = { delete: jest.fn().mockResolvedValue(undefined) };
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(nvr) },
    };
    const handler = new SoftDeleteCameraCommandHandler(
      repository as never,
      dashboard as never,
      runningConfigs as never,
      actorLogs as never,
      serviceProvider as never,
    );

    await expect(
      handler.execute(
        new SoftDeleteCameraCommand({
          id: camera.id,
          actorProps: { actorId: 'employee-id' },
        }),
      ),
    ).resolves.toBe(camera.id);

    expect(camera.getProps().isDeleted).toBe(true);
    expect(repository.update).toHaveBeenCalledWith(camera);
    expect(repository.delete).not.toHaveBeenCalled();
    expect(runningConfigs.stopAndRemoveAllRunningConfigs).toHaveBeenCalledWith(
      camera,
      { update: 'update-msg' },
    );
  });
});
