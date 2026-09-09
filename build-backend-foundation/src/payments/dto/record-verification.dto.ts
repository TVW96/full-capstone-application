import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

export class RecordVerificationDto {
  @IsBoolean()
  approved!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;

  @ValidateIf((dto: RecordVerificationDto) => !dto.approved)
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  failureReason?: string;
}
