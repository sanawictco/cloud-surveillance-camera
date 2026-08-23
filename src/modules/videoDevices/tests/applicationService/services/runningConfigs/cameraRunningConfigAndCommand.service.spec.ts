import { CameraRunningConfigAndCommandService } from '../../../../applicationService/services/runningConfigs/cameraRunningConfigAndCommand.service';
import { UpdateCameraCommand } from '../../../../applicationService/commands/camera/updateCamera.command';
import { CameraEntity } from '../../../../domain/camera/camera.entity';

describe('CameraRunningConfigAndCommandService', () => {
  it('removes the pre-delete queue messages from a running-config snapshot', async () => {
    const camera = CameraEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      nvrId: '33333333-3333-4333-8333-333333333333',
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
    const configQueue = {
      getAndDeleteRepeatableMsg: jest.fn().mockResolvedValue(undefined),
    };
    const dataQueue = {
      getAndDeleteRepeatableMsg: jest.fn().mockResolvedValue(undefined),
    };
    const serviceProvider = {
      queryBus: { execute: jest.fn() },
      commandBus: { execute: jest.fn().mockResolvedValue(undefined) },
    };
    const service = new CameraRunningConfigAndCommandService(
      configQueue as never,
      dataQueue as never,
      serviceProvider as never,
    );

    await service.stopAndRemoveAllRunningConfigs(camera, {
      update: 'update-msg',
    });

    expect(serviceProvider.queryBus.execute).not.toHaveBeenCalled();
    expect(configQueue.getAndDeleteRepeatableMsg).toHaveBeenCalledWith(
      'update-msg',
    );
    expect(dataQueue.getAndDeleteRepeatableMsg).toHaveBeenCalledWith(
      'update-msg',
    );
    expect(serviceProvider.commandBus.execute).toHaveBeenCalledWith(
      expect.any(UpdateCameraCommand),
    );
  });
});
