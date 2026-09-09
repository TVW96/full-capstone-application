import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ShipmentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  carrier!: string;

  @Matches(/^[A-Za-z0-9][A-Za-z0-9._ -]{2,119}$/)
  trackingNumber!: string;
}
