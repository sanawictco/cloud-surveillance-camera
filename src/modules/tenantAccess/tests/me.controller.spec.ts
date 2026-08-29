import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { MeController } from '../me.controller';

describe('MeController', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists tenants by authenticated identity without an active tenant', async () => {
    const tenantAccess = {
      findMyTenants: jest.fn().mockResolvedValue([]),
    };
    jest.spyOn(UserInfoService, 'getProps').mockReturnValue({
      id: '11111111-1111-4111-8111-111111111111',
    } as never);
    const controller = new MeController(tenantAccess as never);

    await expect(controller.findMyTenants()).resolves.toEqual([]);
    expect(tenantAccess.findMyTenants).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
    );
  });
});
