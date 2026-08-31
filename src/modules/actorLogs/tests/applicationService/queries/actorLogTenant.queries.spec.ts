import {
  CountAllActorLogsQuery,
  CountAllActorLogsQueryHandler,
} from '../../../applicationService/queries/countAllActorLogs.queryHandler';
import {
  FindAllActorLogsQuery,
  FindAllActorLogsQueryHandler,
} from '../../../applicationService/queries/findAllActorLogs.queryHandler';
import {
  FindAllPaginatedActorLogsQuery,
  FindAllPaginatedActorLogsQueryHandler,
} from '../../../applicationService/queries/findAllPaginatedActorLogs.queryHandler';
import { ActorLogTypes } from '../../../domain/actorLog.type';

const tenantId = '11111111-1111-4111-8111-111111111111';
const foreignTenant = '22222222-2222-4222-8222-222222222222';
const tenantStable = 'actor_log_t_11111111111141118111111111111111';

describe('Actor log tenant queries', () => {
  it('scopes paginated records and their implicit count to one tenant', async () => {
    const repository = {
      findAllPaginated: jest.fn().mockResolvedValue({
        totalDocs: 0,
        page: 1,
        limit: 10,
        docs: [],
      }),
    };
    const handler = new FindAllPaginatedActorLogsQueryHandler(
      repository as never,
    );

    await handler.execute(
      new FindAllPaginatedActorLogsQuery({
        tenantId,
        actorTypes: [ActorLogTypes.EMPLOYEE, ActorLogTypes.RULE_CHAIN],
        page: 1,
        limit: 10,
      }),
    );

    const params = repository.findAllPaginated.mock.calls[0][0];
    expect(params.superTableName).toBe(tenantStable);
    expect(params.filter).toContain(`tenantId='${tenantId}'`);
    expect(params.filter).toBe(
      "tenantId='11111111-1111-4111-8111-111111111111' AND (actorLogType='EMPLOYEE' OR actorLogType='RULE_CHAIN')",
    );
    expect(params.filter).not.toContain(foreignTenant);
  });

  it('scopes explicit counts to one tenant', async () => {
    const repository = { count: jest.fn().mockResolvedValue(2) };
    const handler = new CountAllActorLogsQueryHandler(repository as never);

    await expect(
      handler.execute(
        new CountAllActorLogsQuery({
          tenantId,
          actorTypes: [ActorLogTypes.EXPOSED_REST_API],
        }),
      ),
    ).resolves.toBe(2);
    expect(repository.count).toHaveBeenCalledWith(
      expect.objectContaining({
        superTableName: tenantStable,
        filter: `tenantId='${tenantId}' AND (actorLogType='EXPOSED_REST_API')`,
      }),
    );
  });

  it('scopes unpaginated reads to one tenant', async () => {
    const repository = { findAll: jest.fn().mockResolvedValue([]) };
    const handler = new FindAllActorLogsQueryHandler(repository as never);

    await handler.execute(new FindAllActorLogsQuery({ tenantId }));

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        superTableName: tenantStable,
        filter: `tenantId='${tenantId}'`,
      }),
    );
  });

  it('rejects a malformed tenant before building a filter', () => {
    expect(
      () =>
        new FindAllPaginatedActorLogsQuery({
          tenantId: "x' OR '1'='1",
          page: 1,
          limit: 10,
        }),
    ).toThrow('tenantId must be a UUID v4');
  });

  it('rejects unknown actor types before building a filter', () => {
    expect(
      () =>
        new CountAllActorLogsQuery({
          tenantId,
          actorTypes: ["EMPLOYEE' OR '1'='1" as ActorLogTypes],
        }),
    ).toThrow('actor log type is invalid');
  });

  it('scopes reads to the requested actor ids inside one tenant', async () => {
    const repository = { findAll: jest.fn().mockResolvedValue([]) };
    const handler = new FindAllActorLogsQueryHandler(repository as never);
    const otherActor = '44444444-4444-4444-8444-444444444444';

    await handler.execute(
      new FindAllActorLogsQuery({ tenantId, actorIds: [otherActor] }),
    );

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        superTableName: tenantStable,
        filter: `tenantId='${tenantId}' AND (actorId='${otherActor}')`,
      }),
    );
  });

  it('rejects an oversized actor id before building a filter', () => {
    expect(
      () =>
        new CountAllActorLogsQuery({
          tenantId,
          actorIds: ['x'.repeat(37)],
        }),
    ).toThrow('invalid actor log actorId');
  });

  it('quotes an injection-shaped actor id into a safe literal', async () => {
    const repository = { findAll: jest.fn().mockResolvedValue([]) };
    const handler = new FindAllActorLogsQueryHandler(repository as never);

    await handler.execute(
      new FindAllActorLogsQuery({ tenantId, actorIds: ["x' OR '1'='1"] }),
    );

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        filter: `tenantId='${tenantId}' AND (actorId='x'' OR ''1''=''1')`,
      }),
    );
  });
});
