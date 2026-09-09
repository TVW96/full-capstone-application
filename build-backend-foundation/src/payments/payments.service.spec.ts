import { BadRequestException } from "@nestjs/common";

import {
  InventoryAvailability,
  InventoryItem,
} from "../inventory-items/entities/inventory-item.entity";
import { Listing, ListingStatus } from "../listings/entities/listing.entity";
import { User } from "../users/entities/user.entity";
import { OrderEvent } from "./entities/order-event.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Order, OrderStatus } from "./entities/order.entity";
import { VerificationLocation } from "./entities/verification-location.entity";
import { PaymentsService } from "./payments.service";

describe("PaymentsService", () => {
  const listing = () => ({
    listingId: "00000000-0000-4000-8000-000000000001",
    title: "Collector manga bundle",
    description: "Two carefully described volumes.",
    price: "20.00",
    status: ListingStatus.ACTIVE,
    reservedByCheckoutSession: null,
    reservationExpiresAt: null,
    sellerId: "00000000-0000-4000-8000-000000000010",
    seller: {
      userId: "00000000-0000-4000-8000-000000000010",
      stripeConnectedAccountId: "acct_seller",
      stripeDetailsSubmitted: true,
      stripeTransfersEnabled: true,
      stripePayoutsEnabled: true,
    },
    listingItems: [
      { inventoryItem: { availability: InventoryAvailability.LISTED } },
    ],
  });

  function setup(records = [listing()]) {
    const queryBuilder = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(records),
    };
    const repository = {
      createQueryBuilder: jest.fn(() => queryBuilder),
      save: jest.fn().mockResolvedValue(records),
      update: jest.fn().mockResolvedValue({ affected: records.length }),
    };
    const manager = { getRepository: jest.fn(() => repository) };
    const dataSource = {
      transaction: jest.fn(async (work: (value: typeof manager) => unknown) =>
        work(manager),
      ),
      getRepository: jest.fn(() => repository),
    };
    const configValues: Record<string, string> = {
      STRIPE_SECRET_KEY: "sk_test_fake",
      FRONTEND_URL: "https://manga.example",
      STRIPE_ALLOWED_SHIPPING_COUNTRIES: "US",
    };
    const config = { get: jest.fn((key: string) => configValues[key]) };
    const users = {
      requireAuthenticatedUser: jest.fn().mockResolvedValue({
        userId: "00000000-0000-4000-8000-000000000020",
        email: "buyer@example.com",
      }),
    };
    const create = jest.fn().mockResolvedValue({
      id: "cs_test_reserved",
      url: "https://checkout.stripe.test/session",
    });
    const expire = jest.fn().mockResolvedValue({
      id: "cs_test_reserved",
      status: "expired",
    });
    const service = new PaymentsService(
      dataSource as never,
      config as never,
      users as never,
    );
    (service as unknown as { stripe: unknown }).stripe = {
      checkout: { sessions: { create, expire } },
    };
    return { create, expire, records, repository, service, users };
  }

  it("uses database prices, server shipping options, and reserves unique listings", async () => {
    const { create, records, repository, service } = setup();
    const result = await service.createCheckoutSession(
      { listingIds: [records[0].listingId] },
      "buyer-session-token",
    );

    expect(result.url).toBe("https://checkout.stripe.test/session");
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "payment",
        shipping_address_collection: { allowed_countries: ["US"] },
        line_items: [
          expect.objectContaining({
            quantity: 1,
            price_data: expect.objectContaining({ unit_amount: 2000 }),
          }),
        ],
        payment_intent_data: expect.objectContaining({
          transfer_group: expect.stringMatching(/^order_/),
          metadata: expect.objectContaining({
            seller_id: records[0].sellerId,
            buyer_user_id: "00000000-0000-4000-8000-000000000020",
          }),
        }),
      }),
      expect.objectContaining({
        idempotencyKey: expect.stringMatching(/^checkout:reservation_/),
      }),
    );
    expect(records[0]).toEqual(
      expect.objectContaining({
        status: ListingStatus.RESERVED,
        reservedByCheckoutSession: expect.stringMatching(/^reservation_/),
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(records);
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: ListingStatus.RESERVED,
        reservedByCheckoutSession: expect.stringMatching(/^reservation_/),
      }),
      { reservedByCheckoutSession: "cs_test_reserved" },
    );
  });

  it("does not create a Stripe Session when any requested listing is unavailable", async () => {
    const { create, service } = setup([]);
    await expect(
      service.createCheckoutSession(
        {
          listingIds: ["00000000-0000-4000-8000-000000000001"],
        },
        "buyer-session-token",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it("keeps inventory reserved when a created Session cannot be safely expired", async () => {
    const { expire, records, repository, service } = setup();
    repository.update.mockResolvedValueOnce({ affected: 0 });
    expire.mockRejectedValueOnce(new Error("Session may already be complete"));

    await expect(
      service.createCheckoutSession(
        { listingIds: [records[0].listingId] },
        "buyer-session-token",
      ),
    ).rejects.toThrow(
      "The checkout reservation changed before it could be finalized.",
    );

    expect(expire).toHaveBeenCalledWith("cs_test_reserved");
    expect(repository.update).toHaveBeenCalledTimes(1);
    expect(records[0].status).toBe(ListingStatus.RESERVED);
  });

  it("records a paid order even if seller capabilities changed after checkout", async () => {
    const paidListing = listing();
    Object.assign(paidListing, {
      status: ListingStatus.RESERVED,
      reservedByCheckoutSession: "cs_test_paid",
      listingItems: [
        {
          inventoryItem: {
            itemId: "00000000-0000-4000-8000-000000000030",
            availability: InventoryAvailability.LISTED,
            condition: "very_good",
            conditionNotes: "Minor shelf wear",
          },
        },
      ],
    });
    Object.assign(paidListing.seller, {
      stripeTransfersEnabled: false,
      stripePayoutsEnabled: false,
    });

    const listingQuery = {
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([paidListing]),
    };
    const listingRepository = {
      createQueryBuilder: jest.fn(() => listingQuery),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const orderRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((value) => value),
      save: jest.fn().mockImplementation(async (value) => ({
        ...value,
        orderId: "00000000-0000-4000-8000-000000000040",
      })),
    };
    const orderItemRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const orderEventRepository = {
      create: jest.fn((value) => value),
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const inventoryRepository = {
      save: jest.fn().mockImplementation(async (value) => value),
    };
    const buyerRepository = {
      findOne: jest.fn().mockResolvedValue({
        userId: "00000000-0000-4000-8000-000000000020",
      }),
    };
    const locationRepository = { findOne: jest.fn() };
    const repositoryFor = (entity: unknown) => {
      if (entity === Listing) return listingRepository;
      if (entity === Order) return orderRepository;
      if (entity === OrderItem) return orderItemRepository;
      if (entity === OrderEvent) return orderEventRepository;
      if (entity === InventoryItem) return inventoryRepository;
      if (entity === User) return buyerRepository;
      if (entity === VerificationLocation) return locationRepository;
      throw new Error("Unexpected repository");
    };
    const manager = { getRepository: jest.fn(repositoryFor) };
    const dataSource = {
      transaction: jest.fn(async (work: (value: typeof manager) => unknown) =>
        work(manager),
      ),
    };
    const configValues: Record<string, string> = {
      STRIPE_SECRET_KEY: "sk_test_fake",
      MARKETPLACE_FEE_BPS: "1000",
    };
    const service = new PaymentsService(
      dataSource as never,
      { get: jest.fn((key: string) => configValues[key]) } as never,
      {} as never,
    );
    (service as unknown as { stripe: unknown }).stripe = {
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          id: "pi_paid",
          amount_received: 2500,
          currency: "usd",
          latest_charge: "ch_paid",
          status: "succeeded",
          transfer_group: "order_paid",
        }),
      },
    };

    await service.fulfillCheckout({
      id: "cs_test_paid",
      amount_total: 2500,
      collected_information: null,
      currency: "usd",
      customer_details: { email: "buyer@example.com" },
      customer_email: "buyer@example.com",
      metadata: {
        buyer_user_id: "00000000-0000-4000-8000-000000000020",
        listing_ids: paidListing.listingId,
        reservation_key: "reservation_paid",
        seller_connected_account_id: "acct_checkout_snapshot",
        seller_id: paidListing.sellerId,
        transfer_group: "order_paid",
      },
      payment_intent: "pi_paid",
      payment_status: "paid",
      shipping_cost: null,
    } as never);

    expect(orderRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        buyerId: "00000000-0000-4000-8000-000000000020",
        sellerConnectedAccountIdSnapshot: "acct_checkout_snapshot",
        sellerGrossAmount: 2000,
        platformFeeAmount: 200,
        sellerNetAmount: 1800,
        status: OrderStatus.AWAITING_LOCATION,
      }),
    );
    expect(paidListing.status).toBe(ListingStatus.SOLD);
  });
});
