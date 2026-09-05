import { DeepPartial } from "typeorm";

import { ListingItem } from "../../listings/entities/listing-item.entity";
import { Listing, ListingStatus } from "../../listings/entities/listing.entity";
import {
  INVENTORY_ITEM_IDS,
  LISTING_IDS,
  LISTING_ITEM_IDS,
  SELLER_IDS,
} from "./seed-identifiers";

export const listingSeeds: DeepPartial<Listing>[] = [
  {
    listingId: LISTING_IDS.collectorDeluxeBundle,
    sellerId: SELLER_IDS.collector,
    title: "One Piece and Berserk collector bundle",
    description:
      "Two well-kept first volumes: One Piece paperback and Berserk Deluxe.",
    price: "42.00",
    status: ListingStatus.ACTIVE,
  },
  {
    listingId: LISTING_IDS.traderStarterBundle,
    sellerId: SELLER_IDS.trader,
    title: "Modern shonen starter bundle",
    description: "Spy x Family and Demon Slayer volume ones.",
    price: "14.00",
    status: ListingStatus.ACTIVE,
  },
  {
    listingId: LISTING_IDS.collectorSoldDeathNote,
    sellerId: SELLER_IDS.collector,
    title: "Death Note Black Edition Vol. 1",
    description: "Sold listing retained as sample marketplace history.",
    price: "15.00",
    status: ListingStatus.SOLD,
  },
];

export const listingItemSeeds: DeepPartial<ListingItem>[] = [
  {
    listingItemId: LISTING_ITEM_IDS.collectorOnePiece,
    listing: { listingId: LISTING_IDS.collectorDeluxeBundle },
    inventoryItem: { itemId: INVENTORY_ITEM_IDS.collectorOnePiece },
  },
  {
    listingItemId: LISTING_ITEM_IDS.collectorBerserk,
    listing: { listingId: LISTING_IDS.collectorDeluxeBundle },
    inventoryItem: { itemId: INVENTORY_ITEM_IDS.collectorBerserk },
  },
  {
    listingItemId: LISTING_ITEM_IDS.traderSpyFamily,
    listing: { listingId: LISTING_IDS.traderStarterBundle },
    inventoryItem: { itemId: INVENTORY_ITEM_IDS.traderSpyFamily },
  },
  {
    listingItemId: LISTING_ITEM_IDS.traderDemonSlayer,
    listing: { listingId: LISTING_IDS.traderStarterBundle },
    inventoryItem: { itemId: INVENTORY_ITEM_IDS.traderDemonSlayer },
  },
  {
    listingItemId: LISTING_ITEM_IDS.collectorDeathNote,
    listing: { listingId: LISTING_IDS.collectorSoldDeathNote },
    inventoryItem: { itemId: INVENTORY_ITEM_IDS.collectorDeathNote },
  },
];
