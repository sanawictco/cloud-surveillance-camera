import { ExceptionBase } from 'src/dddLib/core/exceptions';

export class EmployeeAlreadyExistsError extends ExceptionBase {
  static readonly message = 'Employee already exists';

  public readonly code = 'Employee.ALREADY_EXISTS';

  constructor(cause?: Error, metadata?: unknown) {
    super(EmployeeAlreadyExistsError.message, cause, metadata);
  }
}
