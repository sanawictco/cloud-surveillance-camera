import { ExceptionBase } from 'src/dddLib/core/exceptions';

export class ServiceWorkerRegistrationAlreadyExistsError extends ExceptionBase {
  static readonly message = 'ServiceWorkerRegistration already exists';

  public readonly code = 'ServiceWorkerRegistration.ALREADY_EXISTS';

  constructor(cause?: Error, metadata?: unknown) {
    super(ServiceWorkerRegistrationAlreadyExistsError.message, cause, metadata);
  }
}
