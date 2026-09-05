import { Transform } from "class-transformer";
import {
  IsEmail,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  fullName: string;

  @IsString()
  @MinLength(5)
  @MaxLength(255)
  mailingAddressLine1: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  mailingAddressLine2?: string;

  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim().toUpperCase() : value,
  )
  @IsISO31661Alpha2({
    message: "region must be a valid two-letter country code",
  })
  region: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: "username must contain only letters, numbers, and underscores",
  })
  username: string;

  @IsEmail()
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/[a-zA-Z]/, {
    message: "password must contain at least one letter",
  })
  @Matches(/[0-9]/, {
    message: "password must contain at least one number",
  })
  @Matches(/[^a-zA-Z0-9]/, {
    message: "password must contain at least one special character",
  })
  password: string;
}
