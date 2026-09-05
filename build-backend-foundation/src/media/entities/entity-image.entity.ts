import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { CatalogProduct } from "../../catalog-products/entities/catalog-product.entity";
import { InventoryItem } from "../../inventory-items/entities/inventory-item.entity";
import { ListingItem } from "../../listings/entities/listing-item.entity";
import { Listing } from "../../listings/entities/listing.entity";
import { User } from "../../users/entities/user.entity";
import { MediaAsset } from "./media-asset.entity";

export enum ImagePublicationSource {
  USER_UPLOAD = "user_upload",
  REUSE = "reuse",
  SYSTEM = "system",
  MIGRATION = "migration",
}

@Entity({ name: "entity_images" })
@Check(
  "CHK_entity_images_exactly_one_target",
  'num_nonnulls("user_id", "catalog_product_id", "inventory_item_id", "listing_id", "listing_item_id") = 1',
)
@Check("CHK_entity_images_position", '"position" BETWEEN 0 AND 31')
@Check(
  "CHK_entity_images_reuse_origin",
  '"publication_source" <> \'reuse\' OR "origin_image_id" IS NOT NULL OR "publication_origin" LIKE \'entity-image:%\'',
)
@Check(
  "CHK_entity_images_publication_origin",
  'length(trim("publication_origin")) > 0',
)
@Check(
  "CHK_entity_images_avatar_position",
  '"user_id" IS NULL OR "position" = 0',
)
@Index("IDX_entity_images_user", ["userId"], {
  unique: true,
  where: '"user_id" IS NOT NULL',
})
@Index("IDX_entity_images_catalog_position", ["catalogProductId", "position"], {
  unique: true,
  where: '"catalog_product_id" IS NOT NULL',
})
@Index("IDX_entity_images_catalog_asset", ["catalogProductId", "assetId"], {
  unique: true,
  where: '"catalog_product_id" IS NOT NULL',
})
@Index(
  "IDX_entity_images_inventory_position",
  ["inventoryItemId", "position"],
  {
    unique: true,
    where: '"inventory_item_id" IS NOT NULL',
  },
)
@Index("IDX_entity_images_inventory_asset", ["inventoryItemId", "assetId"], {
  unique: true,
  where: '"inventory_item_id" IS NOT NULL',
})
@Index("IDX_entity_images_listing_position", ["listingId", "position"], {
  unique: true,
  where: '"listing_id" IS NOT NULL',
})
@Index("IDX_entity_images_listing_asset", ["listingId", "assetId"], {
  unique: true,
  where: '"listing_id" IS NOT NULL',
})
@Index(
  "IDX_entity_images_listing_item_position",
  ["listingItemId", "position"],
  { unique: true, where: '"listing_item_id" IS NOT NULL' },
)
@Index("IDX_entity_images_listing_item_asset", ["listingItemId", "assetId"], {
  unique: true,
  where: '"listing_item_id" IS NOT NULL',
})
@Index("IDX_entity_images_asset", ["assetId"])
@Index("IDX_entity_images_published_by", ["publishedByUserId", "createdAt"])
@Index("UQ_entity_images_avatar_reference", ["imageId", "assetId", "userId"], {
  unique: true,
})
export class EntityImage {
  @PrimaryGeneratedColumn("uuid", { name: "image_id" })
  imageId: string;

  @Column({ name: "asset_id", type: "uuid" })
  assetId: string;

  @ManyToOne(() => MediaAsset, (asset) => asset.entityImages, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "asset_id" })
  asset: MediaAsset;

  @Column({ name: "published_by_user_id", type: "uuid", nullable: true })
  publishedByUserId: string | null;

  @ManyToOne(() => User, (user) => user.publishedEntityImages, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "published_by_user_id" })
  publishedByUser: User | null;

  @Column({
    name: "publication_source",
    type: "enum",
    enum: ImagePublicationSource,
  })
  publicationSource: ImagePublicationSource;

  @Column({ name: "publication_origin", type: "varchar", length: 2048 })
  publicationOrigin: string;

  @Column({ name: "origin_image_id", type: "uuid", nullable: true })
  originImageId: string | null;

  @ManyToOne(() => EntityImage, (image) => image.derivedPublications, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "origin_image_id" })
  originImage: EntityImage | null;

  @OneToMany(() => EntityImage, (image) => image.originImage)
  derivedPublications: EntityImage[];

  @Column({ name: "user_id", type: "uuid", nullable: true })
  userId: string | null;

  @ManyToOne(() => User, (user) => user.entityImages, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "user_id" })
  user: User | null;

  @Column({ name: "catalog_product_id", type: "uuid", nullable: true })
  catalogProductId: string | null;

  @ManyToOne(() => CatalogProduct, (product) => product.images, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "catalog_product_id" })
  catalogProduct: CatalogProduct | null;

  @Column({ name: "inventory_item_id", type: "uuid", nullable: true })
  inventoryItemId: string | null;

  @ManyToOne(() => InventoryItem, (item) => item.images, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "inventory_item_id" })
  inventoryItem: InventoryItem | null;

  @Column({ name: "listing_id", type: "uuid", nullable: true })
  listingId: string | null;

  @ManyToOne(() => Listing, (listing) => listing.images, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "listing_id" })
  listing: Listing | null;

  @Column({ name: "listing_item_id", type: "uuid", nullable: true })
  listingItemId: string | null;

  @ManyToOne(() => ListingItem, (listingItem) => listingItem.images, {
    nullable: true,
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "listing_item_id" })
  listingItem: ListingItem | null;

  @Column({ type: "smallint", default: 0 })
  position: number;

  @Column({ name: "alt_text", type: "varchar", length: 255, nullable: true })
  altText: string | null;

  @OneToMany(() => User, (user) => user.avatarImage)
  avatarForUsers: User[];

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt: Date;
}
