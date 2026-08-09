import { AggregateID, AggregateRoot, CreateEntityProps } from 'src/dddLib/core';
import { NotFoundException } from 'src/dddLib/core/exceptions';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { AccessToken } from './valueObjects/accessToken.vo';
import { CloudIsRecovering } from './valueObjects/cloudIsRecovering.vo';
import {
  CreateNvrProps,
  NvrCloudPubToFogMqttTopics,
  NvrCloudSubOnFogMqttTopics,
  NvrProps,
  NvrConfigs,
  NvrValueObjects,
  UpdateNvrProps,
} from './nvr.type';
import { v4 } from 'uuid';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { SerialNumber } from '../../shared/valueObjects/serialNumber.vo';
import { NvrPassword } from './valueObjects/nvrPassword.vo';
import { NvrLanguage } from './valueObjects/NvrLanguage.vo';
import {
  LiveSignalStatus,
  LiveSignalStatuses,
} from '../../shared/valueObjects/liveSignalStatus.vo';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';
import { NvrCreatedDomainEvent } from './events/nvrCreated.domainEvent';
import { NvrUpdatedDomainEvent } from './events/nvrUpdated.domainEvent';
import { NvrInActivatedDomainEvent } from './events/nvrInActivated.domainEvent';
import { NvrActivatedDomainEvent } from './events/nvrActivated.domainEvent';
import { NvrDeletedDomainEvent } from './events/nvrDeleted.domainEvent';
import { CameraCloudSubOnFogMqttTopics } from 'src/modules/videoDevices/domain/camera/camera.type';
import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { IsActive } from '../../shared/valueObjects/isActive.vo';
import { MaxCameras } from './valueObjects/maxCameras.vo';
import { VideoDeviceConfigQueueMsgDto } from '../../applicationService/services/queues/videoDeviceConfig/videoDeviceConfigQueueMsg.dto';
import { VideoDeviceEntityTypes } from '../../shared/valueObjects/videoDeviceEntityTypes';

export class NvrEntity extends AggregateRoot<NvrValueObjects, NvrProps> {
  protected readonly _id: AggregateID;

  constructor(props: CreateEntityProps<NvrValueObjects>) {
    super(props);
    this._id = props.id;
  }
  static create(createNvrProps: CreateNvrProps): NvrEntity {
    const id = v4();
    const props: NvrValueObjects = {
      name: new Name(createNvrProps.name),
      serialNumber: new SerialNumber(createNvrProps.serialNumber),
      accessToken: new AccessToken(createNvrProps.accessToken),
      tenantId: new BusinessId(createNvrProps.tenantId),
      password: new NvrPassword(createNvrProps.password),
      maxCameras: new MaxCameras(createNvrProps.maxCameras),
      lang: new NvrLanguage(LanguageCode.FA),
      isActive: IsActive.init(),
      liveSignalStatus: LiveSignalStatus.init(),
      cloudIsRecovering: CloudIsRecovering.init(),
      runningConfigs: RunningConfigs.init(),
    };
    const nvr = new NvrEntity({ id, props });
    nvr.addEvent(
      new NvrCreatedDomainEvent({
        aggregateId: id,
        ...nvr.getProps(),
      }),
    );
    return nvr;
  }

  update(updateNvrProps: UpdateNvrProps) {
    const { ...updateProps } = updateNvrProps;
    const updateNvrValueObjects: Partial<NvrValueObjects> = {
      name: this.createValueObjectIfDefined(updateProps.name, Name),
      password: this.createValueObjectIfDefined(
        updateProps.password,
        NvrPassword,
      ),
      lang: this.createValueObjectIfDefined(updateProps.lang, NvrLanguage),
      liveSignalStatus: this.createValueObjectIfDefined(
        updateProps.liveSignalStatus,
        LiveSignalStatus,
      ),
      cloudIsRecovering: this.createValueObjectIfDefined(
        updateProps.cloudIsRecovering,
        CloudIsRecovering,
      ),
      runningConfigs: this.createValueObjectIfDefined(
        updateProps.runningConfigs,
        RunningConfigs,
      ),
    };

    const cleanedValueObjects = this.removeUndefinedProperties(
      updateNvrValueObjects,
    );
    const cleanedProps = this.removeUndefinedProperties(updateProps);

    Object.assign(this.props, cleanedValueObjects);

    this.addEvent(
      new NvrUpdatedDomainEvent({
        ...cleanedProps,
        aggregateId: this.id,
      }),
    );
    return this;
  }

  active(): void {
    this.props.liveSignalStatus = new LiveSignalStatus(
      LiveSignalStatuses.CONNECTED,
    );
    this.props.isActive = new IsActive(true);
    this.addEvent(
      new NvrActivatedDomainEvent({
        aggregateId: this.id,
        name: this.props.name.unpack(),
      }),
    );
  }

  inactive(): void {
    this.props.isActive = new IsActive(false);
    this.props.liveSignalStatus = new LiveSignalStatus(
      LiveSignalStatuses.CONNECTED,
    );
    this.props.cloudIsRecovering = CloudIsRecovering.init();
    this.props.runningConfigs = RunningConfigs.init();
    this.addEvent(
      new NvrInActivatedDomainEvent({
        aggregateId: this.id,
        name: this.props.name.unpack(),
      }),
    );
  }

  delete(): void {
    this.addEvent(
      new NvrDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  getAllMqttTopics() {
    return {
      subs: this.getCloudSubOnFogMqttTopics(),
      pubs: this.getCloudPubToFogMqttTopics(),
    };
  }

  private getCloudSubOnFogMqttTopics(): Record<string, string> {
    return Object.fromEntries(
      Object.entries(NvrCloudSubOnFogMqttTopics).map(([key, topic]) => [
        key,
        topic.replace('+', this.id),
      ]),
    );
  }

  getCloudPubToFogMqttTopics(): NvrCloudPubToFogMqttTopics {
    const mqttPublishTopicsObject: NvrCloudPubToFogMqttTopics = {
      videoDeviceConfigs: `${this.id}/videoDevice/Config/pub`,
      cloudRecoveryDataAck: `${this.id}/cloudRecoveryData/pub`,
      cloudIsAvailable: `${this.id}/cloudIsAvailable/pub`,
      pageConfig: `${this.id}/page/config/pub`,
    };

    const cameraPublishTopics = this.transformSubscribeToPublishTopics(
      CameraCloudSubOnFogMqttTopics,
      'cameraData',
    );

    return Object.freeze({
      ...mqttPublishTopicsObject,
      ...cameraPublishTopics,
    });
  }

  private transformSubscribeToPublishTopics(
    topics: Record<string, string>,
    key: string,
  ): Record<string, string> {
    const transformedTopics = { ...topics };
    if (transformedTopics[key]) {
      transformedTopics[key] = transformedTopics[key]
        .replace(/\+/, this.id)
        .replace('/sub', '/pub');
    }
    return transformedTopics;
  }

  generateFogConfig(
    configType: NvrConfigs,
    body?: unknown,
  ): VideoDeviceConfigQueueMsgDto {
    const config: VideoDeviceConfigQueueMsgDto = {
      msgId: generateRandomMsgId(),
      configType,
      nvrId: this.id,
      data: {},
      metadata: {
        topic: this.getCloudPubToFogMqttTopics().videoDeviceConfigs,
        entityId: this.id,
        entityType: VideoDeviceEntityTypes.NVR,
        retryCount: 3,
        retryPeriodInSecond: 10,
      },
    };
    let data: object | string = {};
    switch (configType) {
      case NvrConfigs.ACTIVE_NVR:
        data = (body ?? {}) as object;
        break;

      case NvrConfigs.REGISTER:
        data = (body ?? {}) as object;
        config.metadata.retryCount = 2;
        config.metadata.retryPeriodInSecond = 40;
        break;

      case NvrConfigs.UPDATE_NVR:
        data = {
          ...this.update((body ?? {}) as UpdateNvrProps).getProps(),
          runningConfigs: undefined,
        };
        break;

      case NvrConfigs.IN_ACTIVE_NVR:
      case NvrConfigs.DELETE_NVR:
        data = { id: this.id };
        break;

      case NvrConfigs.FOG_LIVE_SIGNAL:
        data = NvrConfigs.FOG_LIVE_SIGNAL;
        break;

      case NvrConfigs.CLOUD_IS_RECOVERING:
        data = NvrConfigs.CLOUD_IS_RECOVERING;
        break;

      default:
        throw new NotFoundException(`${configType} config is not exist`);
    }

    config.data = data;
    return config;
  }

  getCacheKeys(): Record<string, string> {
    const cacheKeys = {
      autoSearchNvrData: `autoSearchNvr-${this.id}`,
      namingCamerasData: `namingCamerasData-${this.id}`,
    };
    return Object.freeze(cacheKeys);
  }

  isConnected(): boolean {
    return this.getProps().liveSignalStatus === LiveSignalStatuses.CONNECTED;
  }

  isDisconnected(): boolean {
    return (
      this.getProps().liveSignalStatus === LiveSignalStatuses.DIS_CONNECTED
    );
  }

  public validate(): void {}
}
