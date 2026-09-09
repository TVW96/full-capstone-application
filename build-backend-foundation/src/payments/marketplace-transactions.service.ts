import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import Stripe from "stripe";
import { DataSource, EntityManager } from "typeorm";

import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { AssignVerificationLocationDto } from "./dto/assign-verification-location.dto";
import { CreateVerificationLocationDto } from "./dto/create-verification-location.dto";
import { RecordVerificationDto } from "./dto/record-verification.dto";
import { RefundOrderDto } from "./dto/refund-order.dto";
import { ShipmentDto } from "./dto/shipment.dto";
import { OrderEvent } from "./entities/order-event.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Order, OrderStatus, TransferStatus } from "./entities/order.entity";
import {
  StripeWebhookEvent,
  WebhookProcessingStatus,
} from "./entities/stripe-webhook-event.entity";
import { VerificationLocation } from "./entities/verification-location.entity";
import { createStripeRuntime } from "./stripe-runtime";
import { assertOrderTransition } from "./transaction-state";

type ActorType = OrderEvent["actorType"];
const TRANSFER_RECONCILIATION_DELAY_MS = 5 * 60 * 1000;

export type SellerPaymentStatus = {
  connected: boolean;
  detailsSubmitted: boolean;
  transfersEnabled: boolean;
  payoutsEnabled: boolean;
  ready: boolean;
  requirementsDue: string[];
};

@Injectable()
export class MarketplaceTransactionsService {
  private readonly stripe: Stripe | null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    this.stripe = createStripeRuntime(this.config).client;
  }

  async createSellerOnboardingLink(token: string): Promise<{ url: string }> {
    const user = await this.users.requireAuthenticatedUser(token);
    const stripe = this.requireStripe();
    let accountId = user.stripeConnectedAccountId;

    if (!accountId) {
      const account = await stripe.accounts.create(
        {
          type: "express",
          country: user.region,
          email: user.email,
          capabilities: { transfers: { requested: true } },
          metadata: { marketplace_user_id: user.userId },
        },
        { idempotencyKey: `seller-connect-account:${user.userId}:v1` },
      );
      accountId = account.id;
      await this.updateConnectedAccount(user, account);
    } else {
      const account = await stripe.accounts.retrieve(accountId);
      if (account.deleted) {
        throw new ConflictException(
          "The seller payment account was closed. Contact marketplace support before selling.",
        );
      }
      await this.updateConnectedAccount(user, account);
    }

    const { refreshUrl, returnUrl } = this.connectOnboardingUrls();
    const link = await stripe.accountLinks.create({
      account: accountId,
      collection_options: {
        fields: "eventually_due",
        future_requirements: "include",
      },
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });
    return { url: link.url };
  }

  async getSellerPaymentStatus(token: string): Promise<SellerPaymentStatus> {
    const user = await this.users.requireAuthenticatedUser(token);
    if (!user.stripeConnectedAccountId) return this.paymentStatus(user, []);

    const account = await this.requireStripe().accounts.retrieve(
      user.stripeConnectedAccountId,
    );
    if (account.deleted) {
      return {
        connected: false,
        detailsSubmitted: false,
        transfersEnabled: false,
        payoutsEnabled: false,
        ready: false,
        requirementsDue: ["account_closed"],
      };
    }

    await this.updateConnectedAccount(user, account);
    return this.paymentStatus(user, account.requirements?.currently_due ?? []);
  }

  async handleConnectedAccountUpdated(account: Stripe.Account): Promise<void> {
    const repository = this.dataSource.getRepository(User);
    let user = await repository.findOne({
      where: { stripeConnectedAccountId: account.id },
    });
    const metadataUserId = account.metadata?.marketplace_user_id;
    if (!user && metadataUserId) {
      user = await repository.findOne({ where: { userId: metadataUserId } });
      if (user?.stripeConnectedAccountId) return;
    }
    if (user) await this.updateConnectedAccount(user, account);
  }

  async getSellerOrders(token: string): Promise<Record<string, unknown>[]> {
    const user = await this.users.requireAuthenticatedUser(token);
    const orders = await this.dataSource.getRepository(Order).find({
      where: { sellerId: user.userId },
      relations: { items: true, verificationLocation: true },
      order: { createdAt: "DESC" },
      take: 100,
    });
    return orders.map((order) => this.sellerOrderView(order));
  }

  async getBuyerOrders(token: string): Promise<Record<string, unknown>[]> {
    const user = await this.users.requireAuthenticatedUser(token);
    const orders = await this.dataSource.getRepository(Order).find({
      where: { buyerId: user.userId },
      relations: { items: true },
      order: { createdAt: "DESC" },
      take: 100,
    });
    return orders.map((order) => this.buyerOrderView(order));
  }

  async getCheckoutStatus(
    token: string,
    checkoutSessionId: string,
  ): Promise<Record<string, unknown>> {
    const user = await this.users.requireAuthenticatedUser(token);
    const sessionId = checkoutSessionId.trim();
    if (!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(sessionId)) {
      throw new NotFoundException("Checkout was not found.");
    }

    const order = await this.dataSource.getRepository(Order).findOne({
      where: { stripeCheckoutSessionId: sessionId, buyerId: user.userId },
      relations: { items: true },
    });
    if (order) return this.buyerOrderView(order);

    const session =
      await this.requireStripe().checkout.sessions.retrieve(sessionId);
    if (session.metadata?.buyer_user_id !== user.userId) {
      throw new NotFoundException("Checkout was not found.");
    }
    return {
      checkoutSessionId: session.id,
      status:
        session.payment_status === "paid"
          ? "payment_processing"
          : session.status === "expired"
            ? "expired"
            : "checkout_open",
      paymentStatus: session.payment_status,
    };
  }

  async submitInboundShipment(
    token: string,
    orderId: string,
    dto: ShipmentDto,
  ): Promise<Record<string, unknown>> {
    const user = await this.users.requireAuthenticatedUser(token);
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      if (order.sellerId !== user.userId) {
        throw new NotFoundException("Sale was not found.");
      }
      if (!order.verificationLocationId) {
        throw new ConflictException(
          "A verification location must be assigned before the item ships.",
        );
      }
      const from = order.status;
      assertOrderTransition(from, OrderStatus.INBOUND_IN_TRANSIT);
      order.inboundCarrier = dto.carrier.trim();
      order.inboundTrackingNumber = dto.trackingNumber.trim();
      order.inboundShippedAt = new Date();
      order.status = OrderStatus.INBOUND_IN_TRANSIT;
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "seller",
        actorUserId: user.userId,
        eventType: "inbound_shipment_submitted",
        fromStatus: from,
        metadata: {
          carrier: order.inboundCarrier,
          trackingNumber: order.inboundTrackingNumber,
        },
      });
    });
    return this.requireSellerOrder(user.userId, orderId);
  }

  async createVerificationLocation(
    dto: CreateVerificationLocationDto,
  ): Promise<VerificationLocation> {
    const repository = this.dataSource.getRepository(VerificationLocation);
    const location = repository.create({
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      active: dto.active ?? true,
      address: {
        line1: dto.address.line1.trim(),
        line2: dto.address.line2?.trim() || null,
        city: dto.address.city.trim(),
        administrativeArea: dto.address.administrativeArea.trim(),
        postalCode: dto.address.postalCode.trim(),
        country: dto.address.country.trim().toUpperCase(),
      },
    });
    try {
      return await repository.save(location);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          "A location with that code already exists.",
        );
      }
      throw error;
    }
  }

  listVerificationLocations(): Promise<VerificationLocation[]> {
    return this.dataSource.getRepository(VerificationLocation).find({
      order: { active: "DESC", code: "ASC" },
    });
  }

  async listOperationalOrders(
    status?: OrderStatus,
  ): Promise<Record<string, unknown>[]> {
    const orders = await this.dataSource.getRepository(Order).find({
      where: status ? { status } : {},
      relations: {
        buyer: true,
        seller: true,
        items: true,
        verificationLocation: true,
      },
      order: { createdAt: "ASC" },
      take: 200,
    });
    return orders.map((order) => this.operationsOrderView(order));
  }

  async assignVerificationLocation(
    orderId: string,
    dto: AssignVerificationLocationDto,
    actorUserId: string,
  ): Promise<Record<string, unknown>> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const location = await manager
        .getRepository(VerificationLocation)
        .findOne({
          where: {
            verificationLocationId: dto.verificationLocationId,
            active: true,
          },
        });
      if (!location)
        throw new NotFoundException("Active location was not found.");

      const from = order.status;
      assertOrderTransition(from, OrderStatus.AWAITING_SELLER_SHIPMENT);
      order.verificationLocationId = location.verificationLocationId;
      order.status = OrderStatus.AWAITING_SELLER_SHIPMENT;
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "operations",
        actorUserId,
        eventType: "verification_location_assigned",
        fromStatus: from,
        metadata: { verificationLocationId: location.verificationLocationId },
      });
    });
    return this.requireOperationsOrder(orderId);
  }

  async markReceived(
    orderId: string,
    actorUserId: string,
  ): Promise<Record<string, unknown>> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const from = order.status;
      assertOrderTransition(from, OrderStatus.UNDER_VERIFICATION);
      order.receivedAt = new Date();
      order.status = OrderStatus.UNDER_VERIFICATION;
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "operations",
        actorUserId,
        eventType: "received_at_verification_location",
        fromStatus: from,
      });
    });
    return this.requireOperationsOrder(orderId);
  }

  async recordVerification(
    orderId: string,
    dto: RecordVerificationDto,
    actorUserId: string,
  ): Promise<Record<string, unknown>> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const to = dto.approved
        ? OrderStatus.VERIFIED
        : OrderStatus.VERIFICATION_FAILED;
      const from = order.status;
      assertOrderTransition(from, to);
      order.status = to;
      order.verificationNotes = dto.notes?.trim() || null;
      order.verificationFailureReason = dto.approved
        ? null
        : dto.failureReason?.trim() ||
          "Item did not pass physical verification.";
      order.verifiedAt = new Date();
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "operations",
        actorUserId,
        eventType: dto.approved
          ? "physical_verification_passed"
          : "physical_verification_failed",
        fromStatus: from,
        metadata: dto.approved
          ? null
          : { reason: order.verificationFailureReason },
      });
    });

    if (!dto.approved) {
      return this.refundOrder(
        orderId,
        { reason: dto.failureReason ?? "Physical verification failed." },
        actorUserId,
      );
    }
    return this.requireOperationsOrder(orderId);
  }

  async recordOutboundShipment(
    orderId: string,
    dto: ShipmentDto,
    actorUserId: string,
  ): Promise<Record<string, unknown>> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const from = order.status;
      assertOrderTransition(from, OrderStatus.OUTBOUND_SHIPPED);
      order.outboundCarrier = dto.carrier.trim();
      order.outboundTrackingNumber = dto.trackingNumber.trim();
      order.outboundShippedAt = new Date();
      order.transferStatus = TransferStatus.READY;
      order.status = OrderStatus.OUTBOUND_SHIPPED;
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "operations",
        actorUserId,
        eventType: "outbound_shipment_recorded",
        fromStatus: from,
        metadata: {
          carrier: order.outboundCarrier,
          trackingNumber: order.outboundTrackingNumber,
        },
      });
    });
    return this.requireOperationsOrder(orderId);
  }

  async releaseSellerFunds(
    orderId: string,
    actorUserId: string,
  ): Promise<Record<string, unknown>> {
    const stripe = this.requireStripe();
    const preliminary = await this.dataSource.getRepository(Order).findOne({
      where: { orderId },
      relations: { seller: true },
    });
    if (!preliminary) throw new NotFoundException("Order was not found.");
    if (
      !preliminary.sellerConnectedAccountIdSnapshot ||
      !preliminary.stripeChargeId ||
      !preliminary.stripeTransferGroup
    ) {
      throw new ConflictException(
        "This order is missing its seller settlement snapshot and requires manual review.",
      );
    }

    const account = await stripe.accounts.retrieve(
      preliminary.sellerConnectedAccountIdSnapshot,
    );
    if (
      account.deleted ||
      account.capabilities?.transfers !== "active" ||
      !account.payouts_enabled
    ) {
      throw new ConflictException(
        "The seller payment account is not currently eligible to receive funds.",
      );
    }
    if (preliminary.seller) {
      await this.updateConnectedAccount(preliminary.seller, account);
    }

    const charge = await stripe.charges.retrieve(preliminary.stripeChargeId);
    const chargePaymentIntentId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;
    if (
      !charge.paid ||
      charge.status !== "succeeded" ||
      chargePaymentIntentId !== preliminary.stripePaymentIntentId ||
      charge.currency !== preliminary.currency ||
      charge.amount < preliminary.sellerNetAmount ||
      charge.disputed ||
      charge.refunded ||
      charge.amount_refunded > 0
    ) {
      throw new ConflictException(
        "The buyer charge is not an intact matching payment, so seller funds cannot be released.",
      );
    }

    const claimed = await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      if (order.stripeTransferId) return false;
      const staleProcessingAttempt =
        order.transferStatus === TransferStatus.PROCESSING &&
        order.status === OrderStatus.TRANSFER_PROCESSING &&
        order.updatedAt.getTime() <=
          Date.now() - TRANSFER_RECONCILIATION_DELAY_MS;
      if (
        order.transferStatus !== TransferStatus.READY &&
        order.transferStatus !== TransferStatus.FAILED &&
        !staleProcessingAttempt
      ) {
        throw new ConflictException("Seller funds are not ready for release.");
      }
      const from = order.status;
      assertOrderTransition(from, OrderStatus.TRANSFER_PROCESSING);
      order.status = OrderStatus.TRANSFER_PROCESSING;
      order.transferStatus = TransferStatus.PROCESSING;
      order.transferFailureReason = null;
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "operations",
        actorUserId,
        eventType: staleProcessingAttempt
          ? "seller_transfer_reconciliation_retried"
          : "seller_transfer_submitted",
        fromStatus: from,
      });
      return true;
    });
    if (!claimed) return this.requireOperationsOrder(orderId);

    let transfer: Stripe.Transfer;
    try {
      transfer = await stripe.transfers.create(
        {
          amount: preliminary.sellerNetAmount,
          currency: preliminary.currency,
          destination: preliminary.sellerConnectedAccountIdSnapshot,
          source_transaction: preliminary.stripeChargeId,
          transfer_group: preliminary.stripeTransferGroup,
          metadata: { order_id: preliminary.orderId },
        },
        { idempotencyKey: `seller-release:${preliminary.orderId}:v1` },
      );
    } catch (error) {
      await this.recordTransferFailure(orderId, actorUserId, error);
      throw new InternalServerErrorException(
        "Stripe did not accept the seller transfer. The order remains in the retry queue.",
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const from = order.status;
      order.stripeTransferId = transfer.id;
      order.transferredAt = new Date(transfer.created * 1000);
      order.transferStatus = TransferStatus.RELEASED;
      order.transferFailureReason = null;
      if (from === OrderStatus.TRANSFER_PROCESSING) {
        assertOrderTransition(from, OrderStatus.COMPLETED);
        order.status = OrderStatus.COMPLETED;
      }
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "stripe",
        actorUserId: null,
        eventType: "seller_transfer_created",
        fromStatus: from,
        metadata: { stripeTransferId: transfer.id },
      });
    });
    return this.requireOperationsOrder(orderId);
  }

  async refundOrder(
    orderId: string,
    dto: RefundOrderDto,
    actorUserId: string,
  ): Promise<Record<string, unknown>> {
    const stripe = this.requireStripe();
    const orderForRefund = await this.dataSource.transaction(
      async (manager) => {
        const order = await this.lockOrder(manager, orderId);
        if (order.status === OrderStatus.REFUNDED) return null;
        if (
          order.transferStatus === TransferStatus.RELEASED ||
          order.transferStatus === TransferStatus.PROCESSING ||
          order.transferStatus === TransferStatus.FAILED ||
          order.stripeTransferId
        ) {
          throw new ConflictException(
            "A seller transfer exists or was attempted. Reconcile it before refunding the buyer.",
          );
        }
        if (!order.stripePaymentIntentId) {
          throw new ConflictException(
            "This order has no refundable payment reference.",
          );
        }
        const from = order.status;
        assertOrderTransition(from, OrderStatus.REFUND_PENDING);
        order.status = OrderStatus.REFUND_PENDING;
        order.refundFailureReason = null;
        await manager.getRepository(Order).save(order);
        await this.appendEvent(manager, order, {
          actorType: "operations",
          actorUserId,
          eventType: "buyer_refund_submitted",
          fromStatus: from,
          metadata: { reason: dto.reason.trim() },
        });
        return {
          orderId: order.orderId,
          paymentIntentId: order.stripePaymentIntentId,
        };
      },
    );
    if (!orderForRefund) return this.requireOperationsOrder(orderId);

    let refund: Stripe.Refund;
    try {
      refund = await stripe.refunds.create(
        {
          payment_intent: orderForRefund.paymentIntentId,
          reason: "requested_by_customer",
          metadata: {
            order_id: orderForRefund.orderId,
            operational_reason: dto.reason.trim().slice(0, 500),
          },
        },
        { idempotencyKey: `buyer-refund:${orderForRefund.orderId}:v1` },
      );
    } catch (error) {
      await this.recordRefundFailure(orderId, actorUserId, error);
      throw new InternalServerErrorException(
        "Stripe did not accept the refund. The order remains in the retry queue.",
      );
    }

    await this.applyRefundUpdate(refund);
    return this.requireOperationsOrder(orderId);
  }

  async handleDispute(dispute: Stripe.Dispute): Promise<void> {
    const chargeId =
      typeof dispute.charge === "string" ? dispute.charge : dispute.charge.id;
    await this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder("order")
        .setLock("pessimistic_write")
        .where("order.stripeChargeId = :chargeId", { chargeId })
        .getOne();
      if (!order) return;
      const from = order.status;
      const closedInMarketplaceFavor =
        dispute.status === "won" || dispute.status === "warning_closed";
      if (closedInMarketplaceFavor) {
        if (order.status === OrderStatus.DISPUTED) {
          order.status =
            order.preDisputeStatus ?? this.statusAfterResolvedDispute(order);
        }
        order.preDisputeStatus = null;
      } else {
        if (order.status !== OrderStatus.DISPUTED) {
          order.preDisputeStatus = order.status;
        }
        order.status = OrderStatus.DISPUTED;
      }
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "stripe",
        actorUserId: null,
        eventType: "payment_dispute_updated",
        fromStatus: from,
        metadata: {
          disputeId: dispute.id,
          reason: dispute.reason,
          stripeStatus: dispute.status,
        },
      });
    });
  }

  async applyRefundUpdate(refund: Stripe.Refund): Promise<void> {
    const paymentIntentId =
      typeof refund.payment_intent === "string"
        ? refund.payment_intent
        : refund.payment_intent?.id;
    const chargeId =
      typeof refund.charge === "string" ? refund.charge : refund.charge?.id;
    if (!paymentIntentId && !chargeId) return;

    await this.dataSource.transaction(async (manager) => {
      const query = manager
        .getRepository(Order)
        .createQueryBuilder("order")
        .setLock("pessimistic_write");
      if (paymentIntentId) {
        query.where("order.stripePaymentIntentId = :paymentIntentId", {
          paymentIntentId,
        });
      } else {
        query.where("order.stripeChargeId = :chargeId", { chargeId });
      }
      const order = await query.getOne();
      if (!order) return;
      const from = order.status;
      order.stripeRefundId = refund.id;
      order.refundedAmount = Math.max(order.refundedAmount, refund.amount);
      if (refund.status === "succeeded") {
        order.refundedAt = new Date();
        order.refundFailureReason = null;
        if (refund.amount >= order.amountTotal)
          order.status = OrderStatus.REFUNDED;
      } else if (refund.status === "failed" || refund.status === "canceled") {
        order.status = OrderStatus.REFUND_FAILED;
        order.refundFailureReason = refund.failure_reason ?? refund.status;
      }
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "stripe",
        actorUserId: null,
        eventType: "buyer_refund_updated",
        fromStatus: from,
        metadata: {
          stripeRefundId: refund.id,
          stripeStatus: refund.status,
          amount: refund.amount,
        },
      });
    });
  }

  async handleTransferUpdated(transfer: Stripe.Transfer): Promise<void> {
    if (!transfer.reversed) return;
    await this.dataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder("order")
        .setLock("pessimistic_write")
        .where(
          "order.stripeTransferId = :transferId OR order.orderId = :orderId",
          {
            transferId: transfer.id,
            orderId:
              transfer.metadata?.order_id ||
              "00000000-0000-0000-0000-000000000000",
          },
        )
        .getOne();
      if (!order) return;
      const from = order.status;
      order.stripeTransferId = transfer.id;
      order.transferredAt =
        order.transferredAt ?? new Date(transfer.created * 1000);
      order.transferStatus = TransferStatus.REVERSED;
      order.preDisputeStatus = null;
      order.status = OrderStatus.TRANSFER_REVERSED;
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "stripe",
        actorUserId: null,
        eventType: "seller_transfer_reversed",
        fromStatus: from,
        metadata: {
          stripeTransferId: transfer.id,
          amountReversed: transfer.amount_reversed,
        },
      });
    });
  }

  async claimWebhookEvent(event: Stripe.Event): Promise<boolean> {
    const connectedAccountId =
      typeof event.account === "string" ? event.account : null;
    const inserted: Array<{ stripe_event_id: string }> =
      await this.dataSource.query(
        `INSERT INTO stripe_webhook_events (
           stripe_event_id, event_type, livemode, connected_account_id,
           processing_status, attempts
         ) VALUES ($1, $2, $3, $4, 'processing', 1)
         ON CONFLICT (stripe_event_id) DO NOTHING
         RETURNING stripe_event_id`,
        [event.id, event.type, event.livemode, connectedAccountId],
      );
    if (inserted.length > 0) return true;

    const reclaimed: Array<{ stripe_event_id: string }> =
      await this.dataSource.query(
        `UPDATE stripe_webhook_events
         SET processing_status = 'processing', attempts = attempts + 1,
             last_error = NULL, updated_at = now()
         WHERE stripe_event_id = $1
           AND (
             processing_status = 'failed'
             OR (
               processing_status = 'processing'
               AND updated_at < now() - interval '5 minutes'
             )
           )
         RETURNING stripe_event_id`,
        [event.id],
      );
    return reclaimed.length > 0;
  }

  async completeWebhookEvent(eventId: string): Promise<void> {
    await this.dataSource.getRepository(StripeWebhookEvent).update(
      { stripeEventId: eventId },
      {
        processingStatus: WebhookProcessingStatus.PROCESSED,
        processedAt: new Date(),
        lastError: null,
      },
    );
  }

  async failWebhookEvent(eventId: string, error: unknown): Promise<void> {
    await this.dataSource.getRepository(StripeWebhookEvent).update(
      { stripeEventId: eventId },
      {
        processingStatus: WebhookProcessingStatus.FAILED,
        lastError: this.safeError(error),
      },
    );
  }

  private async updateConnectedAccount(
    user: User,
    account: Stripe.Account,
  ): Promise<void> {
    user.stripeConnectedAccountId = account.id;
    user.stripeDetailsSubmitted = account.details_submitted;
    user.stripeTransfersEnabled = account.capabilities?.transfers === "active";
    user.stripePayoutsEnabled = account.payouts_enabled;
    user.stripeAccountUpdatedAt = new Date();
    await this.dataSource.getRepository(User).save(user);
  }

  private paymentStatus(
    user: User,
    requirementsDue: string[],
  ): SellerPaymentStatus {
    const connected = Boolean(user.stripeConnectedAccountId);
    return {
      connected,
      detailsSubmitted: user.stripeDetailsSubmitted,
      transfersEnabled: user.stripeTransfersEnabled,
      payoutsEnabled: user.stripePayoutsEnabled,
      ready:
        connected &&
        user.stripeDetailsSubmitted &&
        user.stripeTransfersEnabled &&
        user.stripePayoutsEnabled,
      requirementsDue,
    };
  }

  private statusAfterResolvedDispute(order: Order): OrderStatus {
    if (order.transferStatus === TransferStatus.REVERSED) {
      return OrderStatus.TRANSFER_REVERSED;
    }
    if (order.refundedAmount >= order.amountTotal) return OrderStatus.REFUNDED;
    if (order.transferStatus === TransferStatus.RELEASED) {
      return OrderStatus.COMPLETED;
    }
    if (order.transferStatus === TransferStatus.PROCESSING) {
      return OrderStatus.TRANSFER_PROCESSING;
    }
    if (order.outboundShippedAt) return OrderStatus.OUTBOUND_SHIPPED;
    if (order.verificationFailureReason) {
      return order.refundFailureReason
        ? OrderStatus.REFUND_FAILED
        : OrderStatus.VERIFICATION_FAILED;
    }
    if (order.verifiedAt) return OrderStatus.VERIFIED;
    if (order.receivedAt) return OrderStatus.UNDER_VERIFICATION;
    if (order.inboundShippedAt) return OrderStatus.INBOUND_IN_TRANSIT;
    if (order.verificationLocationId) {
      return OrderStatus.AWAITING_SELLER_SHIPMENT;
    }
    return OrderStatus.AWAITING_LOCATION;
  }

  private connectOnboardingUrls(): { refreshUrl: string; returnUrl: string } {
    const frontendUrl = (
      this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const refreshUrl =
      this.config.get<string>("STRIPE_CONNECT_REFRESH_URL")?.trim() ||
      `${frontendUrl}/account/payouts?connect=refresh`;
    const returnUrl =
      this.config.get<string>("STRIPE_CONNECT_RETURN_URL")?.trim() ||
      `${frontendUrl}/account/payouts?connect=returned`;
    if (
      this.config.get<string>("NODE_ENV") === "production" &&
      (!refreshUrl.startsWith("https://") || !returnUrl.startsWith("https://"))
    ) {
      throw new InternalServerErrorException(
        "Production Stripe Connect return URLs must use HTTPS.",
      );
    }
    return { refreshUrl, returnUrl };
  }

  private async lockOrder(
    manager: EntityManager,
    orderId: string,
  ): Promise<Order> {
    const order = await manager
      .getRepository(Order)
      .createQueryBuilder("order")
      .setLock("pessimistic_write")
      .where("order.orderId = :orderId", { orderId })
      .getOne();
    if (!order) throw new NotFoundException("Order was not found.");
    return order;
  }

  private async appendEvent(
    manager: EntityManager,
    order: Order,
    event: {
      eventType: string;
      actorType: ActorType;
      actorUserId: string | null;
      fromStatus: OrderStatus | null;
      metadata?: Record<string, unknown> | null;
    },
  ): Promise<void> {
    await manager.getRepository(OrderEvent).save(
      manager.getRepository(OrderEvent).create({
        orderId: order.orderId,
        eventType: event.eventType,
        actorType: event.actorType,
        actorUserId: event.actorUserId,
        fromStatus: event.fromStatus,
        toStatus: order.status,
        metadata: event.metadata ?? null,
      }),
    );
  }

  private async recordTransferFailure(
    orderId: string,
    actorUserId: string,
    error: unknown,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const from = order.status;
      if (from === OrderStatus.TRANSFER_PROCESSING) {
        order.status = OrderStatus.OUTBOUND_SHIPPED;
      }
      order.transferStatus = TransferStatus.FAILED;
      order.transferFailureReason = this.safeError(error);
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "operations",
        actorUserId,
        eventType: "seller_transfer_failed",
        fromStatus: from,
      });
    });
  }

  private async recordRefundFailure(
    orderId: string,
    actorUserId: string,
    error: unknown,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const order = await this.lockOrder(manager, orderId);
      const from = order.status;
      order.status = OrderStatus.REFUND_FAILED;
      order.refundFailureReason = this.safeError(error);
      await manager.getRepository(Order).save(order);
      await this.appendEvent(manager, order, {
        actorType: "operations",
        actorUserId,
        eventType: "buyer_refund_failed",
        fromStatus: from,
      });
    });
  }

  private async requireSellerOrder(
    sellerId: string,
    orderId: string,
  ): Promise<Record<string, unknown>> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { orderId, sellerId },
      relations: { items: true, verificationLocation: true },
    });
    if (!order) throw new NotFoundException("Sale was not found.");
    return this.sellerOrderView(order);
  }

  private async requireOperationsOrder(
    orderId: string,
  ): Promise<Record<string, unknown>> {
    const order = await this.dataSource.getRepository(Order).findOne({
      where: { orderId },
      relations: {
        buyer: true,
        seller: true,
        items: true,
        verificationLocation: true,
      },
    });
    if (!order) throw new NotFoundException("Order was not found.");
    return this.operationsOrderView(order);
  }

  private baseOrderView(order: Order): Record<string, unknown> {
    return {
      orderId: order.orderId,
      status: order.status,
      transferStatus: order.transferStatus,
      amountTotal: order.amountTotal,
      currency: order.currency,
      items: (order.items ?? []).map((item: OrderItem) => ({
        listingId: item.listingId,
        title: item.title,
        unitAmount: item.unitAmount,
        conditionSnapshot: item.conditionSnapshot,
      })),
      inboundShipment:
        order.inboundCarrier && order.inboundTrackingNumber
          ? {
              carrier: order.inboundCarrier,
              trackingNumber: order.inboundTrackingNumber,
              shippedAt: order.inboundShippedAt,
              receivedAt: order.receivedAt,
            }
          : null,
      outboundShipment:
        order.outboundCarrier && order.outboundTrackingNumber
          ? {
              carrier: order.outboundCarrier,
              trackingNumber: order.outboundTrackingNumber,
              shippedAt: order.outboundShippedAt,
            }
          : null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private buyerOrderView(order: Order): Record<string, unknown> {
    return {
      ...this.baseOrderView(order),
      checkoutSessionId: order.stripeCheckoutSessionId,
      verification: {
        receivedAt: order.receivedAt,
        completedAt: order.verifiedAt,
        passed:
          order.status === OrderStatus.VERIFIED ||
          order.status === OrderStatus.OUTBOUND_SHIPPED ||
          order.status === OrderStatus.TRANSFER_PROCESSING ||
          order.status === OrderStatus.COMPLETED,
      },
      refundedAmount: order.refundedAmount,
    };
  }

  private sellerOrderView(order: Order): Record<string, unknown> {
    return {
      ...this.baseOrderView(order),
      sellerGrossAmount: order.sellerGrossAmount,
      platformFeeAmount: order.platformFeeAmount,
      sellerNetAmount: order.sellerNetAmount,
      verificationLocation: order.verificationLocation
        ? {
            code: order.verificationLocation.code,
            name: order.verificationLocation.name,
            address: order.verificationLocation.address,
          }
        : null,
      transferredAt: order.transferredAt,
    };
  }

  private operationsOrderView(order: Order): Record<string, unknown> {
    return {
      ...this.sellerOrderView(order),
      buyer: order.buyer
        ? { userId: order.buyer.userId, email: order.buyer.email }
        : { email: order.buyerEmail },
      seller: order.seller
        ? {
            userId: order.seller.userId,
            email: order.seller.email,
            payoutReady:
              order.seller.stripeTransfersEnabled &&
              order.seller.stripePayoutsEnabled,
          }
        : null,
      shippingName: order.shippingName,
      shippingAddress: order.shippingAddress,
      verificationNotes: order.verificationNotes,
      verificationFailureReason: order.verificationFailureReason,
      transferFailureReason: order.transferFailureReason,
      refundFailureReason: order.refundFailureReason,
      refundedAmount: order.refundedAmount,
    };
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new InternalServerErrorException(
        "Stripe marketplace payments are not configured.",
      );
    }
    return this.stripe;
  }

  private safeError(error: unknown): string {
    const message =
      error instanceof Error ? error.message : "Unknown provider error";
    return message.replace(/[\r\n]+/g, " ").slice(0, 1000);
  }

  private isUniqueViolation(error: unknown): boolean {
    return Boolean(
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "23505",
    );
  }
}
