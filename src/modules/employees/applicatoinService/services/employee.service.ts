import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import { SanawApiEmployeeService } from 'src/extensions/sanawApi/services/sanawApiEmployee.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { LanguageKeys } from 'src/extensions/translation/languageKeys.base';
import { AddEmployeeRequestDto } from '../../contracts/employee/addEmployee.request.dto';
import { FindEmployeeRequestDto } from '../../contracts/employee/findEmployee.request.dto';
import { UpdateEmployeeRolesRequestDto } from '../../contracts/employee/updateEmployeeRoles.request.dto';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { SmsNotifierEntity } from '../../domain/entities/smsNotifier.entity';
import { EmployeeMapper } from '../../infra/mappers/employee.mapper';
import { CreateEmployeeCommand } from '../commands/employee/createEmployee.command';
import { HardDeleteEmployeeCommand } from '../commands/employee/hardDeleteEmployee.command';
import { RecoveryEmployeeCommand } from '../commands/employee/recoveryEmployee.command';
import { SoftDeleteEmployeeCommand } from '../commands/employee/softDeleteEmployee.command';
import { UpdateEmployeeCommand } from '../commands/employee/updateEmployee.command';
import { DeleteSmsNotifierCommand } from '../commands/smsNotifier/deleteSmsNotifier.command';
import { FindAllEmployeesQuery } from '../queries/employee/findAllEmployees.queryHandler';
import { FindAllExistingEmployeesByUserIdsQuery } from '../queries/employee/findAllExistingEmployeesByUserIds.queryHandler';
import { FindEmployeeByIdQuery } from '../queries/employee/findEmployeById.queryHandler';
import { FindEmployeeByUserIdQuery } from '../queries/employee/findEmployeByUserId.queryHandler';
import { FindSmsNotifierByUserIdQuery } from '../queries/smsNotifier/findSmsNotifierByUserId.queryHandler';

@Injectable()
export class EmployeeService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly sanawApiEmployeeService: SanawApiEmployeeService,
    private readonly mapper: EmployeeMapper,
  ) {}

  async findAll(userIds?: string[]) {
    let employeeEntities: EmployeeEntity[] = [];
    if (userIds) {
      employeeEntities = await this.serviceProvider.queryBus.execute(
        new FindAllExistingEmployeesByUserIdsQuery({
          filter: {
            userIds,
          },
        }),
      );
    } else {
      employeeEntities = await this.serviceProvider.queryBus.execute(
        new FindAllEmployeesQuery({ filter: { isDeleted: false } }),
      );
      userIds = [];
      for (const employeeEntity of employeeEntities) {
        userIds.push(employeeEntity.getProps().userId);
      }
    }
    const result = await this.sanawApiEmployeeService.findAll(userIds);

    // add owner to employeeEntities
    for (const user of result.data)
      if (user.isOwner)
        employeeEntities.push(
          EmployeeEntity.create({
            userId: user.userId,
            roles: user.roles,
          }),
        );
    return this.mapper.toResponseAll(employeeEntities, result.data);
  }

  async findByPhoneNumber(param: FindEmployeeRequestDto) {
    const result = await this.sanawApiEmployeeService.find(param.phoneNumber);
    const userId = result?.data?.userId;
    const employeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByUserIdQuery(userId),
      );
    if (employeeEntity && !employeeEntity.getProps().isDeleted)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.employee.errorResponse.badRequest
            .alreadyAddedToWorkspace,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    else if (employeeEntity && employeeEntity.getProps().isDeleted)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.employee.errorResponse.badRequest
            .shouldRecoverEmployeeFromTrashBeforeActivation,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    return result.data;
  }

  async add(body: AddEmployeeRequestDto) {
    await this.findByPhoneNumber({ phoneNumber: body.phoneNumber });
    const result = await this.sanawApiEmployeeService.add(
      body.phoneNumber,
      body.roles,
    );
    const employeeProps = result.data;
    const newEmployeeId = await this.serviceProvider.commandBus.execute(
      new CreateEmployeeCommand({
        userId: employeeProps.userId,
        roles: employeeProps.roles,
        phoneNumber: body.phoneNumber,
      }),
    );
    const newEmployeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByIdQuery(newEmployeeId),
      );
    return {
      data: this.mapper.toResponse(newEmployeeEntity, employeeProps),
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.employee.response.http.added,
      ),
    };
  }

  async updateRoles(
    id: string,
    body: UpdateEmployeeRolesRequestDto,
    req: Request,
  ) {
    const employeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByIdQuery(id),
      );
    if (!employeeEntity) throw new BadRequestException('employee is not exist');
    if (employeeEntity.getProps().isDeleted)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.employee.errorResponse.badRequest
            .canNotUpdateSoftDeletedEmployees,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    if (!req?.user?.id) return;
    const result = await this.sanawApiEmployeeService.updateRoles(
      employeeEntity.getProps().userId,
      body.roles,
      req.user.id,
    );
    await this.serviceProvider.commandBus.execute(
      new UpdateEmployeeCommand({
        id,
        roles: result.data.roles,
        phoneNumber: result.data.phoneNumber,
      }),
    );
    const updatedEmployeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByIdQuery(id),
      );
    return {
      data: this.mapper.toResponse(updatedEmployeeEntity, result.data),
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.employee.response.http.rolesUpdated,
      ),
    };
  }

  async hardDelete(id: string) {
    const employeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByIdQuery(id),
      );
    if (!employeeEntity) throw new BadRequestException('employee is not exist');
    if (!employeeEntity.getProps().isDeleted)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.employee.errorResponse.badRequest
            .onlySoftDeletedEmployeesCouldBeHardDeleted,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    await this.sanawApiEmployeeService.delete(employeeEntity.getProps().userId);
    const result = await this.sanawApiEmployeeService.findAll([
      employeeEntity.getProps().userId,
    ]);
    const employee = result.data[0];
    if (!employee) throw new BadRequestException('employee is not exist');

    await this.serviceProvider.commandBus.execute(
      new HardDeleteEmployeeCommand({
        id: employeeEntity.getProps().userId,
        phoneNumber: employee.phoneNumber,
      }),
    );

    return {
      data: {
        id,
      },
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.employee.response.http.deleted,
      ),
    };
  }

  async softDelete(id: string) {
    const employeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByIdQuery(id),
      );
    if (!employeeEntity) throw new BadRequestException('employee is not exist');
    if (employeeEntity.getProps().isDeleted)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.employee.errorResponse.badRequest.softDeleted,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    const smsNotifierEntity: SmsNotifierEntity =
      await this.serviceProvider.queryBus.execute(
        new FindSmsNotifierByUserIdQuery(employeeEntity.getProps().userId),
      );
    const result = await this.sanawApiEmployeeService.findAll([
      employeeEntity.getProps().userId,
    ]);
    const employee = result.data[0];
    if (!employee) throw new BadRequestException('employee is not exist');
    if (smsNotifierEntity) {
      await this.serviceProvider.commandBus.execute(
        new DeleteSmsNotifierCommand({
          id: smsNotifierEntity.getProps().id,
          phoneNumber: employee.phoneNumber,
        }),
      );
    }
    await this.sanawApiEmployeeService.delete(employeeEntity.getProps().userId);
    await this.serviceProvider.commandBus.execute(
      new SoftDeleteEmployeeCommand({
        id,
        phoneNumber: employee.phoneNumber,
      }),
    );
    return {
      data: { id },
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.employee.response.http.softDeleted,
      ),
    };
  }

  async recovery(id: string, req: Request) {
    const employeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByIdQuery(id),
      );
    if (!employeeEntity) throw new BadRequestException('employee is not exist');
    if (!employeeEntity.getProps().isDeleted)
      throw new BadRequestException(
        this.serviceProvider.translatorService.translateByName(
          LanguageKeys.employee.errorResponse.badRequest
            .onlySoftDeletedEmployeesCouldBeRecovered,
          this.serviceProvider.userInfoService.getProps().lang,
        ),
      );
    if (!req?.user?.id) return;
    const result = await this.sanawApiEmployeeService.updateRoles(
      employeeEntity.getProps().userId,
      employeeEntity.getProps().roles,
      req.user.id,
    );
    await this.serviceProvider.commandBus.execute(
      new RecoveryEmployeeCommand({ id, phoneNumber: result.data.phoneNumber }),
    );
    const recoveredEmployeeEntity: EmployeeEntity =
      await this.serviceProvider.queryBus.execute(
        new FindEmployeeByIdQuery(id),
      );
    return {
      data: this.mapper.toResponse(recoveredEmployeeEntity, result.data),
      message: this.serviceProvider.translatorService.translateByName(
        LanguageKeys.employee.response.http.recovered,
      ),
    };
  }
}
