import { NotificationLevel } from '../notificationLevel.enum';

export class TelegramRequestDto {
  userId!: string;
  message!: string;
  level!: NotificationLevel;
}
