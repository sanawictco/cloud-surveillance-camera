import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import type { NvrProps } from '../../../../../../cloud-surveillance-camera/src/modules/videoDevices/domain/nvr/nvr.type';
import { LiveSignalStatuses } from '../../../../../../cloud-surveillance-camera/src/modules/videoDevices/shared/valueObjects/liveSignalStatus.vo';

@Schema({ collection: 'nvrs' })
export class NvrModel implements NvrProps {
  @Prop({ unique: true, required: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  workstationId: string;

  @Prop({ required: true })
  maxCameras: number;

  @Prop({ required: true, unique: true })
  serialNumber: string;

  @Prop({ unique: true, required: true })
  accessToken: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  lang: LanguageCode;

  @Prop({ default: false, required: true })
  isActive: boolean;

  @Prop({ required: true })
  liveSignalStatus: LiveSignalStatuses;

  @Prop({ default: false, required: true })
  cloudIsRecovering: boolean;

  @Prop({ default: new Date() })
  createdAt: Date;

  @Prop({ default: new Date() })
  updatedAt: Date;

  @Prop({ type: Object, required: true })
  runningConfigs: Record<string, string>;

  constructor(props?: NvrProps) {
    this.id = '';
    this.name = props?.name ?? '';
    this.workstationId = props?.workstationId ?? '';
    this.maxCameras = props?.maxCameras ?? 0;
    this.serialNumber = props?.serialNumber ?? '';
    this.accessToken = props?.accessToken ?? '';
    this.password = props?.password ?? '';
    this.lang = props?.lang ?? LanguageCode.FA;
    this.isActive = props?.isActive ?? false;
    this.liveSignalStatus =
      props?.liveSignalStatus ?? LiveSignalStatuses.DIS_CONNECTED;
    this.cloudIsRecovering = props?.cloudIsRecovering ?? false;
    this.createdAt = new Date();
    this.updatedAt = new Date();
    this.runningConfigs = props?.runningConfigs ?? {};
  }
}
export const NvrSchema = SchemaFactory.createForClass(NvrModel);
