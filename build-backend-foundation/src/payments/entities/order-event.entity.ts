import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";

import { User } from "../../users/entities/user.entity";
import { Order, OrderStatus } from "./order.entity";

@Entity({ name: "order_events" })
export class OrderEvent {
  @PrimaryGeneratedColumn("uuid", { name: "order_event_id" })
  orderEventId!: string;

  @Column({ name: "order_id", type: "uuid" })
  orderId!: string;

  @ManyToOne(() => Order, { onDelete: "CASCADE" })
  @JoinColumn({ name: "order_id" })
  order!: Order;

  @Column({ name: "event_type", type: "varchar", length: 80 })
  eventType!: string;

  @Column({ name: "actor_type", type: "varchar", length: 32 })
  actorType!: "system" | "buyer" | "seller" | "operations" | "stripe";

  @Column({ name: "actor_user_id", type: "uuid", nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "actor_user_id" })
  actorUser!: User | null;

  @Column({ name: "from_status", type: "enum", enum: OrderStatus, nullable: true })
  fromStatus!: OrderStatus | null;

  @Column({ name: "to_status", type: "enum", enum: OrderStatus, nullable: true })
  toStatus!: OrderStatus | null;

  @Column({ type: "jsonb", nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
