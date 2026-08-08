import { NotificationLevel } from '../notificationLevel.enum';

export class EmailRequestDto {
  userId!: string;
  message!: string;
  level!: NotificationLevel;
}
