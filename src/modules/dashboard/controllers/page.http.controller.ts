import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { PagesHttpService } from '../applicationService/services/page.http.service';
import {
  GetAllPagesResponseDto,
  PageResponseDto,
} from '../contracts/page.response.dto';
import { UpdatePageRequestDto } from '../contracts/updatePage.request.dto';
import { CreatePageRequestDto } from '../contracts/createPage.request.dto';
import { EmployeeRoles } from 'src/extensions/sanawApi/dtos/employees/employeeRoles.enum';
import { SWAGGER_AUTH_TOKEN } from 'src/utilities/swaggerRegisteration';
import { RolesGuardFactory } from 'src/modules/shared/roles.guard';
import { OnlyIdParamRequestDto } from 'src/modules/shared/dtos/onlyIdParam.request.dto';
@ApiBearerAuth(SWAGGER_AUTH_TOKEN)
@ApiTags('/dashboard/pages')
@UseGuards(RolesGuardFactory(EmployeeRoles.Camera_RuleChain_Dashboard))
@Controller('/dashboard/pages')
export class PageHttpController {
  constructor(private readonly pagesService: PagesHttpService) {}
  @Get('/')
  @ApiQuery({ name: 'page', type: Number, required: false })
  @ApiQuery({ name: 'limit', type: Number, required: false })
  find(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page = 1,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit = 10,
  ): Promise<GetAllPagesResponseDto> {
    return this.pagesService.find();
    console.log(page && limit ? '' : '');
  }

  @Get('/:id')
  findOne(@Param() params: OnlyIdParamRequestDto): Promise<PageResponseDto> {
    return this.pagesService.findOne(params.id);
  }

  @Post('/')
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Body() body: CreatePageRequestDto): Promise<string> {
    return this.pagesService.create(body);
  }

  @Put('/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  update(
    @Param() params: OnlyIdParamRequestDto,
    @Body() body: UpdatePageRequestDto,
  ): Promise<string> {
    return this.pagesService.update(params.id, body);
  }

  @Delete('/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  delete(@Param() params: OnlyIdParamRequestDto): Promise<string> {
    return this.pagesService.delete(params.id);
  }
}
