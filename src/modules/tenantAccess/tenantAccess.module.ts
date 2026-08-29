import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SanawApiModule } from 'src/extensions/sanawApi/sanawApi.module';
import { EmployeeRepository } from 'src/modules/tenantAccess/infra/repositories/employee.repository';
import {
  EmployeeModel,
  EmployeeSchema,
} from 'src/modules/tenantAccess/infra/schemas/employee.schema';
import {
  TenantModel,
  TenantSchema,
} from 'src/modules/tenants/infra/tenant.schema';
import { EmployeeAccessHttpService } from './applicationService/employeeAccess.http.service';
import { TenantAccessService } from './applicationService/tenantAccess.service';
import { ActiveTenantGuard } from './guards/activeTenant.guard';
import { EmployeeRolesGuard } from './guards/employeeRoles.guard';
import { MeController } from './me.controller';
import { EmployeeController } from './controllers/employee.controller';
import { CqrsModule } from '@nestjs/cqrs';
import { tenantAccessCommandHandlers } from './applicationService/commands/tenantAccess.commands';
import { tenantAccessQueryHandlers } from './applicationService/queries/tenantAccess.queries';
import { TenantAccessRepository } from './infra/tenantAccess.repository';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmployeeModel.name, schema: EmployeeSchema },
      { name: TenantModel.name, schema: TenantSchema },
    ]),
    CqrsModule,
    SanawApiModule,
  ],
  providers: [
    EmployeeRepository,
    TenantAccessRepository,
    ...tenantAccessCommandHandlers,
    ...tenantAccessQueryHandlers,
    TenantAccessService,
    EmployeeAccessHttpService,
    ActiveTenantGuard,
    EmployeeRolesGuard,
  ],
  controllers: [MeController, EmployeeController],
  exports: [
    TenantAccessService,
    EmployeeAccessHttpService,
    ActiveTenantGuard,
    EmployeeRolesGuard,
  ],
})
export class TenantAccessModule {}
