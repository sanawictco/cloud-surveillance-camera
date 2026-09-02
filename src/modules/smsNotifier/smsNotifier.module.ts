import { Module, Provider, forwardRef } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { SanawApiModule } from 'src/extensions/sanawApi/sanawApi.module';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { EmployeeApiForSystemLogsService } from './applicatoinService/apiForAnotherServices/employeeApiForSystemLogs.service';
import { SmsNotifierApiForTenantAccessService } from './applicatoinService/apiForAnotherServices/smsNotifierApiForTenantAccess.service';
import { CreateSmsNotifierCommandHandler } from './applicatoinService/commands/smsNotifier/createSmsNotifier.command';
import { DeleteSmsNotifierCommandHandler } from './applicatoinService/commands/smsNotifier/deleteSmsNotifier.command';
import { UpdateSmsNotifierCommandHandler } from './applicatoinService/commands/smsNotifier/updateSmsNotifier.command';
import { FindAllSmsNotifiersForTenantQueryHandler } from './applicatoinService/queries/smsNotifier/findAllSmsNotifiers.queryHandler';
import { FindSmsNotifierByIdForTenantQueryHandler } from './applicatoinService/queries/smsNotifier/findSmsNotifierById.queryHandler';
import { FindSmsNotifierByUserIdForTenantQueryHandler } from './applicatoinService/queries/smsNotifier/findSmsNotifierByUserId.queryHandler';
import { EmployeesActorLogService } from './applicatoinService/services/employeesActorLog.service';
import { SmsNotifierService } from './applicatoinService/services/smsNotifier.service';
import { SmsNotifierController } from './controllers/smsNotifier.controller';
import { SMS_NOTIFIER_REPOSITORY } from './infra/diTokens/smsNotifier.diToken';
import { SmsNotifierMapper } from './infra/mappers/smsNotifier.mapper';
import { SmsNotifierRepository } from './infra/repositories/smsNotifier.repository';
import {
  SmsNotifierModel,
  SmsNotifierSchema,
} from './infra/schemas/smsNotifier.schema';

const commandHandlers: Provider[] = [
  CreateSmsNotifierCommandHandler,
  UpdateSmsNotifierCommandHandler,
  DeleteSmsNotifierCommandHandler,
];

const queryHandlers: Provider[] = [
  FindAllSmsNotifiersForTenantQueryHandler,
  FindSmsNotifierByUserIdForTenantQueryHandler,
  FindSmsNotifierByIdForTenantQueryHandler,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SmsNotifierModel.name, schema: SmsNotifierSchema },
    ]),
    CqrsModule,
    SanawApiModule,
    forwardRef(() => ActorLogModule),
  ],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    SmsNotifierMapper,
    {
      provide: SMS_NOTIFIER_REPOSITORY,
      useClass: SmsNotifierRepository,
    },
    EmployeesActorLogService,
    SmsNotifierService,
    EmployeeApiForSystemLogsService,
    SmsNotifierApiForTenantAccessService,
  ],
  controllers: [SmsNotifierController],
  exports: [
    EmployeeApiForSystemLogsService,
    SmsNotifierApiForTenantAccessService,
  ],
})
export class SmsNotifierModule {}
