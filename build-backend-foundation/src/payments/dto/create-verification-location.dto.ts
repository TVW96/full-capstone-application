import { Type } from "class-transformer";
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class VerificationLocationAddressDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  line1!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  line2?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  administrativeArea!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(24)
  postalCode!: string;

  @Matches(/^[A-Za-z]{2}$/)
  country!: string;
}

export class CreateVerificationLocationDto {
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_-]{1,31}$/)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @ValidateNested()
  @Type(() => VerificationLocationAddressDto)
  address!: VerificationLocationAddressDto;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
