import { MigrationInterface, QueryRunner } from "typeorm";

const APPLICATION_TABLES = [
  "users",
  "user_sessions",
  "user_addresses",
  "catalog_products",
  "inventory_items",
  "listings",
  "listing_items",
  "media_assets",
  "entity_images",
] as const;

export class ApplicationSchemaBaseline1788492000000 implements MigrationInterface {
  name = "ApplicationSchemaBaseline1788492000000";

  async up(queryRunner: QueryRunner): Promise<void> {
    const existingTables: Array<{ table_name: string }> =
      await queryRunner.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = ANY($1)
      `,
        [APPLICATION_TABLES],
      );

    if (existingTables.length > 0) {
      const existingNames = new Set(
        existingTables.map(({ table_name }) => table_name),
      );
      const missingTables = APPLICATION_TABLES.filter(
        (tableName) => !existingNames.has(tableName),
      );

      // Legacy installations legitimately predate the consolidated image
      // table. The following security migration creates it and preserves the
      // legacy image rows.
      if (
        missingTables.length > 0 &&
        !(missingTables.length === 1 && missingTables[0] === "entity_images")
      ) {
        throw new Error(
          `Refusing to baseline a partial application schema. Missing tables: ${missingTables.join(", ")}.`,
        );
      }

      // Existing installations reached this schema through the legacy migration
      // chain. Recording this migration adopts them into the portable baseline
      // without deleting or rewriting their data.
      return;
    }

    await queryRunner.query(`
      CREATE TYPE public.inventory_items_availability_enum AS ENUM (
        'available', 'listed', 'sold', 'unavailable'
      );
      CREATE TYPE public.listings_status_enum AS ENUM (
        'draft', 'active', 'sold', 'cancelled'
      );
      CREATE TYPE public.media_assets_status_enum AS ENUM (
        'pending', 'ready', 'failed'
      );
      CREATE TYPE public.media_assets_origin_type_enum AS ENUM (
        'user_upload', 'external_import', 'derived', 'system', 'migration'
      );
      CREATE TYPE public.entity_images_publication_source_enum AS ENUM (
        'user_upload', 'reuse', 'system', 'migration'
      );

      CREATE TABLE public.users (
        user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email varchar(320) NOT NULL UNIQUE,
        username varchar(50) NOT NULL UNIQUE,
        full_name varchar(120) NOT NULL,
        mailing_address_line_1 varchar(255) NOT NULL,
        mailing_address_line_2 varchar(255),
        region varchar(2) NOT NULL,
        password_hash varchar(255),
        avatar_url varchar,
        avatar_asset_id uuid,
        avatar_image_id uuid,
        bio text,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT chk_users_region CHECK (region ~ '^[A-Z]{2}$')
      );

      CREATE TABLE public.user_sessions (
        session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        created_at timestamp NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
      CREATE INDEX idx_user_sessions_expires_at ON public.user_sessions(expires_at);

      CREATE TABLE public.user_addresses (
        address_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
        label varchar(60) NOT NULL DEFAULT 'Address',
        address_line_1 varchar(255) NOT NULL,
        address_line_2 varchar(255),
        city varchar(100) NOT NULL DEFAULT '',
        administrative_area varchar(100),
        postal_code varchar(24) NOT NULL DEFAULT '',
        country varchar(2) NOT NULL,
        is_default boolean NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT chk_user_addresses_country CHECK (country ~ '^[A-Z]{2}$')
      );
      CREATE INDEX idx_user_addresses_user_id ON public.user_addresses(user_id);
      CREATE UNIQUE INDEX idx_user_addresses_one_default
        ON public.user_addresses(user_id) WHERE is_default;

      CREATE TABLE public.catalog_products (
        product_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        title varchar(160) NOT NULL,
        series varchar(160),
        volume_number integer,
        edition varchar(80),
        isbn varchar(20),
        author varchar(160),
        publisher varchar(160),
        language varchar(10),
        publication_date date,
        CONSTRAINT chk_catalog_products_volume CHECK (
          volume_number IS NULL OR volume_number > 0
        )
      );
      CREATE UNIQUE INDEX idx_catalog_products_isbn
        ON public.catalog_products(isbn) WHERE isbn IS NOT NULL;

      CREATE TABLE public.inventory_items (
        item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id uuid NOT NULL REFERENCES public.catalog_products(product_id)
          ON DELETE RESTRICT,
        owner_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
        condition varchar(50) NOT NULL,
        condition_notes text,
        availability public.inventory_items_availability_enum NOT NULL
          DEFAULT 'available',
        acquisition_price numeric(10, 2),
        seller_photo_path varchar,
        CONSTRAINT chk_inventory_items_acquisition_price CHECK (
          acquisition_price IS NULL OR acquisition_price >= 0
        )
      );
      CREATE INDEX idx_inventory_items_product_id
        ON public.inventory_items(product_id);
      CREATE INDEX idx_inventory_items_owner_id
        ON public.inventory_items(owner_id);
      CREATE INDEX idx_inventory_items_owner_availability
        ON public.inventory_items(owner_id, availability);

      CREATE TABLE public.listings (
        listing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        seller_id uuid NOT NULL REFERENCES public.users(user_id) ON DELETE RESTRICT,
        title varchar(160) NOT NULL,
        description text,
        price numeric(10, 2) NOT NULL,
        status public.listings_status_enum NOT NULL DEFAULT 'draft',
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT chk_listings_price CHECK (price >= 0)
      );
      CREATE INDEX idx_listings_seller_id ON public.listings(seller_id);
      CREATE INDEX idx_listings_status_created_at
        ON public.listings(status, created_at DESC);

      CREATE TABLE public.listing_items (
        listing_item_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        listing_id uuid NOT NULL REFERENCES public.listings(listing_id)
          ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES public.inventory_items(item_id)
          ON DELETE RESTRICT,
        CONSTRAINT uq_listing_items_listing_item UNIQUE (listing_id, item_id)
      );
      CREATE INDEX idx_listing_items_listing_id
        ON public.listing_items(listing_id);
      CREATE INDEX idx_listing_items_item_id ON public.listing_items(item_id);

      CREATE TABLE public.media_assets (
        asset_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        uploaded_by_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
        origin_type public.media_assets_origin_type_enum NOT NULL,
        origin_reference varchar(2048) NOT NULL,
        derived_from_asset_id uuid REFERENCES public.media_assets(asset_id)
          ON DELETE SET NULL,
        storage_provider varchar(63) NOT NULL,
        bucket varchar(63) NOT NULL,
        object_key varchar(1024) NOT NULL,
        mime_type varchar(100) NOT NULL,
        byte_size bigint NOT NULL,
        width integer,
        height integer,
        original_file_name varchar(255) NOT NULL,
        source_url varchar(2048),
        status public.media_assets_status_enum NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_media_assets_bucket_object_key UNIQUE (bucket, object_key),
        CONSTRAINT chk_media_assets_byte_size CHECK (
          byte_size BETWEEN 1 AND 8388608
        ),
        CONSTRAINT chk_media_assets_mime_type CHECK (
          mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')
        ),
        CONSTRAINT chk_media_assets_dimensions CHECK (
          (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)
        ),
        CONSTRAINT chk_media_assets_origin_reference CHECK (
          length(trim(origin_reference)) > 0
        ),
        CONSTRAINT chk_media_assets_current_location CHECK (
          length(trim(storage_provider)) > 0 AND
          length(trim(bucket)) > 0 AND
          length(trim(object_key)) > 0
        ),
        CONSTRAINT chk_media_assets_derived_origin CHECK (
          origin_type <> 'derived' OR derived_from_asset_id IS NOT NULL
        )
      );
      CREATE INDEX idx_media_assets_uploader_created_at
        ON public.media_assets(uploaded_by_user_id, created_at);
      CREATE INDEX idx_media_assets_pending_created_at
        ON public.media_assets(created_at) WHERE status = 'pending';
      CREATE INDEX idx_media_assets_derived_from_asset_id
        ON public.media_assets(derived_from_asset_id);

      ALTER TABLE public.users
        ADD CONSTRAINT fk_users_avatar_asset
        FOREIGN KEY (avatar_asset_id) REFERENCES public.media_assets(asset_id)
        ON DELETE SET NULL;
      CREATE INDEX idx_users_avatar_asset_id ON public.users(avatar_asset_id);

      CREATE TABLE public.entity_images (
        image_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES public.media_assets(asset_id)
          ON DELETE RESTRICT,
        published_by_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
        publication_source public.entity_images_publication_source_enum NOT NULL,
        publication_origin varchar(2048) NOT NULL,
        origin_image_id uuid REFERENCES public.entity_images(image_id)
          ON DELETE SET NULL,
        user_id uuid REFERENCES public.users(user_id) ON DELETE CASCADE,
        catalog_product_id uuid REFERENCES public.catalog_products(product_id)
          ON DELETE CASCADE,
        inventory_item_id uuid REFERENCES public.inventory_items(item_id)
          ON DELETE CASCADE,
        listing_id uuid REFERENCES public.listings(listing_id) ON DELETE CASCADE,
        listing_item_id uuid REFERENCES public.listing_items(listing_item_id)
          ON DELETE CASCADE,
        position smallint NOT NULL DEFAULT 0,
        alt_text varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_entity_images_avatar_reference
          UNIQUE (image_id, asset_id, user_id),
        CONSTRAINT chk_entity_images_exactly_one_target CHECK (
          num_nonnulls(
            user_id, catalog_product_id, inventory_item_id, listing_id, listing_item_id
          ) = 1
        ),
        CONSTRAINT chk_entity_images_position CHECK (position BETWEEN 0 AND 31),
        CONSTRAINT chk_entity_images_reuse_origin CHECK (
          publication_source <> 'reuse' OR
          origin_image_id IS NOT NULL OR
          publication_origin LIKE 'entity-image:%'
        ),
        CONSTRAINT chk_entity_images_publication_origin CHECK (
          length(trim(publication_origin)) > 0
        ),
        CONSTRAINT chk_entity_images_avatar_position CHECK (
          user_id IS NULL OR position = 0
        )
      );
      CREATE INDEX idx_entity_images_asset_id ON public.entity_images(asset_id);
      CREATE INDEX idx_entity_images_published_by
        ON public.entity_images(published_by_user_id, created_at);
      CREATE UNIQUE INDEX idx_entity_images_user
        ON public.entity_images(user_id) WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_catalog_asset
        ON public.entity_images(catalog_product_id, asset_id)
        WHERE catalog_product_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_catalog_position
        ON public.entity_images(catalog_product_id, position)
        WHERE catalog_product_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_inventory_asset
        ON public.entity_images(inventory_item_id, asset_id)
        WHERE inventory_item_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_inventory_position
        ON public.entity_images(inventory_item_id, position)
        WHERE inventory_item_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_listing_asset
        ON public.entity_images(listing_id, asset_id)
        WHERE listing_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_listing_position
        ON public.entity_images(listing_id, position)
        WHERE listing_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_listing_item_asset
        ON public.entity_images(listing_item_id, asset_id)
        WHERE listing_item_id IS NOT NULL;
      CREATE UNIQUE INDEX idx_entity_images_listing_item_position
        ON public.entity_images(listing_item_id, position)
        WHERE listing_item_id IS NOT NULL;

      ALTER TABLE public.users
        ADD CONSTRAINT fk_users_avatar_image
        FOREIGN KEY (avatar_image_id) REFERENCES public.entity_images(image_id)
        ON DELETE SET NULL;
      ALTER TABLE public.users
        ADD CONSTRAINT fk_users_avatar_publication_integrity
        FOREIGN KEY (avatar_image_id, avatar_asset_id, user_id)
        REFERENCES public.entity_images(image_id, asset_id, user_id)
        DEFERRABLE INITIALLY DEFERRED;
      CREATE INDEX idx_users_avatar_image_id ON public.users(avatar_image_id);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS public.entity_images CASCADE;
      DROP TABLE IF EXISTS public.media_assets CASCADE;
      DROP TABLE IF EXISTS public.listing_items CASCADE;
      DROP TABLE IF EXISTS public.listings CASCADE;
      DROP TABLE IF EXISTS public.inventory_items CASCADE;
      DROP TABLE IF EXISTS public.catalog_products CASCADE;
      DROP TABLE IF EXISTS public.user_addresses CASCADE;
      DROP TABLE IF EXISTS public.user_sessions CASCADE;
      DROP TABLE IF EXISTS public.users CASCADE;
      DROP TYPE IF EXISTS public.entity_images_publication_source_enum CASCADE;
      DROP TYPE IF EXISTS public.media_assets_origin_type_enum CASCADE;
      DROP TYPE IF EXISTS public.media_assets_status_enum CASCADE;
      DROP TYPE IF EXISTS public.listings_status_enum CASCADE;
      DROP TYPE IF EXISTS public.inventory_items_availability_enum CASCADE;
    `);
  }
}
