import { v4 } from 'uuid';
import { AggregateID, AggregateRoot } from 'src/dddLib/core';
import { CreateEntityProps } from 'src/dddLib/core/entity.base';

import { PageCreatedDomainEvent } from './events/pageCreated.domainEvent';
import { PageUpdatedDomainEvent } from './events/pageUpdated.domainEvent';
import {
  CreatePageProps,
  PageConfigs,
  PageProps,
  PageValueObjects,
  UpdatePageProps,
} from './page.type';
import { PageDeletedDomainEvent } from './events/pageDeleted.domainEvent';
import { Page } from './valueObjects/pageType.vo';
import { PageIndex } from './valueObjects/pageIndex.vo';
import { PageContent } from './valueObjects/pageContent.vo';
import { PageConfigQueueMsgDto } from '../applicationService/services/queues/pageConfigQueueMsg.dto';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';
import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';

export class PageEntity extends AggregateRoot<PageValueObjects, PageProps> {
  protected readonly _id: AggregateID;

  constructor(props: CreateEntityProps<PageValueObjects>) {
    super(props);
    this._id = props.id;
  }
  static create(createPageProps: CreatePageProps): PageEntity {
    let id;
    if (createPageProps.originId) id = createPageProps.originId;
    else id = v4();
    let pageIndex: number;
    if (createPageProps.pageIndex) pageIndex = createPageProps.pageIndex;
    else pageIndex = 0;
    const props: PageValueObjects = {
      name: new Name(createPageProps.name),
      nvrId: new BusinessId(createPageProps.nvrId),
      type: new Page(createPageProps.type),
      pageIndex: new PageIndex(pageIndex),
      content: new PageContent([]),
      runningConfigs: RunningConfigs.init(),
    };
    const page = new PageEntity({ id, props });
    page.addEvent(
      new PageCreatedDomainEvent({
        aggregateId: id,
        ...page.getProps(),
        metadata: {
          causationId: PageCreatedDomainEvent.name,
        },
      }),
    );
    return page;
  }

  update(updatePageProps: UpdatePageProps) {
    const updatePageValueObjects: Partial<PageValueObjects> = {
      name: this.createValueObjectIfDefined(updatePageProps.name, Name),
      pageIndex: this.createValueObjectIfDefined(
        updatePageProps.pageIndex,
        PageIndex,
      ),
      content: this.createValueObjectIfDefined(
        updatePageProps.content,
        PageContent,
      ),
      runningConfigs: this.createValueObjectIfDefined(
        updatePageProps.runningConfigs,
        RunningConfigs,
      ),
    };
    const cleanedValueObjects = this.removeUndefinedProperties(
      updatePageValueObjects,
    );
    const cleanedProps = this.removeUndefinedProperties(updatePageProps);

    Object.assign(this.props, cleanedValueObjects);
    this.addEvent(
      new PageUpdatedDomainEvent({
        ...cleanedProps,
        aggregateId: this.id,
      }),
    );
    return this;
  }

  delete(): void {
    this.addEvent(
      new PageDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }
  getCloudPubToFogMqttTopics() {
    const mqttPublishTopicsObject = {
      pageConfig: `${this.props.nvrId.unpack()}/page/config/pub`,
    };
    return Object.freeze(mqttPublishTopicsObject);
  }
  getConfigForFog(
    configType: PageConfigs,
    body?: UpdatePageProps,
  ): PageConfigQueueMsgDto {
    const config: PageConfigQueueMsgDto = {
      msgId: generateRandomMsgId(),
      configType,
      nvrId: this.props.nvrId.unpack(),
      data: {},
      metadata: {
        topic: this.getCloudPubToFogMqttTopics().pageConfig,
        entityId: this.id,
        retryCount: 3,
        retryPeriodInSecond: 10,
      },
    };
    let data: object = {};
    switch (configType) {
      case PageConfigs.CREATE_PAGE:
        data = body ?? {};
        break;
      case PageConfigs.UPDATE_PAGE:
        data = {
          ...this.update(body ?? {}).getProps(),
          runningConfigs: undefined,
        };
        break;

      case PageConfigs.DELETE_PAGE:
        data = { id: this.id };
        break;
      default:
        break;
    }
    config.data = data;
    return config;
  }
  validate(): void {}
}
