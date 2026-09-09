import { Controller, Get, Headers, Param } from "@nestjs/common";

import { MarketplaceTransactionsService } from "./marketplace-transactions.service";

@Controller("payments/buyer")
export class BuyerTransactionsController {
  constructor(
    private readonly transactions: MarketplaceTransactionsService,
  ) {}

  @Get("orders")
  getOrders(@Headers("authorization") authorization?: string) {
    return this.transactions.getBuyerOrders(this.bearerToken(authorization));
  }

  @Get("checkout/:sessionId")
  getCheckoutStatus(
    @Headers("authorization") authorization: string | undefined,
    @Param("sessionId") sessionId: string,
  ) {
    return this.transactions.getCheckoutStatus(
      this.bearerToken(authorization),
      sessionId,
    );
  }

  private bearerToken(authorization?: string): string {
    return authorization?.replace(/^Bearer\s+/i, "").trim() ?? "";
  }
}
