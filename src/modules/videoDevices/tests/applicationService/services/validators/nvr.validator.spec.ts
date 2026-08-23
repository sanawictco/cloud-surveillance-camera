import { NvrValidator } from '../../../../applicationService/services/validators/nvr.validator';
import { CameraEntity } from '../../../../domain/camera/camera.entity';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';

describe('NvrValidator auto-register', () => {
  it('calculates capacity from non-deleted cameras only', async () => {
    const nvr = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-1',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 2,
      password: 'nvr-password',
    });
    const currentCamera = CameraEntity.create({
      tenantId: nvr.getProps().tenantId,
      nvrId: nvr.id,
      name: 'Existing camera',
      productModel: 'CAM-1',
      serialNumber: 'CAM00001',
      username: 'private-user',
      password: 'private-password',
      macAddress: 'AA:BB:CC:DD:EE:01',
      port: 554,
      streams: {
        recordStream: { token: '', path: '', resolutions: [] },
        liveStream: { token: '', path: '', resolutions: [] },
      },
      hasPtz: true,
      hasAudio: false,
    });
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue([currentCamera]) },
    };
    const cache = {
      get: jest.fn().mockResolvedValue({
        addedCameras: [
          {
            managementCameraId: 2,
            cameraAggregateId: '22222222-2222-4222-8222-222222222222',
            serialNumber: 'CAM00002',
            productModel: 'CAM-1',
            username: 'private-user',
            password: 'private-password',
            macAddress: 'AA:BB:CC:DD:EE:02',
            streams: JSON.stringify({
              recordStream: { token: '', path: '', resolutions: [] },
              liveStream: { token: '', path: '', resolutions: [] },
            }),
            port: 554,
            hasPtz: true,
            hasAudio: false,
            name: 'New camera',
          },
        ],
        deletedCameras: [],
      }),
    };
    const validator = new NvrValidator(
      serviceProvider as never,
      cache as never,
    );

    await expect(
      validator.validateAndBuildAutoRegisterBatch(
        {
          nvrId: nvr.id,
          addedCameras: ['CAM00002'],
          deletedCameras: [],
        },
        nvr,
      ),
    ).resolves.toEqual(
      expect.objectContaining({
        addedCameras: [expect.objectContaining({ serialNumber: 'CAM00002' })],
      }),
    );
    expect(serviceProvider.queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { nvrId: nvr.id, isDeleted: { $ne: true } },
      }),
    );
  });
});
