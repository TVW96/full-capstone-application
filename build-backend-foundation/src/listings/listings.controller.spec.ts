import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { ListingsController } from "./listings.controller";
import { ListingsService } from "./listings.service";
import { UsersService } from "../users/users.service";

describe("ListingsController ownership", () => {
  const userId = "10000000-0000-4000-8000-000000000001";
  const users = { requireAuthenticatedUser: jest.fn() };
  const listings = { create: jest.fn(), removeItem: jest.fn() };
  const controller = new ListingsController(
    listings as unknown as ListingsService,
    users as unknown as UsersService,
  );
  const dto = { title: "Book", price: 10, itemIds: ["copy-id"] };
  beforeEach(() => {
    jest.clearAllMocks();
    users.requireAuthenticatedUser.mockResolvedValue({ userId });
  });

  it("rejects a forged seller ID on the existing creation endpoint", async () => {
    await expect(
      controller.create("another-seller", dto, "Bearer session"),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(listings.create).not.toHaveBeenCalled();
  });
  it("uses the authenticated seller for listing creation", async () => {
    await controller.create(userId, dto, "Bearer session");
    expect(users.requireAuthenticatedUser).toHaveBeenCalledWith("session");
    expect(listings.create).toHaveBeenCalledWith(userId, dto);
  });
  it("uses the authenticated seller when removing a listing item", async () => {
    await controller.removeItem("listing-id", "copy-id", "Bearer session");
    expect(listings.removeItem).toHaveBeenCalledWith(
      "listing-id",
      "copy-id",
      userId,
    );
  });
  it("rejects unauthenticated mutations", async () => {
    users.requireAuthenticatedUser.mockRejectedValue(
      new UnauthorizedException(),
    );
    await expect(controller.create(userId, dto)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.removeItem("listing-id", "copy-id"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(listings.create).not.toHaveBeenCalled();
    expect(listings.removeItem).not.toHaveBeenCalled();
  });
});
