import { ActorLogApiService } from '../../../applicationService/services/actorLogApi.service';
import { ActorLogTypes } from '../../../domain/actorLog.type';

jest.mock('src/extensions/userInfo/userInfo.service', () => ({
  UserInfoService: {
    getProps: jest.fn(),
  },
}));

import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '33333333-3333-4333-8333-333333333333';

const mockedUserProps = UserInfoService.getProps as jest.Mock;

function apiService() {
  const commandBus = { execute: jest.fn().mockResolvedValue(undefined) };
  const serviceProvider = { commandBus };
  return {
    service: new ActorLogApiService(serviceProvider as never),
    commandBus,
  };
}

describe('ActorLogApiService.registerActorLog', () => {
  beforeEach(() => {
    mockedUserProps.mockReset();
  });

  it('forwards the verified tenant explicitly to the command', async () => {
    const { service, commandBus } = apiService();
    mockedUserProps.mockReturnValue({ id: userId });

    await service.registerActorLog({
      tenantId,
      messageProps: { key: 'nvr.actorLog.created', params: ['nvr', 'serial'] },
    });

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, actorId: userId }),
    );
  });

  it('does not rely on ambient context for the tenant', async () => {
    const { service, commandBus } = apiService();
    mockedUserProps.mockReturnValue({ id: userId });

    await service.registerActorLog({
      tenantId,
      actorId: userId,
      messageProps: { key: 'page.actorLog.created', params: ['page'] },
    });

    expect(commandBus.execute).toHaveBeenCalledTimes(1);
    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId }),
    );
  });

  it('skips writes for system-driven flows that have no authenticated actor', async () => {
    const { service, commandBus } = apiService();
    mockedUserProps.mockReturnValue(undefined);

    await service.registerActorLog({
      tenantId,
      messageProps: { key: 'nvr.actorLog.recovered', params: [] },
    });

    expect(commandBus.execute).not.toHaveBeenCalled();
  });

  it('defaults the actor type to employee', async () => {
    const { service, commandBus } = apiService();
    mockedUserProps.mockReturnValue({ id: userId });

    await service.registerActorLog({
      tenantId,
      actorId: userId,
      messageProps: { key: 'employee.actorLog.added', params: [] },
    });

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ actorType: ActorLogTypes.EMPLOYEE }),
    );
  });

  it('row-deletes explicit actors only, scoped to the given tenant', async () => {
    const { service, commandBus } = apiService();

    await service.deleteActorLogs(tenantId, [userId]);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, actorIds: [userId] }),
    );
  });

  it('refuses to delete actor logs without explicit actor ids', async () => {
    const { service, commandBus } = apiService();

    await expect(service.deleteActorLogs(tenantId, [])).rejects.toThrow(
      'actor log deletion requires explicit actor ids',
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
