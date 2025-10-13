import { ExceptionBase } from 'src/dddLib/core/exceptions';

export class PageAlreadyExistsError extends ExceptionBase {
  static readonly message = 'Page already exists';

  public readonly code = 'Page.ALREADY_EXISTS';

  constructor(cause?: Error, metadata?: unknown) {
    super(PageAlreadyExistsError.message, cause, metadata);
  }
}
