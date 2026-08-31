import {
  DeleteTenantActorLogsCommand,
  DeleteTenantActorLogsCommandHandler,
} from '../../../applicationService/commands/deleteTenantActorLogs.command';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '33333333-3333-4333-8333-333333333333';

describe('DeleteTenantActorLogsCommandHandler', () => {
  it('deletes each requested actor inside the tenant', async () => {
    const repository = {
      dropByActor: jest.fn().mockResolvedValue(undefined),
    };
    const handler = new DeleteTenantActorLogsCommandHandler(
      repository as never,
    );
    const otherUser = '44444444-4444-4444-8444-444444444444';

    await handler.execute(
      new DeleteTenantActorLogsCommand({
        tenantId,
        actorIds: [userId, otherUser],
      }),
    );

    expect(repository.dropByActor).toHaveBeenCalledTimes(2);
    expect(repository.dropByActor).toHaveBeenNthCalledWith(1, tenantId, userId);
    expect(repository.dropByActor).toHaveBeenNthCalledWith(
      2,
      tenantId,
      otherUser,
    );
  });

  it('rejects an empty actor id list so a missing filter cannot wipe the tenant', () => {
    expect(
      () => new DeleteTenantActorLogsCommand({ tenantId, actorIds: [] }),
    ).toThrow('actor log deletion requires explicit actor ids');
  });

  it('rejects a missing actor id list', () => {
    expect(
      () =>
        new DeleteTenantActorLogsCommand({
          tenantId,
          actorIds: undefined as never,
        }),
    ).toThrow('actor log deletion requires explicit actor ids');
  });

  it('rejects a malformed tenant before dispatch', () => {
    expect(
      () =>
        new DeleteTenantActorLogsCommand({
          tenantId: "x' OR '1'='1",
          actorIds: [userId],
        }),
    ).toThrow('tenantId must be a UUID v4');
  });
});
