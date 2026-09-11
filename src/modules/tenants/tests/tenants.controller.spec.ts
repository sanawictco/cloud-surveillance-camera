import { UnauthorizedException } from '@nestjs/common';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { TenantsController } from '../tenants.controller';

const dto = { name: 'Sanaw', defaultTimezone: 'Asia/Tehran' };
const userId = '11111111-1111-4111-8111-111111111111';

function controllerWith(overrides: {
  create?: jest.Mock;
  findMyTenants?: jest.Mock;
}) {
  const tenantsService = {
    create: overrides.create ?? jest.fn().mockResolvedValue({ id: 'tenant-id' }),
  };
  const tenantAccessService = {
    findMyTenants: overrides.findMyTenants ?? jest.fn().mockResolvedValue([]),
  };
  const controller = new TenantsController(
    tenantsService as never,
    tenantAccessService as never,
  );
  return { controller, tenantsService, tenantAccessService };
}

describe('TenantsController', () => {
  afterEach(() => jest.restoreAllMocks());

  describe('create', () => {
    it('creates a tenant owned by the authenticated caller', async () => {
      const { controller, tenantsService } = controllerWith({});
      jest.spyOn(UserInfoService, 'getProps').mockReturnValue({
        id: userId,
      } as never);

      await expect(controller.create(dto as never)).resolves.toEqual({
        id: 'tenant-id',
      });
      expect(tenantsService.create).toHaveBeenCalledWith(userId, dto);
    });

    it('rejects when there is no authenticated identity', () => {
      const { controller, tenantsService } = controllerWith({});
      jest.spyOn(UserInfoService, 'getProps').mockReturnValue(undefined as never);

      expect(() => controller.create(dto as never)).toThrow(
        UnauthorizedException,
      );
      expect(tenantsService.create).not.toHaveBeenCalled();
    });
  });

  describe('findMyTenants', () => {
    it('lists tenants by authenticated identity without an active tenant', async () => {
      const { controller, tenantAccessService } = controllerWith({
        findMyTenants: jest.fn().mockResolvedValue([]),
      });
      jest.spyOn(UserInfoService, 'getProps').mockReturnValue({
        id: userId,
      } as never);

      await expect(controller.findMyTenants()).resolves.toEqual([]);
      expect(tenantAccessService.findMyTenants).toHaveBeenCalledWith(userId);
    });

    it('rejects when there is no authenticated identity', () => {
      const { controller, tenantAccessService } = controllerWith({});
      jest.spyOn(UserInfoService, 'getProps').mockReturnValue(undefined as never);

      expect(() => controller.findMyTenants()).toThrow(UnauthorizedException);
      expect(tenantAccessService.findMyTenants).not.toHaveBeenCalled();
    });
  });
});
