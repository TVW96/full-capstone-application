import { Type, Transform } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { CreateCatalogProductDto } from "../../catalog-products/dto/create-catalog-product.dto";

export class SellingProductDto extends CreateCatalogProductDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  declare title: string;
}

export class SellingCopyDto {
  @IsOptional()
  @IsUUID("4")
  productId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SellingProductDto)
  product?: SellingProductDto;

  @IsIn(["New", "Like new", "Very good", "Good", "Acceptable"])
  condition: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  conditionNotes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(7, { each: true })
  photoIndexes: number[];
}

export class PublishListingDto {
  @IsUUID("4")
  submissionId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === "string" ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title: string;

  @IsString()
  @MaxLength(5000)
  description: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  price: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SellingCopyDto)
  copies: SellingCopyDto[];
}
