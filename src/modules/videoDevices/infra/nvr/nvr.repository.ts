import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { ParentRepository } from 'src/modules/shared/parent.repository';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { NvrResponseDto } from '../../contracts/nvr/http/response/nvr.response.dto';
import { NvrValueObjects } from '../../domain/nvr/nvr.type';
import { NvrEntity } from '../../domain/nvr/nvr.entity';
import { NvrModel } from './nvr.schema';
import { NvrMapper } from './nvr.mapper';
import { NvrConfigs } from '../../domain/nvr/nvr.type';

type ProvisioningConfig = NvrConfigs.SEARCH | NvrConfigs.REGISTER;
const PROVISIONING_CONFIGS: readonly ProvisioningConfig[] = [
  NvrConfigs.SEARCH,
  NvrConfigs.REGISTER,
];

@Injectable()
export class NvrRepository extends ParentRepository<
  NvrModel,
  NvrValueObjects,
  NvrEntity,
  NvrResponseDto
> {
  constructor(
    @InjectModel(NvrModel.name)
    protected readonly nvrModel: Model<NvrModel>,
    protected readonly mapper: NvrMapper,
    protected readonly cache: CacheService<NvrModel>,
    protected readonly serviceProvider: ServiceProvider,
  ) {
    super(nvrModel, NvrModel, mapper, cache, serviceProvider);
  }

  async restoreAndInitRecordsToCache(): Promise<void> {
    const nvrs = await this.nvrModel.find().lean();
    for (const nvr of nvrs) {
      const runningConfigs = { ...RunningConfigs.init().unpack() };
      for (const configType of PROVISIONING_CONFIGS) {
        const msgId = nvr.runningConfigs?.[configType];
        if (msgId) runningConfigs[configType] = msgId;
      }
      nvr.runningConfigs = runningConfigs;
      await this.nvrModel.updateOne(
        { id: nvr.id },
        { $set: { runningConfigs } },
      );
      await this.cache.set(`${NvrModel.name}:${nvr.id}`, nvr);
    }
  }

  async update(entity: NvrEntity, updatedAt: Date = new Date()): Promise<void> {
    const { runningConfigs: _runningConfigs, ...props } = entity.getProps();
    const record = await this.nvrModel
      .findOneAndUpdate(
        { id: entity.id },
        { $set: { ...props, updatedAt } },
        { new: true },
      )
      .lean();
    if (!record) return;
    await this.cache.delete(`${NvrModel.name}:${record.id}`);
    entity.publishEvents(
      this.serviceProvider.logger,
      this.serviceProvider.eventEmitter,
    );
  }

  async setRunningConfig(
    nvrId: string,
    configType: string,
    msgId: string,
    tenantId: string,
  ): Promise<boolean> {
    return this.updateRunningConfig(
      this.buildRunningConfigFilter(nvrId, tenantId),
      { $set: { [`runningConfigs.${configType}`]: msgId } },
    );
  }

  async resetRunningConfigs(nvrId: string, tenantId: string): Promise<boolean> {
    return this.updateRunningConfig(
      this.buildRunningConfigFilter(nvrId, tenantId),
      { $set: { runningConfigs: RunningConfigs.init().unpack() } },
    );
  }

  async claimProvisioningConfig(
    nvrId: string,
    configType: ProvisioningConfig,
    msgId: string,
    tenantId: string,
  ): Promise<boolean> {
    const availabilityFilter = {
      [`runningConfigs.${NvrConfigs.SEARCH}`]: { $exists: false },
      [`runningConfigs.${NvrConfigs.REGISTER}`]: { $exists: false },
    };
    return this.updateRunningConfig(
      {
        $and: [
          this.buildRunningConfigFilter(nvrId, tenantId),
          availabilityFilter,
        ],
      },
      { $set: { [`runningConfigs.${configType}`]: msgId } },
    );
  }

  async unsetRunningConfigIfMatches(
    nvrId: string,
    configType: string,
    msgId: string,
    tenantId: string,
  ): Promise<boolean> {
    const path = `runningConfigs.${configType}`;
    return this.updateRunningConfig(
      {
        $and: [
          this.buildRunningConfigFilter(nvrId, tenantId),
          { [path]: msgId },
        ],
      },
      { $unset: { [path]: '' } },
    );
  }

  private async updateRunningConfig(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): Promise<boolean> {
    const record = await this.nvrModel
      .findOneAndUpdate(
        filter,
        { ...update, $currentDate: { updatedAt: true } },
        { new: true },
      )
      .lean();
    if (!record) return false;
    await this.cache.delete(`${NvrModel.name}:${record.id}`);
    return true;
  }

  // Tenant scope is mandatory: a running-config mutation must never be able to
  // reach another tenant's NVR by bare id.
  private buildRunningConfigFilter(
    nvrId: string,
    tenantId: string,
  ): Record<string, unknown> {
    return { $and: [{ tenantId }, { id: nvrId }] };
  }
}
