import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateAddressDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  label: string;

  @IsString()
  @MinLength(3)
  @MaxLength(255)
  addressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @IsString()
  @MaxLength(100)
  city: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  administrativeArea?: string;

  @IsString()
  @MaxLength(24)
  postalCode: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsISO31661Alpha2({
    message: "country must be a valid two-letter country code",
  })
  country: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateAddressDto extends CreateAddressDto {}
