import { Controller, Get } from '@nestjs/common';
import { ActorLogsService } from './applicationService/services/actorLog.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('/actor-logs')
@ApiTags('/actor-logs')
export class ActorLogController {
  constructor(private readonly actorLogsService: ActorLogsService) {}

  @Get('/dictionary')
  async getDictionary(): Promise<any> {
    return this.actorLogsService.getDictionary();
  }
}
