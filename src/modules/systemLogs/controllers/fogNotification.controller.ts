import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { timingSafeEqual } from 'node:crypto';
import { SanawApiNotificationService } from 'src/extensions/sanawApi/services/sanawApiNotification.service';
import { ServiceProvider } from 'src/extensions/serviceProvider/serviceProvider.service';
import { EmployeeApiForSystemLogsService } from 'src/modules/smsNotifier/applicationService/apiForAnotherServices/employeeApiForSystemLogs.service';
import { EmployeeModel } from 'src/modules/tenantAccess/infra/schemas/employee.schema';
import { FogEmailRequestDto } from '../contracts/fogNotification/fogEmail.request.dto';
import { FogSmsRequestDto } from '../contracts/fogNotification/fogSms.request.dto';
import { FogTelegramRequestDto } from '../contracts/fogNotification/fogTelegram.request.dto';
import { FogVoiceCallRequestDto } from '../contracts/fogNotification/fogVoiceCall.request.dto';
import { FindNvrBySerialNumberQuery } from 'src/modules/videoDevices/applicationService/queries/nvr/findNvrBySerialNumber.queryHandler';
import { NvrEntity } from 'src/modules/videoDevices/domain/nvr/nvr.entity';

@ApiTags('/system-logs/fog-notifications')
@Controller('/system-logs/fog-notifications')
export class FogNotificationController {
  constructor(
    private readonly serviceProvider: ServiceProvider,
    private readonly notificationService: SanawApiNotificationService,
    private readonly employeeApiForSystemLogsService: EmployeeApiForSystemLogsService,
  ) {}

  @Post('/sms')
  @HttpCode(HttpStatus.OK)
  async sms(@Body() body: FogSmsRequestDto) {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrBySerialNumberQuery(body.serialNumber),
    );
    if (!nvrEntity) throw new BadRequestException('1');
    else if (
      !accessTokensMatch(nvrEntity.getProps().accessToken, body.accessToken)
    )
      throw new BadRequestException('2');
    const employeeEntity: EmployeeModel | undefined =
      await this.employeeApiForSystemLogsService.findEmployeeWithUserId(
        nvrEntity.getProps().tenantId,
        body.userId,
      );
    if (!employeeEntity) throw new BadRequestException('3');
    return this.notificationService.sms(body);
  }

  @Post('/voice-call')
  @HttpCode(HttpStatus.OK)
  async voiceCall(@Body() body: FogVoiceCallRequestDto) {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrBySerialNumberQuery(body.serialNumber),
    );
    if (!nvrEntity) throw new BadRequestException('1');
    else if (
      !accessTokensMatch(nvrEntity.getProps().accessToken, body.accessToken)
    )
      throw new BadRequestException('2');
    const employeeEntity: EmployeeModel | undefined =
      await this.employeeApiForSystemLogsService.findEmployeeWithUserId(
        nvrEntity.getProps().tenantId,
        body.userId,
      );
    if (!employeeEntity) throw new BadRequestException('3');
    return this.notificationService.voiceCall(body);
  }

  @Post('/email')
  @HttpCode(HttpStatus.OK)
  async email(@Body() body: FogEmailRequestDto) {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrBySerialNumberQuery(body.serialNumber),
    );
    if (!nvrEntity) throw new BadRequestException('1');
    else if (
      !accessTokensMatch(nvrEntity.getProps().accessToken, body.accessToken)
    )
      throw new BadRequestException('2');
    const employeeEntity: EmployeeModel | undefined =
      await this.employeeApiForSystemLogsService.findEmployeeWithUserId(
        nvrEntity.getProps().tenantId,
        body.userId,
      );
    if (!employeeEntity) throw new BadRequestException('3');
    return this.notificationService.email(body);
  }

  @Post('/telegram')
  @HttpCode(HttpStatus.OK)
  async telegram(@Body() body: FogTelegramRequestDto) {
    const nvrEntity: NvrEntity = await this.serviceProvider.queryBus.execute(
      new FindNvrBySerialNumberQuery(body.serialNumber),
    );
    if (!nvrEntity) throw new BadRequestException('1');
    else if (
      !accessTokensMatch(nvrEntity.getProps().accessToken, body.accessToken)
    )
      throw new BadRequestException('2');
    const employeeEntity: EmployeeModel | undefined =
      await this.employeeApiForSystemLogsService.findEmployeeWithUserId(
        nvrEntity.getProps().tenantId,
        body.userId,
      );
    if (!employeeEntity) throw new BadRequestException('3');
    return this.notificationService.telegram(body);
  }
}

/**
 * Constant-time NVR access-token comparison. Same accept/reject result as a
 * plain `!==`, without leaking how many leading bytes matched — mirrors the
 * check FogBackupAuthGuard performs on the same secret.
 */
function accessTokensMatch(expected: string, supplied: string): boolean {
  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}
