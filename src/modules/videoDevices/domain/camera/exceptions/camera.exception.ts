import { ExceptionBase } from 'src/dddLib/core/exceptions';

export class CameraAlreadyExistsError extends ExceptionBase {
  static readonly message = 'Camera already exists';

  public readonly code = 'Camera.ALREADY_EXISTS';

  constructor(cause?: Error, metadata?: unknown) {
    super(CameraAlreadyExistsError.message, cause, metadata);
  }
}

export class CameraTenantMismatchError extends ExceptionBase {
  static readonly message = 'Camera and NVR must belong to the same tenant';

  public readonly code = 'Camera.TENANT_MISMATCH';

  constructor(cause?: Error, metadata?: unknown) {
    super(CameraTenantMismatchError.message, cause, metadata);
  }
}
