import {
  BaseResponseProps,
  ResponseBase,
} from 'src/dddLib/contracts/response.base';
import { TenantProps } from '../domain/tenant.type';

export class TenantResponseDto extends ResponseBase implements TenantProps {
  readonly ownerId: string;
  readonly name: string;
  readonly status: TenantProps['status'];
  readonly defaultTimezone: string;

  constructor(props: BaseResponseProps & TenantProps) {
    super(props);
    this.ownerId = props.ownerId;
    this.name = props.name;
    this.status = props.status;
    this.defaultTimezone = props.defaultTimezone;
  }
}
