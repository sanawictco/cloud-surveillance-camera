import { BadRequestException } from '@nestjs/common';
import {
  CreateSystemLogCommand,
  CreateSystemLogCommandHandler,
} from '../../../../applicationService/commands/systemLog/createSystemLog.command';
import {
  SystemLogSections,
  SystemLogTypes,
} from '../../../../domain/systemLog.type';

const tenantId = '11111111-1111-4111-8111-111111111111';

function createCommand() {
  return new CreateSystemLogCommand({
    tenantId,
    type: SystemLogTypes.WARNING,
    messageProps: { key: 'device.update.failed' },
    section: SystemLogSections.VIDEO_DEVICES_CONFIG,
    entityId: 'device-id',
  });
}

describe('CreateSystemLogCommandHandler', () => {
  it('rejects a system log when its tenant does not exist', async () => {
    const repository = { insert: jest.fn() };
    const tenantAccess = { tenantExists: jest.fn().mockResolvedValue(false) };
    const handler = new CreateSystemLogCommandHandler(
      repository as never,
      tenantAccess as never,
    );

    await expect(handler.execute(createCommand())).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it('persists the required tenant with the system log', async () => {
    const repository = { insert: jest.fn().mockResolvedValue(undefined) };
    const tenantAccess = { tenantExists: jest.fn().mockResolvedValue(true) };
    const handler = new CreateSystemLogCommandHandler(
      repository as never,
      tenantAccess as never,
    );

    await handler.execute(createCommand());

    expect(tenantAccess.tenantExists).toHaveBeenCalledWith(tenantId);
    expect(repository.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [
          tenantId,
          SystemLogTypes.WARNING,
          { key: 'device.update.failed' },
          SystemLogSections.VIDEO_DEVICES_CONFIG,
          'device-id',
        ],
      }),
    );
  });

  it('rejects a missing or malformed tenant before dispatch', () => {
    expect(
      () =>
        new CreateSystemLogCommand({
          tenantId: '',
          type: SystemLogTypes.WARNING,
          messageProps: { key: 'device.update.failed' },
          section: SystemLogSections.VIDEO_DEVICES_CONFIG,
          entityId: 'device-id',
        }),
    ).toThrow('tenantId must be a UUID v4');
  });
});
