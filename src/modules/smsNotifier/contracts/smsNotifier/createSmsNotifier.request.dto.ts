import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsPhoneNumber,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { SystemLogTypes } from 'src/modules/systemLogs/domain/systemLog.type';

@ValidatorConstraint({ name: 'checkSystemLogTypes', async: false })
export class CheckSystemLogTypes implements ValidatorConstraintInterface {
  validate(systemLogTypes: SystemLogTypes[] /*, args: ValidationArguments*/) {
    if (
      systemLogTypes.length === 1 &&
      !systemLogTypes.includes(SystemLogTypes.ERROR)
    )
      return false;
    else if (
      systemLogTypes.length === 2 &&
      (!systemLogTypes.includes(SystemLogTypes.ERROR) ||
        !systemLogTypes.includes(SystemLogTypes.WARNING))
    )
      return false;
    else if (
      systemLogTypes.length === 3 &&
      (!systemLogTypes.includes(SystemLogTypes.ERROR) ||
        !systemLogTypes.includes(SystemLogTypes.WARNING) ||
        !systemLogTypes.includes(SystemLogTypes.INFORMATION))
    )
      return false;

    return true;
  }

  defaultMessage(/*args: ValidationArguments*/) {
    return `systemLogTyes is not valid`;
  }
}
export class CreateSmsNotifierRequestDto {
  @ApiProperty()
  @IsPhoneNumber('IR')
  phoneNumber!: string;

  // eslint-disable-next-line @darraghor/nestjs-typed/api-property-returning-array-should-set-array
  @ApiProperty()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(3)
  @IsEnum(SystemLogTypes, { each: true })
  @Validate(CheckSystemLogTypes)
  systemLogTypes!: SystemLogTypes[];
}
