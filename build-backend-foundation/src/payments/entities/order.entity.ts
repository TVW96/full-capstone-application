import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";

import { OrderItem } from "./order-item.entity";

export enum OrderStatus {
  PAID = "paid",
  REFUNDED = "refunded",
}

@Entity({ name: "orders" })
export class Order {
  @PrimaryGeneratedColumn("uuid", { name: "order_id" })
  orderId!: string;

  @Column({
    name: "stripe_checkout_session_id",
    type: "varchar",
    length: 255,
    unique: true,
  })
  stripeCheckoutSessionId!: string;

  @Column({
    name: "stripe_payment_intent_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  stripePaymentIntentId!: string | null;

  @Column({ name: "buyer_email", type: "varchar", length: 320, nullable: true })
  buyerEmail!: string | null;

  @Column({ name: "amount_total", type: "integer" })
  amountTotal!: number;

  @Column({ type: "varchar", length: 3, default: "usd" })
  currency!: string;

  @Column({ type: "enum", enum: OrderStatus, default: OrderStatus.PAID })
  status!: OrderStatus;

  @Column({
    name: "shipping_name",
    type: "varchar",
    length: 160,
    nullable: true,
  })
  shippingName!: string | null;

  @Column({ name: "shipping_address", type: "jsonb", nullable: true })
  shippingAddress!: Record<string, string | null> | null;

  @Column({
    name: "shipping_rate_id",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  shippingRateId!: string | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items!: OrderItem[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;
}
