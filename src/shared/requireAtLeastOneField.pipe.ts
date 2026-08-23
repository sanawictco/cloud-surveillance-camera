import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

@Injectable()
export class RequireAtLeastOneFieldPipe implements PipeTransform {
  transform(value: unknown, _metadata: ArgumentMetadata) {
    if (
      value === null ||
      value === undefined ||
      typeof value !== 'object' ||
      Array.isArray(value)
    ) {
      throw new BadRequestException('Request body must be a non-empty object.');
    }

    const hasAtLeastOne = Object.values(value as Record<string, unknown>).some(
      (v) => v !== undefined && v !== null,
    );

    if (!hasAtLeastOne) {
      throw new BadRequestException(
        'Request body must contain at least one field.',
      );
    }

    return value;
  }
}
