import { DashboardApiForFogCommunicationManagerService } from '../../../applicationService/apiForAnotherServices/dashboardApiForFogCommunicationManager.service';
import { PageConfigs } from '../../../domain/page.type';
import { EntityTypes } from 'src/modules/videoDevices/shared/valueObjects/entityTypes';

describe('DashboardApiForFogCommunicationManagerService', () => {
  const tenantId = 'tenant-id';
  const nvrId = 'nvr-id';
  const msgId = '101';

  function buildService() {
    const queued = {
      msgId,
      tenantId,
      nvrId,
      configType: PageConfigs.CREATE_PAGE,
      data: { id: 'page-id', nvrId },
      metadata: {
        topic: `tenants/${tenantId}/nvrs/${nvrId}/pages/to-fog`,
        entityId: 'page-id',
        entityType: EntityTypes.PAGE,
        issuedAt: Date.now() - 1000,
        expiresAt: Date.now() + 60_000,
      },
    };
    const queue = { getRepeatableMsg: jest.fn().mockResolvedValue(queued) };
    const service = new DashboardApiForFogCommunicationManagerService(
      queue as never,
      { queryBus: { execute: jest.fn() } } as never,
      {} as never,
    );
    return { service, queue, queued };
  }

  it('returns an owned page configuration from the scoped queue key', async () => {
    const context = buildService();

    await expect(
      context.service.getOwnedPageConfig(tenantId, nvrId, msgId),
    ).resolves.toBe(context.queued);
    expect(context.queue.getRepeatableMsg).toHaveBeenCalledWith(
      tenantId,
      nvrId,
      msgId,
    );
  });

  it('rejects another tenant page configuration', async () => {
    const context = buildService();
    context.queued.tenantId = 'another-tenant';

    await expect(
      context.service.getOwnedPageConfig(tenantId, nvrId, msgId),
    ).rejects.toThrow('configuration is unavailable');
  });

  it('rejects an expired page configuration', async () => {
    const context = buildService();
    context.queued.metadata.expiresAt = Date.now() - 1;

    await expect(
      context.service.getOwnedPageConfig(tenantId, nvrId, msgId),
    ).rejects.toThrow('configuration is unavailable');
  });
});
