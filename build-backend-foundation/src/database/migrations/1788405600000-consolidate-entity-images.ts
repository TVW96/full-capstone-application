import { MigrationInterface, QueryRunner } from "typeorm";

export class ConsolidateEntityImages1788405600000 implements MigrationInterface {
  name = "ConsolidateEntityImages1788405600000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "media_assets_origin_type_enum" AS ENUM (
        'user_upload', 'external_import', 'derived', 'system', 'migration'
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "media_assets"
        ADD COLUMN "origin_type" "media_assets_origin_type_enum",
        ADD COLUMN "origin_reference" varchar(2048),
        ADD COLUMN "derived_from_asset_id" uuid,
        ADD COLUMN "storage_provider" varchar(63)
    `);
    await queryRunner.query(`
      UPDATE "media_assets"
      SET
        "origin_type" = CASE
          WHEN "source_url" IS NOT NULL THEN 'external_import'::"media_assets_origin_type_enum"
          WHEN "uploaded_by_user_id" IS NOT NULL THEN 'user_upload'::"media_assets_origin_type_enum"
          ELSE 'migration'::"media_assets_origin_type_enum"
        END,
        "origin_reference" = CASE
          WHEN "source_url" IS NOT NULL THEN "source_url"
          WHEN "uploaded_by_user_id" IS NOT NULL
            THEN 'user:' || "uploaded_by_user_id"::text
          ELSE 'migration:legacy-media-schema'
        END,
        "storage_provider" = 'supabase'
    `);
    await queryRunner.query(`
      ALTER TABLE "media_assets"
        ALTER COLUMN "origin_type" SET NOT NULL,
        ALTER COLUMN "origin_reference" SET NOT NULL,
        ALTER COLUMN "storage_provider" SET NOT NULL,
        ADD CONSTRAINT "FK_media_assets_derived_from"
          FOREIGN KEY ("derived_from_asset_id")
          REFERENCES "media_assets"("asset_id") ON DELETE SET NULL,
        ADD CONSTRAINT "CHK_media_assets_origin_reference"
          CHECK (length(trim("origin_reference")) > 0),
        ADD CONSTRAINT "CHK_media_assets_current_location"
          CHECK (
            length(trim("storage_provider")) > 0 AND
            length(trim("bucket")) > 0 AND
            length(trim("object_key")) > 0
          ),
        ADD CONSTRAINT "CHK_media_assets_derived_origin"
          CHECK (
            "origin_type" <> 'derived' OR "derived_from_asset_id" IS NOT NULL
          )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_media_assets_derived_from_asset_id"
      ON "media_assets" ("derived_from_asset_id")
    `);

    await queryRunner.query(`
      CREATE TYPE "entity_images_publication_source_enum" AS ENUM (
        'user_upload', 'reuse', 'system', 'migration'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "entity_images" (
        "image_id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "asset_id" uuid NOT NULL,
        "published_by_user_id" uuid,
        "publication_source" "entity_images_publication_source_enum" NOT NULL,
        "publication_origin" varchar(2048) NOT NULL,
        "origin_image_id" uuid,
        "user_id" uuid,
        "catalog_product_id" uuid,
        "inventory_item_id" uuid,
        "listing_id" uuid,
        "listing_item_id" uuid,
        "position" smallint NOT NULL DEFAULT 0,
        "alt_text" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_entity_images" PRIMARY KEY ("image_id"),
        CONSTRAINT "UQ_entity_images_avatar_reference"
          UNIQUE ("image_id", "asset_id", "user_id"),
        CONSTRAINT "FK_entity_images_asset" FOREIGN KEY ("asset_id")
          REFERENCES "media_assets"("asset_id") ON DELETE RESTRICT,
        CONSTRAINT "FK_entity_images_published_by_user"
          FOREIGN KEY ("published_by_user_id")
          REFERENCES "users"("user_id") ON DELETE SET NULL,
        CONSTRAINT "FK_entity_images_origin_image"
          FOREIGN KEY ("origin_image_id")
          REFERENCES "entity_images"("image_id") ON DELETE SET NULL,
        CONSTRAINT "FK_entity_images_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("user_id") ON DELETE CASCADE,
        CONSTRAINT "FK_entity_images_catalog_product"
          FOREIGN KEY ("catalog_product_id")
          REFERENCES "catalog_products"("product_id") ON DELETE CASCADE,
        CONSTRAINT "FK_entity_images_inventory_item"
          FOREIGN KEY ("inventory_item_id")
          REFERENCES "inventory_items"("item_id") ON DELETE CASCADE,
        CONSTRAINT "FK_entity_images_listing" FOREIGN KEY ("listing_id")
          REFERENCES "listings"("listing_id") ON DELETE CASCADE,
        CONSTRAINT "FK_entity_images_listing_item"
          FOREIGN KEY ("listing_item_id")
          REFERENCES "listing_items"("listing_item_id") ON DELETE CASCADE,
        CONSTRAINT "CHK_entity_images_exactly_one_target" CHECK (
          num_nonnulls(
            "user_id", "catalog_product_id", "inventory_item_id",
            "listing_id", "listing_item_id"
          ) = 1
        ),
        CONSTRAINT "CHK_entity_images_position" CHECK (
          "position" BETWEEN 0 AND 31
        ),
        CONSTRAINT "CHK_entity_images_reuse_origin" CHECK (
          "publication_source" <> 'reuse' OR
          "origin_image_id" IS NOT NULL OR
          "publication_origin" LIKE 'entity-image:%'
        ),
        CONSTRAINT "CHK_entity_images_publication_origin" CHECK (
          length(trim("publication_origin")) > 0
        ),
        CONSTRAINT "CHK_entity_images_avatar_position" CHECK (
          "user_id" IS NULL OR "position" = 0
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_entity_images_asset" ON "entity_images" ("asset_id")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_entity_images_published_by"
      ON "entity_images" ("published_by_user_id", "created_at")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_user"
      ON "entity_images" ("user_id") WHERE "user_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_catalog_asset"
      ON "entity_images" ("catalog_product_id", "asset_id")
      WHERE "catalog_product_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_catalog_position"
      ON "entity_images" ("catalog_product_id", "position")
      WHERE "catalog_product_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_inventory_asset"
      ON "entity_images" ("inventory_item_id", "asset_id")
      WHERE "inventory_item_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_inventory_position"
      ON "entity_images" ("inventory_item_id", "position")
      WHERE "inventory_item_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_listing_asset"
      ON "entity_images" ("listing_id", "asset_id")
      WHERE "listing_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_listing_position"
      ON "entity_images" ("listing_id", "position")
      WHERE "listing_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_listing_item_asset"
      ON "entity_images" ("listing_item_id", "asset_id")
      WHERE "listing_item_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_entity_images_listing_item_position"
      ON "entity_images" ("listing_item_id", "position")
      WHERE "listing_item_id" IS NOT NULL
    `);

    await queryRunner.query(`
      INSERT INTO "entity_images" (
        "image_id", "asset_id", "published_by_user_id",
        "publication_source", "publication_origin",
        "catalog_product_id", "position", "alt_text"
      )
      SELECT
        image."image_id", image."asset_id", asset."uploaded_by_user_id",
        'migration', 'migration:catalog_product_images',
        image."product_id", image."position", image."alt_text"
      FROM "catalog_product_images" image
      JOIN "media_assets" asset ON asset."asset_id" = image."asset_id"
    `);
    await queryRunner.query(`
      INSERT INTO "entity_images" (
        "image_id", "asset_id", "published_by_user_id",
        "publication_source", "publication_origin",
        "inventory_item_id", "position", "alt_text"
      )
      SELECT
        image."image_id", image."asset_id", asset."uploaded_by_user_id",
        'migration', 'migration:inventory_item_images',
        image."item_id", image."position", image."alt_text"
      FROM "inventory_item_images" image
      JOIN "media_assets" asset ON asset."asset_id" = image."asset_id"
    `);
    await queryRunner.query(`
      INSERT INTO "entity_images" (
        "image_id", "asset_id", "published_by_user_id",
        "publication_source", "publication_origin",
        "listing_item_id", "position", "alt_text"
      )
      SELECT
        image."image_id", image."asset_id", asset."uploaded_by_user_id",
        'migration', 'migration:listing_item_images',
        image."listing_item_id", image."position", image."alt_text"
      FROM "listing_item_images" image
      JOIN "media_assets" asset ON asset."asset_id" = image."asset_id"
    `);
    await queryRunner.query(`
      INSERT INTO "entity_images" (
        "asset_id", "published_by_user_id", "publication_source",
        "publication_origin", "user_id", "position", "alt_text"
      )
      SELECT
        user_row."avatar_asset_id",
        COALESCE(asset."uploaded_by_user_id", user_row."user_id"),
        'migration', 'migration:users.avatar_asset_id',
        user_row."user_id", 0, user_row."full_name" || ' profile photo'
      FROM "users" user_row
      JOIN "media_assets" asset
        ON asset."asset_id" = user_row."avatar_asset_id"
      WHERE user_row."avatar_asset_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users" ADD COLUMN "avatar_image_id" uuid
    `);
    await queryRunner.query(`
      UPDATE "users" user_row
      SET "avatar_image_id" = image."image_id"
      FROM "entity_images" image
      WHERE image."user_id" = user_row."user_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD CONSTRAINT "FK_users_avatar_image"
          FOREIGN KEY ("avatar_image_id")
          REFERENCES "entity_images"("image_id") ON DELETE SET NULL,
        ADD CONSTRAINT "FK_users_avatar_publication_integrity"
          FOREIGN KEY ("avatar_image_id", "avatar_asset_id", "user_id")
          REFERENCES "entity_images"("image_id", "asset_id", "user_id")
          DEFERRABLE INITIALLY DEFERRED
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_users_avatar_image_id"
      ON "users" ("avatar_image_id")
    `);

    await queryRunner.query(`DROP TABLE "listing_item_images"`);
    await queryRunner.query(`DROP TABLE "inventory_item_images"`);
    await queryRunner.query(`DROP TABLE "catalog_product_images"`);
    await queryRunner.query(
      `ALTER TABLE "entity_images" ENABLE ROW LEVEL SECURITY`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
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
        CONSTRAINT "CHK_catalog_product_images_position"
          CHECK ("position" BETWEEN 0 AND 31)
      )
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
        CONSTRAINT "CHK_inventory_item_images_position"
          CHECK ("position" BETWEEN 0 AND 31)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "listing_item_images" (
        "image_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "listing_item_id" uuid NOT NULL,
        "asset_id" uuid NOT NULL,
        "position" smallint NOT NULL,
        "alt_text" varchar(255),
        CONSTRAINT "PK_listing_item_images" PRIMARY KEY ("image_id"),
        CONSTRAINT "FK_listing_item_images_listing_item"
          FOREIGN KEY ("listing_item_id")
          REFERENCES "listing_items"("listing_item_id") ON DELETE CASCADE,
        CONSTRAINT "FK_listing_item_images_asset" FOREIGN KEY ("asset_id")
          REFERENCES "media_assets"("asset_id") ON DELETE RESTRICT,
        CONSTRAINT "CHK_listing_item_images_position"
          CHECK ("position" BETWEEN 0 AND 31)
      )
    `);
    await queryRunner.query(`
      INSERT INTO "catalog_product_images"
      SELECT "image_id", "catalog_product_id", "asset_id", "position", "alt_text"
      FROM "entity_images" WHERE "catalog_product_id" IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "inventory_item_images"
      SELECT "image_id", "inventory_item_id", "asset_id", "position", "alt_text"
      FROM "entity_images" WHERE "inventory_item_id" IS NOT NULL
    `);
    await queryRunner.query(`
      INSERT INTO "listing_item_images"
      SELECT "image_id", "listing_item_id", "asset_id", "position", "alt_text"
      FROM "entity_images" WHERE "listing_item_id" IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
        DROP CONSTRAINT "FK_users_avatar_publication_integrity",
        DROP CONSTRAINT "FK_users_avatar_image"
    `);
    await queryRunner.query(`DROP INDEX "public"."IDX_users_avatar_image_id"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "avatar_image_id"`,
    );
    await queryRunner.query(`DROP TABLE "entity_images"`);
    await queryRunner.query(
      `DROP TYPE "entity_images_publication_source_enum"`,
    );

    await queryRunner.query(`
      ALTER TABLE "media_assets"
        DROP CONSTRAINT "CHK_media_assets_derived_origin",
        DROP CONSTRAINT "CHK_media_assets_current_location",
        DROP CONSTRAINT "CHK_media_assets_origin_reference",
        DROP CONSTRAINT "FK_media_assets_derived_from"
    `);
    await queryRunner.query(`
      DROP INDEX "public"."IDX_media_assets_derived_from_asset_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "media_assets"
        DROP COLUMN "storage_provider",
        DROP COLUMN "derived_from_asset_id",
        DROP COLUMN "origin_reference",
        DROP COLUMN "origin_type"
    `);
    await queryRunner.query(`DROP TYPE "media_assets_origin_type_enum"`);
  }
}
