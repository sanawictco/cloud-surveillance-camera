import { LanguageCode } from '../../translation/languageCode.enum';
import { WebsocketService } from '../../websocket/websocket.service';
import { EmployeeRoles } from '../../sanawApi/dtos/employees/employeeRoles.enum';

jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({ environment: 'production' }),
}));

describe('WebsocketService', () => {
  it('sends a tenant event only to connections verified for that tenant', async () => {
    jest.useFakeTimers();
    const tenantA = '11111111-1111-4111-8111-111111111111';
    const tenantB = '22222222-2222-4222-8222-222222222222';
    const cache = {
      getMany: jest.fn().mockResolvedValue(
        new Map([
          [
            'room-a',
            {
              id: 'user-a',
              tenantId: tenantA,
              phoneNumber: '',
              name: '',
              roles: [EmployeeRoles.Report],
              lang: LanguageCode.EN,
            },
          ],
          [
            'room-b',
            {
              id: 'user-b',
              tenantId: tenantB,
              phoneNumber: '',
              name: '',
              roles: [EmployeeRoles.Report],
              lang: LanguageCode.EN,
            },
          ],
        ]),
      ),
    };
    const emit = jest.fn();
    const server = {
      sockets: {
        adapter: {
          rooms: new Map([
            ['room-a', {}],
            ['room-b', {}],
          ]),
        },
      },
      to: jest.fn().mockReturnValue({ emit }),
    };
    const service = new WebsocketService(
      cache as never,
      {
        translatorService: {},
        logger: { error: jest.fn() },
      } as never,
      {} as never,
      {} as never,
      {
        resolveActiveAccess: jest.fn().mockImplementation((tenantId, userId) =>
          Promise.resolve({
            tenantId,
            userId,
            roles: [EmployeeRoles.Report],
            isOwner: false,
          }),
        ),
      } as never,
    );
    Object.assign(service, { server });

    service.sendMessage(service.channels.SYSTEM_LOGS_SOCKET, {
      type: 'config',
      data: { tenantId: tenantA },
    });
    await jest.runOnlyPendingTimersAsync();

    expect(server.to).toHaveBeenCalledTimes(1);
    expect(server.to).toHaveBeenCalledWith('room-a');
    expect(emit).toHaveBeenCalledWith(
      service.channels.SYSTEM_LOGS_SOCKET,
      expect.objectContaining({ data: { tenantId: tenantA } }),
    );
    jest.useRealTimers();
  });

  it('does not send system logs after access is revoked', async () => {
    jest.useFakeTimers();
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const server = {
      sockets: { adapter: { rooms: new Map([['room-a', {}]]) } },
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };
    const service = new WebsocketService(
      {
        getMany: jest.fn().mockResolvedValue(
          new Map([
            [
              'room-a',
              {
                id: 'user-a',
                tenantId,
                roles: [EmployeeRoles.Report],
                lang: LanguageCode.EN,
              },
            ],
          ]),
        ),
      } as never,
      { translatorService: {}, logger: { error: jest.fn() } } as never,
      {} as never,
      {} as never,
      { resolveActiveAccess: jest.fn().mockResolvedValue(undefined) } as never,
    );
    Object.assign(service, { server });

    service.sendMessage(service.channels.SYSTEM_LOGS_SOCKET, {
      type: 'config',
      data: { tenantId },
    });
    await jest.runOnlyPendingTimersAsync();

    expect(server.to).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('delivers system logs to any active tenant member regardless of role', async () => {
    jest.useFakeTimers();
    const tenantId = '11111111-1111-4111-8111-111111111111';
    const emit = jest.fn();
    const server = {
      sockets: { adapter: { rooms: new Map([['room-a', {}]]) } },
      to: jest.fn().mockReturnValue({ emit }),
    };
    const service = new WebsocketService(
      {
        getMany: jest.fn().mockResolvedValue(
          new Map([
            [
              'room-a',
              {
                id: 'user-a',
                tenantId,
                roles: [],
                lang: LanguageCode.EN,
              },
            ],
          ]),
        ),
      } as never,
      { translatorService: {}, logger: { error: jest.fn() } } as never,
      {} as never,
      {} as never,
      {
        resolveActiveAccess: jest.fn().mockResolvedValue({
          tenantId,
          roles: [EmployeeRoles.Only_View],
          isOwner: false,
        }),
      } as never,
    );
    Object.assign(service, { server });

    service.sendMessage(service.channels.SYSTEM_LOGS_SOCKET, {
      type: 'config',
      data: { tenantId },
    });
    await jest.runOnlyPendingTimersAsync();

    expect(server.to).toHaveBeenCalledTimes(1);
    expect(server.to).toHaveBeenCalledWith('room-a');
    expect(emit).toHaveBeenCalledWith(
      service.channels.SYSTEM_LOGS_SOCKET,
      expect.objectContaining({ data: { tenantId } }),
    );
    jest.useRealTimers();
  });
});
