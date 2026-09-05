import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsOptional,
  IsUUID,
} from "class-validator";

export class CreateCheckoutSessionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  listingIds!: string[];

  @IsOptional()
  @IsEmail()
  customerEmail?: string;
}
