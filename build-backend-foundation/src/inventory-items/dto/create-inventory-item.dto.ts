import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import { InventoryAvailability } from '../entities/inventory-item.entity';

export class CreateInventoryItemDto {
  @IsUUID()
  productId!: string;

  @IsUUID()
  ownerId!: string;

  @IsString()
  @MaxLength(50)
  condition!: string;

  @IsOptional()
  @IsString()
  conditionNotes?: string | null;

  @IsOptional()
  @IsEnum(InventoryAvailability)
  availability?: InventoryAvailability;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  acquisitionPrice?: number | null;

  @IsOptional()
  @IsString()
  sellerPhotoPath?: string | null;
}
