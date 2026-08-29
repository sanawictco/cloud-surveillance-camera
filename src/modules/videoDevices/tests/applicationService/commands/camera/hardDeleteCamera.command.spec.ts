import {
  HardDeleteCameraCommand,
  HardDeleteCameraCommandHandler,
} from '../../../../applicationService/commands/camera/hardDeleteCamera.command';
import { CameraEntity } from '../../../../domain/camera/camera.entity';

describe('HardDeleteCameraCommandHandler', () => {
  it('physically removes a camera after hard deletion', async () => {
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
    camera.softDelete();
    const repository = {
      findById: jest.fn().mockResolvedValue(camera),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const systemLogs = { deleteSystemLogs: jest.fn() };
    const actorLogs = { hardDelete: jest.fn().mockResolvedValue(undefined) };
    const handler = new HardDeleteCameraCommandHandler(
      repository as never,
      systemLogs as never,
      actorLogs as never,
    );

    await handler.execute(
      new HardDeleteCameraCommand({
        id: camera.id,
        tenantId: camera.getProps().tenantId,
      }),
    );

    expect(repository.delete).toHaveBeenCalledWith(camera);
    expect(systemLogs.deleteSystemLogs).toHaveBeenCalledWith(
      camera.getProps().tenantId,
      camera.id,
    );
  });
});
