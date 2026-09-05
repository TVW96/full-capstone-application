import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { ListingItem } from "../../listings/entities/listing-item.entity";
import { EntityImage } from "../../media/entities/entity-image.entity";
import { CatalogProduct } from "../../catalog-products/entities/catalog-product.entity";
import { User } from "../../users/entities/user.entity";

export enum InventoryAvailability {
  AVAILABLE = "available",
  LISTED = "listed",
  SOLD = "sold",
  UNAVAILABLE = "unavailable",
}

@Entity({ name: "inventory_items" })
export class InventoryItem {
  @PrimaryGeneratedColumn("uuid", {
    name: "item_id",
  })
  itemId: string;

  @Column({
    name: "product_id",
    type: "uuid",
  })
  productId: string;

  @ManyToOne(() => CatalogProduct, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "product_id" })
  product: CatalogProduct;

  @Column({
    name: "owner_id",
    type: "uuid",
  })
  ownerId: string;

  @ManyToOne(() => User, (user) => user.inventoryItems, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "owner_id" })
  owner: User;

  @Column({
    type: "varchar",
    length: 50,
  })
  condition: string;

  @Column({
    name: "condition_notes",
    type: "text",
    nullable: true,
  })
  conditionNotes: string | null;

  @Column({
    type: "enum",
    enum: InventoryAvailability,
    default: InventoryAvailability.AVAILABLE,
  })
  availability: InventoryAvailability;

  @Column({
    name: "acquisition_price",
    type: "numeric",
    precision: 10,
    scale: 2,
    nullable: true,
  })
  acquisitionPrice: string | null;

  @Column({
    name: "seller_photo_path",
    type: "varchar",
    nullable: true,
  })
  sellerPhotoPath: string | null;

  @OneToMany(() => EntityImage, (image) => image.inventoryItem)
  images: EntityImage[];

  @OneToMany(() => ListingItem, (listingItem) => listingItem.inventoryItem)
  listingItems: ListingItem[];
}
