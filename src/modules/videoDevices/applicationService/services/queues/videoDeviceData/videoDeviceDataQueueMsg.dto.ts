import { ActorDto } from 'src/modules/shared/dtos/actor.dto';
import { VideoDeviceFogCommandMessage } from 'src/modules/videoDevices/domain/videoDeviceFogMessage.type';

export interface VideoDeviceDataQueueMsgDto extends Omit<
  VideoDeviceFogCommandMessage,
  'metadata'
> {
  metadata: VideoDeviceFogCommandMessage['metadata'] & {
    actorProps?: ActorDto;
  };
}
