import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { Listing } from "../../listings/entities/listing.entity";
import { User } from "../../users/entities/user.entity";
import { Order } from "./order.entity";

export type PurchasedCopySnapshot = {
  itemId: string;
  condition: string;
  conditionNotes: string | null;
};

@Entity({ name: "order_items" })
export class OrderItem {
  @PrimaryGeneratedColumn("uuid", { name: "order_item_id" })
  orderItemId!: string;

  @Column({ name: "order_id", type: "uuid" })
  orderId!: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order!: Order;

  @Column({ name: "listing_id", type: "uuid" })
  listingId!: string;

  @ManyToOne(() => Listing, { onDelete: "RESTRICT" })
  @JoinColumn({ name: "listing_id" })
  listing!: Listing;

  @Column({ name: "seller_id", type: "uuid", nullable: true })
  sellerId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "seller_id" })
  seller!: User | null;

  @Column({ type: "varchar", length: 160 })
  title!: string;

  @Column({ name: "unit_amount", type: "integer" })
  unitAmount!: number;

  @Column({ name: "condition_snapshot", type: "jsonb", nullable: true })
  conditionSnapshot!: PurchasedCopySnapshot[] | null;
}
