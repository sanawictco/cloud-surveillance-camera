import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { CreateSmsNotifierRequestDto } from '../../contracts/smsNotifier/createSmsNotifier.request.dto';
import { SmsNotifierResponseDto } from '../../contracts/smsNotifier/smsNotifier.response.dto';
import { UpdateSmsNotifierRequestDto } from '../../contracts/smsNotifier/updateSmsNotifier.request.dto';
import { SmsNotifierEntity } from '../../domain/entities/smsNotifier.entity';
import { SmsNotifierMapper } from '../../infra/mappers/smsNotifier.mapper';
import { CreateSmsNotifierCommand } from '../commands/smsNotifier/createSmsNotifier.command';
import { DeleteSmsNotifierCommand } from '../commands/smsNotifier/deleteSmsNotifier.command';
import { UpdateSmsNotifierCommand } from '../commands/smsNotifier/updateSmsNotifier.command';
import { FindAllSmsNotifiersForTenantQuery } from '../queries/smsNotifier/findAllSmsNotifiers.queryHandler';
import { FindSmsNotifierByIdForTenantQuery } from '../queries/smsNotifier/findSmsNotifierById.queryHandler';
import { FindSmsNotifierByUserIdForTenantQuery } from '../queries/smsNotifier/findSmsNotifierByUserId.queryHandler';
import { TenantAccessService } from 'src/modules/tenantAccess/applicationService/tenantAccess.service';
import { UserInfoService } from 'src/extensions/userInfo/userInfo.service';
import { SanawApiEmployeeService } from 'src/extensions/sanawApi/services/sanawApiEmployee.service';

@Injectable()
export class SmsNotifierService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly mapper: SmsNotifierMapper,
    private readonly tenantAccessService: TenantAccessService,
    private readonly sanawApiEmployeeService: SanawApiEmployeeService,
  ) {}
  async find(tenantId: string): Promise<SmsNotifierResponseDto[]> {
    const employees =
      await this.tenantAccessService.findEmployeesForTenant(tenantId);
    const userIds = employees.map((employee) => employee.userId);
    const allSmsNotifierEnities: SmsNotifierEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllSmsNotifiersForTenantQuery(tenantId, userIds),
      );
    if (!allSmsNotifierEnities.length) return [];
    const notifierUserIds = allSmsNotifierEnities.map(
      (entity) => entity.getProps().userId,
    );
    const result = await this.sanawApiEmployeeService.findAll(notifierUserIds);

    return this.mapper.toResponseAll(allSmsNotifierEnities, result.data);
  }

  async create(body: CreateSmsNotifierRequestDto) {
    const tenantId = UserInfoService.requireTenantId();
    const result = await this.sanawApiEmployeeService.find(body.phoneNumber);
    const employee = await this.tenantAccessService.findEmployeeForUser(
      tenantId,
      result.data.userId,
    );
    if (!employee || employee.isDeleted) {
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest
            .phoneNumberShouldBelongToWorkspaceEmployees,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    }
    const duplicatedSmsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByUserIdForTenantQuery(tenantId, result.data.userId),
      );
    if (duplicatedSmsNotifierEntity) {
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest.alreadyExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    }
    body.systemLogTypes = [...new Set(body.systemLogTypes)];
    await this.serviceProvider.commandBus.execute(
      new CreateSmsNotifierCommand({
        tenantId,
        userId: result.data.userId,
        systemLogTypes: body.systemLogTypes,
        phoneNumber: result.data.phoneNumber,
      }),
    );
    const newSmsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByUserIdForTenantQuery(tenantId, result.data.userId),
      );
    return {
      data: this.mapper.toResponse(newSmsNotifierEntity, result.data),
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.smsNotifier.response.http.added,
      ),
    };
  }

  async update(id: string, body: UpdateSmsNotifierRequestDto) {
    const tenantId = UserInfoService.requireTenantId();
    const userIds = await this.getTenantUserIds(tenantId);
    const smsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByIdForTenantQuery(tenantId, userIds, id),
      );
    if (!smsNotifierEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest.doesNotExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );

    body.systemLogTypes = [...new Set(body.systemLogTypes)];

    const employeesResult = await this.sanawApiEmployeeService.findAll([
      smsNotifierEntity.getProps().userId,
    ]);
    const employee = employeesResult.data[0];
    if (!employee)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest.doesNotExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );

    await this.serviceProvider.commandBus.execute(
      new UpdateSmsNotifierCommand({
        id,
        tenantId,
        systemLogTypes: body.systemLogTypes,
        phoneNumber: employee.phoneNumber,
      }),
    );

    const updatedSmsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByIdForTenantQuery(tenantId, userIds, id),
      );
    return {
      data: this.mapper.toResponse(updatedSmsNotifierEntity, employee),
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.smsNotifier.response.http.updated,
      ),
    };
  }

  async delete(id: string) {
    const tenantId = UserInfoService.requireTenantId();
    const userIds = await this.getTenantUserIds(tenantId);
    const smsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByIdForTenantQuery(tenantId, userIds, id),
      );

    if (!smsNotifierEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest.doesNotExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    const employeesResult = await this.sanawApiEmployeeService.findAll([
      smsNotifierEntity.getProps().userId,
    ]);
    const employee = employeesResult.data[0];
    if (!employee)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest.doesNotExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );

    await this.serviceProvider.commandBus.execute(
      new DeleteSmsNotifierCommand({
        id,
        tenantId,
        phoneNumber: employee.phoneNumber,
      }),
    );
    return {
      data: { id },
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.smsNotifier.response.http.deleted,
      ),
    };
  }

  private async getTenantUserIds(tenantId: string): Promise<string[]> {
    const employees =
      await this.tenantAccessService.findEmployeesForTenant(tenantId);
    return employees.map((employee) => employee.userId);
  }
}
