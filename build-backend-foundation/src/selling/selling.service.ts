import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import { randomUUID } from "node:crypto";
import { DataSource } from "typeorm";
import { CatalogProduct } from "../catalog-products/entities/catalog-product.entity";
import {
  InventoryAvailability,
  InventoryItem,
} from "../inventory-items/entities/inventory-item.entity";
import { Listing, ListingStatus } from "../listings/entities/listing.entity";
import { ListingItem } from "../listings/entities/listing-item.entity";
import {
  EntityImage,
  ImagePublicationSource,
} from "../media/entities/entity-image.entity";
import { MediaAsset } from "../media/entities/media-asset.entity";
import { type AvatarUpload, MediaService } from "../media/media.service";
import { UsersService } from "../users/users.service";
import { PublishListingDto } from "./dto/publish-listing.dto";

@Injectable()
export class SellingService {
  private readonly logger = new Logger(SellingService.name);
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly users: UsersService,
    private readonly media: MediaService,
  ) {}

  async publish(token: string, dto: PublishListingDto, photos: AvatarUpload[]) {
    const user = await this.users.requireAuthenticatedUser(token);
    const indexes = dto.copies.flatMap((copy) => copy.photoIndexes);
    if (
      !photos.length ||
      photos.length > 8 ||
      indexes.length !== photos.length ||
      new Set(indexes).size !== photos.length ||
      indexes.some((index) => index >= photos.length || index < 0) ||
      photos.reduce((sum, photo) => sum + photo.size, 0) > 32 * 1024 * 1024
    ) {
      throw new BadRequestException(
        "Add at least one photo per copy, up to 8 photos and 32 MB in total.",
      );
    }
    for (const photo of photos) this.media.validateMarketplacePhoto(photo);
    for (const copy of dto.copies) {
      if (Boolean(copy.productId) === Boolean(copy.product)) {
        throw new BadRequestException(
          "Choose an existing catalog title or enter a new title for each copy.",
        );
      }
    }
    const uploadedKeys: string[] = [];
    try {
      return await this.dataSource.transaction(async (manager) => {
        // Serialize retries across API processes. The client retains this UUID until success.
        await manager.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
          [dto.submissionId],
        );
        const listings = manager.getRepository(Listing);
        const existing = await listings.findOneBy({
          listingId: dto.submissionId,
        });
        if (existing) {
          if (existing.sellerId !== user.userId)
            throw new ConflictException("Start a new listing and try again.");
          return {
            listingId: existing.listingId,
            title: existing.title,
            price: existing.price,
            status: existing.status,
          };
        }
        const products = manager.getRepository(CatalogProduct);
        const inventory = manager.getRepository(InventoryItem);
        const listingItems = manager.getRepository(ListingItem);
        const assets = manager.getRepository(MediaAsset);
        const images = manager.getRepository(EntityImage);
        const listing = await listings.save(
          listings.create({
            listingId: dto.submissionId,
            sellerId: user.userId,
            title: dto.title,
            description: dto.description.trim() || null,
            price: dto.price.toFixed(2),
            status: ListingStatus.ACTIVE,
          }),
        );
        let listingPhotoPosition = 0;
        for (const copy of dto.copies) {
          let product: CatalogProduct | null = null;
          if (copy.productId) {
            product = await products.findOneBy({ productId: copy.productId });
            if (!product)
              throw new BadRequestException(
                "A selected catalog title no longer exists. Choose it again.",
              );
          } else if (copy.product) {
            const { publicationDate, ...details } = copy.product;
            const isbn = details.isbn?.replace(/[\s-]/g, "") || null;
            if (isbn) {
              await manager.query(
                "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                [`isbn:${isbn}`],
              );
              product = await products
                .createQueryBuilder("product")
                .where(
                  "regexp_replace(product.isbn, '[^0-9Xx]', '', 'g') = :isbn",
                  { isbn },
                )
                .getOne();
            }
            product ??= await products.save(
              products.create({
                ...details,
                title: details.title.trim(),
                isbn,
                publicationDate: publicationDate
                  ? new Date(publicationDate)
                  : null,
              }),
            );
          }
          if (!product)
            throw new BadRequestException("Book details are missing.");
          const item = await inventory.save(
            inventory.create({
              itemId: randomUUID(),
              productId: product.productId,
              ownerId: user.userId,
              condition: copy.condition,
              conditionNotes: copy.conditionNotes?.trim() || null,
              availability: InventoryAvailability.LISTED,
              acquisitionPrice: null,
              sellerPhotoPath: null,
            }),
          );
          const listingItem = await listingItems.save(
            listingItems.create({ listing, inventoryItem: item }),
          );
          for (const [position, photoIndex] of copy.photoIndexes.entries()) {
            const upload = await this.media.uploadMarketplacePhoto(
              user.userId,
              item.itemId,
              photos[photoIndex],
            );
            uploadedKeys.push(upload.objectKey);
            const asset = await assets.save(assets.create(upload.asset));
            const base = {
              assetId: asset.assetId,
              publishedByUserId: user.userId,
              userId: null,
              catalogProductId: null,
              inventoryItemId: null,
              listingId: null,
              listingItemId: null,
              position,
              altText:
                `${product.title} — ${copy.condition}, photo ${position + 1}`.slice(
                  0,
                  255,
                ),
            };
            const source = await images.save(
              images.create({
                ...base,
                inventoryItemId: item.itemId,
                publicationSource: ImagePublicationSource.USER_UPLOAD,
                publicationOrigin: `inventory:${item.itemId}/seller-photo`,
                originImageId: null,
              }),
            );
            const reuse = {
              ...base,
              publicationSource: ImagePublicationSource.REUSE,
              publicationOrigin: `entity-image:${source.imageId}`,
              originImageId: source.imageId,
            };
            await images.save(
              images.create({
                ...reuse,
                listingItemId: listingItem.listingItemId,
              }),
            );
            if (listingPhotoPosition < 4) {
              await images.save(
                images.create({
                  ...reuse,
                  listingId: listing.listingId,
                  position: listingPhotoPosition++,
                }),
              );
            }
            if (position === 0)
              await inventory.update(item.itemId, {
                sellerPhotoPath: upload.publicUrl,
              });
          }
        }
        return {
          listingId: listing.listingId,
          title: listing.title,
          price: listing.price,
          status: listing.status,
        };
      });
    } catch (error) {
      try {
        await this.media.removeMarketplaceUploads(uploadedKeys);
      } catch {
        this.logger.error(
          `Unpublished photo cleanup required: ${uploadedKeys.join(", ")}`,
        );
      }
      throw error;
    }
  }
}
