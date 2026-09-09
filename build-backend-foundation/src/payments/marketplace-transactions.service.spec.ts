import { ConflictException } from "@nestjs/common";
import Stripe from "stripe";

import { User } from "../users/entities/user.entity";
import { OrderEvent } from "./entities/order-event.entity";
import { Order, OrderStatus, TransferStatus } from "./entities/order.entity";
import { MarketplaceTransactionsService } from "./marketplace-transactions.service";

function baseOrder(): Order {
  return {
    orderId: "00000000-0000-4000-8000-000000000101",
    stripeCheckoutSessionId: "cs_test_order",
    stripePaymentIntentId: "pi_order",
    stripeChargeId: "ch_order",
    stripeTransferGroup: "order_group",
    buyerId: "00000000-0000-4000-8000-000000000102",
    buyer: {
      userId: "00000000-0000-4000-8000-000000000102",
      email: "buyer@example.com",
    } as User,
    sellerId: "00000000-0000-4000-8000-000000000103",
    seller: {
      userId: "00000000-0000-4000-8000-000000000103",
      email: "seller@example.com",
      region: "US",
      stripeConnectedAccountId: "acct_seller",
      stripeDetailsSubmitted: true,
      stripeTransfersEnabled: true,
      stripePayoutsEnabled: true,
    } as User,
    verificationLocationId: "00000000-0000-4000-8000-000000000104",
    verificationLocation: null,
    buyerEmail: "buyer@example.com",
    amountTotal: 2500,
    currency: "usd",
    sellerGrossAmount: 2000,
    platformFeeAmount: 200,
    sellerNetAmount: 1800,
    status: OrderStatus.OUTBOUND_SHIPPED,
    sellerConnectedAccountIdSnapshot: "acct_seller",
    transferStatus: TransferStatus.READY,
    stripeTransferId: null,
    transferFailureReason: null,
    transferredAt: null,
    shippingName: "Buyer",
    shippingAddress: null,
    shippingRateId: null,
    inboundCarrier: "USPS",
    inboundTrackingNumber: "INBOUND123",
    inboundShippedAt: new Date("2026-09-01T10:00:00Z"),
    receivedAt: new Date("2026-09-02T10:00:00Z"),
    verificationNotes: "Matched listing.",
    verificationFailureReason: null,
    verifiedAt: new Date("2026-09-02T11:00:00Z"),
    outboundCarrier: "UPS",
    outboundTrackingNumber: "OUTBOUND123",
    outboundShippedAt: new Date("2026-09-02T12:00:00Z"),
    stripeRefundId: null,
    refundedAmount: 0,
    refundFailureReason: null,
    refundedAt: null,
    preDisputeStatus: null,
    items: [],
    createdAt: new Date("2026-09-01T00:00:00Z"),
    updatedAt: new Date("2026-09-02T12:00:00Z"),
  } as Order;
}

function setup(order = baseOrder()) {
  const orderQueryBuilder = {
    setLock: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockImplementation(async () => order),
  };
  const orderRepository = {
    createQueryBuilder: jest.fn(() => orderQueryBuilder),
    findOne: jest.fn().mockImplementation(async () => order),
    save: jest.fn().mockImplementation(async (value: Order) => value),
  };
  const userRepository = {
    findOne: jest.fn(),
    save: jest.fn().mockImplementation(async (value: User) => value),
  };
  const orderEventRepository = {
    create: jest.fn((value: unknown) => value),
    save: jest.fn().mockImplementation(async (value: unknown) => value),
  };
  const repositoryFor = (entity: unknown) => {
    if (entity === Order) return orderRepository;
    if (entity === User) return userRepository;
    if (entity === OrderEvent) return orderEventRepository;
    return { findOne: jest.fn(), save: jest.fn() };
  };
  const manager = { getRepository: jest.fn(repositoryFor) };
  const dataSource = {
    getRepository: jest.fn(repositoryFor),
    query: jest.fn(),
    transaction: jest.fn(
      async (work: (transactionManager: typeof manager) => unknown) =>
        work(manager),
    ),
  };
  const configValues: Record<string, string | undefined> = {
    STRIPE_SECRET_KEY: "sk_test_example",
    FRONTEND_URL: "https://marketplace.example",
  };
  const config = { get: jest.fn((key: string) => configValues[key]) };
  const users = {
    requireAuthenticatedUser: jest
      .fn()
      .mockImplementation(async () => order.seller),
  };

  const accountsRetrieve = jest.fn().mockResolvedValue({
    id: "acct_seller",
    deleted: false,
    details_submitted: true,
    payouts_enabled: true,
    capabilities: { transfers: "active" },
  });
  const accountsCreate = jest.fn();
  const accountLinksCreate = jest.fn();
  const chargesRetrieve = jest.fn().mockResolvedValue({
    id: "ch_order",
    amount: 2500,
    amount_refunded: 0,
    currency: "usd",
    disputed: false,
    paid: true,
    payment_intent: "pi_order",
    refunded: false,
    status: "succeeded",
  });
  const transfersCreate = jest.fn().mockResolvedValue({
    id: "tr_order",
    created: 1_788_900_000,
  });
  const refundsCreate = jest.fn().mockResolvedValue({
    id: "re_order",
    amount: 2500,
    charge: "ch_order",
    payment_intent: "pi_order",
    status: "succeeded",
  });
  const stripe = {
    accounts: { create: accountsCreate, retrieve: accountsRetrieve },
    accountLinks: { create: accountLinksCreate },
    charges: { retrieve: chargesRetrieve },
    refunds: { create: refundsCreate },
    transfers: { create: transfersCreate },
  };
  const service = new MarketplaceTransactionsService(
    dataSource as never,
    config as never,
    users as never,
  );
  (service as unknown as { stripe: unknown }).stripe = stripe;

  return {
    accountLinksCreate,
    accountsCreate,
    chargesRetrieve,
    dataSource,
    order,
    orderEventRepository,
    refundsCreate,
    service,
    transfersCreate,
    userRepository,
    users,
  };
}

describe("MarketplaceTransactionsService", () => {
  it("releases only the snapshotted seller net against the matching charge", async () => {
    const { order, service, transfersCreate } = setup();

    await service.releaseSellerFunds(
      order.orderId,
      "00000000-0000-4000-8000-000000000105",
    );

    expect(transfersCreate).toHaveBeenCalledWith(
      {
        amount: 1800,
        currency: "usd",
        destination: "acct_seller",
        source_transaction: "ch_order",
        transfer_group: "order_group",
        metadata: { order_id: order.orderId },
      },
      { idempotencyKey: `seller-release:${order.orderId}:v1` },
    );
    expect(order.stripeTransferId).toBe("tr_order");
    expect(order.transferStatus).toBe(TransferStatus.RELEASED);
    expect(order.status).toBe(OrderStatus.COMPLETED);
  });

  it("refuses release when the provider charge does not match the order", async () => {
    const { chargesRetrieve, dataSource, order, service, transfersCreate } =
      setup();
    chargesRetrieve.mockResolvedValue({
      amount: 2500,
      amount_refunded: 0,
      currency: "usd",
      disputed: false,
      paid: true,
      payment_intent: "pi_another_order",
      refunded: false,
      status: "succeeded",
    });

    await expect(
      service.releaseSellerFunds(
        order.orderId,
        "00000000-0000-4000-8000-000000000105",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(transfersCreate).not.toHaveBeenCalled();
  });

  it("reconciles a stale in-flight transfer with the same idempotency key", async () => {
    const { order, service, transfersCreate } = setup();
    order.status = OrderStatus.TRANSFER_PROCESSING;
    order.transferStatus = TransferStatus.PROCESSING;
    order.updatedAt = new Date(Date.now() - 6 * 60 * 1000);

    await service.releaseSellerFunds(
      order.orderId,
      "00000000-0000-4000-8000-000000000105",
    );

    expect(transfersCreate).toHaveBeenCalledTimes(1);
    expect(transfersCreate.mock.calls[0][1]).toEqual({
      idempotencyKey: `seller-release:${order.orderId}:v1`,
    });
    expect(order.status).toBe(OrderStatus.COMPLETED);
  });

  it("automatically submits a full idempotent refund after rejection", async () => {
    const { order, refundsCreate, service } = setup();
    order.status = OrderStatus.UNDER_VERIFICATION;
    order.outboundCarrier = null;
    order.outboundTrackingNumber = null;
    order.outboundShippedAt = null;

    await service.recordVerification(
      order.orderId,
      { approved: false, failureReason: "The edition does not match." },
      "00000000-0000-4000-8000-000000000105",
    );

    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payment_intent: "pi_order",
        metadata: expect.objectContaining({ order_id: order.orderId }),
      }),
      { idempotencyKey: `buyer-refund:${order.orderId}:v1` },
    );
    expect(order.refundedAmount).toBe(2500);
    expect(order.status).toBe(OrderStatus.REFUNDED);
  });

  it("does not refund until an existing seller transfer is reconciled", async () => {
    const { order, refundsCreate, service } = setup();
    order.status = OrderStatus.COMPLETED;
    order.transferStatus = TransferStatus.RELEASED;
    order.stripeTransferId = "tr_order";

    await expect(
      service.refundOrder(
        order.orderId,
        { reason: "Buyer return approved." },
        "00000000-0000-4000-8000-000000000105",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("also blocks refunds after an indeterminate failed transfer attempt", async () => {
    const { order, refundsCreate, service } = setup();
    order.transferStatus = TransferStatus.FAILED;

    await expect(
      service.refundOrder(
        order.orderId,
        { reason: "Buyer return approved." },
        "00000000-0000-4000-8000-000000000105",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("restores fulfillment after a dispute closes in the marketplace's favor", async () => {
    const { order, service } = setup();
    order.status = OrderStatus.DISPUTED;
    order.preDisputeStatus = OrderStatus.OUTBOUND_SHIPPED;

    await service.handleDispute({
      id: "dp_order",
      charge: "ch_order",
      reason: "fraudulent",
      status: "won",
    } as Stripe.Dispute);

    expect(order.status).toBe(OrderStatus.OUTBOUND_SHIPPED);
    expect(order.preDisputeStatus).toBeNull();
  });

  it("creates a seller account with a stable idempotency key", async () => {
    const { accountLinksCreate, accountsCreate, order, service, users } =
      setup();
    order.seller!.stripeConnectedAccountId = null;
    accountsCreate.mockResolvedValue({
      id: "acct_new",
      deleted: false,
      details_submitted: false,
      payouts_enabled: false,
      capabilities: { transfers: "pending" },
    });
    accountLinksCreate.mockResolvedValue({
      url: "https://connect.stripe.test/onboard",
    });
    users.requireAuthenticatedUser.mockResolvedValue(order.seller);

    await service.createSellerOnboardingLink("seller-session");

    expect(accountsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "express",
        metadata: { marketplace_user_id: order.sellerId },
      }),
      { idempotencyKey: `seller-connect-account:${order.sellerId}:v1` },
    );
    expect(accountLinksCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        account: "acct_new",
        collection_options: {
          fields: "eventually_due",
          future_requirements: "include",
        },
        type: "account_onboarding",
      }),
    );
  });
});
