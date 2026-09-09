import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";

import { AssignVerificationLocationDto } from "./dto/assign-verification-location.dto";
import { CreateVerificationLocationDto } from "./dto/create-verification-location.dto";
import { RecordVerificationDto } from "./dto/record-verification.dto";
import { RefundOrderDto } from "./dto/refund-order.dto";
import { ShipmentDto } from "./dto/shipment.dto";
import { OrderStatus } from "./entities/order.entity";
import { MarketplaceTransactionsService } from "./marketplace-transactions.service";
import {
  OperationsAuthGuard,
  type OperationsRequest,
} from "./operations-auth.guard";

@Controller("payments/operations")
@UseGuards(OperationsAuthGuard)
export class OperationsTransactionsController {
  constructor(
    private readonly transactions: MarketplaceTransactionsService,
  ) {}

  @Get("orders")
  listOrders(@Query("status") rawStatus?: string) {
    let status: OrderStatus | undefined;
    if (rawStatus) {
      status = Object.values(OrderStatus).find((value) => value === rawStatus);
      if (!status) throw new BadRequestException("Unknown order status.");
    }
    return this.transactions.listOperationalOrders(status);
  }

  @Get("locations")
  listLocations() {
    return this.transactions.listVerificationLocations();
  }

  @Post("locations")
  createLocation(@Body() dto: CreateVerificationLocationDto) {
    return this.transactions.createVerificationLocation(dto);
  }

  @Post("orders/:orderId/location")
  assignLocation(
    @Req() request: OperationsRequest,
    @Param("orderId") orderId: string,
    @Body() dto: AssignVerificationLocationDto,
  ) {
    return this.transactions.assignVerificationLocation(
      orderId,
      dto,
      request.marketplaceUser.userId,
    );
  }

  @Post("orders/:orderId/received")
  markReceived(
    @Req() request: OperationsRequest,
    @Param("orderId") orderId: string,
  ) {
    return this.transactions.markReceived(
      orderId,
      request.marketplaceUser.userId,
    );
  }

  @Post("orders/:orderId/verification")
  recordVerification(
    @Req() request: OperationsRequest,
    @Param("orderId") orderId: string,
    @Body() dto: RecordVerificationDto,
  ) {
    return this.transactions.recordVerification(
      orderId,
      dto,
      request.marketplaceUser.userId,
    );
  }

  @Post("orders/:orderId/outbound-shipment")
  recordOutboundShipment(
    @Req() request: OperationsRequest,
    @Param("orderId") orderId: string,
    @Body() dto: ShipmentDto,
  ) {
    return this.transactions.recordOutboundShipment(
      orderId,
      dto,
      request.marketplaceUser.userId,
    );
  }

  @Post("orders/:orderId/release-seller-funds")
  releaseSellerFunds(
    @Req() request: OperationsRequest,
    @Param("orderId") orderId: string,
  ) {
    return this.transactions.releaseSellerFunds(
      orderId,
      request.marketplaceUser.userId,
    );
  }

  @Post("orders/:orderId/refund")
  refundOrder(
    @Req() request: OperationsRequest,
    @Param("orderId") orderId: string,
    @Body() dto: RefundOrderDto,
  ) {
    return this.transactions.refundOrder(
      orderId,
      dto,
      request.marketplaceUser.userId,
    );
  }
}
