import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { SmsNotifierProps } from '../../types/smsNotifier.type';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';

export class SmsNotifierCreatedDomainEvent
  extends DomainEvent
  implements SmsNotifierProps
{
  readonly userId: string;
  readonly systemLogTypes: SystemLogTypes[];
  constructor(props: DomainEventProps<SmsNotifierCreatedDomainEvent>) {
    super(props);
    this.userId = props.userId;

    this.systemLogTypes = props.systemLogTypes;
  }
}
