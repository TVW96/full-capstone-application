import { ConflictException } from "@nestjs/common";

import { OrderStatus } from "./entities/order.entity";
import { assertOrderTransition, canTransitionOrder } from "./transaction-state";

describe("order transaction state", () => {
  it("permits only the physical-verification happy path", () => {
    const path = [
      OrderStatus.PAYMENT_RECEIVED,
      OrderStatus.AWAITING_LOCATION,
      OrderStatus.AWAITING_SELLER_SHIPMENT,
      OrderStatus.INBOUND_IN_TRANSIT,
      OrderStatus.UNDER_VERIFICATION,
      OrderStatus.VERIFIED,
      OrderStatus.OUTBOUND_SHIPPED,
      OrderStatus.TRANSFER_PROCESSING,
      OrderStatus.COMPLETED,
    ];

    for (let index = 1; index < path.length; index += 1) {
      expect(canTransitionOrder(path[index - 1], path[index])).toBe(true);
    }
  });

  it("blocks a seller transfer before outbound shipment", () => {
    expect(() =>
      assertOrderTransition(
        OrderStatus.UNDER_VERIFICATION,
        OrderStatus.TRANSFER_PROCESSING,
      ),
    ).toThrow(ConflictException);
    expect(() =>
      assertOrderTransition(OrderStatus.VERIFIED, OrderStatus.COMPLETED),
    ).toThrow(ConflictException);
  });

  it("allows failed verification to enter the refund path", () => {
    expect(
      canTransitionOrder(
        OrderStatus.UNDER_VERIFICATION,
        OrderStatus.VERIFICATION_FAILED,
      ),
    ).toBe(true);
    expect(
      canTransitionOrder(
        OrderStatus.VERIFICATION_FAILED,
        OrderStatus.REFUND_PENDING,
      ),
    ).toBe(true);
  });
});
