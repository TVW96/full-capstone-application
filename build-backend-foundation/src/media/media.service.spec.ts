import { BadRequestException } from "@nestjs/common";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { User } from "../users/entities/user.entity";
import {
  EntityImage,
  ImagePublicationSource,
} from "./entities/entity-image.entity";
import {
  MediaAsset,
  MediaAssetOriginType,
  MediaAssetStatus,
} from "./entities/media-asset.entity";
import { MediaService } from "./media.service";

jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(),
}));

describe("MediaService", () => {
  const userId = "10000000-0000-4000-8000-000000000001";
  const previousAssetId = "30000000-0000-4000-8000-000000000001";
  const previousImageId = "40000000-0000-4000-8000-000000000001";
  const account = {
    userId,
    email: "reader@example.com",
    username: "reader",
    fullName: "Manga Reader",
    region: "US",
    avatarUrl: null,
    bio: null,
    addresses: [],
    createdAt: new Date("2026-09-01T12:00:00.000Z"),
    updatedAt: new Date("2026-09-01T12:00:00.000Z"),
  };
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x01]);

  const storage = {
    upload: jest.fn(),
    getPublicUrl: jest.fn(),
    remove: jest.fn(),
  };
  const supabase = {
    storage: {
      from: jest.fn(() => storage),
    },
  };
  const transactionAssets = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => value),
  };
  const transactionImages = {
    create: jest.fn((value) => value),
    save: jest.fn(async (value) => ({
      ...value,
      imageId: "40000000-0000-4000-8000-000000000002",
    })),
    delete: jest.fn(),
  };
  const transactionUsers = {
    update: jest.fn(),
    countBy: jest.fn(),
  };
  const manager = {
    getRepository: jest.fn((entity) => {
      if (entity === MediaAsset) return transactionAssets;
      if (entity === EntityImage) return transactionImages;
      return transactionUsers;
    }),
  };
  const dataSource = {
    transaction: jest.fn(async (work) => work(manager)),
    getRepository: jest.fn(() => transactionUsers),
  };
  const mediaAssets = {
    findOneBy: jest.fn(),
    delete: jest.fn(),
  };
  const entityImages = {
    countBy: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) =>
      key === "SUPABASE_URL"
        ? "https://project.supabase.co"
        : "server-only-key",
    ),
  };
  const users = {
    requireAuthenticatedUser: jest.fn(),
    getAccount: jest.fn(),
  };

  let service: MediaService;

  beforeEach(() => {
    jest.clearAllMocks();
    (createClient as jest.Mock).mockReturnValue(supabase);
    storage.upload.mockResolvedValue({ error: null });
    storage.remove.mockResolvedValue({ error: null });
    storage.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://cdn.example/avatar.jpg" },
    });
    entityImages.countBy.mockResolvedValue(0);
    transactionUsers.countBy.mockResolvedValue(0);
    users.getAccount.mockResolvedValue(account);

    service = new MediaService(
      dataSource as never,
      mediaAssets as never,
      entityImages as never,
      config as never,
      users as never,
    );
  });

  it("creates a linked asset, avatar publication, and user avatar reference", async () => {
    users.requireAuthenticatedUser.mockResolvedValue({
      ...account,
      avatarAssetId: null,
      avatarImageId: null,
    });
    mediaAssets.findOneBy.mockResolvedValue(null);

    await service.uploadAvatar("session-token", {
      buffer: jpeg,
      mimetype: "image/jpeg",
      originalname: "portrait.jpg",
      size: jpeg.length,
    });

    expect(transactionAssets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadedByUserId: userId,
        originType: MediaAssetOriginType.USER_UPLOAD,
        originReference: `user:${userId}/account-avatar`,
        storageProvider: "supabase",
        bucket: "avatars",
        status: MediaAssetStatus.READY,
      }),
    );
    expect(transactionImages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        publishedByUserId: userId,
        publicationSource: ImagePublicationSource.USER_UPLOAD,
        publicationOrigin: `user:${userId}/account-avatar`,
        userId,
        catalogProductId: null,
        inventoryItemId: null,
        listingId: null,
        listingItemId: null,
        position: 0,
      }),
    );
    expect(transactionUsers.update).toHaveBeenLastCalledWith(
      { userId },
      expect.objectContaining({
        avatarImageId: "40000000-0000-4000-8000-000000000002",
        avatarUrl: "https://cdn.example/avatar.jpg",
      }),
    );
  });

  it("detaches the old publication before replacing an avatar asset", async () => {
    users.requireAuthenticatedUser.mockResolvedValue({
      ...account,
      avatarAssetId: previousAssetId,
      avatarImageId: previousImageId,
    });
    mediaAssets.findOneBy.mockResolvedValue({
      assetId: previousAssetId,
      bucket: "avatars",
      objectKey: "users/reader/avatars/old.jpg",
    });

    await service.uploadAvatar("session-token", {
      buffer: jpeg,
      mimetype: "image/jpeg",
      originalname: "replacement.jpg",
      size: jpeg.length,
    });

    expect(transactionUsers.update).toHaveBeenCalledWith(
      { userId },
      { avatarAssetId: null, avatarImageId: null, avatarUrl: null },
    );
    expect(transactionImages.delete).toHaveBeenCalledWith({
      imageId: previousImageId,
      userId,
    });
    expect(storage.remove).toHaveBeenCalledWith([
      "users/reader/avatars/old.jpg",
    ]);
    expect(mediaAssets.delete).toHaveBeenCalledWith({
      assetId: previousAssetId,
    });
  });

  it("does not delete a stored object that still has a publication", async () => {
    users.requireAuthenticatedUser.mockResolvedValue({
      ...account,
      avatarAssetId: previousAssetId,
      avatarImageId: previousImageId,
    });
    mediaAssets.findOneBy.mockResolvedValue({
      assetId: previousAssetId,
      bucket: "avatars",
      objectKey: "users/reader/avatars/shared.jpg",
    });
    entityImages.countBy.mockResolvedValue(1);

    await service.uploadAvatar("session-token", {
      buffer: jpeg,
      mimetype: "image/jpeg",
      originalname: "replacement.jpg",
      size: jpeg.length,
    });

    expect(storage.remove).not.toHaveBeenCalled();
    expect(mediaAssets.delete).not.toHaveBeenCalled();
  });

  it("decodes seller photos and stores a WebP with dimensions and no private metadata", async () => {
    const buffer = await sharp({
      create: { width: 32, height: 48, channels: 3, background: "#236343" },
    })
      .jpeg()
      .toBuffer();
    const result = await service.uploadMarketplacePhoto(userId, "copy-id", {
      buffer,
      mimetype: "image/jpeg",
      originalname: "my book.jpg",
      size: buffer.length,
    });
    expect(result.asset).toMatchObject({
      bucket: "marketplace-images",
      width: 32,
      height: 48,
      mimeType: "image/webp",
      uploadedByUserId: userId,
    });
    expect(result.objectKey).toMatch(
      new RegExp(`^users/${userId}/inventory/copy-id/.+\\.webp$`),
    );
    const storedBytes = storage.upload.mock.calls[0][1] as Buffer;
    const metadata = await sharp(storedBytes).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
  });

  it("rejects truncated seller images even when their MIME signature matches", async () => {
    await expect(
      service.uploadMarketplacePhoto(userId, "copy-id", {
        buffer: jpeg,
        mimetype: "image/jpeg",
        originalname: "broken.jpg",
        size: jpeg.length,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storage.upload).not.toHaveBeenCalled();
  });

  it("rejects a file whose declared image type does not match its signature", async () => {
    await expect(
      service.uploadAvatar("session-token", {
        buffer: Buffer.from("not an image"),
        mimetype: "image/jpeg",
        originalname: "fake.jpg",
        size: 12,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(users.requireAuthenticatedUser).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
  });
});
