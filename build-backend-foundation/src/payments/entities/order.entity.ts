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

import { User } from "../../users/entities/user.entity";
import { OrderItem } from "./order-item.entity";
import { VerificationLocation } from "./verification-location.entity";

export enum OrderStatus {
  // Kept for rows created before the verification workflow migration.
  PAID = "paid",
  PAYMENT_RECEIVED = "payment_received",
  AWAITING_LOCATION = "awaiting_location",
  AWAITING_SELLER_SHIPMENT = "awaiting_seller_shipment",
  INBOUND_IN_TRANSIT = "inbound_in_transit",
  UNDER_VERIFICATION = "under_verification",
  VERIFIED = "verified",
  VERIFICATION_FAILED = "verification_failed",
  OUTBOUND_SHIPPED = "outbound_shipped",
  TRANSFER_PROCESSING = "transfer_processing",
  COMPLETED = "completed",
  REFUND_PENDING = "refund_pending",
  REFUND_FAILED = "refund_failed",
  REFUNDED = "refunded",
  DISPUTED = "disputed",
  TRANSFER_REVERSED = "transfer_reversed",
}

export enum TransferStatus {
  BLOCKED = "blocked",
  READY = "ready",
  PROCESSING = "processing",
  RELEASED = "released",
  FAILED = "failed",
  REVERSED = "reversed",
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

  @Column({
    name: "stripe_charge_id",
    type: "varchar",
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeChargeId!: string | null;

  @Column({
    name: "stripe_transfer_group",
    type: "varchar",
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeTransferGroup!: string | null;

  @Column({ name: "buyer_id", type: "uuid", nullable: true })
  buyerId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "buyer_id" })
  buyer!: User | null;

  @Column({ name: "seller_id", type: "uuid", nullable: true })
  sellerId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: "RESTRICT" })
  @JoinColumn({ name: "seller_id" })
  seller!: User | null;

  @Column({ name: "verification_location_id", type: "uuid", nullable: true })
  verificationLocationId!: string | null;

  @ManyToOne(() => VerificationLocation, (location) => location.orders, {
    nullable: true,
    onDelete: "RESTRICT",
  })
  @JoinColumn({ name: "verification_location_id" })
  verificationLocation!: VerificationLocation | null;

  @Column({ name: "buyer_email", type: "varchar", length: 320, nullable: true })
  buyerEmail!: string | null;

  @Column({ name: "amount_total", type: "integer" })
  amountTotal!: number;

  @Column({ type: "varchar", length: 3, default: "usd" })
  currency!: string;

  @Column({ name: "seller_gross_amount", type: "integer", default: 0 })
  sellerGrossAmount!: number;

  @Column({ name: "platform_fee_amount", type: "integer", default: 0 })
  platformFeeAmount!: number;

  @Column({ name: "seller_net_amount", type: "integer", default: 0 })
  sellerNetAmount!: number;

  @Column({
    type: "enum",
    enum: OrderStatus,
    default: OrderStatus.PAYMENT_RECEIVED,
  })
  status!: OrderStatus;

  @Column({
    name: "seller_connected_account_id_snapshot",
    type: "varchar",
    length: 255,
    nullable: true,
  })
  sellerConnectedAccountIdSnapshot!: string | null;

  @Column({
    name: "transfer_status",
    type: "enum",
    enum: TransferStatus,
    default: TransferStatus.BLOCKED,
  })
  transferStatus!: TransferStatus;

  @Column({
    name: "stripe_transfer_id",
    type: "varchar",
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeTransferId!: string | null;

  @Column({ name: "transfer_failure_reason", type: "text", nullable: true })
  transferFailureReason!: string | null;

  @Column({ name: "transferred_at", type: "timestamptz", nullable: true })
  transferredAt!: Date | null;

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

  @Column({ name: "inbound_carrier", type: "varchar", length: 80, nullable: true })
  inboundCarrier!: string | null;

  @Column({
    name: "inbound_tracking_number",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  inboundTrackingNumber!: string | null;

  @Column({ name: "inbound_shipped_at", type: "timestamptz", nullable: true })
  inboundShippedAt!: Date | null;

  @Column({ name: "received_at", type: "timestamptz", nullable: true })
  receivedAt!: Date | null;

  @Column({ name: "verification_notes", type: "text", nullable: true })
  verificationNotes!: string | null;

  @Column({
    name: "verification_failure_reason",
    type: "text",
    nullable: true,
  })
  verificationFailureReason!: string | null;

  @Column({ name: "verified_at", type: "timestamptz", nullable: true })
  verifiedAt!: Date | null;

  @Column({ name: "outbound_carrier", type: "varchar", length: 80, nullable: true })
  outboundCarrier!: string | null;

  @Column({
    name: "outbound_tracking_number",
    type: "varchar",
    length: 120,
    nullable: true,
  })
  outboundTrackingNumber!: string | null;

  @Column({ name: "outbound_shipped_at", type: "timestamptz", nullable: true })
  outboundShippedAt!: Date | null;

  @Column({
    name: "stripe_refund_id",
    type: "varchar",
    length: 255,
    nullable: true,
    unique: true,
  })
  stripeRefundId!: string | null;

  @Column({ name: "refunded_amount", type: "integer", default: 0 })
  refundedAmount!: number;

  @Column({ name: "refund_failure_reason", type: "text", nullable: true })
  refundFailureReason!: string | null;

  @Column({ name: "refunded_at", type: "timestamptz", nullable: true })
  refundedAt!: Date | null;

  @Column({ name: "pre_dispute_status", type: "varchar", length: 40, nullable: true })
  preDisputeStatus!: OrderStatus | null;

  @OneToMany(() => OrderItem, (item) => item.order)
  items!: OrderItem[];

  @CreateDateColumn({ name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at" })
  updatedAt!: Date;
}
