import { IsString, MaxLength } from "class-validator";

export class UpdateBioDto {
  @IsString()
  @MaxLength(600)
  bio: string;
}
