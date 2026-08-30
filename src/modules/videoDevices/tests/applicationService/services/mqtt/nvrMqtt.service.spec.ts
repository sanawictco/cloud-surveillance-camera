import { NvrMqttService } from '../../../../applicationService/services/mqtt/nvrMqtt.service';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const NVR_B = '44444444-4444-4444-8444-444444444444';
const CAMERA_A = '55555555-5555-4555-8555-555555555555';
const CAMERA_FOREIGN = '66666666-6666-4666-8666-666666666666';

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
