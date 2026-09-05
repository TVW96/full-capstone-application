# Authenticated listing publication

`POST /sell/listings` accepts a custom account bearer session and multipart
form data. Authentication runs before file buffering and again before writes.
Supply one `payload` field containing JSON and 1–8 `photos` file parts:

```json
{
  "submissionId": "client-generated-v4-uuid",
  "title": "Manga volumes 1 and 2",
  "description": "A two-copy bundle",
  "price": 18.50,
  "copies": [
    {
      "productId": "existing-catalog-v4-uuid",
      "condition": "Very good",
      "conditionNotes": "Light shelf wear",
      "photoIndexes": [0]
    },
    {
      "product": { "title": "Another volume", "language": "en" },
      "condition": "Good",
      "photoIndexes": [1]
    }
  ]
}
```

Each copy supplies exactly one of `productId` or `product`. New products accept
existing catalog DTO fields. Valid normalized ISBNs are reused when already
present in the catalog; no seller photos are attached to shared catalog rows.
Condition is `New`, `Like new`, `Very good`, `Good`, or `Acceptable`. Price is
USD, 0.01–99,999,999.99. Each uploaded file is assigned to exactly one copy.

The server derives inventory `ownerId` and listing `sellerId` from the session.
It creates `CatalogProduct` (when needed), `InventoryItem`, `Listing`, and
`ListingItem` rows together; inventory is `listed` and the listing is `active`.
The older `POST /listings/seller/:sellerId` and item-removal route now also
require an authenticated matching seller. The older catalog/inventory write
stubs are not used by this workflow.

Photos go to the existing public-read `marketplace-images` bucket, using the
server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Apply the existing
schema/security migrations to provision tables and, on Supabase, the bucket.
When using native PostgreSQL, provision the bucket separately in the chosen
Supabase project. No new schema migration is needed for selling.

Image files must be JPEG, PNG, WebP, or AVIF, at most 8 MiB each, 25 megapixels,
and 32 MiB combined. Sharp decodes them, normalizes orientation, strips EXIF/GPS,
and emits WebP. The service stores canonical `MediaAsset` metadata including
actual byte size and dimensions. Each inventory photo receives a source
`EntityImage`; listing-item publications reuse that source. The listing reuses
its first four photos. Each publication targets exactly one entity. The first
photo URL is also written to `sellerPhotoPath` for existing inventory readers.

The entire publication runs in a database transaction. Object-storage uploads
are sequential and immutable. A failure rolls back database records and
attempts to remove uploaded objects. Failed cleanup logs object keys for
operator cleanup; process termination can still leave unreferenced objects,
so a periodic orphan sweep remains future operational work.

The client retains `submissionId`; it is also the new listing UUID. A
transaction-scoped PostgreSQL advisory lock serializes duplicate submissions.
Retries by the same seller return the first persisted result without creating
more records or uploading files again. A different seller cannot reuse that
ID. This contract does not update an already published listing.

Success returns `{ listingId, title, price, status }`, with decimal price as a
string and status `active`. This endpoint uses bounded multipart uploads like
the existing avatar endpoint. The presigned/direct-upload architecture in
`media-storage-design.md` is a future scaling path, not this implementation.

## Checks

Run `npm run build` and
`npm test -- --runInBand selling media.service.spec.ts listings.controller.spec.ts listings.service.spec.ts`.
Tests isolate database and storage dependencies; they do not establish live
Supabase connectivity or execute database transactions on a real database.
The repository's ESLint command currently lacks an ESLint configuration file;
backend verification used TypeScript compilation, Prettier, and focused tests.
