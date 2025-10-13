import { ExceptionBase } from 'src/dddLib/core/exceptions';

export class SmsNotifierAlreadyExistsError extends ExceptionBase {
  static readonly message = 'SmsNotifier already exists';

  public readonly code = 'SMS_NOTIFIER.ALREADY_EXISTS';

  constructor(cause?: Error, metadata?: unknown) {
    super(SmsNotifierAlreadyExistsError.message, cause, metadata);
  }
}
