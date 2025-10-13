import { ResponseBase } from 'src/dddLib/contracts/response.base';
import { PageTypes } from '../domain/valueObjects/pageType.vo';
import { Widget } from '../domain/valueObjects/pageContent.vo';

export class GetAllPagesResponseDto {
  widgetPages: PageResponseDto[];
}

export class PageResponseDto extends ResponseBase {
  name: string;
  type: PageTypes;
  pageIndex: number;
  nvrId: string;
  content: Widget[];
}
