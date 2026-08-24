import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  Validate,
  ValidateNested,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export enum ApiNodeProxyMethod {
  GET = 'GET',
  POST = 'POST',
}

@ValidatorConstraint({ name: 'apiNodeParameterValue', async: false })
class ApiNodeParameterValueValidator implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return ['string', 'number', 'boolean'].includes(typeof value);
  }
}

class ApiNodeProxyParameterDto {
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_.~-]+$/)
  key!: string;

  @Validate(ApiNodeParameterValueValidator)
  value!: string | number | boolean;
}

class ApiNodeProxyHeaderDto {
  @IsString()
  @MaxLength(128)
  @Matches(
    /^(?!(?:host|content-length|proxy-authorization|connection)$)[!#$%&'*+.^_`|~0-9A-Za-z-]+$/i,
  )
  key!: string;

  @IsString()
  @MaxLength(4096)
  @Matches(/^[^\r\n]*$/)
  value!: string;
}

export class ApiNodeProxyRequestDto {
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/)
  serialNumber!: string;

  @IsString()
  @Length(32, 32)
  @Matches(/^[A-Za-z0-9]+$/)
  accessToken!: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @IsEnum(ApiNodeProxyMethod)
  method!: ApiNodeProxyMethod;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => ApiNodeProxyParameterDto)
  parameters!: ApiNodeProxyParameterDto[];

  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ApiNodeProxyHeaderDto)
  headers!: ApiNodeProxyHeaderDto[];
}
