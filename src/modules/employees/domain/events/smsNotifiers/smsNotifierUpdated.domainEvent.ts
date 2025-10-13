import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { UpdateSmsNotifierProps } from '../../types/smsNotifier.type';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';

export class SmsNotifierUpdatedDomainEvent
  extends DomainEvent
  implements Partial<UpdateSmsNotifierProps>
{
  readonly systemLogTypes: SystemLogTypes[];

  constructor(props: DomainEventProps<SmsNotifierUpdatedDomainEvent>) {
    super(props);
    this.systemLogTypes = props.systemLogTypes;
  }
}
