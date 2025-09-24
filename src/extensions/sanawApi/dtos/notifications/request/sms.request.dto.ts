import { NotificationLevel } from '../notificationLevel.enum';

export class SmsRequestDto {
  userId: string;
  message: string;
  level: NotificationLevel;
}
