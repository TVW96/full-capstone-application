import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { DataSource } from "typeorm";
import { CatalogProduct } from "../catalog-products/entities/catalog-product.entity";
import { InventoryItem } from "../inventory-items/entities/inventory-item.entity";
import { Listing } from "../listings/entities/listing.entity";
import { ListingItem } from "../listings/entities/listing-item.entity";
import { EntityImage } from "../media/entities/entity-image.entity";
import { MediaAsset } from "../media/entities/media-asset.entity";
import { MediaService } from "../media/media.service";
import { UsersService } from "../users/users.service";
import { PublishListingDto } from "./dto/publish-listing.dto";
import { SellingService } from "./selling.service";

const sellerId = "10000000-0000-4000-8000-000000000001";
const productId = "20000000-0000-4000-8000-000000000001";
const submissionId = "30000000-0000-4000-8000-000000000001";
const photo = {
  buffer: Buffer.from("test"),
  size: 4,
  mimetype: "image/png",
  originalname: "copy.png",
};
const payload = (): PublishListingDto => ({
  submissionId,
  title: "Manga set",
  description: "Two books",
  price: 12.5,
  copies: [{ productId, condition: "Good", photoIndexes: [0] }],
});

function setup() {
  let sequence = 0;
  const repository = () => ({
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      ...value,
      imageId: `image-${++sequence}`,
      listingItemId: `link-${sequence}`,
    })),
    update: jest.fn(),
    findOneBy: jest.fn(),
    createQueryBuilder: jest.fn(),
  });
  const products = repository();
  products.findOneBy.mockResolvedValue({ productId, title: "Manga volume" });
  const listings = repository();
  const inventory = repository();
  const links = repository();
  const images = repository();
  const assets = repository();
  const repositories = new Map<unknown, ReturnType<typeof repository>>([
    [CatalogProduct, products],
    [Listing, listings],
    [InventoryItem, inventory],
    [ListingItem, links],
    [EntityImage, images],
    [MediaAsset, assets],
  ]);
  const manager = {
    query: jest.fn(),
    getRepository: jest.fn((entity) => repositories.get(entity)),
  };
  const database = { transaction: jest.fn(async (work) => work(manager)) };
  const users = {
    requireAuthenticatedUser: jest.fn().mockResolvedValue({ userId: sellerId }),
  };
  const media = {
    validateMarketplacePhoto: jest.fn(),
    removeMarketplaceUploads: jest.fn(),
    uploadMarketplacePhoto: jest
      .fn()
      .mockImplementation(async (_user, item) => ({
        objectKey: `users/${sellerId}/inventory/${item}/photo.webp`,
        publicUrl: `https://storage.example/${item}/photo.webp`,
        asset: { assetId: `asset-${item}` },
      })),
  };
  const service = new SellingService(
    database as unknown as DataSource,
    users as unknown as UsersService,
    media as unknown as MediaService,
  );
  return {
    service,
    database,
    users,
    media,
    products,
    listings,
    inventory,
    links,
    images,
    assets,
    manager,
  };
}

describe("SellingService", () => {
  it("authenticates before touching storage or the database", async () => {
    const ctx = setup();
    ctx.users.requireAuthenticatedUser.mockRejectedValue(
      new UnauthorizedException(),
    );
    await expect(
      ctx.service.publish("", payload(), [photo]),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(ctx.database.transaction).not.toHaveBeenCalled();
    expect(ctx.media.uploadMarketplacePhoto).not.toHaveBeenCalled();
  });

  it("publishes a bundle with owned inventory, junction records, and reused photos", async () => {
    const ctx = setup();
    const dto = payload();
    dto.copies.push({ productId, condition: "New", photoIndexes: [1] });
    const result = await ctx.service.publish("session", dto, [photo, photo]);
    expect(result).toMatchObject({
      listingId: submissionId,
      price: "12.50",
      status: "active",
    });
    expect(ctx.listings.create).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId }),
    );
    expect(ctx.inventory.create).toHaveBeenCalledTimes(2);
    for (const [copy] of ctx.inventory.create.mock.calls)
      expect(copy).toMatchObject({
        ownerId: sellerId,
        availability: "listed",
        productId,
      });
    expect(ctx.links.save).toHaveBeenCalledTimes(2);
    expect(ctx.assets.save).toHaveBeenCalledTimes(2);
    expect(ctx.images.save).toHaveBeenCalledTimes(6);
    const publications = ctx.images.create.mock.calls.map(([value]) => value);
    for (const image of publications) {
      expect(
        [
          "userId",
          "catalogProductId",
          "inventoryItemId",
          "listingId",
          "listingItemId",
        ].filter((key) => image[key] != null),
      ).toHaveLength(1);
      if (image.publicationSource === "reuse")
        expect(image.originImageId).toBeTruthy();
    }
    expect(ctx.inventory.update).toHaveBeenCalledTimes(2);
  });

  it("returns an already published submission without duplicating records or uploads", async () => {
    const ctx = setup();
    ctx.listings.findOneBy.mockResolvedValue({
      listingId: submissionId,
      sellerId,
      title: "Original",
      price: "12.50",
      status: "active",
    });
    await expect(
      ctx.service.publish("session", payload(), [photo]),
    ).resolves.toMatchObject({ title: "Original" });
    expect(ctx.manager.query).toHaveBeenCalledWith(
      expect.stringContaining("pg_advisory_xact_lock"),
      [submissionId],
    );
    expect(ctx.listings.save).not.toHaveBeenCalled();
    expect(ctx.media.uploadMarketplacePhoto).not.toHaveBeenCalled();
  });

  it("rejects reuse of another seller’s submission ID", async () => {
    const ctx = setup();
    ctx.listings.findOneBy.mockResolvedValue({ sellerId: "someone-else" });
    await expect(
      ctx.service.publish("session", payload(), [photo]),
    ).rejects.toThrow("Start a new listing");
    expect(ctx.media.uploadMarketplacePhoto).not.toHaveBeenCalled();
  });

  it("creates a new catalog product without assigning ownership to it", async () => {
    const ctx = setup();
    const dto = payload();
    dto.copies[0] = {
      product: { title: "A new manga", language: "ja" },
      condition: "New",
      photoIndexes: [0],
    };
    ctx.products.save.mockImplementation(async (value) => ({
      ...value,
      productId,
    }));
    await ctx.service.publish("session", dto, [photo]);
    expect(ctx.products.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: "A new manga", isbn: null }),
    );
    expect(ctx.products.create.mock.calls[0][0]).not.toHaveProperty("ownerId");
  });

  it("reuses an existing ISBN instead of creating duplicate catalog metadata", async () => {
    const ctx = setup();
    const dto = payload();
    dto.copies[0] = {
      product: { title: "Existing manga", isbn: "978-1-9747-0993-9" },
      condition: "Good",
      photoIndexes: [0],
    };
    const query = {
      where: jest.fn().mockReturnThis(),
      getOne: jest
        .fn()
        .mockResolvedValue({ productId, title: "Existing manga" }),
    };
    ctx.products.createQueryBuilder.mockReturnValue(query);
    await ctx.service.publish("session", dto, [photo]);
    expect(query.where).toHaveBeenCalledWith(expect.any(String), {
      isbn: "9781974709939",
    });
    expect(ctx.products.save).not.toHaveBeenCalled();
  });

  it.each([
    [
      "missing photos",
      (dto: PublishListingDto) => {
        dto.copies[0].photoIndexes = [];
      },
    ],
    [
      "duplicate photo assignment",
      (dto: PublishListingDto) => {
        dto.copies[0].photoIndexes = [0, 0];
      },
    ],
    [
      "out-of-bounds photo",
      (dto: PublishListingDto) => {
        dto.copies[0].photoIndexes = [1];
      },
    ],
    [
      "ambiguous product",
      (dto: PublishListingDto) => {
        dto.copies[0].product = { title: "New" };
      },
    ],
  ])("rejects %s before creating records", async (_label, mutate) => {
    const ctx = setup();
    const dto = payload();
    mutate(dto);
    await expect(
      ctx.service.publish("session", dto, [photo]),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(ctx.database.transaction).not.toHaveBeenCalled();
  });

  it("rolls back database work and cleans uploaded objects if publication fails", async () => {
    const ctx = setup();
    ctx.images.save.mockRejectedValue(new Error("Database failed"));
    await expect(
      ctx.service.publish("session", payload(), [photo]),
    ).rejects.toThrow("Database failed");
    expect(ctx.media.removeMarketplaceUploads).toHaveBeenCalledWith([
      expect.stringContaining("/photo.webp"),
    ]);
  });

  it("rejects missing catalog records", async () => {
    const ctx = setup();
    ctx.products.findOneBy.mockResolvedValue(null);
    await expect(
      ctx.service.publish("session", payload(), [photo]),
    ).rejects.toThrow("no longer exists");
    expect(ctx.media.uploadMarketplacePhoto).not.toHaveBeenCalled();
  });
});
