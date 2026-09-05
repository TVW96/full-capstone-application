import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { InventoryItem } from "../../inventory-items/entities/inventory-item.entity";
import { Listing } from "../../listings/entities/listing.entity";
import { EntityImage } from "../../media/entities/entity-image.entity";
import { MediaAsset } from "../../media/entities/media-asset.entity";
import { UserSession } from "./user-session.entity";
import { UserAddress } from "./user-address.entity";

@Entity({ name: "users" })
export class User {
  @PrimaryGeneratedColumn("uuid", {
    name: "user_id",
  })
  userId: string;

  @Column({
    type: "varchar",
    length: 320,
    unique: true,
  })
  email: string;

  @Column({
    type: "varchar",
    length: 50,
    unique: true,
  })
  username: string;

  @Column({
    name: "full_name",
    type: "varchar",
    length: 120,
  })
  fullName: string;

  @Column({
    name: "mailing_address_line_1",
    type: "varchar",
    length: 255,
  })
  mailingAddressLine1: string;

  @Column({
    name: "mailing_address_line_2",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  mailingAddressLine2: string | null;

  @Column({
    type: "varchar",
    length: 2,
  })
  region: string;

  @Column({
    name: "password_hash",
    type: "varchar",
    length: 255,
    nullable: true,
    select: false,
  })
  passwordHash: string | null;

  @Column({
    name: "avatar_url",
    type: "varchar",
    nullable: true,
  })
  avatarUrl: string | null;

  @Column({ name: "avatar_asset_id", type: "uuid", nullable: true })
  avatarAssetId: string | null;

  @ManyToOne(() => MediaAsset, (asset) => asset.avatarForUsers, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "avatar_asset_id" })
  avatarAsset: MediaAsset | null;

  @Column({ name: "avatar_image_id", type: "uuid", nullable: true })
  avatarImageId: string | null;

  @ManyToOne(() => EntityImage, (image) => image.avatarForUsers, {
    nullable: true,
    onDelete: "SET NULL",
  })
  @JoinColumn({ name: "avatar_image_id" })
  avatarImage: EntityImage | null;

  @Column({
    type: "text",
    nullable: true,
  })
  bio: string | null;

  @OneToMany(() => InventoryItem, (inventoryItem) => inventoryItem.owner)
  inventoryItems: InventoryItem[];

  @OneToMany(() => Listing, (listing) => listing.seller)
  listings: Listing[];

  @OneToMany(() => MediaAsset, (asset) => asset.uploadedByUser)
  uploadedMediaAssets: MediaAsset[];

  @OneToMany(() => EntityImage, (image) => image.user)
  entityImages: EntityImage[];

  @OneToMany(() => EntityImage, (image) => image.publishedByUser)
  publishedEntityImages: EntityImage[];

  @OneToMany(() => UserSession, (session) => session.user)
  sessions: UserSession[];

  @OneToMany(() => UserAddress, (address) => address.user)
  addresses: UserAddress[];

  @CreateDateColumn({
    name: "created_at",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
  })
  updatedAt: Date;
}
