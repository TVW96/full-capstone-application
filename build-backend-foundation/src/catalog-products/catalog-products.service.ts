import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CreateCatalogProductDto } from './dto/create-catalog-product.dto';
import { UpdateCatalogProductDto } from './dto/update-catalog-product.dto';
import { CatalogProduct } from './entities/catalog-product.entity';

@Injectable()
export class CatalogProductsService {
  constructor(
    @InjectRepository(CatalogProduct)
    private readonly catalogProductsRepository: Repository<CatalogProduct>,
  ) {}

  create(createCatalogProductDto: CreateCatalogProductDto) {
    return 'This action adds a new catalogProduct';
  }

  findAll(): Promise<CatalogProduct[]> {
    return this.catalogProductsRepository.find({
      order: {
        title: 'ASC',
      },
    });
  }

  findOne(productId: string): Promise<CatalogProduct | null> {
    return this.catalogProductsRepository.findOneBy({ productId });
  }

  update(id: number, updateCatalogProductDto: UpdateCatalogProductDto) {
    return `This action updates a #${id} catalogProduct`;
  }

  remove(id: number) {
    return `This action removes a #${id} catalogProduct`;
  }
}
