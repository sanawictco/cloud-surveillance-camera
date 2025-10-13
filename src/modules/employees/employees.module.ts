import { Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmployeeService } from './applicatoinService/services/employee.service';
import { EmployeeController } from './controllers/employee.controller';
import { CreateEmployeeCommandHandler } from './applicatoinService/commands/employee/createEmployee.command';
import { HardDeleteEmployeeCommandHandler } from './applicatoinService/commands/employee/hardDeleteEmployee.command';
import { SoftDeleteEmployeeCommandHandler } from './applicatoinService/commands/employee/softDeleteEmployee.command';
import { FindAllEmployeesQueryHandler } from './applicatoinService/queries/employee/findAllEmployees.queryHandler';
import { FindEmployeeByIdQueryHandler } from './applicatoinService/queries/employee/findEmployeById.queryHandler';
import { FindEmployeeByUserIdQueryHandler } from './applicatoinService/queries/employee/findEmployeByUserId.queryHandler';
import { EMPLOYEE_REPOSITORY } from './infra/diTokens/employee.diToken';
import { EmployeeRepository } from './infra/repositories/employee.repository';
import { EmployeeMapper } from './infra/mappers/employee.mapper';
import { CqrsModule } from '@nestjs/cqrs';
import { SanawApiModule } from 'src/extensions/sanawApi/sanawApi.module';
import { MongooseModule } from '@nestjs/mongoose';
import { EmployeeModel, EmployeeSchema } from './infra/schemas/employee.schema';
import { CachingModule } from 'src/extensions/caching/cacheing.module';
import { UpdateEmployeeCommandHandler } from './applicatoinService/commands/employee/updateEmployee.command';
import { RecoveryEmployeeCommandHandler } from './applicatoinService/commands/employee/recoveryEmployee.command';
import { EmployeeApiForRuleChainsService } from './applicatoinService/apiForAnotherServices/employeeApiForRuleChains.service';
import { CreateSmsNotifierCommandHandler } from './applicatoinService/commands/smsNotifier/createSmsNotifier.command';
import { UpdateSmsNotifierCommandHandler } from './applicatoinService/commands/smsNotifier/updateSmsNotifier.command';
import { DeleteSmsNotifierCommandHandler } from './applicatoinService/commands/smsNotifier/deleteSmsNotifier.command';
import { FindAllSmsNotifiersQueryHandler } from './applicatoinService/queries/smsNotifier/findAllSmsNotifiers.queryHandler';
import { FindSmsNotifierByUserIdQueryHandler } from './applicatoinService/queries/smsNotifier/findSmsNotifierByUserId.queryHandler';
import { FindSmsNotifierByIdQueryHandler } from './applicatoinService/queries/smsNotifier/findSmsNotifierById.queryHandler';
import { SMS_NOTIFIER_REPOSITORY } from './infra/diTokens/smsNotifier.diToken';
import { SmsNotifierRepository } from './infra/repositories/smsNotifier.repository';
import { SmsNotifierMapper } from './infra/mappers/smsNotifier.mapper';
import { SmsNotifierService } from './applicatoinService/services/smsNotifier.service';
import { SmsNotifierController } from './controllers/smsNotifier.controller';
import {
  SmsNotifierModel,
  SmsNotifierSchema,
} from './infra/schemas/smsNotifier.schema';
import { EmployeeInitService } from './applicatoinService/services/init.service';
import { FindAllExistingEmployeesByUserIdsQueryHandler } from './applicatoinService/queries/employee/findAllExistingEmployeesByUserIds.queryHandler';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { EmployeeApiForActorLogsService } from './applicatoinService/apiForAnotherServices/employeeApiForActorLogs.service';
import { EmployeeApiForSystemLogsService } from './applicatoinService/apiForAnotherServices/employeeApiForSystemLogs.service';
import { EmployeeApiForTrashService } from './applicatoinService/apiForAnotherServices/employeeApiForTrash.service';
import { RestoreEmployeesToCacheCommandHandler } from './applicatoinService/commands/employee/restoreEmployeesToCache.command';
import { EmployeesActorLogService } from './applicatoinService/services/employeesActorLog.service';

const commandHandlers: Provider[] = [
  ...[
    CreateEmployeeCommandHandler,
    UpdateEmployeeCommandHandler,
    HardDeleteEmployeeCommandHandler,
    SoftDeleteEmployeeCommandHandler,
    RestoreEmployeesToCacheCommandHandler,
    RecoveryEmployeeCommandHandler,
  ],
  ...[
    CreateSmsNotifierCommandHandler,
    UpdateSmsNotifierCommandHandler,
    DeleteSmsNotifierCommandHandler,
  ],
];

const queryHandlers: Provider[] = [
  ...[
    FindAllEmployeesQueryHandler,
    FindAllExistingEmployeesByUserIdsQueryHandler,
    FindEmployeeByIdQueryHandler,
    FindEmployeeByUserIdQueryHandler,
  ],
  ...[
    FindAllSmsNotifiersQueryHandler,
    FindSmsNotifierByUserIdQueryHandler,
    FindSmsNotifierByIdQueryHandler,
  ],
];

const mappers: Provider[] = [EmployeeMapper, SmsNotifierMapper];
const repositories: Provider[] = [
  { provide: EMPLOYEE_REPOSITORY, useClass: EmployeeRepository },
  {
    provide: SMS_NOTIFIER_REPOSITORY,
    useClass: SmsNotifierRepository,
  },
];
const httpServices: Provider[] = [
  EmployeesActorLogService,
  EmployeeService,
  SmsNotifierService,
];

const apiServicesForAnotherModules: Provider[] = [
  EmployeeApiForRuleChainsService,
  EmployeeApiForSystemLogsService,
  EmployeeApiForActorLogsService,
  EmployeeApiForTrashService,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EmployeeModel.name, schema: EmployeeSchema },
      { name: SmsNotifierModel.name, schema: SmsNotifierSchema },
    ]),
    ConfigModule,
    CqrsModule,
    SanawApiModule,
    CachingModule,
    forwardRef(() => ActorLogModule),
  ],

  providers: [
    ...httpServices,
    ...commandHandlers,
    ...queryHandlers,
    ...mappers,
    ...repositories,
    ...apiServicesForAnotherModules,
    EmployeeInitService,
  ],
  controllers: [EmployeeController, SmsNotifierController],
  exports: [...apiServicesForAnotherModules],
})
export class EmployeeModule {}
