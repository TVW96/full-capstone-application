import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CatalogProduct } from './entities/catalog-product.entity';
import { CatalogProductsService } from './catalog-products.service';
import { CatalogProductsController } from './catalog-products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CatalogProduct])],
  controllers: [CatalogProductsController],
  providers: [CatalogProductsService],
})
export class CatalogProductsModule {}
