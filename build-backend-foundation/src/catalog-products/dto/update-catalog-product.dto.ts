import { PartialType } from '@nestjs/mapped-types';
import { CreateCatalogProductDto } from './create-catalog-product.dto';

export class UpdateCatalogProductDto extends PartialType(CreateCatalogProductDto) {}
