import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogProductsController } from './catalog-products.controller';
import { CatalogProductsService } from './catalog-products.service';
import { CatalogProduct } from './entities/catalog-product.entity';

describe('CatalogProductsController', () => {
  let controller: CatalogProductsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CatalogProductsController],
      providers: [
        CatalogProductsService,
        {
          provide: getRepositoryToken(CatalogProduct),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<CatalogProductsController>(CatalogProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
