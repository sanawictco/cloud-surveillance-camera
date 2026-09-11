import { Module, Provider, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';
import { CachingModule } from 'src/extensions/caching/cacheing.module';
import { SanawApiModule } from 'src/extensions/sanawApi/sanawApi.module';
import { ActorLogModule } from '../actorLogs/actorLog.module';
import { CreateTenantCommandHandler } from './applicationService/commands/createTenant.command';
import { DeleteTenantCommandHandler } from './applicationService/commands/deleteTenant.command';
import { RestoreTenantsToCacheCommandHandler } from './applicationService/commands/restoreTenantsToCache.command';
import { UpdateTenantCommandHandler } from './applicationService/commands/updateTenant.command';
import { FindAllTenantsQueryHandler } from './applicationService/queries/findAllTenants.queryHandler';
import { FindTenantByIdQueryHandler } from './applicationService/queries/findTenantById.queryHandler';
import { FindTenantByNameQueryHandler } from './applicationService/queries/findTenantByName.queryHandler';
import { FindTenantByOwnerAndNameQueryHandler } from './applicationService/queries/findTenantByOwnerAndName.queryHandler';
import { TenantInitService } from './applicationService/services/init.service';
import { TenantActorLogService } from './applicationService/services/tenantActorLog.service';
import { TENANT_REPOSITORY } from './infra/tenant.diToken';
import { TenantMapper } from './infra/tenant.mapper';
import { TenantRepository } from './infra/tenant.repository';
import { TenantModel, TenantSchema } from './infra/tenant.schema';
import { TenantsApiForTenantAccessService } from './applicationService/apiForAnotherServices/tenantsApiForTenantAccess.service';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './applicationService/services/tenants.service';

const commandHandlers: Provider[] = [
  CreateTenantCommandHandler,
  UpdateTenantCommandHandler,
  DeleteTenantCommandHandler,
  RestoreTenantsToCacheCommandHandler,
];

const queryHandlers: Provider[] = [
  FindAllTenantsQueryHandler,
  FindTenantByIdQueryHandler,
  FindTenantByNameQueryHandler,
  FindTenantByOwnerAndNameQueryHandler,
];

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TenantModel.name, schema: TenantSchema },
    ]),
    ConfigModule,
    CqrsModule,
    SanawApiModule,
    CachingModule,
    forwardRef(() => ActorLogModule),
  ],
  providers: [
    TenantActorLogService,
    ...commandHandlers,
    ...queryHandlers,
    TenantMapper,
    { provide: TENANT_REPOSITORY, useClass: TenantRepository },
    TenantInitService,
    TenantsApiForTenantAccessService,
    TenantsService,
  ],
  controllers: [TenantsController],
  exports: [TenantsApiForTenantAccessService],
})
export class TenantsModule {}
