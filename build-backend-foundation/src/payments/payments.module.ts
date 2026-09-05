import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { Listing } from "../listings/entities/listing.entity";
import { OrderItem } from "./entities/order-item.entity";
import { Order } from "./entities/order.entity";
import { PaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [TypeOrmModule.forFeature([Listing, Order, OrderItem])],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
