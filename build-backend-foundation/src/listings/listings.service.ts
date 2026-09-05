import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { DataSource, EntityManager, In, Repository } from "typeorm";

import {
  InventoryAvailability,
  InventoryItem,
} from "../inventory-items/entities/inventory-item.entity";
import { CreateListingDto } from "./dto/create-listing.dto";
import { Listing, ListingStatus } from "./entities/listing.entity";
import { ListingItem } from "./entities/listing-item.entity";

@Injectable()
export class ListingsService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async create(
    sellerId: string,
    createListingDto: CreateListingDto,
  ): Promise<Listing> {
    return this.dataSource.transaction(
      async (manager: EntityManager): Promise<Listing> => {
        const listingRepository = manager.getRepository(Listing);
        const listingItemRepository = manager.getRepository(ListingItem);
        const inventoryRepository = manager.getRepository(InventoryItem);

        const inventoryItems = await inventoryRepository
          .createQueryBuilder("inventoryItem")
          .setLock("pessimistic_write")
          .where("inventoryItem.itemId IN (:...itemIds)", {
            itemIds: createListingDto.itemIds,
          })
          .getMany();

        this.validateRequestedItems(
          inventoryItems,
          createListingDto.itemIds,
          sellerId,
        );

        const listing = listingRepository.create({
          sellerId,
          title: createListingDto.title,
          description: createListingDto.description ?? null,
          price: createListingDto.price.toFixed(2),
          status: ListingStatus.ACTIVE,
        });

        const savedListing = await listingRepository.save(listing);

        const listingItems = inventoryItems.map((inventoryItem) =>
          listingItemRepository.create({
            listing: savedListing,
            inventoryItem,
          }),
        );

        await listingItemRepository.save(listingItems);

        for (const inventoryItem of inventoryItems) {
          inventoryItem.availability = InventoryAvailability.LISTED;
        }

        await inventoryRepository.save(inventoryItems);

        return this.findOneWithRelations(savedListing.listingId, manager);
      },
    );
  }

  async findAll(): Promise<Listing[]> {
    return this.dataSource.getRepository(Listing).find({
      relations: {
        listingItems: {
          inventoryItem: {
            product: true,
            images: {
              asset: true,
            },
          },
        },
        images: {
          asset: true,
        },
      },
      order: {
        createdAt: "DESC",
      },
    });
  }

  async findOne(listingId: string): Promise<Listing> {
    return this.findOneWithRelations(listingId);
  }

  async removeItem(
    listingId: string,
    itemId: string,
    sellerId: string,
  ): Promise<Listing> {
    return this.dataSource.transaction(
      async (manager: EntityManager): Promise<Listing> => {
        const listingRepository = manager.getRepository(Listing);
        const listingItemRepository = manager.getRepository(ListingItem);
        const inventoryRepository = manager.getRepository(InventoryItem);

        const listing = await listingRepository.findOne({
          where: {
            listingId,
            sellerId,
          },
          relations: {
            listingItems: {
              inventoryItem: true,
            },
          },
        });

        if (!listing) {
          throw new NotFoundException("Listing not found.");
        }

        if (listing.listingItems.length <= 1) {
          throw new BadRequestException(
            "A listing must contain at least one inventory item.",
          );
        }

        const listingItem = listing.listingItems.find(
          (currentListingItem) =>
            currentListingItem.inventoryItem.itemId === itemId,
        );

        if (!listingItem) {
          throw new NotFoundException(
            "The inventory item is not part of this listing.",
          );
        }

        await listingItemRepository.remove(listingItem);

        listingItem.inventoryItem.availability =
          InventoryAvailability.AVAILABLE;

        await inventoryRepository.save(listingItem.inventoryItem);

        return this.findOneWithRelations(listingId, manager);
      },
    );
  }

  private async findOneWithRelations(
    listingId: string,
    manager?: EntityManager,
  ): Promise<Listing> {
    const repository: Repository<Listing> = manager
      ? manager.getRepository(Listing)
      : this.dataSource.getRepository(Listing);

    const listing = await repository.findOne({
      where: {
        listingId,
      },
      relations: {
        listingItems: {
          inventoryItem: {
            product: true,
            images: {
              asset: true,
            },
          },
        },
        images: {
          asset: true,
        },
      },
    });

    if (!listing) {
      throw new NotFoundException("Listing not found.");
    }

    return listing;
  }

  private validateRequestedItems(
    inventoryItems: InventoryItem[],
    requestedItemIds: string[],
    sellerId: string,
  ): void {
    if (inventoryItems.length !== requestedItemIds.length) {
      throw new BadRequestException(
        "One or more inventory items do not exist.",
      );
    }

    const itemNotOwnedBySeller = inventoryItems.find(
      (inventoryItem) => inventoryItem.ownerId !== sellerId,
    );

    if (itemNotOwnedBySeller) {
      throw new BadRequestException(
        "You may only list inventory items that you own.",
      );
    }

    const unavailableItem = inventoryItems.find(
      (inventoryItem) =>
        inventoryItem.availability !== InventoryAvailability.AVAILABLE,
    );

    if (unavailableItem) {
      throw new BadRequestException(
        `Inventory item ${unavailableItem.itemId} is not available.`,
      );
    }
  }
}
