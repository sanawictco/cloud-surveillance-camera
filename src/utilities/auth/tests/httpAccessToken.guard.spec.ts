import { UnauthorizedException } from '@nestjs/common';
import axios from 'axios';
import type { ExecutionContext } from '@nestjs/common';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { HttpAccessTokenGuard } from '../httpAccessToken.guard';

jest.mock('axios');
jest.mock('configs/app.config', () => ({
  __esModule: true,
  default: () => ({
    keycloak: {
      authServer: 'https://identity.example.test',
      realm: 'sanaw',
      clientId: 'surveillance-client',
    },
  }),
}));

function encodePayload(payload: object): string {
  return `${Buffer.from('{}').toString('base64url')}.${Buffer.from(
    JSON.stringify(payload),
  ).toString('base64url')}.signature`;
}

function context(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('HttpAccessTokenGuard', () => {
  afterEach(() => jest.resetAllMocks());

  it('rejects a missing bearer token before calling Keycloak', async () => {
    const guard = new HttpAccessTokenGuard();

    await expect(
      guard.canActivate(context({ headers: {} })),
    ).rejects.toThrow(UnauthorizedException);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('rejects when online token validation fails', async () => {
    jest.mocked(axios.get).mockRejectedValue(new Error('invalid token'));
    const guard = new HttpAccessTokenGuard();

    await expect(
      guard.canActivate(
        context({ headers: { authorization: 'Bearer invalid-token' } }),
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('populates the trusted request user after online validation', async () => {
    jest.mocked(axios.get).mockResolvedValue({ status: 200 } as never);
    const token = encodePayload({
      sub: 'employee-id',
      preferred_username: 'employee-phone',
      name: 'Employee',
      lang: 'fa',
      resource_access: {
        'surveillance-client': {
          roles: [EmployeeRoles.Camera_RuleChain_Dashboard],
        },
      },
    });
    const request: { headers: object; user?: object } = {
      headers: { authorization: `Bearer ${token}` },
    };
    const guard = new HttpAccessTokenGuard();

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toEqual(
      expect.objectContaining({
        id: 'employee-id',
        roles: [EmployeeRoles.Camera_RuleChain_Dashboard],
      }),
    );
  });
});
