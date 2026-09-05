import { BadRequestException } from "@nestjs/common";
import { SellingController } from "./selling.controller";
import { SellingService } from "./selling.service";

const dto = {
  submissionId: "30000000-0000-4000-8000-000000000001",
  title: "A book",
  description: "",
  price: 10,
  copies: [
    {
      productId: "20000000-0000-4000-8000-000000000001",
      condition: "Good",
      photoIndexes: [0],
    },
  ],
};
describe("SellingController validation", () => {
  const service = { publish: jest.fn() };
  const controller = new SellingController(
    service as unknown as SellingService,
  );
  beforeEach(() => jest.clearAllMocks());
  it("passes validated multipart metadata and the bearer session to publishing", async () => {
    await controller.publish("Bearer session", JSON.stringify(dto), []);
    expect(service.publish).toHaveBeenCalledWith(
      "session",
      expect.objectContaining(dto),
      [],
    );
  });
  it.each([
    ["bad JSON", "{"],
    ["blank title", JSON.stringify({ ...dto, title: " " })],
    ["negative price", JSON.stringify({ ...dto, price: -1 })],
    ["fractional cents", JSON.stringify({ ...dto, price: 1.234 })],
    ["forged seller", JSON.stringify({ ...dto, sellerId: "other" })],
    [
      "invalid nested ISBN",
      JSON.stringify({
        ...dto,
        copies: [
          {
            product: { title: "Book", isbn: "123" },
            condition: "New",
            photoIndexes: [0],
          },
        ],
      }),
    ],
    ["empty bundle", JSON.stringify({ ...dto, copies: [] })],
  ])("rejects %s", async (_name, input) => {
    await expect(
      controller.publish("Bearer session", input, []),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(service.publish).not.toHaveBeenCalled();
  });
});
