import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMediaStorageSchema1788319200000
  implements MigrationInterface
{
  name = 'AddMediaStorageSchema1788319200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TYPE "media_assets_status_enum"
      AS ENUM ('pending', 'ready', 'failed')
    `);

    await queryRunner.query(`
      CREATE TABLE "media_assets" (
        "asset_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "uploaded_by_user_id" uuid,
        "bucket" varchar(63) NOT NULL,
        "object_key" varchar(1024) NOT NULL,
        "mime_type" varchar(100) NOT NULL,
        "byte_size" bigint NOT NULL,
        "width" integer,
        "height" integer,
        "original_file_name" varchar(255) NOT NULL,
        "source_url" varchar(2048),
        "status" "media_assets_status_enum" NOT NULL DEFAULT 'pending',
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_media_assets" PRIMARY KEY ("asset_id"),
        CONSTRAINT "FK_media_assets_uploaded_by_user" FOREIGN KEY ("uploaded_by_user_id")
          REFERENCES "users"("user_id") ON DELETE SET NULL,
        CONSTRAINT "CHK_media_assets_byte_size" CHECK (
          "byte_size" BETWEEN 1 AND 8388608
        ),
        CONSTRAINT "CHK_media_assets_mime_type" CHECK (
          "mime_type" IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
        ),
        CONSTRAINT "CHK_media_assets_dimensions" CHECK (
          ("width" IS NULL OR "width" > 0) AND
          ("height" IS NULL OR "height" > 0)
        )
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_media_assets_bucket_object_key"
      ON "media_assets" ("bucket", "object_key")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_media_assets_uploader_created_at"
      ON "media_assets" ("uploaded_by_user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_media_assets_pending_created_at"
      ON "media_assets" ("created_at") WHERE "status" = 'pending'
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "avatar_asset_id" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "FK_users_avatar_asset" FOREIGN KEY ("avatar_asset_id")
        REFERENCES "media_assets"("asset_id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_avatar_asset_id"
      ON "users" ("avatar_asset_id")
    `);

    await queryRunner.query(`
      CREATE TABLE "catalog_product_images" (
        "image_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "product_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "position" smallint NOT NULL,
        "alt_text" varchar(255),
        CONSTRAINT "PK_catalog_product_images" PRIMARY KEY ("image_id"),
        CONSTRAINT "FK_catalog_product_images_product" FOREIGN KEY ("product_id")
          REFERENCES "catalog_products"("product_id") ON DELETE CASCADE,
        CONSTRAINT "FK_catalog_product_images_asset" FOREIGN KEY ("asset_id")
          REFERENCES "media_assets"("asset_id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_catalog_product_images_position" CHECK (
          "position" BETWEEN 0 AND 31
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_catalog_product_images_product_asset"
      ON "catalog_product_images" ("product_id", "asset_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_catalog_product_images_product_position"
      ON "catalog_product_images" ("product_id", "position")
    `);

    await queryRunner.query(`
      CREATE TABLE "inventory_item_images" (
        "image_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "position" smallint NOT NULL,
        "alt_text" varchar(255),
        CONSTRAINT "PK_inventory_item_images" PRIMARY KEY ("image_id"),
        CONSTRAINT "FK_inventory_item_images_item" FOREIGN KEY ("item_id")
          REFERENCES "inventory_items"("item_id") ON DELETE CASCADE,
        CONSTRAINT "FK_inventory_item_images_asset" FOREIGN KEY ("asset_id")
          REFERENCES "media_assets"("asset_id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_inventory_item_images_position" CHECK (
          "position" BETWEEN 0 AND 31
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_inventory_item_images_item_asset"
      ON "inventory_item_images" ("item_id", "asset_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_inventory_item_images_item_position"
      ON "inventory_item_images" ("item_id", "position")
    `);

    await queryRunner.query(`
      CREATE TABLE "listing_item_images" (
        "image_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listing_item_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "position" smallint NOT NULL,
        "alt_text" varchar(255),
        CONSTRAINT "PK_listing_item_images" PRIMARY KEY ("image_id"),
        CONSTRAINT "FK_listing_item_images_listing_item" FOREIGN KEY ("listing_item_id")
          REFERENCES "listing_items"("listing_item_id") ON DELETE CASCADE,
        CONSTRAINT "FK_listing_item_images_asset" FOREIGN KEY ("asset_id")
          REFERENCES "media_assets"("asset_id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_listing_item_images_position" CHECK (
          "position" BETWEEN 0 AND 31
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_listing_item_images_item_asset"
      ON "listing_item_images" ("listing_item_id", "asset_id")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_listing_item_images_item_position"
      ON "listing_item_images" ("listing_item_id", "position")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "listing_item_images"`);
    await queryRunner.query(`DROP TABLE "inventory_item_images"`);
    await queryRunner.query(`DROP TABLE "catalog_product_images"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_avatar_asset_id"`);
    await queryRunner.query(`
      ALTER TABLE "users" DROP CONSTRAINT "FK_users_avatar_asset"
    `);
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN "avatar_asset_id"
    `);
    await queryRunner.query(`DROP TABLE "media_assets"`);
    await queryRunner.query(`DROP TYPE "media_assets_status_enum"`);
  }
}
