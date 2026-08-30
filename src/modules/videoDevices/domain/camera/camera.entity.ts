import { AggregateID, AggregateRoot, CreateEntityProps } from 'src/dddLib/core';
import { v4 } from 'uuid';

import { NotFoundException } from '@nestjs/common';
import { BusinessId } from 'src/dddLib/core/businessId.vo';
import { generateRandomMsgId } from 'src/dddLib/utils/randomIdGenerator';
import { ActorLogTypes } from 'src/modules/shared/dtos/actor.dto';
import { Name } from 'src/modules/shared/valueObjects/name.vo';
import { RunningConfigs } from 'src/modules/shared/valueObjects/runningConfigs.vo';

import { VideoDeviceConfigQueueMsgDto } from '../../applicationService/services/queues/videoDeviceConfig/videoDeviceConfigQueueMsg.dto';
import { VideoDeviceDataQueueMsgDto } from '../../applicationService/services/queues/videoDeviceData/videoDeviceDataQueueMsg.dto';
import { IsActive } from '../../shared/valueObjects/isActive.vo';
import {
  LiveSignalStatus,
  LiveSignalStatuses,
} from '../../shared/valueObjects/liveSignalStatus.vo';
import { SerialNumber } from '../../shared/valueObjects/serialNumber.vo';
import { IsDeleted } from '../../shared/valueObjects/isDeleted.vo';
import { EntityTypes } from '../../shared/valueObjects/entityTypes';
import { cameraDataPubTopic } from '../../shared/deviceMqttTopics';
import { NvrEntity } from '../nvr/nvr.entity';
import {
  CameraCloudPubToFogMqttTopics,
  CameraHardwareSendCommands,
  CameraProps,
  CameraSoftwareConfigs,
  CameraValueObjects,
  CreateCameraProps,
  UpdateCameraProps,
} from './camera.type';
import { CameraActivatedDomainEvent } from './events/cameraActivated.domainEvent';
import { CameraCreatedDomainEvent } from './events/cameraCreated.domainEvent';
import { CameraHardDeletedDomainEvent } from './events/cameraHardDeleted.domainEvent';
import { CameraInActivatedDomainEvent } from './events/cameraInActivated.domainEvent';
import { CameraSoftDeletedDomainEvent } from './events/cameraSoftDeleted.domainEvent';
import { CameraUpdatedDomainEvent } from './events/cameraUpdated.domainEvent';
import { CameraTenantMismatchError } from './exceptions/camera.exception';
import { HasAudio } from './valueObjects/hasAudio';
import { HasPtz } from './valueObjects/hasPtz.vo';
import { MacAddress } from './valueObjects/macAddress.vo';
import { Password } from './valueObjects/password.vo';
import { Port } from './valueObjects/port.vo';
import { ProductModel } from './valueObjects/productModel.vo';
import { Streams } from './valueObjects/streams.vo';
import { Username } from './valueObjects/username.vo';

export class CameraEntity extends AggregateRoot<
  CameraValueObjects,
  CameraProps
> {
  protected readonly _id: AggregateID;

  constructor(props: CreateEntityProps<CameraValueObjects>) {
    super(props);
    this._id = props.id;
  }
  static create(createCameraProps: CreateCameraProps): CameraEntity {
    let id;
    if (createCameraProps.id) id = createCameraProps.id;
    else id = v4();
    const {
      name,
      productModel,
      username,
      password,
      macAddress,
      port,
      streams,
      hasAudio,
      hasPtz,
      nvrId,
    } = createCameraProps;
    const props: CameraValueObjects = {
      tenantId: new BusinessId(createCameraProps.tenantId),
      name: new Name(name),
      productModel: new ProductModel(productModel),
      serialNumber: new SerialNumber(createCameraProps.serialNumber),
      username: new Username(username),
      password: new Password(password),
      macAddress: new MacAddress(macAddress),
      port: new Port(port),
      streams: new Streams(streams),
      hasPtz: new HasPtz(hasPtz),
      hasAudio: new HasAudio(hasAudio),
      nvrId: new BusinessId(nvrId),
      isActive: new IsActive(false),
      isDeleted: IsDeleted.init(),
      liveSignalStatus: LiveSignalStatus.init(),
      runningConfigs: RunningConfigs.init(),
    };
    const camera = new CameraEntity({ id, props });
    camera.addEvent(
      new CameraCreatedDomainEvent({
        aggregateId: id,
        tenantId: createCameraProps.tenantId,
        name: createCameraProps.name,
        productModel: createCameraProps.productModel,
        serialNumber: createCameraProps.serialNumber,
        hasPtz: createCameraProps.hasPtz,
        hasAudio: createCameraProps.hasAudio,
        nvrId: createCameraProps.nvrId,
        metadata: {
          causationId: CameraCreatedDomainEvent.name,
        },
      }),
    );
    return camera;
  }

  update(updateCameraProps: UpdateCameraProps) {
    const updateCameraValueObjects: Partial<CameraValueObjects> = {
      tenantId: this.createValueObjectIfDefined(
        updateCameraProps.tenantId,
        BusinessId,
      ),
      name: this.createValueObjectIfDefined(updateCameraProps.name, Name),
      nvrId: this.createValueObjectIfDefined(
        updateCameraProps.nvrId,
        BusinessId,
      ),
      isDeleted: this.createValueObjectIfDefined(
        updateCameraProps.isDeleted,
        IsDeleted,
      ),
      runningConfigs: this.createValueObjectIfDefined(
        updateCameraProps.runningConfigs,
        RunningConfigs,
      ),
    };
    const cleanedValueObjects = this.removeUndefinedProperties(
      updateCameraValueObjects,
    );
    const cleanedProps = this.removeUndefinedProperties(updateCameraProps);

    Object.assign(this.props, cleanedValueObjects);
    this.addEvent(
      new CameraUpdatedDomainEvent({
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
      new CameraActivatedDomainEvent({
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
    this.props.runningConfigs = RunningConfigs.init();
    this.addEvent(
      new CameraInActivatedDomainEvent({
        aggregateId: this.id,
        name: this.props.name.unpack(),
      }),
    );
  }

  softDelete(): void {
    this.props.isDeleted = new IsDeleted(true);
    this.props.isActive = new IsActive(false);
    this.props.liveSignalStatus = new LiveSignalStatus(
      LiveSignalStatuses.CONNECTED,
    );
    this.props.runningConfigs = RunningConfigs.init();
    this.addEvent(
      new CameraSoftDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  hardDelete(): void {
    this.addEvent(
      new CameraHardDeletedDomainEvent({
        aggregateId: this.id,
      }),
    );
  }

  private getCloudPubToFogMqttTopics(): CameraCloudPubToFogMqttTopics {
    const { nvrId } = this.getProps();
    return Object.freeze({
      cameraData: cameraDataPubTopic(nvrId, this.id),
    });
  }
  generateFogSoftwareConfig(
    nvrEntity: NvrEntity,
    configType: CameraSoftwareConfigs,
    body?: UpdateCameraProps,
  ): VideoDeviceConfigQueueMsgDto {
    this.assertTenantMatches(nvrEntity);
    const config: VideoDeviceConfigQueueMsgDto = {
      msgId: generateRandomMsgId(),
      configType,
      nvrId: nvrEntity.id,
      tenantId: nvrEntity.getProps().tenantId,
      data: {},
      metadata: {
        topic: nvrEntity.getCloudPubToFogMqttTopics().videoDeviceConfigs,
        entityId: this.id,
        entityType: EntityTypes.CAMERA,
        retryCount: 3,
        retryPeriodInSecond: 10,
      },
    };
    let data;
    switch (configType) {
      case CameraSoftwareConfigs.UPDATE:
        data = {
          ...this.update(body ?? {}).getProps(),
          runningConfigs: undefined,
        };
        break;
      default:
        throw new NotFoundException(`${configType} config is not exist`);
    }
    config.data = data;
    return config;
  }

  generateFogHardwareCommand(
    cmdKey: CameraHardwareSendCommands,
    data: number[],
    optionalProps?: { actorType: ActorLogTypes; actorId: string },
  ): VideoDeviceDataQueueMsgDto {
    const msgId = generateRandomMsgId();
    const command = this.createHardwareMsg({
      cameraId: this.id,
      cmdKey,
      msgId,
      data,
    });

    return {
      msgId,
      configType: cmdKey,
      data: command,
      nvrId: this.getProps().nvrId,
      tenantId: this.getProps().tenantId,
      metadata: {
        topic: this.getCloudPubToFogMqttTopics().cameraData,
        entityId: this.id,
        entityType: EntityTypes.CAMERA,
        retryCount: 2,
        retryPeriodInSecond: 5,
        actorProps: optionalProps || undefined,
      },
    };
  }

  private createHardwareMsg(props: {
    cameraId: string;
    cmdKey: string;
    msgId: string;
    data: number[];
  }) {
    const { cameraId, cmdKey, msgId, data } = props;
    return `${cameraId},${cmdKey},${msgId},${data.join(',')}`;
  }

  isConnected(): boolean {
    return this.getProps().liveSignalStatus === LiveSignalStatuses.CONNECTED;
  }

  isDisconnected(): boolean {
    return (
      this.getProps().liveSignalStatus === LiveSignalStatuses.DIS_CONNECTED
    );
  }

  assertTenantMatches(nvrEntity: NvrEntity): void {
    if (this.props.tenantId.unpack() !== nvrEntity.getProps().tenantId) {
      throw new CameraTenantMismatchError(undefined, {
        cameraId: this.id,
        nvrId: nvrEntity.id,
      });
    }
  }

  validate(): void {}
}
