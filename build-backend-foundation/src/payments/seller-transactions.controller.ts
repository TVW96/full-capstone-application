import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
} from "@nestjs/common";

import { ShipmentDto } from "./dto/shipment.dto";
import { MarketplaceTransactionsService } from "./marketplace-transactions.service";

@Controller("payments/seller")
export class SellerTransactionsController {
  constructor(
    private readonly transactions: MarketplaceTransactionsService,
  ) {}

  @Post("onboarding-link")
  createOnboardingLink(@Headers("authorization") authorization?: string) {
    return this.transactions.createSellerOnboardingLink(
      this.bearerToken(authorization),
    );
  }

  @Get("payment-status")
  getPaymentStatus(@Headers("authorization") authorization?: string) {
    return this.transactions.getSellerPaymentStatus(
      this.bearerToken(authorization),
    );
  }

  @Get("orders")
  getOrders(@Headers("authorization") authorization?: string) {
    return this.transactions.getSellerOrders(this.bearerToken(authorization));
  }

  @Post("orders/:orderId/inbound-shipment")
  submitInboundShipment(
    @Headers("authorization") authorization: string | undefined,
    @Param("orderId") orderId: string,
    @Body() dto: ShipmentDto,
  ) {
    return this.transactions.submitInboundShipment(
      this.bearerToken(authorization),
      orderId,
      dto,
    );
  }

  private bearerToken(authorization?: string): string {
    return authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  }
}
