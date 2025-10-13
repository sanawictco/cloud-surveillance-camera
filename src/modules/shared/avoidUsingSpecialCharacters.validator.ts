import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'checkExistSpecialCharacter', async: false })
export class AvoidUsingSpecialCharacters
  implements ValidatorConstraintInterface
{
  validate(text: string /*, args: ValidationArguments*/) {
    return !/[!@#$%^&*()+\=\[\]{};':"\\|,.<>\/?]+/.test(text);
  }

  defaultMessage(/*args: ValidationArguments*/) {
    return 'invalid character exists';
  }
}
