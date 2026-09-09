import { IsUUID } from "class-validator";

export class AssignVerificationLocationDto {
  @IsUUID("4")
  verificationLocationId!: string;
}
