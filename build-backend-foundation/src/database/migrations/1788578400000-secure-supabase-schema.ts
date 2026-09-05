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

export class SecureSupabaseSchema1788578400000 implements MigrationInterface {
  name = "SecureSupabaseSchema1788578400000";

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $type$
      BEGIN
        IF to_regtype('public.media_assets_origin_type_enum') IS NULL THEN
          CREATE TYPE public.media_assets_origin_type_enum AS ENUM
            ('user_upload', 'external_import', 'derived', 'system', 'migration');
        END IF;
      END
      $type$;
    `);
    await queryRunner.query(`
      ALTER TABLE public.users
        ADD COLUMN IF NOT EXISTS avatar_asset_id uuid,
        ADD COLUMN IF NOT EXISTS avatar_image_id uuid;
      ALTER TABLE public.media_assets
        ADD COLUMN IF NOT EXISTS origin_type public.media_assets_origin_type_enum,
        ADD COLUMN IF NOT EXISTS origin_reference varchar(2048),
        ADD COLUMN IF NOT EXISTS derived_from_asset_id uuid,
        ADD COLUMN IF NOT EXISTS storage_provider varchar(63);
      UPDATE public.media_assets
      SET origin_type = CASE
            WHEN source_url IS NOT NULL THEN 'external_import'::public.media_assets_origin_type_enum
            WHEN uploaded_by_user_id IS NOT NULL THEN 'user_upload'::public.media_assets_origin_type_enum
            ELSE 'migration'::public.media_assets_origin_type_enum
          END,
          origin_reference = CASE
            WHEN source_url IS NOT NULL THEN source_url
            WHEN uploaded_by_user_id IS NOT NULL THEN 'user:' || uploaded_by_user_id::text
            ELSE 'migration:legacy-media-schema'
          END,
          storage_provider = 'supabase'
      WHERE origin_type IS NULL OR origin_reference IS NULL OR storage_provider IS NULL;
      ALTER TABLE public.media_assets
        ALTER COLUMN origin_type SET NOT NULL,
        ALTER COLUMN origin_reference SET NOT NULL,
        ALTER COLUMN storage_provider SET NOT NULL;
    `);

    await queryRunner.query(`
      DO $type$
      BEGIN
        IF to_regtype('public.entity_images_publication_source_enum') IS NULL THEN
          CREATE TYPE public.entity_images_publication_source_enum AS ENUM
            ('user_upload', 'reuse', 'system', 'migration');
        END IF;
      END
      $type$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS public.entity_images (
        image_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_id uuid NOT NULL REFERENCES public.media_assets(asset_id) ON DELETE RESTRICT,
        published_by_user_id uuid REFERENCES public.users(user_id) ON DELETE SET NULL,
        publication_source public.entity_images_publication_source_enum NOT NULL,
        publication_origin varchar(2048) NOT NULL,
        origin_image_id uuid REFERENCES public.entity_images(image_id) ON DELETE SET NULL,
        user_id uuid REFERENCES public.users(user_id) ON DELETE CASCADE,
        catalog_product_id uuid REFERENCES public.catalog_products(product_id) ON DELETE CASCADE,
        inventory_item_id uuid REFERENCES public.inventory_items(item_id) ON DELETE CASCADE,
        listing_id uuid REFERENCES public.listings(listing_id) ON DELETE CASCADE,
        listing_item_id uuid REFERENCES public.listing_items(listing_item_id) ON DELETE CASCADE,
        position smallint NOT NULL DEFAULT 0,
        alt_text varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_entity_images_avatar_reference UNIQUE (image_id, asset_id, user_id),
        CONSTRAINT chk_entity_images_exactly_one_target CHECK (
          num_nonnulls(user_id, catalog_product_id, inventory_item_id, listing_id, listing_item_id) = 1
        ),
        CONSTRAINT chk_entity_images_position CHECK (position BETWEEN 0 AND 31),
        CONSTRAINT chk_entity_images_publication_origin CHECK (length(trim(publication_origin)) > 0),
        CONSTRAINT chk_entity_images_avatar_position CHECK (user_id IS NULL OR position = 0)
      )
    `);

    await queryRunner.query(`
      DO $copy$
      BEGIN
        IF to_regclass('public.catalog_product_images') IS NOT NULL THEN
          INSERT INTO public.entity_images
            (image_id, asset_id, published_by_user_id, publication_source,
             publication_origin, catalog_product_id, position, alt_text)
          SELECT i.image_id, i.asset_id, a.uploaded_by_user_id, 'migration',
                 'migration:catalog_product_images', i.product_id, i.position, i.alt_text
          FROM public.catalog_product_images i
          JOIN public.media_assets a ON a.asset_id = i.asset_id
          ON CONFLICT (image_id) DO NOTHING;
        END IF;
        IF to_regclass('public.inventory_item_images') IS NOT NULL THEN
          INSERT INTO public.entity_images
            (image_id, asset_id, published_by_user_id, publication_source,
             publication_origin, inventory_item_id, position, alt_text)
          SELECT i.image_id, i.asset_id, a.uploaded_by_user_id, 'migration',
                 'migration:inventory_item_images', i.item_id, i.position, i.alt_text
          FROM public.inventory_item_images i
          JOIN public.media_assets a ON a.asset_id = i.asset_id
          ON CONFLICT (image_id) DO NOTHING;
        END IF;
        IF to_regclass('public.listing_item_images') IS NOT NULL THEN
          INSERT INTO public.entity_images
            (image_id, asset_id, published_by_user_id, publication_source,
             publication_origin, listing_item_id, position, alt_text)
          SELECT i.image_id, i.asset_id, a.uploaded_by_user_id, 'migration',
                 'migration:listing_item_images', i.listing_item_id, i.position, i.alt_text
          FROM public.listing_item_images i
          JOIN public.media_assets a ON a.asset_id = i.asset_id
          ON CONFLICT (image_id) DO NOTHING;
        END IF;
      END
      $copy$;
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_entity_images_asset_id
        ON public.entity_images(asset_id);
      CREATE INDEX IF NOT EXISTS idx_entity_images_published_by
        ON public.entity_images(published_by_user_id, created_at);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_user
        ON public.entity_images(user_id) WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_catalog_asset
        ON public.entity_images(catalog_product_id, asset_id)
        WHERE catalog_product_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_catalog_position
        ON public.entity_images(catalog_product_id, position)
        WHERE catalog_product_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_inventory_asset
        ON public.entity_images(inventory_item_id, asset_id)
        WHERE inventory_item_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_inventory_position
        ON public.entity_images(inventory_item_id, position)
        WHERE inventory_item_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_listing_asset
        ON public.entity_images(listing_id, asset_id) WHERE listing_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_listing_position
        ON public.entity_images(listing_id, position) WHERE listing_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_listing_item_asset
        ON public.entity_images(listing_item_id, asset_id)
        WHERE listing_item_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_images_listing_item_position
        ON public.entity_images(listing_item_id, position)
        WHERE listing_item_id IS NOT NULL;
    `);

    await queryRunner.query(`
      INSERT INTO public.entity_images
        (asset_id, published_by_user_id, publication_source, publication_origin,
         user_id, position, alt_text)
      SELECT u.avatar_asset_id, COALESCE(a.uploaded_by_user_id, u.user_id), 'migration',
             'migration:users.avatar_asset_id', u.user_id, 0, u.full_name || ' profile photo'
      FROM public.users u
      JOIN public.media_assets a ON a.asset_id = u.avatar_asset_id
      WHERE u.avatar_asset_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(`
      UPDATE public.users u
      SET avatar_image_id = i.image_id
      FROM public.entity_images i
      WHERE i.user_id = u.user_id AND u.avatar_image_id IS NULL
    `);

    await queryRunner.query(`
      DO $constraints$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND conname = 'fk_users_avatar_asset'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND pg_get_constraintdef(oid) LIKE '%(avatar_asset_id)%'
        ) THEN
          ALTER TABLE public.users ADD CONSTRAINT fk_users_avatar_asset
            FOREIGN KEY (avatar_asset_id) REFERENCES public.media_assets(asset_id)
            ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND conname = 'fk_users_avatar_image'
        ) THEN
          ALTER TABLE public.users ADD CONSTRAINT fk_users_avatar_image
            FOREIGN KEY (avatar_image_id) REFERENCES public.entity_images(image_id)
            ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND conname = 'fk_users_avatar_publication_integrity'
        ) THEN
          ALTER TABLE public.users ADD CONSTRAINT fk_users_avatar_publication_integrity
            FOREIGN KEY (avatar_image_id, avatar_asset_id, user_id)
            REFERENCES public.entity_images(image_id, asset_id, user_id)
            DEFERRABLE INITIALLY DEFERRED;
        END IF;
      END
      $constraints$;
    `);

    for (const tableName of APPLICATION_TABLES) {
      await queryRunner.query(
        `ALTER TABLE public."${tableName}" ENABLE ROW LEVEL SECURITY`,
      );
    }

    // Supabase exposes the public schema through its Data API. These roles do
    // not exist in plain local Postgres, so the revokes are conditional.
    await queryRunner.query(`
      DO $security$
      DECLARE
        role_name text;
        table_name text;
      BEGIN
        FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated']
        LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
            FOREACH table_name IN ARRAY ARRAY[
              'users', 'user_sessions', 'user_addresses', 'catalog_products',
              'inventory_items', 'listings', 'listing_items', 'media_assets',
              'entity_images'
            ]
            LOOP
              EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
                table_name,
                role_name
              );
            END LOOP;

            EXECUTE format(
              'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
              role_name
            );
          END IF;
        END LOOP;
      END
      $security$;
    `);

    // Supabase Storage owns this table. Dynamic SQL keeps this migration
    // portable: local PostgreSQL simply skips bucket provisioning.
    await queryRunner.query(`
      DO $storage$
      BEGIN
        IF to_regclass('storage.buckets') IS NOT NULL THEN
          EXECUTE $buckets$
            INSERT INTO storage.buckets (
              id,
              name,
              public,
              file_size_limit,
              allowed_mime_types
            )
            VALUES
              (
                'avatars',
                'avatars',
                true,
                2097152,
                ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
              ),
              (
                'marketplace-images',
                'marketplace-images',
                true,
                8388608,
                ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
              )
            ON CONFLICT (id) DO UPDATE SET
              name = EXCLUDED.name,
              public = EXCLUDED.public,
              file_size_limit = EXCLUDED.file_size_limit,
              allowed_mime_types = EXCLUDED.allowed_mime_types
          $buckets$;
        END IF;
      END
      $storage$;
    `);
  }

  async down(): Promise<void> {
    // Security revocation and Storage bucket creation are intentionally not
    // undone. Re-enabling Data API access or deleting buckets during a schema
    // rollback would be unsafe and could orphan stored objects.
  }
}
