import "reflect-metadata";

import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DataSource, EntityManager } from "typeorm";

import { AppModule } from "../../app.module";
import {
  INVENTORY_ITEM_IDS,
  LISTING_IDS,
  LISTING_ITEM_IDS,
  PRODUCT_IDS,
  SELLER_IDS,
} from "./seed-identifiers";
import { CatalogProduct } from "../../catalog-products/entities/catalog-product.entity";
import { InventoryItem } from "../../inventory-items/entities/inventory-item.entity";
import { ListingItem } from "../../listings/entities/listing-item.entity";
import { Listing } from "../../listings/entities/listing.entity";
import { User } from "../../users/entities/user.entity";

const logger = new Logger("DatabaseUnseed");

async function removeSeeds(manager: EntityManager): Promise<void> {
  // Delete in reverse dependency order to satisfy foreign key constraints.
  // Listing items -> Listings -> Inventory items -> Catalog products -> Users

  // Listing items
  await manager.getRepository(ListingItem).delete([
    LISTING_ITEM_IDS.collectorOnePiece,
    LISTING_ITEM_IDS.collectorBerserk,
    LISTING_ITEM_IDS.traderSpyFamily,
    LISTING_ITEM_IDS.traderDemonSlayer,
    LISTING_ITEM_IDS.collectorDeathNote,
  ]);

  // Listings
  await manager.getRepository(Listing).delete([
    LISTING_IDS.collectorDeluxeBundle,
    LISTING_IDS.traderStarterBundle,
    LISTING_IDS.collectorSoldDeathNote,
  ]);

  // Inventory items
  await manager.getRepository(InventoryItem).delete(Object.values(INVENTORY_ITEM_IDS));

  // Catalog products
  await manager.getRepository(CatalogProduct).delete(Object.values(PRODUCT_IDS));

  // Users
  await manager.getRepository(User).delete(Object.values(SELLER_IDS));
}

async function unseedDatabase(): Promise<void> {
  const application = await NestFactory.createApplicationContext(AppModule);

  try {
    const dataSource = application.get(DataSource);
    await dataSource.transaction(removeSeeds);

    logger.log("Removed seed users, products, inventory items, listings, and listing items.");
  } finally {
    await application.close();
  }
}

void unseedDatabase().catch((error: unknown) => {
  const details = error instanceof Error ? error.stack : String(error);

  logger.error("Removing seed data failed.", details);
  process.exitCode = 1;
});
