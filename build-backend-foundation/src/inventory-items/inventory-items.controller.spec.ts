import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InventoryItemsController } from './inventory-items.controller';
import { InventoryItemsService } from './inventory-items.service';
import { InventoryItem } from './entities/inventory-item.entity';

describe('InventoryItemsController', () => {
  let controller: InventoryItemsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [InventoryItemsController],
      providers: [
        InventoryItemsService,
        {
          provide: getRepositoryToken(InventoryItem),
          useValue: {
            find: jest.fn(),
            findOneBy: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<InventoryItemsController>(InventoryItemsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
