import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { Request } from "express";
import Stripe from "stripe";

import { CreateCheckoutSessionDto } from "./dto/create-checkout-session.dto";
import { MarketplaceTransactionsService } from "./marketplace-transactions.service";
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly transactions: MarketplaceTransactionsService,
  ) {}

  @Post("checkout-session")
  createCheckoutSession(
    @Headers("authorization") authorization: string | undefined,
    @Body() dto: CreateCheckoutSessionDto,
  ) {
    return this.paymentsService.createCheckoutSession(
      dto,
      authorization?.replace(/^Bearer\s+/i, "").trim() ?? "",
    );
  }

  @Post("webhook")
  @HttpCode(200)
  async handleWebhook(
    @Req() request: RawBodyRequest<Request>,
    @Headers("stripe-signature") signature?: string,
  ): Promise<{ received: true }> {
    if (!request.rawBody || !signature)
      throw new BadRequestException("Missing Stripe signature.");

    let event: Stripe.Event;
    try {
      event = this.paymentsService.constructEvent(request.rawBody, signature);
    } catch {
      throw new BadRequestException("Invalid Stripe signature.");
    }

    if (!(await this.transactions.claimWebhookEvent(event))) {
      return { received: true };
    }

    try {
      if (
        event.type === "checkout.session.completed" ||
        event.type === "checkout.session.async_payment_succeeded"
      ) {
        await this.paymentsService.fulfillCheckout(event.data.object);
      } else if (
        event.type === "checkout.session.expired" ||
        event.type === "checkout.session.async_payment_failed"
      ) {
        await this.paymentsService.releaseCheckout(event.data.object);
      } else if (event.type === "account.updated") {
        await this.transactions.handleConnectedAccountUpdated(
          event.data.object,
        );
      } else if (
        event.type === "charge.dispute.created" ||
        event.type === "charge.dispute.updated" ||
        event.type === "charge.dispute.closed"
      ) {
        await this.transactions.handleDispute(event.data.object);
      } else if (
        event.type === "refund.created" ||
        event.type === "refund.updated" ||
        event.type === "refund.failed"
      ) {
        await this.transactions.applyRefundUpdate(event.data.object);
      } else if (event.type === "transfer.reversed") {
        await this.transactions.handleTransferUpdated(event.data.object);
      }
      await this.transactions.completeWebhookEvent(event.id);
    } catch (error) {
      await this.transactions.failWebhookEvent(event.id, error);
      throw error;
    }
    return { received: true };
  }
}
