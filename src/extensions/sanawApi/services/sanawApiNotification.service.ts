import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailRequestDto } from '../dtos/notifications/request/email.request.dto';
import { SmsRequestDto } from '../dtos/notifications/request/sms.request.dto';
import { TelegramRequestDto } from '../dtos/notifications/request/telegram.request.dto';
import { VoiceCallRequestDto } from '../dtos/notifications/request/voiceCall.request.dto';
import AppConfig from 'configs/app.config';
import axios from 'axios';
import { SanawApiHeader } from '../dtos/sanawApi.header';
const MAX_LEGAL_SPACE_COUNT = 8;
@Injectable()
export class SanawApiNotificationService {
  constructor() {}

  async sms(body: SmsRequestDto): Promise<void> {
    let message = body.message;
    const spaceCount = message.split(' ').length - 1;
    if (spaceCount > MAX_LEGAL_SPACE_COUNT)
      message = message.replaceAll(' ', '_');
    const url = `${AppConfig().sanawApiURL}/messanger/sms`;

    try {
      await axios.post(
        url,
        {
          userId: body.userId,
          message,
          level: body.level,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }
  async voiceCall(body: VoiceCallRequestDto): Promise<void> {
    const url = `${AppConfig().sanawApiURL}/messanger/voiceCall`;
    let message = body.message;
    const spaceCount = message.split(' ').length - 1;
    if (spaceCount > MAX_LEGAL_SPACE_COUNT)
      message = message.replaceAll(' ', '_');
    try {
      await axios.post(
        url,
        {
          userId: body.userId,
          message,
          level: body.level,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }
  async email(body: EmailRequestDto) {
    const url = `${AppConfig().sanawApiURL}/messanger/email`;
    let message = body.message;
    const spaceCount = message.split(' ').length - 1;
    if (spaceCount > MAX_LEGAL_SPACE_COUNT)
      message = message.replaceAll(' ', '_');
    try {
      await axios.post(
        url,
        {
          userId: body.userId,
          message,
          level: body.level,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }
  async telegram(body: TelegramRequestDto) {
    const url = `${AppConfig().sanawApiURL}/messanger/telegram`;
    let message = body.message;
    const spaceCount = message.split(' ').length - 1;
    if (spaceCount > MAX_LEGAL_SPACE_COUNT)
      message = message.replaceAll(' ', '_');
    try {
      await axios.post(
        url,
        {
          userId: body.userId,
          message,
          level: body.level,
        },
        { headers: SanawApiHeader() },
      );
    } catch (err) {
      throw new BadRequestException(
        err.response?.data || AppConfig().internalServerError,
      );
    }
  }
}
