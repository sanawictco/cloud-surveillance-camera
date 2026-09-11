import { BadRequestException, Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { CreateTenantCommand } from '../commands/createTenant.command';
import { FindTenantByIdQuery } from '../queries/findTenantById.queryHandler';
import { FindTenantByOwnerAndNameQuery } from '../queries/findTenantByOwnerAndName.queryHandler';
import { TenantStatuses } from '../../domain/valueObjects/tenantStatus.vo';
import { TenantMapper } from '../../infra/tenant.mapper';
import { CreateTenantRequestDto } from '../../contracts/createTenant.request.dto';
import { TenantResponseDto } from '../../contracts/tenant.response.dto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly tenantMapper: TenantMapper,
    private readonly serviceProvider: ServiceProvider,
  ) {}

  async create(
    ownerId: string,
    dto: CreateTenantRequestDto,
  ): Promise<TenantResponseDto> {
    const existing = await this.queryBus.execute(
      new FindTenantByOwnerAndNameQuery(ownerId, dto.name),
    );
    if (existing) {
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.tenant.errorResponse.badRequest.nameIsDuplicated,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    }

    const tenantId: string = await this.commandBus.execute(
      new CreateTenantCommand({
        ownerId,
        name: dto.name,
        status: TenantStatuses.ACTIVE,
        defaultTimezone: dto.defaultTimezone,
      }),
    );

    const tenant = await this.queryBus.execute(
      new FindTenantByIdQuery(tenantId),
    );
    if (!tenant) throw new Error('entity not exists');

    return this.tenantMapper.toResponse(tenant);
  }
}
