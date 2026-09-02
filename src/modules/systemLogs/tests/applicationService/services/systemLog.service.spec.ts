import { BadRequestException } from '@nestjs/common';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { SystemLogService } from '../../../applicationService/services/systemLog.service';
import { SystemLogTypes } from '../../../domain/systemLog.type';

const tenantId = '11111111-1111-4111-8111-111111111111';
const userId = '33333333-3333-4333-8333-333333333333';

function buildService(smsImpl?: jest.Mock) {
  const logger = { error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  const serviceProvider = {
    logger,
    commandBus: { execute: jest.fn().mockResolvedValue(undefined) },
    queryBus: { execute: jest.fn().mockResolvedValue([]) },
    userInfoService: { getProps: jest.fn(() => ({ lang: 'en' })) },
    translatorService: {
      translateByName: jest.fn(() => 'message'),
      translateByPattern: jest.fn(() => 'message'),
    },
  };
  const notificationService = {
    sms: smsImpl ?? jest.fn().mockResolvedValue(undefined),
  };
  const employeeApi = {
    getSmsNotifiers: jest.fn().mockResolvedValue([
      { userId, systemLogTypes: [SystemLogTypes.ERROR] },
    ]),
  };
  const service = new SystemLogService(
    serviceProvider as never,
    { sendTenantMessage: jest.fn(), channels: {} } as never,
    notificationService as never,
    employeeApi as never,
  );
  return { service, logger, notificationService };
}

describe('SystemLogService.handleSmsNotifiers', () => {
  it('logs and survives when the notification API rejects', async () => {
    // A rejected fire-and-forget send used to reach
    // process.on('unhandledRejection') in main.ts, which emergency-exits the
    // whole service. Any Sanaw API blip would take the cloud down.
    const failure = new Error('sms gateway unavailable');
    const { service, logger, notificationService } = buildService(
      jest.fn().mockRejectedValue(failure),
    );
    const unhandled = jest.fn();
    process.once('unhandledRejection', unhandled);

    await service.handleSmsNotifiers(tenantId, 'disk full', SystemLogTypes.ERROR);
    // Let the setTimeout(0) callback and its rejection settle.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(notificationService.sms).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(userId),
      expect.any(String),
    );
    process.off('unhandledRejection', unhandled);
  });

  it('sends the notification level matching the log type', async () => {
    const { service, notificationService } = buildService();

    await service.handleSmsNotifiers(tenantId, 'disk full', SystemLogTypes.ERROR);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(notificationService.sms).toHaveBeenCalledWith({
      level: 'error',
      message: 'disk full',
      userId,
    });
  });

  it('skips a log type with no notification level instead of sending undefined', async () => {
    const { service, logger, notificationService } = buildService();
    const employeeApi = {
      getSmsNotifiers: jest
        .fn()
        .mockResolvedValue([{ userId, systemLogTypes: ['critical'] }]),
    };
    (service as never as { employeeApiForSystemLogsService: unknown })
      .employeeApiForSystemLogsService = employeeApi;

    await service.handleSmsNotifiers(
      tenantId,
      'disk full',
      'critical' as SystemLogTypes,
    );
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(notificationService.sms).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('critical'),
    );
  });
});

describe('SystemLogService.findAll', () => {
  beforeEach(() => {
    // findAll resolves the tenant before parsing; without a request context
    // that throws first and would mask what these cases are asserting.
    jest.spyOn(UserInfoService, 'requireTenantId').mockReturnValue(tenantId);
  });
  afterEach(() => jest.restoreAllMocks());

  it('rejects a malformed types filter as a bad request, not a crash', async () => {
    const { service } = buildService();

    await expect(
      service.findAll({ types: '{not json' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a types filter that is not an array', async () => {
    const { service } = buildService();

    await expect(
      service.findAll({ types: '"error"' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
