import { ConflictException } from "@nestjs/common";

import { OrderStatus } from "./entities/order.entity";

const TRANSITIONS: Record<OrderStatus, ReadonlySet<OrderStatus>> = {
  [OrderStatus.PAID]: new Set([
    OrderStatus.AWAITING_LOCATION,
    OrderStatus.AWAITING_SELLER_SHIPMENT,
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.PAYMENT_RECEIVED]: new Set([
    OrderStatus.AWAITING_LOCATION,
    OrderStatus.AWAITING_SELLER_SHIPMENT,
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.AWAITING_LOCATION]: new Set([
    OrderStatus.AWAITING_SELLER_SHIPMENT,
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.AWAITING_SELLER_SHIPMENT]: new Set([
    OrderStatus.INBOUND_IN_TRANSIT,
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.INBOUND_IN_TRANSIT]: new Set([
    OrderStatus.UNDER_VERIFICATION,
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.UNDER_VERIFICATION]: new Set([
    OrderStatus.VERIFIED,
    OrderStatus.VERIFICATION_FAILED,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.VERIFIED]: new Set([
    OrderStatus.OUTBOUND_SHIPPED,
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.VERIFICATION_FAILED]: new Set([
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.OUTBOUND_SHIPPED]: new Set([
    OrderStatus.TRANSFER_PROCESSING,
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.TRANSFER_PROCESSING]: new Set([
    OrderStatus.COMPLETED,
    OrderStatus.OUTBOUND_SHIPPED,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.COMPLETED]: new Set([
    OrderStatus.DISPUTED,
    OrderStatus.TRANSFER_REVERSED,
  ]),
  [OrderStatus.REFUND_PENDING]: new Set([
    OrderStatus.REFUNDED,
    OrderStatus.REFUND_FAILED,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.REFUND_FAILED]: new Set([
    OrderStatus.REFUND_PENDING,
    OrderStatus.DISPUTED,
  ]),
  [OrderStatus.REFUNDED]: new Set([OrderStatus.DISPUTED]),
  [OrderStatus.DISPUTED]: new Set([
    OrderStatus.REFUNDED,
    OrderStatus.TRANSFER_REVERSED,
  ]),
  [OrderStatus.TRANSFER_REVERSED]: new Set([OrderStatus.DISPUTED]),
};

export function canTransitionOrder(
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return from === to || TRANSITIONS[from].has(to);
}

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!canTransitionOrder(from, to)) {
    throw new ConflictException(
      `Order cannot move from ${from} to ${to}. Refresh the order and verify the preceding step.`,
    );
  }
}
