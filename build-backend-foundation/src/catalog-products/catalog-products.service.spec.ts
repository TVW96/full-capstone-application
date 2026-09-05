import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CatalogProductsService } from './catalog-products.service';
import { CatalogProduct } from './entities/catalog-product.entity';

describe('CatalogProductsService', () => {
  let service: CatalogProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get<CatalogProductsService>(CatalogProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
