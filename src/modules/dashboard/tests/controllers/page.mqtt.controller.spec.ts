import { PageMqttController } from '../../controllers/page.mqtt.controller';
import { PageConfigs } from '../../domain/page.type';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

describe('PageMqttController', () => {
  it('rejects a page entity owned by another NVR before side effects', async () => {
    const msgId = '101';
    const queued = {
      msgId,
      tenantId: 'tenant-id',
      nvrId: 'nvr-id',
      configType: PageConfigs.UPDATE_PAGE,
      data: { id: 'page-id', name: 'Updated page' },
      metadata: {
        topic: 'tenant-id/nvr-id/page/config/pub',
        entityId: 'page-id',
        entityType: EntityTypes.PAGE,
        issuedAt: Date.now() - 1000,
        expiresAt: Date.now() + 60_000,
        actorProps: { actorId: 'employee-id', actorType: 'EMPLOYEE' },
      },
    };
    const queue = {
      getRepeatableMsg: jest.fn().mockResolvedValue(queued),
      getAndDeleteRepeatableMsg: jest.fn(),
    };
    const page = {
      id: 'page-id',
      getProps: () => ({ nvrId: 'another-nvr' }),
    };
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(page) },
      eventEmitter: { emit: jest.fn() },
    };
    const pageRunningConfig = { doneAndUnLockConfig: jest.fn() };
    const pagesMqttService = { update: jest.fn() };
    const controller = new PageMqttController(
      queue as never,
      serviceProvider as never,
      pageRunningConfig as never,
      pagesMqttService as never,
    );

    await controller.handler({
      topic: 'tenant-id/nvr-id/page/config/sub',
      message: JSON.stringify({ msgId }),
    });

    expect(pagesMqttService.update).not.toHaveBeenCalled();
    expect(queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(pageRunningConfig.doneAndUnLockConfig).not.toHaveBeenCalled();
    expect(serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: 'page configuration entity ownership mismatch',
      }),
    );
  });
});
