import { Injectable } from '@nestjs/common';
import { PageConfigQueueService } from '../services/queues/pageConfigQueue.service';

@Injectable()
export class DashboardApiForFogCommunicationManagerService {
  constructor(
    private readonly pageConfigQueueService: PageConfigQueueService,
  ) {}

  async getPageConfigFromQueue(msgId: string) {
    return await this.pageConfigQueueService.getRepeatableMsg(msgId);
  }
}
