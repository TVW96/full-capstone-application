-- Transactional integrity checks for the consolidated media schema.
-- Run after the application baseline and security migrations. No test rows are retained.

begin;

insert into public.users (
  user_id,
  email,
  username,
  full_name,
  mailing_address_line_1,
  region
)
values (
  '10000000-0000-4000-8000-000000000001',
  'media-schema@example.com',
  'media_schema_test',
  'Media Schema Test',
  '1 Constraint Lane',
  'US'
);

insert into public.catalog_products (product_id, title)
values (
  '20000000-0000-4000-8000-000000000001',
  'Constraint Test Volume'
);

insert into public.media_assets (
  asset_id,
  uploaded_by_user_id,
  origin_type,
  origin_reference,
  storage_provider,
  bucket,
  object_key,
  mime_type,
  byte_size,
  original_file_name,
  status
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'user_upload',
    'user:10000000-0000-4000-8000-000000000001/account-avatar',
    'supabase',
    'avatars',
    'users/10000000-0000-4000-8000-000000000001/avatars/test.jpg',
    'image/jpeg',
    1024,
    'test.jpg',
    'ready'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'user_upload',
    'user:10000000-0000-4000-8000-000000000001/catalog',
    'supabase',
    'marketplace-images',
    'catalog/test.jpg',
    'image/jpeg',
    2048,
    'catalog.jpg',
    'ready'
  );

insert into public.entity_images (
  image_id,
  asset_id,
  published_by_user_id,
  publication_source,
  publication_origin,
  user_id,
  position,
  alt_text
)
values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001',
  'user_upload',
  'user:10000000-0000-4000-8000-000000000001/account-avatar',
  '10000000-0000-4000-8000-000000000001',
  0,
  'Media Schema Test profile photo'
);

update public.users
set
  avatar_asset_id = '30000000-0000-4000-8000-000000000001',
  avatar_image_id = '40000000-0000-4000-8000-000000000001'
where user_id = '10000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1
    from public.users user_row
    join public.entity_images image
      on image.image_id = user_row.avatar_image_id
      and image.asset_id = user_row.avatar_asset_id
      and image.user_id = user_row.user_id
    join public.media_assets asset
      on asset.asset_id = image.asset_id
    where user_row.user_id = '10000000-0000-4000-8000-000000000001'
      and asset.storage_provider = 'supabase'
      and asset.origin_reference like 'user:%'
  ) then
    raise exception 'Avatar asset, publication, origin, and location did not join';
  end if;
end
$$;

do $$
begin
  begin
    insert into public.entity_images (
      asset_id,
      publication_source,
      publication_origin
    )
    values (
      '30000000-0000-4000-8000-000000000002',
      'system',
      'test:orphan-publication'
    );
    raise exception 'Orphan publication was accepted';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
begin
  begin
    insert into public.entity_images (
      asset_id,
      publication_source,
      publication_origin,
      user_id,
      catalog_product_id
    )
    values (
      '30000000-0000-4000-8000-000000000002',
      'system',
      'test:ambiguous-publication',
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001'
    );
    raise exception 'Ambiguous multi-target publication was accepted';
  exception
    when check_violation then null;
  end;
end
$$;

do $$
begin
  begin
    update public.users
    set avatar_asset_id = '30000000-0000-4000-8000-000000000002'
    where user_id = '10000000-0000-4000-8000-000000000001';

    set constraints fk_users_avatar_publication_integrity immediate;
    raise exception 'Mismatched avatar asset and publication were accepted';
  exception
    when foreign_key_violation then
      set constraints fk_users_avatar_publication_integrity deferred;
  end;
end
$$;

rollback;
