import {
  IsDateString,
  IsInt,
  IsISBN,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCatalogProductDto {
  @IsString()
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  series?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  volumeNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  edition?: string;

  @IsOptional()
  @IsISBN()
  isbn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  author?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  publisher?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  @IsOptional()
  @IsDateString()
  publicationDate?: string;
}
