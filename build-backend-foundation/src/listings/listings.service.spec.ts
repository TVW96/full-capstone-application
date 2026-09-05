import {
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import {
  InventoryAvailability,
  InventoryItem,
} from '../inventory-items/entities/inventory-item.entity';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingStatus } from './entities/listing.entity';
import { ListingsService } from './listings.service';

describe('ListingsService', () => {
  let service: ListingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListingsService, { provide: DataSource, useValue: {} }],
    }).compile();

    service = module.get<ListingsService>(ListingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateRequestedItems', () => {
    const sellerId = 'seller-1';

    const buildItem = (
      overrides: Partial<InventoryItem> = {},
    ): InventoryItem =>
      ({
        itemId: 'item-1',
        ownerId: sellerId,
        availability: InventoryAvailability.AVAILABLE,
        ...overrides,
      }) as InventoryItem;

    it('does not throw when all requested items exist, are owned, and available', () => {
      const items = [buildItem(), buildItem({ itemId: 'item-2' })];
      const requestedItemIds = ['item-1', 'item-2'];

      expect(() =>
        (
          service as unknown as {
            validateRequestedItems: (
              inventoryItems: InventoryItem[],
              requestedItemIds: string[],
              sellerId: string,
            ) => void;
          }
        ).validateRequestedItems(items, requestedItemIds, sellerId),
      ).not.toThrow();
    });

    it('throws when one or more requested items do not exist', () => {
      const items = [buildItem()];
      const requestedItemIds = ['item-1', 'item-2'];

      expect(() =>
        (
          service as unknown as {
            validateRequestedItems: (
              inventoryItems: InventoryItem[],
              requestedItemIds: string[],
              sellerId: string,
            ) => void;
          }
        ).validateRequestedItems(items, requestedItemIds, sellerId),
      ).toThrow(BadRequestException);
    });

    it('throws when an item is not owned by the seller', () => {
      const items = [buildItem({ ownerId: 'another-seller' })];
      const requestedItemIds = ['item-1'];

      expect(() =>
        (
          service as unknown as {
            validateRequestedItems: (
              inventoryItems: InventoryItem[],
              requestedItemIds: string[],
              sellerId: string,
            ) => void;
          }
        ).validateRequestedItems(items, requestedItemIds, sellerId),
      ).toThrow(BadRequestException);
    });

    it('throws when an item is unavailable', () => {
      const items = [
        buildItem({ availability: InventoryAvailability.LISTED }),
      ];
      const requestedItemIds = ['item-1'];

      expect(() =>
        (
          service as unknown as {
            validateRequestedItems: (
              inventoryItems: InventoryItem[],
              requestedItemIds: string[],
              sellerId: string,
            ) => void;
          }
        ).validateRequestedItems(items, requestedItemIds, sellerId),
      ).toThrow(BadRequestException);
    });
  });

  describe('findOneWithRelations', () => {
    it('throws NotFoundException when listing is missing', async () => {
      const findOne = jest.fn().mockResolvedValue(null);

      const repository = {
        findOne,
      };

      const mockedService = service as unknown as {
        dataSource: { getRepository: () => { findOne: () => Promise<null> } };
        findOneWithRelations: (
          listingId: string,
          manager?: unknown,
        ) => Promise<unknown>;
      };

      mockedService.dataSource = {
        getRepository: () => repository,
      };

      await expect(
        mockedService.findOneWithRelations('missing-listing'),
      ).rejects.toThrow(NotFoundException);

      expect(findOne).toHaveBeenCalled();
    });
  });

  describe('create payload mapping', () => {
    it('sets listing defaults and formats price to two decimals', async () => {
      const createListingDto: CreateListingDto = {
        title: 'Example Listing',
        itemIds: ['item-1'],
        price: 42,
      };

      const inventoryItems = [
        ({
          itemId: 'item-1',
          ownerId: 'seller-1',
          availability: InventoryAvailability.AVAILABLE,
        }) as InventoryItem,
      ];

      const listingCreate = jest.fn((payload) => payload);
      const listingSave = jest
        .fn()
        .mockResolvedValue({ listingId: 'listing-1' });
      const listingItemCreate = jest.fn((payload) => payload);
      const listingItemSave = jest.fn().mockResolvedValue([]);
      const inventoryQueryBuilder = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(inventoryItems),
      };
      const inventorySave = jest.fn().mockResolvedValue(inventoryItems);

      const repositories = {
        listing: {
          create: listingCreate,
          save: listingSave,
          findOne: jest.fn().mockResolvedValue({ listingId: 'listing-1' }),
        },
        listingItem: {
          create: listingItemCreate,
          save: listingItemSave,
        },
        inventory: {
          createQueryBuilder: jest
            .fn()
            .mockReturnValue(inventoryQueryBuilder),
          save: inventorySave,
        },
      };

      const manager = {
        getRepository: (entity: unknown) => {
          if ((entity as { name?: string }).name === 'Listing') {
            return repositories.listing;
          }

          if ((entity as { name?: string }).name === 'ListingItem') {
            return repositories.listingItem;
          }

          return repositories.inventory;
        },
      };

      const mockedService = service as unknown as {
        dataSource: {
          transaction: (
            callback: (manager: unknown) => Promise<unknown>,
          ) => Promise<unknown>;
        };
      };

      mockedService.dataSource = {
        transaction: (callback) => callback(manager),
      };

      await service.create('seller-1', createListingDto);

      expect(listingCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          sellerId: 'seller-1',
          title: 'Example Listing',
          description: null,
          price: '42.00',
          status: ListingStatus.ACTIVE,
        }),
      );
    });
  });
});
