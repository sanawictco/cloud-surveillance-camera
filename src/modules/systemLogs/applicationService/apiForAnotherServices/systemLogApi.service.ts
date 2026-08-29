import { Injectable } from '@nestjs/common';
import { SystemLogService } from '../services/systemLog.service';
import { AggregateID } from 'src/dddLib/core';

@Injectable()
export class SystemLogApiService {
  constructor(private readonly systemLogService: SystemLogService) {}

  deleteSystemLogs(tenantId: AggregateID, id: AggregateID): Promise<void> {
    return this.systemLogService.deleteSystemLogs(tenantId, id);
  }
}
