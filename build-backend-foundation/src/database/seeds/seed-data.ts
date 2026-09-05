import { EntityManager } from "typeorm";

import { CatalogProduct } from "../../catalog-products/entities/catalog-product.entity";
import { InventoryItem } from "../../inventory-items/entities/inventory-item.entity";
import { ListingItem } from "../../listings/entities/listing-item.entity";
import { Listing } from "../../listings/entities/listing.entity";
import { User } from "../../users/entities/user.entity";
import { catalogProductSeeds } from "./catalog-products.seed";
import { inventoryItemSeeds } from "./inventory-items.seed";
import { listingItemSeeds, listingSeeds } from "./listings.seed";
import { userSeeds } from "./users.seed";

export async function persistSeeds(manager: EntityManager): Promise<void> {
  // Save in dependency order so all foreign-key constraints remain valid.
  await manager.getRepository(User).save(userSeeds);
  await manager.getRepository(CatalogProduct).save(catalogProductSeeds);
  await manager.getRepository(InventoryItem).save(inventoryItemSeeds);
  await manager.getRepository(Listing).save(listingSeeds);
  await manager.getRepository(ListingItem).save(listingItemSeeds);
}

export function getSeedSummary(): string {
  return (
    `${userSeeds.length} users, ` +
    `${catalogProductSeeds.length} catalog products, ` +
    `${inventoryItemSeeds.length} inventory items, ` +
    `${listingSeeds.length} listings, and ` +
    `${listingItemSeeds.length} listing items`
  );
}
