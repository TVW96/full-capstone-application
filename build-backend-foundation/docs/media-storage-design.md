# Media storage design

## Decision

Store image bytes in Supabase Storage and store only ownership, metadata, order,
and relationships in PostgreSQL. The application should never store image
blobs or base64 strings in an application table.

Use two public-read buckets:

| Bucket               | Contents                                    | Limit |
| -------------------- | ------------------------------------------- | ----- |
| `avatars`            | Current and historical user avatars         | 2 MiB |
| `marketplace-images` | Catalog, inventory, and listing-item images | 8 MiB |

Both buckets accept only JPEG, PNG, WebP, and AVIF. SVG is intentionally
excluded because an uploaded SVG can contain active content. Public read access
fits this marketplace because all four image types are displayed publicly.
Upload, replacement, and deletion remain server-authorized operations.

## Database model

`media_assets` is the canonical record for every stored object. It separates
the asset's immutable origin from its current physical location:

- `origin_type` and `origin_reference` retain how and where the asset entered
  the system, even if the uploading user is later deleted;
- `uploaded_by_user_id` links the origin to an existing user when applicable;
- `derived_from_asset_id` links a derivative to its source asset;
- `storage_provider`, `bucket`, and `object_key` identify the current object;
- MIME type, size, dimensions, and status describe the stored bytes.

`entity_images` is the single publication table. Every row has one required
`asset_id` and exactly one current target: user, catalog product, inventory
item, listing, or listing item. A database check using `num_nonnulls(...) = 1`
prevents both orphan publications and ambiguous multi-target publications.
Partial unique indexes enforce image ordering independently for each target.

Publication origin is separate from asset origin. `publication_source`,
`publication_origin`, `published_by_user_id`, and optional `origin_image_id`
record who published the asset, how it was published, and which earlier
publication it was reused from. The target columns record where that
publication currently appears.

An avatar is represented by all three links:

1. `users.avatar_asset_id` references `media_assets.asset_id`;
2. `users.avatar_image_id` references `entity_images.image_id`;
3. a deferred composite foreign key proves that the avatar publication's
   `asset_id` and `user_id` match the current user's avatar columns.

The existing `users.avatar_url` and `inventory_items.seller_photo_path` fields
are retained temporarily for backward compatibility and should be removed after
all reads derive URLs from the linked asset's current storage location.

The same asset may have several `entity_images` rows. When a seller publishes
an inventory image in a listing, create a reuse publication referencing the
origin image row; do not copy the file. Storage is paid for once while the
publication lineage remains queryable.

## Object keys

Never use an email, username, or original filename as an object key. Generate a
UUID for every asset and use immutable keys:

```text
users/{userId}/avatars/{assetId}.{extension}
catalog/{productId}/{assetId}.{extension}
users/{userId}/inventory/{itemId}/{assetId}.{extension}
users/{userId}/listing-items/{listingItemId}/{assetId}.{extension}
```

Do not overwrite an existing key. A replacement creates a new asset and then
changes the database relationship. Immutable URLs avoid stale CDN content and
make rollback straightforward.

## Upload flow

The current Start selling implementation uses authenticated, bounded multipart
uploads, image decoding, and transactional publication. See
[`selling-publish.md`](selling-publish.md) for its endpoint and retry contract.
The direct-upload flow below remains the proposed scaling design.

1. The browser requests an upload from the Nest API with the target, MIME type,
   filename, and byte size.
2. The API authenticates the custom MangaMarketplace session. It also verifies
   that the user owns the inventory/listing item, or is an administrator for a
   catalog upload.
3. The API creates a `pending` media row and returns a five-minute presigned PUT
   URL. Supabase S3 credentials remain server-only.
4. The browser uploads directly to Supabase Storage. The image does not pass
   through Next.js or Nest, avoiding unnecessary server memory and bandwidth.
5. The browser calls the completion endpoint. Nest performs `HeadObject`,
   verifies the actual type and length, records dimensions after decoding the
   image, creates the `entity_images` publication, and marks the asset `ready`
   in one database transaction.
6. A scheduled cleanup removes pending objects older than 24 hours. Deleting a
   relationship deletes the object only when no other avatar or image relation
   references its asset.

Uploads should be rejected unless all of these checks pass:

- the user owns the target;
- the declared and detected MIME types agree;
- the file is within the target limit;
- the decoded data is a valid image;
- dimensions are positive and below a configured pixel limit;
- per-user image count and storage quota are within bounds.

## Initial limits

Start with one avatar, four catalog images, eight inventory images, four listing
images, and eight listing-item images per parent record. Use zero-based
`position` values. These limits are application rules; the database supports
positions 0 through 31 so they can grow without another schema migration.

## Supabase security

The Nest API uses the direct PostgreSQL connection and server-only S3
credentials. Browser clients do not receive the database password, service-role
key, or S3 secret. Enable RLS on public application tables without client
policies so the Supabase Data API cannot bypass Nest authorization. Public
buckets allow CDN reads, but public status does not grant write or delete
access.

Database setup is migration-driven. The portable application-schema baseline
creates only MangaMarketplace tables in `public`; the following security
migration enables RLS, revokes Data API roles, and provisions buckets only when
the Supabase-managed `storage.buckets` table exists. Neither migration drops or
recreates Supabase-managed `auth`, `storage`, or system schemas during upgrade.
