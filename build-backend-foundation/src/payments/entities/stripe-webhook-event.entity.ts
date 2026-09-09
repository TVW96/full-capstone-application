import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from "typeorm";

export enum WebhookProcessingStatus {
  PROCESSING = "processing",
  PROCESSED = "processed",
  FAILED = "failed",
}

@Entity({ name: "stripe_webhook_events" })
export class StripeWebhookEvent {
  @PrimaryColumn({ name: "stripe_event_id", type: "varchar", length: 255 })
  stripeEventId!: string;

  @Column({ name: "event_type", type: "varchar", length: 160 })
  eventType!: string;

  @Column({ type: "boolean" })
  livemode!: boolean;

  @Column({ name: "connected_account_id", type: "varchar", length: 255, nullable: true })
  connectedAccountId!: string | null;

  @Column({
    name: "processing_status",
    type: "enum",
    enum: WebhookProcessingStatus,
    default: WebhookProcessingStatus.PROCESSING,
  })
  processingStatus!: WebhookProcessingStatus;

  @Column({ type: "integer", default: 1 })
  attempts!: number;

  @Column({ name: "last_error", type: "text", nullable: true })
  lastError!: string | null;

  @CreateDateColumn({ name: "received_at", type: "timestamptz" })
  receivedAt!: Date;

  @Column({ name: "processed_at", type: "timestamptz", nullable: true })
  processedAt!: Date | null;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
