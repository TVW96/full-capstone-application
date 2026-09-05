import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import Stripe from "stripe";
import { DataSource } from "typeorm";

import {
  InventoryAvailability,
  InventoryItem,
} from "../inventory-items/entities/inventory-item.entity";
import { Listing, ListingStatus } from "../listings/entities/listing.entity";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { OrderItem } from "./entities/order-item.entity";
import { Order, OrderStatus } from "./entities/order.entity";

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe | null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {
    const secretKey = this.config.get<string>("STRIPE_SECRET_KEY")?.trim();
    this.stripe = secretKey ? new Stripe(secretKey) : null;
  }

  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const createdSession: { id?: string } = {};

    try {
      return await this.dataSource.transaction(async (manager) => {
        const listings = await manager
          .getRepository(Listing)
          .createQueryBuilder("listing")
          .setLock("pessimistic_write")
          .leftJoinAndSelect("listing.listingItems", "listingItem")
          .leftJoinAndSelect("listingItem.inventoryItem", "inventoryItem")
          .where("listing.listingId IN (:...listingIds)", {
            listingIds: dto.listingIds,
          })
          .andWhere("listing.status = :status", {
            status: ListingStatus.ACTIVE,
          })
          .orderBy("listing.listingId", "ASC")
          .getMany();

        if (listings.length !== dto.listingIds.length) {
          throw new BadRequestException(
            "One or more listings are unavailable or already reserved.",
          );
        }

        const unavailable = listings.find((listing) =>
          listing.listingItems.some(
            ({ inventoryItem }) =>
              inventoryItem.availability !== InventoryAvailability.LISTED,
          ),
        );
        if (unavailable)
          throw new BadRequestException(
            `Listing ${unavailable.listingId} is unavailable.`,
          );

        const listingsById = new Map(
          listings.map((listing) => [listing.listingId, listing]),
        );
        const orderedListings = dto.listingIds.map((id) =>
          listingsById.get(id)!,
        );
        const frontendUrl = (
          this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000"
        ).replace(/\/$/, "");
        const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendUrl}/cart?checkout=cancelled`,
          expires_at: expiresAt,
          customer_email: dto.customerEmail,
          billing_address_collection: "auto",
          shipping_address_collection: {
            allowed_countries: this.allowedShippingCountries(),
          },
          shipping_options: this.shippingOptions(),
          line_items: orderedListings.map((listing) => ({
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: this.priceInCents(listing.price),
              product_data: {
                name: listing.title,
                description:
                  listing.description?.slice(0, 500) ||
                  "Community marketplace manga listing",
                metadata: { listing_id: listing.listingId },
              },
            },
          })),
          automatic_tax: {
            enabled: this.config.get<string>("STRIPE_AUTOMATIC_TAX") === "true",
          },
          phone_number_collection: { enabled: true },
          metadata: { listing_ids: dto.listingIds.join(",") },
          payment_intent_data: {
            metadata: { listing_ids: dto.listingIds.join(",") },
          },
        });
        createdSession.id = session.id;

        if (!session.url)
          throw new InternalServerErrorException(
            "Stripe did not return a checkout URL.",
          );
        for (const listing of listings) {
          listing.status = ListingStatus.RESERVED;
          listing.reservedByCheckoutSession = session.id;
          listing.reservationExpiresAt = new Date(expiresAt * 1000);
        }
        await manager.getRepository(Listing).save(listings);
        return { url: session.url };
      });
    } catch (error) {
      if (createdSession.id) {
        await stripe.checkout.sessions
          .expire(createdSession.id)
          .catch(() => undefined);
      }
      throw error;
    }
  }

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET")?.trim();
    if (!secret)
      throw new InternalServerErrorException(
        "Stripe webhook signing is not configured.",
      );
    return this.requireStripe().webhooks.constructEvent(
      payload,
      signature,
      secret,
    );
  }

  async fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
    if (session.payment_status !== "paid") return;
    const listingIds =
      session.metadata?.listing_ids?.split(",").filter(Boolean) ?? [];
    if (listingIds.length === 0)
      throw new BadRequestException(
        "Checkout Session is missing listing metadata.",
      );

    await this.dataSource.transaction(async (manager) => {
      const orderRepository = manager.getRepository(Order);
      const existing = await orderRepository.findOne({
        where: { stripeCheckoutSessionId: session.id },
      });
      if (existing) return;

      const listings = await manager
        .getRepository(Listing)
        .createQueryBuilder("listing")
        .setLock("pessimistic_write")
        .leftJoinAndSelect("listing.listingItems", "listingItem")
        .leftJoinAndSelect("listingItem.inventoryItem", "inventoryItem")
        .where("listing.listingId IN (:...listingIds)", { listingIds })
        .getMany();

      if (listings.length !== listingIds.length)
        throw new BadRequestException("A purchased listing no longer exists.");
      const reservationMismatch = listings.find(
        (listing) =>
          listing.status !== ListingStatus.RESERVED ||
          listing.reservedByCheckoutSession !== session.id,
      );
      if (reservationMismatch)
        throw new BadRequestException(
          "A purchased listing is not reserved by this Checkout Session.",
        );

      const shipping = session.collected_information?.shipping_details;
      const order = await orderRepository.save(
        orderRepository.create({
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === "string"
              ? session.payment_intent
              : (session.payment_intent?.id ?? null),
          buyerEmail:
            session.customer_details?.email ?? session.customer_email ?? null,
          amountTotal: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          status: OrderStatus.PAID,
          shippingName: shipping?.name ?? null,
          shippingAddress: shipping?.address ? { ...shipping.address } : null,
          shippingRateId: session.shipping_cost?.shipping_rate
            ? typeof session.shipping_cost.shipping_rate === "string"
              ? session.shipping_cost.shipping_rate
              : session.shipping_cost.shipping_rate.id
            : null,
        }),
      );

      await manager.getRepository(OrderItem).save(
        listings.map((listing) =>
          manager.getRepository(OrderItem).create({
            orderId: order.orderId,
            listingId: listing.listingId,
            title: listing.title,
            unitAmount: this.priceInCents(listing.price),
          }),
        ),
      );

      for (const listing of listings) {
        listing.status = ListingStatus.SOLD;
        listing.reservedByCheckoutSession = null;
        listing.reservationExpiresAt = null;
        for (const listingItem of listing.listingItems) {
          listingItem.inventoryItem.availability = InventoryAvailability.SOLD;
          await manager
            .getRepository(InventoryItem)
            .save(listingItem.inventoryItem);
        }
      }
      await manager.getRepository(Listing).save(listings);
    });
  }

  async releaseCheckout(session: Stripe.Checkout.Session): Promise<void> {
    await this.dataSource.getRepository(Listing).update(
      {
        reservedByCheckoutSession: session.id,
        status: ListingStatus.RESERVED,
      },
      {
        status: ListingStatus.ACTIVE,
        reservedByCheckoutSession: null,
        reservationExpiresAt: null,
      },
    );
  }

  private requireStripe(): Stripe {
    if (!this.stripe)
      throw new InternalServerErrorException(
        "Stripe payments are not configured.",
      );
    return this.stripe;
  }

  private priceInCents(price: string): number {
    const cents = Math.round(Number(price) * 100);
    if (!Number.isSafeInteger(cents) || cents < 50)
      throw new BadRequestException("Listing price is invalid for checkout.");
    return cents;
  }

  private allowedShippingCountries(): Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] {
    const configured =
      this.config.get<string>("STRIPE_ALLOWED_SHIPPING_COUNTRIES") ?? "US";
    return configured
      .split(",")
      .map((country) => country.trim().toUpperCase())
      .filter(
        Boolean,
      ) as Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[];
  }

  private shippingOptions(): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
    const standardRate = this.config
      .get<string>("STRIPE_STANDARD_SHIPPING_RATE_ID")
      ?.trim();
    const expressRate = this.config
      .get<string>("STRIPE_EXPRESS_SHIPPING_RATE_ID")
      ?.trim();
    if (standardRate && expressRate)
      return [{ shipping_rate: standardRate }, { shipping_rate: expressRate }];

    if (this.config.get<string>("NODE_ENV") === "production") {
      throw new InternalServerErrorException(
        "Production checkout requires verified Stripe Shipping Rate IDs.",
      );
    }

    return [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Standard tracked shipping",
          fixed_amount: {
            amount: Number(this.config.get("STANDARD_SHIPPING_CENTS") ?? 499),
            currency: "usd",
          },
          delivery_estimate: {
            minimum: { unit: "business_day", value: 3 },
            maximum: { unit: "business_day", value: 8 },
          },
          tax_code: "txcd_92010001",
        },
      },
      {
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: "Expedited tracked shipping",
          fixed_amount: {
            amount: Number(this.config.get("EXPRESS_SHIPPING_CENTS") ?? 999),
            currency: "usd",
          },
          delivery_estimate: {
            minimum: { unit: "business_day", value: 2 },
            maximum: { unit: "business_day", value: 4 },
          },
          tax_code: "txcd_92010001",
        },
      },
    ];
  }
}
