import { NotificationLevel } from '../notificationLevel.enum';

export class VoiceCallRequestDto {
  userId!: string;
  message!: string;
  level!: NotificationLevel;
}
