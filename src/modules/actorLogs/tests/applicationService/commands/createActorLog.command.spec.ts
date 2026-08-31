import { BadRequestException } from '@nestjs/common';
import {
  CreateActorLogCommand,
  CreateActorLogCommandHandler,
} from '../../../applicationService/commands/createActorLog.command';
import { ActorLogTypes } from '../../../domain/actorLog.type';

const tenantId = '11111111-1111-4111-8111-111111111111';

function createCommand() {
  return new CreateActorLogCommand({
    tenantId,
    actorType: ActorLogTypes.EMPLOYEE,
    actorId: '33333333-3333-4333-8333-333333333333',
    messageProps: { key: 'employee.actorLog.added', params: ['+15551234567'] },
  });
}

describe('CreateActorLogCommandHandler', () => {
  it('rejects an actor log when its tenant does not exist', async () => {
    const repository = { insert: jest.fn() };
    const tenantAccess = { tenantExists: jest.fn().mockResolvedValue(false) };
    const handler = new CreateActorLogCommandHandler(
      repository as never,
      tenantAccess as never,
    );

    await expect(handler.execute(createCommand())).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('persists the required tenant with the actor log', async () => {
    const repository = { insert: jest.fn().mockResolvedValue(undefined) };
    const tenantAccess = { tenantExists: jest.fn().mockResolvedValue(true) };
    const handler = new CreateActorLogCommandHandler(
      repository as never,
      tenantAccess as never,
    );

    await handler.execute(createCommand());

    expect(tenantAccess.tenantExists).toHaveBeenCalledWith(tenantId);
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          tenantId,
          ActorLogTypes.EMPLOYEE,
          '33333333-3333-4333-8333-333333333333',
          { key: 'employee.actorLog.added', params: ['+15551234567'] },
        ],
      }),
    );
  });

  it('rejects a missing or malformed tenant before dispatch', () => {
    expect(
      () =>
        new CreateActorLogCommand({
          tenantId: '',
          actorType: ActorLogTypes.EMPLOYEE,
          actorId: '33333333-3333-4333-8333-333333333333',
          messageProps: { key: 'employee.actorLog.added', params: [] },
        }),
    ).toThrow('tenantId must be a UUID v4');
  });

  it('rejects an unknown actor type before dispatch', () => {
    expect(
      () =>
        new CreateActorLogCommand({
          tenantId,
          actorType: "EMPLOYEE' OR '1'='1" as ActorLogTypes,
          actorId: '33333333-3333-4333-8333-333333333333',
          messageProps: { key: 'employee.actorLog.added', params: [] },
        }),
    ).toThrow('actor log type is invalid');
  });
});
