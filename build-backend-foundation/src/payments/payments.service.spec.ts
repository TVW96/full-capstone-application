import { BadRequestException } from "@nestjs/common";

import { InventoryAvailability } from "../inventory-items/entities/inventory-item.entity";
import { ListingStatus } from "../listings/entities/listing.entity";
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
      update: jest.fn(),
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
    const create = jest.fn().mockResolvedValue({
      id: "cs_test_reserved",
      url: "https://checkout.stripe.test/session",
    });
    const service = new PaymentsService(dataSource as never, config as never);
    (service as unknown as { stripe: unknown }).stripe = {
      checkout: { sessions: { create, expire: jest.fn() } },
    };
    return { create, records, repository, service };
  }

  it("uses database prices, server shipping options, and reserves unique listings", async () => {
    const { create, records, repository, service } = setup();
    const result = await service.createCheckoutSession({
      listingIds: [records[0].listingId],
    });

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
      }),
    );
    expect(records[0]).toEqual(
      expect.objectContaining({
        status: ListingStatus.RESERVED,
        reservedByCheckoutSession: "cs_test_reserved",
      }),
    );
    expect(repository.save).toHaveBeenCalledWith(records);
  });

  it("does not create a Stripe Session when any requested listing is unavailable", async () => {
    const { create, service } = setup([]);
    await expect(
      service.createCheckoutSession({
        listingIds: ["00000000-0000-4000-8000-000000000001"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });
});
