import { BadRequestException } from '@nestjs/common';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { TenantsService } from '../../../applicationService/services/tenants.service';
import { FindTenantByIdQuery } from '../../../applicationService/queries/findTenantById.queryHandler';
import { FindTenantByOwnerAndNameQuery } from '../../../applicationService/queries/findTenantByOwnerAndName.queryHandler';
import { TenantStatuses } from '../../../domain/valueObjects/tenantStatus.vo';

const ownerId = '78c12077-7c5e-46f6-8a05-b3df96c94c2d';
const dto = { name: 'Sanaw Cloud', defaultTimezone: 'Asia/Tehran' };

function serviceWith(overrides: {
  existingTenant?: unknown;
  findById?: unknown;
  createdId?: string;
  lang?: LanguageCode;
}) {
  const commandBus = {
    execute: jest.fn().mockResolvedValue(overrides.createdId ?? 'tenant-id'),
  };
  const queryBus = {
    execute: jest.fn((query: unknown) => {
      if (query instanceof FindTenantByOwnerAndNameQuery) {
        return Promise.resolve(overrides.existingTenant);
      }
      if (query instanceof FindTenantByIdQuery) {
        return Promise.resolve(overrides.findById ?? { id: 'tenant-id' });
      }
      throw new Error(`unexpected query ${String(query)}`);
    }),
  };
  const tenantMapper = {
    toResponse: jest.fn((entity: { id: string }) => ({ id: entity.id })),
  };
  const serviceProvider = {
    userInfoService: {
      getProps: jest.fn().mockReturnValue({ lang: overrides.lang ?? LanguageCode.EN }),
    },
    translatorService: {
      translateByName: jest.fn(
        (keychain: string, lang: LanguageCode) => `${lang}:${keychain}`,
      ),
    },
  };
  const service = new TenantsService(
    commandBus as never,
    queryBus as never,
    tenantMapper as never,
    serviceProvider as never,
  );
  return { service, commandBus, queryBus, tenantMapper, serviceProvider };
}

describe('TenantsService', () => {
  it('creates an active tenant owned by the caller', async () => {
    const { service, commandBus } = serviceWith({});

    await service.create(ownerId, dto);

    expect(commandBus.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId,
        name: dto.name,
        status: TenantStatuses.ACTIVE,
        defaultTimezone: dto.defaultTimezone,
      }),
    );
  });

  it('returns the newly created tenant mapped to a response', async () => {
    const tenantEntity = { id: 'tenant-id' };
    const { service, tenantMapper } = serviceWith({ findById: tenantEntity });

    const result = await service.create(ownerId, dto);

    expect(tenantMapper.toResponse).toHaveBeenCalledWith(tenantEntity);
    expect(result).toEqual({ id: 'tenant-id' });
  });

  it('rejects with a translated message when the owner already has a tenant with that name', async () => {
    const { service, commandBus, serviceProvider } = serviceWith({
      existingTenant: { id: 'existing' },
      lang: LanguageCode.FA,
    });

    await expect(service.create(ownerId, dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(serviceProvider.translatorService.translateByName).toHaveBeenCalledWith(
      LanguageKeys.tenant.errorResponse.badRequest.nameIsDuplicated,
      LanguageCode.FA,
    );
    expect(commandBus.execute).not.toHaveBeenCalled();
  });
});
