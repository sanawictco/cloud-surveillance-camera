import { DomainEvent, DomainEventProps } from 'src/dddLib/core';
import { LanguageCode } from 'src/extensions/translation/languageCode.enum';
import { UpdateNvrProps } from '../nvr.type';
import { LiveSignalStatuses } from '../../../shared/valueObjects/liveSignalStatus.vo';

export class NvrUpdatedDomainEvent
  extends DomainEvent
  implements Partial<UpdateNvrProps>
{
  readonly name?: string;
  readonly lang?: LanguageCode;
  readonly liveSignalStatus?: LiveSignalStatuses;
  readonly cloudIsRecovering?: boolean;

  constructor(props: DomainEventProps<NvrUpdatedDomainEvent>) {
    super(props);
    this.name = props.name;
    this.lang = props.lang;
    this.liveSignalStatus = props.liveSignalStatus;
    this.cloudIsRecovering = props.cloudIsRecovering;
  }
}
