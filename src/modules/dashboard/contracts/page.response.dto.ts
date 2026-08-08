import { ResponseBase } from 'src/dddLib/contracts/response.base';
import { PageTypes } from '../domain/valueObjects/pageType.vo';
import { Widget } from '../domain/valueObjects/pageContent.vo';

export class GetAllPagesResponseDto {
  constructor(public widgetPages: PageResponseDto[]) {}
}

export class PageResponseDto extends ResponseBase {
  constructor(
    props: ConstructorParameters<typeof ResponseBase>[0],
    public name: string,
    public type: PageTypes,
    public pageIndex: number,
    public nvrId: string,
    public content: Widget[],
  ) {
    super(props);
  }
}
