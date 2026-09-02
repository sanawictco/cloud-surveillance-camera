import { BadRequestException } from '@nestjs/common';
import { NvrValidator } from '../../../../applicationService/services/validators/nvr.validator';
import { FindNvrByNameForTenantQuery } from '../../../../applicationService/queries/nvr/findNvrByName.queryHandler';
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

describe('NvrValidator name duplication', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';

  function buildValidator(existing?: unknown) {
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(existing) },
      translatorService: { translateByName: jest.fn(() => 'duplicated') },
      userInfoService: { getProps: jest.fn(() => ({ lang: 'en' })) },
    };
    const validator = new NvrValidator(serviceProvider as never, {} as never);
    return { validator, serviceProvider };
  }

  it('scopes the create check to the caller tenant', async () => {
    const { validator, serviceProvider } = buildValidator(undefined);

    await expect(
      validator.checkAvoidNvrDuplicationCreate('Lobby NVR', tenantId),
    ).resolves.toBe(true);

    // Names are unique per tenant: an unscoped query would reject a name that
    // is only taken in some other tenant, and leak that it is taken.
    const dispatched = serviceProvider.queryBus.execute.mock.calls[0]![0];
    expect(dispatched).toBeInstanceOf(FindNvrByNameForTenantQuery);
    expect(dispatched).toEqual(
      expect.objectContaining({ tenantId, name: 'Lobby NVR' }),
    );
  });

  it('rejects a name already used inside the same tenant', async () => {
    const { validator } = buildValidator({ id: 'other-nvr' });

    await expect(
      validator.checkAvoidNvrDuplicationCreate('Lobby NVR', tenantId),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets an NVR keep its own name on update', async () => {
    const { validator, serviceProvider } = buildValidator({ id: 'nvr-1' });

    await expect(
      validator.checkAvoidNvrDuplicationUpdate('Lobby NVR', 'nvr-1', tenantId),
    ).resolves.toBe(true);

    expect(serviceProvider.queryBus.execute.mock.calls[0]![0]).toBeInstanceOf(
      FindNvrByNameForTenantQuery,
    );
  });
});
