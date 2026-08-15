import { ActorDto } from 'src/modules/shared/dtos/actor.dto';
import { VideoDeviceFogConfigMessage } from 'src/modules/videoDevices/domain/videoDeviceFogMessage.type';

export interface VideoDeviceConfigQueueMsgDto extends Omit<
  VideoDeviceFogConfigMessage,
  'metadata'
> {
  metadata: VideoDeviceFogConfigMessage['metadata'] & {
    actorProps?: ActorDto;
  };
}
