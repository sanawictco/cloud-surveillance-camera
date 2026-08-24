import { Module, Global } from '@nestjs/common';
import { HttpService } from './http.service';
import { ApiNodeProxyService } from './apiNodeProxy.service';

@Global()
@Module({
  providers: [HttpService, ApiNodeProxyService],
  exports: [HttpService, ApiNodeProxyService],
})
export class HttpModule {}
