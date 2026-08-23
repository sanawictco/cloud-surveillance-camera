import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrMqttService } from '../../../../applicationService/services/mqtt/nvrMqtt.service';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';
import { NvrWebSocketConfigTypes } from '../../../../domain/nvr/nvr.type';
import { CameraEntity } from '../../../../domain/camera/camera.entity';
import { UpdateCameraCommand } from '../../../../applicationService/commands/camera/updateCamera.command';
import { ActiveCameraCommand } from '../../../../applicationService/commands/camera/activeCamera.command';
import { CreateCameraCommand } from '../../../../applicationService/commands/camera/createCamera.command';

describe('NvrMqttService', () => {
  function buildService() {
    const nvr = NvrEntity.create({
      tenantId: '11111111-1111-4111-8111-111111111111',
      name: 'NVR',
      productModel: 'NVR-16',
      serialNumber: 'NVR00001',
      accessToken: '11111111111111111111111111111111',
      maxCameras: 16,
      password: 'nvr-password',
    });
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue([]) },
      commandBus: { execute: jest.fn().mockResolvedValue(undefined) },
    };
    const websocket = {
      channels: { DEVICES_SOCKET: 'DevicesSocket' },
      sendMessage: jest.fn(),
    };
    const sanawApi = { getNvrCameraSearchInfo: jest.fn() };
    const cache = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest
        .fn()
        .mockResolvedValue({ addedCameras: [], deletedCameras: [] }),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    const service = new NvrMqttService(
      serviceProvider as never,
      {} as never,
      {} as never,
      websocket as never,
      {} as never,
      sanawApi as never,
      cache as never,
    );
    return { service, nvr, serviceProvider, websocket, sanawApi, cache };
  }

  it('emits one completion when all connected cameras are up to date', async () => {
    const context = buildService();

    await context.service.search(context.nvr, 'search-msg', {
      msgId: 'search-msg',
      macAddresses: [],
    });

    expect(context.cache.set).toHaveBeenCalledWith(
      `autoSearchNvr-${context.nvr.id}`,
      { addedCameras: [], deletedCameras: [] },
      1800,
    );
    expect(context.websocket.sendMessage).toHaveBeenCalledTimes(1);
    expect(context.serviceProvider.queryBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: { nvrId: context.nvr.id, isDeleted: { $ne: true } },
      }),
    );
    expect(context.websocket.sendMessage).toHaveBeenCalledWith(
      'DevicesSocket',
      {
        type: WebSocketTypes.CONFIG,
        data: { nvrId: context.nvr.id },
        message: {
          msgKey:
            LanguageKeys.nvr.response.socket.allConnectedCamerasAreUpToDate,
        },
        metadata: {
          configType: NvrWebSocketConfigTypes.SEARCH,
          msgId: 'search-msg',
        },
      },
    );
  });

  it('emits one sanitized completion when a camera is discovered', async () => {
    const context = buildService();
    context.sanawApi.getNvrCameraSearchInfo.mockResolvedValue({
      statusCode: 200,
      data: {
        cameras: [
          {
            id: 1,
            cameraAggregateId: '22222222-2222-4222-8222-222222222222',
            serialNumber: 'CAM00001',
            productModel: 'CAM-1',
            username: 'private-user',
            password: 'private-password',
            macAddress: 'AA:BB:CC:DD:EE:FF',
            streams: { recordStream: {}, liveStream: {} },
            port: 554,
            hasPtz: true,
            hasAudio: false,
          },
        ],
      },
    });

    await context.service.search(context.nvr, 'search-msg', {
      msgId: 'search-msg',
      macAddresses: ['AA:BB:CC:DD:EE:FF'],
    });

    expect(context.cache.set).toHaveBeenCalledWith(
      `autoSearchNvr-${context.nvr.id}`,
      expect.objectContaining({
        addedCameras: [
          expect.objectContaining({ password: 'private-password' }),
        ],
      }),
      1800,
    );
    expect(context.websocket.sendMessage).toHaveBeenCalledTimes(1);
    const publicMessage = context.websocket.sendMessage.mock.calls[0]![1];
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

  it('restores a soft-deleted camera during registration', async () => {
    const context = buildService();
    const deletedCamera = CameraEntity.create({
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: '44444444-4444-4444-8444-444444444444',
      nvrId: '55555555-5555-4555-8555-555555555555',
      name: 'Camera CAM00001',
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
    deletedCamera.softDelete();
    context.serviceProvider.queryBus.execute
      .mockResolvedValueOnce(deletedCamera)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(deletedCamera);

    await context.service.register(
      context.nvr,
      {
        msgId: 'register-msg',
        configType: 'REGISTER',
        nvrId: context.nvr.id,
        tenantId: context.nvr.getProps().tenantId,
        data: {
          nvrId: context.nvr.id,
          tenantId: context.nvr.getProps().tenantId,
          addedCameras: [
            {
              id: deletedCamera.id,
              tenantId: context.nvr.getProps().tenantId,
              nvrId: context.nvr.id,
              name: 'Camera CAM00001',
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
            },
          ],
          deletedCameras: [],
        },
        metadata: {
          topic: 'topic',
          entityId: context.nvr.id,
          entityType: 'nvr',
          retryCount: 3,
          retryPeriodInSecond: 10,
        },
      } as never,
      {
        msgId: 'register-msg',
        unRegisteredCameraSerialNumbers: [],
      },
    );

    expect(context.serviceProvider.commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        id: deletedCamera.id,
        tenantId: context.nvr.getProps().tenantId,
        nvrId: context.nvr.id,
        isDeleted: false,
      }),
    );
    expect(
      context.serviceProvider.commandBus.execute.mock.calls.some(
        ([command]) => command instanceof UpdateCameraCommand,
      ),
    ).toBe(true);
    expect(
      context.serviceProvider.commandBus.execute.mock.calls.some(
        ([command]) => command instanceof ActiveCameraCommand,
      ),
    ).toBe(true);
    expect(
      context.serviceProvider.commandBus.execute.mock.calls.some(
        ([command]) => command instanceof CreateCameraCommand,
      ),
    ).toBe(false);
  });

  it('does not soft-delete an already deleted camera again', async () => {
    const context = buildService();
    const deletedCamera = CameraEntity.create({
      tenantId: context.nvr.getProps().tenantId,
      nvrId: context.nvr.id,
      name: 'Camera CAM00001',
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
    deletedCamera.softDelete();
    context.serviceProvider.queryBus.execute.mockResolvedValue(deletedCamera);

    await context.service.register(
      context.nvr,
      {
        msgId: 'register-msg',
        data: {
          nvrId: context.nvr.id,
          tenantId: context.nvr.getProps().tenantId,
          addedCameras: [],
          deletedCameras: [
            {
              id: deletedCamera.id,
              serialNumber: 'CAM00001',
              productModel: 'CAM-1',
              name: 'Camera CAM00001',
            },
          ],
        },
        metadata: {},
      } as never,
      {
        msgId: 'register-msg',
        unRegisteredCameraSerialNumbers: [],
      },
    );

    expect(context.serviceProvider.commandBus.execute).not.toHaveBeenCalled();
  });

  it('rejects a stable camera id with a different serial number', async () => {
    const context = buildService();
    const existingCamera = CameraEntity.create({
      id: '22222222-2222-4222-8222-222222222222',
      tenantId: context.nvr.getProps().tenantId,
      nvrId: context.nvr.id,
      name: 'Existing camera',
      productModel: 'CAM-1',
      serialNumber: 'CAM99999',
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
    context.serviceProvider.queryBus.execute
      .mockResolvedValueOnce(existingCamera)
      .mockResolvedValueOnce(undefined);

    await expect(
      context.service.register(
        context.nvr,
        {
          msgId: 'register-msg',
          data: {
            nvrId: context.nvr.id,
            tenantId: context.nvr.getProps().tenantId,
            addedCameras: [{ id: existingCamera.id, serialNumber: 'CAM00001' }],
            deletedCameras: [],
          },
          metadata: {},
        } as never,
        {
          msgId: 'register-msg',
          unRegisteredCameraSerialNumbers: [],
        },
      ),
    ).rejects.toThrow('camera registration identity mismatch');
    expect(context.serviceProvider.commandBus.execute).not.toHaveBeenCalled();
  });

  it('does not activate a soft-deleted camera', async () => {
    const context = buildService();
    const deletedCamera = CameraEntity.create({
      tenantId: context.nvr.getProps().tenantId,
      nvrId: context.nvr.id,
      name: 'Deleted camera',
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
    deletedCamera.softDelete();
    context.serviceProvider.queryBus.execute.mockResolvedValue(deletedCamera);

    await context.service.activateCameras(
      { id: context.nvr.id, cameraIds: [deletedCamera.id] },
      { msgId: 'activate-msg' },
    );

    expect(context.serviceProvider.commandBus.execute).not.toHaveBeenCalled();
    expect(context.websocket.sendMessage).not.toHaveBeenCalled();
  });
});
