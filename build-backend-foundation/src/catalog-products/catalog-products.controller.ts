import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { CatalogProductsService } from './catalog-products.service';
import { CreateCatalogProductDto } from './dto/create-catalog-product.dto';
import { UpdateCatalogProductDto } from './dto/update-catalog-product.dto';

@Controller('catalog-products')
export class CatalogProductsController {
  constructor(private readonly catalogProductsService: CatalogProductsService) {}

  @Post()
  create(@Body() createCatalogProductDto: CreateCatalogProductDto) {
    return this.catalogProductsService.create(createCatalogProductDto);
  }

  @Get()
  findAll() {
    return this.catalogProductsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.catalogProductsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCatalogProductDto: UpdateCatalogProductDto) {
    return this.catalogProductsService.update(+id, updateCatalogProductDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.catalogProductsService.remove(+id);
  }
}
