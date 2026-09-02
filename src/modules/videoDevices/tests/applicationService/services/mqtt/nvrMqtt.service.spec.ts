import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { NvrMqttService } from '../../../../applicationService/services/mqtt/nvrMqtt.service';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';
import { NvrWebSocketConfigTypes } from '../../../../domain/nvr/nvr.type';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const NVR_B = '44444444-4444-4444-8444-444444444444';
const CAMERA_A = '55555555-5555-4555-8555-555555555555';
const CAMERA_FOREIGN = '66666666-6666-4666-8666-666666666666';
const TENANT_FOREIGN = '77777777-7777-4777-8777-777777777777';

describe('NvrMqttService async tenant scope', () => {
  function buildService(cameraByQuery: Record<string, unknown> = {}) {
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const queryBus = {
      execute: jest.fn(async (query: any) => cameraByQuery[query.id]),
    };
    const service = new NvrMqttService(
      { commandBus, queryBus } as never,
      { toResponse: jest.fn() } as never,
      { toResponseAll: jest.fn().mockReturnValue([]) } as never,
      { sendTenantMessage: jest.fn(), channels: { VIDEO_DEVICES_SOCKET: 'ws' } } as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, commandBus, queryBus };
  }

  const nvr = {
    id: NVR_A,
    getProps: () => ({ tenantId: TENANT_A, isActive: true }),
  };

  it('rejects a queued payload that targets another NVR', async () => {
    const context = buildService();

    await expect(
      context.service.activateCameras(
        TENANT_A,
        nvr as never,
        { id: NVR_B, cameraIds: [CAMERA_A] },
        { actorProps: { actorId: 'user' }, msgId: '101' },
      ),
    ).rejects.toThrow(/NVR identity mismatch/);
    expect(context.commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects a camera ID that does not resolve under the validated tenant', async () => {
    const context = buildService({});

    await expect(
      context.service.activateCameras(
        TENANT_A,
        nvr as never,
        { id: NVR_A, cameraIds: [CAMERA_FOREIGN] },
        { actorProps: { actorId: 'user' }, msgId: '101' },
      ),
    ).rejects.toThrow(/camera identity mismatch/);
    expect(context.commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects a camera that belongs to a sibling NVR', async () => {
    const context = buildService({
      [CAMERA_A]: {
        id: CAMERA_A,
        getProps: () => ({ tenantId: TENANT_A, nvrId: NVR_B }),
      },
    });

    await expect(
      context.service.inactivateCameras(
        TENANT_A,
        nvr as never,
        { id: NVR_A, cameraIds: [CAMERA_A] },
        { actorProps: { actorId: 'user' }, msgId: '101' },
      ),
    ).rejects.toThrow(/camera identity mismatch/);
    expect(context.commandBus.execute).not.toHaveBeenCalled();
  });

  it('passes the validated tenant into the soft-delete command', async () => {
    const context = buildService({
      [CAMERA_A]: {
        id: CAMERA_A,
        getProps: () => ({
          tenantId: TENANT_A,
          nvrId: NVR_A,
          isDeleted: false,
        }),
      },
    });

    await context.service.softDeleteCameras(
      TENANT_A,
      nvr as never,
      { id: NVR_A, cameraIds: [CAMERA_A] },
      { actorProps: { actorId: 'user' }, msgId: '101' },
    );

    expect(context.commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ id: CAMERA_A, tenantId: TENANT_A }),
    );
  });

  it('reads the camera with a tenant-scoped query', async () => {
    const context = buildService({
      [CAMERA_A]: {
        id: CAMERA_A,
        getProps: () => ({
          tenantId: TENANT_A,
          nvrId: NVR_A,
          isDeleted: true,
        }),
      },
    });

    await context.service.softDeleteCameras(
      TENANT_A,
      nvr as never,
      { id: NVR_A, cameraIds: [CAMERA_A] },
      { actorProps: { actorId: 'user' }, msgId: '101' },
    );

    expect(context.queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: TENANT_A, id: CAMERA_A }),
    );
  });
});

describe('NvrMqttService search', () => {
  function buildService(currentCameras: unknown[] = []) {
    const nvr = NvrEntity.create({
      tenantId: TENANT_A,
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(currentCameras) },
    };
    const websocketService = {
      channels: { VIDEO_DEVICES_SOCKET: 'VideoDevicesSocket' },
      sendTenantMessage: jest.fn(),
    };
    const sanawApi = { getNvrCameraSearchInfo: jest.fn() };
    const stored: Record<string, unknown> = {};
    const cache = {
      set: jest.fn(async (key: string, value: unknown) => {
        stored[key] = value;
      }),
      get: jest.fn(async (key: string) => stored[key]),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NvrMqttService(
      serviceProvider as never,
      {} as never,
      {} as never,
      websocketService as never,
      {} as never,
      sanawApi as never,
      cache as never,
    );
    return { service, nvr, websocketService, sanawApi, cache };
  }

  function discoveredCamera() {
    return {
      id: 1,
      cameraAggregateId: CAMERA_A,
      serialNumber: 'CAM00001',
      productModel: 'CAM-1',
      username: 'private-user',
      password: 'private-password',
      macAddress: 'AA:BB:CC:DD:EE:FF',
      streams: {
        recordStream: { token: 'record', path: '/record', resolutions: [] },
        liveStream: { token: 'live', path: '/live', resolutions: [] },
      },
      port: 554,
      hasPtz: true,
      hasAudio: false,
    };
  }

  it('emits one completion when all connected cameras are up to date', async () => {
    const context = buildService();

    await context.service.search(context.nvr, 'search-msg', {
      msgId: 'search-msg',
      macAddresses: [],
    } as never);

    expect(context.cache.set).toHaveBeenCalledWith(
      `autoSearchNvr-${context.nvr.id}`,
      { addedCameras: [], deletedCameras: [] },
      1800,
    );
    expect(context.websocketService.sendTenantMessage).toHaveBeenCalledTimes(1);
    const [tenantId, channel, message] =
      context.websocketService.sendTenantMessage.mock.calls[0]!;
    expect(tenantId).toBe(TENANT_A);
    expect(channel).toBe('VideoDevicesSocket');
    expect(message.message.msgKey).toBe(
      LanguageKeys.nvr.response.socket.allConnectedCamerasAreUpToDate,
    );
    expect(message.metadata).toEqual({
      configType: NvrWebSocketConfigTypes.SEARCH,
      msgId: 'search-msg',
    });
  });

  it('keeps discovered camera credentials in the private cache only', async () => {
    const context = buildService();
    context.sanawApi.getNvrCameraSearchInfo.mockResolvedValue({
      statusCode: 200,
      data: { cameras: [discoveredCamera()] },
    });

    await context.service.search(context.nvr, 'search-msg', {
      msgId: 'search-msg',
      macAddresses: ['AA:BB:CC:DD:EE:FF'],
    } as never);

    // The credentials the fog needs to adopt the camera live in the cache...
    expect(context.cache.set).toHaveBeenCalledWith(
      `autoSearchNvr-${context.nvr.id}`,
      expect.objectContaining({
        addedCameras: [
          expect.objectContaining({
            username: 'private-user',
            password: 'private-password',
          }),
        ],
      }),
      1800,
    );

    // ...and must never reach the tenant's websocket room.
    const publicMessage =
      context.websocketService.sendTenantMessage.mock.calls[0]![2];
    expect(publicMessage.data.videoDevices[0].addedCameras).toEqual([
      {
        productModel: 'CAM-1',
        serialNumber: 'CAM00001',
        name: 'Camera CAM00001',
        hasPtz: true,
        hasAudio: false,
      },
    ]);
    expect(JSON.stringify(publicMessage)).not.toMatch(
      /private-user|private-password|AA:BB:CC:DD:EE:FF|streams|port/,
    );
  });

  it('reports a camera that stopped answering as deleted, sanitized', async () => {
    const context = buildService([
      {
        id: CAMERA_A,
        getProps: () => ({
          macAddress: 'AA:BB:CC:DD:EE:FF',
          serialNumber: 'CAM00001',
          productModel: 'CAM-1',
          name: 'Lobby camera',
          username: 'private-user',
          password: 'private-password',
        }),
      },
    ]);

    await context.service.search(context.nvr, 'search-msg', {
      msgId: 'search-msg',
      macAddresses: [],
    } as never);

    const publicMessage =
      context.websocketService.sendTenantMessage.mock.calls[0]![2];
    expect(publicMessage.data.videoDevices[0].deletedCameras).toEqual([
      {
        id: CAMERA_A,
        serialNumber: 'CAM00001',
        productModel: 'CAM-1',
        name: 'Lobby camera',
      },
    ]);
    expect(JSON.stringify(publicMessage)).not.toMatch(
      /private-user|private-password/,
    );
  });
});

describe('NvrMqttService register', () => {
  function buildService(existingCamera?: unknown) {
    const nvr = NvrEntity.create({
      tenantId: TENANT_A,
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
    const serviceProvider = {
      commandBus,
      queryBus: { execute: jest.fn().mockResolvedValue(existingCamera) },
    };
    const websocketService = {
      channels: { VIDEO_DEVICES_SOCKET: 'VideoDevicesSocket' },
      sendTenantMessage: jest.fn(),
    };
    const cache = { delete: jest.fn().mockResolvedValue(undefined) };
    const service = new NvrMqttService(
      serviceProvider as never,
      {} as never,
      {} as never,
      websocketService as never,
      {} as never,
      {} as never,
      cache as never,
    );
    return { service, nvr, commandBus, websocketService, cache };
  }

  function batchFor(nvrId: string, tenantId: string) {
    return {
      msgId: 'register-msg',
      metadata: { actorProps: { actorId: 'user' } },
      data: {
        nvrId,
        tenantId,
        addedCameras: [
          {
            // A stale batch entry claiming a foreign tenant/NVR: the handler
            // must stamp the NVR's own identity instead of trusting these.
            tenantId: TENANT_FOREIGN,
            nvrId: NVR_B,
            serialNumber: 'CAM00001',
            productModel: 'CAM-1',
            name: 'Camera CAM00001',
            username: 'private-user',
            password: 'private-password',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            port: 554,
            streams: {},
            hasPtz: true,
            hasAudio: false,
          },
        ],
        deletedCameras: [],
      },
    };
  }

  it('rejects a queued batch that was built for another tenant', async () => {
    const context = buildService();

    await expect(
      context.service.register(
        context.nvr,
        batchFor(context.nvr.id, TENANT_FOREIGN) as never,
        { unRegisteredCameraSerialNumbers: [] } as never,
      ),
    ).rejects.toThrow(/queued NVR registration identity mismatch/);
    expect(context.commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects a queued batch that was built for another NVR', async () => {
    const context = buildService();

    await expect(
      context.service.register(
        context.nvr,
        batchFor(NVR_B, TENANT_A) as never,
        { unRegisteredCameraSerialNumbers: [] } as never,
      ),
    ).rejects.toThrow(/queued NVR registration identity mismatch/);
    expect(context.commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects a fog result naming a camera the batch never selected', async () => {
    const context = buildService();

    await expect(
      context.service.register(
        context.nvr,
        batchFor(context.nvr.id, TENANT_A) as never,
        { unRegisteredCameraSerialNumbers: ['CAM-NOT-SELECTED'] } as never,
      ),
    ).rejects.toThrow(/Fog registration result is not selected/);
    expect(context.commandBus.execute).not.toHaveBeenCalled();
  });

  it('creates the camera under the NVR identity, not the batch payload', async () => {
    const context = buildService(undefined);

    await context.service.register(
      context.nvr,
      batchFor(context.nvr.id, TENANT_A) as never,
      { unRegisteredCameraSerialNumbers: [] } as never,
    );

    expect(context.commandBus.execute).toHaveBeenCalledTimes(1);
    expect(context.commandBus.execute.mock.calls[0]![0]).toEqual(
      expect.objectContaining({
        tenantId: TENANT_A,
        nvrId: context.nvr.id,
        serialNumber: 'CAM00001',
      }),
    );
  });

  it('clears both search caches once registration completes', async () => {
    const context = buildService(undefined);

    await context.service.register(
      context.nvr,
      batchFor(context.nvr.id, TENANT_A) as never,
      { unRegisteredCameraSerialNumbers: [] } as never,
    );

    expect(context.cache.delete).toHaveBeenCalledWith(
      `autoSearchNvr-${context.nvr.id}`,
    );
    expect(context.cache.delete).toHaveBeenCalledWith(
      `namingCamerasData-${context.nvr.id}`,
    );
  });
});
