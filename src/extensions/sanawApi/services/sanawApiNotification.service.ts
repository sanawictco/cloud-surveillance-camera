import { BadRequestException, Injectable } from '@nestjs/common';
import axios from 'axios';
import AppConfig from 'configs/app.config';
import { EmailRequestDto } from '../dtos/notifications/request/email.request.dto';
import { SmsRequestDto } from '../dtos/notifications/request/sms.request.dto';
import { TelegramRequestDto } from '../dtos/notifications/request/telegram.request.dto';
import { VoiceCallRequestDto } from '../dtos/notifications/request/voiceCall.request.dto';
import { SanawApiHeader } from '../dtos/sanawApi.header';

const MAX_LEGAL_SPACE_COUNT = 8;
const NOTIFICATION_ENDPOINTS = {
  sms: '/messanger/sms',
  voiceCall: '/messanger/voice-call',
  email: '/messanger/email',
  telegram: '/messanger/telegram',
} as const;
type NotificationRequest =
  SmsRequestDto | VoiceCallRequestDto | EmailRequestDto | TelegramRequestDto;

@Injectable()
export class SanawApiNotificationService {
  async send(
    type: keyof typeof NOTIFICATION_ENDPOINTS,
    body: NotificationRequest,
  ): Promise<void> {
    let message = body.message;
    if (message.split(' ').length - 1 > MAX_LEGAL_SPACE_COUNT) {
      message = message.replaceAll(' ', '_');
    }

    try {
      await axios.post(
        `${AppConfig().sanawApiURL}${NOTIFICATION_ENDPOINTS[type]}`,
        {
          userId: body.userId,
          message,
          level: body.level,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        axios.isAxiosError(err) && err.response?.data
          ? err.response.data
          : AppConfig().internalServerError,
      );
    }
  }

  async sms(body: SmsRequestDto): Promise<void> {
    return this.send('sms', body);
  }

  async voiceCall(body: VoiceCallRequestDto): Promise<void> {
    return this.send('voiceCall', body);
  }

  async email(body: EmailRequestDto): Promise<void> {
    return this.send('email', body);
  }

  async telegram(body: TelegramRequestDto): Promise<void> {
    return this.send('telegram', body);
  }
}
