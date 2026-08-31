import { PageMqttController } from '../../controllers/page.mqtt.controller';
import { PageConfigs } from '../../domain/page.type';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

const TENANT_A = '11111111-1111-4111-8111-111111111111';
const NVR_A = '33333333-3333-4333-8333-333333333333';
const PAGE_A = '55555555-5555-4555-8555-555555555555';

describe('PageMqttController', () => {
  function buildContext(topic: string) {
    const msgId = '101';
    const queued = {
      msgId,
      tenantId: TENANT_A,
      nvrId: NVR_A,
      configType: PageConfigs.UPDATE_PAGE,
      data: { id: PAGE_A, name: 'Updated page' },
      metadata: {
        topic: `tenants/${TENANT_A}/nvrs/${NVR_A}/pages/to-fog`,
        entityId: PAGE_A,
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
      id: PAGE_A,
      getProps: () => ({ nvrId: 'another-nvr' }),
    };
    const serviceProvider = {
      queryBus: { execute: jest.fn().mockResolvedValue(page) },
      eventEmitter: { emit: jest.fn() },
      logger: { debug: jest.fn(), error: jest.fn() },
    };
    const pageRunningConfig = { doneAndUnLockConfig: jest.fn() };
    const pagesMqttService = { update: jest.fn() };
    const controller = new PageMqttController(
      queue as never,
      serviceProvider as never,
      pageRunningConfig as never,
      pagesMqttService as never,
    );
    return {
      controller,
      queue,
      page,
      pagesMqttService,
      pageRunningConfig,
      serviceProvider,
      msgId,
      event: { topic, message: JSON.stringify({ msgId }) },
    };
  }

  it('rejects a page entity owned by another NVR before side effects', async () => {
    const context = buildContext(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/pages/to-cloud`,
    );

    await context.controller.handler(context.event);

    expect(context.pagesMqttService.update).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(
      context.pageRunningConfig.doneAndUnLockConfig,
    ).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        message: 'page configuration entity ownership mismatch',
      }),
    );
  });

  it('rejects a response topic whose identity is not a whole UUID', async () => {
    const context = buildContext(
      'tenants/not-a-tenant/nvrs/not-an-nvr/pages/to-cloud',
    );

    await context.controller.handler(context.event);

    expect(context.queue.getRepeatableMsg).not.toHaveBeenCalled();
    expect(context.pagesMqttService.update).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).toHaveBeenCalled();
  });

  it('skips an unknown msgId idempotently without side effects or errors', async () => {
    const context = buildContext(
      `tenants/${TENANT_A}/nvrs/${NVR_A}/pages/to-cloud`,
    );
    context.queue.getRepeatableMsg.mockResolvedValue(undefined);

    await context.controller.handler(context.event);

    expect(context.pagesMqttService.update).not.toHaveBeenCalled();
    expect(context.queue.getAndDeleteRepeatableMsg).not.toHaveBeenCalled();
    expect(
      context.pageRunningConfig.doneAndUnLockConfig,
    ).not.toHaveBeenCalled();
    expect(context.serviceProvider.eventEmitter.emit).not.toHaveBeenCalled();
  });
});
