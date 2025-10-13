import { BadRequestException, Injectable } from '@nestjs/common';
import { SanawApiEmployeeService } from 'src/extensions/sanawApi/services/sanawApiEmployee.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { EmployeeResponseDto } from '../../contracts/employee/employee.response.dto';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { EmployeeMapper } from '../../infra/mappers/employee.mapper';
import { FindAllEmployeesQuery } from '../queries/employee/findAllEmployees.queryHandler';

@Injectable()
export class EmployeeApiForActorLogsService {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly mapper: EmployeeMapper,
    private readonly sanawApiEmployeeService: SanawApiEmployeeService,
  ) {}

  async checkIfEmployeeExists(userId: string): Promise<EmployeeResponseDto> {
    const employeeEntities: EmployeeEntity[] =
      await this.serviceProvider.queryBus.execute(new FindAllEmployeesQuery());
    const result = await this.sanawApiEmployeeService.findAll([]);

    // add owner to employeeEntities
    for (const user of result.data)
      if (user.isOwner)
        employeeEntities.push(
          EmployeeEntity.create({
            userId: user.userId,
            roles: user.roles,
          }),
        );
    for (const employeeEntity of employeeEntities)
      if (employeeEntity.getProps().userId === userId)
        return this.mapper.toResponse(employeeEntity, {});
    throw new BadRequestException('employee not exists');
  }
}
