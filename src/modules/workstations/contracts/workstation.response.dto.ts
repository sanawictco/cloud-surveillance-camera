import { ResponseBase } from 'src/dddLib/contracts/response.base';

export class WorkstationResponseDto extends ResponseBase {
  constructor(
    props: ConstructorParameters<typeof ResponseBase>[0],
    public name: string,
  ) {
    super(props);
  }
}
