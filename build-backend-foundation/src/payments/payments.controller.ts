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
import { PaymentsService } from "./payments.service";

@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post("checkout-session")
  createCheckoutSession(@Body() dto: CreateCheckoutSessionDto) {
    return this.paymentsService.createCheckoutSession(dto);
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

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await this.paymentsService.fulfillCheckout(event.data.object);
    }
    if (event.type === "checkout.session.expired") {
      await this.paymentsService.releaseCheckout(event.data.object);
    }
    return { received: true };
  }
}
