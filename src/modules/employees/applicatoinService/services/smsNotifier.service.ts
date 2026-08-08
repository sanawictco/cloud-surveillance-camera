import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { EmployeeResponseDto } from '../../contracts/employee/employee.response.dto';
import { CreateSmsNotifierRequestDto } from '../../contracts/smsNotifier/createSmsNotifier.request.dto';
import { SmsNotifierResponseDto } from '../../contracts/smsNotifier/smsNotifier.response.dto';
import { UpdateSmsNotifierRequestDto } from '../../contracts/smsNotifier/updateSmsNotifier.request.dto';
import { SmsNotifierEntity } from '../../domain/entities/smsNotifier.entity';
import { SmsNotifierMapper } from '../../infra/mappers/smsNotifier.mapper';
import { CreateSmsNotifierCommand } from '../commands/smsNotifier/createSmsNotifier.command';
import { DeleteSmsNotifierCommand } from '../commands/smsNotifier/deleteSmsNotifier.command';
import { UpdateSmsNotifierCommand } from '../commands/smsNotifier/updateSmsNotifier.command';
import { FindAllSmsNotifiersQuery } from '../queries/smsNotifier/findAllSmsNotifiers.queryHandler';
import { FindSmsNotifierByIdQuery } from '../queries/smsNotifier/findSmsNotifierById.queryHandler';
import { FindSmsNotifierByUserIdQuery } from '../queries/smsNotifier/findSmsNotifierByUserId.queryHandler';
import { EmployeeService } from './employee.service';

@Injectable()
export class SmsNotifierService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly mapper: SmsNotifierMapper,
    private readonly employeeService: EmployeeService,
  ) {}
  async find(): Promise<SmsNotifierResponseDto[]> {
    const allSmsNotifierEnities: SmsNotifierEntity[] =
      await this.serviceProvider.queryBus.execute(
        new FindAllSmsNotifiersQuery(),
      );
    if (!allSmsNotifierEnities.length) return [];
    const userIds: string[] = [];
    for (const smsNotifierEntity of allSmsNotifierEnities)
      userIds.push(smsNotifierEntity.getProps().userId);
    const employeesProps = await this.employeeService.findAll(userIds);

    return this.mapper.toResponseAll(allSmsNotifierEnities, employeesProps);
  }

  async create(body: CreateSmsNotifierRequestDto) {
    const employeesProps = await this.employeeService.findAll();
    for (const employee of employeesProps) {
      if (employee.phoneNumber === body.phoneNumber) {
        const duplicatedSmsNotifierEntity: SmsNotifierEntity =
          await this.serviceProvider.queryBus.execute(
            new FindSmsNotifierByUserIdQuery(employee.userId),
          );
        if (duplicatedSmsNotifierEntity)
          throw new BadRequestException(
            this.serviceProvider.translatorService.translateByName(
              LanguageKeys.smsNotifier.errorResponse.badRequest.alreadyExists,
              this.serviceProvider.userInfoService.getProps().lang,
            ),
          );
        await this.serviceProvider.commandBus.execute(
          new CreateSmsNotifierCommand({
            userId: employee.userId,
            systemLogTypes: body.systemLogTypes,
            phoneNumber: employee.phoneNumber,
          }),
        );
        body.systemLogTypes = [...new Set(body.systemLogTypes)];

        const newSmsNotifierEntity: SmsNotifierEntity =
          await this.serviceProvider.queryBus.execute(
            new FindSmsNotifierByUserIdQuery(employee.userId),
          );
        return {
          data: this.mapper.toResponse(newSmsNotifierEntity, employee),
          message: this.serviceProvider.translatorService.translateByName(
            LanguageKeys.smsNotifier.response.http.added,
          ),
        };
      }
    }
    throw new BadRequestException(
      this.serviceProvider.translatorService.translateByName(
        LanguageKeys.smsNotifier.errorResponse.badRequest
          .phoneNumberShouldBelongToWorkspaceEmployees,
        this.serviceProvider.userInfoService.getProps().lang,
      ),
    );
  }

  async update(id: string, body: UpdateSmsNotifierRequestDto) {
    const smsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByIdQuery(id),
      );
    if (!smsNotifierEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest.doesNotExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );

    body.systemLogTypes = [...new Set(body.systemLogTypes)];

    const employeesProps: EmployeeResponseDto[] =
      await this.employeeService.findAll([smsNotifierEntity.getProps().userId]);
    const employee = employeesProps[0];
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
        systemLogTypes: body.systemLogTypes,
        phoneNumber: employee.phoneNumber,
      }),
    );

    const updatedSmsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByIdQuery(id),
      );
    return {
      data: this.mapper.toResponse(updatedSmsNotifierEntity, employee),
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.smsNotifier.response.http.updated,
      ),
    };
  }

  async delete(id: string) {
    const smsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByIdQuery(id),
      );

    if (!smsNotifierEntity)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.smsNotifier.errorResponse.badRequest.doesNotExists,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    const employeesProps = await this.employeeService.findAll([
      smsNotifierEntity.getProps().userId,
    ]);
    const employee = employeesProps[0];
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
}
