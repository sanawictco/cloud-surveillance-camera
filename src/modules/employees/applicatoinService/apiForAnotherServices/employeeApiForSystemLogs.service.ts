import { Injectable } from '@nestjs/common';
import { SmsNotifierResponseDto } from '../../contracts/smsNotifier/smsNotifier.response.dto';
import { EmployeeEntity } from '../../domain/entities/employee.entity';
import { EmployeeMapper } from '../../infra/mappers/employee.mapper';
import { EmployeeService } from '../services/employee.service';
import { SmsNotifierService } from '../services/smsNotifier.service';

@Injectable()
export class EmployeeApiForSystemLogsService {
  constructor(
    private readonly mapper: EmployeeMapper,
    private readonly smsNotifierService: SmsNotifierService,
    private readonly employeeService: EmployeeService,
  ) {}

  async findEmployeeWithUserId(
    userId: string,
  ): Promise<EmployeeEntity | undefined> {
    const employees = await this.employeeService.findAll();
    for (const employee of employees) {
      if (employee.userId === userId)
        return this.mapper.toDomain({
          id: employee.id,
          userId: employee.id,
          isDeleted: employee.isDeleted,
          roles: employee.roles,
          createdAt: new Date(employee.createdAt),
          updatedAt: new Date(employee.updatedAt),
        });
    }
    return undefined;
  }

  async getAllSmsNotifiers(): Promise<SmsNotifierResponseDto[]> {
    return await this.smsNotifierService.find();
  }
}
