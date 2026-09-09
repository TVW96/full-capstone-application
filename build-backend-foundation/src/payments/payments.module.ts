import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Listing } from "../listings/entities/listing.entity";
import { UsersModule } from "../users/users.module";
import { BuyerTransactionsController } from "./buyer-transactions.controller";
import { OrderEvent } from "./entities/order-event.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Order } from "./entities/order.entity";
import { StripeWebhookEvent } from "./entities/stripe-webhook-event.entity";
import { VerificationLocation } from "./entities/verification-location.entity";
import { MarketplaceTransactionsService } from "./marketplace-transactions.service";
import { OperationsAuthGuard } from "./operations-auth.guard";
import { OperationsTransactionsController } from "./operations-transactions.controller";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SellerTransactionsController } from "./seller-transactions.controller";

@Module({
  imports: [
    UsersModule,
    TypeOrmModule.forFeature([
      Listing,
      Order,
      OrderItem,
      OrderEvent,
      StripeWebhookEvent,
      VerificationLocation,
    ]),
  ],
  controllers: [
    PaymentsController,
    BuyerTransactionsController,
    SellerTransactionsController,
    OperationsTransactionsController,
  ],
  providers: [
    PaymentsService,
    MarketplaceTransactionsService,
    OperationsAuthGuard,
  ],
})
export class PaymentsModule {}
