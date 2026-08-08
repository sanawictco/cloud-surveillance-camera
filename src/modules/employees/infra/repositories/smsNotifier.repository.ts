import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Paginated, RepositoryBase } from 'src/dddLib/infra';
import { Model, QueryFilter } from 'mongoose';
import { SmsNotifierModel } from '../schemas/smsNotifier.schema';
import { SmsNotifierEntity } from '../../domain/entities/smsNotifier.entity';
import { SmsNotifierMapper } from '../mappers/smsNotifier.mapper';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import {
  OrderStates,
  PaginatedQueryBase,
  QueryBase,
} from 'src/dddLib/applicationService';

@Injectable()
export class SmsNotifierRepository implements RepositoryBase<SmsNotifierEntity> {
  constructor(
    @InjectModel(SmsNotifierModel.name)
    private readonly smsNotifierModel: Model<SmsNotifierModel>,
    private readonly mapper: SmsNotifierMapper,
    private readonly serviceProvider: ServiceProvider,
  ) {}
  async insert(entity: SmsNotifierEntity): Promise<void> {
    const props = entity.getProps();
    const newSmsNotifier = new this.smsNotifierModel(props);
    await newSmsNotifier.save();
    entity.publishEvents(
      this.serviceProvider.logger,
      this.serviceProvider.eventEmitter,
    );
  }

  async findById(id: string): Promise<SmsNotifierEntity | undefined> {
    const smsNotifier = await this.smsNotifierModel.findOne({ id }).lean();
    if (smsNotifier) return this.mapper.toDomain(smsNotifier);
    return undefined;
  }

  async findOne(
    filter: QueryFilter<any>,
  ): Promise<SmsNotifierEntity | undefined> {
    const smsNotifier = await this.smsNotifierModel.findOne(filter).lean();
    if (smsNotifier) return this.mapper.toDomain(smsNotifier);
    return undefined;
  }

  async findAll(params: QueryBase<any>): Promise<SmsNotifierEntity[]> {
    const { filter, orderBy } = params;
    const query = this.smsNotifierModel.find();

    if (filter) query.find(filter);
    if (orderBy) {
      const { column, status } = orderBy;
      query.sort({
        [column]: status === OrderStates.ASCENDING ? 1 : -1,
      });
    }

    const smsNotifiers = await query.lean().exec();

    const smsNotifierEntities: SmsNotifierEntity[] = [];
    for (const smsNotifier of smsNotifiers)
      smsNotifierEntities.push(this.mapper.toDomain(smsNotifier));
    return smsNotifierEntities;
  }

  async findAllPaginated(
    params: PaginatedQueryBase<any>,
  ): Promise<Paginated<SmsNotifierEntity>> {
    const { filter, orderBy, page, limit } = params;
    const query = this.smsNotifierModel.find();
    if (filter) query.find(filter);
    if (orderBy) {
      const { column, status } = orderBy;
      query.sort({
        [column]: status === OrderStates.ASCENDING ? 1 : -1,
      });
    }
    query.skip((page - 1) * limit).limit(limit);

    const smsNotifiers = await query.lean().exec();

    const smsNotifierEntities: SmsNotifierEntity[] = [];
    for (const smsNotifier of smsNotifiers)
      smsNotifierEntities.push(this.mapper.toDomain(smsNotifier));
    const totalSmsNotifierCount: number = await this.smsNotifierModel
      .countDocuments()
      .exec();
    return {
      totalDocs: totalSmsNotifierCount,
      page,
      limit,
      docs: smsNotifierEntities,
    };
  }

  async update(entity: SmsNotifierEntity): Promise<void> {
    const updatedAt = new Date();
    const props = { ...entity.getProps(), updatedAt };
    await this.smsNotifierModel.updateOne({ id: entity.id }, props);
    entity.publishEvents(
      this.serviceProvider.logger,
      this.serviceProvider.eventEmitter,
    );
  }

  async delete(entity: SmsNotifierEntity): Promise<void> {
    await this.smsNotifierModel.deleteOne({ id: entity.id });
    entity.publishEvents(
      this.serviceProvider.logger,
      this.serviceProvider.eventEmitter,
    );
  }
}
