-- Stage the data-preserving Supabase migration.
-- This upgrades the legacy image tables in place. It never drops a table
-- until its rows have been copied to entity_images.

begin;

create extension if not exists pgcrypto;

do $$
declare
  missing text;
begin
  select string_agg(required_table, ', ')
    into missing
  from (values ('users'), ('catalog_products'), ('inventory_items'),
               ('listings'), ('listing_items'), ('media_assets')) as required(required_table)
  where to_regclass('public.' || required_table) is null;
  if missing is not null then
    raise exception 'Cannot run data-preserving migration; missing tables: %', missing;
  end if;
end $$;

alter table public.users add column if not exists avatar_asset_id uuid;
alter table public.users add column if not exists avatar_image_id uuid;

do $type$
begin
  if to_regtype('public.media_assets_origin_type_enum') is null then
    create type public.media_assets_origin_type_enum as enum
      ('user_upload', 'external_import', 'derived', 'system', 'migration');
  end if;
end
$type$;

alter table public.media_assets
  add column if not exists origin_type public.media_assets_origin_type_enum,
  add column if not exists origin_reference varchar(2048),
  add column if not exists derived_from_asset_id uuid,
  add column if not exists storage_provider varchar(63);

update public.media_assets
set origin_type = case
      when source_url is not null then 'external_import'::public.media_assets_origin_type_enum
      when uploaded_by_user_id is not null then 'user_upload'::public.media_assets_origin_type_enum
      else 'migration'::public.media_assets_origin_type_enum
    end,
    origin_reference = case
      when source_url is not null then source_url
      when uploaded_by_user_id is not null then 'user:' || uploaded_by_user_id::text
      else 'migration:legacy-media-schema'
    end,
    storage_provider = 'supabase'
where origin_type is null or origin_reference is null or storage_provider is null;

alter table public.media_assets
  alter column origin_type set not null,
  alter column origin_reference set not null,
  alter column storage_provider set not null;
do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_assets'::regclass
      and conname = 'fk_media_assets_derived_from'
  ) then
    alter table public.media_assets add constraint fk_media_assets_derived_from
      foreign key (derived_from_asset_id)
      references public.media_assets(asset_id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_assets'::regclass
      and conname = 'chk_media_assets_origin_reference'
  ) then
    alter table public.media_assets add constraint chk_media_assets_origin_reference
      check (length(trim(origin_reference)) > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_assets'::regclass
      and conname = 'chk_media_assets_current_location'
  ) then
    alter table public.media_assets add constraint chk_media_assets_current_location
      check (length(trim(storage_provider)) > 0 and length(trim(bucket)) > 0
        and length(trim(object_key)) > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.media_assets'::regclass
      and conname = 'chk_media_assets_derived_origin'
  ) then
    alter table public.media_assets add constraint chk_media_assets_derived_origin
      check (origin_type <> 'derived' or derived_from_asset_id is not null);
  end if;
end
$constraints$;
create index if not exists idx_media_assets_derived_from_asset_id
  on public.media_assets(derived_from_asset_id);

do $type$
begin
  if to_regtype('public.entity_images_publication_source_enum') is null then
    create type public.entity_images_publication_source_enum as enum
      ('user_upload', 'reuse', 'system', 'migration');
  end if;
end
$type$;

create table if not exists public.entity_images (
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

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.entity_images'::regclass
      and conname = 'chk_entity_images_reuse_origin'
  ) then
    alter table public.entity_images add constraint chk_entity_images_reuse_origin
      check (publication_source <> 'reuse' or origin_image_id is not null
        or publication_origin like 'entity-image:%');
  end if;
end
$constraints$;

create index if not exists idx_entity_images_asset_id
  on public.entity_images(asset_id);
create index if not exists idx_entity_images_published_by
  on public.entity_images(published_by_user_id, created_at);
create unique index if not exists idx_entity_images_user
  on public.entity_images(user_id) where user_id is not null;
create unique index if not exists idx_entity_images_catalog_asset
  on public.entity_images(catalog_product_id, asset_id)
  where catalog_product_id is not null;
create unique index if not exists idx_entity_images_catalog_position
  on public.entity_images(catalog_product_id, position)
  where catalog_product_id is not null;
create unique index if not exists idx_entity_images_inventory_asset
  on public.entity_images(inventory_item_id, asset_id)
  where inventory_item_id is not null;
create unique index if not exists idx_entity_images_inventory_position
  on public.entity_images(inventory_item_id, position)
  where inventory_item_id is not null;
create unique index if not exists idx_entity_images_listing_asset
  on public.entity_images(listing_id, asset_id)
  where listing_id is not null;
create unique index if not exists idx_entity_images_listing_position
  on public.entity_images(listing_id, position)
  where listing_id is not null;
create unique index if not exists idx_entity_images_listing_item_asset
  on public.entity_images(listing_item_id, asset_id)
  where listing_item_id is not null;
create unique index if not exists idx_entity_images_listing_item_position
  on public.entity_images(listing_item_id, position)
  where listing_item_id is not null;

do $$
begin
  if to_regclass('public.catalog_product_images') is not null then
    insert into public.entity_images
      (image_id, asset_id, published_by_user_id, publication_source,
       publication_origin, catalog_product_id, position, alt_text)
    select i.image_id, i.asset_id, a.uploaded_by_user_id, 'migration',
           'migration:catalog_product_images', i.product_id, i.position, i.alt_text
    from public.catalog_product_images i
    join public.media_assets a on a.asset_id = i.asset_id
    on conflict (image_id) do nothing;
  end if;
  if to_regclass('public.inventory_item_images') is not null then
    insert into public.entity_images
      (image_id, asset_id, published_by_user_id, publication_source,
       publication_origin, inventory_item_id, position, alt_text)
    select i.image_id, i.asset_id, a.uploaded_by_user_id, 'migration',
           'migration:inventory_item_images', i.item_id, i.position, i.alt_text
    from public.inventory_item_images i
    join public.media_assets a on a.asset_id = i.asset_id
    on conflict (image_id) do nothing;
  end if;
  if to_regclass('public.listing_item_images') is not null then
    insert into public.entity_images
      (image_id, asset_id, published_by_user_id, publication_source,
       publication_origin, listing_item_id, position, alt_text)
    select i.image_id, i.asset_id, a.uploaded_by_user_id, 'migration',
           'migration:listing_item_images', i.listing_item_id, i.position, i.alt_text
    from public.listing_item_images i
    join public.media_assets a on a.asset_id = i.asset_id
    on conflict (image_id) do nothing;
  end if;
end $$;

insert into public.entity_images
  (asset_id, published_by_user_id, publication_source, publication_origin,
   user_id, position, alt_text)
select u.avatar_asset_id, coalesce(a.uploaded_by_user_id, u.user_id), 'migration',
       'migration:users.avatar_asset_id', u.user_id, 0, u.full_name || ' profile photo'
from public.users u
join public.media_assets a on a.asset_id = u.avatar_asset_id
where u.avatar_asset_id is not null
on conflict do nothing;

update public.users u
set avatar_image_id = i.image_id
from public.entity_images i
where i.user_id = u.user_id and u.avatar_image_id is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'fk_users_avatar_asset'
  ) and not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and pg_get_constraintdef(oid) like '%(avatar_asset_id)%'
  ) then
    alter table public.users add constraint fk_users_avatar_asset
      foreign key (avatar_asset_id) references public.media_assets(asset_id)
      on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'fk_users_avatar_image'
  ) then
    alter table public.users add constraint fk_users_avatar_image
      foreign key (avatar_image_id) references public.entity_images(image_id)
      on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.users'::regclass
      and conname = 'fk_users_avatar_publication_integrity'
  ) then
    alter table public.users add constraint fk_users_avatar_publication_integrity
      foreign key (avatar_image_id, avatar_asset_id, user_id)
      references public.entity_images(image_id, asset_id, user_id)
      deferrable initially deferred;
  end if;
end $$;

create index if not exists idx_users_avatar_asset_id on public.users(avatar_asset_id);
create index if not exists idx_users_avatar_image_id on public.users(avatar_image_id);

do $validate$
begin
  if to_regclass('public.catalog_product_images') is not null and exists (
    select 1
    from public.catalog_product_images legacy
    left join public.entity_images image
      on image.image_id = legacy.image_id
      and image.asset_id = legacy.asset_id
      and image.catalog_product_id = legacy.product_id
    where image.image_id is null
  ) then
    raise exception 'Refusing to drop catalog_product_images: not every row was copied';
  end if;
  if to_regclass('public.inventory_item_images') is not null and exists (
    select 1
    from public.inventory_item_images legacy
    left join public.entity_images image
      on image.image_id = legacy.image_id
      and image.asset_id = legacy.asset_id
      and image.inventory_item_id = legacy.item_id
    where image.image_id is null
  ) then
    raise exception 'Refusing to drop inventory_item_images: not every row was copied';
  end if;
  if to_regclass('public.listing_item_images') is not null and exists (
    select 1
    from public.listing_item_images legacy
    left join public.entity_images image
      on image.image_id = legacy.image_id
      and image.asset_id = legacy.asset_id
      and image.listing_item_id = legacy.listing_item_id
    where image.image_id is null
  ) then
    raise exception 'Refusing to drop listing_item_images: not every row was copied';
  end if;
  if exists (
    select 1
    from public.users user_row
    where user_row.avatar_asset_id is not null
      and not exists (
        select 1
        from public.entity_images image
        where image.image_id = user_row.avatar_image_id
          and image.asset_id = user_row.avatar_asset_id
          and image.user_id = user_row.user_id
      )
  ) then
    raise exception 'Refusing to finish migration: an avatar publication is missing or mismatched';
  end if;
end
$validate$;

drop table if exists public.catalog_product_images;
drop table if exists public.inventory_item_images;
drop table if exists public.listing_item_images;

alter table public.entity_images enable row level security;
alter table public.media_assets enable row level security;
alter table public.users enable row level security;
alter table public.user_sessions enable row level security;
alter table public.user_addresses enable row level security;
alter table public.catalog_products enable row level security;
alter table public.inventory_items enable row level security;
alter table public.listings enable row level security;
alter table public.listing_items enable row level security;

commit;
