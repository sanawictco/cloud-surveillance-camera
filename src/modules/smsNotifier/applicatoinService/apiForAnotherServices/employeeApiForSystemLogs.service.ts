import { Injectable } from '@nestjs/common';
import { SmsNotifierResponseDto } from '../../contracts/smsNotifier/smsNotifier.response.dto';
import { EmployeeModel } from 'src/modules/tenantAccess/infra/schemas/employee.schema';
import { SmsNotifierService } from '../services/smsNotifier.service';
import { TenantAccessService } from 'src/modules/tenantAccess/applicationService/tenantAccess.service';

@Injectable()
export class EmployeeApiForSystemLogsService {
  constructor(
    private readonly smsNotifierService: SmsNotifierService,
    private readonly tenantAccessService: TenantAccessService,
  ) {}

  findEmployeeWithUserId(
    tenantId: string,
    userId: string,
  ): Promise<EmployeeModel | undefined> {
    return this.tenantAccessService.findActiveEmployeeForUser(tenantId, userId);
  }

  getSmsNotifiers(tenantId: string): Promise<SmsNotifierResponseDto[]> {
    return this.smsNotifierService.find(tenantId);
  }
}
