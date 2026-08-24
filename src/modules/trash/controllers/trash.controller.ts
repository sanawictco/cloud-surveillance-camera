import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TrashService } from '../applicationService/services/trash.service';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/trash')
@Controller('/trash')
export class TrashController {
  constructor(private readonly trashService: TrashService) {}
  @Get('/')
  find() {
    return this.trashService.find();
  }
}
