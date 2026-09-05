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

import { ListingItem } from "./listing-item.entity";
import { EntityImage } from "../../media/entities/entity-image.entity";
import { User } from "../../users/entities/user.entity";

export enum ListingStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  RESERVED = "reserved",
  SOLD = "sold",
  CANCELLED = "cancelled",
}

@Entity({ name: "listings" })
export class Listing {
  @PrimaryGeneratedColumn("uuid", {
    name: "listing_id",
  })
  listingId: string;

  @Column({
    name: "seller_id",
    type: "uuid",
  })
  sellerId: string;

  @ManyToOne(() => User, (user) => user.listings, {
    nullable: false,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "seller_id" })
  seller: User;

  @Column({
    type: "varchar",
    length: 160,
  })
  title: string;

  @Column({
    type: "text",
    nullable: true,
  })
  description: string | null;

  @Column({
    type: "numeric",
    precision: 10,
    scale: 2,
  })
  price: string;

  @Column({
    type: "enum",
    enum: ListingStatus,
    default: ListingStatus.DRAFT,
  })
  status: ListingStatus;

  @Column({
    name: "reserved_by_checkout_session",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  reservedByCheckoutSession: string | null;

  @Column({
    name: "reservation_expires_at",
    type: "timestamptz",
    nullable: true,
  })
  reservationExpiresAt: Date | null;

  @OneToMany(() => ListingItem, (listingItem) => listingItem.listing)
  listingItems: ListingItem[];

  @OneToMany(() => EntityImage, (image) => image.listing)
  images: EntityImage[];

  @CreateDateColumn({
    name: "created_at",
  })
  createdAt: Date;

  @UpdateDateColumn({
    name: "updated_at",
  })
  updatedAt: Date;
}
