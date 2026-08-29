import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  OrderStates,
  QueryBase,
} from 'src/dddLib/applicationService';
import { CacheService } from 'src/extensions/caching/cache.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { buildTenantFilter } from 'src/modules/shared/tenantFilter';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { PageEntity } from '../../domain/page.entity';
import { PageConfigs } from '../../domain/page.type';
import { PageMapper } from '../mappers/page.mapper';
import { pageCacheKey, PageModel } from '../schemas/page.schema';

/**
 * Tenant-scoped repository for the Page aggregate. Every tenant-owned read,
 * write, aggregate, and running-config mutation is filtered by a verified
 * tenant. Tenant plus caller filters are merged with `$and` so a caller can
 * never override `tenantId`. Cache keys are tenant-prefixed so a cache hit
 * can never return another tenant's page.
 *
 * Boot-time scans that legitimately cross tenants use the explicitly named
 * `*AsSystem` methods so a missing tenant can never be silently treated as
 * "all tenants".
 */
@Injectable()
export class PageRepository {
  constructor(
    @InjectModel(PageModel.name)
    private readonly pageModel: Model<PageModel>,
    private readonly mapper: PageMapper,
    private readonly cache: CacheService<PageModel>,
    private readonly serviceProvider: ServiceProvider,
  ) {}

  private cacheKey(tenantId: string, id: string): string {
    return pageCacheKey(tenantId, id);
  }

  async insert(entity: PageEntity): Promise<void> {
    const props = entity.getProps();
    // Deterministic _id derived from the aggregate UUID, matching the shared
    // ParentRepository. Fog cloud-recovery upserts rely on a stable _id, so a
    // random ObjectId here would break re-import idempotency.
    const _id = props.id.replace(/-/g, '').substring(0, 24);
    const newEntity = new this.pageModel({ ...props, _id });
    await newEntity.save();
    await this.cache.set(this.cacheKey(props.tenantId, props.id), props);
    entity.publishEvents(
      this.serviceProvider.logger,
      this.serviceProvider.eventEmitter,
    );
  }

  async findById(
    tenantId: string,
    id: string,
  ): Promise<PageEntity | undefined> {
    if (!tenantId) throw new Error('tenantId is required');
    const cached = await this.cache.get(this.cacheKey(tenantId, id));
    if (cached && cached.tenantId === tenantId)
      return this.mapper.toDomain(cached);
    const record = await this.pageModel
      .findOne(buildTenantFilter(tenantId, { id }))
      .lean();
    if (record) return this.mapper.toDomain(record);
    return undefined;
  }

  async findOne(
    tenantId: string,
    filter: object = {},
  ): Promise<PageEntity | undefined> {
    if (!tenantId) throw new Error('tenantId is required');
    const record = await this.pageModel
      .findOne(buildTenantFilter(tenantId, filter))
      .lean();
    if (record) return this.mapper.toDomain(record);
    return undefined;
  }

  async findAll(
    tenantId: string,
    params: QueryBase<any> = {} as QueryBase<any>,
  ): Promise<PageEntity[]> {
    if (!tenantId) throw new Error('tenantId is required');
    const { filter, orderBy } = params;
    const query = this.pageModel.find(buildTenantFilter(tenantId, filter ?? {}));
    if (orderBy) {
      const { column, status } = orderBy;
      query.sort({
        [column]: status === OrderStates.ASCENDING ? 1 : -1,
      });
    }
    const records = await query.lean().exec();
    return records.map((record) => this.mapper.toDomain(record));
  }

  async aggregate(tenantId: string, value: object) {
    if (!tenantId) throw new Error('tenantId is required');
    return this.pageModel.aggregate([
      { $match: { tenantId } },
      { $group: { _id: '', ...value } },
    ]);
  }

  async update(entity: PageEntity, updatedAt: Date = new Date()): Promise<void> {
    const props = { ...entity.getProps(), updatedAt };
    const record = await this.pageModel
      .findOneAndUpdate(
        buildTenantFilter(props.tenantId, { id: entity.id }),
        props,
        { new: true },
      )
      .lean();
    // Fail loudly instead of reporting success on a zero-row write. A stale or
    // foreign-tenant entity must never look like a completed update.
    if (!record)
      throw new Error(`page ${entity.id} not found for its tenant on update`);
    await this.cache.set(this.cacheKey(props.tenantId, props.id), record);
    entity.publishEvents(
      this.serviceProvider.logger,
      this.serviceProvider.eventEmitter,
    );
  }

  async delete(entity: PageEntity): Promise<void> {
    const props = entity.getProps();
    const result = await this.pageModel.deleteOne(
      buildTenantFilter(props.tenantId, { id: entity.id }),
    );
    if (result.deletedCount === 0)
      throw new Error(`page ${entity.id} not found for its tenant on delete`);
    await this.cache.delete(this.cacheKey(props.tenantId, props.id));
    entity.publishEvents(
      this.serviceProvider.logger,
      this.serviceProvider.eventEmitter,
    );
  }

  async unlockRunningConfig(
    tenantId: string,
    id: string,
    nvrId: string,
    configType: PageConfigs,
    msgId: string,
  ): Promise<boolean> {
    if (!tenantId) throw new Error('tenantId is required');
    const updated = await this.pageModel
      .findOneAndUpdate(
        buildTenantFilter(tenantId, {
          id,
          nvrId,
          [`runningConfigs.${configType}`]: msgId,
        }),
        { $unset: { [`runningConfigs.${configType}`]: '' } },
        { new: true },
      )
      .lean<PageModel>()
      .exec();
    if (!updated) return false;
    await this.cache.set(this.cacheKey(tenantId, id), updated);
    return true;
  }

  /**
   * Explicit cross-tenant read for platform/boot flows only. Never reachable
   * from a normal tenant controller: it is separately named and takes no
   * tenant, so a missing tenant cannot be mistaken for "all tenants".
   */
  async findAllAsSystem(
    params: QueryBase<any> = {} as QueryBase<any>,
  ): Promise<PageEntity[]> {
    const { filter, orderBy } = params;
    const query = this.pageModel.find();
    if (filter) query.find(filter);
    if (orderBy) {
      const { column, status } = orderBy;
      query.sort({
        [column]: status === OrderStates.ASCENDING ? 1 : -1,
      });
    }
    const records = await query.lean().exec();
    return records.map((record) => this.mapper.toDomain(record));
  }

  /**
   * Boot-time cache warm for every tenant's pages. Platform/system operation
   * only; each record is cached under its own tenant-prefixed key.
   */
  async restoreAllPagesToCacheAsSystem(): Promise<void> {
    const pages = await this.pageModel.find().lean();
    for (const page of pages) {
      page.runningConfigs = RunningConfigs.init().unpack();
      await this.pageModel.updateOne({ id: page.id }, page);
      await this.cache.set(this.cacheKey(page.tenantId, page.id), page);
    }
  }
}
