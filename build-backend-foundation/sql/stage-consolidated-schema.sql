-- Stage the consolidated schema in Supabase.
-- Run this on a new/empty project. For an existing project, use
-- stage-data-preserving-supabase-migration.sql instead.

begin;

create extension if not exists pgcrypto;

create type public.inventory_items_availability_enum as enum
  ('available', 'listed', 'sold', 'unavailable');
create type public.listings_status_enum as enum
  ('draft', 'active', 'sold', 'cancelled');
create type public.media_assets_status_enum as enum
  ('pending', 'ready', 'failed');
create type public.media_assets_origin_type_enum as enum
  ('user_upload', 'external_import', 'derived', 'system', 'migration');
create type public.entity_images_publication_source_enum as enum
  ('user_upload', 'reuse', 'system', 'migration');

create table public.users (
  user_id uuid primary key default gen_random_uuid(),
  email varchar(320) not null unique,
  username varchar(50) not null unique,
  full_name varchar(120) not null,
  mailing_address_line_1 varchar(255) not null,
  mailing_address_line_2 varchar(255),
  region varchar(2) not null,
  password_hash varchar(255),
  avatar_url varchar,
  avatar_asset_id uuid,
  avatar_image_id uuid,
  bio text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint chk_users_region check (region ~ '^[A-Z]{2}$')
);

create table public.user_sessions (
  session_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamp not null default now()
);
create index idx_user_sessions_user_id on public.user_sessions(user_id);
create index idx_user_sessions_expires_at on public.user_sessions(expires_at);

create table public.user_addresses (
  address_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(user_id) on delete cascade,
  label varchar(60) not null default 'Address',
  address_line_1 varchar(255) not null,
  address_line_2 varchar(255),
  city varchar(100) not null default '',
  administrative_area varchar(100),
  postal_code varchar(24) not null default '',
  country varchar(2) not null,
  is_default boolean not null default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint chk_user_addresses_country check (country ~ '^[A-Z]{2}$')
);
create index idx_user_addresses_user_id on public.user_addresses(user_id);
create unique index idx_user_addresses_one_default
  on public.user_addresses(user_id) where is_default;

create table public.catalog_products (
  product_id uuid primary key default gen_random_uuid(),
  title varchar(160) not null,
  series varchar(160),
  volume_number integer,
  edition varchar(80),
  isbn varchar(20),
  author varchar(160),
  publisher varchar(160),
  language varchar(10),
  publication_date date,
  constraint chk_catalog_products_volume check
    (volume_number is null or volume_number > 0)
);
create unique index idx_catalog_products_isbn
  on public.catalog_products(isbn) where isbn is not null;

create table public.inventory_items (
  item_id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.catalog_products(product_id) on delete restrict,
  owner_id uuid not null references public.users(user_id) on delete restrict,
  condition varchar(50) not null,
  condition_notes text,
  availability public.inventory_items_availability_enum not null default 'available',
  acquisition_price numeric(10, 2),
  seller_photo_path varchar,
  constraint chk_inventory_items_acquisition_price check
    (acquisition_price is null or acquisition_price >= 0)
);
create index idx_inventory_items_product_id on public.inventory_items(product_id);
create index idx_inventory_items_owner_id on public.inventory_items(owner_id);
create index idx_inventory_items_owner_availability
  on public.inventory_items(owner_id, availability);

create table public.listings (
  listing_id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.users(user_id) on delete restrict,
  title varchar(160) not null,
  description text,
  price numeric(10, 2) not null,
  status public.listings_status_enum not null default 'draft',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint chk_listings_price check (price >= 0)
);
create index idx_listings_seller_id on public.listings(seller_id);
create index idx_listings_status_created_at
  on public.listings(status, created_at desc);

create table public.listing_items (
  listing_item_id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(listing_id) on delete cascade,
  item_id uuid not null references public.inventory_items(item_id) on delete restrict,
  constraint uq_listing_items_listing_item unique (listing_id, item_id)
);
create index idx_listing_items_listing_id on public.listing_items(listing_id);
create index idx_listing_items_item_id on public.listing_items(item_id);

create table public.media_assets (
  asset_id uuid primary key default gen_random_uuid(),
  uploaded_by_user_id uuid references public.users(user_id) on delete set null,
  origin_type public.media_assets_origin_type_enum not null,
  origin_reference varchar(2048) not null,
  derived_from_asset_id uuid references public.media_assets(asset_id) on delete set null,
  storage_provider varchar(63) not null,
  bucket varchar(63) not null,
  object_key varchar(1024) not null,
  mime_type varchar(100) not null,
  byte_size bigint not null,
  width integer,
  height integer,
  original_file_name varchar(255) not null,
  source_url varchar(2048),
  status public.media_assets_status_enum not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_media_assets_bucket_object_key unique (bucket, object_key),
  constraint chk_media_assets_byte_size check (byte_size between 1 and 8388608),
  constraint chk_media_assets_mime_type check
    (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
  constraint chk_media_assets_dimensions check
    ((width is null or width > 0) and (height is null or height > 0)),
  constraint chk_media_assets_origin_reference check (length(trim(origin_reference)) > 0),
  constraint chk_media_assets_current_location check
    (length(trim(storage_provider)) > 0 and length(trim(bucket)) > 0
      and length(trim(object_key)) > 0),
  constraint chk_media_assets_derived_origin check
    (origin_type <> 'derived' or derived_from_asset_id is not null)
);
create index idx_media_assets_uploader_created_at
  on public.media_assets(uploaded_by_user_id, created_at);
create index idx_media_assets_pending_created_at
  on public.media_assets(created_at) where status = 'pending';
create index idx_media_assets_derived_from_asset_id
  on public.media_assets(derived_from_asset_id);

alter table public.users add constraint fk_users_avatar_asset
  foreign key (avatar_asset_id) references public.media_assets(asset_id) on delete set null;
create index idx_users_avatar_asset_id on public.users(avatar_asset_id);

create table public.entity_images (
  image_id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.media_assets(asset_id) on delete restrict,
  published_by_user_id uuid references public.users(user_id) on delete set null,
  publication_source public.entity_images_publication_source_enum not null,
  publication_origin varchar(2048) not null,
  origin_image_id uuid references public.entity_images(image_id) on delete set null,
  user_id uuid references public.users(user_id) on delete cascade,
  catalog_product_id uuid references public.catalog_products(product_id) on delete cascade,
  inventory_item_id uuid references public.inventory_items(item_id) on delete cascade,
  listing_id uuid references public.listings(listing_id) on delete cascade,
  listing_item_id uuid references public.listing_items(listing_item_id) on delete cascade,
  position smallint not null default 0,
  alt_text varchar(255),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_entity_images_avatar_reference unique (image_id, asset_id, user_id),
  constraint chk_entity_images_exactly_one_target check
    (num_nonnulls(user_id, catalog_product_id, inventory_item_id, listing_id, listing_item_id) = 1),
  constraint chk_entity_images_position check (position between 0 and 31),
  constraint chk_entity_images_reuse_origin check
    (publication_source <> 'reuse' or origin_image_id is not null
      or publication_origin like 'entity-image:%'),
  constraint chk_entity_images_publication_origin check (length(trim(publication_origin)) > 0),
  constraint chk_entity_images_avatar_position check (user_id is null or position = 0)
);
create index idx_entity_images_asset_id on public.entity_images(asset_id);
create index idx_entity_images_published_by
  on public.entity_images(published_by_user_id, created_at);
create unique index idx_entity_images_user
  on public.entity_images(user_id) where user_id is not null;
create unique index idx_entity_images_catalog_asset
  on public.entity_images(catalog_product_id, asset_id) where catalog_product_id is not null;
create unique index idx_entity_images_catalog_position
  on public.entity_images(catalog_product_id, position) where catalog_product_id is not null;
create unique index idx_entity_images_inventory_asset
  on public.entity_images(inventory_item_id, asset_id) where inventory_item_id is not null;
create unique index idx_entity_images_inventory_position
  on public.entity_images(inventory_item_id, position) where inventory_item_id is not null;
create unique index idx_entity_images_listing_asset
  on public.entity_images(listing_id, asset_id) where listing_id is not null;
create unique index idx_entity_images_listing_position
  on public.entity_images(listing_id, position) where listing_id is not null;
create unique index idx_entity_images_listing_item_asset
  on public.entity_images(listing_item_id, asset_id) where listing_item_id is not null;
create unique index idx_entity_images_listing_item_position
  on public.entity_images(listing_item_id, position) where listing_item_id is not null;

alter table public.users add constraint fk_users_avatar_image
  foreign key (avatar_image_id) references public.entity_images(image_id) on delete set null;
alter table public.users add constraint fk_users_avatar_publication_integrity
  foreign key (avatar_image_id, avatar_asset_id, user_id)
  references public.entity_images(image_id, asset_id, user_id)
  deferrable initially deferred;
create index idx_users_avatar_image_id on public.users(avatar_image_id);

commit;
