import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { DataSource, In } from "typeorm";

import {
  InventoryAvailability,
  InventoryItem,
} from "../inventory-items/entities/inventory-item.entity";
import { Listing, ListingStatus } from "../listings/entities/listing.entity";
import { User } from "../users/entities/user.entity";
import { UsersService } from "../users/users.service";
import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { OrderEvent } from "./entities/order-event.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Order, OrderStatus, TransferStatus } from "./entities/order.entity";
import { VerificationLocation } from "./entities/verification-location.entity";
import { createStripeRuntime } from "./stripe-runtime";

const CHECKOUT_SESSION_TTL_SECONDS = 35 * 60;

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe | null;
  private readonly stripeLiveMode: boolean | null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly users: UsersService,
  ) {
    const runtime = createStripeRuntime(this.config);
    this.stripe = runtime.client;
    this.stripeLiveMode = runtime.liveMode;
  }

  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
    token: string,
  ): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const buyer = await this.users.requireAuthenticatedUser(token);
    const reservationKey = `reservation_${randomUUID()}`;
    // Stripe requires expires_at to be at least 30 minutes in the future. The
    // buffer prevents database work and network latency from crossing that limit.
    const expiresAt =
      Math.floor(Date.now() / 1000) + CHECKOUT_SESSION_TTL_SECONDS;
    const shippingOptions = this.shippingOptions();
    this.marketplaceFeeBps();

    const orderedListings = await this.dataSource.transaction(
      async (manager) => {
        const listings = await manager
          .getRepository(Listing)
          .createQueryBuilder("listing")
          .setLock("pessimistic_write")
          .leftJoinAndSelect("listing.seller", "seller")
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
        if (unavailable) {
          throw new BadRequestException(
            `Listing ${unavailable.listingId} is unavailable.`,
          );
        }

        const sellerIds = new Set(listings.map((listing) => listing.sellerId));
        if (sellerIds.size !== 1) {
          throw new BadRequestException(
            "This launch version supports one seller per checkout. Check out each seller separately.",
          );
        }
        const seller = listings[0].seller;
        if (seller.userId === buyer.userId) {
          throw new BadRequestException(
            "You cannot purchase your own listing.",
          );
        }
        this.assertSellerCanReceiveFunds(seller);

        for (const listing of listings) {
          listing.status = ListingStatus.RESERVED;
          listing.reservedByCheckoutSession = reservationKey;
          listing.reservationExpiresAt = new Date(expiresAt * 1000);
        }
        await manager.getRepository(Listing).save(listings);

        const listingsById = new Map(
          listings.map((listing) => [listing.listingId, listing]),
        );
        return dto.listingIds.map((id) => listingsById.get(id)!);
      },
    );

    const seller = orderedListings[0].seller;
    const transferGroup = `order_${reservationKey.slice("reservation_".length)}`;
    const frontendUrl = (
      this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000"
    ).replace(/\/$/, "");
    const metadata = {
      listing_ids: dto.listingIds.join(","),
      reservation_key: reservationKey,
      transfer_group: transferGroup,
      seller_id: seller.userId,
      seller_connected_account_id: seller.stripeConnectedAccountId,
      buyer_user_id: buyer.userId,
    };
    let session: Stripe.Checkout.Session | null = null;

    try {
      session = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          client_reference_id: reservationKey,
          success_url: `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontendUrl}/cart?checkout=cancelled`,
          expires_at: expiresAt,
          customer_email: dto.customerEmail ?? buyer.email,
          billing_address_collection: "auto",
          shipping_address_collection: {
            allowed_countries: this.allowedShippingCountries(),
          },
          shipping_options: shippingOptions,
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
          metadata,
          payment_intent_data: {
            transfer_group: transferGroup,
            metadata,
          },
        },
        { idempotencyKey: `checkout:${reservationKey}` },
      );
      if (!session.url) {
        throw new InternalServerErrorException(
          "Stripe did not return a checkout URL.",
        );
      }

      const finalized = await this.dataSource.getRepository(Listing).update(
        {
          listingId: In(dto.listingIds),
          status: ListingStatus.RESERVED,
          reservedByCheckoutSession: reservationKey,
        },
        { reservedByCheckoutSession: session.id },
      );
      if (finalized.affected !== dto.listingIds.length) {
        throw new ConflictException(
          "The checkout reservation changed before it could be finalized.",
        );
      }
      return { url: session.url };
    } catch (error) {
      let safeToReleaseReservation = !session;
      if (session) {
        try {
          const expiredSession = await stripe.checkout.sessions.expire(
            session.id,
          );
          safeToReleaseReservation = expiredSession.status === "expired";
        } catch {
          // An expiration can fail because the buyer completed payment while the
          // database finalization was failing. Keep the inventory reserved so a
          // delayed paid webhook cannot become an unfulfillable double sale.
        }
      }
      if (safeToReleaseReservation) {
        await this.releaseReservations(dto.listingIds, [
          reservationKey,
          ...(session ? [session.id] : []),
        ]);
      }
      throw error;
    }
  }

  constructEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET")?.trim();
    if (!secret) {
      throw new InternalServerErrorException(
        "Stripe webhook signing is not configured.",
      );
    }
    const event = this.requireStripe().webhooks.constructEvent(
      payload,
      signature,
      secret,
    );
    if (
      this.stripeLiveMode !== null &&
      event.livemode !== this.stripeLiveMode
    ) {
      throw new Error(
        "Stripe event mode does not match the configured API key.",
      );
    }
    return event;
  }

  async fulfillCheckout(session: Stripe.Checkout.Session): Promise<void> {
    if (session.payment_status !== "paid") return;
    const listingIds =
      session.metadata?.listing_ids?.split(",").filter(Boolean) ?? [];
    if (listingIds.length === 0) {
      throw new BadRequestException(
        "Checkout Session is missing listing metadata.",
      );
    }
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntentId) {
      throw new BadRequestException(
        "Paid Checkout Session is missing a PaymentIntent.",
      );
    }

    const intent = await this.requireStripe().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge"] },
    );
    if (intent.status !== "succeeded") return;
    if (
      intent.currency !== session.currency ||
      intent.amount_received < (session.amount_total ?? 0)
    ) {
      throw new BadRequestException(
        "Paid Checkout Session totals do not match its PaymentIntent.",
      );
    }
    const chargeId =
      typeof intent.latest_charge === "string"
        ? intent.latest_charge
        : intent.latest_charge?.id;
    if (!chargeId) {
      throw new BadRequestException(
        "Paid Checkout Session is missing its platform charge.",
      );
    }

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
        .leftJoinAndSelect("listing.seller", "seller")
        .leftJoinAndSelect("listing.listingItems", "listingItem")
        .leftJoinAndSelect("listingItem.inventoryItem", "inventoryItem")
        .where("listing.listingId IN (:...listingIds)", { listingIds })
        .getMany();
      if (listings.length !== listingIds.length) {
        throw new BadRequestException("A purchased listing no longer exists.");
      }

      const reservationKeys = new Set(
        [session.id, session.metadata?.reservation_key].filter(Boolean),
      );
      const reservationMismatch = listings.find(
        (listing) =>
          listing.status !== ListingStatus.RESERVED ||
          !reservationKeys.has(listing.reservedByCheckoutSession ?? undefined),
      );
      if (reservationMismatch) {
        throw new BadRequestException(
          "A purchased listing is not reserved by this Checkout Session.",
        );
      }

      const sellerIds = new Set(listings.map((listing) => listing.sellerId));
      const seller = listings[0].seller;
      if (
        sellerIds.size !== 1 ||
        session.metadata?.seller_id !== seller.userId
      ) {
        throw new BadRequestException(
          "Checkout seller metadata is inconsistent.",
        );
      }
      const grossAmount = listings.reduce(
        (total, listing) => total + this.priceInCents(listing.price),
        0,
      );
      const platformFeeAmount = Math.floor(
        (grossAmount * this.marketplaceFeeBps()) / 10_000,
      );
      const sellerNetAmount = grossAmount - platformFeeAmount;
      if (sellerNetAmount <= 0) {
        throw new BadRequestException(
          "Seller proceeds must be greater than zero.",
        );
      }

      const defaultLocationCode = this.config
        .get<string>("DEFAULT_VERIFICATION_LOCATION_CODE")
        ?.trim()
        .toUpperCase();
      const verificationLocation = defaultLocationCode
        ? await manager.getRepository(VerificationLocation).findOne({
            where: { code: defaultLocationCode, active: true },
          })
        : null;
      const orderStatus = verificationLocation
        ? OrderStatus.AWAITING_SELLER_SHIPMENT
        : OrderStatus.AWAITING_LOCATION;
      const buyerUserId = session.metadata?.buyer_user_id;
      const buyerUser = buyerUserId
        ? await manager.getRepository(User).findOne({
            where: { userId: buyerUserId },
          })
        : null;
      const shipping = session.collected_information?.shipping_details;
      const transferGroup =
        session.metadata?.transfer_group ?? intent.transfer_group;
      if (!transferGroup) {
        throw new BadRequestException("Checkout transfer group is missing.");
      }

      const order = await orderRepository.save(
        orderRepository.create({
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
          stripeChargeId: chargeId,
          stripeTransferGroup: transferGroup,
          buyerId: buyerUser?.userId ?? null,
          sellerId: seller.userId,
          verificationLocationId:
            verificationLocation?.verificationLocationId ?? null,
          buyerEmail:
            session.customer_details?.email ?? session.customer_email ?? null,
          amountTotal: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          sellerGrossAmount: grossAmount,
          platformFeeAmount,
          sellerNetAmount,
          sellerConnectedAccountIdSnapshot:
            session.metadata?.seller_connected_account_id ??
            seller.stripeConnectedAccountId,
          transferStatus: TransferStatus.BLOCKED,
          status: orderStatus,
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
            sellerId: seller.userId,
            title: listing.title,
            unitAmount: this.priceInCents(listing.price),
            conditionSnapshot: listing.listingItems.map(
              ({ inventoryItem }) => ({
                itemId: inventoryItem.itemId,
                condition: inventoryItem.condition,
                conditionNotes: inventoryItem.conditionNotes,
              }),
            ),
          }),
        ),
      );

      await manager.getRepository(OrderEvent).save(
        manager.getRepository(OrderEvent).create({
          orderId: order.orderId,
          eventType: "buyer_payment_received",
          actorType: "stripe",
          actorUserId: null,
          fromStatus: null,
          toStatus: orderStatus,
          metadata: { checkoutSessionId: session.id, chargeId },
        }),
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
    const listingIds =
      session.metadata?.listing_ids?.split(",").filter(Boolean) ?? [];
    if (listingIds.length === 0) return;
    await this.releaseReservations(
      listingIds,
      [session.id, session.metadata?.reservation_key].filter(
        (value): value is string => Boolean(value),
      ),
    );
  }

  private async releaseReservations(
    listingIds: string[],
    reservationKeys: string[],
  ): Promise<void> {
    if (listingIds.length === 0 || reservationKeys.length === 0) return;
    await this.dataSource.getRepository(Listing).update(
      {
        listingId: In(listingIds),
        reservedByCheckoutSession: In(reservationKeys),
        status: ListingStatus.RESERVED,
      },
      {
        status: ListingStatus.ACTIVE,
        reservedByCheckoutSession: null,
        reservationExpiresAt: null,
      },
    );
  }

  private assertSellerCanReceiveFunds(seller: User): void {
    if (
      !seller.stripeConnectedAccountId ||
      !seller.stripeDetailsSubmitted ||
      !seller.stripeTransfersEnabled ||
      !seller.stripePayoutsEnabled
    ) {
      throw new ConflictException(
        "This seller is still completing secure payout onboarding. Try again later.",
      );
    }
  }

  private marketplaceFeeBps(): number {
    const configured = this.config.get<string>("MARKETPLACE_FEE_BPS")?.trim();
    if (!configured && this.config.get<string>("NODE_ENV") === "production") {
      throw new InternalServerErrorException(
        "Production checkout requires MARKETPLACE_FEE_BPS.",
      );
    }
    const value = Number(configured ?? 0);
    if (!Number.isInteger(value) || value < 0 || value > 5_000) {
      throw new InternalServerErrorException(
        "MARKETPLACE_FEE_BPS must be an integer from 0 through 5000.",
      );
    }
    return value;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new InternalServerErrorException(
        "Stripe payments are not configured.",
      );
    }
    return this.stripe;
  }

  private priceInCents(price: string): number {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(price.trim());
    if (!match) {
      throw new BadRequestException("Listing price is invalid for checkout.");
    }
    const cents =
      Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
    if (!Number.isSafeInteger(cents) || cents < 50) {
      throw new BadRequestException("Listing price is invalid for checkout.");
    }
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
    if (standardRate && expressRate) {
      return [{ shipping_rate: standardRate }, { shipping_rate: expressRate }];
    }

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
