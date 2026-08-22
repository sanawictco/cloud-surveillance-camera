import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { WebSocketTypes } from 'src/modules/shared/websocket.types';
import { NvrMqttService } from '../../../../applicationService/services/mqtt/nvrMqtt.service';
import { NvrEntity } from '../../../../domain/nvr/nvr.entity';
import { NvrWebSocketConfigTypes } from '../../../../domain/nvr/nvr.type';

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
});
